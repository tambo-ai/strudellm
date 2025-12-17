import "server-only";

import { randomUUID } from "crypto";

import { getPostgresPool, waitForDatabase } from "@/lib/auth";
import {
  SONG_SHARE_COLUMNS,
  SONG_SHARE_TABLE,
  type SongShare,
  type SongShareSummary,
} from "@/lib/song-share-schema";

export type { SongShare, SongShareSummary } from "@/lib/song-share-schema";

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
  replId: string;
  replName?: string | null;
  code: string;
  title?: string | null;
}): Promise<SongShare> {
  const share: SongShare = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    replId: input.replId,
    replName: input.replName ?? null,
    code: input.code,
    title: input.title ?? null,
    createdAt: Date.now(),
  };

  const pool = await getSongSharePool();
  await pool.query(
    `INSERT INTO ${SONG_SHARE_TABLE} (id, ${SONG_SHARE_COLUMNS.ownerUserId}, ${SONG_SHARE_COLUMNS.replId}, ${SONG_SHARE_COLUMNS.replName}, code, title, ${SONG_SHARE_COLUMNS.createdAt}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      share.id,
      share.ownerUserId,
      share.replId,
      share.replName,
      share.code,
      share.title,
      share.createdAt,
    ],
  );
  return share;
}

export async function getSongShare(shareId: string): Promise<SongShare | null> {
  const pool = await getSongSharePool();
  const result = await pool.query(
    `SELECT id, ${SONG_SHARE_COLUMNS.ownerUserId}, ${SONG_SHARE_COLUMNS.replId}, ${SONG_SHARE_COLUMNS.replName}, code, title, ${SONG_SHARE_COLUMNS.createdAt} FROM ${SONG_SHARE_TABLE} WHERE id = $1 LIMIT 1`,
    [shareId],
  );

  const row = result.rows[0] as
    | {
        id: string;
        owner_user_id: string;
        repl_id: string | null;
        repl_name: string | null;
        code: string;
        title: string | null;
        created_at: string | number;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    replId: row.repl_id,
    replName: row.repl_name,
    code: row.code,
    title: row.title,
    createdAt: Number(row.created_at),
  };
}

export async function listSongShareSummaries(input: {
  ownerUserId: string;
  replId?: string;
  limit?: number;
}): Promise<SongShareSummary[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const pool = await getSongSharePool();
  const result = input.replId
    ? await pool.query(
        `SELECT id, ${SONG_SHARE_COLUMNS.replId}, ${SONG_SHARE_COLUMNS.replName}, title, ${SONG_SHARE_COLUMNS.createdAt}
         FROM ${SONG_SHARE_TABLE}
         WHERE ${SONG_SHARE_COLUMNS.ownerUserId} = $1 AND ${SONG_SHARE_COLUMNS.replId} = $2
         ORDER BY ${SONG_SHARE_COLUMNS.createdAt} DESC
         LIMIT $3`,
        [input.ownerUserId, input.replId, limit],
      )
    : await pool.query(
        `SELECT id, ${SONG_SHARE_COLUMNS.replId}, ${SONG_SHARE_COLUMNS.replName}, title, ${SONG_SHARE_COLUMNS.createdAt}
         FROM ${SONG_SHARE_TABLE}
         WHERE ${SONG_SHARE_COLUMNS.ownerUserId} = $1
         ORDER BY ${SONG_SHARE_COLUMNS.createdAt} DESC
         LIMIT $2`,
        [input.ownerUserId, limit],
      );

  return (result.rows as Array<Record<string, unknown>>).map((row) => {
    const typed = row as {
      id: string;
      repl_id: string | null;
      repl_name: string | null;
      title: string | null;
      created_at: string | number;
    };
    return {
      id: typed.id,
      replId: typed.repl_id,
      replName: typed.repl_name,
      title: typed.title,
      createdAt: Number(typed.created_at),
    };
  });
}
