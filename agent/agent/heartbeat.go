package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"fortmont-agent/metrics"
)

type HeartbeatRequest struct {
	DeviceID string                 `json:"deviceId"`
	Version  string                 `json:"version"`
	Hostname string                 `json:"hostname"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

func RunHeartbeatLoop(ctx context.Context, client *http.Client, base, agentToken string, payload HeartbeatRequest) {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()

	for {
		if err := postHeartbeat(client, base, agentToken, payload); err != nil {
			log.Printf("heartbeat post failed: %v", err)
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// RunMetricsLoop periodically collects CPU, RAM, and Disk metrics and posts them to the server.
func RunMetricsLoop(ctx context.Context, client *http.Client, base, agentToken, deviceID string, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		sysMetrics, err := metrics.Collect(ctx)
		if err != nil {
			log.Printf("failed to collect system metrics: %v", err)
		} else {
			if err := PostMetrics(ctx, client, base, agentToken, deviceID, sysMetrics); err != nil {
				log.Printf("metrics post failed: %v", err)
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func postHeartbeat(client *http.Client, base, agentToken string, payload HeartbeatRequest) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := base + "/api/v2/agents/heartbeat"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	SetAgentTokenHeader(req, agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return ReadAPIError(resp)
	}

	return nil
}