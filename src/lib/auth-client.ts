"use client";

import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { useStore } from "@nanostores/react";

// Create the auth client with magic link support
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

// Re-export auth methods
export const { signIn, signOut } = authClient;

// Create a React hook for useSession since we're using the client version
// authClient.useSession is a nanostore Atom, so we wrap it with useStore
export function useSession() {
  return useStore(authClient.useSession);
}
