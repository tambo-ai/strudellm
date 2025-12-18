import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { isSampleErrorMessage } from "@/strudel/lib/errors";
import {
  useTamboContextAttachment,
  useTamboThread,
  useTamboThreadInput,
} from "@tambo-ai/react";
import { Play, Square, RotateCcw, BotIcon, Info, AlertCircle } from "lucide-react";
import React from "react";
import { InfoModal } from "@/components/info-modal";

const NOTIFICATION_AUTO_DISMISS_MS = 5000;

/**
 * Categorize the error type for better context
 */
function categorizeError(error: string | Error): string {
  const errorMsg = typeof error === "string" ? error : error.message;
  const lowerMsg = errorMsg.toLowerCase();

  // Check for sample/sound related errors (e.g., "sound supersquare not found! Is it loaded?")
  if (isSampleErrorMessage(errorMsg)) {
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

type ContextAttachmentApi = ReturnType<typeof useTamboContextAttachment>;

type StrudelErrorAttachmentMetadata = {
  attachmentKey: string;
  errorType: string;
  errorMessage: string | undefined;
  missingSample: string | null;
  code: string;
};

function replaceStrudelErrorContextAttachment(
  api: Pick<
    ContextAttachmentApi,
    "attachments" | "addContextAttachment" | "removeContextAttachment"
  >,
  metadata: StrudelErrorAttachmentMetadata,
): void {
  const existingErrors = api.attachments.filter(
    (a) => a.metadata?.kind === "strudel_error",
  );
  const alreadyAttached = existingErrors.some(
    (a) => a.metadata?.attachmentKey === metadata.attachmentKey,
  );

  if (alreadyAttached) return;

  for (const a of existingErrors) {
    api.removeContextAttachment(a.id);
  }

  api.addContextAttachment({
    name: "Strudel Error",
    icon: <AlertCircle className="w-3 h-3" />,
    metadata: {
      kind: "strudel_error",
      ...metadata,
    },
  });
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
    missingSample,
    code,
    hasUnevaluatedChanges,
    revertNotification,
    clearRevertNotification,
  } = useStrudel();
  const { startNewThread } = useTamboThread();
  const { setValue, value } = useTamboThreadInput();
  const { attachments, addContextAttachment, removeContextAttachment } =
    useTamboContextAttachment();

  // Auto-dismiss revert notification after a delay
  React.useEffect(() => {
    if (revertNotification) {
      const timer = setTimeout(() => {
        clearRevertNotification();
      }, NOTIFICATION_AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [revertNotification, clearRevertNotification]);

  const handleErrorClick = React.useCallback(() => {
    const errorMessage = typeof error === "string" ? error : error?.message;
    const errorType = missingSample
      ? "invalid_sample"
      : error
        ? categorizeError(error)
        : "unknown";

    const attachmentKey = JSON.stringify({ missingSample, errorMessage, code });
    replaceStrudelErrorContextAttachment(
      { attachments, addContextAttachment, removeContextAttachment },
      {
        attachmentKey,
        errorType,
        errorMessage,
        missingSample,
        code,
      },
    );

    // If input is empty, add default message
    if (!value?.trim()) {
      if (missingSample) {
        setValue(`Find a new sample to replace "${missingSample}".`);
      } else {
        setValue("Help me fix this issue, and explain what I did wrong.");
      }
    }

  }, [
    addContextAttachment,
    attachments,
    code,
    error,
    missingSample,
    removeContextAttachment,
    setValue,
    value,
  ]);

  return (
    <>
      {/* Revert notification - shown when AI code fails and we revert */}
      {revertNotification && (
        <div className="px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-t border-amber-500/30 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{revertNotification.message}</span>
          <button
            onClick={clearRevertNotification}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}
      {error && (
        <button
          onClick={handleErrorClick}
          className="w-full px-3 py-2 text-destructive border-t border-destructive/30 hover:bg-destructive/5 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <BotIcon className="w-4 h-4" />
            <span>
              {missingSample
                ? `Sound "${missingSample}" is missing. Click to find a new sample.`
                : "Click to get help fixing this error"}
            </span>
          </div>
          <div className="text-xs opacity-80 truncate">
            {typeof error === "string" ? error : error.message}
          </div>
        </button>
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
