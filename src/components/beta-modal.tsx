"use client";

import { config } from "@/lib/config";
import { ExternalLink, X } from "lucide-react";

interface BetaModalProps {
  onClose: () => void;
}

export function BetaModal({ onClose }: BetaModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-3">Welcome to StrudelLM</h2>

        <p className="text-muted-foreground mb-4">
          This is a beta product and we&apos;re still working on it. You may
          encounter bugs or incomplete features.
        </p>

        <p className="text-muted-foreground mb-6">
          If you run into any issues or have feedback, please let us know!
        </p>

        <div className="flex flex-col gap-3">
          <a
            href={config.githubNewIssue}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Report an Issue
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
