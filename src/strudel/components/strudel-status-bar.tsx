import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { StrudelService } from "@/strudel/lib/service";
import { useTamboThread, useTamboThreadInput } from "@tambo-ai/react";
import { Play, Square, RotateCcw, BotIcon, Info } from "lucide-react";
import React from "react";
import { InfoModal } from "@/components/info-modal";

/**
 * Categorize the error type for better context
 */
function categorizeError(error: string | Error): string {
  const errorMsg = typeof error === "string" ? error : error.message;
  const lowerMsg = errorMsg.toLowerCase();

  if (lowerMsg.includes("sample") || lowerMsg.includes("sound not found")) {
    return "invalid_sample";
  }
  if (lowerMsg.includes("undefined") || lowerMsg.includes("not a pattern")) {
    return "invalid_pattern";
  }
  if (
    lowerMsg.includes("syntax") ||
    lowerMsg.includes("unexpected") ||
    lowerMsg.includes("parse")
  ) {
    return "syntax_error";
  }
  return "runtime_error";
}

export function StrudelStatusBar() {
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const {
    isPlaying,
    isReady,
    play,
    stop,
    reset,
    error,
    code,
    hasUnevaluatedChanges,
  } = useStrudel();
  const { startNewThread, isIdle } = useTamboThread();
  const { setValue, submit } = useTamboThreadInput();

  const handleFixError = React.useCallback(async () => {
    // Don't allow if already processing
    if (!isIdle) return;

    const errorMessage = typeof error === "string" ? error : error?.message;
    const errorType = error ? categorizeError(error) : "unknown";

    // Build a detailed message with full context for the AI
    const contextMessage = `Fix this error in my Strudel code:

**Error Type:** ${errorType}
**Error Message:** ${errorMessage}

**Current Code:**
\`\`\`javascript
${code}
\`\`\`

Please fix the error and update the REPL with corrected code.`;

    const sendFixRequest = async () => {
      setValue(contextMessage);
      await submit({
        streamResponse: true,
      });
    };

    try {
      // Clear the error immediately when user requests a fix
      StrudelService.instance().clearError();
      await sendFixRequest();
    } catch (err) {
      console.error("Failed to send fix error message:", err);
      // Check for thread-related errors more specifically
      // Look for specific thread error patterns to avoid false positives
      const errStr = String(err);
      const isThreadError =
        errStr.includes("thread not found") ||
        errStr.includes("invalid thread") ||
        errStr.includes("Thread does not exist") ||
        (errStr.includes("thread") && errStr.includes("error"));

      if (isThreadError) {
        try {
          await startNewThread();
          await sendFixRequest();
        } catch (newThreadErr) {
          console.error("Failed to create new thread:", newThreadErr);
        }
      }
    }
  }, [error, code, isIdle, setValue, submit, startNewThread]);

  return (
    <>
      {error && (
        <div className="px-3 py-2 text-destructive border-t border-destructive/30">
          <div className="w-full">
            <button className="" onClick={handleFixError}>
              <BotIcon /> Fix Error
            </button>
          </div>
          <div>{typeof error === "string" ? error : error.message}</div>
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
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {!isReady ? (
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Square className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            {isPlaying ? "stop" : "play"}
          </button>
          {isReady && (
            <span className="text-muted-foreground/60 text-xs">
              {isPlaying ? "^." : "^enter"}
            </span>
          )}
          <span className="text-muted-foreground/50">|</span>
          <span className={isPlaying ? "text-primary" : ""}>
            {isPlaying ? "playing" : "stopped"}
          </span>
          {hasUnevaluatedChanges && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <button
                onClick={play}
                className="flex items-center gap-1.5 text-amber-500 hover:text-amber-400 animate-pulse"
              >
                <Play className="w-3 h-3" />
                update
              </button>
              <span className="text-muted-foreground/60 text-xs">^enter</span>
            </>
          )}
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
          {!isReady && (
            <span className="text-muted-foreground/60">loading...</span>
          )}
          <button
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="w-3 h-3" />
            info
          </button>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && <InfoModal onClose={() => setShowInfoModal(false)} />}
    </>
  );
}
