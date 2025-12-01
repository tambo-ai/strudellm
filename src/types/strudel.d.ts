declare module "@strudel/web" {
  export function initStrudel(options?: {
    prebake?: () => Promise<unknown>;
    miniAllStrings?: boolean;
  }): Promise<unknown>;

  export function samples(source: string): Promise<unknown>;

  export function evaluate(code: string, autoplay?: boolean): Promise<unknown>;

  export function hush(): void;

  export function defaultPrebake(): Promise<void>;
}

declare module "@strudel/repl" {
  /** Load all default sample banks */
  export function prebake(): Promise<void>;
}

declare module "@strudel/webaudio" {
  /** Default audio output function */
  export function webaudioOutput(hap: unknown): void;

  /** Get the current audio context */
  export function getAudioContext(): AudioContext;

  /** Initialize audio on first user click (required for browsers) */
  export function initAudioOnFirstClick(): void;

  /** Register built-in synth sounds */
  export function registerSynthSounds(): Promise<void>;
}

declare module "@strudel/transpiler" {
  /** Strudel code transpiler */
  export function transpiler(code: string): string;
}

declare module "@strudel/core" {
  /** Register modules in evaluation scope */
  export function evalScope(
    ...modules: Promise<unknown>[]
  ): Promise<void>;
}

declare module "@strudel/soundfonts" {
  /** Register soundfont instruments */
  export function registerSoundfonts(): Promise<void>;
}

declare module "@strudel/mini" {
  // Mini notation module - exports are registered via evalScope
}

declare module "@strudel/tonal" {
  // Tonal music theory module - exports are registered via evalScope
}

declare module "@strudel/codemirror" {
  export interface StrudelMirrorOptions {
    /** The root element to attach the editor to */
    root: HTMLElement;
    /** Initial code to display */
    initialCode?: string;
    /** Default audio output function */
    defaultOutput?: (hap: unknown) => void;
    /** Function to get current playback time */
    getTime?: () => number;
    /** Code transpiler function */
    transpiler?: (code: string) => string;
    /** Time window for drawing [start, end] in seconds */
    drawTime?: [number, number];
    /** Prebake function for loading samples */
    prebake?: () => Promise<void>;
    /** Callback when code is evaluated */
    onEvaluate?: (code: string) => Promise<void>;
    /** Callback when playback is stopped */
    onStop?: () => void;
    /** Callback when code changes */
    onChange?: (code: string) => void;
    /** Callback for drawing visualization */
    onDraw?: (haps: unknown[], time: number) => void;
    /** Callback when an error occurs */
    onError?: (error: Error) => void;
  }

  export class StrudelMirror {
    constructor(options: StrudelMirrorOptions);
    /** Get the current code */
    get code(): string;
    /** Set the code in the editor */
    setCode(code: string): void;
    /** Start pattern evaluation */
    start(): Promise<void>;
    /** Stop pattern playback */
    stop(): void;
    /** Evaluate the current code */
    evaluate(): Promise<void>;
    /** Clean up the editor */
    dispose(): void;
    /** Get cursor location */
    getCursorLocation(): number;
    /** Set cursor location */
    setCursorLocation(position: number): void;
    /** Append code to the editor */
    appendCode(code: string): void;
    /** Set theme */
    setTheme(theme: string): void;
    /** Set font size */
    setFontSize(size: number): void;
    /** Enable/disable line wrapping */
    setLineWrappingEnabled(enabled: boolean): void;
    /** Enable/disable bracket matching */
    setBracketMatchingEnabled(enabled: boolean): void;
    /** Enable/disable line numbers */
    setLineNumbersDisplayed(displayed: boolean): void;
    /** Enable/disable bracket closing */
    setBracketClosingEnabled(enabled: boolean): void;
    /** Enable/disable autocompletion */
    setAutocompletionEnabled(enabled: boolean): void;
  }

  export function initEditor(options: StrudelMirrorOptions): StrudelMirror;
  export const themes: Record<string, unknown>;
  export const settings: Record<string, unknown>;
  export const defaultSettings: Record<string, unknown>;
}
