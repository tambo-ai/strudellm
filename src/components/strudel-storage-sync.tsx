"use client";

import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { StrudelService } from "@/strudel/lib/service";
import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "strudel-repl-";
const THREAD_MAP_PREFIX = "strudel-thread-repl-";
const ACTIVE_REPL_KEY = "strudel-active-repl";
const MIGRATION_DONE_KEY = "strudel-migration-done";

/**
 * Migrate localStorage REPLs to Jazz on first sign-in
 */
function migrateLocalStorageToJazz(
  storage: ReturnType<typeof useStrudelStorage>,
): void {
  if (typeof window === "undefined") return;

  // Check if migration was already done
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;

  // Check if Jazz already has REPLs (not a fresh account)
  const existingRepls = storage.getAllRepls();
  if (existingRepls.length > 0) {
    // Jazz already has data, skip migration and mark as done
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    return;
  }

  console.log("[Migration] Starting localStorage to Jazz migration...");

  // Collect all REPLs from localStorage
  const localRepls: Array<{
    id: string;
    code: string;
    name?: string;
    createdAt?: number;
    lastUpdated?: number;
  }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const replId = key.slice(STORAGE_PREFIX.length);
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          localRepls.push({
            id: replId,
            code: parsed.code,
            name: parsed.name,
            createdAt: parsed.createdAt,
            lastUpdated: parsed.lastUpdated,
          });
        }
      } catch (e) {
        console.error("[Migration] Failed to parse REPL:", replId, e);
      }
    }
  }

  if (localRepls.length === 0) {
    console.log("[Migration] No localStorage REPLs to migrate");
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    return;
  }

  console.log(`[Migration] Migrating ${localRepls.length} REPLs to Jazz...`);

  // Migrate each REPL
  for (const repl of localRepls) {
    storage.saveRepl(repl.id, repl.code, repl.name);
    console.log("[Migration] Migrated REPL:", repl.id);
  }

  // Migrate thread mappings
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(THREAD_MAP_PREFIX)) {
      const threadId = key.slice(THREAD_MAP_PREFIX.length);
      const replId = localStorage.getItem(key);
      if (replId) {
        storage.attachThreadToRepl(threadId, replId);
        console.log(
          "[Migration] Migrated thread mapping:",
          threadId,
          "->",
          replId,
        );
      }
    }
  }

  // Migrate active REPL
  const activeReplId = localStorage.getItem(ACTIVE_REPL_KEY);
  if (activeReplId) {
    storage.setActiveReplId(activeReplId);
    console.log("[Migration] Migrated active REPL:", activeReplId);
  }

  localStorage.setItem(MIGRATION_DONE_KEY, "true");
  console.log("[Migration] Migration complete!");
}

/**
 * Component that syncs the storage adapter between Jazz and StrudelService.
 * Must be rendered inside both JazzAndAuthProvider and StrudelProvider.
 *
 * Also watches for remote changes to the current REPL and updates the editor.
 * Handles migration from localStorage to Jazz on first sign-in.
 */
export function StrudelStorageSync() {
  const storage = useStrudelStorage();
  const lastCodeRef = useRef<string | null>(null);
  const migrationAttemptedRef = useRef(false);

  // Migration effect - runs when user becomes authenticated with loaded Jazz data
  useEffect(() => {
    if (
      storage.isAuthenticated &&
      storage.isLoaded &&
      !migrationAttemptedRef.current
    ) {
      migrationAttemptedRef.current = true;
      migrateLocalStorageToJazz(storage);
    }
  }, [storage.isAuthenticated, storage.isLoaded, storage]);

  useEffect(() => {
    const service = StrudelService.instance();
    service.setStorageAdapter(storage);

    // Check if the current REPL's code has changed (from remote sync)
    const currentReplId = service.getCurrentReplId();
    console.log(
      "[StrudelStorageSync] currentReplId:",
      currentReplId,
      "isAuthenticated:",
      storage.isAuthenticated,
    );

    if (currentReplId && storage.isAuthenticated) {
      const repl = storage.getRepl(currentReplId);
      console.log(
        "[StrudelStorageSync] repl from storage:",
        repl?.code?.substring(0, 50),
      );

      if (repl) {
        const currentEditorCode = service.getCode();
        console.log(
          "[StrudelStorageSync] editor code:",
          currentEditorCode?.substring(0, 50),
        );
        console.log(
          "[StrudelStorageSync] lastCodeRef:",
          lastCodeRef.current?.substring(0, 50),
        );

        // Only update if:
        // 1. The code is different from what's in the editor
        // 2. The code is different from what we last synced (to avoid loops)
        if (
          repl.code !== currentEditorCode &&
          repl.code !== lastCodeRef.current
        ) {
          console.log("[StrudelStorageSync] UPDATING EDITOR with remote code");
          lastCodeRef.current = repl.code;
          service.setCode(repl.code);
        }
      }
    }
  }, [storage]);

  return null;
}
