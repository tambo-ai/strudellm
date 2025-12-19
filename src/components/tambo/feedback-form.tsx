"use client";

import { config } from "@/lib/config";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_BODY_MIN_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
  FEEDBACK_TITLE_MIN_LENGTH,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { AuthModal } from "@/components/auth/auth-modal";
import { useTamboComponentState, useTamboStreamStatus } from "@tambo-ai/react";
import { ExternalLink } from "lucide-react";
import * as React from "react";
import { z } from "zod/v3";

export const feedbackFormSchema = z.object({
  title: z
    .string()
    .min(FEEDBACK_TITLE_MIN_LENGTH)
    .max(FEEDBACK_TITLE_MAX_LENGTH)
    .describe(
      "A short feedback title (aim for 5–10 words) describing the user’s problem or request. Used for either the support email subject (when signed in) or the GitHub issue title (when signed out).",
    ),
  body: z
    .string()
    .min(FEEDBACK_BODY_MIN_LENGTH)
    .max(FEEDBACK_BODY_MAX_LENGTH)
    .describe(
      "A longer description of what the user is trying to do, what they expected, and what happened instead. Used for either the support email body (when signed in) or the GitHub issue body (when signed out).",
    ),
});

export type FeedbackFormProps = z.infer<typeof feedbackFormSchema>;

function buildGithubIssueBody({
  body,
}: {
  body: string;
}): string {
  const cleanedBody = body.trim() || "(no additional details provided)";
  const metaLine = "<!-- submitted-via: StrudelLM FeedbackForm -->";

  return `${cleanedBody}\n\n${metaLine}\n`;
}

function getSafeGithubNewIssueBase(raw: string): string | null {
  try {
    const url = new URL(raw);

    if (url.protocol !== "https:") return null;
    if (url.hostname !== "github.com") return null;

    url.hash = "";
    url.search = "";
    return url.toString().replace(/\?$/, "");
  } catch {
    return null;
  }
}

