package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"fortmont-agent/metrics"
)

type RegisterRequest struct {
	JoinToken    string                 `json:"joinToken"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description,omitempty"`
	DeviceID     string                 `json:"deviceId"`
	Hostname     string                 `json:"hostname"`
	LocalIP      string                 `json:"localIp,omitempty"`
	PublicIP     string                 `json:"publicIp,omitempty"`
	Platform     string                 `json:"platform"`
	Architecture string                 `json:"architecture"`
	Version      string                 `json:"version"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type RegisterResponse struct {
	AgentAuthToken string `json:"agentAuthToken"`
}

type ConnectRequest struct {
	DeviceID     string                 `json:"deviceId"`
	Name         string                 `json:"name,omitempty"`
	Description  string                 `json:"description,omitempty"`
	Hostname     string                 `json:"hostname"`
	LocalIP      string                 `json:"localIp,omitempty"`
	PublicIP     string                 `json:"publicIp,omitempty"`
	Platform     string                 `json:"platform"`
	Architecture string                 `json:"architecture"`
	Version      string                 `json:"version"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type MetricsPayload struct {
	DeviceID string                 `json:"deviceId"`
	Metrics  *metrics.SystemMetrics `json:"metrics"`
}

type APIError struct {
	Error string `json:"error"`
}

func Register(client *http.Client, base string, payload RegisterRequest) (string, error) {
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
		return "", ReadAPIError(resp)
	}

	var parsed RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", err
	}

	if strings.TrimSpace(parsed.AgentAuthToken) == "" {
		return "", fmt.Errorf("server did not return agentAuthToken")
	}

	return parsed.AgentAuthToken, nil
}

func Connect(client *http.Client, base, agentToken string, payload ConnectRequest) error {
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

// PostMetrics sends system metrics snapshot to the control plane.
func PostMetrics(ctx context.Context, client *http.Client, base, agentToken string, deviceID string, sysMetrics *metrics.SystemMetrics) error {
	payload := MetricsPayload{
		DeviceID: deviceID,
		Metrics:  sysMetrics,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := base + "/api/v2/agents/metrics"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
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

func Unregister(client *http.Client, base, deviceID, agentToken string) error {
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

func SetAgentTokenHeader(req *http.Request, agentToken string) {
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", agentToken))
	req.Header.Set("X-Agent-Token", agentToken)
}

func ReadAPIError(resp *http.Response) error {
	raw, _ := io.ReadAll(resp.Body)
	var parsed APIError
	if err := json.Unmarshal(raw, &parsed); err == nil && parsed.Error != "" {
		return fmt.Errorf("%s (%d)", parsed.Error, resp.StatusCode)
	}
	return fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(raw))
}
