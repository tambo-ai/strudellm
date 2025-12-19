import * as React from "react";
import { useStrudel } from "../context/strudel-provider";
import { ReplTabs } from "./repl-tabs";
import { Loader2 } from "lucide-react";

export function StrudelRepl() {
  const ref = React.useRef<HTMLDivElement>(null);

  const { setRoot, isAiUpdating } = useStrudel();

  React.useEffect(() => {
    if (ref.current) {
      setRoot(ref.current);
    }
  }, [ref, setRoot]);

  return (
    <div className="relative flex-1 min-h-0 w-full flex flex-col">
      <ReplTabs />
      <div
        ref={ref}
        className="flex-1 min-h-0 flex flex-col justify-stretch items-stretch bg-background text-foreground *:h-full"
      />

      {/* Subtle AI updating indicator in corner */}
      {isAiUpdating && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/80 text-muted-foreground text-xs z-10">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>AI updating...</span>
        </div>
      )}
    </div>
  );
}
