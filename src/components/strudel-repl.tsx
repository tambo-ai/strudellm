"use client";

import { cn } from "@/lib/utils";
import {
  registerCodeUpdateCallback,
  hush,
  evaluate,
} from "@/lib/strudel-service";
import { Play, Square } from "lucide-react";
import * as React from "react";

const DEFAULT_CODE = `// Welcome to Strudel AI!
// Write patterns here or ask the AI for help

// Example: A simple drum pattern
s("bd sd bd sd")
`;

// StrudelMirror instance type (editor only)
interface StrudelMirrorInstance {
  setCode: (code: string) => void;
  code: string;
  dispose?: () => void;
}

export interface StrudelReplProps {
  /** Whether Strudel is initialized and ready */
  isReady?: boolean;
  /** Callback when user changes code in the editor */
  onCodeChange?: (code: string) => void;
}

export const StrudelRepl = React.forwardRef<HTMLDivElement, StrudelReplProps>(
  function StrudelRepl({ isReady = false, onCodeChange }, ref) {
    const [code, setCodeInternal] = React.useState(DEFAULT_CODE);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const editorContainerRef = React.useRef<HTMLDivElement>(null);
    const editorRef = React.useRef<StrudelMirrorInstance | null>(null);

    // Wrapper to handle code changes from user input
    const setCode = React.useCallback(
      (newCode: string) => {
        setCodeInternal(newCode);
        onCodeChange?.(newCode);
      },
      [onCodeChange]
    );

    // Initialize CodeMirror editor (editor UI only, audio handled by strudel-service)
    React.useEffect(() => {
      if (!isReady || !editorContainerRef.current || editorRef.current) return;

      const container = editorContainerRef.current;

      // Dynamically import StrudelMirror for the editor UI
      import("@strudel/codemirror").then(({ StrudelMirror }) => {
        // Check again after async import in case component unmounted
        if (!container || editorRef.current) return;

        const editor = new StrudelMirror({
          root: container,
          initialCode: DEFAULT_CODE,
          // Audio is handled by strudel-service, so minimal config here
          prebake: async () => {
            // Already prebaked in strudel-service
          },
          onChange: (c: string) => {
            setCodeInternal(c);
          },
        });

        editorRef.current = editor;
      });

      return () => {
        if (editorRef.current) {
          editorRef.current.dispose?.();
          editorRef.current = null;
        }
        // Clear container contents to prevent duplicate editors
        if (container) {
          container.innerHTML = "";
        }
      };
    }, [isReady]);

    // Register callback to receive code updates from the tool
    React.useEffect(() => {
      const unregister = registerCodeUpdateCallback((newCode: string) => {
        setCodeInternal(newCode);
        setError(null);
        setIsPlaying(true);
        // Update the editor code
        if (editorRef.current) {
          editorRef.current.setCode(newCode);
        }
      });

      return () => {
        unregister();
      };
    }, []);

    const handlePlay = React.useCallback(async () => {
      if (!isReady) {
        setError("Audio engine not ready");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get current code from editor
        const currentCode = editorRef.current?.code ?? code;
        const result = await evaluate(currentCode);

        if (result !== undefined) {
          setIsPlaying(true);
          setError(null);
        } else {
          setError("Pattern evaluation failed - check console for details");
          setIsPlaying(false);
        }
      } catch (err) {
        console.error("Strudel error:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to play pattern";
        setError(errorMsg);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    }, [code, isReady]);

    const handleStop = React.useCallback(() => {
      hush();
      setIsPlaying(false);
    }, []);

    // Fallback to textarea if CodeMirror isn't loaded yet
    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          handlePlay();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === ".") {
          e.preventDefault();
          handleStop();
        }
      },
      [handlePlay, handleStop]
    );

    return (
      <div ref={ref} className="flex flex-col h-full">
        {/* Code Editor */}
        <div className="flex-1 relative">
          {/* CodeMirror container */}
          <div
            ref={editorContainerRef}
            className={cn(
              "w-full h-full",
              "[&_.cm-editor]:h-full [&_.cm-editor]:outline-none",
              "[&_.cm-scroller]:font-mono! [&_.cm-scroller]:text-sm",
              "[&_.cm-content]:py-4 [&_.cm-content]:px-4",
              "[&_.cm-gutters]:bg-transparent [&_.cm-gutters]:border-0",
              "[&_.cm-lineNumbers]:text-muted-foreground/50",
              "[&_.cm-activeLine]:bg-muted/30",
              "[&_.cm-activeLineGutter]:bg-transparent",
              "[&_.cm-selectionBackground]:bg-primary/20!",
              "[&_.cm-cursor]:border-l-2 [&_.cm-cursor]:border-primary"
            )}
          />
          {/* Fallback textarea shown while CodeMirror loads or if not ready */}
          {!isReady && (
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "absolute inset-0 w-full h-full p-4 resize-none outline-none",
                "bg-background text-foreground",
                "placeholder:text-muted-foreground"
              )}
              placeholder="// Enter Strudel code here..."
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="px-3 py-2 text-destructive border-t border-destructive/30">
            {error}
          </div>
        )}

        {/* Minimal status bar */}
        <div className="px-3 py-1.5 border-t border-border text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={isPlaying ? handleStop : handlePlay}
              disabled={!isReady || isLoading}
              className={cn(
                "flex items-center gap-1.5 disabled:opacity-30",
                isPlaying
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isLoading ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Square className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {isPlaying ? "stop" : "play"}
            </button>
            <span className="text-muted-foreground/50">|</span>
            <span className={isPlaying ? "text-primary" : ""}>
              {isPlaying ? "playing" : "stopped"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground/60">
              {isReady ? "^enter play · ^. stop" : "loading..."}
            </span>
            <a
              href="https://strudel.cc/learn/getting-started/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              docs
            </a>
          </div>
        </div>
      </div>
    );
  }
);

StrudelRepl.displayName = "StrudelRepl";
