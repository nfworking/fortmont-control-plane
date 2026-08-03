package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	mrand "math/rand"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

type registerRequest struct {
	JoinToken    string                 `json:"joinToken"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description,omitempty"`
	DeviceID     string                 `json:"deviceId"`
	Hostname     string                 `json:"hostname"`
	Platform     string                 `json:"platform"`
	Architecture string                 `json:"architecture"`
	Version      string                 `json:"version"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type heartbeatRequest struct {
	DeviceID string                 `json:"deviceId"`
	Version  string                 `json:"version"`
	Hostname string                 `json:"hostname"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type apiError struct {
	Error string `json:"error"`
}

type registerResponse struct {
	AgentAuthToken string `json:"agentAuthToken"`
}

type encryptedStateFile struct {
	Salt       string `json:"salt"`
	Nonce      string `json:"nonce"`
	Ciphertext string `json:"ciphertext"`
}

type agentState struct {
	ServerURL      string `json:"serverUrl"`
	DeviceID       string `json:"deviceId"`
	AgentAuthToken string `json:"agentAuthToken"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Version        string `json:"version"`
}

type connectRequest struct {
	DeviceID     string                 `json:"deviceId"`
	Name         string                 `json:"name,omitempty"`
	Description  string                 `json:"description,omitempty"`
	Hostname     string                 `json:"hostname"`
	Platform     string                 `json:"platform"`
	Architecture string                 `json:"architecture"`
	Version      string                 `json:"version"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

const defaultServerURL = "http://localhost:3000"
const defaultAgentVersion = "0.1.0"

func main() {
	serverURL := flag.String("server-url", "", "Base URL for Fortmont control plane")
	token := flag.String("token", "", "Join token generated from dashboard")
	name := flag.String("name", "", "Agent name override")
	description := flag.String("description", "", "Agent description override")
	deviceID := flag.String("device-id", "", "Unique device ID (auto-generated if empty)")
	version := flag.String("version", "", "Agent version override")
	stateFile := flag.String("state-file", "", "Override encrypted state file path")
	resetState := flag.Bool("reset-state", false, "Delete saved state and force new enrollment")
	flag.Parse()

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-host"
	}

	statePath, err := resolveStatePath(*stateFile)
	if err != nil {
		log.Fatalf("state path error: %v", err)
	}

	if *resetState {
		_ = os.Remove(statePath)
	}

	storedState, err := loadEncryptedState(statePath)
	if err != nil {
		log.Printf("state load warning: %v", err)
	}

	base := pick(strings.TrimSpace(*serverURL), storedStateValue(storedState, func(s agentState) string { return s.ServerURL }), defaultServerURL)
	resolvedName := pick(strings.TrimSpace(*name), storedStateValue(storedState, func(s agentState) string { return s.Name }), "sample-agent")
	resolvedDescription := pick(strings.TrimSpace(*description), storedStateValue(storedState, func(s agentState) string { return s.Description }), "Go sample agent")
	resolvedVersion := pick(strings.TrimSpace(*version), storedStateValue(storedState, func(s agentState) string { return s.Version }), defaultAgentVersion)
	resolvedDeviceID := pick(strings.TrimSpace(*deviceID), storedStateValue(storedState, func(s agentState) string { return s.DeviceID }), "")

	if strings.TrimSpace(resolvedDeviceID) == "" {
		resolvedDeviceID = fmt.Sprintf("sample-%d-%04d", time.Now().Unix(), mrand.Intn(10000))
	}

	joinToken := strings.TrimSpace(*token)
	storedAuthToken := storedStateValue(storedState, func(s agentState) string { return s.AgentAuthToken })
	agentAuthToken := strings.TrimSpace(storedAuthToken)

	base = strings.TrimRight(base, "/")
	apiClient := &http.Client{Timeout: 15 * time.Second}
	// SSE must remain open indefinitely; do not apply a global request timeout.
	sseClient := &http.Client{}

	if joinToken != "" {
		newAuthToken, registerErr := register(apiClient, base, registerRequest{
			JoinToken:    joinToken,
			Name:         resolvedName,
			Description:  resolvedDescription,
			DeviceID:     resolvedDeviceID,
			Hostname:     hostname,
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

		if err := connect(apiClient, base, agentAuthToken, connectRequest{
			DeviceID:     resolvedDeviceID,
			Name:         resolvedName,
			Description:  resolvedDescription,
			Hostname:     hostname,
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

	if err := saveEncryptedState(statePath, agentState{
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

	go runHeartbeatLoop(ctx, apiClient, base, agentAuthToken, heartbeatRequest{
		DeviceID: resolvedDeviceID,
		Version:  resolvedVersion,
		Hostname: hostname,
		Metadata: map[string]interface{}{"sample": true},
	})

	runSSELoop(ctx, sseClient, base, resolvedDeviceID, agentAuthToken)

	if err := unregister(apiClient, base, resolvedDeviceID, agentAuthToken); err != nil {
		log.Printf("unregister warning: %v", err)
	}

	log.Println("agent stopped")
}

func register(client *http.Client, base string, payload registerRequest) (string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	url := base + "/api/v2/agents/register"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", readAPIError(resp)
	}

	var parsed registerResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", err
	}

	if strings.TrimSpace(parsed.AgentAuthToken) == "" {
		return "", fmt.Errorf("server did not return agentAuthToken")
	}

	return parsed.AgentAuthToken, nil
}

func connect(client *http.Client, base, agentToken string, payload connectRequest) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := base + "/api/v2/agents/connect"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	setAgentTokenHeader(req, agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return readAPIError(resp)
	}

	return nil
}

func runHeartbeatLoop(ctx context.Context, client *http.Client, base, agentToken string, payload heartbeatRequest) {
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

func postHeartbeat(client *http.Client, base, agentToken string, payload heartbeatRequest) error {
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
	setAgentTokenHeader(req, agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return readAPIError(resp)
	}

	return nil
}

func runSSELoop(ctx context.Context, client *http.Client, base, deviceID, agentToken string) {
	for {
		if ctx.Err() != nil {
			return
		}

		err := holdSSEConnection(ctx, client, base, deviceID, agentToken)
		if err != nil && ctx.Err() == nil {
			log.Printf("sse disconnected: %v", err)
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}

func holdSSEConnection(ctx context.Context, client *http.Client, base, deviceID, agentToken string) error {
	url := fmt.Sprintf("%s/api/v2/agents/heartbeat?deviceId=%s", base, deviceID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	setAgentTokenHeader(req, agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return readAPIError(resp)
	}

	log.Println("heartbeat SSE connected")

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event:") || strings.HasPrefix(line, "data:") {
			log.Printf("sse %s", line)
		}
		if ctx.Err() != nil {
			return nil
		}
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return io.EOF
}

func unregister(client *http.Client, base, deviceID, agentToken string) error {
	payload := map[string]interface{}{
		"deviceId":   deviceID,
		"hardDelete": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := base + "/api/v2/agents/unregister"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	setAgentTokenHeader(req, agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return readAPIError(resp)
	}

	return nil
}

func setAgentTokenHeader(req *http.Request, agentToken string) {
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", agentToken))
	req.Header.Set("X-Agent-Token", agentToken)
}

func resolveStatePath(overridePath string) (string, error) {
	if strings.TrimSpace(overridePath) != "" {
		return overridePath, nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, "fortmont-agent", "state.enc"), nil
}

func loadEncryptedState(path string) (*agentState, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var container encryptedStateFile
	if err := json.Unmarshal(raw, &container); err != nil {
		return nil, err
	}

	salt, err := base64.StdEncoding.DecodeString(container.Salt)
	if err != nil {
		return nil, err
	}

	nonce, err := base64.StdEncoding.DecodeString(container.Nonce)
	if err != nil {
		return nil, err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(container.Ciphertext)
	if err != nil {
		return nil, err
	}

	plaintext, err := decryptStateBlob(salt, nonce, ciphertext)
	if err != nil {
		return nil, err
	}

	var state agentState
	if err := json.Unmarshal(plaintext, &state); err != nil {
		return nil, err
	}

	if strings.TrimSpace(state.AgentAuthToken) == "" || strings.TrimSpace(state.DeviceID) == "" {
		return nil, nil
	}

	return &state, nil
}

func saveEncryptedState(path string, state agentState) error {
	plaintext, err := json.Marshal(state)
	if err != nil {
		return err
	}

	salt := make([]byte, 16)
	if _, err := crand.Read(salt); err != nil {
		return err
	}

	nonce, ciphertext, err := encryptStateBlob(salt, plaintext)
	if err != nil {
		return err
	}

	container := encryptedStateFile{
		Salt:       base64.StdEncoding.EncodeToString(salt),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}

	raw, err := json.Marshal(container)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	return os.WriteFile(path, raw, 0o600)
}

func encryptStateBlob(salt, plaintext []byte) ([]byte, []byte, error) {
	key, err := deriveStateKey(salt)
	if err != nil {
		return nil, nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := crand.Read(nonce); err != nil {
		return nil, nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, ciphertext, nil
}

func decryptStateBlob(salt, nonce, ciphertext []byte) ([]byte, error) {
	key, err := deriveStateKey(salt)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return gcm.Open(nil, nonce, ciphertext, nil)
}

func deriveStateKey(salt []byte) ([]byte, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-host"
	}

	home, _ := os.UserHomeDir()
	machineSecret := fmt.Sprintf("fortmont-agent|%s|%s|%s|%s", runtime.GOOS, runtime.GOARCH, hostname, home)

	h := sha256.New()
	h.Write([]byte(machineSecret))
	h.Write([]byte("|"))
	h.Write(salt)
	return h.Sum(nil), nil
}

func pick(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}

	return ""
}

func storedStateValue(state *agentState, selector func(agentState) string) string {
	if state == nil {
		return ""
	}

	return selector(*state)
}

func readAPIError(resp *http.Response) error {
	raw, _ := io.ReadAll(resp.Body)
	var parsed apiError
	if err := json.Unmarshal(raw, &parsed); err == nil && parsed.Error != "" {
		return fmt.Errorf("%s (%d)", parsed.Error, resp.StatusCode)
	}
	return fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(raw))
}
