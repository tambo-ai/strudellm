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
import { components, tools } from "@/lib/tambo";
import { LoadingContextProvider } from "@/components/loading/context";
import type { Suggestion } from "@tambo-ai/react";
import { TamboProvider, useTamboThread, useTamboThreadList } from "@tambo-ai/react";
import * as React from "react";
import { Frame } from "@/components/layout/frame";
import { Main } from "@/components/layout/main";
import { Sidebar, SidebarContent } from "@/components/layout/sidebar";
import { useLoadingContext as useLoadingState } from "@/components/loading/context";
import { StrudelProvider, useStrudel } from "@/strudel/context/strudel-provider";
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

// Storage key for context
const CONTEXT_KEY_STORAGE = "strudel-ai-context-key";

// Get or create user-specific context key (persists across sessions)
const getOrCreateContextKey = (): string => {
  if (typeof window === "undefined") return "";

  let contextKey = localStorage.getItem(CONTEXT_KEY_STORAGE);
  if (!contextKey) {
    contextKey = `strudel-ai-${crypto.randomUUID()}`;
    localStorage.setItem(CONTEXT_KEY_STORAGE, contextKey);
  }
  return contextKey;
};

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
  const [contextKey] = React.useState(getOrCreateContextKey);
  const { isPending } = useLoadingState();
  const { isReady: strudelIsReady, setThreadId } = useStrudel();
  const { thread, startNewThread, switchCurrentThread } = useTamboThread();
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList({
    contextKey,
  });

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
  }, [strudelIsReady, threadListLoaded, threadInitialized, threadList, switchCurrentThread, startNewThread]);

  // Sync thread ID to Strudel service (handles code persistence)
  React.useEffect(() => {
    if (thread) {
      setThreadId(thread.id);
    }
  }, [thread, setThreadId]);

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
    </Frame>
  );
}

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY;

  if (!apiKey) {
    return <ApiKeyMissing />;
  }

  return (
    <LoadingContextProvider>
      <StrudelProvider>
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
  );
}
