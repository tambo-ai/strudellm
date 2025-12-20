import { TamboTool } from "@tambo-ai/react";
import { z } from "zod/v3";

/**
 * listSamples tool
 *
 * Lists all available samples and sounds that can be used in Strudel patterns.
 * Queries the runtime soundMap to show exactly what's loaded.
 */
export const listSamples: TamboTool = {
  name: "listSamples",
  description:
    "List all available samples and sounds. Use this to discover what instruments, drum machines, and sounds are available. You can filter by category or search for specific sounds.",
  tool: async (
    category?: string
  ): Promise<string> => {
    // Import soundMap from superdough at runtime
    const { soundMap } = await import("superdough");

    const sounds = soundMap.get();
    const soundNames = Object.keys(sounds);

    // Categorize sounds
    const categories: Record<string, string[]> = {
      synths: [],
      drums: [],
      instruments: [],
      soundfonts: [],
      samples: [],
      other: [],
    };

    // Known synth waveforms
    const synthWaveforms = ['sine', 'sin', 'triangle', 'tri', 'square', 'sqr', 'sawtooth', 'saw', 'supersaw', 'pulse', 'sbd', 'bytebeat', 'white', 'pink', 'brown', 'crackle'];

    // Drum machine prefixes (from tidal-drum-machines)
    const drumPrefixes = ['roland', 'tr', 'linn', 'oberheim', 'dmx', 'emu', 'alesis', 'boss', 'korg', 'simmons', 'casio', 'yamaha', 'akai'];

    // Common drum sample names
    const drumSamples = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cb', 'cr', 'rd', 'ht', 'mt', 'lt', 'perc', 'tom'];

    for (const name of soundNames) {
      const lowerName = name.toLowerCase();

      // Check for synths
      if (synthWaveforms.includes(lowerName)) {
        categories.synths.push(name);
      }
      // Check for soundfonts (GM instruments)
      else if (lowerName.startsWith('gm_') || lowerName.includes('_sf2_')) {
        categories.soundfonts.push(name);
      }
      // Check for drum machines
      else if (drumPrefixes.some(prefix => lowerName.includes(prefix)) ||
               drumSamples.some(sample => lowerName === sample || lowerName.startsWith(sample + '_'))) {
        categories.drums.push(name);
      }
      // VCSL or orchestral
      else if (lowerName.includes('vcsl') || ['piano', 'violin', 'cello', 'flute', 'trumpet', 'timpani'].some(inst => lowerName.includes(inst))) {
        categories.instruments.push(name);
      }
      // Known sample packs
      else if (['casio', 'crow', 'insect', 'wind', 'jazz', 'metal', 'east', 'space', 'numbers', 'num'].includes(lowerName)) {
        categories.samples.push(name);
      }
      else {
        categories.other.push(name);
      }
    }

    // Filter by category if specified
    if (category) {
      const lowerCategory = category.toLowerCase();
      const matchedCategory = Object.keys(categories).find(cat =>
        cat.includes(lowerCategory) || lowerCategory.includes(cat)
      );

      if (matchedCategory && categories[matchedCategory].length > 0) {
        return `## ${matchedCategory.charAt(0).toUpperCase() + matchedCategory.slice(1)} (${categories[matchedCategory].length} sounds)\n\n${categories[matchedCategory].sort().join(', ')}`;
      }

      // Search by name
      const matches = soundNames.filter(name => name.toLowerCase().includes(lowerCategory));
      if (matches.length > 0) {
        return `## Search results for "${category}" (${matches.length} matches)\n\n${matches.sort().join(', ')}`;
      }

      return `No sounds found matching "${category}". Try one of: synths, drums, instruments, soundfonts, samples`;
    }

    // Return summary of all categories
    const output: string[] = [`## Available Sounds (${soundNames.length} total)\n`];

    for (const [cat, sounds] of Object.entries(categories)) {
      if (sounds.length > 0) {
        const preview = sounds.slice(0, 10).sort().join(', ');
        const more = sounds.length > 10 ? ` ... and ${sounds.length - 10} more` : '';
        output.push(`**${cat.charAt(0).toUpperCase() + cat.slice(1)}** (${sounds.length}): ${preview}${more}`);
      }
    }

    output.push(`\nUse listSamples with a category name (synths, drums, instruments, soundfonts, samples) or search term to see full lists.`);

    return output.join('\n');
  },
  toolSchema: z
    .function()
    .args(
      z.string().optional().describe(
        "Optional category to filter by (synths, drums, instruments, soundfonts, samples) or a search term to find specific sounds."
      ),
    )
    .returns(
      z.promise(
        z.string()
      ).describe("A formatted list of available sounds")
    ),
};
