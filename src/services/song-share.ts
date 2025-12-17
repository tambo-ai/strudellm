import "server-only";

import { randomUUID } from "crypto";
import { Pool } from "pg";

import { waitForDatabase } from "@/lib/auth";

export type SongShare = {
  id: string;
  ownerUserId: string;
  code: string;
  title: string | null;
  createdAt: number;
};

const databaseUrl = process.env.DATABASE_URL;

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required to persist song shares. Configure a Postgres database and set DATABASE_URL.",
    );
  }

  if (!databaseUrl.startsWith("postgres")) {
    throw new Error(
      "DATABASE_URL must be a Postgres connection string to persist song shares.",
    );
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
  });

  return pool;
}

export async function getLatestSongShareCreatedAt(
  ownerUserId: string,
): Promise<number | null> {
  await ensureSchema();

  const client = getDbClient();
  if (client.kind === "postgres") {
    const result = await client.pool.query(
      `SELECT created_at FROM song_share WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ownerUserId],
    );
    const row = result.rows[0] as { created_at: string | number } | undefined;
    return row ? Number(row.created_at) : null;
  }

  const row = client.db
    .prepare(
      `SELECT created_at as createdAt FROM song_share WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(ownerUserId) as { createdAt: number } | undefined;
  return row ? row.createdAt : null;
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

  const pool = getPool();
  await pool.query(
    `INSERT INTO song_share (id, owner_user_id, code, title, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [share.id, share.ownerUserId, share.code, share.title, share.createdAt],
  );
  return share;
}

export async function getSongShare(shareId: string): Promise<SongShare | null> {
  await waitForDatabase();

  const pool = getPool();
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
