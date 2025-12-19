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
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg max-w-md w-full mx-4 p-6 text-zinc-50">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-4">About StrudelLM</h2>

        {/* Open Source Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Github className="w-5 h-5 text-emerald-400" />
            <h3 className="font-medium">Open Source</h3>
          </div>
          <p className="text-zinc-400 text-sm mb-3">
            StrudelLM is open source! Check out the code, run it yourself, or
            contribute.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={config.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
            <a
              href={config.githubNewIssue}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800/50 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Report an Issue
            </a>
          </div>
        </div>

        {/* Strudel Docs Section */}
        <div className="mb-6 pb-6 border-b border-zinc-700">
          <h3 className="font-medium mb-2">Learn Strudel</h3>
          <p className="text-zinc-400 text-sm mb-3">
            New to Strudel? Check out the official documentation to learn the
            basics of live coding music.
          </p>
          <a
            href="https://strudel.cc/learn/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800/50 rounded-lg transition-colors text-sm"
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
          <p className="text-zinc-400 text-sm text-center mb-3">
            Curious how to build AI-powered apps like this?
          </p>
          <a
            href="https://docs.tambo.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 rounded-lg transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Learn More About Tambo
          </a>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
