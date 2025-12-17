"use client";

import { useAccount, useIsAuthenticated } from "jazz-tools/react";
import { StrudelAccount, StrudelRepl } from "@/lib/jazz-schema";
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
export interface ReplSummary {
  id: string;
  name?: string;
  lastUpdated: number;
}

export interface StrudelStorageAdapter {
  /** Get the REPL for a given thread */
  getReplForThread: (
    threadId: string,
  ) => { replId: string; code: string } | null;
  /** Get a REPL by its ID */
  getRepl: (replId: string) => { code: string; name?: string } | null;
  /** Get all REPLs (for tab display) */
  getAllRepls: () => ReplSummary[];
  /** Reactive list of all REPLs (excludes archived) - updates automatically when Jazz syncs */
  allRepls: ReplSummary[];
  /** Save/update a REPL */
  saveRepl: (replId: string, code: string, name?: string) => void;
  /** Associate a thread with a REPL */
  attachThreadToRepl: (threadId: string, replId: string) => void;
  /** Get the REPL ID for a thread (if any) */
  getThreadReplId: (threadId: string) => string | null;
  /** Get the most recent thread ID for a REPL (if any) */
  getThreadForRepl: (replId: string) => string | null;
  /** Get or create the active REPL ID */
  getActiveReplId: () => string | null;
  /** Set the active REPL */
  setActiveReplId: (replId: string) => void;
  /** Create a new REPL and return its ID */
  createRepl: (code: string, name?: string) => string;
  /** Delete a REPL by its ID */
  deleteRepl: (replId: string) => void;
  /** Archive a REPL (hide from tabs but keep data) */
  archiveRepl: (replId: string) => void;
  /** Unarchive a REPL (show in tabs again) */
  unarchiveRepl: (replId: string) => void;
  /** Check if a REPL is archived */
  isReplArchived: (replId: string) => boolean;
  /** Whether user is authenticated (using Jazz) */
  isAuthenticated: boolean;
  /** Whether auth state has been determined (false while still checking) */
  isAuthResolved: boolean;
  /** Whether Jazz data has been loaded (for authenticated users) */
  isLoaded: boolean;
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
        const repls = account.root.repls;
        const repl = repls[replId];
        if (repl && repl.code) {
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

  const getAllRepls = useCallback((): ReplSummary[] => {
    // If authenticated and Jazz root is available, use Jazz
    if (account?.$isLoaded && account?.root?.repls) {
      const repls = account.root.repls as unknown as Record<
        string,
        { id: string; name?: string; lastUpdated?: number } | undefined
      >;
      const result: ReplSummary[] = [];
      for (const key of Object.keys(repls)) {
        // Skip internal Jazz properties
        if (key.startsWith("$") || key.startsWith("_")) continue;
        const repl = repls[key];
        if (repl && typeof repl === "object" && "code" in repl) {
          result.push({
            id: repl.id || key,
            name: repl.name,
            lastUpdated: repl.lastUpdated ?? 0,
          });
        }
      }
      // Sort by lastUpdated descending (most recent first)
      return result.sort((a, b) => b.lastUpdated - a.lastUpdated);
    }

    // Otherwise use localStorage
    if (typeof window === "undefined") return [];
    try {
      const result: ReplSummary[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const replId = key.slice(STORAGE_PREFIX.length);
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            result.push({
              id: replId,
              name: parsed.name,
              lastUpdated: parsed.lastUpdated ?? 0,
            });
          }
        }
      }
      // Sort by lastUpdated descending (most recent first)
      return result.sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch {
      return [];
    }
  }, [account]);

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

