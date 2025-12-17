"use client";

import { cn } from "@/lib/utils";
import { StrudelService } from "@/strudel/lib/service";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Loader2, X } from "lucide-react";
import * as React from "react";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const [cycles, setCycles] = React.useState<number>(8);
  const [format, setFormat] = React.useState<"wav">("wav");
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isExportingRef = React.useRef(false);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setExporting = (value: boolean) => {
    isExportingRef.current = value;
    if (isMountedRef.current) {
      setIsExporting(value);
    }
  };

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isExportingRef.current) return;
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const download = React.useCallback(async () => {
    if (isExportingRef.current) return;

    setExporting(true);
    if (isMountedRef.current) {
      setError(null);
    }

    try {
      let blob: Blob;
      switch (format) {
        case "wav": {
          blob = await StrudelService.instance().exportWav(cycles);
          break;
        }
        default: {
          throw new Error(`Export format "${format}" is not supported yet`);
        }
      }

      const filename = `strudel-${cycles}cycles.${format}`;
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        // Allow the click/navigation to process before releasing the blob URL.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isMountedRef.current) {
        setError(message);
      }
    } finally {
      setExporting(false);
    }
  }, [cycles, format]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <Dialog.Content
          onEscapeKeyDown={(e) => {
            if (isExportingRef.current) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            if (isExportingRef.current) {
              e.preventDefault();
            }
          }}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%]",
            "rounded-xl border border-border bg-background p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          )}
        >
          <Dialog.Title className="text-xl font-semibold mb-4">
            Export
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Export current Strudel song
          </Dialog.Description>

          <Dialog.Close asChild>
            <button
              disabled={isExporting}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Bars (cycles)
              </label>
              <input
                type="number"
                min={1}
                max={64}
                step={1}
                value={cycles}
                disabled={isExporting}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (!Number.isFinite(value)) return;
                  setCycles(Math.max(1, Math.min(64, Math.floor(value))));
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Export length in Strudel cycles (1–64).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Format</label>
              <select
                value={format}
                disabled={isExporting}
                onChange={(e) => setFormat(e.target.value as "wav")}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground disabled:opacity-60"
              >
                <option value="wav">WAV</option>
              </select>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            {isExporting && (
              <span className="mr-auto text-xs text-muted-foreground">
                Rendering in progress. Closing is disabled.
              </span>
            )}
            <Dialog.Close asChild>
              <button
                disabled={isExporting}
                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm disabled:opacity-30"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={download}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm disabled:opacity-60"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rendering...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
