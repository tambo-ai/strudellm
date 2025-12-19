export const THEME_STORAGE_KEY = "strudel-editor-theme";

export const THEME_ID_ENUM = [
  "default",
  "dracula",
  "tokyo-night",
  "nord",
  "github-light",
  "solarized-light",
  "one-light",
] as const;

export type ThemeId = (typeof THEME_ID_ENUM)[number];

export const STORED_THEME_IDS = [
  "dracula",
  "tokyo-night",
  "nord",
  "github-light",
  "solarized-light",
  "one-light",
] as const;

export type StoredThemeId = (typeof STORED_THEME_IDS)[number];

export const THEME_OPTIONS = [
  { id: "default", name: "Tambo Dark", type: "dark" },
  { id: "dracula", name: "Dracula", type: "dark" },
  { id: "tokyo-night", name: "Tokyo Night", type: "dark" },
  { id: "nord", name: "Nord", type: "dark" },
  { id: "github-light", name: "GitHub Light", type: "light" },
  { id: "solarized-light", name: "Solarized Light", type: "light" },
  { id: "one-light", name: "One Light", type: "light" },
] as const;
