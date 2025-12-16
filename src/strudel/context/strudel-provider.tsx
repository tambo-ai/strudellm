"use client";

import { useLoadingContext } from "@/components/loading/context";
import { StrudelService } from "@/strudel/lib/service";
import { StrudelReplState } from "@strudel/codemirror";
import { ReplSummary } from "@/hooks/use-strudel-storage";
import * as React from "react";

type StrudelContextValue = {
  code: string;
  error: string | Error | null;
  setCode: (code: string, shouldPlay?: boolean) => void;
  setThreadId: (threadId: string | null) => void;
  setReplId: (replId: string) => void;
  currentReplId: string | null;
  createNewRepl: (code?: string) => string | null;
  initializeRepl: () => string | null;
  isThreadOnDifferentRepl: (threadId: string) => boolean;
  getReplIdForThread: (threadId: string) => string | null;
  allRepls: ReplSummary[];
  getAllRepls: () => ReplSummary[];
  deleteRepl: (replId: string) => void;
  isPlaying: boolean;
  hasUnevaluatedChanges: boolean;
  play: () => void;
  stop: () => void;
  reset: () => void;
  clearError: () => void;
  setRoot: (el: HTMLDivElement) => void;
  isReady: boolean;
  isStorageLoaded: boolean;
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
  const [allRepls, setAllRepls] = React.useState<ReplSummary[]>([]);
  const [currentReplId, setCurrentReplId] = React.useState<string | null>(() =>
    strudelService.getCurrentReplId(),
  );

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
    setCurrentReplId(replId);
  }, []);

  const createNewRepl = React.useCallback((code?: string) => {
    const replId = strudelService.createNewRepl(code);
    if (replId) {
      setCurrentReplId(replId);
    }
    return replId;
  }, []);

  const initializeRepl = React.useCallback(() => {
    const replId = strudelService.initializeRepl();
    if (replId) {
      setCurrentReplId(replId);
    }
    return replId;
  }, []);

  const isThreadOnDifferentRepl = React.useCallback((threadId: string) => {
    return strudelService.isThreadOnDifferentRepl(threadId);
  }, []);

  const getReplIdForThread = React.useCallback((threadId: string) => {
    return strudelService.getReplIdForThread(threadId);
  }, []);

  const getAllRepls = React.useCallback(() => {
    const repls = strudelService.getAllRepls();
    setAllRepls(repls);
    return repls;
  }, []);

  const deleteRepl = React.useCallback((replId: string) => {
    strudelService.deleteRepl(replId);
    // Refresh the list after deletion
    const repls = strudelService.getAllRepls();
    setAllRepls(repls);
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
      currentReplId,
      createNewRepl,
      initializeRepl,
      isThreadOnDifferentRepl,
      getReplIdForThread,
      allRepls,
      getAllRepls,
      deleteRepl,
      play: async () => await strudelService.play(),
      stop: strudelService.stop,
      reset: strudelService.reset,
      clearError: strudelService.clearError,
      setRoot,
      isReady: strudelService.isReady,
      isStorageLoaded: strudelService.isStorageLoaded,
      isAiUpdating,
      setIsAiUpdating,
    };
  }, [
    setRoot,
    setCode,
    setThreadId,
    setReplId,
    currentReplId,
    createNewRepl,
    initializeRepl,
    isThreadOnDifferentRepl,
    getReplIdForThread,
    allRepls,
    getAllRepls,
    deleteRepl,
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