  // Get the most recent thread ID for a REPL by iterating through threadToRepl mapping
  const getThreadForRepl = useCallback(
    (replId: string): string | null => {
      // If authenticated and Jazz root is available, use Jazz
      if (account?.$isLoaded && account?.root?.threadToRepl) {
        const threadMap = account.root.threadToRepl as unknown as Record<
          string,
          string | undefined
        >;
        // Find all threads that point to this REPL
        const matchingThreads: string[] = [];
        for (const [threadId, mappedReplId] of Object.entries(threadMap)) {
          // Skip internal Jazz properties
          if (threadId.startsWith("$") || threadId.startsWith("_")) continue;
          if (mappedReplId === replId) {
            matchingThreads.push(threadId);
          }
        }
        // Return the most recent thread (last in the list, as they're added chronologically)
        return matchingThreads.length > 0
          ? matchingThreads[matchingThreads.length - 1]
          : null;
      }

      // Otherwise use localStorage
      if (typeof window === "undefined") return null;
      try {
        const matchingThreads: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(THREAD_MAP_PREFIX)) {
            const threadId = key.slice(THREAD_MAP_PREFIX.length);
            const mappedReplId = localStorage.getItem(key);
            if (mappedReplId === replId) {
              matchingThreads.push(threadId);
            }
          }
        }
        // Return the most recent thread (last in the list)
        return matchingThreads.length > 0
          ? matchingThreads[matchingThreads.length - 1]
          : null;
      } catch {
        return null;
      }
    },
    [account],
  );

  const saveRepl = useCallback(
    (replId: string, code: string, name?: string): void => {
      // If authenticated and Jazz root is available, save to Jazz
      if (account?.$isLoaded && account?.root?.repls) {
        try {
          // Cast to access by index
          const repls = account.root.repls as unknown as Record<
            string,
            {
              code: string;
              name?: string;
              createdAt?: number;
              archived?: boolean;
            }
          >;
          const existing = repls[replId];
          const now = Date.now();

          // Save the REPL using $jazz.set with a proper StrudelRepl instance
          // Preserve the archived flag if it exists
          account.root.repls.$jazz.set(
            replId,
            StrudelRepl.create({
              id: replId,
              code,
              name: name ?? existing?.name,
              createdAt: existing?.createdAt ?? now,
              lastUpdated: now,
              archived: existing?.archived,
            }),
          );
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
      if (account?.$isLoaded && account?.root?.threadToRepl) {
        try {
          account.root.threadToRepl.$jazz.set(threadId, replId);
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

  // Active REPL ID is always stored in localStorage (not synced across browsers)
  // This is intentional - which tab is selected should be local to each browser
  const getActiveReplId = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ACTIVE_REPL_KEY);
    } catch {
      return null;
    }
  }, []);

  const setActiveReplId = useCallback((replId: string): void => {
    saveActiveReplToLocalStorage(replId);
  }, []);

  const createRepl = useCallback(
    (code: string, name?: string): string => {
      const replId = generateReplId();
      saveRepl(replId, code, name);
      return replId;
    },
    [saveRepl],
  );

  const deleteRepl = useCallback(
    (replId: string): void => {
      // If authenticated and Jazz root is available, delete from Jazz
      if (account?.$isLoaded && account?.root?.repls) {
        try {
          account.root.repls.$jazz.delete(replId);
        } catch (error) {
          console.error("Failed to delete REPL from Jazz:", error);
          deleteFromLocalStorage(replId);
        }
        return;
      }

      // Otherwise use localStorage
      deleteFromLocalStorage(replId);
    },
    [account],
  );

  const archiveRepl = useCallback(
    (replId: string): void => {
      // If authenticated and Jazz root is available, archive in Jazz
      if (account?.$isLoaded && account?.root?.repls) {
        try {
          const repls = account.root.repls as unknown as Record<
            string,
            {
              id: string;
              code: string;
              name?: string;
              createdAt: number;
              lastUpdated: number;
              archived?: boolean;
            }
          >;
          const existing = repls[replId];
          if (existing) {
            account.root.repls.$jazz.set(
              replId,
              StrudelRepl.create({
                id: existing.id,
                code: existing.code,
                name: existing.name,
                createdAt: existing.createdAt,
                lastUpdated: existing.lastUpdated,
                archived: true,
              }),
            );
          }
        } catch (error) {
          console.error("Failed to archive REPL in Jazz:", error);
        }
        return;
      }

      // For localStorage, just delete (no archive support for anonymous)
      deleteFromLocalStorage(replId);
    },
    [account],
  );

  const unarchiveRepl = useCallback(
    (replId: string): void => {
      // If authenticated and Jazz root is available, unarchive in Jazz
      if (account?.$isLoaded && account?.root?.repls) {
        try {
          const repls = account.root.repls as unknown as Record<
            string,
            {
              id: string;
              code: string;
              name?: string;
              createdAt: number;
              lastUpdated: number;
              archived?: boolean;
            }
          >;
          const existing = repls[replId];
          if (existing) {
            account.root.repls.$jazz.set(
              replId,
              StrudelRepl.create({
                id: existing.id,
                code: existing.code,
                name: existing.name,
                createdAt: existing.createdAt,
                lastUpdated: existing.lastUpdated,
                archived: false,
              }),
            );
          }
        } catch (error) {
          console.error("Failed to unarchive REPL in Jazz:", error);
        }
        return;
      }
      // No-op for localStorage (no archive support for anonymous)
    },
    [account],
  );

  const isReplArchived = useCallback(
    (replId: string): boolean => {
      // If authenticated and Jazz root is available, check Jazz
      if (account?.$isLoaded && account?.root?.repls) {
        const repls = account.root.repls as unknown as Record<
          string,
          { archived?: boolean } | undefined
        >;
        const repl = repls[replId];
        return repl?.archived === true;
      }
      // localStorage doesn't support archive
      return false;
    },
    [account],
  );

  // Auth is resolved when useAccount has returned a definitive result (not undefined = still loading)
  // Note: For authenticated users, account will be an object. For anonymous, it may be null.
  const isAuthResolved = account !== undefined;

  // Jazz is loaded when we have the account root available (for authenticated users)
  // For anonymous users, we consider it loaded once auth is resolved
  const isLoaded =
    isAuthResolved &&
    (!isAuthenticated || (account?.$isLoaded && !!account?.root));

  // Compute allRepls reactively from Jazz account data
  // This will automatically update when Jazz syncs new data
  // NOTE: This excludes archived REPLs
  const allRepls = useMemo((): ReplSummary[] => {
    // If authenticated and Jazz root is available, use Jazz
    if (account?.$isLoaded && account?.root?.repls) {
      const repls = account.root.repls as unknown as Record<
        string,
        | {
            id: string;
            code?: string;
            name?: string;
            lastUpdated?: number;
            archived?: boolean;
            $isLoaded?: boolean;
          }
        | undefined
      >;
      const result: ReplSummary[] = [];
      for (const key of Object.keys(repls)) {
        // Skip internal Jazz properties
        if (key.startsWith("$") || key.startsWith("_")) continue;
        const repl = repls[key];
        // Skip archived REPLs
        if (repl?.archived === true) continue;
        if (repl && typeof repl === "object" && "code" in repl) {
          result.push({
            id: repl.id || key,
            name: repl.name,
            lastUpdated: repl.lastUpdated ?? 0,
          });
        }
      }
      // Sort by lastUpdated descending (most recent first)
      return result.sort((a, b) => b.lastUpdated - a.lastUpdated);
    }

    // Otherwise use localStorage
    if (typeof window === "undefined") return [];
    try {
      const result: ReplSummary[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const replId = key.slice(STORAGE_PREFIX.length);
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            result.push({
              id: replId,
              name: parsed.name,
              lastUpdated: parsed.lastUpdated ?? 0,
            });
          }
        }
      }
      // Sort by lastUpdated descending (most recent first)
      return result.sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch {
      return [];
    }
  }, [account]);

  return useMemo(
    () => ({
      getReplForThread,
      getRepl,
      getAllRepls,
      allRepls,
      saveRepl,
      attachThreadToRepl,
      getThreadReplId,
      getThreadForRepl,
      getActiveReplId,
      setActiveReplId,
      createRepl,
      deleteRepl,
      archiveRepl,
      unarchiveRepl,
      isReplArchived,
      isAuthenticated,
      isAuthResolved,
      isLoaded,
    }),
    [
      getReplForThread,
      getRepl,
      getAllRepls,
      allRepls,
      saveRepl,
      attachThreadToRepl,
      getThreadReplId,
      getThreadForRepl,
      getActiveReplId,
      setActiveReplId,
      createRepl,
      deleteRepl,
      archiveRepl,
      unarchiveRepl,
      isReplArchived,
      isAuthenticated,
      isAuthResolved,
      isLoaded,
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

function deleteFromLocalStorage(replId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + replId);
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
    getAllRepls: () => {
      if (typeof window === "undefined") return [];
      try {
        const result: ReplSummary[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STORAGE_PREFIX)) {
            const replId = key.slice(STORAGE_PREFIX.length);
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              result.push({
                id: replId,
                name: parsed.name,
                lastUpdated: parsed.lastUpdated ?? 0,
              });
            }
          }
        }
        return result.sort((a, b) => b.lastUpdated - a.lastUpdated);
      } catch {
        return [];
      }
    },
    // For non-reactive adapter, allRepls is computed on access
    get allRepls() {
      return this.getAllRepls();
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
    getThreadForRepl: (replId: string) => {
      if (typeof window === "undefined") return null;
      try {
        const matchingThreads: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(THREAD_MAP_PREFIX)) {
            const threadId = key.slice(THREAD_MAP_PREFIX.length);
            const mappedReplId = localStorage.getItem(key);
            if (mappedReplId === replId) {
              matchingThreads.push(threadId);
            }
          }
        }
        return matchingThreads.length > 0
          ? matchingThreads[matchingThreads.length - 1]
          : null;
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
    deleteRepl: (replId: string) => {
      deleteFromLocalStorage(replId);
    },
    archiveRepl: (replId: string) => {
      // For localStorage, just delete (no archive support for anonymous)
      deleteFromLocalStorage(replId);
    },
    unarchiveRepl: () => {
      // No-op for localStorage (no archive support for anonymous)
    },
    isReplArchived: () => {
      // localStorage doesn't support archive
      return false;
    },
    isAuthenticated: false,
    isAuthResolved: true, // localStorage adapter means auth is resolved (anonymous)
    isLoaded: true, // localStorage is always "loaded"
  };
}
