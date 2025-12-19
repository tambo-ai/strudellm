"use client";

import { THEME_STORAGE_KEY } from "@/lib/editor-theme";

/**
 * Editor Preferences Utility
 *
 * Handles theme, font, and keybinding preferences for the Strudel editor.
 * Themes are applied via CSS data-theme attribute on document root.
 */

const STORAGE_KEYS = {
  theme: THEME_STORAGE_KEY,
  fontFamily: "strudel-editor-font-family",
  fontSize: "strudel-editor-font-size",
  keybindings: "strudel-editor-keybindings",
} as const;

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_FAMILY = "monospace";
const DEFAULT_KEYBINDINGS = "codemirror";

/**
 * Get the current theme from localStorage
 */
export function getTheme(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.theme);
}

/**
 * Set the editor theme via data-theme attribute
 */
export function setTheme(theme: string | null): void {
  if (typeof window === "undefined") return;

  if (theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(STORAGE_KEYS.theme);
  }
}

/**
 * Set the editor font family via CSS injection
 */
export function setEditorFontFamily(
  fontFamily: string,
  save: boolean = true,
): void {
  if (typeof window === "undefined") return;

  const styleID = "strudel-font-family";
  let styleEl = document.getElementById(styleID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleID;
    document.head.appendChild(styleEl);
  }

  const fontMap: Record<string, string> = {
    monospace:
      "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    "Fira Code": "var(--font-fira-code), 'Fira Code', monospace",
    "JetBrains Mono": "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
    Hack: "'Hack', monospace",
    Monocraft: "'Monocraft', monospace",
  };

  const cssFont = fontMap[fontFamily] || fontFamily;
  styleEl.innerHTML = `.cm-editor .cm-content, .cm-editor .cm-gutters { font-family: ${cssFont} !important; }`;

  if (save) {
    localStorage.setItem(STORAGE_KEYS.fontFamily, fontFamily);
  }
}

/**
 * Set the editor font size
 */
export function setEditorFontSize(size: number, save: boolean = true): void {
  if (typeof window === "undefined") return;

  const styleID = "strudel-font-size";
  let styleEl = document.getElementById(styleID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleID;
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `.cm-editor .cm-content, .cm-editor .cm-gutters { font-size: ${size}px !important; }`;

  if (save) {
    localStorage.setItem(STORAGE_KEYS.fontSize, size.toString());
  }
}

/**
 * Save keybindings preference (applied on next editor restart)
 */
export function setEditorKeybindings(keybindings: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.keybindings, keybindings);
}

/**
 * Get saved font family
 */
export function getFontFamily(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.fontFamily);
}

/**
 * Get saved font size
 */
export function getFontSize(): number | null {
  if (typeof window === "undefined") return null;
  const size = localStorage.getItem(STORAGE_KEYS.fontSize);
  return size ? parseInt(size, 10) : null;
}

/**
 * Get saved keybindings
 */
export function getKeybindings(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.keybindings);
}

/**
 * Load and apply all saved editor preferences on startup
 */
export function loadEditorPreferences(): void {
  const theme = getTheme();
  if (theme) {
    setTheme(theme);
  }

  const fontFamily = getFontFamily();
  if (fontFamily) {
    setEditorFontFamily(fontFamily, false);
  }

  const fontSize = getFontSize();
  if (fontSize) {
    setEditorFontSize(fontSize, false);
  }
}

export { DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY, DEFAULT_KEYBINDINGS };
