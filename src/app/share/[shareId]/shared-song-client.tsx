"use client";

import { LoadingScreen } from "@/components/loading/loading-screen";
import { LoadingContextProvider } from "@/components/loading/context";
import { cn } from "@/lib/utils";
import { StrudelProvider, useStrudel } from "@/strudel/context/strudel-provider";
import { Play, Square, RotateCcw } from "lucide-react";
import Link from "next/link";
import * as React from "react";

function SharedSongViewer({ code }: { code: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { setRoot, setCode, isReady, isPlaying, play, stop, reset } =
    useStrudel();

  React.useEffect(() => {
    if (ref.current) {
      setRoot(ref.current);
    }
  }, [setRoot]);

  React.useEffect(() => {
    if (isReady) {
      setCode(code, false);
    }
  }, [code, isReady, setCode]);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        ref={ref}
        className="flex-1 min-h-0 flex flex-col justify-stretch items-stretch bg-background text-foreground *:h-full"
      />

      <div className="px-4 py-3 border-t border-border flex items-center gap-3 text-sm">
        <button
          onClick={isPlaying ? stop : play}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors",
            isPlaying
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:text-foreground hover:bg-muted/80",
          )}
        >
          {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? "Stop" : "Play"}
        </button>

        <button
          onClick={reset}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  );
}

export function SharedSongClient({
  code,
  title,
}: {
  code: string;
  title: string;
}) {
  return (
    <LoadingContextProvider>
      <StrudelProvider>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <header className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-base font-medium truncate">{title}</h1>
              <p className="text-xs text-muted-foreground">Shared Strudel song</p>
            </div>
            <Link
              href="/chat"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Open StrudelLM
            </Link>
          </header>

          <SharedSongViewer code={code} />
        </div>
      </StrudelProvider>
    </LoadingContextProvider>
  );
}
