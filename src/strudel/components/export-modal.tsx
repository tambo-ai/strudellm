"use client";

import { StrudelService } from "@/strudel/lib/service";
import { Download, Loader2, X } from "lucide-react";
import * as React from "react";

interface ExportModalProps {
  onClose: () => void;
}

export function ExportModal({ onClose }: ExportModalProps) {
  const [cycles, setCycles] = React.useState<number>(8);
  const [format, setFormat] = React.useState<"wav">("wav");
  const [isExporting, setIsExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClose = React.useCallback(() => {
    if (isExporting) return;
    onClose();
  }, [isExporting, onClose]);

  const download = React.useCallback(async () => {
    if (isExporting) return;

    setIsExporting(true);
    setError(null);
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
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, [cycles, format, isExporting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <button
          onClick={handleClose}
          disabled={isExporting}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-4">Export</h2>

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
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm disabled:opacity-30"
          >
            Cancel
          </button>
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
      </div>
    </div>
  );
}
