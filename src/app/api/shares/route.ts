import { auth } from "@/lib/auth";
import {
  createSongShare,
  getLatestSongShareCreatedAt,
} from "@/services/song-share";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";

const MAX_CODE_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 200;
const MIN_TIME_BETWEEN_SHARES_MS = 60_000;

const createShareSchema = z.object({
  code: z.string().min(1).max(MAX_CODE_LENGTH),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH).optional(),
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
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("Invalid /api/shares payload", {
      userId: session.user.id,
      issues: parsed.error.issues,
    });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const latestCreatedAt = await getLatestSongShareCreatedAt(session.user.id);
  const now = Date.now();
  if (
    typeof latestCreatedAt === "number" &&
    now - latestCreatedAt < MIN_TIME_BETWEEN_SHARES_MS
  ) {
    const retryAfterSeconds = Math.ceil(
      (MIN_TIME_BETWEEN_SHARES_MS - (now - latestCreatedAt)) / 1000,
    );
    return NextResponse.json(
      {
        error:
          "Rate limit exceeded. Please wait before creating another share.",
      },
      {
        status: 429,
        headers: {
          "retry-after": retryAfterSeconds.toString(),
        },
      },
    );
  }

  const share = await createSongShare({
    ownerUserId: session.user.id,
    code: parsed.data.code,
    title: parsed.data.title ?? null,
  });

  const url = new URL(`/share/${share.id}`, req.nextUrl.origin);
  return NextResponse.json({
    id: share.id,
    url: url.toString(),
  });
}
