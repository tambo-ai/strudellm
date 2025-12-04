import { StrudelService } from "@/strudel/lib/service";
import { TamboTool } from "@tambo-ai/react";
import { z } from "zod";

const service = StrudelService.instance();

/**
 * Extract sample/sound names from Strudel code
 * Looks for s("...") and sound("...") patterns
 */
function extractSampleNames(code: string): string[] {
  const samples: string[] = [];

  // Match s("...") or sound("...") patterns
  const sPattern = /(?:^|[^a-zA-Z])s\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  const soundPattern = /sound\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

  for (const pattern of [sPattern, soundPattern]) {
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
 * Check if samples exist in the soundMap
 */
async function validateSamples(sampleNames: string[]): Promise<string[]> {
  const { soundMap } = await import("superdough");
  const availableSounds = soundMap.get();
  const availableNames = new Set(Object.keys(availableSounds));

  // Known built-in functions/keywords to ignore
  const builtins = new Set(['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cb', 'cr', 'rd', 'ht', 'mt', 'lt', 'stack', 'cat', 'seq', 'note', 'n', 'gain', 'room', 'lpf', 'hpf', 'delay', 'pan', 'speed', 'begin', 'end', 'cut', 'bank', 'sound', 's']);

  const missing: string[] = [];
  for (const name of sampleNames) {
    // Skip if it's a builtin or if it exists in soundMap
    if (builtins.has(name.toLowerCase())) continue;
    if (availableNames.has(name)) continue;

    // Check if it might be a sample with bank (e.g., "RolandTR909_bd")
    const hasMatchingPrefix = [...availableNames].some(s =>
      s.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(s.toLowerCase())
    );
    if (hasMatchingPrefix) continue;

    missing.push(name);
  }

  return missing;
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
    code: string
  ): Promise<string> => {
    await service.init();

    // First check for missing samples before evaluating
    const sampleNames = extractSampleNames(code);
    if (sampleNames.length > 0) {
      const missingSamples = await validateSamples(sampleNames);
      if (missingSamples.length > 0) {
        return `Error: Unknown sample(s): ${missingSamples.join(', ')}. Use the listSamples tool to see available sounds.\n\nCode:\n${code}`;
      }
    }

    const result = await service.updateAndPlay(code);

    if (!result.success) {
      const errorMessage = result.error || 'Unknown error';
      // Return error as a string instead of throwing to avoid console noise
      // The AI will see this as the tool result and can fix the code
      return `Error: Strudel evaluation failed: ${errorMessage}\n\nCode:\n${code}`;
    }

    return "Pattern updated successfully";
  },
  toolSchema: z
    .function()
    .args(
      z.string().describe(
        "The Strudel/Tidal pattern code to evaluate and display. Examples: s('bd sd') for drums, note('c3 e3 g3') for melodies, stack() for layering patterns."
      ),
    )
    .returns(
      z.promise(
        z.string()
      ).describe("The response message")
    ),
};