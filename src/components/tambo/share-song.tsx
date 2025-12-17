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

export const ShareSong = React.forwardRef<HTMLDivElement, ShareSongProps>(
  ({ title = "Share song", suggestedTitle }, ref) => {
    const { streamStatus, propStatus } = useTamboStreamStatus<ShareSongProps>();
    const { data: session, isPending: isSessionPending } = useSession();
    const storage = useStrudelStorage();
    const { code, currentReplId } = useStrudel();

    const [showAuthModal, setShowAuthModal] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);

    const [share, setShare] = useTamboComponentState<ShareState>("share", {
      url: null,
    });

    const shareUrl = share?.url ?? null;

    const currentReplName = React.useMemo(() => {
      if (!currentReplId) return null;
      return storage.getRepl(currentReplId)?.name ?? null;
    }, [currentReplId, storage]);

    const effectiveTitle =
      suggestedTitle?.trim() || currentReplName?.trim() || undefined;

    const handleCreate = async () => {
      setError(null);
      setIsCreating(true);
      setCopied(false);

      try {
        const response = await fetch("/api/shares", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            code,
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create share link");
      } finally {
        setIsCreating(false);
      }
    };

    const handleCopy = async () => {
      if (!shareUrl) return;

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setError("Could not copy. Please copy the link manually.");
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
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background hover:bg-muted/70 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

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
