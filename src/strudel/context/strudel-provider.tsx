import { useLoadingContext } from "@/components/loading/context";
import { StrudelService } from "@/strudel/lib/service";
import { StrudelReplState } from "@strudel/codemirror";
import * as React from "react";

type StrudelContextValue = {
  // Define context value types here
  code: string,
  setCode: (code: string, shouldEvaluate: boolean) => void,
  isPlaying: boolean,
  play: () => void,
  stop: () => void,
  reset: () => void,
  setRoot: (el: HTMLDivElement) => void,
  setThreadId: (threadId: string) => void,
  isReady: boolean,
};

export const StrudelContext = React.createContext<StrudelContextValue | null>(null);

const strudelService = StrudelService.instance();

export function StrudelProvider({ children }: { children: React.ReactNode }) {
  const { setMessage, setProgress, setState } = useLoadingContext();
  const [replState, setReplState] = React.useState<StrudelReplState | null>(() => {
    return strudelService.getReplState();
  });

  React.useEffect(() => {
    const loadingUnsubscribe = strudelService.onLoadingProgress(
      (status: string, progress: number) => {
        setProgress(progress);
        setMessage(status || "Loading...");

        if (progress >= 100) {
          setState("ready");
        }
      }
    );

    const replUnsubscribe = strudelService.onStateChange((newState) => {
      setReplState((state) => {
        return { ...state, ...newState }
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
  }, [strudelService, setReplState]);

  const setRoot = React.useCallback((el: HTMLDivElement) => {
    strudelService.attach(el);

    return () => {
      strudelService.detach();
    };
  }, [strudelService]);

  const providerValue: StrudelContextValue = React.useMemo(() => {
    const { started: isPlaying, code } = replState || { started: false, code: '' };
    return {
      code,
      isPlaying,
      setCode: strudelService.setCode,
      play: strudelService.play,
      stop: strudelService.stop,
      reset: strudelService.reset,
      setRoot,
      setThreadId: strudelService.setThreadId,
      isReady: strudelService.isReady,
    }
  }, [setRoot, strudelService.isReady, replState, strudelService]);

  return (
    <StrudelContext.Provider value={providerValue}>{children}</StrudelContext.Provider>
  );
}

export function useStrudel() {
  // Hook implementation
  const context = React.useContext(StrudelContext);

  if (!context) {
    throw new Error('useStrudel must be used within a StrudelProvider');
  }

  return context;
}
