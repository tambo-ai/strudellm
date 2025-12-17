"use client";

import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import React from "react";

interface ThreadSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ThreadSwitchDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: ThreadSwitchDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
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
          <Dialog.Title className="text-lg font-semibold text-foreground">
            Switch Thread?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            A response is still generating. Cancel it and switch threads?
          </Dialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md",
                "border border-border bg-background text-foreground",
                "hover:bg-muted transition-colors",
              )}
            >
              Stay
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
              )}
            >
              Cancel & Switch
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
