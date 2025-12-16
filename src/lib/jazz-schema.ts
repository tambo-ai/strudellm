import { co, z } from "jazz-tools";

/**
 * A REPL represents a saved piece of Strudel code.
 * One REPL can have many Threads (conversations) attached to it.
 */
export const StrudelRepl = co.map({
  /** Unique ID for this REPL */
  id: z.string(),
  /** The Strudel code */
  code: z.string(),
  /** Optional name for the REPL */
  name: z.string().optional(),
  /** When the REPL was created */
  createdAt: z.number(),
  /** When the REPL was last updated */
  lastUpdated: z.number(),
});

export type StrudelRepl = co.loaded<typeof StrudelRepl>;

/**
 * Maps a Tambo thread ID to the REPL it belongs to.
 * This allows multiple threads to reference the same REPL.
 */
export const ThreadToRepl = co.map({
  /** The Tambo thread ID */
  threadId: z.string(),
  /** The REPL ID this thread is attached to */
  replId: z.string(),
});

export type ThreadToRepl = co.loaded<typeof ThreadToRepl>;

/**
 * Root data structure for each user account
 */
export const StrudelAccountRoot = co.map({
  /** All user's REPLs, keyed by REPL ID */
  repls: co.record(z.string(), StrudelRepl),
  /** Maps thread IDs to REPL IDs */
  threadToRepl: co.record(z.string(), z.string()),
  /** The currently active REPL ID */
  activeReplId: z.string().optional(),
});

export type StrudelAccountRoot = co.loaded<typeof StrudelAccountRoot>;

/**
 * Custom account schema for Strudel users
 */
export const StrudelAccount = co
  .account({
    root: StrudelAccountRoot,
    profile: co.profile(),
  })
  .withMigration(async (account) => {
    // Initialize root if it doesn't exist (new accounts)
    if (!account.root) {
      account.root = StrudelAccountRoot.create({
        repls: {},
        threadToRepl: {},
        activeReplId: undefined,
      });
    }
  });

export type StrudelAccount = co.loaded<typeof StrudelAccount>;
