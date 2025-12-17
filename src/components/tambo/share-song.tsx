"use client";

import { AuthModal } from "@/components/auth/auth-modal";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { useStrudel } from "@/strudel/context/strudel-provider";
import {
  useTamboComponentState,
  useTamboStreamStatus,
} from "@tambo-ai/react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import * as React from "react";
import { z } from "zod/v3";

export const shareSongSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Optional title shown above the share UI"),
  suggestedTitle: z
    .string()
    .optional()
    .describe("Optional title to use when generating the share link"),
});

export type ShareSongProps = z.infer<typeof shareSongSchema>;

type ShareState = {
  url: string | null;
};

type ShareSummary = {
  id: string;
  url: string;
  replId: string | null;
  replName: string | null;
  title: string | null;
  createdAt: number;
};

export const ShareSong = React.forwardRef<HTMLDivElement, ShareSongProps>(
  ({ title = "Share song", suggestedTitle }, ref) => {
    const { streamStatus, propStatus } = useTamboStreamStatus<ShareSongProps>();
    const { data: session, isPending: isSessionPending } = useSession();
    const storage = useStrudelStorage();
    const { code, currentReplId } = useStrudel();

    const [showAuthModal, setShowAuthModal] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [isLoadingShares, setIsLoadingShares] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);
    const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

    const [selectedReplId, setSelectedReplId] = React.useState<string | null>(null);
    const [shares, setShares] = React.useState<ShareSummary[]>([]);
    const selectedReplIdRef = React.useRef<string | null>(null);
    const previousSelectedReplIdRef = React.useRef<string | null>(null);

    const [share, setShare] = useTamboComponentState<ShareState>("share", {
      url: null,
    });

    const shareUrl = share?.url ?? null;

    React.useEffect(() => {
      selectedReplIdRef.current = selectedReplId;
      setError(null);

      const previous = previousSelectedReplIdRef.current;
      if (previous && selectedReplId && previous !== selectedReplId) {
        setShare({ url: null });
        setCopiedUrl(null);
      }

      previousSelectedReplIdRef.current = selectedReplId;
    }, [selectedReplId, setShare]);

    const replOptions = React.useMemo(() => {
      const repls = storage.getAllRepls();
      return repls.map((repl) => ({
        ...repl,
        isArchived: storage.isReplArchived(repl.id),
      }));
    }, [storage]);

    React.useEffect(() => {
      if (selectedReplId) return;
      if (currentReplId) {
        setSelectedReplId(currentReplId);
        return;
      }
      if (storage.isLoaded && replOptions.length > 0) {
        setSelectedReplId(replOptions[0].id);
      }
    }, [currentReplId, replOptions, selectedReplId, storage.isLoaded]);

    const selectedRepl = React.useMemo(() => {
      if (!selectedReplId) return null;
      return storage.getRepl(selectedReplId);
    }, [selectedReplId, storage]);

    const selectedReplName = selectedRepl?.name?.trim() || null;

    const effectiveTitle =
      suggestedTitle?.trim() || selectedReplName?.trim() || undefined;

    const selectedCode =
      selectedReplId && selectedReplId === currentReplId
        ? code
        : selectedRepl?.code ?? "";

    const refreshShares = React.useCallback(async () => {
      if (!session?.user?.id) return;
      if (!selectedReplId) return;

      const requestedReplId = selectedReplId;

      setIsLoadingShares(true);
      try {
        const response = await fetch(
          `/api/shares?replId=${encodeURIComponent(requestedReplId)}`,
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || `Request failed (${response.status})`);
        }
        const data = (await response.json()) as { shares: ShareSummary[] };

        if (selectedReplIdRef.current !== requestedReplId) {
          return;
        }

        setShares(data.shares ?? []);
      } catch (e) {
        if (selectedReplIdRef.current !== requestedReplId) {
          return;
        }

        setShares([]);
        setError(
          e instanceof Error ? e.message : "Failed to load existing shares",
        );
      } finally {
        if (selectedReplIdRef.current !== requestedReplId) {
          return;
        }
        setIsLoadingShares(false);
      }
    }, [selectedReplId, session?.user?.id]);

    React.useEffect(() => {
      if (!session?.user?.id || !selectedReplId) return;
      void refreshShares();
    }, [refreshShares, selectedReplId, session?.user?.id]);

    const handleCreate = async () => {
      setError(null);
      setIsCreating(true);
      setCopiedUrl(null);

      try {
        if (!selectedReplId) {
          throw new Error("Open or select a tab before generating a share link.");
        }

        if (!selectedCode.trim()) {
          throw new Error("Create or load a song before generating a share link.");
        }

        const response = await fetch("/api/shares", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            replId: selectedReplId,
            replName: selectedReplName ?? undefined,
            code: selectedCode,
            title: effectiveTitle,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || `Request failed (${response.status})`);
        }

        const data = (await response.json()) as { url: string };
        setShare({ url: data.url });
        await refreshShares();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create share link");
      } finally {
        setIsCreating(false);
      }
    };

    const handleCopy = async (url: string) => {

      try {
        await navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopiedUrl(null);
        }, 1500);
      } catch {
        setError("Could not copy. Please copy the link manually.");
      }
    };

    React.useEffect(() => {
      return () => {
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
      };
    }, []);

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
            <div className="text-sm text-foreground font-medium">Share a song</div>
            <div className="text-sm text-muted-foreground">
              Sign in to generate a share link.
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
              Generates a public link that anyone can open to view/play this song.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedReplId ?? ""}
            onChange={(e) => setSelectedReplId(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={!storage.isLoaded}
          >
            {!selectedReplId && (
              <option value="" disabled>
                Select a tab...
              </option>
            )}
            {replOptions.map((repl, index) => {
              const label = repl.name?.trim()
                ? repl.name.trim()
                : `REPL ${index + 1}`;
              return (
                <option key={repl.id} value={repl.id}>
                  {repl.isArchived ? `${label} (archived)` : label}
                </option>
              );
            })}
          </select>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            {shareUrl ? "Regenerate link" : "Generate link"}
          </button>
        </div>

        {shareUrl && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Share URL</div>
            <div className="flex gap-2">
              <input
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-md text-sm text-foreground"
              />
              <button
                onClick={() => handleCopy(shareUrl)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted/70 transition-colors"
              >
                {copiedUrl === shareUrl ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedUrl === shareUrl ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">Previous share links</div>
          {isLoadingShares ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : shares.length === 0 ? (
            <div className="text-sm text-muted-foreground">No shares yet.</div>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {share.title ?? "Shared song"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(share.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={share.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70"
                    >
                      <Link2 className="w-3 h-3" />
                      Open
                    </a>
                    <button
                      onClick={() => handleCopy(share.url)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/70"
                    >
                      {copiedUrl === share.url ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedUrl === share.url ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
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

ShareSong.displayName = "ShareSong";
