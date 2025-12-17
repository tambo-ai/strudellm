"use client";

import { JazzReactProvider } from "jazz-tools/react";
import { AuthProvider } from "jazz-tools/better-auth/auth/react";
import { authClient } from "./auth-client";
import { StrudelAccount } from "./jazz-schema";
import { PropsWithChildren } from "react";

// In development, use email as key (Jazz allows this for testing)
// In production, require a real Jazz API key from https://jazz.tools
const JAZZ_API_KEY = process.env.NEXT_PUBLIC_JAZZ_API_KEY;

// Only throw at runtime in the browser, not during build
if (typeof window !== "undefined" && !JAZZ_API_KEY) {
  throw new Error(
    "NEXT_PUBLIC_JAZZ_API_KEY is required. Get one at https://jazz.tools",
  );
}

export function JazzAndAuthProvider({ children }: PropsWithChildren) {
  // During build without env vars, render children without Jazz
  // This allows static generation to complete
  if (!JAZZ_API_KEY) {
    return <>{children}</>;
  }

  return (
    <JazzReactProvider
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`,
        when: "signedUp", // Only sync when user is logged in
      }}
      AccountSchema={StrudelAccount}
    >
      <AuthProvider betterAuthClient={authClient}>{children}</AuthProvider>
    </JazzReactProvider>
  );
}
