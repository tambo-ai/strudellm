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
import { useAccount, useIsAuthenticated } from "jazz-tools/react";
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
  const isAuthenticated = useIsAuthenticated();
  const account = useAccount();
  const [anonymousKey] = React.useState(getOrCreateAnonymousContextKey);

  // If user is logged in and account is loaded, use their Jazz account ID
  // The account object itself is the CoValue with an internal ID
  if (isAuthenticated && account?.$isLoaded) {
    // Use a hash of the profile or a stable identifier
    // Since account is a CoValue, we can use its internal reference
    const accountId =
      (account as unknown as { _raw?: { id?: string } })?._raw?.id ??
      "authenticated";
    return `strudel-user-${accountId}`;
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
  const [showReplSwitchWarning, setShowReplSwitchWarning] =
    React.useState(false);
  const [pendingThreadId, setPendingThreadId] = React.useState<string | null>(
    null,
  );
  const contextKey = useContextKey();
  const { isPending } = useLoadingState();
  const {
    isReady: strudelIsReady,
    setThreadId,
    setReplId,
    initializeRepl,
    isThreadOnDifferentRepl,
    getReplIdForThread,
    setIsAiUpdating,
  } = useStrudel();
  const { thread, startNewThread, switchCurrentThread, isIdle } =
    useTamboThread();
  const { generationStage } = useTambo();
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList({
    contextKey,
  });

  // Track AI generation state to lock editor during updates
  React.useEffect(() => {
    // Show overlay when AI is actively working (not idle and in a generation stage)
    const isGenerating =
      !isIdle && generationStage !== "IDLE" && generationStage !== "COMPLETE";
    setIsAiUpdating(isGenerating);
  }, [isIdle, generationStage, setIsAiUpdating]);

  // Initialize REPL on startup
  React.useEffect(() => {
    if (!strudelIsReady || replInitialized) return;
    initializeRepl();
    setReplInitialized(true);
  }, [strudelIsReady, replInitialized, initializeRepl]);

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

  // Sync thread ID to Strudel service (handles code persistence)
  React.useEffect(() => {
    if (thread) {
      setThreadId(thread.id);
    }
  }, [thread, setThreadId]);

  // Handler for switching threads - checks if REPL switch is needed
  // TODO: Integrate this with ThreadHistory component via onBeforeThreadSwitch prop
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleThreadSwitch = React.useCallback(
    (threadId: string) => {
      if (isThreadOnDifferentRepl(threadId)) {
        // Thread is attached to a different REPL - show warning
        setPendingThreadId(threadId);
        setShowReplSwitchWarning(true);
      } else {
        // Same REPL or new thread - switch directly
        switchCurrentThread(threadId);
      }
    },
    [isThreadOnDifferentRepl, switchCurrentThread],
  );

  // Confirm REPL switch
  const confirmReplSwitch = React.useCallback(() => {
    if (pendingThreadId) {
      const replId = getReplIdForThread(pendingThreadId);
      if (replId) {
        setReplId(replId);
      }
      switchCurrentThread(pendingThreadId);
    }
    setShowReplSwitchWarning(false);
    setPendingThreadId(null);
  }, [pendingThreadId, getReplIdForThread, setReplId, switchCurrentThread]);

  // Cancel REPL switch
  const cancelReplSwitch = React.useCallback(() => {
    setShowReplSwitchWarning(false);
    setPendingThreadId(null);
  }, []);

  if (isPending || !strudelIsReady || !thread) {
    return <LoadingScreen />;
  }

  return (
    <Frame>
      {/* REPL Switch Warning Dialog */}
      {showReplSwitchWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cancelReplSwitch}
          />
          <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold mb-2">Switch REPL?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This conversation is connected to a different REPL. Switching will
              load that REPL&apos;s code and replace your current editor
              content.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelReplSwitch}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-backdrop rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReplSwitch}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Switch REPL
              </button>
            </div>
          </div>
        </div>
      )}

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
    </Frame>
  );
}

export default function Home() {
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
