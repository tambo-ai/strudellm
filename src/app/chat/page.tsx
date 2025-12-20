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
import { GenerationIndicator } from "@/components/tambo/generation-indicator";
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
import type { Suggestion } from "@tambo-ai/react";
import {
  TamboProvider,
  useTamboThread,
  useTamboThreadList,
  useTambo,
  useIsTamboTokenUpdating,
} from "@tambo-ai/react";
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
const bestEffortNonSecureId = (): string => {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    // Fallback to timestamp + random
    return `${Date.now()}-${Math.random()}`;
  }
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
function useContextKey({
  userId,
  isPending,
}: {
  userId: string | null;
  isPending: boolean;
}):
  | { contextKey: string; isReady: true }
  | { contextKey: null; isReady: false } {
  const [contextKey, setContextKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isPending) return;

    if (userId) {
      setContextKey(`strudel-user-${userId}`);
      return;
    }

    setContextKey(getOrCreateAnonymousContextKey());
  }, [isPending, userId]);

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
  const [showBetaModal, setShowBetaModal] = React.useState(false);
  const lastContextKeyRef = React.useRef<string | null>(null);
  const authIdentity = useAuthIdentity();
  const contextKeyState = useContextKey({
    userId: authIdentity.userId,
    isPending: authIdentity.isPending,
  });
  const isTamboTokenUpdating = useIsTamboTokenUpdating();
  // We intentionally wait for Better Auth identity to settle AND Tambo token exchange to complete
  // before querying threads, to avoid 401 errors from API calls made before auth is ready.
  const contextKeyAndIdentityReady =
    contextKeyState.isReady && !authIdentity.isPending && !isTamboTokenUpdating;
  const { isPending } = useLoadingState();
  const {
    isReady: strudelIsReady,
    setIsAiUpdating,
  } = useStrudel();
  const { thread, startNewThread, switchCurrentThread, isIdle } =
    useTamboThread();
  const { generationStage } = useTambo();

  const isGenerating =
    !isIdle && generationStage !== "IDLE" && generationStage !== "COMPLETE";

  // Only query thread list when auth is fully ready
  const readyContextKey = contextKeyAndIdentityReady
    ? contextKeyState.contextKey
    : undefined;
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList(
    { contextKey: readyContextKey },
    { enabled: contextKeyAndIdentityReady },
  );

  // Track AI generation state to lock editor during updates
  React.useEffect(() => {
    setIsAiUpdating(isGenerating);
  }, [isGenerating, setIsAiUpdating]);

  // Show beta modal on first login
  React.useEffect(() => {
    const userId = authIdentity.userId;
    if (userId && !localStorage.getItem(BETA_MODAL_SHOWN_KEY)) {
      setShowBetaModal(true);
      localStorage.setItem(BETA_MODAL_SHOWN_KEY, "true");
    }
  }, [authIdentity.userId]);

  // REPL initialization is now handled by StrudelStorageSync
  // No need for explicit initialization here with single-REPL model

  // Initialize: select most recent thread or create new
  React.useEffect(() => {
    if (!strudelIsReady || !threadListLoaded || threadInitialized) return;

    const existingThreads = threadList?.items ?? [];
    if (existingThreads.length > 0) {
      switchCurrentThread(existingThreads[0].id, true);
    } else {
      startNewThread();
    }
    setThreadInitialized(true);
  }, [
    strudelIsReady,
    threadListLoaded,
    threadInitialized,
    threadList,
    switchCurrentThread,
    startNewThread,
  ]);

  // Reset thread initialization when context key changes (e.g., login/logout)
  React.useEffect(() => {
    if (!contextKeyState.isReady) return;

    const currentKey = contextKeyState.contextKey;
    if (lastContextKeyRef.current !== null && lastContextKeyRef.current !== currentKey) {
      setThreadInitialized(false);
    }
    lastContextKeyRef.current = currentKey;
  }, [contextKeyState]);

  // Thread/REPL association is no longer needed with single-REPL model
  // All threads share the same REPL code

  // Wait for auth and context key to be fully ready before rendering UI
  if (!contextKeyAndIdentityReady) {
    return <LoadingScreen />;
  }

  if (isPending || !strudelIsReady || !thread) {
    return <LoadingScreen />;
  }

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
            <GenerationIndicator isGenerating={isGenerating} />
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
    <LoadingContextProvider>
      <StrudelProvider>
        <StrudelStorageSync />
        <TamboAuthedProvider apiKey={apiKey}>
          <AppContent />
        </TamboAuthedProvider>
      </StrudelProvider>
    </LoadingContextProvider>
  );
}

function TamboAuthedProvider({
  apiKey,
  children,
}: {
  apiKey: string;
  children: React.ReactNode;
}) {
  const { isPending, userId, userToken } = useAuthIdentity();

  if (process.env.NODE_ENV !== "production" && userId && !userToken) {
    console.warn("TamboAuthedProvider: userId present but userToken missing");
  }

  // Wait for Better Auth session to be fully resolved before initializing TamboProvider.
  // This prevents 401 errors from attempting token exchange with an undefined/stale token.
  if (isPending) {
    return <LoadingScreen />;
  }

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
