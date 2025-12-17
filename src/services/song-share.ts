import "server-only";

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { Pool } from "pg";

export type SongShare = {
  id: string;
  ownerUserId: string;
  code: string;
  title: string | null;
  createdAt: number;
};

type DbClient =
  | { kind: "postgres"; pool: Pool }
  | { kind: "sqlite"; db: Database.Database };

const databaseUrl = process.env.DATABASE_URL;

let dbClient: DbClient | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function getDbClient(): DbClient {
  if (dbClient) return dbClient;

  if (databaseUrl && databaseUrl.startsWith("postgres")) {
    dbClient = {
      kind: "postgres",
      pool: new Pool({
        connectionString: databaseUrl,
        max: 5,
      }),
    };
    return dbClient;
  }

  dbClient = {
    kind: "sqlite",
    // Mirror Better Auth's local dev DB path.
    db: new Database("./auth.db"),
  };
  return dbClient;
}

async function ensureSchema(): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const client = getDbClient();
    if (client.kind === "postgres") {
      await client.pool.query(`
        CREATE TABLE IF NOT EXISTS song_share (
          id text PRIMARY KEY,
          owner_user_id text NOT NULL,
          code text NOT NULL,
          title text,
          created_at bigint NOT NULL
        );
      `);
      await client.pool.query(
        `CREATE INDEX IF NOT EXISTS song_share_owner_user_id_idx ON song_share(owner_user_id);`,
      );
      return;
    }

    client.db
      .prepare(
        `
          CREATE TABLE IF NOT EXISTS song_share (
            id text PRIMARY KEY,
            owner_user_id text NOT NULL,
            code text NOT NULL,
            title text,
            created_at integer NOT NULL
          );
        `,
      )
      .run();
    client.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS song_share_owner_user_id_idx ON song_share(owner_user_id);`,
      )
      .run();
  })();

  return schemaReadyPromise;
}

export async function createSongShare(input: {
  ownerUserId: string;
  code: string;
  title?: string | null;
}): Promise<SongShare> {
  await ensureSchema();

  const share: SongShare = {
    id: randomUUID(),
    ownerUserId: input.ownerUserId,
    code: input.code,
    title: input.title ?? null,
    createdAt: Date.now(),
  };

  const client = getDbClient();
  if (client.kind === "postgres") {
    await client.pool.query(
      `INSERT INTO song_share (id, owner_user_id, code, title, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [share.id, share.ownerUserId, share.code, share.title, share.createdAt],
    );
    return share;
  }

  client.db
    .prepare(
      `INSERT INTO song_share (id, owner_user_id, code, title, created_at) VALUES (@id, @ownerUserId, @code, @title, @createdAt)`,
    )
    .run({
      id: share.id,
      ownerUserId: share.ownerUserId,
      code: share.code,
      title: share.title,
      createdAt: share.createdAt,
    });
  return share;
}

export async function getSongShare(shareId: string): Promise<SongShare | null> {
  await ensureSchema();

  const client = getDbClient();
  if (client.kind === "postgres") {
    const result = await client.pool.query(
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

  const row = client.db
    .prepare(
      `SELECT id, owner_user_id as ownerUserId, code, title, created_at as createdAt FROM song_share WHERE id = ? LIMIT 1`,
    )
    .get(shareId) as
    | {
        id: string;
        ownerUserId: string;
        code: string;
        title: string | null;
        createdAt: number;
      }
    | undefined;
  return row ?? null;
}
