package main

import (
	"context"
	"fmt"
	mrand "math/rand"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"fortmont-agent/agent"
	"fortmont-agent/metrics"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type AgentStatus struct {
	IsRunning       bool   `json:"isRunning"`
	IsConnected     bool   `json:"isConnected"`
	IsEnrolled      bool   `json:"isEnrolled"`
	ServerURL       string `json:"serverUrl"`
	DeviceID        string `json:"deviceId"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	Version         string `json:"version"`
	StatePath       string `json:"statePath"`
	Hostname        string `json:"hostname"`
	LocalIP         string `json:"localIp"`
	PublicIP        string `json:"publicIp"`
	Platform        string `json:"platform"`
	Architecture    string `json:"architecture"`
	MetricsInterval int    `json:"metricsIntervalSeconds"`
	LastHeartbeat   string `json:"lastHeartbeat"`
	LastMetricsSent string `json:"lastMetricsSent"`
	ErrorMsg        string `json:"errorMsg"`
}

type FormattedMetrics struct {
	Timestamp   int64   `json:"timestamp"`
	CPUUsage    float64 `json:"cpuUsage"`
	CPUCores    int     `json:"cpuCores"`
	MemTotalMB  uint64  `json:"memTotalMb"`
	MemUsedMB   uint64  `json:"memUsedMb"`
	MemUsage    float64 `json:"memUsage"`
	DiskTotalGB uint64  `json:"diskTotalGb"`
	DiskUsedGB  uint64  `json:"diskUsedGb"`
	DiskUsage   float64 `json:"diskUsage"`
	StoragePath string  `json:"storagePath"`
}

type LogMessage struct {
	ID        int64  `json:"id"`
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"` // "info", "success", "warning", "error"
	Message   string `json:"message"`
}

type AgentService struct {
	mu              sync.Mutex
	ctx             context.Context
	cancel          context.CancelFunc
	isRunning       bool
	isConnected     bool
	lastHeartbeat   time.Time
	lastMetricsSent time.Time
	lastError       string
	publicIP        string
	logs            []LogMessage
	logCounter      int64
}

func NewAgentService() *AgentService {
	svc := &AgentService{
		logs: make([]LogMessage, 0, 100),
	}
	svc.addLog("info", "Fortmont Agent GUI service initialized")
	go func() {
		publicIP := agent.DetectPublicIP()
		if publicIP == "" {
			return
		}
		svc.mu.Lock()
		svc.publicIP = publicIP
		svc.mu.Unlock()
	}()
	return svc
}

func (s *AgentService) addLog(level, msg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logCounter++
	entry := LogMessage{
		ID:        s.logCounter,
		Timestamp: time.Now().Format("15:04:05"),
		Level:     level,
		Message:   msg,
	}

	s.logs = append(s.logs, entry)
	if len(s.logs) > 200 {
		s.logs = s.logs[len(s.logs)-200:]
	}

	app := application.Get()
	if app != nil {
		app.Event.Emit("agent-log", entry)
	}
}

func (s *AgentService) GetStatus() AgentStatus {
	s.mu.Lock()
	isRunning := s.isRunning
	isConnected := s.isConnected
	lastHeartbeat := s.lastHeartbeat
	lastMetricsSent := s.lastMetricsSent
	lastError := s.lastError
	publicIP := s.publicIP
	s.mu.Unlock()

	hostname, _ := os.Hostname()
	statePath, err := agent.ResolveStatePath("")
	if err != nil {
		statePath = "State path error"
	}

	storedState, _ := agent.LoadEncryptedState(statePath)

	serverURL := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.ServerURL })
	if serverURL == "" {
		serverURL = "http://localhost:3000"
	}
	deviceID := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.DeviceID })
	name := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.Name })
	if name == "" {
		name = "sample-agent"
	}
	desc := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.Description })
	if desc == "" {
		desc = "Go sample GUI agent"
	}
	ver := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.Version })
	if ver == "" {
		ver = "0.1.0"
	}
	authToken := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.AgentAuthToken })

	hbStr := "Never"
	if !lastHeartbeat.IsZero() {
		hbStr = lastHeartbeat.Format("15:04:05")
	}
	metStr := "Never"
	if !lastMetricsSent.IsZero() {
		metStr = lastMetricsSent.Format("15:04:05")
	}

	return AgentStatus{
		IsRunning:       isRunning,
		IsConnected:     isConnected,
		IsEnrolled:      strings.TrimSpace(authToken) != "",
		ServerURL:       serverURL,
		DeviceID:        deviceID,
		Name:            name,
		Description:     desc,
		Version:         ver,
		StatePath:       statePath,
		Hostname:        hostname,
		LocalIP:         agent.DetectLocalIPv4(),
		PublicIP:        publicIP,
		Platform:        runtime.GOOS,
		Architecture:    runtime.GOARCH,
		MetricsInterval: 15,
		LastHeartbeat:   hbStr,
		LastMetricsSent: metStr,
		ErrorMsg:        lastError,
	}
}

