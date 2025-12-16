"use client";

import { useLoadingContext } from "@/components/loading/context";
import { StrudelService } from "@/strudel/lib/service";
import { StrudelReplState } from "@strudel/codemirror";
import * as React from "react";

type StrudelContextValue = {
  code: string;
  error: string | Error | null;
  setCode: (code: string, shouldPlay?: boolean) => void;
  setThreadId: (threadId: string | null) => void;
  setReplId: (replId: string) => void;
  getCurrentReplId: () => string | null;
  createNewRepl: (code?: string) => string | null;
  initializeRepl: () => string | null;
  isThreadOnDifferentRepl: (threadId: string) => boolean;
  getReplIdForThread: (threadId: string) => string | null;
  isPlaying: boolean;
  hasUnevaluatedChanges: boolean;
  play: () => void;
  stop: () => void;
  reset: () => void;
  clearError: () => void;
  setRoot: (el: HTMLDivElement) => void;
  isReady: boolean;
  isAiUpdating: boolean;
  setIsAiUpdating: (value: boolean) => void;
};

export const StrudelContext = React.createContext<StrudelContextValue | null>(
  null,
);

const strudelService = StrudelService.instance();

export function StrudelProvider({ children }: { children: React.ReactNode }) {
  const { setMessage, setProgress, setState } = useLoadingContext();
  const [replState, setReplState] = React.useState<StrudelReplState | null>(
    () => {
      return strudelService.getReplState();
    },
  );
  const [isAiUpdating, setIsAiUpdating] = React.useState(false);

  React.useEffect(() => {
    const loadingUnsubscribe = strudelService.onLoadingProgress(
      (status: string, progress: number) => {
        setProgress(progress);
        setMessage(status || "Loading...");

        if (progress >= 100) {
          setState("ready");
        }
      },
    );

    const replUnsubscribe = strudelService.onStateChange((newState) => {
      setReplState((state) => {
        return { ...state, ...newState };
      });
    });

    if (!strudelService.isReady) {
      strudelService.init();
      return;
    }

    return () => {
      loadingUnsubscribe();
      replUnsubscribe();
    };
  }, [setMessage, setProgress, setReplState, setState]);

  const setRoot = React.useCallback((el: HTMLDivElement) => {
    strudelService.attach(el);

    return () => {
      strudelService.detach();
    };
  }, []);

  const setCode = React.useCallback(
    (code: string, shouldPlay: boolean = false) => {
      strudelService.setCode(code);
      if (shouldPlay) {
        strudelService.play();
      }
    },
    [],
  );

  const setThreadId = React.useCallback((threadId: string | null) => {
    strudelService.setThreadId(threadId);
  }, []);

  const setReplId = React.useCallback((replId: string) => {
    strudelService.setReplId(replId);
  }, []);

  const getCurrentReplId = React.useCallback(() => {
    return strudelService.getCurrentReplId();
  }, []);

  const createNewRepl = React.useCallback((code?: string) => {
    return strudelService.createNewRepl(code);
  }, []);

  const initializeRepl = React.useCallback(() => {
    return strudelService.initializeRepl();
  }, []);

  const isThreadOnDifferentRepl = React.useCallback((threadId: string) => {
    return strudelService.isThreadOnDifferentRepl(threadId);
  }, []);

  const getReplIdForThread = React.useCallback((threadId: string) => {
    return strudelService.getReplIdForThread(threadId);
  }, []);

  const providerValue: StrudelContextValue = React.useMemo(() => {
    const {
      started: isPlaying,
      code,
      activeCode,
      evalError,
      schedulerError,
    } = replState || { started: false, code: "", activeCode: "" };
    // Has unevaluated changes if playing and current code differs from what's being played
    const hasUnevaluatedChanges = isPlaying && code !== activeCode;
    return {
      code,
      error: evalError || schedulerError || null,
      isPlaying,
      hasUnevaluatedChanges,
      setCode,
      setThreadId,
      setReplId,
      getCurrentReplId,
      createNewRepl,
      initializeRepl,
      isThreadOnDifferentRepl,
      getReplIdForThread,
      play: async () => await strudelService.play(),
      stop: strudelService.stop,
      reset: strudelService.reset,
      clearError: strudelService.clearError,
      setRoot,
      isReady: strudelService.isReady,
      isAiUpdating,
      setIsAiUpdating,
    };
  }, [
    setRoot,
    setCode,
    setThreadId,
    setReplId,
    getCurrentReplId,
    createNewRepl,
    initializeRepl,
    isThreadOnDifferentRepl,
    getReplIdForThread,
    replState,
    isAiUpdating,
  ]);

  return (
    <StrudelContext.Provider value={providerValue}>
      {children}
    </StrudelContext.Provider>
  );
}

export function useStrudel() {
  // Hook implementation
  const context = React.useContext(StrudelContext);

  if (!context) {
    throw new Error("useStrudel must be used within a StrudelProvider");
  }

  return context;
}
