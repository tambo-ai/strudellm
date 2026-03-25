"use client";

import {
  Tooltip,
  TooltipProvider,
} from "@/components/tambo/suggestions-tooltip";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@tambo-ai/react";
import { useTambo, useTamboSuggestions, type AcceptSuggestionOptions } from "@tambo-ai/react";
import { Loader2Icon } from "lucide-react";
import * as React from "react";
import { useEffect } from "react";

interface MessageSuggestionsContextValue {
  suggestions: Suggestion[];
  selectedSuggestionId: string | null;
  accept: (options: AcceptSuggestionOptions) => void;
  isGenerating: boolean;
  error: Error | null;
  isMac: boolean;
}

/**
 * React Context for sharing suggestion data and functions among sub-components.
 * @internal
 */
const MessageSuggestionsContext =
  React.createContext<MessageSuggestionsContextValue | null>(null);

/**
 * Hook to access the message suggestions context.
 * @returns {MessageSuggestionsContextValue} The message suggestions context value.
 * @throws {Error} If used outside of MessageSuggestions.
 * @internal
 */
const useMessageSuggestionsContext = () => {
  const context = React.useContext(MessageSuggestionsContext);
  if (!context) {
    throw new Error(
      "MessageSuggestions sub-components must be used within a MessageSuggestions",
    );
  }
  return context;
};

/**
 * Props for the MessageSuggestions component.
 * Extends standard HTMLDivElement attributes.
 */
export interface MessageSuggestionsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum number of suggestions to display (default: 3) */
  maxSuggestions?: number;
  /** The child elements to render within the container. */
  children?: React.ReactNode;
  /** Pre-seeded suggestions to display initially */
  initialSuggestions?: Suggestion[];
}

/**
 * The root container for message suggestions.
 * It establishes the context for its children and handles overall state management.
 * @component MessageSuggestions
 * @example
 * ```tsx
 * <MessageSuggestions maxSuggestions={3}>
 *   <MessageSuggestions.Status />
 *   <MessageSuggestions.List />
 * </MessageSuggestions>
 * ```
 */
const MessageSuggestions = React.forwardRef<
  HTMLDivElement,
  MessageSuggestionsProps
