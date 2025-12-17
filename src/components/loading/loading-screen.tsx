"use client";

import { useLoadingContext } from "@/components/loading/context";
import { cn } from "@/lib/utils";
import * as React from "react";

export interface LoadingScreenProps {
  /** Current loading status message */
  status?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Whether loading is complete */
  isComplete?: boolean;
  /** Callback when user clicks to start (after audio context requirements) */
  onStart?: () => void;
}

export function LoadingScreen({ onStart }: LoadingScreenProps) {
  const { isReady, message, progress } = useLoadingContext();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 max-w-md px-8">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-1">StrudelLM</h1>
          <p className="text-sm text-muted-foreground">
            Live coding with AI assistance
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full bg-primary transition-all duration-300",
                !isReady && "animate-pulse",
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {message}
          </p>
        </div>

        {/* Start Button (only shown if onStart is provided) */}
        {isReady && onStart && (
          <button
            onClick={onStart}
            className={cn(
              "px-6 py-2 bg-primary text-primary-foreground rounded",
              "hover:bg-primary/90 transition-colors",
              "text-sm font-medium",
            )}
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}
