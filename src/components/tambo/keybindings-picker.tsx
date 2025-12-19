"use client";

import { cn } from "@/lib/utils";
import {
  getKeybindings,
  setEditorKeybindings,
  DEFAULT_KEYBINDINGS,
} from "@/lib/editor-preferences";
import { StrudelService } from "@/strudel/lib/service";
import { useTamboStreamStatus } from "@tambo-ai/react";
import * as React from "react";
import { z } from "zod/v3";

const keybindingOptions = [
  { value: "codemirror", label: "Default" },
  { value: "vim", label: "Vim" },
  { value: "emacs", label: "Emacs" },
  { value: "vscode", label: "VSCode" },
] as const;

export const keybindingsPickerSchema = z.object({
  keybindings: z
    .enum(["codemirror", "vim", "emacs", "vscode"])
    .optional()
    .describe("Editor keybindings style - codemirror is default"),
});

export type KeybindingsPickerProps = z.infer<typeof keybindingsPickerSchema>;

export const KeybindingsPicker = React.forwardRef<
  HTMLDivElement,
  KeybindingsPickerProps
>(({ keybindings }, ref) => {
  const { streamStatus, propStatus } =
    useTamboStreamStatus<KeybindingsPickerProps>();

  // Track if we've done initial setup
  const initializedRef = React.useRef(false);

  // Local state for selected keybindings and pending change
  const [selectedKeybindings, setSelectedKeybindings] = React.useState<string>(
    DEFAULT_KEYBINDINGS,
  );
  const [pendingKeybindings, setPendingKeybindings] = React.useState<
    string | null
  >(null);
  const [isApplying, setIsApplying] = React.useState(false);

  // Initialize from localStorage and treat any AI prop as a pending selection.
  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const savedKeybindings = getKeybindings();
    const initialKeybindings = savedKeybindings || DEFAULT_KEYBINDINGS;
    setSelectedKeybindings(initialKeybindings);

    if (keybindings && keybindings !== initialKeybindings) {
      setPendingKeybindings(keybindings);
    }
  }, [keybindings]);

  // Handle AI prop changes after initial mount
  React.useEffect(() => {
    if (!initializedRef.current) return;
    if (keybindings && keybindings !== selectedKeybindings) {
      setPendingKeybindings(keybindings);
    }
  }, [keybindings, selectedKeybindings]);

  const handleKeybindingsSelect = (value: string) => {
    setPendingKeybindings(value);
  };

  const handleApplyAndRestart = async () => {
    if (!pendingKeybindings) return;

    setIsApplying(true);
    try {
      setEditorKeybindings(pendingKeybindings);
      await StrudelService.instance().applyKeybindingsAndRestart();
      setSelectedKeybindings(pendingKeybindings);
      setPendingKeybindings(null);
    } finally {
      setIsApplying(false);
    }
  };

  const isStreaming = streamStatus.isStreaming;
  const currentSelection = pendingKeybindings || selectedKeybindings;
  const hasChanges =
    pendingKeybindings !== null && pendingKeybindings !== selectedKeybindings;

  if (streamStatus.isPending) {
    return (
      <div
        ref={ref}
        className="w-full rounded-lg border border-border bg-card p-4"
      >
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading keybindings picker...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full rounded-lg border border-border bg-card p-4 space-y-4"
    >
      {/* Header */}
      <h3
        className={cn(
          "text-sm font-medium",
          propStatus.keybindings?.isStreaming && "animate-pulse",
        )}
      >
        Keybindings
      </h3>

      {/* Keybindings options */}
      <div className="flex flex-wrap gap-2">
        {keybindingOptions.map((option) => {
          const isSelected = currentSelection === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleKeybindingsSelect(option.value)}
              disabled={isStreaming || isApplying}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-all",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
        {propStatus.keybindings?.isStreaming && (
          <span className="px-3 py-1.5 text-sm text-muted-foreground animate-pulse">
            ...
          </span>
        )}
      </div>

      {/* Apply button */}
      <div className="flex justify-end">
        <button
          onClick={handleApplyAndRestart}
          disabled={!hasChanges || isStreaming || isApplying}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-all",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            hasChanges
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isApplying ? "Applying..." : "Apply & Restart Runtime"}
        </button>
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground">
        Changing keybindings requires restarting the editor runtime.
      </p>

      {streamStatus.isError && streamStatus.streamError && (
        <div className="pt-3 text-xs text-destructive">
          Error: {streamStatus.streamError.message}
        </div>
      )}
    </div>
  );
});

KeybindingsPicker.displayName = "KeybindingsPicker";
