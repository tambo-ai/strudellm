"use client";

import { signIn } from "@/lib/auth-client";
import { X, Loader2, Mail, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn.magicLink({
        email,
        callbackURL: "/",
      });
      if (result.error) {
        setError(result.error.message || "Failed to send magic link");
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        {sent ? (
          <>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">
              Check your email
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              We sent a magic link to <strong>{email}</strong>. Click the link
              to sign in.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center mb-4">
              <Mail className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-center">Sign in</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Enter your email to receive a magic link
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send magic link
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              No password needed. We&apos;ll email you a link to sign in.
            </p>
          </>
        )}
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
