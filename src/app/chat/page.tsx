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

/**
 * Context helper that provides the current Strudel REPL state to the AI.
 * This allows the AI to see what code is currently in the editor.
 */
const strudelContextHelper = () => {
  const service = StrudelService.instance();
  const state = service.getReplState();

  return {
    currentCode: state?.code ?? "",
    isPlaying: state?.started ?? false,
  };
};

// Storage key for anonymous context
const CONTEXT_KEY_STORAGE = "strudel-ai-context-key";

// Get or create anonymous context key (for users not logged in)
const getOrCreateAnonymousContextKey = (): string => {
  if (typeof window === "undefined") return "";

  let contextKey = localStorage.getItem(CONTEXT_KEY_STORAGE);
  if (!contextKey) {
    contextKey = `strudel-ai-anon-${crypto.randomUUID()}`;
    localStorage.setItem(CONTEXT_KEY_STORAGE, contextKey);
  }
  return contextKey;
};

// Hook to get context key (user ID if logged in, anonymous otherwise)
function useContextKey(): string {
  const { data: session } = useSession();
  const [anonymousKey] = React.useState(getOrCreateAnonymousContextKey);

  if (session?.user?.id) {
    return `strudel-user-${session.user.id}`;
  }

  // Otherwise use anonymous key
  return anonymousKey;
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
  const contextKey = useContextKey();
  const prevContextKeyRef = React.useRef<string | null>(null);
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
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList({
    contextKey,
  });

  // If the context key changes (e.g. user signs in/out), re-initialize thread selection
  React.useEffect(() => {
    if (
      prevContextKeyRef.current !== null &&
      prevContextKeyRef.current !== contextKey
    ) {
      setThreadInitialized(false);
    }
    prevContextKeyRef.current = contextKey;
  }, [contextKey]);

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
            <MessageInput contextKey={contextKey}>
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
        contextKey={contextKey}
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