export const FeedbackForm = React.forwardRef<HTMLDivElement, FeedbackFormProps>(
  ({ title, body }, ref) => {
    const { streamStatus, propStatus } = useTamboStreamStatus<FeedbackFormProps>();
    const { data: session } = useSession();
    const isSignedIn = Boolean(session?.user?.email);
    const [showAuthModal, setShowAuthModal] = React.useState(false);

    const [draftTitle, setDraftTitle] = useTamboComponentState<string>(
      "draftTitle",
      title ?? "",
    );
    const [draftBody, setDraftBody] = useTamboComponentState<string>(
      "draftBody",
      body ?? "",
    );
    const [hasEdited, setHasEdited] = useTamboComponentState<boolean>(
      "hasEdited",
      false,
    );
    const [isSending, setIsSending] = useTamboComponentState<boolean>(
      "isSending",
      false,
    );
    const [isSubmitted, setIsSubmitted] = useTamboComponentState<boolean>(
      "isSubmitted",
      false,
    );
    const [wasDelivered, setWasDelivered] = useTamboComponentState<boolean | null>(
      "wasDelivered",
      null,
    );
    const [submitError, setSubmitError] = useTamboComponentState<string | null>(
      "submitError",
      null,
    );

    React.useEffect(() => {
      if (hasEdited || isSubmitted) return;
      if (!draftTitle && title) setDraftTitle(title);
      if (!draftBody && body) setDraftBody(body);
    }, [
      hasEdited,
      isSubmitted,
      draftTitle,
      draftBody,
      title,
      body,
      setDraftTitle,
      setDraftBody,
    ]);

    const githubIssueUrl = React.useMemo(() => {
      const cleanedTitle = (draftTitle ?? "").trim();
      const cleanedBody = (draftBody ?? "").trim();

      if (cleanedBody.length < FEEDBACK_BODY_MIN_LENGTH) return null;

      const base = getSafeGithubNewIssueBase(config.githubNewIssue);
      if (!base) return null;

      const params = new URLSearchParams();
      params.set("title", cleanedTitle || "Feedback from StrudelLM");
      params.set(
        "body",
        buildGithubIssueBody({
          body: cleanedBody,
        }),
      );

      return `${base}?${params.toString()}`;
    }, [draftTitle, draftBody]);

    const isDisabled = isSubmitted || isSending;

    const onSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isDisabled) return;

      if (!isSignedIn) {
        setShowAuthModal(true);
        return;
      }

      setSubmitError(null);
      setIsSending(true);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            title: draftTitle ?? "",
            body: draftBody ?? "",
          }),
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const data: unknown = await res.json().catch(() => null);

            if (
              res.status === 401 &&
              data &&
              typeof data === "object" &&
              "code" in data &&
              (data as { code?: unknown }).code === "AUTH_REQUIRED_FOR_FEEDBACK"
            ) {
              setIsSending(false);
              setShowAuthModal(true);
              return;
            }

            if (
              data &&
              typeof data === "object" &&
              "message" in data &&
              typeof (data as { message?: unknown }).message === "string"
            ) {
              throw new Error((data as { message: string }).message);
            }

            if (
              data &&
              typeof data === "object" &&
              "error" in data &&
              typeof (data as { error?: unknown }).error === "string"
            ) {
              throw new Error((data as { error: string }).error);
            }
          }

          if (res.status >= 500) {
            throw new Error(
              "Our servers had an issue saving your feedback. Please try again.",
            );
          }

          const text = await res.text();
          throw new Error(text || "Request failed");
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data: unknown = await res.json().catch(() => null);
          if (
            data &&
            typeof data === "object" &&
            "delivered" in data &&
            typeof (data as { delivered?: unknown }).delivered === "boolean"
          ) {
            setWasDelivered((data as { delivered: boolean }).delivered);
          }
        }

        setIsSubmitted(true);
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Failed to submit feedback",
        );
      } finally {
        setIsSending(false);
      }
    };

    if (streamStatus.isPending) {
      return (
        <div
          ref={ref}
          className="w-full rounded-lg border border-border bg-card p-4"
        >
          <div className="text-sm text-muted-foreground animate-pulse">
            Loading...
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="w-full rounded-lg border border-border bg-card p-4 space-y-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Send feedback</h3>
          <p className="text-xs text-muted-foreground">
            Tell us what went wrong or what you were trying to do.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Title
            </label>
            <input
              value={draftTitle ?? ""}
              disabled={isDisabled}
              onChange={(e) => {
                setHasEdited(true);
                setDraftTitle(e.target.value);
              }}
              className={cn(
                "w-full px-3 py-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2",
                "border-border focus:ring-accent",
                propStatus.title?.isStreaming && "animate-pulse",
                isDisabled && "opacity-70",
              )}
              placeholder="Short summary (5–10 words)"
              minLength={FEEDBACK_TITLE_MIN_LENGTH}
              maxLength={FEEDBACK_TITLE_MAX_LENGTH}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Details
            </label>
            <textarea
              value={draftBody ?? ""}
              disabled={isDisabled}
              onChange={(e) => {
                setHasEdited(true);
                setDraftBody(e.target.value);
              }}
              className={cn(
                "w-full min-h-[120px] px-3 py-2 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 resize-y",
                "border-border focus:ring-accent",
                propStatus.body?.isStreaming && "animate-pulse",
                isDisabled && "opacity-70",
              )}
              placeholder="What were you trying to do? What did you expect? What happened instead?"
              minLength={FEEDBACK_BODY_MIN_LENGTH}
              maxLength={FEEDBACK_BODY_MAX_LENGTH}
              required
            />
          </div>

          {submitError && (
            <p className="text-xs text-destructive">{submitError}</p>
          )}

          <div className="space-y-3">
            {isSignedIn ? (
              <>
                <button
                  type="submit"
                  disabled={
                    isDisabled ||
                    !(draftTitle ?? "").trim() ||
                    !(draftBody ?? "").trim() ||
                    streamStatus.isStreaming
                  }
                  className={cn(
                    "w-full px-4 py-2 rounded-md transition-colors",
                    isSubmitted
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  {isSubmitted
                    ? "Submitted"
                    : isSending
                      ? "Submitting…"
                      : "Submit feedback"}
                </button>

                {githubIssueUrl && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {isSubmitted
                        ? "Want this fixed faster? Open a GitHub issue so we can track it."
                        : submitError
                          ? "Having trouble sending? Open a GitHub issue so we can track it."
                          : "Prefer GitHub? Open an issue so we can track this."}
                    </p>

                    {isSubmitted && wasDelivered === false && (
                      <p className="text-xs text-muted-foreground">
                        Feedback was accepted, but email isn’t configured here.
                        Please open a GitHub issue so we can track it.
                      </p>
                    )}
                    <a
                      href={githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open GitHub issue
                    </a>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isSending || streamStatus.isStreaming}
                  onClick={() => setShowAuthModal(true)}
                  className={cn(
                    "w-full px-4 py-2 rounded-md transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  Log in to send feedback
                </button>

                <p className="text-xs text-muted-foreground">
                  Prefer not to log in? Open a GitHub issue and we’ll track it
                  there.
                </p>

                {githubIssueUrl ? (
                  <a
                    href={githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open GitHub issue
                  </a>
                ) : (
                  <div className="space-y-1">
                    <button
                      type="button"
                      disabled
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-border text-muted-foreground opacity-60 cursor-not-allowed"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open GitHub issue
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Add a bit more detail above to enable opening a GitHub
                      issue.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </form>

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </div>
    );
  },
);

FeedbackForm.displayName = "FeedbackForm";
