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
import {
  ThemePicker,
  themePickerSchema,
} from "@/components/tambo/theme-picker";
import {
  KeybindingsPicker,
  keybindingsPickerSchema,
} from "@/components/tambo/keybindings-picker";
import {
  FontSettings,
  fontSettingsSchema,
} from "@/components/tambo/font-settings";

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
    name: "MultiSelectForm",
    description:
      "A general-purpose multi-select form component. Renders labeled groups of toggle buttons where users can select multiple options within each group. Uses Tambo state to track user selections in AI context. Use for any scenario where the user needs to pick from categorized options (sounds, features, settings, categories, tags, etc.).",
    component: MultiSelectForm,
    propsSchema: multiSelectFormSchema,
  },
  {
    name: "ThemePicker",
    description:
      "Editor theme selector. Use filter='dark' or filter='light' to show only dark/light themes. Only set theme prop if user explicitly requests a specific theme (dracula, tokyo-night, nord, github-light, solarized-light, one-light). Use for 'change theme', 'dark mode', 'light mode', 'use dracula', etc.",
    component: ThemePicker,
    propsSchema: themePickerSchema,
  },
  {
    name: "KeybindingsPicker",
    description:
      "Editor keybindings selector (default, vim, emacs, vscode). Requires runtime restart. Use for 'vim mode', 'use emacs keybindings', etc.",
    component: KeybindingsPicker,
    propsSchema: keybindingsPickerSchema,
  },
  {
    name: "FontSettings",
    description:
      "Editor font family and size settings. Use for 'change font', 'make text bigger', 'use Fira Code', 'increase font size', etc.",
    component: FontSettings,
    propsSchema: fontSettingsSchema,
  },
];
