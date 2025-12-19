"use client";

import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import * as React from "react";

export interface GenerationIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  isGenerating: boolean;
}

type Hint = {
  message: string;
  href: string;
};

// Static list; not expected to change at runtime.
const HINTS: Hint[] = [
  {
    message: "Like Strudel LM? Give us a star",
    href: "https://github.com/tambo-ai/strudellm",
  },
  {
    message: "Add the Tambo agent to your app",
    href: "https://github.com/tambo-ai/tambo",
  },
  {
    message: "Find a bug? Open a GitHub issue",
    href: "https://github.com/tambo-ai/strudellm/issues",
  },
];

const INITIAL_HINT_DELAY_MS = 3000;

// Pick a random hint index once per module load
const getRandomHintIndex = () => Math.floor(Math.random() * HINTS.length);

export function GenerationIndicator({
  isGenerating,
  className,
  ...props
}: GenerationIndicatorProps) {
  const [showHint, setShowHint] = React.useState(false);
  const [hintIndex, setHintIndex] = React.useState(() => getRandomHintIndex());
  const prevIsGenerating = React.useRef(isGenerating);

  React.useEffect(() => {
    // When generation starts (transition from false to true)
    if (isGenerating && !prevIsGenerating.current) {
      setShowHint(false);
      // Pick a new random hint for each generation
      setHintIndex(getRandomHintIndex());

      if (HINTS.length === 0) return;

      const timeout = window.setTimeout(() => {
        setShowHint(true);
      }, INITIAL_HINT_DELAY_MS);

      prevIsGenerating.current = isGenerating;
      return () => {
        window.clearTimeout(timeout);
      };
    }

    prevIsGenerating.current = isGenerating;
  }, [isGenerating]);

  const hint = HINTS.length > 0 ? HINTS[hintIndex] : null;

  // Show nothing if not generating and hint hasn't been shown yet
  if (!isGenerating && !showHint) {
    return (
      <div
        className={cn(
          "h-6 min-w-0 flex items-center text-xs text-muted-foreground/80 pl-3",
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        "h-6 min-w-0 flex items-center text-xs text-muted-foreground/80 pl-3",
        className,
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      <span className="flex items-center gap-2 truncate">
        {isGenerating && (
          <span className="shrink-0 animate-pulse">Generating...</span>
        )}
        {showHint && hint && (
          <>
            {isGenerating && (
              <span className="text-muted-foreground/40 shrink-0">—</span>
            )}
            <a
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors truncate"
              href={hint.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="truncate">{hint.message}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </>
        )}
      </span>
    </div>
  );
}
