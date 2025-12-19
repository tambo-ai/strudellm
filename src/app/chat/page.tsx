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
const AUTH_CONTEXT_KEY_STORAGE = "strudel-ai-auth-context-key";

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

// Best-effort ID generation. Not suitable for auth/session/security tokens.
let nonSecureCounter = 0;
const bestEffortNonSecureId = (): string => {
  try {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid;
  } catch {
    // Fall through
  }

  nonSecureCounter = (nonSecureCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now()}-${nonSecureCounter}-${Math.random().toString(16).slice(2)}`;
};

// Get or create anonymous context key (for users not logged in)
const getOrCreateAnonymousContextKey = (): string | null => {
  if (typeof window === "undefined") return null;

  const existing = safeLocalStorageGetItem(ANON_CONTEXT_KEY_STORAGE);
  if (existing) return existing;

  const contextKey = `strudel-ai-anon-${bestEffortNonSecureId()}`;
  safeLocalStorageSetItem(ANON_CONTEXT_KEY_STORAGE, contextKey);
  return contextKey;
};

// Hook to get a stable context key (persistent per-browser when logged in, anonymous otherwise).
// NOTE: This is *not* a user identifier and may be shared across different accounts using the same
// browser profile. Do not use this key for auth, permissions, or any security decisions.
// This hook assumes it only runs in the browser (client components).
function useContextKey():
  | { contextKey: string; isReady: true }
  | { contextKey: null; isReady: false } {
  const { isAuthenticated, isLoaded } = useStrudelStorage();
  const [contextKey, setContextKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isLoaded) return;

    if (isAuthenticated) {
      // For authenticated users, we use a separate persistent key
      // that gets created once and stored (similar to anonymous key)
      const existingAuthKey = safeLocalStorageGetItem(AUTH_CONTEXT_KEY_STORAGE);
      if (existingAuthKey) {
        setContextKey(existingAuthKey);
        return;
      }

      const authKey = `strudel-user-${bestEffortNonSecureId()}`;
      safeLocalStorageSetItem(AUTH_CONTEXT_KEY_STORAGE, authKey);
      setContextKey(authKey);
      return;
    }

    setContextKey(getOrCreateAnonymousContextKey());
  }, [isAuthenticated, isLoaded]);

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
  const contextKeyState = useContextKey();
  const canUseContextKey = contextKeyState.isReady;
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
    { contextKey: canUseContextKey ? contextKeyState.contextKey : undefined },
    { enabled: canUseContextKey },
  );

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
          <TamboProvider
            tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
            apiKey={apiKey}
            tools={tools}
            components={components}
            contextHelpers={{
              strudelState: strudelContextHelper,
            }}
          >
            <AppContent />
          </TamboProvider>
        </StrudelProvider>
      </LoadingContextProvider>
    </JazzAndAuthProvider>
  );
}
