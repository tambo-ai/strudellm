"use client";

import * as React from "react";

const LoadingContext = React.createContext<LoadingContextValue | null>(null);

type State = "loading" | "ready" | "started" | "error";

interface LoadingContextValue {
  state: State;
  message: string;
  progress: number;
  setState: (state: State) => void;
  setMessage: (message: string) => void;
  setProgress: (progress: number) => void;
  isStarted: boolean;
  isLoading: boolean;
  isPending: boolean;
  isReady: boolean;
}

export function LoadingContextProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>("loading");
  const [message, setMessage] = React.useState("Initializing...");
  const [progress, setProgress] = React.useState(0);

  const isStarted = state === "started";
  const isLoading = state === "loading";
  const isPending = isLoading || isStarted;
  const isReady = state === "ready";

  const value = {
    state,
    message,
    progress,
    isLoading,
    isStarted,
    isPending,
    isReady,
    setState,
    setMessage,
    setProgress,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoadingContext() {
  const context = React.useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoadingContext must be used within a LoadingContextProvider");
  }
  return context;
}