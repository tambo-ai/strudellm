import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { useTamboThread } from "@tambo-ai/react";
import { Play, Square, RotateCcw } from "lucide-react";
import React from "react";

export function StrudelStatusBar() {
  const { isPlaying, isReady, play, stop, reset } = useStrudel();
  const { startNewThread } = useTamboThread();

  const error = null; // Placeholder for error state

  return (
    <>
      {error && (
        <div className="px-3 py-2 text-destructive border-t border-destructive/30">
          {error}
        </div>
      )}
      <div className="px-3 py-1.5 border-t border-border text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={isPlaying ? stop : play}
            disabled={!isReady}
            className={cn(
              "flex items-center gap-1.5 disabled:opacity-30",
              isPlaying
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {!isReady ? (
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (isPlaying ? (
                <Square className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )
            )}
            {isPlaying ? "stop" : "play"}
          </button>
          <span className="text-muted-foreground/50">|</span>
          <span className={isPlaying ? "text-primary" : ""}>
            {isPlaying ? "playing" : "stopped"}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <button
            onClick={() => {
              reset();
              startNewThread();
            }}
            disabled={!isReady}
            className="flex items-center gap-1.5 disabled:opacity-30 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3" />
            reset
          </button>
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
    </>
  )
}