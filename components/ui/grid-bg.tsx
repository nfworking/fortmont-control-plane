import React from "react";
import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  gridSize?: number; // Distance between grid lines in pixels
  gridColor?: string; // Border color of grid lines
  glowColor?: string; // Color of the ambient blur light
  showGlow?: boolean; // Toggle center radial glow
}

export function GridBackground({
  children,
  className,
  gridSize = 64, // 4rem equivalent by default
  gridColor = "#18181b", // zinc-900 equivalent
  glowColor = "rgba(39, 39, 42, 0.25)", // soft zinc-800 ambient light
  showGlow = true,
}: GridBackgroundProps) {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-black text-white flex flex-col items-center justify-center",
        className
      )}
    >
      {/* 1. Subtle SVG Grid Mesh with Radial Mask Fade */}
      <div
        className="pointer-events-none absolute inset-0 opacity-80 [mask-image:radial-gradient(ellipse_65%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${gridColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      />

      {/* 2. Optional Soft Ambient Center Light Glow */}
      {showGlow && (
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full blur-[120px]"
          style={{ backgroundColor: glowColor }}
        />
      )}

      {/* 3. Foreground Content */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}