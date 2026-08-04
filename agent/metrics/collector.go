package metrics


import (
	"context"
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

type CPUStats struct {
	UsagePercent float64 `json:"usagePercent"`
	Cores        int     `json:"cores"`
}

type MemoryStats struct {
	TotalBytes   uint64  `json:"totalBytes"`
	UsedBytes    uint64  `json:"usedBytes"`
	FreeBytes    uint64  `json:"freeBytes"`
	UsagePercent float64 `json:"usagePercent"`
}

type StorageStats struct {
	Path         string  `json:"path"`
	TotalBytes   uint64  `json:"totalBytes"`
	UsedBytes    uint64  `json:"usedBytes"`
	FreeBytes    uint64  `json:"freeBytes"`
	UsagePercent float64 `json:"usagePercent"`
}

type SystemMetrics struct {
	Timestamp int64        `json:"timestamp"`
	CPU       CPUStats     `json:"cpu"`
	Memory    MemoryStats  `json:"memory"`
	Storage   StorageStats `json:"storage"`
}

// Collect returns snapshot metrics for CPU, RAM, and Storage.
func Collect(ctx context.Context) (*SystemMetrics, error) {
	// CPU usage over a short 500ms sampling window
	cpuPercents, err := cpu.PercentWithContext(ctx, 500*time.Millisecond, false)
	var cpuUsage float64
	if err == nil && len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}

	// Virtual Memory Usage
	vMem, err := mem.VirtualMemoryWithContext(ctx)
	memStats := MemoryStats{}
	if err == nil {
		memStats = MemoryStats{
			TotalBytes:   vMem.Total,
			UsedBytes:    vMem.Used,
			FreeBytes:    vMem.Free,
			UsagePercent: vMem.UsedPercent,
		}
	}

	// Primary Storage Drive Usage (C:\ on Windows, / on Linux)
	targetPath := "/"
	if runtime.GOOS == "windows" {
		targetPath = os.Getenv("SystemDrive")
		if targetPath == "" {
			targetPath = "C:"
		}
		targetPath += "\\"
	}

	dUsage, err := disk.UsageWithContext(ctx, targetPath)
	storageStats := StorageStats{Path: targetPath}
	if err == nil {
		storageStats = StorageStats{
			Path:         targetPath,
			TotalBytes:   dUsage.Total,
			UsedBytes:    dUsage.Used,
			FreeBytes:    dUsage.Free,
			UsagePercent: dUsage.UsedPercent,
		}
	}

	return &SystemMetrics{
		Timestamp: time.Now().Unix(),
		CPU: CPUStats{
			UsagePercent: cpuUsage,
			Cores:        runtime.NumCPU(),
		},
		Memory:  memStats,
		Storage: storageStats,
	}, nil
}