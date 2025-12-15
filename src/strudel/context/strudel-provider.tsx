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
  isPlaying: boolean;
  hasUnevaluatedChanges: boolean;
  play: () => void;
  stop: () => void;
  reset: () => void;
  setRoot: (el: HTMLDivElement) => void;
  isReady: boolean;
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
      play: async () => await strudelService.play(),
      stop: strudelService.stop,
      reset: strudelService.reset,
      setRoot,
      isReady: strudelService.isReady,
    };
  }, [setRoot, setCode, setThreadId, replState]);

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
