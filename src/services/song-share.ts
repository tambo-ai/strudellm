import "server-only";

import { randomUUID } from "crypto";

import { getPostgresPool, waitForDatabase } from "@/lib/auth";

import {
  SONG_SHARE_COLUMNS,
  SONG_SHARE_TABLE,
  type SongShare,
} from "@/lib/song-share-schema";

export type { SongShare } from "@/lib/song-share-schema";

async function getSongSharePool() {
  try {
    await waitForDatabase();
    return getPostgresPool();
  } catch (error) {
    console.error("Failed to initialize Postgres pool for song sharing", error);
    throw error;
  }
}

export async function getLatestSongShareCreatedAt(
  ownerUserId: string,
): Promise<number | null> {
  const pool = await getSongSharePool();
  const result = await pool.query(
    `SELECT ${SONG_SHARE_COLUMNS.createdAt} FROM ${SONG_SHARE_TABLE} WHERE ${SONG_SHARE_COLUMNS.ownerUserId} = $1 ORDER BY ${SONG_SHARE_COLUMNS.createdAt} DESC LIMIT 1`,
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
  const share: SongShare = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    code: input.code,
    title: input.title ?? null,
    createdAt: Date.now(),
  };

  const pool = await getSongSharePool();
  await pool.query(
    `INSERT INTO ${SONG_SHARE_TABLE} (id, ${SONG_SHARE_COLUMNS.ownerUserId}, code, title, ${SONG_SHARE_COLUMNS.createdAt}) VALUES ($1, $2, $3, $4, $5)`,
    [share.id, share.ownerUserId, share.code, share.title, share.createdAt],
  );
  return share;
}

export async function getSongShare(shareId: string): Promise<SongShare | null> {
  const pool = await getSongSharePool();
  const result = await pool.query(
    `SELECT id, ${SONG_SHARE_COLUMNS.ownerUserId}, code, title, ${SONG_SHARE_COLUMNS.createdAt} FROM ${SONG_SHARE_TABLE} WHERE id = $1 LIMIT 1`,
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
