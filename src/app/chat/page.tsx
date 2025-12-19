"use client";

import {
  MessageInput,
  MessageInputError,
  MessageInputNewThreadButton,
  MessageInputSubmitButton,
  MessageInputTextarea,
  MessageInputToolbar,
} from "@/components/tambo/message-input";
import {
  MessageSuggestions,
  MessageSuggestionsList,
} from "@/components/tambo/message-suggestions";
import { ScrollableMessageContainer } from "@/components/tambo/scrollable-message-container";
import {
  ThreadContent,
  ThreadContentMessages,
} from "@/components/tambo/thread-content";
import {
  ThreadHistory,
  ThreadHistoryHeader,
  ThreadHistoryNewButton,
  ThreadHistorySearch,
  ThreadHistoryList,
} from "@/components/tambo/thread-history";
import { StrudelRepl } from "@/strudel/components/strudel-repl";
import { LoadingScreen } from "@/components/loading/loading-screen";
import { ApiKeyMissing } from "@/components/api-key-missing";

import { StrudelStorageSync } from "@/components/strudel-storage-sync";
import { components, tools } from "@/lib/tambo";
import { LoadingContextProvider } from "@/components/loading/context";
import { JazzAndAuthProvider } from "@/lib/providers";
import type { Suggestion } from "@tambo-ai/react";
import {
  TamboProvider,
  useTamboThread,
  useTamboThreadList,
  useTambo,
} from "@tambo-ai/react";
import { useIsAuthenticated } from "jazz-tools/react";
import * as React from "react";
import { Frame } from "@/components/layout/frame";
import { Main } from "@/components/layout/main";
import { Sidebar, SidebarContent } from "@/components/layout/sidebar";
import { useLoadingContext as useLoadingState } from "@/components/loading/context";
import {
  StrudelProvider,
  useStrudel,
} from "@/strudel/context/strudel-provider";
import { StrudelStatusBar } from "@/strudel/components/strudel-status-bar";
import { StrudelService } from "@/strudel/lib/service";
import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { BetaModal } from "@/components/beta-modal";
import { useSession } from "@/lib/auth-client";

const BETA_MODAL_SHOWN_KEY = "strudel-beta-modal-shown-v1";

// Tambo context helpers docs: https://docs.tambo.co/concepts/additional-context/configuration
// Exposes current Strudel REPL code + error state to the AI.
// This lets the model respond based on the live editor state (e.g., surfacing errors and suggesting fixes).
// The returned object should stay small, JSON-serializable, and must not include secrets or sensitive
// user data (it is sent to the Tambo backend as additional model context).
// Note: The `instruction` below assumes the `updateRepl` tool can safely overwrite the REPL with corrected
// code for any error surfaced here. If `updateRepl` behavior changes, update this helper and tool docs together.
const strudelContextHelper = () => {
  const service = StrudelService.instance();
  const state = service.getReplState();

  const evalError = state?.evalError;
  const schedulerError = state?.schedulerError;
  const missingSample = state?.missingSample;

  // Format error message if present
  let errorMessage: string | null = null;
  if (evalError) {
    errorMessage =
      typeof evalError === "string" ? evalError : evalError.message;
  } else if (schedulerError) {
    errorMessage =
      typeof schedulerError === "string"
        ? schedulerError
        : schedulerError.message;
  }

  return {
    currentCode: state?.code ?? "",
    isPlaying: state?.started ?? false,
    // Include error info so AI knows when something is broken
    error: errorMessage,
    missingSample: missingSample ?? null,
    // Instruction for AI: if there's an error, use updateRepl to fix it
    instruction: errorMessage
      ? "There is an error in the current code. Use the updateRepl tool with corrected code to fix it, then explain to the user what you did."
      : null,
  };
};

// Storage key for anonymous context
const ANON_CONTEXT_KEY_STORAGE = "strudel-ai-context-key";

const safeLocalStorageGetItem = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to read localStorage item", { key, error });
    }
    return null;
  }
};

