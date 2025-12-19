import * as React from "react";
import { useStrudel } from "../context/strudel-provider";
import { ReplTabs } from "./repl-tabs";
import { Loader2 } from "lucide-react";

export function StrudelRepl() {
  const ref = React.useRef<HTMLDivElement>(null);

  const { setRoot, isToolUpdatingRepl } = useStrudel();

  React.useEffect(() => {
    if (ref.current) {
      setRoot(ref.current);
    }
  }, [ref, setRoot]);

  return (
    <div className="relative flex-1 min-h-0 w-full flex flex-col">
      <ReplTabs />
      <div
        className="relative flex-1 min-h-0 flex flex-col justify-stretch items-stretch"
      >
        <div
          ref={ref}
          className="flex-1 min-h-0 flex flex-col justify-stretch items-stretch bg-background text-foreground *:h-full"
        />

        {isToolUpdatingRepl && (
          <div className="absolute inset-0 z-20 bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/90 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI updating...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
