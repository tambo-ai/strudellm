import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Resend } from "resend";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const feedbackRequestSchema = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(10).max(4000),
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

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid or missing)";
  return `${local[0] ?? "*"}***@${domain}`;
}

export async function POST(req: Request) {
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

  const { title, body } = parsed.data;
  const userEmail = session.user.email;
  const userEmailParse = z.string().email().safeParse(userEmail);
  if (!userEmailParse.success) {
    if (!isProduction) {
      console.warn("Authenticated user has invalid email in session", { userEmail });
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Account email is invalid",
        code: "INVALID_SESSION_EMAIL",
        message:
          "Your account email is missing or invalid. Please sign in again or open a GitHub issue instead.",
      },
      { status: 400 },
    );
  }

  const safeUserEmail = userEmailParse.data;
  const safeReplyTo = safeUserEmail;

  // In development (and in production without RESEND_API_KEY), log feedback rather than fail hard.
  // This keeps local dev usable without requiring email credentials.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (isProduction) {
      console.error("Feedback submission failed: RESEND_API_KEY missing");
      return NextResponse.json(
        { ok: false, error: "Email service not configured" },
        { status: 500 },
      );
    }

    const redactedUserEmail = redactEmail(safeUserEmail);

    console.log("[feedback]", {
      title,
      body,
      userEmail: redactedUserEmail,
    });
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
      <p><strong>User email:</strong> ${escapeHtml(safeUserEmail)}</p>
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
