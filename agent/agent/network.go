package agent

import (
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

func DetectLocalIPv4() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	fallback := ""

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch value := addr.(type) {
			case *net.IPNet:
				ip = value.IP
			case *net.IPAddr:
				ip = value.IP
			default:
				continue
			}

			ipv4 := ip.To4()
			if ipv4 == nil || ipv4.IsLoopback() {
				continue
			}

			candidate := ipv4.String()
			if fallback == "" {
				fallback = candidate
			}

			if ipv4.IsPrivate() {
				return candidate
			}
		}
	}

	return fallback
}

func DetectPublicIP() string {
	endpoints := []string{
		"https://api.ipify.org",
		"https://checkip.amazonaws.com",
		"https://ifconfig.me/ip",
	}

	client := &http.Client{Timeout: 5 * time.Second}

	for _, endpoint := range endpoints {
		resp, err := client.Get(endpoint)
		if err != nil {
			continue
		}

		raw, readErr := io.ReadAll(io.LimitReader(resp.Body, 128))
		resp.Body.Close()
		if readErr != nil || resp.StatusCode >= 300 {
			continue
		}

		ip := strings.TrimSpace(string(raw))
		if parsed := net.ParseIP(ip); parsed != nil {
			return parsed.String()
		}
	}

	return ""
}
