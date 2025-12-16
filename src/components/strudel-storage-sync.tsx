"use client";

import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { StrudelService } from "@/strudel/lib/service";
import { useEffect, useRef } from "react";

/**
 * Component that syncs the storage adapter between Jazz and StrudelService.
 * Must be rendered inside both JazzAndAuthProvider and StrudelProvider.
 *
 * Also watches for remote changes to the current REPL and updates the editor.
 */
export function StrudelStorageSync() {
  const storage = useStrudelStorage();
  const lastCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const service = StrudelService.instance();
    service.setStorageAdapter(storage);

    // Check if the current REPL's code has changed (from remote sync)
    const currentReplId = service.getCurrentReplId();
    if (currentReplId && storage.isAuthenticated) {
      const repl = storage.getRepl(currentReplId);
      if (repl) {
        const currentEditorCode = service.getCode();
        // Only update if:
        // 1. The code is different from what's in the editor
        // 2. The code is different from what we last synced (to avoid loops)
        if (
          repl.code !== currentEditorCode &&
          repl.code !== lastCodeRef.current
        ) {
          lastCodeRef.current = repl.code;
          service.setCode(repl.code);
        }
      }
    }
  }, [storage]);

  return null;
}
