import type { BetterAuthPlugin } from "better-auth";

export const SONG_SHARE_TABLE = "song_share" as const;

export const SONG_SHARE_COLUMNS = {
  ownerUserId: "owner_user_id",
  createdAt: "created_at",
} as const;

export type SongShare = {
  id: string;
  ownerUserId: string;
  code: string;
  title: string | null;
  createdAt: number;
};

export const songSharePlugin = {
  id: "song-share",
  schema: {
    [SONG_SHARE_TABLE]: {
      fields: {
        ownerUserId: {
          type: "string",
          required: true,
          fieldName: SONG_SHARE_COLUMNS.ownerUserId,
          references: {
            model: "user",
            field: "id",
            onDelete: "cascade",
          },
          index: true,
        },
        code: {
          type: "string",
          required: true,
        },
        title: {
          type: "string",
          required: false,
        },
        createdAt: {
          type: "number",
          bigint: true,
          required: true,
          fieldName: SONG_SHARE_COLUMNS.createdAt,
        },
      },
    },
  },
} satisfies BetterAuthPlugin;
