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
import {
  MultiSelectForm,
  multiSelectFormSchema,
} from "@/components/tambo/multi-select-form";
import { SaveSong, saveSongSchema } from "@/components/tambo/save-song";
import { ShareSong, shareSongSchema } from "@/components/tambo/share-song";

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 */
export const tools: TamboTool[] = [validateAndUpdateRepl, listSamples];

/**
 * components
 *
 * Tambo components that can be rendered by the AI.
 */
export const components: TamboComponent[] = [
  {
    name: "SaveSong",
    description:
      "Save and manage Strudel songs. Requires the user to be signed in. Use when the user says things like: 'save this song', 'name this song', 'show my saved songs', 'load my saved song'.",
    component: SaveSong,
    propsSchema: saveSongSchema,
  },
  {
    name: "ShareSong",
    description:
      "Generate a public share link for the current Strudel song. Requires the user to be signed in. Use when the user says things like: 'share this', 'give me a link to this song', 'share this with a link'.",
    component: ShareSong,
    propsSchema: shareSongSchema,
  },
  {
    name: "MultiSelectForm",
    description:
      "A general-purpose multi-select form component. Renders labeled groups of toggle buttons where users can select multiple options within each group. Uses Tambo state to track user selections in AI context. Use for any scenario where the user needs to pick from categorized options (sounds, features, settings, categories, tags, etc.).",
    component: MultiSelectForm,
    propsSchema: multiSelectFormSchema,
  },
];
