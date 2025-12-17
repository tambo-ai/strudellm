"use client";

import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, Github, X } from "lucide-react";

interface InfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InfoModal({ open, onOpenChange }: InfoModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
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
            About StrudelLM
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Information and links about StrudelLM
          </Dialog.Description>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>

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
          <Dialog.Close asChild>
            <button className="w-full mt-6 px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm">
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
