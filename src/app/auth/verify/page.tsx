"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const callbackURL = searchParams.get("callbackURL") || "/";

    if (!token) {
      setStatus("error");
      setError("Missing verification token");
      return;
    }

    // Build Jazz auth header from stored credentials
    const headers: Record<string, string> = {};
    const stored = localStorage.getItem("jazz-logged-in-secret");
    if (stored) {
      try {
        const credentials = JSON.parse(stored);
        headers["x-jazz-auth"] = JSON.stringify({
          accountID: credentials.accountID,
          secretSeed: credentials.secretSeed,
          accountSecret: credentials.accountSecret,
        });
      } catch (e) {
        console.error("Failed to parse Jazz credentials:", e);
      }
    }

    // Use authClient.$fetch directly with GET method to ensure correct request
    authClient
      .$fetch(
        `/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callbackURL)}`,
        {
          method: "GET",
          headers,
        },
      )
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setStatus("error");
          setError(fetchError.message || "Verification failed");
        } else {
          setStatus("success");
          // Redirect after a brief delay to show success state
          setTimeout(() => {
            router.push(callbackURL);
          }, 1000);
        }
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Verification failed");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        {status === "verifying" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Verifying...</h1>
            <p className="text-muted-foreground">
              Please wait while we sign you in.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Success!</h1>
            <p className="text-muted-foreground">
              You&apos;re signed in. Redirecting...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Verification Failed</h1>
            <p className="text-muted-foreground mb-4">
              {error || "Something went wrong"}
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
