"use client";

import { cn } from "@/lib/utils";
import {
  getFontFamily,
  getFontSize,
  setEditorFontFamily,
  setEditorFontSize,
} from "@/lib/editor-preferences";
import * as React from "react";
import { z } from "zod/v3";

const fontFamilyOptions = [
  { value: "monospace", label: "System" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "JetBrains Mono", label: "JetBrains" },
  { value: "Hack", label: "Hack" },
  { value: "Monocraft", label: "Monocraft" },
] as const;

export const fontSettingsSchema = z.object({
  fontFamily: z
    .enum(["monospace", "Fira Code", "JetBrains Mono", "Hack", "Monocraft"])
    .optional()
    .describe("Editor font family"),
  fontSize: z
    .number()
    .min(12)
    .max(24)
    .optional()
    .describe("Font size in pixels (12-24)"),
});

export type FontSettingsProps = z.infer<typeof fontSettingsSchema>;

export const FontSettings = React.forwardRef<HTMLDivElement, FontSettingsProps>(
  ({ fontFamily, fontSize }, ref) => {
    const [selectedFont, setSelectedFont] = React.useState<string>("monospace");
    const [selectedSize, setSelectedSize] = React.useState<number>(14);

    // On mount: apply AI prop if provided, otherwise read from localStorage
    React.useEffect(() => {
      if (fontFamily) {
        setSelectedFont(fontFamily);
        setEditorFontFamily(fontFamily);
      } else {
        const saved = getFontFamily();
        if (saved) setSelectedFont(saved);
      }
    }, [fontFamily]);

    React.useEffect(() => {
      if (fontSize) {
        setSelectedSize(fontSize);
        setEditorFontSize(fontSize);
      } else {
        const saved = getFontSize();
        if (saved) setSelectedSize(saved);
      }
    }, [fontSize]);

    const handleFontSelect = (value: string) => {
      setSelectedFont(value);
      setEditorFontFamily(value);
    };

    const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const size = parseInt(e.target.value, 10);
      setSelectedSize(size);
      setEditorFontSize(size);
    };

    return (
      <div
        ref={ref}
        className="w-full rounded-lg border border-border bg-card p-4 space-y-4"
      >
        {/* Font Family Section */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Font</h3>
          <div className="flex flex-wrap gap-2">
            {fontFamilyOptions.map((option) => {
              const isSelected = selectedFont === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleFontSelect(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm border transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground",
                  )}
                  style={{
                    fontFamily:
                      option.value === "monospace"
                        ? "ui-monospace, monospace"
                        : `'${option.value}', monospace`,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Font Size</h3>
            <span className="text-sm text-muted-foreground">
              {selectedSize}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">12</span>
            <input
              type="range"
              min={12}
              max={24}
              value={selectedSize}
              onChange={handleSizeChange}
              className={cn(
                "flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer",
                "[&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:w-4",
                "[&::-webkit-slider-thumb]:h-4",
                "[&::-webkit-slider-thumb]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-primary",
                "[&::-webkit-slider-thumb]:cursor-pointer",
                "[&::-webkit-slider-thumb]:transition-all",
                "[&::-webkit-slider-thumb]:hover:scale-110",
                "[&::-moz-range-thumb]:w-4",
                "[&::-moz-range-thumb]:h-4",
                "[&::-moz-range-thumb]:rounded-full",
                "[&::-moz-range-thumb]:bg-primary",
                "[&::-moz-range-thumb]:border-0",
                "[&::-moz-range-thumb]:cursor-pointer",
              )}
            />
            <span className="text-xs text-muted-foreground">24</span>
          </div>
        </div>
      </div>
    );
  },
);

FontSettings.displayName = "FontSettings";
