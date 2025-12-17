"use client";

import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { useTamboComponentState } from "@tambo-ai/react";
import * as React from "react";
import { z } from "zod/v3";

export const visualizationToggleSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Optional title shown above the visualization toggles"),
});

export type VisualizationToggleProps = z.infer<typeof visualizationToggleSchema>;

type VisualizationType = "pianoroll" | "waveform" | "spectrum";

type VisualizationOrOff = VisualizationType | null;

const VISUALIZATION_OPTIONS: Array<{
  id: VisualizationType;
  label: string;
  methodCall: string;
  aliases?: string[];
}> = [
  { id: "pianoroll", label: "Piano roll", methodCall: "._pianoroll()" },
  {
    id: "waveform",
    label: "Waveform",
    methodCall: "._waveform()",
    aliases: ["._scope()"],
  },
  { id: "spectrum", label: "Spectrum", methodCall: "._spectrum()" },
];

function stripTrailingVisualizationFromLine(
  line: string,
): { type: VisualizationOrOff; strippedLine: string } {
  for (const candidate of VISUALIZATION_OPTIONS) {
    const callVariants = [candidate.methodCall, ...(candidate.aliases ?? [])];
    for (const call of callVariants) {
      const escapedCall = call.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${escapedCall}\\s*;?\\s*$`);
      if (re.test(line)) {
        return {
          type: candidate.id,
          strippedLine: line.replace(re, "").trimEnd(),
        };
      }
    }
  }

  return { type: null, strippedLine: line };
}

function getTrailingVisualization(code: string): VisualizationOrOff {
  const lines = code.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    if (!line.trim()) continue;
    return stripTrailingVisualizationFromLine(line).type;
  }
  return null;
}

function setTrailingVisualization(
  code: string,
  next: VisualizationOrOff,
): string {
  const lines = code.split("\n");
  const hadTrailingNewline = code.endsWith("\n");

  // Remove trailing empty lines.
  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
    lines.pop();
  }

  if (lines.length === 0) {
    return code;
  }

  const lastIndex = lines.length - 1;
  const lastLine = lines[lastIndex] ?? "";
  const { strippedLine } = stripTrailingVisualizationFromLine(lastLine);

  if (!strippedLine.trim()) {
    lines.pop();
  } else {
    lines[lastIndex] = strippedLine;
  }

  // Remove any whitespace introduced by stripping.
  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
    lines.pop();
  }

  if (!next) {
    const updated = lines.join("\n");
    return hadTrailingNewline ? `${updated}\n` : updated;
  }

  const nextOption = VISUALIZATION_OPTIONS.find((o) => o.id === next);
  if (!nextOption) {
    return code;
  }

  const newLastIndex = lines.length - 1;
  const newLastLine = lines[newLastIndex] ?? "";

  // If the code ends with a semicolon, a following line starting with "." will break.
  // Prefer stripping the semicolon instead of rewriting the whole expression.
  if (/;\s*$/.test(newLastLine)) {
    lines[newLastIndex] = newLastLine.replace(/;\s*$/, "");
  }

  const indentMatch = newLastLine.match(/^(\s*)\./);
  const indent = indentMatch?.[1] ?? "";
  lines.push(`${indent}${nextOption.methodCall}`);

  const updated = lines.join("\n");
  return hadTrailingNewline ? `${updated}\n` : updated;
}

export function VisualizationToggle({
  title = "Visualization",
}: VisualizationToggleProps) {
  const { code, setCode, isPlaying } = useStrudel();

  const detectedVisualization = React.useMemo(
    () => getTrailingVisualization(code),
    [code],
  );

  const [selectedVisualization, setSelectedVisualization] =
    useTamboComponentState<VisualizationOrOff>(
      "selectedVisualization",
      detectedVisualization,
    );

  // Keep component state in sync with code updates (e.g., AI changes).
  React.useEffect(() => {
    if (selectedVisualization !== detectedVisualization) {
      setSelectedVisualization(detectedVisualization);
    }
  }, [detectedVisualization, selectedVisualization, setSelectedVisualization]);

  const activeVisualization = selectedVisualization ?? detectedVisualization;

  return (
    <div
      className="w-full rounded-lg border border-border bg-card p-4 space-y-3"
      data-slot="visualization-toggle"
    >
      <div className="text-sm font-medium text-foreground">{title}</div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const updated = setTrailingVisualization(code, null);
            setCode(updated, isPlaying);
            setSelectedVisualization(null);
          }}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-all",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            activeVisualization === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground",
          )}
        >
          Off
        </button>

        {VISUALIZATION_OPTIONS.map((option) => {
          const isActive = activeVisualization === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                const next = isActive ? null : option.id;
                const updated = setTrailingVisualization(code, next);
                setCode(updated, isPlaying);
                setSelectedVisualization(next);
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-all",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
