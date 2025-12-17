"use client";

import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import * as React from "react";
import { z } from "zod/v3";

export const visualizationVisibilityToggleSchema = z.object({
  enabled: z
    .boolean()
    .optional()
    .describe(
      "When provided, sets whether Strudel visualization widgets are shown (true) or hidden (false). Can be changed to toggle visibility.",
    ),
});

export type VisualizationVisibilityToggleProps = z.infer<
  typeof visualizationVisibilityToggleSchema
>;

export function VisualizationVisibilityToggle({
  enabled,
}: VisualizationVisibilityToggleProps) {
  const { visualizationsEnabled, setVisualizationsEnabled } = useStrudel();

  React.useEffect(() => {
    if (enabled === undefined) return;
    setVisualizationsEnabled(enabled);
  }, [enabled, setVisualizationsEnabled]);

  return (
    <div
      className="w-full rounded-lg border border-border bg-card p-4 space-y-3"
      data-slot="visualization-toggle"
    >
      <div className="text-sm font-medium text-foreground">
        Visualization visibility
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={visualizationsEnabled}
          onClick={() => {
            setVisualizationsEnabled(true);
          }}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-all disabled:opacity-50 disabled:cursor-not-allowed",
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
          disabled={!visualizationsEnabled}
          onClick={() => {
            setVisualizationsEnabled(false);
          }}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm border transition-all disabled:opacity-50 disabled:cursor-not-allowed",
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
