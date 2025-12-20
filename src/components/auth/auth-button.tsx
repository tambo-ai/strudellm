"use client";

import { useSession } from "@/lib/auth-client";
import { LogIn, Loader2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "./auth-modal";

export function AuthButton() {
  const { data: session, isPending } = useSession();
  const [showModal, setShowModal] = useState(false);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground">
        <CheckCircle className="w-4 h-4 text-green-500" />
        on waitlist
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-backdrop rounded-md transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Get Early Access
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
