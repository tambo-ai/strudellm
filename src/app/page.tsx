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

// Storage keys
const CONTEXT_KEY_STORAGE = "strudel-ai-context-key";
const CODE_STORAGE_PREFIX = "strudel-code-";

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

// Helper functions for code persistence
const saveCodeForThread = (threadId: string, code: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CODE_STORAGE_PREFIX + threadId, code);
  } catch {
    // Ignore storage errors
  }
};

const loadCodeForThread = (threadId: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CODE_STORAGE_PREFIX + threadId);
  } catch {
    return null;
  }
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
  const { isReady: strudelIsReady, setCode, code } = useStrudel();
  const { thread, startNewThread, switchCurrentThread } = useTamboThread();
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList({
    contextKey,
  });

  // Track previous thread to save code before switching
  const prevThreadRef = React.useRef<string | null>(null);

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

  // On thread change: save old code, load new code
  React.useEffect(() => {
    if (!thread || !strudelIsReady) return;

    // Save code from previous thread
    if (prevThreadRef.current && prevThreadRef.current !== thread.id && code) {
      saveCodeForThread(prevThreadRef.current, code);
    }

    // Load code for new thread (only if switching to a different thread)
    if (prevThreadRef.current !== thread.id) {
      const savedCode = loadCodeForThread(thread.id);
      if (savedCode) {
        setCode(savedCode, false); // Load but don't play
      }
    }

    prevThreadRef.current = thread.id;
  }, [thread, strudelIsReady, code, setCode]);

  // Auto-save current code on change
  React.useEffect(() => {
    if (!thread || !code) return;
    saveCodeForThread(thread.id, code);
  }, [thread, code]);

  if (isPending || !strudelIsReady) {
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
  return (
    <LoadingContextProvider>
      <StrudelProvider>
        <TamboProvider
          tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
          apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
          tools={tools}
          components={components}
        >
          <AppContent />
        </TamboProvider>
      </StrudelProvider>
    </LoadingContextProvider>
  );
}
