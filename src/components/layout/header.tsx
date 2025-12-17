"use client";

import { useState } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { InfoModal } from "@/components/info-modal";

export function Header() {
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <>
      <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Strudel LM</h1>
          <button
            onClick={() => setShowInfoModal(true)}
            className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
          >
            Beta
          </button>
        </div>
        <AuthButton />
      </header>

      <InfoModal open={showInfoModal} onOpenChange={setShowInfoModal} />
    </>
  );
}
