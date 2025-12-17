import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import Database from "better-sqlite3";
import { jazzPlugin } from "jazz-tools/better-auth/auth/server";
import { Resend } from "resend";
import { Pool } from "pg";
import { PostgresDialect } from "kysely";
import { getMigrations } from "better-auth/db";

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;
const resendSegmentId = process.env.RESEND_SEGMENT;

// Only initialize Resend in production when API key is available
const resend =
  isProduction && process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

async function addUserToResendSegment(email: string | null | undefined) {
  if (!email || !resend || !resendSegmentId) return;

  try {
    // Ensure contact exists and is attached to the target segment
    await resend.contacts.create({ email });
    await resend.contacts.segments.add({
      email,
      segmentId: resendSegmentId,
    });
  } catch (error) {
    console.error("Failed to add user to Resend segment", error);
  }
}

let migrationsPromise: Promise<void> | null = null;
let schemaPatchPromise: Promise<void> | null = null;

async function ensureMigrations(dialect: PostgresDialect) {
  if (migrationsPromise) return migrationsPromise;
  const { runMigrations } = await getMigrations({
    database: { dialect, type: "postgres" },
  });
  migrationsPromise = runMigrations();
  return migrationsPromise;
}

async function ensureJazzColumns(pool: Pool) {
  if (schemaPatchPromise) return schemaPatchPromise;
  schemaPatchPromise = (async () => {
    try {
      await pool.query(
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "accountID" text',
      );
      await pool.query(
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "encryptedCredentials" text',
      );
    } catch (error) {
      console.error("Failed to ensure Jazz columns on user table", error);
    }
  })();
  return schemaPatchPromise;
}

// Track if database is ready for use
let dbReadyPromise: Promise<void> | null = null;

function getDatabaseConfig() {
  // Prefer Postgres when a DATABASE_URL is provided
  if (databaseUrl && databaseUrl.startsWith("postgres")) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
    });
    const dialect = new PostgresDialect({ pool });

    // Run Better Auth migrations once (creates user/session tables)
    // Store the promise so we can await it if needed before auth operations
    dbReadyPromise = ensureMigrations(dialect).then(() =>
      ensureJazzColumns(pool),
    );

    return {
      dialect,
      type: "postgres",
    };
  }

  // Fallback to local SQLite for development (not persisted in prod)
  return new Database("./auth.db");
}

/**
 * Wait for database migrations to complete.
 * Call this before performing auth operations that require the schema to be ready.
 */
export async function waitForDatabase(): Promise<void> {
  if (dbReadyPromise) {
    await dbReadyPromise;
  }
}

export const auth = betterAuth({
  database: getDatabaseConfig(),
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await addUserToResendSegment(createdUser.email);
        },
      },
    },
  },
  plugins: [
    jazzPlugin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Transform the API verification URL to our custom client-side verification page
        // Original: /api/auth/magic-link/verify?token=xxx&callbackURL=/
        // New: /auth/verify?token=xxx&callbackURL=/
        const parsedUrl = new URL(url);
        const token = parsedUrl.searchParams.get("token");
        const callbackURL = parsedUrl.searchParams.get("callbackURL") || "/";

        // Build the custom verification URL that handles verification client-side
        // This ensures the x-jazz-auth header is sent with the verification request
        const customUrl = `${parsedUrl.origin}/auth/verify?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Sign in to Strudel LM</h1>
            <p>Click the button below to sign in to your account:</p>
            <a href="${customUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">
              Sign In
            </a>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this email, you can safely ignore it.
            </p>
            <p style="color: #666; font-size: 12px;">
              Or copy and paste this link: ${customUrl}
            </p>
          </div>
        `;

        if (isProduction) {
          // Use Resend in production
          if (!resend) {
            throw new Error("RESEND_API_KEY is required in production");
          }
          await resend.emails.send({
            from:
              process.env.RESEND_EMAIL_FROM ||
              "Strudel LM <noreply@strudellm.com>",
            to: email,
            subject: "Sign in to Strudel LM",
            html: emailHtml,
          });
        } else {
          // In development, just log the magic link to console
          console.log(`\n🔗 Magic link for ${email}:\n${customUrl}\n`);
        }
      },
    }),
  ],
});