func (s *AgentService) GetMetrics() FormattedMetrics {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	sys, err := metrics.Collect(ctx)
	if err != nil {
		return FormattedMetrics{
			CPUCores: runtime.NumCPU(),
		}
	}

	return FormattedMetrics{
		Timestamp:   sys.Timestamp,
		CPUUsage:    sys.CPU.UsagePercent,
		CPUCores:    sys.CPU.Cores,
		MemTotalMB:  sys.Memory.TotalBytes / (1024 * 1024),
		MemUsedMB:   sys.Memory.UsedBytes / (1024 * 1024),
		MemUsage:    sys.Memory.UsagePercent,
		DiskTotalGB: sys.Storage.TotalBytes / (1024 * 1024 * 1024),
		DiskUsedGB:  sys.Storage.UsedBytes / (1024 * 1024 * 1024),
		DiskUsage:   sys.Storage.UsagePercent,
		StoragePath: sys.Storage.Path,
	}
}

func (s *AgentService) StartAgent() string {
	s.mu.Lock()
	if s.isRunning {
		s.mu.Unlock()
		return "Agent is already running"
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.ctx = ctx
	s.cancel = cancel
	s.isRunning = true
	s.lastError = ""
	s.mu.Unlock()

	s.addLog("info", "Starting background agent loops...")

	go s.runAgentLoop(ctx)

	return "Agent started successfully"
}

func (s *AgentService) StopAgent() string {
	s.mu.Lock()
	if !s.isRunning || s.cancel == nil {
		s.mu.Unlock()
		return "Agent is not running"
	}

	s.cancel()
	s.isRunning = false
	s.isConnected = false
	s.mu.Unlock()
	s.addLog("warning", "Agent background loops stopped")

	return "Agent stopped"
}

func (s *AgentService) RestartAgent() string {
	s.StopAgent()
	return s.StartAgent()
}

func (s *AgentService) Enroll(serverURL, joinToken, deviceID, name, description string) string {
	serverURL = strings.TrimSpace(strings.TrimRight(serverURL, "/"))
	joinToken = strings.TrimSpace(joinToken)
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)

	if serverURL == "" {
		return "Error: Server URL cannot be empty"
	}
	if joinToken == "" {
		return "Error: Join Token cannot be empty"
	}

	statePath, err := agent.ResolveStatePath("")
	if err != nil {
		return fmt.Sprintf("Error resolving state path: %v", err)
	}

	hostname, _ := os.Hostname()
	localIP := agent.DetectLocalIPv4()
	publicIP := agent.DetectPublicIP()
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		deviceID = fmt.Sprintf("sample-%d-%04d", time.Now().Unix(), mrand.Intn(10000))
	}
	if name == "" {
		name = "sample-agent"
	}
	if description == "" {
		description = "Go GUI agent"
	}

	s.addLog("info", fmt.Sprintf("Registering with %s...", serverURL))

	apiClient := &http.Client{Timeout: 15 * time.Second}
	authToken, err := agent.Register(apiClient, serverURL, agent.RegisterRequest{
		JoinToken:    joinToken,
		Name:         name,
		Description:  description,
		DeviceID:     deviceID,
		Hostname:     hostname,
		LocalIP:      localIP,
		PublicIP:     publicIP,
		Platform:     runtime.GOOS,
		Architecture: runtime.GOARCH,
		Version:      "0.1.0",
		Metadata: map[string]interface{}{
			"sample": true,
			"lang":   "go-gui",
		},
	})

	if err != nil {
		s.addLog("error", fmt.Sprintf("Registration failed: %v", err))
		return fmt.Sprintf("Registration failed: %v", err)
	}

	if err := agent.SaveEncryptedState(statePath, agent.AgentState{
		ServerURL:      serverURL,
		DeviceID:       deviceID,
		AgentAuthToken: authToken,
		Name:           name,
		Description:    description,
		Version:        "0.1.0",
	}); err != nil {
		s.addLog("warning", fmt.Sprintf("Failed to save state file: %v", err))
	}

	s.addLog("success", fmt.Sprintf("Enrolled successfully! DeviceID=%s", deviceID))

	// Restart agent background worker automatically after enrollment
	s.StopAgent()
	s.StartAgent()

	return "Enrolled successfully!"
}

