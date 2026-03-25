"use client";

import { cn } from "@/lib/utils";
import { useTambo, type RunStatus } from "@tambo-ai/react";
import { Loader2Icon } from "lucide-react";
import * as React from "react";

/**
 * Represents the generation stage of a message
 * @property {string} className - Optional className for custom styling
 * @property {boolean} showLabel - Whether to show the label
 */

export interface GenerationStageProps
  extends React.HTMLAttributes<HTMLDivElement> {
  showLabel?: boolean;
}

export function MessageGenerationStage({
  className,
  showLabel = true,
  ...props
}: GenerationStageProps) {
  const { streamingState, isIdle } = useTambo();
  const status = streamingState?.status;

  // Only render if we have an active status
  if (!status || status === "idle") {
    return null;
  }

  // Map status values to user-friendly labels
  const statusLabels: Record<RunStatus, string> = {
    idle: "Idle",
    waiting: "Preparing response",
    streaming: "Generating response",
  };

  const label =
    statusLabels[status] || `${status.charAt(0).toUpperCase() + status.slice(1)}`;

  if (isIdle) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md bg-transparent text-muted-foreground",
        className,
      )}
      {...props}
    >
      <Loader2Icon className="h-3 w-3 animate-spin" />
      {showLabel && <span>{label}</span>}
    </div>
  );
}
