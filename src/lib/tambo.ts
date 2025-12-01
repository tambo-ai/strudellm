/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This app provides a custom `updateRepl` tool that validates Strudel code
 * before updating the REPL. If the code is invalid, the tool throws an error
 * back to the AI so it can fix the pattern.
 *
 * Read more about Tambo at https://tambo.co/docs
 */

import type { TamboComponent, TamboTool } from "@tambo-ai/react";
import { z } from "zod";
import { validateAndUpdateRepl } from "./strudel-service";

/**
 * Schema for the updateRepl tool arguments
 */
const updateReplArgsSchema = z.object({
  code: z
    .string()
    .describe(
      "The Strudel/Tidal pattern code to evaluate and display. Examples: s('bd sd') for drums, note('c3 e3 g3') for melodies, stack() for layering patterns."
    ),
});

/**
 * updateRepl tool
 *
 * Validates Strudel code by evaluating it, then updates the REPL if valid.
 * If the code contains errors, the tool throws an error so the AI can fix it.
 */
const updateReplTool: TamboTool = {
  name: "updateRepl",
  description:
    "Update the Strudel REPL with new pattern code. The code is validated by running it through Strudel's evaluator first. If the code is invalid (contains undefined functions, syntax errors, etc.), the tool will fail with an error message. Always use this tool to update the REPL - do not use update_interactable_component directly.",
  tool: async (args: z.infer<typeof updateReplArgsSchema>) => {
    const { code } = args;
    // This will throw if the code is invalid
    const result = await validateAndUpdateRepl(code);
    return `Pattern updated successfully: ${result.code}`;
  },
  toolSchema: z
    .function()
    .args(updateReplArgsSchema)
    .returns(z.promise(z.string())),
};

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 */
export const tools: TamboTool[] = [updateReplTool];

/**
 * components
 *
 * No rendered components - the REPL is placed directly on the page and
 * updated via the updateRepl tool.
 */
export const components: TamboComponent[] = [];
