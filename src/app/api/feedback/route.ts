import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_BODY_MIN_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
  FEEDBACK_TITLE_MIN_LENGTH,
} from "@/lib/feedback";
import { Resend } from "resend";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const feedbackRequestSchema = z.object({
  title: z.string().min(FEEDBACK_TITLE_MIN_LENGTH).max(FEEDBACK_TITLE_MAX_LENGTH),
  body: z.string().min(FEEDBACK_BODY_MIN_LENGTH).max(FEEDBACK_BODY_MAX_LENGTH),
});

function escapeHtml(str: string | null | undefined) {
  if (str == null) return "";
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackRequestSchema.safeParse(payload);
  if (!parsed.success) {
    if (!isProduction) {
      console.warn("Invalid feedback request", parsed.error.flatten());
    }
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 },
    );
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({
      headers: req.headers,
      asResponse: false,
    });
  } catch (error) {
    if (!isProduction) {
      console.error("Failed to fetch auth session for feedback", error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Auth temporarily unavailable",
        code: "AUTH_UNAVAILABLE",
        message:
          "We can't verify your account right now. Please try again later or open a GitHub issue instead.",
      },
      { status: 503 },
    );
  }

  // NOTE: This endpoint is intentionally restricted to authenticated end-users.
  // Anonymous feedback is handled via GitHub issues in the UI.
  if (!session?.user?.email) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sign in required",
        code: "AUTH_REQUIRED_FOR_FEEDBACK",
        message:
          "You must be signed in to send feedback via email. Please sign in or open a GitHub issue.",
      },
      { status: 401 },
    );
  }

  const { title, body } = parsed.data;

  const userEmail = session.user.email;
  const userEmailParse = z.string().email().safeParse(userEmail);
  if (!userEmailParse.success && !isProduction) {
    console.warn("Authenticated user has invalid email in session", { userEmail });
  }

  const safeReplyTo = userEmailParse.success ? userEmailParse.data : undefined;
  const displayUserEmail = userEmailParse.success
    ? userEmailParse.data
    : "(invalid or missing)";

  // In development, accept feedback rather than fail hard when RESEND_API_KEY is missing.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (isProduction) {
      console.error("Feedback submission failed: RESEND_API_KEY missing");
      return NextResponse.json(
        { ok: false, error: "Email service not configured" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, delivered: false });
  }

  const resend = new Resend(apiKey);

  const to = ["support@tambo.co", "support@tambo.com"];
  const from =
    process.env.RESEND_EMAIL_FROM || "Strudel LM <noreply@strudellm.com>";

  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  const subject = `StrudelLM feedback: ${normalizedTitle}`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <h2>${escapeHtml(title)}</h2>
      <p style="white-space: pre-wrap;">${escapeHtml(body)}</p>
      <hr />
      <p><strong>User email:</strong> ${escapeHtml(displayUserEmail)}</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: safeReplyTo,
    });
    return NextResponse.json({ ok: true, delivered: true });
  } catch (error) {
    console.error("Failed to send feedback email", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send email" },
      { status: 500 },
    );
  }
}
