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

// Maximum distance (in lines) to search above/below the cursor when deciding
// where to detect/apply a visualization.
const DEFAULT_NEAREST_NON_EMPTY_LINE_DISTANCE = 32;

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
  let currentLine = line;
  let lastType: VisualizationOrOff = null;

  strip: while (true) {
    for (const candidate of VISUALIZATION_OPTIONS) {
      const callVariants = [candidate.methodCall, ...(candidate.aliases ?? [])];
      for (const call of callVariants) {
        const escapedCall = call.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`${escapedCall}\\s*;?\\s*$`);
        if (re.test(currentLine)) {
          lastType = candidate.id;
          currentLine = currentLine.replace(re, "").trimEnd();
          continue strip;
        }
      }
    }

    break;
  }

  return { type: lastType, strippedLine: currentLine };
}

function getDetectedVisualization(
  code: string,
  cursorLineIndex: number | null,
): VisualizationOrOff {
  const lines = code.split("\n");

  if (cursorLineIndex !== null) {
    const preferredIndex = Math.min(
      Math.max(cursorLineIndex, 0),
      Math.max(lines.length - 1, 0),
    );

    const idx = findNearestNonEmptyLineIndex(lines, preferredIndex);
    if (idx !== null) {
      const { type } = stripTrailingVisualizationFromLine(lines[idx] ?? "");
      if (type) return type;
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    const { type } = stripTrailingVisualizationFromLine(line);
    if (type) return type;
  }
  return null;
}

function stripVisualizationsFromCode(code: string): string {
  const updatedLines = code.split("\n").map((line) => {
    return stripTrailingVisualizationFromLine(line).strippedLine;
  });

  return updatedLines.join("\n");
}

function findNearestNonEmptyLineIndex(
  lines: string[],
  preferredIndex: number,
  maxDistance: number = DEFAULT_NEAREST_NON_EMPTY_LINE_DISTANCE,
): number | null {
  if (preferredIndex < 0 || preferredIndex >= lines.length) return null;
  if (lines[preferredIndex]?.trim()) return preferredIndex;

  const limit = maxDistance;

  for (let distance = 1; distance <= limit; distance++) {
    const above = preferredIndex - distance;
    if (above >= 0 && lines[above]?.trim()) return above;

    const below = preferredIndex + distance;
    if (below < lines.length && lines[below]?.trim()) return below;
  }

  return null;
}

function setVisualization(
  code: string,
  next: VisualizationOrOff,
  cursorLineIndex: number | null,
): string {
  if (!next) {
    return stripVisualizationsFromCode(code);
  }

  const nextOption = VISUALIZATION_OPTIONS.find((o) => o.id === next);
  if (!nextOption) {
    return code;
  }

  const strippedCode = stripVisualizationsFromCode(code);
  const lines = strippedCode.split("\n");

  const preferredLineIndex = Math.min(
    Math.max(cursorLineIndex ?? lines.length - 1, 0),
    Math.max(lines.length - 1, 0),
  );
  const targetIndex = findNearestNonEmptyLineIndex(lines, preferredLineIndex);

  if (targetIndex === null) {
    return code;
  }

  const originalLine = lines[targetIndex] ?? "";
  const withoutTrailingWhitespace = originalLine.trimEnd();
  if (!withoutTrailingWhitespace.trim()) {
    return code;
  }

  if (withoutTrailingWhitespace.endsWith(";")) {
    const withoutSemicolon = withoutTrailingWhitespace.slice(0, -1);
    lines[targetIndex] = `${withoutSemicolon}${nextOption.methodCall};`;
  } else {
    lines[targetIndex] = `${withoutTrailingWhitespace}${nextOption.methodCall}`;
  }

  const updated = lines.join("\n");
  return updated;
}

export function VisualizationToggle({
  title = "Visualization",
}: VisualizationToggleProps) {
  const { code, setCode, isPlaying, getCursorLineIndex } = useStrudel();

  const cursorLineIndex = getCursorLineIndex();

  const detectedVisualization = React.useMemo(
    () => getDetectedVisualization(code, cursorLineIndex),
    [code, cursorLineIndex],
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
            const updated = setVisualization(code, null, getCursorLineIndex());
            if (updated !== code) {
              setCode(updated, isPlaying);
            }
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
                const updated = setVisualization(
                  code,
                  next,
                  getCursorLineIndex(),
                );
                if (updated !== code) {
                  setCode(updated, isPlaying);
                  setSelectedVisualization(next);
                }
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
