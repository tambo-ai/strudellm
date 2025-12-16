"use client";

import { JazzReactProvider } from "jazz-tools/react";
import { AuthProvider } from "jazz-tools/better-auth/auth/react";
import { authClient } from "./auth-client";
import { StrudelAccount } from "./jazz-schema";
import { PropsWithChildren } from "react";

const JAZZ_API_KEY =
  process.env.NEXT_PUBLIC_JAZZ_API_KEY || "you@example.com";

export function JazzAndAuthProvider({ children }: PropsWithChildren) {
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
