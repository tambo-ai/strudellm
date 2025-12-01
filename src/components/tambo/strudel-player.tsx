"use client";

import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import * as React from "react";
import { z } from "zod";

// Module-level references to Strudel functions
let strudelEvaluate: ((code: string) => Promise<unknown>) | null = null;
let strudelHush: (() => void) | null = null;

/**
 * Zod schema for StrudelPlayer props
 */
export const strudelPlayerSchema = z.object({
  code: z
    .string()
    .describe(
      "Strudel pattern code to play. Use Strudel/Tidal syntax like: s('bd sd') or note('c3 e3 g3')"
    ),
  title: z
    .string()
    .optional()
    .describe("Optional title to display above the player"),
  autoPlay: z
    .boolean()
    .optional()
    .describe("Whether to automatically start playing when the component mounts"),
  variant: z
    .enum(["default", "solid", "bordered"])
    .optional()
    .describe("Visual style variant"),
  size: z
    .enum(["default", "sm", "lg"])
    .optional()
    .describe("Size of the player"),
});

export type StrudelPlayerProps = z.infer<typeof strudelPlayerSchema>;

/**
 * Variants for the StrudelPlayer component
 */
export const strudelPlayerVariants = cva(
  "w-full rounded-lg overflow-hidden transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-background border border-border",
        solid: [
          "shadow-lg shadow-zinc-900/10 dark:shadow-zinc-900/20",
          "bg-muted",
        ].join(" "),
        bordered: ["border-2", "border-border"].join(" "),
      },
      size: {
        default: "",
        sm: "text-sm",
        lg: "text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type PlaybackState = "stopped" | "playing" | "loading" | "error";

/**
 * StrudelPlayer component for live-coding music with Strudel
 */
export const StrudelPlayer = React.forwardRef<HTMLDivElement, StrudelPlayerProps>(
  ({ code: initialCode, title, autoPlay = false, variant, size }, ref) => {
    const [code, setCode] = React.useState(initialCode || "");
    const [playbackState, setPlaybackState] = React.useState<PlaybackState>("stopped");
    const [error, setError] = React.useState<string | null>(null);
    const [isInitialized, setIsInitialized] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Update code when prop changes
    React.useEffect(() => {
      if (initialCode && initialCode !== code) {
        setCode(initialCode);
      }
    }, [initialCode]);

    // Initialize Strudel
    React.useEffect(() => {
      let mounted = true;

      const init = async () => {
        // Check if already initialized
        if (strudelEvaluate && strudelHush) {
          setIsInitialized(true);
          return;
        }

        try {
          const { initStrudel, samples, evaluate, hush } = await import("@strudel/web");
          await initStrudel({
            // Load default drum samples from the dirt-samples repository
            prebake: () => samples("github:tidalcycles/dirt-samples"),
          });
          // Store references to the module functions
          strudelEvaluate = evaluate;
          strudelHush = hush;
          if (mounted) {
            setIsInitialized(true);
          }
        } catch (err) {
          console.error("Failed to initialize Strudel:", err);
          if (mounted) {
            setError("Failed to initialize Strudel audio engine");
          }
        }
      };

      init();

      return () => {
        mounted = false;
      };
    }, []);

    // Auto-play effect
    React.useEffect(() => {
      if (autoPlay && isInitialized && code && playbackState === "stopped") {
        handlePlay();
      }
    }, [autoPlay, isInitialized, code]);

    const handlePlay = async () => {
      if (!isInitialized || !strudelEvaluate) {
        setError("Strudel not initialized yet");
        return;
      }

      setPlaybackState("loading");
      setError(null);

      try {
        // Use the evaluate function from @strudel/web
        await strudelEvaluate(code);
        setPlaybackState("playing");
      } catch (err) {
        console.error("Strudel evaluation error:", err);
        setError(err instanceof Error ? err.message : "Failed to play pattern");
        setPlaybackState("error");
      }
    };

    const handleStop = () => {
      if (strudelHush) {
        strudelHush();
      }
      setPlaybackState("stopped");
    };

    const handleToggle = () => {
      if (playbackState === "playing") {
        handleStop();
      } else {
        handlePlay();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + Enter to evaluate
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handlePlay();
      }
      // Ctrl/Cmd + . to stop
      if ((e.ctrlKey || e.metaKey) && e.key === ".") {
        e.preventDefault();
        handleStop();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(strudelPlayerVariants({ variant, size }))}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {title && (
                <h3 className="text-lg font-medium text-foreground">{title}</h3>
              )}
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                  playbackState === "playing" &&
                    "bg-primary/20 text-primary",
                  playbackState === "stopped" &&
                    "bg-muted text-muted-foreground",
                  playbackState === "loading" &&
                    "bg-yellow-500/20 text-yellow-400",
                  playbackState === "error" &&
                    "bg-destructive/20 text-destructive"
                )}
              >
                {playbackState === "playing" && "Playing"}
                {playbackState === "stopped" && "Stopped"}
                {playbackState === "loading" && "Loading..."}
                {playbackState === "error" && "Error"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                disabled={!isInitialized || playbackState === "loading"}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  playbackState === "playing"
                    ? "bg-destructive hover:bg-destructive/90 text-white"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                )}
              >
                {playbackState === "playing" ? (
                  <>
                    <StopIcon className="w-4 h-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Play
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "w-full min-h-[120px] p-3 rounded-md font-mono text-sm",
                "bg-input text-foreground",
                "border border-border focus:border-primary focus:ring-1 focus:ring-ring",
                "resize-y outline-none",
                "placeholder:text-muted-foreground"
              )}
              placeholder="// Enter Strudel code here...
// Example: s('bd sd cp hh')
// Press Ctrl+Enter to play, Ctrl+. to stop"
              spellCheck={false}
            />
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              <kbd className="px-1 py-0.5 bg-muted rounded">⌘/Ctrl</kbd>+
              <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to play
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive font-mono">
                {error}
              </p>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-3 text-xs text-muted-foreground">
            <p>
              <strong>Tips:</strong> Use <code className="px-1 bg-muted rounded">s(&apos;bd sd&apos;)</code> for drums,{" "}
              <code className="px-1 bg-muted rounded">note(&apos;c3 e3 g3&apos;)</code> for melodies.{" "}
              <a
                href="https://strudel.cc/learn/getting-started/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn more
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }
);

StrudelPlayer.displayName = "StrudelPlayer";

// Simple icon components
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
        clipRule="evenodd"
      />
    </svg>
  );
}
