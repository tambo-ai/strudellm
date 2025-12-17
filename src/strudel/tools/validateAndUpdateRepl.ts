import { StrudelService } from "@/strudel/lib/service";
import { TamboTool } from "@tambo-ai/react";
import { z } from "zod/v3";

const service = StrudelService.instance();

/**
 * Extract sample/sound names from Strudel code
 * Looks for s("..."), sound("..."), and .s("...") patterns
 */
function extractSampleNames(code: string): string[] {
  const samples: string[] = [];

  // Match various sample patterns:
  // - s("...") - standalone s function
  // - sound("...") - sound function
  // - .s("...") - method chain .s()
  // - .sound("...") - method chain .sound()
  const patterns = [
    /(?:^|[^a-zA-Z])s\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, // s("...")
    /sound\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, // sound("...")
    /\.s\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, // .s("...")
    /\.sound\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, // .sound("...")
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      // Split the pattern string and extract sample names
      // e.g., "bd sd hh" -> ["bd", "sd", "hh"]
      const patternStr = match[1];
      // Extract words that could be sample names (ignore operators like ~ | [ ] < > etc)
      const words = patternStr.match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
      samples.push(...words);
    }
  }

  return [...new Set(samples)]; // dedupe
}

/**
 * Find similar sample names using simple string matching
 */
function findSimilarSamples(
  name: string,
  availableNames: Set<string>,
  limit: number = 3,
): string[] {
  const lowerName = name.toLowerCase();
  const similar: Array<{ name: string; score: number }> = [];

  for (const available of availableNames) {
    const lowerAvailable = available.toLowerCase();

    // Check for partial matches
    if (
      lowerAvailable.includes(lowerName) ||
      lowerName.includes(lowerAvailable)
    ) {
      similar.push({ name: available, score: 2 });
    } else if (lowerAvailable.startsWith(lowerName.slice(0, 2))) {
      // Check for same starting letters
      similar.push({ name: available, score: 1 });
    }
  }

  return similar
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.name);
}

/**
 * Check if samples exist in the soundMap
 * Returns an object with missing samples and suggestions
 */
async function validateSamples(
  sampleNames: string[],
): Promise<{ missing: string[]; suggestions: Map<string, string[]> }> {
  const { soundMap } = await import("superdough");
  const availableSounds = soundMap.get();
  const availableNames = new Set(Object.keys(availableSounds));

  // Pre-compute lowercase names array once for fuzzy matching
  const availableNamesLower = [...availableNames].map((n) => ({
    original: n,
    lower: n.toLowerCase(),
  }));

  // Known built-in functions/keywords to ignore
  const builtins = new Set([
    "bd",
    "sd",
    "hh",
    "oh",
    "cp",
    "rim",
    "cb",
    "cr",
    "rd",
    "ht",
    "mt",
    "lt",
    "stack",
    "cat",
    "seq",
    "note",
    "n",
    "gain",
    "room",
    "lpf",
    "hpf",
    "delay",
    "pan",
    "speed",
    "begin",
    "end",
    "cut",
    "bank",
    "sound",
    "s",
  ]);

  const missing: string[] = [];
  const suggestions = new Map<string, string[]>();

  for (const name of sampleNames) {
    // Skip if it's a builtin or if it exists in soundMap
    if (builtins.has(name.toLowerCase())) continue;
    if (availableNames.has(name)) continue;

    // Check if it might be a sample with bank (e.g., "RolandTR909_bd")
    // Use pre-computed lowercase array for O(n) instead of O(n) per iteration
    const nameLower = name.toLowerCase();
    const hasMatchingPrefix = availableNamesLower.some(
      ({ lower }) => lower.includes(nameLower) || nameLower.includes(lower),
    );
    if (hasMatchingPrefix) continue;

    missing.push(name);

    // Find similar samples to suggest
    const similar = findSimilarSamples(name, availableNames);
    if (similar.length > 0) {
      suggestions.set(name, similar);
    }
  }

  return { missing, suggestions };
}

/**
 * validateAndUpdateRepl tool
 *
 * Validates Strudel code by evaluating it, then updates the REPL if valid.
 * If the code contains errors, the tool throws an error so the AI can fix it.
 */
export const validateAndUpdateRepl: TamboTool = {
  name: "updateRepl",
  description:
    "Update the Strudel REPL with new pattern code. The code is validated by running it through Strudel's evaluator first. If the code is invalid, the tool will fail with the exact error message from the evaluator. Fix the error and try again. Make sure the code and sequences are in the same key/scale and don't produce anything that will sound dissonant.",
  tool: async (
    code: string,
  ): Promise<{ success: boolean; code?: string; error?: string }> => {
    await service.init();

    // First check for missing samples before evaluating
    const sampleNames = extractSampleNames(code);
    if (sampleNames.length > 0) {
      const { missing, suggestions } = await validateSamples(sampleNames);
      if (missing.length > 0) {
        // Build error message with suggestions
        let errorMsg = `Error: Unknown sample(s): ${missing.join(", ")}.`;

        // Add suggestions for each missing sample
        for (const [sample, similar] of suggestions) {
          if (similar.length > 0) {
            errorMsg += `\n  - "${sample}" - did you mean: ${similar.join(", ")}?`;
          }
        }

        errorMsg += `\n\nUse the listSamples tool to see available sounds.\n\nCode:\n${code}`;

        return {
          success: false,
          error: errorMsg,
        };
      }
    }

    const result = await service.updateAndPlay(code);

    return result;
  },
  toolSchema: z
    .function()
    .args(
      z
        .string()
        .describe(
          "The Strudel/Tidal pattern code to evaluate and display. Examples: s('bd sd') for drums, note('c3 e3 g3') for melodies, stack() for layering patterns.",
        ),
    )
    .returns(
      z.promise(
        z.object({
          success: z.boolean(),
          code: z.string().optional(),
          error: z.string().optional(),
        }),
      ),
    ),
};
