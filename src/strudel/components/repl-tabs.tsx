"use client";

import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { Plus, X } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { AuthModal } from "@/components/auth/auth-modal";
import { useTamboThread } from "@tambo-ai/react";

/**
 * Tab bar for switching between REPLs.
 * - Authenticated users: shows all REPLs with switching
 * - Anonymous users: shows single tab with sign-in prompt for "+"
 */
export function ReplTabs() {
  const { currentReplId, setReplId, createNewRepl, stop, isPlaying } =
    useStrudel();
  // Use reactive allRepls from storage hook - automatically updates when Jazz syncs
  const {
    isAuthenticated,
    allRepls: rawAllRepls,
    getThreadForRepl,
    archiveRepl,
  } = useStrudelStorage();
  const { startNewThread, switchCurrentThread } = useTamboThread();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Keep a stable reference to the initial order of REPLs
  // This prevents reordering during render which can cause click events to hit wrong elements
  const stableOrderRef = useRef<string[]>([]);

  // Memoize the sorted allRepls to maintain stable order during interactions
  // Only update the order when the set of REPL IDs actually changes (new/deleted REPLs)
  const allRepls = useMemo(() => {
    const currentIds = new Set(rawAllRepls.map((r) => r.id));
    const previousIds = new Set(stableOrderRef.current);

    // Check if the set of IDs has changed (added or removed)
    const idsChanged =
      currentIds.size !== previousIds.size ||
      [...currentIds].some((id) => !previousIds.has(id));

    if (idsChanged || stableOrderRef.current.length === 0) {
      // IDs changed, update the stable order
      stableOrderRef.current = rawAllRepls.map((r) => r.id);
      return rawAllRepls;
    }

    // IDs are the same, maintain the previous order
    const replMap = new Map(rawAllRepls.map((r) => [r.id, r]));
    return stableOrderRef.current
      .map((id) => replMap.get(id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);
  }, [rawAllRepls]);

  const handleNewRepl = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    createNewRepl();
    // Start a new thread for the new REPL
    await startNewThread();
  };

  const handleSwitchRepl = async (replId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (replId !== currentReplId) {
      // Stop playback before switching
      if (isPlaying) {
        stop();
      }
      setReplId(replId);

      // Switch to this REPL's thread if one exists
      const threadId = getThreadForRepl(replId);
      if (threadId) {
        await switchCurrentThread(threadId);
      }
      // If no thread exists, do nothing - a new thread will be created on first message
    }
  };

  const handleArchiveRepl = async (replId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tab switch when clicking close

    // Don't allow archiving the last REPL
    if (allRepls.length <= 1) return;

    // If we're archiving the current REPL, switch to another one first
    if (replId === currentReplId) {
      const otherRepl = allRepls.find((r) => r.id !== replId);
      if (otherRepl) {
        // Stop playback before switching
        if (isPlaying) {
          stop();
        }
        setReplId(otherRepl.id);

        // Also switch to the other REPL's thread to keep chat and editor in sync
        const threadId = getThreadForRepl(otherRepl.id);
        if (threadId) {
          await switchCurrentThread(threadId);
        } else {
          // No thread for the target REPL - start a new one
          await startNewThread();
        }
      }
    }

    archiveRepl(replId);
  };

  // Get display name for a REPL tab
  const getTabName = (repl: { id: string; name?: string }, index: number) => {
    if (repl.name) return repl.name;
    return `REPL ${index + 1}`;
  };

  // For anonymous users, show minimal UI
  if (!isAuthenticated) {
    return (
      <>
        <div className="flex items-center border-b border-border bg-muted/30">
          <div className="px-3 py-1.5 text-sm text-foreground border-b-2 border-primary bg-background">
            REPL 1
          </div>
          <button
            onClick={handleNewRepl}
            className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Sign in to save multiple REPLs"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </>
    );
  }

  const canDelete = allRepls.length > 1;

  // For authenticated users, show full tabs
  return (
    <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
      {allRepls.map((repl, index) => (
        <div
          key={repl.id}
          className={cn(
            "group flex items-center gap-1 px-3 py-1.5 text-sm whitespace-nowrap transition-colors cursor-pointer",
            repl.id === currentReplId
              ? "text-foreground border-b-2 border-primary bg-background"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
          onClick={(e) => handleSwitchRepl(repl.id, e)}
        >
          <span>{getTabName(repl, index)}</span>
          {canDelete && (
            <button
              onClick={(e) => handleArchiveRepl(repl.id, e)}
              className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
              title="Close REPL"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={handleNewRepl}
        className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="New REPL"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
