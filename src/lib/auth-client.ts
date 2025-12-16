"use client";

import { createAuthClient, type BetterFetchPlugin } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { jazzPluginClient } from "jazz-tools/better-auth/auth/client";
import { useStore } from "@nanostores/react";

/**
 * Custom fetch plugin to add Jazz auth header for magic link verification.
 * The jazz-tools plugin doesn't include /magic-link/verify in its SIGNUP_URLS,
 * so we need to add this ourselves to ensure the x-jazz-auth header is sent
 * when creating new users via magic link.
 */
const magicLinkJazzPlugin: BetterFetchPlugin = {
  id: "magic-link-jazz",
  name: "magic-link-jazz",
  hooks: {
    async onRequest(context) {
      if (context.url.toString().includes("/magic-link/verify")) {
        // Get Jazz credentials from localStorage (same storage jazz-tools uses)
        const stored = localStorage.getItem("jazz-logged-in-secret");
        if (stored) {
          try {
            const credentials = JSON.parse(stored);
            context.headers.set(
              "x-jazz-auth",
              JSON.stringify({
                accountID: credentials.accountID,
                secretSeed: credentials.secretSeed,
                accountSecret: credentials.accountSecret,
              }),
            );
          } catch (e) {
            console.error(
              "Failed to parse Jazz credentials for magic link:",
              e,
            );
          }
        }
      }
    },
  },
};

// Create the base auth client for Jazz integration
export const authClient = createAuthClient({
  plugins: [jazzPluginClient(), magicLinkClient()],
  fetchOptions: {
    plugins: [magicLinkJazzPlugin],
  },
});

// Re-export auth methods
export const { signIn, signOut } = authClient;

// Create a React hook for useSession since we're using the client version
// authClient.useSession is a nanostore Atom, so we wrap it with useStore
export function useSession() {
  return useStore(authClient.useSession);
}
