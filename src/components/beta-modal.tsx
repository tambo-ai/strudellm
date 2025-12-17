"use client";

import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";

interface BetaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BetaModal({ open, onOpenChange }: BetaModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%]",
            "rounded-lg border border-border bg-background p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          )}
        >
          <Dialog.Title className="text-xl font-semibold mb-3">
            Welcome to StrudelLM
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Information about StrudelLM beta
          </Dialog.Description>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>

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

            <Dialog.Close asChild>
              <button className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                Got it
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
