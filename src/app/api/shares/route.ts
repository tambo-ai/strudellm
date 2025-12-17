import { auth } from "@/lib/auth";
import {
  createSongShare,
  getLatestSongShareCreatedAt,
  listSongShareSummaries,
} from "@/services/song-share";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";

const MAX_CODE_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 200;
const MAX_REPL_ID_LENGTH = 200;
const MIN_TIME_BETWEEN_SHARES_MS = 60_000;
// REPL IDs are client-generated (see `generateReplId()` in `src/hooks/use-strudel-storage.ts`).
const REPL_ID_PATTERN = /^repl-/;

const createShareSchema = z.object({
  replId: z
    .string()
    .trim()
    .min(1)
    .max(MAX_REPL_ID_LENGTH)
    .regex(REPL_ID_PATTERN),
  replName: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
  code: z.string().min(1).max(MAX_CODE_LENGTH),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
});

const listSharesQuerySchema = z.object({
  replId: z
    .string()
    .trim()
    .min(1)
    .max(MAX_REPL_ID_LENGTH)
    .regex(REPL_ID_PATTERN)
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    console.error("Failed to parse request JSON for /api/shares", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("Invalid /api/shares payload", {
      userId: session.user.id,
      issues: parsed.error.issues,
    });
    return NextResponse.json(
      {
        error: "Invalid request",
        issues:
          process.env.NODE_ENV === "development" ? parsed.error.issues : undefined,
      },
      { status: 400 },
    );
  }

  const latestCreatedAt = await getLatestSongShareCreatedAt(session.user.id);
  const now = Date.now();
  if (latestCreatedAt !== null) {
    const rawDiff = now - latestCreatedAt;
    const diff = rawDiff < 0 ? 0 : rawDiff;

    if (diff < MIN_TIME_BETWEEN_SHARES_MS) {
      const retryAfterSeconds = Math.ceil(
        (MIN_TIME_BETWEEN_SHARES_MS - diff) / 1000,
      );

      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait before creating another share.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        },
      );
    }
  }

  const share = await createSongShare({
    ownerUserId: session.user.id,
    replId: parsed.data.replId,
    replName: parsed.data.replName ?? null,
    code: parsed.data.code,
    title: parsed.data.title ?? null,
  });

  const url = new URL(`/share/${share.id}`, req.nextUrl.origin);
  return NextResponse.json({
    id: share.id,
    url: url.toString(),
  });
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const query = {
    replId: req.nextUrl.searchParams.get("replId") ?? undefined,
  };
  const parsed = listSharesQuerySchema.safeParse(query);
  if (!parsed.success) {
    console.warn("Invalid /api/shares query", {
      userId: session.user.id,
      issues: parsed.error.issues,
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const shares = await listSongShareSummaries({
    ownerUserId: session.user.id,
    replId: parsed.data.replId,
    limit: 50,
  });

  return NextResponse.json({
    shares: shares.map((share) => ({
      id: share.id,
      replId: share.replId,
      replName: share.replName,
      title: share.title,
      createdAt: share.createdAt,
      url: new URL(`/share/${share.id}`, req.nextUrl.origin).toString(),
    })),
  });
}
