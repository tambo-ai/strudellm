import { auth } from "@/lib/auth";
import { createSongShare } from "@/services/song-share";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";

const createShareSchema = z.object({
  code: z.string().min(1),
  title: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const parsed = createShareSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
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
