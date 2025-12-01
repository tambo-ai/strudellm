"use client";

import {
  MessageInput,
  MessageInputError,
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
import { StrudelRepl } from "@/components/strudel-repl";
import { LoadingScreen } from "@/components/loading-screen";
import { STRUDEL_SYSTEM_PROMPT } from "@/lib/strudel-prompt";
import {
  initStrudel,
  onLoadingProgress,
} from "@/lib/strudel-service";
import { components, tools } from "@/lib/tambo";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@tambo-ai/react";
import { TamboProvider, useTamboThread } from "@tambo-ai/react";
import { ChevronRight } from "lucide-react";
import * as React from "react";

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

type LoadingState = "loading" | "ready" | "started";

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 480;

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [sidebarWidth, setSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [loadingState, setLoadingState] = React.useState<LoadingState>("loading");
  const [loadingStatus, setLoadingStatus] = React.useState("Initializing...");
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const { startNewThread } = useTamboThread();

  // Listen for loading progress and auto-proceed when ready
  React.useEffect(() => {
    const unsubscribe = onLoadingProgress((status, progress) => {
      setLoadingStatus(status);
      setLoadingProgress(progress);
      if (progress >= 100) {
        // Auto-proceed after a brief delay
        setTimeout(() => {
          setLoadingState("started");
        }, 500);
      }
    });

    return unsubscribe;
  }, []);

  // Start loading Strudel when component mounts
  React.useEffect(() => {
    initStrudel().catch((err) => {
      console.error("Failed to initialize Strudel:", err);
      setLoadingStatus("Failed to load. Please refresh.");
    });
  }, []);

  // Start a fresh thread when user clicks Start
  React.useEffect(() => {
    if (loadingState !== "started" || isInitialized) return;
    startNewThread();
    setIsInitialized(true);
  }, [loadingState, isInitialized, startNewThread]);


  // Handle sidebar resize
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Show loading screen until user clicks Start
  if (loadingState !== "started") {
    return (
      <LoadingScreen
        status={loadingStatus}
        progress={loadingProgress}
      />
    );
  }

  return (
    <div
      className={cn(
        "h-screen w-screen flex bg-background text-foreground overflow-hidden",
        isResizing && "cursor-col-resize select-none"
      )}
    >
      {/* Main REPL Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <StrudelRepl isReady={loadingState === "started"} />
      </div>

      {/* Chat Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-2 z-20 p-1 opacity-50 hover:opacity-100 transition-opacity"
        style={{ right: sidebarOpen ? sidebarWidth + 8 : 8 }}
        title={sidebarOpen ? "Close chat" : "Open chat"}
      >
        <ChevronRight
          className={cn("w-4 h-4", !sidebarOpen && "rotate-180")}
        />
      </button>

      {/* Chat Sidebar */}
      <div
        className={cn(
          "h-full border-l border-border flex flex-col relative",
          !isResizing && "transition-all duration-300",
          !sidebarOpen && "overflow-hidden"
        )}
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
      >
        {sidebarOpen && (
          <>
            {/* Resize Handle */}
            <div
              onMouseDown={handleResizeStart}
              className={cn(
                "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10",
                "hover:bg-primary/50 transition-colors",
                isResizing && "bg-primary/50"
              )}
            />

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
                  <MessageInputSubmitButton />
                </MessageInputToolbar>
                <MessageInputError />
              </MessageInput>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <TamboProvider
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
      components={components}
      tools={tools}
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      initialMessages={[
        {
          role: "system",
          content: [{ type: "text", text: STRUDEL_SYSTEM_PROMPT }],
        },
      ]}
    >
      <AppContent />
    </TamboProvider>
  );
}