func (s *AgentService) ResetState() string {
	statePath, err := agent.ResolveStatePath("")
	if err != nil {
		return fmt.Sprintf("State error: %v", err)
	}

	s.StopAgent()

	if err := os.Remove(statePath); err != nil && !os.IsNotExist(err) {
		s.addLog("error", fmt.Sprintf("Failed to remove state file: %v", err))
		return fmt.Sprintf("Failed to remove state file: %v", err)
	}

	s.addLog("warning", "State reset complete. Local token cleared.")
	return "State file deleted. Agent reset."
}

func (s *AgentService) GetLogs() []LogMessage {
	s.mu.Lock()
	defer s.mu.Unlock()

	result := make([]LogMessage, len(s.logs))
	copy(result, s.logs)
	return result
}

func (s *AgentService) ClearLogs() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logs = make([]LogMessage, 0, 100)
	return "Logs cleared"
}

func (s *AgentService) runAgentLoop(ctx context.Context) {
	statePath, err := agent.ResolveStatePath("")
	if err != nil {
		s.addLog("error", fmt.Sprintf("State path error: %v", err))
		s.mu.Lock()
		s.isRunning = false
		s.lastError = err.Error()
		s.mu.Unlock()
		return
	}

	storedState, err := agent.LoadEncryptedState(statePath)
	if err != nil {
		s.addLog("warning", fmt.Sprintf("State load note: %v", err))
	}

	serverURL := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.ServerURL })
	if serverURL == "" {
		serverURL = "http://localhost:3000"
	}
	deviceID := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.DeviceID })
	authToken := agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.AgentAuthToken })

	if authToken == "" {
		s.addLog("error", "No agent auth token found. Please enroll using the Join Token form.")
		s.mu.Lock()
		s.isRunning = false
		s.lastError = "Not enrolled"
		s.mu.Unlock()
		return
	}

	hostname, _ := os.Hostname()
	localIP := agent.DetectLocalIPv4()
	publicIP := agent.DetectPublicIP()
	apiClient := &http.Client{Timeout: 15 * time.Second}

	// Connect handshake
	err = agent.Connect(apiClient, serverURL, authToken, agent.ConnectRequest{
		DeviceID:     deviceID,
		Name:         agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.Name }),
		Description:  agent.StoredStateValue(storedState, func(st agent.AgentState) string { return st.Description }),
		Hostname:     hostname,
		LocalIP:      localIP,
		PublicIP:     publicIP,
		Platform:     runtime.GOOS,
		Architecture: runtime.GOARCH,
		Version:      "0.1.0",
		Metadata: map[string]interface{}{
			"gui":  true,
			"lang": "go-wails",
		},
	})

	if err != nil {
		s.addLog("error", fmt.Sprintf("Connection failed: %v", err))
		s.mu.Lock()
		s.isRunning = false
		s.lastError = err.Error()
		s.mu.Unlock()
		return
	}

	s.mu.Lock()
	s.isConnected = true
	s.mu.Unlock()
	s.addLog("success", fmt.Sprintf("Connected to control plane at %s (deviceID=%s)", serverURL, deviceID))

	// Heartbeat ticker
	go func() {
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				err := agent.Connect(apiClient, serverURL, authToken, agent.ConnectRequest{
					DeviceID:     deviceID,
					Hostname:     hostname,
					LocalIP:      localIP,
					PublicIP:     publicIP,
					Platform:     runtime.GOOS,
					Architecture: runtime.GOARCH,
					Version:      "0.1.0",
				})
				if err != nil {
					s.addLog("warning", fmt.Sprintf("Heartbeat ping warning: %v", err))
				} else {
					s.mu.Lock()
					s.lastHeartbeat = time.Now()
					s.mu.Unlock()
					s.addLog("info", "Heartbeat pulse sent")
				}
			}
		}
	}()

	// Metrics ticker
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				sysM, err := metrics.Collect(ctx)
				if err == nil && sysM != nil {
					if err := agent.PostMetrics(ctx, apiClient, serverURL, authToken, deviceID, sysM); err != nil {
						s.addLog("warning", fmt.Sprintf("Metrics post error: %v", err))
					} else {
						s.mu.Lock()
						s.lastMetricsSent = time.Now()
						s.mu.Unlock()
						s.addLog("info", fmt.Sprintf("Metrics sent: CPU=%.1f%%, RAM=%.1f%%", sysM.CPU.UsagePercent, sysM.Memory.UsagePercent))
					}
				}
			}
		}
	}()

	// SSE loop (blocks until disconnect or ctx cancel)
	sseClient := &http.Client{}
	agent.RunSSELoop(ctx, sseClient, serverURL, deviceID, authToken)

	s.mu.Lock()
	if s.ctx == ctx {
		s.isConnected = false
		s.isRunning = false
	}
	s.mu.Unlock()
	s.addLog("warning", "Agent SSE loop terminated")
}
