"use client";

import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { StrudelService } from "@/strudel/lib/service";
import { useEffect, useRef, useCallback } from "react";

const STORAGE_PREFIX = "strudel-repl-";
const THREAD_MAP_PREFIX = "strudel-thread-repl-";
const ACTIVE_REPL_KEY = "strudel-active-repl";
const MIGRATION_DONE_KEY = "strudel-migration-done";
const LAST_CODE_KEY = "strudel-last-code";
const DEBOUNCE_MS = 1000;

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
    // Jazz already has data, skip migration, clear localStorage, and mark as done
    console.log("[Migration] Jazz already has REPLs, clearing localStorage");
    clearLocalStorageReplData();
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

  // Filter out REPLs with only default code - no point migrating empty REPLs
  const realRepls = localRepls.filter(
    (repl) => !repl.code.includes("Welcome to StrudelLM"),
  );

  if (realRepls.length === 0) {
    console.log("[Migration] No localStorage REPLs with real code to migrate");
    localStorage.setItem(MIGRATION_DONE_KEY, "true");
    return;
  }

  console.log(`[Migration] Migrating ${realRepls.length} REPLs to Jazz...`);

  // Migrate each REPL
  for (const repl of realRepls) {
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

  // Clear localStorage after successful migration to prevent dual-sync
  clearLocalStorageReplData();

  localStorage.setItem(MIGRATION_DONE_KEY, "true");
  console.log("[Migration] Migration complete!");
}

/**
 * Clear REPL code data from localStorage.
 * Called after migration to Jazz to prevent dual-sync issues.
 * NOTE: We keep ACTIVE_REPL_KEY because it's just a UI preference for which tab is selected.
 */
function clearLocalStorageReplData(): void {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith(STORAGE_PREFIX) || key.startsWith(THREAD_MAP_PREFIX))
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  // Don't clear ACTIVE_REPL_KEY - it's just a UI preference for which tab is selected

  console.log(`[Migration] Cleared ${keysToRemove.length} localStorage keys`);
}

/**
 * Component that syncs the storage adapter between Jazz and StrudelService.
 * Must be rendered inside both JazzAndAuthProvider and StrudelProvider.
 *
 * Handles migration from localStorage to Jazz on first sign-in.
 */
export function StrudelStorageSync() {
  const storage = useStrudelStorage();
  const migrationAttemptedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save of current code to localStorage
  // This ensures code is always preserved for recovery (e.g., after sign-out)
  // Only save for authenticated users - anonymous users already save via storage.saveRepl
  const saveCodeToLocalStorage = useCallback(() => {
    if (!storage.isAuthenticated) return;

    const service = StrudelService.instance();
    const currentCode = service.getCode();
    if (currentCode && !currentCode.includes("Welcome to StrudelLM")) {
      localStorage.setItem(LAST_CODE_KEY, currentCode);
    }
  }, [storage.isAuthenticated]);

  // Subscribe to code changes and save with debounce
  useEffect(() => {
    const service = StrudelService.instance();

    const unsubscribe = service.onStateChange(() => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Set new debounced save
      debounceTimerRef.current = setTimeout(
        saveCodeToLocalStorage,
        DEBOUNCE_MS,
      );
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [saveCodeToLocalStorage]);

  // Reset initial load flag when auth state changes (e.g., sign-out)
  // This allows the anonymous effect to run and restore preserved code
  const prevAuthRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!storage.isAuthResolved) return;

    // Detect auth state change
    if (
      prevAuthRef.current !== null &&
      prevAuthRef.current !== storage.isAuthenticated
    ) {
      initialLoadDoneRef.current = false;
    }
    prevAuthRef.current = storage.isAuthenticated;
  }, [storage.isAuthResolved, storage.isAuthenticated]);

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

  // Set storage adapter - needs to update when storage changes
  useEffect(() => {
    const service = StrudelService.instance();
    service.setStorageAdapter(storage);
  }, [storage]);

  // For anonymous users: create initial REPL if none exists
  // Wait for isAuthResolved to ensure we know the user is truly anonymous
  useEffect(() => {
    if (
      !storage.isAuthResolved ||
      storage.isAuthenticated ||
      initialLoadDoneRef.current
    ) {
      return;
    }

    // Check if we have saved code from a sign-out
    const savedCode = localStorage.getItem(LAST_CODE_KEY);
    if (savedCode) {
      localStorage.removeItem(LAST_CODE_KEY);
    }

    const allRepls = storage.allRepls;
    const service = StrudelService.instance();
    initialLoadDoneRef.current = true;

    if (allRepls.length === 0) {
      // No REPLs - create one with saved code (if any) or default
      const codeToUse =
        savedCode ||
        '// Welcome to StrudelLM!\n// Write patterns here or ask the AI for help\n\n// Example: A simple drum pattern\ns("bd sd bd sd")\n';

      console.log(
        "[StrudelStorageSync] Creating REPL for anonymous user",
        savedCode ? "(with preserved code)" : "(with default code)",
      );

      const replId = storage.createRepl(codeToUse);
      service.setReplId(replId);
    } else {
      // Anonymous user has existing REPLs - load the first one
      if (!service.getCurrentReplId()) {
        service.setReplId(allRepls[0].id);
      }
      // If we had saved code and have an existing REPL, update it
      // (This handles the case where user signed out, then refreshed page)
      if (savedCode) {
        console.log("[StrudelStorageSync] Updating REPL with preserved code");
        const currentReplId = service.getCurrentReplId();
        if (currentReplId) {
          storage.saveRepl(currentReplId, savedCode);
          service.setCode(savedCode);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally using specific deps
  }, [
    storage.isAuthResolved,
    storage.isAuthenticated,
    storage.allRepls,
    storage.createRepl,
  ]);

  // For authenticated users: load REPL data once when Jazz data becomes available
  // This runs once after authentication and Jazz sync, not on every change
  useEffect(() => {
    if (
      !storage.isAuthenticated ||
      !storage.isLoaded ||
      initialLoadDoneRef.current
    ) {
      return;
    }

    const allRepls = storage.allRepls;
    if (allRepls.length === 0) {
      // No REPLs yet - might still be syncing, wait for next update
      return;
    }

    // Mark as done so we don't run again
    initialLoadDoneRef.current = true;

    const service = StrudelService.instance();
    const currentReplId = service.getCurrentReplId();

    // If service already has a REPL loaded with real code, don't override
    if (currentReplId) {
      const currentCode = service.getCode();
      if (currentCode && !currentCode.includes("Welcome to StrudelLM")) {
        console.log(
          "[StrudelStorageSync] Already have real code, skipping initial load",
        );
        return;
      }
    }

    // Load the first REPL with real code, or the active one
    const activeReplId = storage.getActiveReplId();
    const replToLoad = activeReplId || allRepls[0]?.id;

    if (replToLoad) {
      const repl = storage.getRepl(replToLoad);
      if (repl?.code) {
        console.log(
          "[StrudelStorageSync] Initial load from Jazz:",
          replToLoad,
          repl.code.substring(0, 50),
        );
        service.setReplId(replToLoad);
      }
    }

    // Clear preserved code now that we've loaded from Jazz
    localStorage.removeItem(LAST_CODE_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally using specific deps, not full storage object
  }, [
    storage.isAuthenticated,
    storage.isLoaded,
    storage.allRepls,
    storage.getRepl,
    storage.getActiveReplId,
  ]);

  return null;
}
