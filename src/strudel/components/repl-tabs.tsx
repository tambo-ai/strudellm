"use client";

import { cn } from "@/lib/utils";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthModal } from "@/components/auth/auth-modal";
import { useTamboThread } from "@tambo-ai/react";

/**
 * Tab bar for switching between REPLs.
 * - Authenticated users: shows all REPLs with switching
 * - Anonymous users: shows single tab with sign-in prompt for "+"
 */
export function ReplTabs() {
  const {
    getCurrentReplId,
    setReplId,
    createNewRepl,
    getAllRepls,
    deleteRepl,
    allRepls,
    stop,
    isPlaying,
  } = useStrudel();
  const { isAuthenticated } = useStrudelStorage();
  const { startNewThread } = useTamboThread();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const currentReplId = getCurrentReplId();

  // Refresh the list of REPLs on mount and when auth changes
  useEffect(() => {
    getAllRepls();
  }, [getAllRepls, isAuthenticated]);

  const handleNewRepl = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    createNewRepl();
    getAllRepls();
    // Start a new thread for the new REPL
    await startNewThread();
  };

  const handleSwitchRepl = async (replId: string) => {
    if (replId !== currentReplId) {
      // Stop playback before switching
      if (isPlaying) {
        stop();
      }
      setReplId(replId);
      // Start a new thread when switching REPLs
      // This ensures AI updates go to the correct REPL
      await startNewThread();
    }
  };

  const handleDeleteRepl = (replId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent tab switch when clicking delete

    // Don't allow deleting the last REPL
    if (allRepls.length <= 1) return;

    // If we're deleting the current REPL, switch to another one first
    if (replId === currentReplId) {
      const otherRepl = allRepls.find((r) => r.id !== replId);
      if (otherRepl) {
        setReplId(otherRepl.id);
      }
    }

    deleteRepl(replId);
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
          onClick={() => handleSwitchRepl(repl.id)}
        >
          <span>{getTabName(repl, index)}</span>
          {canDelete && (
            <button
              onClick={(e) => handleDeleteRepl(repl.id, e)}
              className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
              title="Delete REPL"
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
