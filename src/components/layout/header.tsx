"use client";

import { AuthButton } from "@/components/auth/auth-button";

export function Header() {
  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Strudel LM</h1>
      </div>
      <AuthButton />
    </header>
  );
}
