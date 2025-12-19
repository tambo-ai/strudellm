"use client";

import { cn } from "@/lib/utils";
import { getTheme, setTheme } from "@/lib/editor-preferences";
import { THEME_ID_ENUM, THEME_OPTIONS, type ThemeId } from "@/lib/editor-theme";
import * as React from "react";
import { z } from "zod/v3";

const allowedThemeIds = new Set<ThemeId>(THEME_OPTIONS.map((t) => t.id));

export const themePickerSchema = z.object({
  theme: z
    .enum(THEME_ID_ENUM)
    .optional()
    .describe("Theme to pre-select. Only set if user explicitly requests a specific theme."),
  filter: z
    .enum(["all", "dark", "light"])
    .optional()
    .describe("Filter to show only dark or light themes. Use 'dark' if user wants dark mode, 'light' for light mode."),
});

export type ThemePickerProps = z.infer<typeof themePickerSchema>;

export const ThemePicker = React.forwardRef<HTMLDivElement, ThemePickerProps>(
  ({ theme: initialTheme, filter = "all" }, ref) => {
    const [selectedTheme, setSelectedTheme] = React.useState<ThemeId>("default");
    const [activeFilter, setActiveFilter] = React.useState<"all" | "dark" | "light">(filter);

    // On mount: apply AI's theme if provided, otherwise read current theme
    React.useEffect(() => {
      if (initialTheme) {
        setSelectedTheme(initialTheme);
        setTheme(initialTheme === "default" ? null : initialTheme);
      } else {
        const current = getTheme();
        if (current && allowedThemeIds.has(current as ThemeId)) {
          setSelectedTheme(current as ThemeId);
        } else {
          setSelectedTheme("default");
          if (current) {
            // Normalize invalid stored themes so the next page load doesn't
            // bootstrap an unknown `data-theme` value.
            setTheme(null);
          }
        }
      }
    }, [initialTheme]);

    // Sync filter from props
    React.useEffect(() => {
      setActiveFilter(filter);
    }, [filter]);

    const handleThemeSelect = (themeId: ThemeId) => {
      setSelectedTheme(themeId);
      setTheme(themeId === "default" ? null : themeId);
    };

    const filteredThemes = THEME_OPTIONS.filter(
      (t) => activeFilter === "all" || t.type === activeFilter
    );

    return (
      <div
        ref={ref}
        className="w-full rounded-lg border border-border bg-card p-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Theme</h3>
          <div className="flex gap-1">
            {(["all", "dark", "light"] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-2 py-1 text-xs rounded-md border transition-colors",
                  activeFilter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredThemes.map((theme) => (
            <button
              type="button"
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs border transition-colors",
                selectedTheme === theme.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              )}
            >
              {theme.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
);

ThemePicker.displayName = "ThemePicker";
