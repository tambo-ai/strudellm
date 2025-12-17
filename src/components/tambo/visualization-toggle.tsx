"use client";

import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import * as React from "react";
import { z } from "zod/v3";

export const visualizationVisibilityToggleSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Optional title shown above the visualization visibility toggle"),
});

export type VisualizationVisibilityToggleProps = z.infer<
  typeof visualizationVisibilityToggleSchema
>;

export function VisualizationVisibilityToggle({
  title = "Visualization visibility",
}: VisualizationVisibilityToggleProps) {
  const { visualizationsEnabled, setVisualizationsEnabled } = useStrudel();

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
            setVisualizationsEnabled(true);
          }}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-all",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            visualizationsEnabled
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground",
          )}
        >
          Show
        </button>

        <button
          type="button"
          onClick={() => {
            setVisualizationsEnabled(false);
          }}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-all",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            !visualizationsEnabled
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground",
          )}
        >
          Hide
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        This toggle only shows/hides visualization widgets in the editor. Add or
        remove visualizations in your Strudel code (e.g. <code>._pianoroll()</code>,
        <code>._waveform()</code>, <code>._spectrum()</code>) or ask the AI to do it
        for you.
      </div>
    </div>
  );
}

// Deprecated aliases kept for compatibility with any existing Tambo dashboards.
export const visualizationToggleSchema = visualizationVisibilityToggleSchema;
export type VisualizationToggleProps = VisualizationVisibilityToggleProps;

export function VisualizationToggle(props: VisualizationToggleProps) {
  return <VisualizationVisibilityToggle {...props} />;
}
