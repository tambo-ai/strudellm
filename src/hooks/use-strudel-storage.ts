"use client";

import { useAccount, useIsAuthenticated } from "jazz-tools/react";
import { StrudelAccount } from "@/lib/jazz-schema";
import { useCallback, useMemo } from "react";

const STORAGE_PREFIX = "strudel-repl-";
const THREAD_MAP_PREFIX = "strudel-thread-repl-";
const ACTIVE_REPL_KEY = "strudel-active-repl";

/**
 * Storage adapter interface for REPL code persistence.
 * Supports the data model where:
 * - One REPL can have many Threads
 * - Each Thread belongs to exactly one REPL
 */
export interface StrudelStorageAdapter {
  /** Get the REPL for a given thread */
  getReplForThread: (
    threadId: string,
  ) => { replId: string; code: string } | null;
  /** Get a REPL by its ID */
  getRepl: (replId: string) => { code: string; name?: string } | null;
  /** Save/update a REPL */
  saveRepl: (replId: string, code: string, name?: string) => void;
  /** Associate a thread with a REPL */
  attachThreadToRepl: (threadId: string, replId: string) => void;
  /** Get the REPL ID for a thread (if any) */
  getThreadReplId: (threadId: string) => string | null;
  /** Get or create the active REPL ID */
  getActiveReplId: () => string | null;
  /** Set the active REPL */
  setActiveReplId: (replId: string) => void;
  /** Create a new REPL and return its ID */
  createRepl: (code: string, name?: string) => string;
  /** Whether user is authenticated (using Jazz) */
  isAuthenticated: boolean;
}

/**
 * Generate a unique REPL ID
 */
