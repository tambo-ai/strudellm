"use client";

import { AuthModal } from "@/components/auth/auth-modal";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { useStrudel } from "@/strudel/context/strudel-provider";
import { useTamboStreamStatus, useTamboThread } from "@tambo-ai/react";
import { Loader2, Save, Trash2, FolderOpen, Pencil } from "lucide-react";
import * as React from "react";
import { z } from "zod/v3";

export const saveSongSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Optional title shown above the save/manage UI"),
  suggestedName: z
    .string()
    .optional()
    .describe("Optional suggested name to prefill the save input"),
});

export type SaveSongProps = z.infer<typeof saveSongSchema>;

export const SaveSong = React.forwardRef<HTMLDivElement, SaveSongProps>(
  ({ title = "Save song", suggestedName }, ref) => {
    const { streamStatus, propStatus } = useTamboStreamStatus<SaveSongProps>();
    const { data: session, isPending: isSessionPending } = useSession();
    const storage = useStrudelStorage();
    const {
      code,
      currentReplId,
      setReplId,
      stop,
      isPlaying,
      initializeRepl,
    } = useStrudel();
    const { startNewThread, switchCurrentThread } = useTamboThread();

    const [showAuthModal, setShowAuthModal] = React.useState(false);
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [renamingId, setRenamingId] = React.useState<string | null>(null);
    const [renameValue, setRenameValue] = React.useState("");
    const [busyReplId, setBusyReplId] = React.useState<string | null>(null);

    const currentRepl = React.useMemo(() => {
      if (!currentReplId) return null;
      return storage.getRepl(currentReplId);
    }, [currentReplId, storage]);

    React.useEffect(() => {
      if (!currentReplId) return;
      const existingName = currentRepl?.name?.trim();
      setName(existingName || suggestedName?.trim() || "");
    }, [currentReplId, currentRepl?.name, suggestedName]);

    const ensureRepl = React.useCallback(() => {
      if (currentReplId) return currentReplId;
      return initializeRepl();
    }, [currentReplId, initializeRepl]);

    const handleSave = async () => {
      setError(null);

      const replId = ensureRepl();
      if (!replId) {
        setError("Could not determine current song. Try again.");
        return;
      }

      const trimmed = name.trim();
      if (!trimmed) {
        setError("Please enter a name for this song.");
        return;
      }

      setIsSaving(true);
      try {
        storage.saveRepl(replId, code, trimmed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setIsSaving(false);
      }
    };

    const handleLoad = async (replId: string) => {
      setBusyReplId(replId);
      setError(null);
      try {
        if (isPlaying) {
          stop();
        }

        setReplId(replId);

        const threadId = storage.getThreadForRepl(replId);
        if (threadId) {
          await switchCurrentThread(threadId);
        } else {
          await startNewThread();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load song");
      } finally {
        setBusyReplId(null);
      }
    };

    const handleArchive = async (replId: string) => {
      setBusyReplId(replId);
      setError(null);
      try {
        storage.archiveRepl(replId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove song");
      } finally {
        setBusyReplId(null);
      }
    };

    const handleStartRename = (replId: string) => {
      const repl = storage.getRepl(replId);
      setRenamingId(replId);
      setRenameValue(repl?.name ?? "");
    };

    const handleApplyRename = async () => {
      if (!renamingId) return;

      const nextName = renameValue.trim();
      if (!nextName) {
        setError("Please enter a name.");
        return;
      }

      setBusyReplId(renamingId);
      setError(null);
      try {
        const repl = storage.getRepl(renamingId);
        if (!repl) {
          setError("Song not found.");
          return;
        }
        storage.saveRepl(renamingId, repl.code, nextName);
        setRenamingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to rename song");
      } finally {
        setBusyReplId(null);
      }
    };

    if (streamStatus.isPending || isSessionPending) {
      return (
        <div ref={ref} className="w-full rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
        </div>
      );
    }

    if (!session?.user) {
      return (
        <>
          <div ref={ref} className="w-full rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="text-sm text-foreground font-medium">Save & manage songs</div>
            <div className="text-sm text-muted-foreground">
              Sign in to save songs to your account and access them from any device.
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign in
            </button>
          </div>
          {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </>
      );
    }

    if (!storage.isLoaded) {
      return (
        <div ref={ref} className="w-full rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your songs...
          </div>
        </div>
      );
    }

    const repls = storage.allRepls;
    const namedRepls = repls.filter((r) => (storage.getRepl(r.id)?.name ?? "").trim());

    return (
      <div ref={ref} className="w-full rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={cn(
                "text-sm font-medium",
                propStatus.title?.isStreaming && "animate-pulse",
              )}
            >
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">
              Name the current song to keep it in your account.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Song name"
            className="flex-1 px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">Saved songs</div>

          {namedRepls.length === 0 ? (
            <div className="text-sm text-muted-foreground">No saved songs yet.</div>
          ) : (
            <div className="space-y-2">
              {namedRepls.map((r) => {
                const repl = storage.getRepl(r.id);
                const isBusy = busyReplId === r.id;
                const isCurrent = r.id === currentReplId;
                const displayName = repl?.name?.trim() || "Untitled";

                const isRenaming = renamingId === r.id;

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-background"
                  >
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="w-full px-2 py-1 bg-muted border border-border rounded-md text-sm"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm font-medium truncate">
                          {displayName}
                          {isCurrent && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (current)
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(r.lastUpdated).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRenaming ? (
                        <>
                          <button
                            onClick={handleApplyRename}
                            disabled={isBusy}
                            className="px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            disabled={isBusy}
                            className="px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleLoad(r.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <FolderOpen className="w-3 h-3" />
                            )}
                            Load
                          </button>
                          <button
                            onClick={() => handleStartRename(r.id)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70 disabled:opacity-50"
                          >
                            <Pencil className="w-3 h-3" />
                            Rename
                          </button>
                          <button
                            onClick={() => handleArchive(r.id)}
                            disabled={isBusy || isCurrent}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70 disabled:opacity-50"
                            title={
                              isCurrent
                                ? "Switch to another song before removing this one"
                                : "Remove from your list"
                            }
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {streamStatus.isError && streamStatus.streamError && (
          <div className="pt-2 text-xs text-destructive">
            Error: {streamStatus.streamError.message}
          </div>
        )}
      </div>
    );
  },
);

SaveSong.displayName = "SaveSong";