const safeLocalStorageSetItem = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to write localStorage item", { key, error });
    }
    // Best-effort only; ignore storage failures (private browsing, quota, etc.)
  }
};

// Best-effort opaque ID generation.
// Uses crypto APIs when available, but must never be used for auth/session/security tokens.
// Return value is an opaque UUID-like string.
let nonSecureCounter = 0;
let loggedRandomUuidFailure = false;
let loggedGetRandomValuesFailure = false;

// Formats 16 bytes into a UUID-like opaque string.
// Input bytes may be non-cryptographic and must not be used for any security-sensitive purpose.
const bytesToOpaqueUuidLikeString = (bytes: Uint8Array): string => {
  const b = bytes.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = Array.from(b)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const bestEffortNonSecureId = (): string => {
  try {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid;
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && !loggedRandomUuidFailure) {
      loggedRandomUuidFailure = true;
      console.warn("bestEffortNonSecureId: randomUUID failed", error);
    }
  }

  try {
    const crypto = globalThis.crypto;
    if (crypto?.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return bytesToOpaqueUuidLikeString(bytes);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && !loggedGetRandomValuesFailure) {
      loggedGetRandomValuesFailure = true;
      console.warn("bestEffortNonSecureId: getRandomValues failed", error);
    }
  }

  nonSecureCounter = (nonSecureCounter + 1) % Number.MAX_SAFE_INTEGER;
  const counter32 = nonSecureCounter >>> 0;
  const now32 = Date.now() >>> 0;

  const bytes = new Uint8Array(16);
  bytes[0] = counter32 & 0xff;
  bytes[1] = (counter32 >>> 8) & 0xff;
  bytes[2] = (counter32 >>> 16) & 0xff;
  bytes[3] = (counter32 >>> 24) & 0xff;
  bytes[4] = now32 & 0xff;
  bytes[5] = (now32 >>> 8) & 0xff;
  bytes[6] = (now32 >>> 16) & 0xff;
  bytes[7] = (now32 >>> 24) & 0xff;
  for (let i = 8; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytesToOpaqueUuidLikeString(bytes);
};

// Get or create anonymous context key (for users not logged in)
// Anonymous context key semantics:
// - Stored only in localStorage under ANON_CONTEXT_KEY_STORAGE.
// - Used solely to group Tambo threads within this browser profile.
// - Not coupled to any auth identity and may be cleared at any time (e.g., clearing site data),
//   which will start a fresh anonymous thread space.
const getOrCreateAnonymousContextKey = (): string | null => {
  if (typeof window === "undefined") return null;

  const existing = safeLocalStorageGetItem(ANON_CONTEXT_KEY_STORAGE);
  if (existing) return existing;

  const contextKey = `strudel-ai-anon-${bestEffortNonSecureId()}`;
  safeLocalStorageSetItem(ANON_CONTEXT_KEY_STORAGE, contextKey);
  return contextKey;
};

function useAuthIdentity() {
  const { data: sessionData, isPending } = useSession();
  const userId = sessionData?.user?.id ?? null;
  const userToken = sessionData?.session?.token ?? null;

  if (process.env.NODE_ENV !== "production") {
    if (userToken && !userId) {
      console.warn("Auth identity mismatch: userToken present but userId missing");
    }

    if (userId && !userToken) {
      console.warn("Auth identity mismatch: userId present but userToken missing");
    }
  }

  return { isPending, userId, userToken };
}

// Hook to get a stable context key for Tambo thread scoping.
// - Authenticated users: Better Auth user id (stable across devices)
// - Anonymous users: persistent per-browser id stored in localStorage
// Changing this value changes which threads are visible in the UI.
// NOTE: This is not an auth token. Do not use this value for permissions or other security decisions.
// This hook assumes it only runs in the browser (client components).
function useContextKey():
  | { contextKey: string; isReady: true }
  | { contextKey: null; isReady: false } {
  const { isPending: isIdentityPending, userId } = useAuthIdentity();
  const [contextKey, setContextKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isIdentityPending) return;

    if (userId) {
      setContextKey(`strudel-user-${userId}`);
      return;
    }

    setContextKey(getOrCreateAnonymousContextKey());
  }, [isIdentityPending, userId]);

  if (contextKey) {
    return { contextKey, isReady: true };
  }

  return { contextKey: null, isReady: false };
}

