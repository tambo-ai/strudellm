"use client";

import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useTamboComponentState, useTamboStreamStatus } from "@tambo-ai/react";
import { ExternalLink } from "lucide-react";
import * as React from "react";
import { z } from "zod/v3";

const issueTypeSchema = z
  .enum(["bug", "feature", "question", "other"])
  .optional()
  .describe(
    "Internal-only classification for maintainers. Do NOT show this in the UI. Choose: bug (broken behavior), feature (unsupported request), question (unclear usage), other (fallback).",
  );

export const feedbackFormSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(80)
    .describe(
      "A short feedback title (aim for 5–10 words) describing the user’s problem or request.",
    ),
  body: z
    .string()
    .min(10)
    .max(4000)
    .describe(
      "A longer description of what the user is trying to do, what they expected, and what happened instead.",
    ),
  issueType: issueTypeSchema,
});

export type FeedbackFormProps = z.infer<typeof feedbackFormSchema>;

function buildGithubIssueBody({
  body,
  issueType,
  userEmail,
}: {
  body: string;
  issueType: "bug" | "feature" | "question" | "other";
  userEmail?: string | null;
}): string {
  const cleanedBody = body.trim();
  const metaLines: string[] = ["<!-- submitted-via: StrudelLM FeedbackForm -->"];

  if (issueType) {
    metaLines.push(`<!-- tambo-issue-type: ${issueType} -->`);
  }
  if (userEmail) {
    metaLines.push(`<!-- reporter-email: ${userEmail} -->`);
  }

  return `${cleanedBody}\n\n${metaLines.join("\n")}\n`;
}

export const FeedbackForm = React.forwardRef<HTMLDivElement, FeedbackFormProps>(
  ({ title, body, issueType }, ref) => {
    const { streamStatus, propStatus } = useTamboStreamStatus<FeedbackFormProps>();
    const { data: session } = useSession();
    const userEmail = session?.user?.email ?? null;
    const effectiveIssueType = issueType ?? "other";

    const [draftTitle, setDraftTitle] = useTamboComponentState<string>(
      "draftTitle",
      "",
    );
    const [draftBody, setDraftBody] = useTamboComponentState<string>(
      "draftBody",
      "",
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
      if (!isSubmitted) return null;

      const params = new URLSearchParams();
      params.set("title", (draftTitle ?? "").trim());
      if (effectiveIssueType !== "other") {
        params.set(
          "labels",
          effectiveIssueType === "feature" ? "enhancement" : effectiveIssueType,
        );
      }
      params.set(
        "body",
        buildGithubIssueBody({
          body: draftBody ?? "",
          issueType: effectiveIssueType,
          userEmail,
        }),
      );

      return `${config.githubNewIssue}?${params.toString()}`;
    }, [isSubmitted, draftTitle, draftBody, effectiveIssueType, userEmail]);

    const isDisabled = isSubmitted || isSending;

    const onSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isDisabled) return;

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
            issueType: effectiveIssueType,
            userEmail,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Request failed");
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
              maxLength={80}
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
              maxLength={4000}
              required
            />
          </div>

          {submitError && (
            <p className="text-xs text-destructive">{submitError}</p>
          )}

          <div className="space-y-3">
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

            {isSubmitted && githubIssueUrl && (
              <a
                href={githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open GitHub issue
              </a>
            )}
          </div>
        </form>
      </div>
    );
  },
);

FeedbackForm.displayName = "FeedbackForm";
