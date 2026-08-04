package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	mrand "math/rand"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"fortmont-agent/agent"
)

const (
	defaultServerURL    = "http://localhost:3000"
	defaultAgentVersion = "0.1.0"
)

func main() {
	serverURL := flag.String("server-url", "", "Base URL for Fortmont control plane")
	token := flag.String("token", "", "Join token generated from dashboard")
	name := flag.String("name", "", "Agent name override")
	description := flag.String("description", "", "Agent description override")
	deviceID := flag.String("device-id", "", "Unique device ID (auto-generated if empty)")
	version := flag.String("version", "", "Agent version override")
	stateFile := flag.String("state-file", "", "Override encrypted state file path")
	resetState := flag.Bool("reset-state", false, "Delete saved state and force new enrollment")
	metricsInterval := flag.Duration("metrics-interval", 15*time.Second, "Interval duration for sending system metrics")
	flag.Parse()

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-host"
	}

	statePath, err := agent.ResolveStatePath(*stateFile)
	if err != nil {
		log.Fatalf("state path error: %v", err)
	}

	if *resetState {
		_ = os.Remove(statePath)
	}

	storedState, err := agent.LoadEncryptedState(statePath)
	if err != nil {
		log.Printf("state load warning: %v", err)
	}

	base := agent.Pick(strings.TrimSpace(*serverURL), agent.StoredStateValue(storedState, func(s agent.AgentState) string { return s.ServerURL }), defaultServerURL)
	resolvedName := agent.Pick(strings.TrimSpace(*name), agent.StoredStateValue(storedState, func(s agent.AgentState) string { return s.Name }), "sample-agent")
	resolvedDescription := agent.Pick(strings.TrimSpace(*description), agent.StoredStateValue(storedState, func(s agent.AgentState) string { return s.Description }), "Go sample agent")
	resolvedVersion := agent.Pick(strings.TrimSpace(*version), agent.StoredStateValue(storedState, func(s agent.AgentState) string { return s.Version }), defaultAgentVersion)
	resolvedDeviceID := agent.Pick(strings.TrimSpace(*deviceID), agent.StoredStateValue(storedState, func(s agent.AgentState) string { return s.DeviceID }), "")

	if strings.TrimSpace(resolvedDeviceID) == "" {
		resolvedDeviceID = fmt.Sprintf("sample-%d-%04d", time.Now().Unix(), mrand.Intn(10000))
	}

	joinToken := strings.TrimSpace(*token)
	storedAuthToken := agent.StoredStateValue(storedState, func(s agent.AgentState) string { return s.AgentAuthToken })
	agentAuthToken := strings.TrimSpace(storedAuthToken)

	base = strings.TrimRight(base, "/")
	apiClient := &http.Client{Timeout: 15 * time.Second}
	localIP := agent.DetectLocalIPv4()
	publicIP := agent.DetectPublicIP()
	if localIP == "" {
		localIP = "127.0.0.1"
	}
	if publicIP == "" {
		log.Println("public IP lookup failed; API will infer from request headers")
	}
	sseClient := &http.Client{}

	if joinToken != "" {
		newAuthToken, registerErr := agent.Register(apiClient, base, agent.RegisterRequest{
			JoinToken:    joinToken,
			Name:         resolvedName,
			Description:  resolvedDescription,
			DeviceID:     resolvedDeviceID,
			Hostname:     hostname,
			LocalIP:      localIP,
			PublicIP:     publicIP,
			Platform:     runtime.GOOS,
			Architecture: runtime.GOARCH,
			Version:      resolvedVersion,
			Metadata: map[string]interface{}{
				"sample": true,
				"lang":   "go",
			},
		})

		if registerErr != nil {
			log.Fatalf("registration failed: %v", registerErr)
		}

		agentAuthToken = newAuthToken
		log.Printf("enrolled as deviceId=%s", resolvedDeviceID)
	} else {
		if agentAuthToken == "" {
			log.Fatal("no stored agent auth token found; enroll first with --server-url and --token")
		}

		if err := agent.Connect(apiClient, base, agentAuthToken, agent.ConnectRequest{
			DeviceID:     resolvedDeviceID,
			Name:         resolvedName,
			Description:  resolvedDescription,
			Hostname:     hostname,
			LocalIP:      localIP,
			PublicIP:     publicIP,
			Platform:     runtime.GOOS,
			Architecture: runtime.GOARCH,
			Version:      resolvedVersion,
			Metadata: map[string]interface{}{
				"sample": true,
				"lang":   "go",
			},
		}); err != nil {
			log.Fatalf("reconnect failed: %v (pass --token to re-enroll)", err)
		}

		log.Printf("reconnected as deviceId=%s", resolvedDeviceID)
	}

	if err := agent.SaveEncryptedState(statePath, agent.AgentState{
		ServerURL:      base,
		DeviceID:       resolvedDeviceID,
		AgentAuthToken: agentAuthToken,
		Name:           resolvedName,
		Description:    resolvedDescription,
		Version:        resolvedVersion,
	}); err != nil {
		log.Printf("state save warning: %v", err)
	}

	log.Printf("state file: %s", statePath)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Launch background heartbeat loop
	go agent.RunHeartbeatLoop(ctx, apiClient, base, agentAuthToken, agent.HeartbeatRequest{
		DeviceID: resolvedDeviceID,
		Version:  resolvedVersion,
		Hostname: hostname,
		LocalIP:  localIP,
		PublicIP: publicIP,
		Metadata: map[string]interface{}{"sample": true},
	})

	// Launch background metrics reporting loop (posts to POST /api/v2/agents/metrics)
	go agent.RunMetricsLoop(ctx, apiClient, base, agentAuthToken, resolvedDeviceID, *metricsInterval)

	// Block on SSE connection stream
	agent.RunSSELoop(ctx, sseClient, base, resolvedDeviceID, agentAuthToken)

	if err := agent.Unregister(apiClient, base, resolvedDeviceID, agentAuthToken); err != nil {
		log.Printf("unregister warning: %v", err)
	}

	log.Println("agent stopped")
}
