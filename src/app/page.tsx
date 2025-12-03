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
import { StrudelRepl } from "@/strudel/components/strudel-repl";
import { LoadingScreen } from "@/components/loading/loading-screen";
import { components, tools } from "@/lib/tambo";
import { LoadingContextProvider } from "@/components/loading/context";
import type { Suggestion, TamboThreadMessage } from "@tambo-ai/react";
import { TamboProvider, useTamboThread, useTamboThreadList } from "@tambo-ai/react";
import * as React from "react";
import { Frame } from "@/components/layout/frame";
import { Main } from "@/components/layout/main";
import { Sidebar, SidebarContent } from "@/components/layout/sidebar";
import { useLoadingContext as useLoadingState } from "@/components/loading/context";
import { StrudelProvider, useStrudel } from "@/strudel/context/strudel-provider";
import { StrudelStatusBar } from "@/strudel/components/strudel-status-bar";

const CONTEXT_KEY = "strudel-ai";

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
  const { isPending } = useLoadingState();
  const { isReady: strudelIsReady, setThreadId } = useStrudel();
  const { thread, startNewThread, switchCurrentThread } = useTamboThread();
  const { data: threadList, isSuccess: threadListLoaded } = useTamboThreadList({ contextKey: CONTEXT_KEY });

  // Load existing thread or create new one when app starts
  React.useEffect(() => {
    if (!strudelIsReady || !threadListLoaded || threadInitialized) return;

    const existingThreads = threadList?.items ?? [];
    if (existingThreads.length > 0) {
      const mostRecentThread = existingThreads[0];
      switchCurrentThread(mostRecentThread.id, true);
    } else {
      startNewThread();
    }
    setThreadInitialized(true);
  }, [threadListLoaded, threadList, threadInitialized, switchCurrentThread, startNewThread]);

  React.useEffect(() => {
    if (thread) {
      setThreadId(thread.id);
    }
  }, [thread]);

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
            <MessageInput contextKey={CONTEXT_KEY}>
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
    </Frame>
  );
}

export default function Home() {
  return (
    <TamboProvider
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
      tools={tools}
      components={components}
    >
      <LoadingContextProvider>
        <StrudelProvider>
          <AppContent />
        </StrudelProvider>
      </LoadingContextProvider>
    </TamboProvider>
  );
}
