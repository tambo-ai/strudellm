"use client";

import { signOut, useSession } from "@/lib/auth-client";
import { LogIn, LogOut, User, Loader2 } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <User className="w-3 h-3" />
          {session.user.email}
        </span>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-backdrop rounded-md transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-backdrop rounded-md transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Sign in to sync
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
