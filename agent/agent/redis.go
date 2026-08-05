package agent

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const redisSessionRefreshSkew = 60 * time.Second

type HeartbeatPublisher interface {
	PublishHeartbeat(ctx context.Context, payload HeartbeatRequest) error
	Close() error
}

type RedisHeartbeatPublisher struct {
	httpClient *http.Client
	base       string
	agentToken string
	deviceID   string

	mu      sync.Mutex
	client  *redis.Client
	session *RedisSession
	expires time.Time
}

type redisHeartbeatEvent struct {
	Type          string                 `json:"type"`
	DeviceID      string                 `json:"deviceId"`
	Version       string                 `json:"version"`
	Hostname      string                 `json:"hostname"`
	LocalIP       string                 `json:"localIp,omitempty"`
	PublicIP      string                 `json:"publicIp,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	PublishedAt   string                 `json:"publishedAt"`
	PresenceKey   string                 `json:"presenceKey"`
	EventsChannel string                 `json:"eventsChannel"`
}

func NewRedisHeartbeatPublisher(httpClient *http.Client, base, agentToken, deviceID string) *RedisHeartbeatPublisher {
	return &RedisHeartbeatPublisher{
		httpClient: httpClient,
		base:       strings.TrimRight(base, "/"),
		agentToken: agentToken,
		deviceID:   deviceID,
	}
}

func (p *RedisHeartbeatPublisher) PublishHeartbeat(ctx context.Context, payload HeartbeatRequest) error {
	if err := p.ensureSession(ctx); err != nil {
		return err
	}

	p.mu.Lock()
	client := p.client
	session := p.session
	p.mu.Unlock()

	if client == nil || session == nil {
		return fmt.Errorf("redis session is not initialized")
	}

	event := redisHeartbeatEvent{
		Type:          "agent.heartbeat",
		DeviceID:      payload.DeviceID,
		Version:       payload.Version,
		Hostname:      payload.Hostname,
		LocalIP:       payload.LocalIP,
		PublicIP:      payload.PublicIP,
		Metadata:      payload.Metadata,
		PublishedAt:   time.Now().UTC().Format(time.RFC3339Nano),
		PresenceKey:   session.PresenceKey,
		EventsChannel: session.EventsChannel,
	}

	raw, err := json.Marshal(event)
	if err != nil {
		return err
	}

	ttlSeconds := session.PresenceTTLSec
	if ttlSeconds <= 0 {
		ttlSeconds = 90
	}

	if err := client.Set(ctx, session.PresenceKey, string(raw), time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		p.invalidateSession()
		return err
	}

	if err := client.Publish(ctx, session.EventsChannel, string(raw)).Err(); err != nil {
		p.invalidateSession()
		return err
	}

	return nil
}

func (p *RedisHeartbeatPublisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.client != nil {
		err := p.client.Close()
		p.client = nil
		p.session = nil
		p.expires = time.Time{}
		return err
	}

	return nil
}

func (p *RedisHeartbeatPublisher) ensureSession(ctx context.Context) error {
	p.mu.Lock()
	session := p.session
	expires := p.expires
	p.mu.Unlock()

	if session != nil && time.Now().Add(redisSessionRefreshSkew).Before(expires) {
		return nil
	}

	refreshed, err := RequestRedisSession(ctx, p.httpClient, p.base, p.agentToken, p.deviceID)
	if err != nil {
		return err
	}

	expiresAt, err := time.Parse(time.RFC3339, refreshed.ExpiresAt)
	if err != nil {
		return fmt.Errorf("invalid redis session expiry: %w", err)
	}

	addr := fmt.Sprintf("%s:%d", refreshed.Endpoint.Host, refreshed.Endpoint.Port)
	redisOptions := &redis.Options{
		Addr:         addr,
		Username:     refreshed.Username,
		Password:     refreshed.Password,
		DB:           refreshed.Endpoint.DB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	if refreshed.Endpoint.TLS {
		redisOptions.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	client := redis.NewClient(redisOptions)
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return err
	}

	p.mu.Lock()
	oldClient := p.client
	p.client = client
	p.session = refreshed
	p.expires = expiresAt
	p.mu.Unlock()

	if oldClient != nil {
		_ = oldClient.Close()
	}

	log.Printf("redis heartbeat session refreshed (expires %s)", expiresAt.Format(time.RFC3339))

	return nil
}

func (p *RedisHeartbeatPublisher) invalidateSession() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.client != nil {
		_ = p.client.Close()
	}

	p.client = nil
	p.session = nil
	p.expires = time.Time{}
}
