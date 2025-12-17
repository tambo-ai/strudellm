"use client";

import { config } from "@/lib/config";
import { ExternalLink, X, Github } from "lucide-react";

interface InfoModalProps {
  onClose: () => void;
}

export function InfoModal({ onClose }: InfoModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-4">About StrudelLM</h2>

        {/* Open Source Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Github className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Open Source</h3>
          </div>
          <p className="text-muted-foreground text-sm mb-3">
            StrudelLM is open source! Check out the code, run it yourself, or
            contribute.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={config.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
            <a
              href={config.githubNewIssue}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 border border-border hover:bg-muted/50 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Report an Issue
            </a>
          </div>
        </div>

        {/* Strudel Docs Section */}
        <div className="mb-6 pb-6 border-b border-border">
          <h3 className="font-medium mb-2">Learn Strudel</h3>
          <p className="text-muted-foreground text-sm mb-3">
            New to Strudel? Check out the official documentation to learn the
            basics of live coding music.
          </p>
          <a
            href="https://strudel.cc/learn/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-border hover:bg-muted/50 rounded-lg transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Strudel Documentation
          </a>
        </div>

        {/* Tambo Section */}
        <div>
          <div className="flex items-center justify-center mb-3">
            <img
              src="/Tambo-Vertical-Lockup-DM.svg"
              alt="Tambo"
              className="h-20"
            />
          </div>
          <p className="text-muted-foreground text-sm text-center mb-3">
            Curious how to build AI-powered apps like this?
          </p>
          <a
            href="https://docs.tambo.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Learn More About Tambo
          </a>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