function generateReplId(): string {
  return `repl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook that provides a storage adapter for REPL code.
 * Uses Jazz for authenticated users, localStorage for anonymous users.
 */
export function useStrudelStorage(): StrudelStorageAdapter {
  const account = useAccount(StrudelAccount, {
    resolve: {
      root: {
        repls: { $each: true },
        threadToRepl: true,
      },
    },
  });
  const isAuthenticated = useIsAuthenticated();

  const getRepl = useCallback(
    (replId: string): { code: string; name?: string } | null => {
      // If authenticated and Jazz root is available, use Jazz
      if (account?.$isLoaded && account?.root?.repls) {
        const repls = account.root.repls as unknown as Record<
          string,
          { code: string; name?: string } | undefined
        >;
        const repl = repls[replId];
        if (repl) {
          return { code: repl.code, name: repl.name };
        }
        return null;
      }

      // Otherwise use localStorage
      if (typeof window === "undefined") return null;
      try {
        const data = localStorage.getItem(STORAGE_PREFIX + replId);
        if (data) {
          const parsed = JSON.parse(data);
          return { code: parsed.code, name: parsed.name };
        }
        return null;
      } catch {
        return null;
      }
    },
    [account],
  );

  const getThreadReplId = useCallback(
    (threadId: string): string | null => {
      // If authenticated and Jazz root is available, use Jazz
      if (account?.$isLoaded && account?.root?.threadToRepl) {
        const threadMap = account.root.threadToRepl as unknown as Record<
          string,
          string | undefined
        >;
        return threadMap[threadId] ?? null;
      }

      // Otherwise use localStorage
      if (typeof window === "undefined") return null;
      try {
        return localStorage.getItem(THREAD_MAP_PREFIX + threadId);
      } catch {
        return null;
      }
    },
    [account],
  );

  const getReplForThread = useCallback(
    (threadId: string): { replId: string; code: string } | null => {
      const replId = getThreadReplId(threadId);
      if (!replId) return null;

      const repl = getRepl(replId);
      if (!repl) return null;

      return { replId, code: repl.code };
    },
    [getThreadReplId, getRepl],
  );

  const saveRepl = useCallback(
    (replId: string, code: string, name?: string): void => {
      // If authenticated and Jazz root is available, save to Jazz
      if (account?.$isLoaded && account?.root) {
        try {
          // Initialize repls record if it doesn't exist
          if (!account.root.repls) {
            // @ts-expect-error - CoMap initialization
            account.root.repls = {};
          }

          // Cast to access by index
          const repls = account.root.repls as unknown as Record<
            string,
            { code: string; name?: string; createdAt?: number } | undefined
          >;
          const existing = repls[replId];
          const now = Date.now();

          // Save the REPL - use Object.assign to update the record
          (account.root.repls as unknown as Record<string, unknown>)[replId] = {
            id: replId,
            code,
            name: name ?? existing?.name,
            createdAt: existing?.createdAt ?? now,
            lastUpdated: now,
          };
        } catch (error) {
          console.error("Failed to save to Jazz:", error);
          // Fall back to localStorage
          saveToLocalStorage(replId, code, name);
        }
        return;
      }

      // Otherwise use localStorage
      saveToLocalStorage(replId, code, name);
    },
    [account],
  );

  const attachThreadToRepl = useCallback(
    (threadId: string, replId: string): void => {
      // Skip for placeholder threads
      if (threadId.includes("placeholder")) return;

      // If authenticated and Jazz root is available, save to Jazz
      if (account?.$isLoaded && account?.root) {
        try {
          if (!account.root.threadToRepl) {
            // @ts-expect-error - CoMap initialization
            account.root.threadToRepl = {};
          }
          (account.root.threadToRepl as unknown as Record<string, string>)[
            threadId
          ] = replId;
        } catch (error) {
          console.error("Failed to save thread mapping to Jazz:", error);
          saveThreadMappingToLocalStorage(threadId, replId);
        }
        return;
      }

      // Otherwise use localStorage
      saveThreadMappingToLocalStorage(threadId, replId);
    },
    [account],
  );

  const getActiveReplId = useCallback((): string | null => {
    // If authenticated and Jazz root is available, use Jazz
    if (account?.$isLoaded && account?.root?.activeReplId) {
      return account.root.activeReplId;
    }

    // Otherwise use localStorage
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ACTIVE_REPL_KEY);
    } catch {
      return null;
    }
  }, [account]);

  const setActiveReplId = useCallback(
    (replId: string): void => {
      // If authenticated and Jazz root is available, save to Jazz
      if (account?.$isLoaded && account?.root) {
        try {
          // Cast to allow assignment
          (account.root as { activeReplId: string }).activeReplId = replId;
        } catch (error) {
          console.error("Failed to save active REPL to Jazz:", error);
          saveActiveReplToLocalStorage(replId);
        }
        return;
      }

      // Otherwise use localStorage
      saveActiveReplToLocalStorage(replId);
    },
    [account],
  );

  const createRepl = useCallback(
    (code: string, name?: string): string => {
      const replId = generateReplId();
      saveRepl(replId, code, name);
      return replId;
    },
    [saveRepl],
  );

  return useMemo(
    () => ({
      getReplForThread,
      getRepl,
      saveRepl,
      attachThreadToRepl,
      getThreadReplId,
      getActiveReplId,
      setActiveReplId,
      createRepl,
      isAuthenticated,
    }),
    [
      getReplForThread,
      getRepl,
      saveRepl,
      attachThreadToRepl,
      getThreadReplId,
      getActiveReplId,
      setActiveReplId,
      createRepl,
      isAuthenticated,
    ],
  );
}

function saveToLocalStorage(replId: string, code: string, name?: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = localStorage.getItem(STORAGE_PREFIX + replId);
    const parsed = existing ? JSON.parse(existing) : {};
    const now = Date.now();

    localStorage.setItem(
      STORAGE_PREFIX + replId,
      JSON.stringify({
        id: replId,
        code,
        name: name ?? parsed.name,
        createdAt: parsed.createdAt ?? now,
        lastUpdated: now,
      }),
    );
  } catch {
    // Ignore storage errors
  }
}

function saveThreadMappingToLocalStorage(
  threadId: string,
  replId: string,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THREAD_MAP_PREFIX + threadId, replId);
  } catch {
    // Ignore storage errors
  }
}

function saveActiveReplToLocalStorage(replId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_REPL_KEY, replId);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Creates a standalone storage adapter that can be used outside React.
 * This is a fallback for when the hook can't be used (e.g., in the service singleton).
 */
export function createLocalStorageAdapter(): StrudelStorageAdapter {
  return {
    getReplForThread: (threadId: string) => {
      const replId =
        typeof window !== "undefined"
          ? localStorage.getItem(THREAD_MAP_PREFIX + threadId)
          : null;
      if (!replId) return null;

      try {
        const data = localStorage.getItem(STORAGE_PREFIX + replId);
        if (data) {
          const parsed = JSON.parse(data);
          return { replId, code: parsed.code };
        }
      } catch {}
      return null;
    },
    getRepl: (replId: string) => {
      if (typeof window === "undefined") return null;
      try {
        const data = localStorage.getItem(STORAGE_PREFIX + replId);
        if (data) {
          const parsed = JSON.parse(data);
          return { code: parsed.code, name: parsed.name };
        }
      } catch {}
      return null;
    },
    saveRepl: (replId: string, code: string, name?: string) => {
      saveToLocalStorage(replId, code, name);
    },
    attachThreadToRepl: (threadId: string, replId: string) => {
      if (!threadId.includes("placeholder")) {
        saveThreadMappingToLocalStorage(threadId, replId);
      }
    },
    getThreadReplId: (threadId: string) => {
      if (typeof window === "undefined") return null;
      try {
        return localStorage.getItem(THREAD_MAP_PREFIX + threadId);
      } catch {
        return null;
      }
    },
    getActiveReplId: () => {
      if (typeof window === "undefined") return null;
      try {
        return localStorage.getItem(ACTIVE_REPL_KEY);
      } catch {
        return null;
      }
    },
    setActiveReplId: (replId: string) => {
      saveActiveReplToLocalStorage(replId);
    },
    createRepl: (code: string, name?: string) => {
      const replId = generateReplId();
      saveToLocalStorage(replId, code, name);
      return replId;
    },
    isAuthenticated: false,
  };
}
