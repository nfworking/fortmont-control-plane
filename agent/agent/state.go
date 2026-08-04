package agent

import (
	"crypto/aes"
	"crypto/cipher"
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type EncryptedStateFile struct {
	Salt       string `json:"salt"`
	Nonce      string `json:"nonce"`
	Ciphertext string `json:"ciphertext"`
}

type AgentState struct {
	ServerURL      string `json:"serverUrl"`
	DeviceID       string `json:"deviceId"`
	AgentAuthToken string `json:"agentAuthToken"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Version        string `json:"version"`
	OrganizationID string `json:"organizationId,omitempty"`
}

func ResolveStatePath(overridePath string) (string, error) {
	if strings.TrimSpace(overridePath) != "" {
		return overridePath, nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, "fortmont-agent", "state.enc"), nil
}

func LoadEncryptedState(path string) (*AgentState, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var container EncryptedStateFile
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

	var state AgentState
	if err := json.Unmarshal(plaintext, &state); err != nil {
		return nil, err
	}

	if strings.TrimSpace(state.AgentAuthToken) == "" || strings.TrimSpace(state.DeviceID) == "" {
		return nil, nil
	}

	return &state, nil
}

func SaveEncryptedState(path string, state AgentState) error {
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

	container := EncryptedStateFile{
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

func Pick(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func StoredStateValue(state *AgentState, selector func(AgentState) string) string {
	if state == nil {
		return ""
	}
	return selector(*state)
}
