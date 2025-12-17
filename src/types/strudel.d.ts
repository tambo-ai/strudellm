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

  /** Alias a bank of samples from a URL */
  export function aliasBank(url: string): Promise<void>;

  /** Register built-in ZZFX sounds */
  export function registerZZFXSounds(): Promise<void>;

  /**
   * Loads a collection of samples to use with `s`
   * @example
   * samples('github:tidalcycles/dirt-samples');
   * s("[bd ~]*2, [~ hh]*2, ~ sd")
   * @example
   * samples({
   *  bd: '808bd/BD0000.WAV',
   *  sd: '808sd/SD0010.WAV'
   *  }, 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/');
   * s("[bd ~]*2, [~ hh]*2, ~ sd")
   * @example
   * samples('shabda:noise,chimp:2')
   * s("noise <chimp:0*2 chimp:1>")
   * @example
   * samples('shabda/speech/fr-FR/f:chocolat')
   * s("chocolat*4")
   */
  export function samples(
    source: string | { [key: string]: string[] },
    baseUrl?: string,
    options?: { prebake?: boolean; tag?: string },
  ): Promise<void>;
}

declare module "@strudel/transpiler" {
  /** Strudel code transpiler */
  export function transpiler(code: string): string;
}

declare module "@strudel/core" {
  /** Register modules in evaluation scope */
  export function evalScope(...modules: Promise<unknown>[]): Promise<void>;
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

declare module "@strudel/draw" {
  /** Draw haps visualization on a canvas */
  export function setTheme(settings: {
    background: string;
    foreground: string;
    caret: string;
    selection: string;
    selectionMatch: string;
    lineHighlight: string;
    lineBackground: string;
    gutterBackground: string;
    gutterForeground: string;
  }): void;

  /** Get drawing context for haps visualization */
  export function getDrawContext(): CanvasRenderingContext2D;
}

declare module "@strudel/codemirror" {
  import { ViewUpdate, EditorView } from "@codemirror/view";

  interface StrudelReplState {
    activeCode: string;
    code: string;
    pending: boolean;
    started: boolean;
    pattern?: unknown;
    evalError: Error | string | undefined;
    schedulerError: Error | string | undefined;
  }

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
    /** Canvas context for drawing visualizations */
    drawContext?: CanvasRenderingContext2D;
    /** Enable automatic drawing of visualizations */
    autodraw?: boolean;
    /** Fill background when drawing */
    bgFill?: boolean;
    /** Prebake function for loading samples */
    prebake?: () => Promise<void>;
    /** Callback when code is evaluated */
    onEvaluate?: (code: string) => Promise<void>;
    /** Callback when playback is stopped */
    onStop?: () => void;
    /** Callback when code changes */
    onChange?: (viewUpdate: ViewUpdate) => void;
    /** Callback for drawing visualization */
    onDraw?: (haps: unknown[], time: number) => void;
    /** Callback when an error occurs */
    onError?: (error: Error) => void;
    /** Callback when state changes */
    onUpdateState?: (state: StrudelReplState) => void;
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
    /** CodeMirror editor instance */
    editor: EditorView;
    /** Evaluate the current code */
    evaluate(): Promise<void>;
    /** Current editor state */
    repl: {
      evaluate: (code: string, autoplay: boolean) => Promise<void>;
      setCode: (b) => void;
      state: StrudelReplState;
      scheduler: {
        started: boolean;
      };
      start: () => void;
      pause: () => void;
      stop: () => void;
      toggle: () => void;
    };
    /** Set the editor state */
    setState(state: unknown): void;
    /** Toggle playback */
    toggle(): void;
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
