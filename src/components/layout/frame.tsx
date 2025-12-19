"use client";

import { useEffect } from "react";
import { Header } from "./header";
import { loadEditorPreferences } from "@/lib/editor-preferences";

export function Frame({ children }: { children: React.ReactNode }) {
  // Load saved theme and editor preferences on mount
  useEffect(() => {
    loadEditorPreferences();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  );
}