const strudelSuggestions: Suggestion[] = [
  {
    id: "suggestion-1",
    title: "Simple beat",
    detailedSuggestion: "Create a simple drum beat with kick and snare",
    messageId: "simple-beat",
  },
  {
    id: "suggestion-2",
    title: "Melody",
    detailedSuggestion: "Generate a melodic pattern using notes and chords",
    messageId: "melody",
  },
  {
    id: "suggestion-3",
    title: "Ambient",
    detailedSuggestion: "Create an ambient atmospheric soundscape",
    messageId: "ambient",
  },
];

function AppContent() {
  const [threadInitialized, setThreadInitialized] = React.useState(false);
  const [replInitialized, setReplInitialized] = React.useState(false);
  const [showBetaModal, setShowBetaModal] = React.useState(false);
  const lastContextKeyRef = React.useRef<string | null>(null);
  const authIdentity = useAuthIdentity();
  const contextKeyState = useContextKey();
  const identityReady = contextKeyState.isReady && !authIdentity.isPending;
  const { isPending } = useLoadingState();
  const isAuthenticated = useIsAuthenticated();
  const {
    isReady: strudelIsReady,
    setThreadId,
    currentReplId,
    setReplId,
    initializeRepl,
    setIsAiUpdating,
  } = useStrudel();
  // Use storage hook directly for reactive isLoaded and isAuthenticated state
  const {
    isLoaded: isStorageLoaded,
    attachThreadToRepl,
    getThreadReplId,
    isReplArchived,
    unarchiveRepl,
  } = useStrudelStorage();
  const { thread, startNewThread, switchCurrentThread, isIdle } =
    useTamboThread();
  const { generationStage } = useTambo();
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList(
    { contextKey: identityReady ? contextKeyState.contextKey : undefined },
    { enabled: identityReady },
  );

  React.useEffect(() => {
    if (!identityReady) return;
    if (lastContextKeyRef.current === contextKeyState.contextKey) return;
    lastContextKeyRef.current = contextKeyState.contextKey;
    // Context key changes imply a user identity change (login/logout). Reset per-thread initialization
    // so we re-select/create threads under the new scope.
    setThreadInitialized(false);
  }, [identityReady, contextKeyState.contextKey]);

  // Track AI generation state to lock editor during updates
  React.useEffect(() => {
    // Show overlay when AI is actively working (not idle and in a generation stage)
    const isGenerating =
      !isIdle && generationStage !== "IDLE" && generationStage !== "COMPLETE";
    setIsAiUpdating(isGenerating);
  }, [isIdle, generationStage, setIsAiUpdating]);

  // Show beta modal on first login
  React.useEffect(() => {
    if (isAuthenticated && !localStorage.getItem(BETA_MODAL_SHOWN_KEY)) {
      setShowBetaModal(true);
      localStorage.setItem(BETA_MODAL_SHOWN_KEY, "true");
    }
  }, [isAuthenticated]);

  // Initialize REPL on startup - wait for storage to be loaded (Jazz synced)
  React.useEffect(() => {
    if (!strudelIsReady || !isStorageLoaded || replInitialized) return;
    initializeRepl();
    setReplInitialized(true);
  }, [strudelIsReady, isStorageLoaded, replInitialized, initializeRepl]);

  // Initialize: select most recent thread or create new
  React.useEffect(() => {
    if (!identityReady || !strudelIsReady || !threadListLoaded || threadInitialized)
      return;

    const existingThreads = threadList?.items ?? [];
    if (existingThreads.length > 0) {
      switchCurrentThread(existingThreads[0].id, true);
    } else {
      startNewThread();
    }
    setThreadInitialized(true);
  }, [
    identityReady,
    strudelIsReady,
    threadListLoaded,
    threadInitialized,
    threadList,
    switchCurrentThread,
    startNewThread,
  ]);

  // Sync thread ID to Strudel service
  React.useEffect(() => {
    if (thread) {
      setThreadId(thread.id);
    }
  }, [thread, setThreadId]);

  // Attach thread to current REPL only if thread doesn't already have a REPL association
  // This prevents overwriting existing associations when switching tabs
  React.useEffect(() => {
    if (thread && currentReplId) {
      const existingReplId = getThreadReplId(thread.id);
      if (!existingReplId) {
        // Thread is new/unassociated - attach it to the current REPL
        attachThreadToRepl(thread.id, currentReplId);
      }
    }
  }, [thread, currentReplId, getThreadReplId, attachThreadToRepl]);

  // Unarchive REPL when switching to a thread that's associated with an archived REPL
  // This brings the REPL back into the tabs when opening its associated chat
  React.useEffect(() => {
    if (thread) {
      const replId = getThreadReplId(thread.id);
      if (replId && isReplArchived(replId)) {
        unarchiveRepl(replId);
        // Also switch to that REPL
        setReplId(replId);
      }
    }
  }, [thread, getThreadReplId, isReplArchived, unarchiveRepl, setReplId]);

  if (!contextKeyState.isReady) {
    return <LoadingScreen />;
  }

  if (isPending || !strudelIsReady || !thread) {
    return <LoadingScreen />;
  }

  const readyContextKey = contextKeyState.contextKey;

  return (
    <Frame>
      <Sidebar>
        <Main>
          <StrudelRepl />
          <StrudelStatusBar />
        </Main>

        <SidebarContent>
          {/* Messages */}
          <ScrollableMessageContainer className="flex-1 p-3">
            <ThreadContent>
              <ThreadContentMessages />
            </ThreadContent>
          </ScrollableMessageContainer>

          {/* Suggestions */}
          <MessageSuggestions initialSuggestions={strudelSuggestions}>
            <div className="px-3 pb-2">
              <MessageSuggestionsList />
            </div>
          </MessageSuggestions>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <MessageInput contextKey={readyContextKey}>
              <MessageInputTextarea placeholder=">" />
              <MessageInputToolbar>
                <MessageInputNewThreadButton />
                <MessageInputSubmitButton />
              </MessageInputToolbar>
              <MessageInputError />
            </MessageInput>
          </div>
        </SidebarContent>
      </Sidebar>

      {/* Thread History Sidebar */}
      <ThreadHistory
        contextKey={readyContextKey}
        position="right"
        defaultCollapsed={true}
      >
        <ThreadHistoryHeader />
        <ThreadHistoryNewButton />
        <ThreadHistorySearch />
        <ThreadHistoryList />
      </ThreadHistory>

      {/* Beta Modal */}
      {showBetaModal && <BetaModal onClose={() => setShowBetaModal(false)} />}
    </Frame>
  );
}

export default function ChatPage() {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY;

  if (!apiKey) {
    return <ApiKeyMissing />;
  }

  return (
    <JazzAndAuthProvider>
      <LoadingContextProvider>
        <StrudelProvider>
          <StrudelStorageSync />
          <TamboAuthedProvider apiKey={apiKey}>
            <AppContent />
          </TamboAuthedProvider>
        </StrudelProvider>
      </LoadingContextProvider>
    </JazzAndAuthProvider>
  );
}

function TamboAuthedProvider({
  apiKey,
  children,
}: {
  apiKey: string;
  children: React.ReactNode;
}) {
  const { userToken } = useAuthIdentity();

  return (
    <TamboProvider
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      apiKey={apiKey}
      // Better Auth session token, exchanged by Tambo for a Tambo session token.
      userToken={userToken ?? undefined}
      tools={tools}
      components={components}
      contextHelpers={{
        strudelState: strudelContextHelper,
      }}
    >
      {children}
    </TamboProvider>
  );
}
