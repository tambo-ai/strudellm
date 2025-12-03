/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This app provides a custom `updateRepl` tool that validates Strudel code
 * before updating the REPL. If the code is invalid, the tool throws an error
 * back to the AI so it can fix the pattern.
 *
 * NOTE: The system prompt (STRUDEL_SYSTEM_PROMPT) should be configured via
 * the Tambo dashboard for the "strudel-ai" context key, not via initialMessages.
 * This avoids conflicts when switching between existing threads.
 *
 * Read more about Tambo at https://tambo.co/docs
 */

import type { TamboComponent, TamboTool } from "@tambo-ai/react";
import { validateAndUpdateRepl } from "@/strudel/tools/validateAndUpdateRepl";
import { listSamples } from "@/strudel/tools/listSamples";

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 */
export const tools: TamboTool[] = [validateAndUpdateRepl, listSamples];

/**
 * components
 *
 * No rendered components - the REPL is placed directly on the page and
 * updated via the updateRepl tool.
 */
export const components: TamboComponent[] = [];