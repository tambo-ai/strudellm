import "server-only";

import { randomUUID } from "crypto";

import { getPostgresPool, waitForDatabase } from "@/lib/auth";

export type SongShare = {
  id: string;
  ownerUserId: string;
  code: string;
  title: string | null;
  createdAt: number;
};

export async function getLatestSongShareCreatedAt(
  ownerUserId: string,
): Promise<number | null> {
  await waitForDatabase();

  const pool = getPostgresPool();
  const result = await pool.query(
    `SELECT created_at FROM song_share WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [ownerUserId],
  );
  const row = result.rows[0] as { created_at: string | number } | undefined;
  return row ? Number(row.created_at) : null;
}

export async function createSongShare(input: {
  ownerUserId: string;
  code: string;
  title?: string | null;
}): Promise<SongShare> {
  await waitForDatabase();

  const share: SongShare = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    code: input.code,
    title: input.title ?? null,
    createdAt: Date.now(),
  };

  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO song_share (id, owner_user_id, code, title, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [share.id, share.ownerUserId, share.code, share.title, share.createdAt],
  );
  return share;
}

export async function getSongShare(shareId: string): Promise<SongShare | null> {
  await waitForDatabase();

  const pool = getPostgresPool();
  const result = await pool.query(
    `SELECT id, owner_user_id, code, title, created_at FROM song_share WHERE id = $1 LIMIT 1`,
    [shareId],
  );
  const row = result.rows[0] as
    | {
        id: string;
        owner_user_id: string;
        code: string;
        title: string | null;
        created_at: string | number;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    code: row.code,
    title: row.title,
    createdAt: Number(row.created_at),
  };
}