>(
  (
    {
      children,
      className,
      maxSuggestions = 3,
      initialSuggestions = [],
      ...props
    },
    ref,
  ) => {
    const { messages } = useTambo();
    const {
      suggestions: generatedSuggestions,
      selectedSuggestionId,
      accept,
      isGenerating,
      error,
    } = useTamboSuggestions({ maxSuggestions });

    // Combine initial and generated suggestions, but only use initial ones when thread is empty
    const suggestions = React.useMemo(() => {
      // Only use pre-seeded suggestions if thread is empty
      const raw = !messages?.length && initialSuggestions.length > 0
        ? initialSuggestions.slice(0, maxSuggestions)
        : generatedSuggestions;
      // Ensure detailedSuggestion is populated (SDK accept() throws if empty)
      return raw.map((s) => ({
        ...s,
        detailedSuggestion: s.detailedSuggestion || s.title,
      }));
    }, [
      messages?.length,
      generatedSuggestions,
      initialSuggestions,
      maxSuggestions,
    ]);

    const isMac =
      typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");

    const contextValue = React.useMemo(
      () => ({
        suggestions,
        selectedSuggestionId,
        accept,
        isGenerating,
        error,
        isMac,
      }),
      [
        suggestions,
        selectedSuggestionId,
        accept,
        isGenerating,
        error,
        isMac,
      ],
    );

    // Handle keyboard shortcuts for selecting suggestions
    useEffect(() => {
      if (!suggestions || suggestions.length === 0) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        const modifierPressed = isMac
          ? event.metaKey && event.altKey
          : event.ctrlKey && event.altKey;

        if (modifierPressed) {
          const keyNum = parseInt(event.key);
          if (!isNaN(keyNum) && keyNum > 0 && keyNum <= suggestions.length) {
            event.preventDefault();
            const suggestionIndex = keyNum - 1;
            accept({ suggestion: suggestions[suggestionIndex] as Suggestion });
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [suggestions, accept, isMac]);

    // If we have no messages yet and no initial suggestions, render nothing
    if (!messages?.length && initialSuggestions.length === 0) {
      return null;
    }

    return (
      <MessageSuggestionsContext.Provider value={contextValue}>
        <TooltipProvider>
          <div
            ref={ref}
            className={cn("px-4 pb-2", className)}
            data-slot="message-suggestions-container"
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </MessageSuggestionsContext.Provider>
    );
  },
);
MessageSuggestions.displayName = "MessageSuggestions";

/**
 * Props for the MessageSuggestionsStatus component.
 * Extends standard HTMLDivElement attributes.
 */
export type MessageSuggestionsStatusProps =
  React.HTMLAttributes<HTMLDivElement>;

/**
 * Displays loading, error, or generation stage information.
 * Automatically connects to the context to show the appropriate status.
 * @component MessageSuggestions.Status
 * @example
 * ```tsx
 * <MessageSuggestions>
 *   <MessageSuggestions.Status />
 *   <MessageSuggestions.List />
 * </MessageSuggestions>
 * ```
 */
const MessageSuggestionsStatus = React.forwardRef<
  HTMLDivElement,
  MessageSuggestionsStatusProps
>(({ className, ...props }, ref) => {
  const { error, isGenerating } = useMessageSuggestionsContext();

  return (
    <div
      ref={ref}
      className={cn(
        "p-2 rounded-md text-sm bg-transparent",
        !error && !isGenerating ? "p-0 min-h-0 mb-0" : "",
        className,
      )}
      data-slot="message-suggestions-status"
      {...props}
    >
      {/* Error state */}
      {error && (
        <div className="p-2 rounded-md text-sm bg-destructive/10 text-destructive">
          <p>{error.message}</p>
        </div>
      )}

      {/* Generation loading state */}
      <div className="generation-stage-container">
        {isGenerating ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            <p>Generating suggestions...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
});
MessageSuggestionsStatus.displayName = "MessageSuggestions.Status";

/**
 * Props for the MessageSuggestionsList component.
 * Extends standard HTMLDivElement attributes.
 */
export type MessageSuggestionsListProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Displays the list of suggestion buttons.
 * Automatically connects to the context to show the suggestions.
 * @component MessageSuggestions.List
 * @example
 * ```tsx
 * <MessageSuggestions>
 *   <MessageSuggestions.Status />
 *   <MessageSuggestions.List />
 * </MessageSuggestions>
 * ```
 */
const MessageSuggestionsList = React.forwardRef<
  HTMLDivElement,
  MessageSuggestionsListProps
>(({ className, ...props }, ref) => {
  const { suggestions, selectedSuggestionId, accept, isGenerating, isMac } =
    useMessageSuggestionsContext();

  const modKey = isMac ? "⌘" : "Ctrl";
  const altKey = isMac ? "⌥" : "Alt";

  // Create placeholder suggestions when there are no real suggestions
  const placeholders = Array(3).fill(null);

  return (
    <div
      ref={ref}
      className={cn(
        "flex space-x-2 overflow-x-auto pb-2 rounded-md bg-transparent min-h-[2.5rem]",
        isGenerating ? "opacity-70" : "",
        className,
      )}
      data-slot="message-suggestions-list"
      {...props}
    >
      {suggestions.length > 0
        ? suggestions.map((suggestion, index) => (
            <Tooltip
              key={suggestion.id}
              content={
                <span suppressHydrationWarning>
                  {modKey}+{altKey}+{index + 1}
                </span>
              }
              side="top"
            >
              <button
                className={cn(
                  "py-2 px-2.5 rounded-2xl text-xs transition-colors",
                  "border border-flat",
                  isGenerating
                    ? "bg-muted/50 text-muted-foreground"
                    : selectedSuggestionId === suggestion.id
                      ? "bg-accent text-accent-foreground"
                      : "bg-background hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={async () =>
                  !isGenerating && (await accept({ suggestion }))
                }
                disabled={isGenerating}
                data-suggestion-id={suggestion.id}
                data-suggestion-index={index}
              >
                <span className="font-medium">{suggestion.title}</span>
              </button>
            </Tooltip>
          ))
        : // Render placeholder buttons when no suggestions are available
          placeholders.map((_, index) => (
            <div
              key={`placeholder-${index}`}
              className="py-2 px-2.5 rounded-2xl text-xs border border-border/50 bg-muted/30 min-w-[80px] animate-pulse flex items-center justify-center"
              data-placeholder-index={index}
            >
              <span className="block h-3 bg-muted-foreground/20 rounded w-16"></span>
            </div>
          ))}
    </div>
  );
});
MessageSuggestionsList.displayName = "MessageSuggestions.List";

export { MessageSuggestions, MessageSuggestionsStatus, MessageSuggestionsList };
