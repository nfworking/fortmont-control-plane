package agent

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

func RunSSELoop(ctx context.Context, client *http.Client, base, deviceID, agentToken string) {
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
	SetAgentTokenHeader(req, agentToken)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return ReadAPIError(resp)
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