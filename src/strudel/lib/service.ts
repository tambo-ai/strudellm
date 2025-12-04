/**
 * Strudel Service V2
 *
 * Singleton service that manages all Strudel functionality:
 * - Audio engine initialization
 * - Code evaluation and playback
 * - Code persistence (save/load per thread)
 * - StrudelMirror editor attachment and configuration
 */

import { evalScope } from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import { getAudioContext, initAudioOnFirstClick, registerSynthSounds, webaudioOutput } from "@strudel/webaudio";
import { prebake } from "@/strudel/lib/prebake";
import { StrudelMirror, StrudelMirrorOptions, StrudelReplState } from "@strudel/codemirror";
import { getDrawContext, setTheme } from "@strudel/draw";

type LoadingCallback = (status: string, progress: number) => void;
type CodeChangeCallback = (state: StrudelReplState) => void;

interface StrudelServiceOptions {
  storageKeyPrefix?: string;
}

const DEFAULT_CODE = `// Welcome to Strudel AI!
// Write patterns here or ask the AI for help

// Example: A simple drum pattern
s("bd sd bd sd")
`;

const DEFAULT_STORAGE_PREFIX = "strudel-ai-thread-";

export class StrudelService {
  private static _instance: StrudelService | null = null;
  
  // Audio engine state
  private isAudioInitialized = false;

  // Editor state
  private editorInstance: StrudelMirror | null = null;
  private containerElement: HTMLElement | null = null;
  private editorOptions: Omit<StrudelMirrorOptions, 'root'> = {};

  // Thread/persistence state
  private currentThreadId: string | null = null;
  private storageKeyPrefix: string;

  // Callbacks
  private loadingCallbacks: LoadingCallback[] = [];
  private stateChangeCallbacks: CodeChangeCallback[] = [];
  private _state: StrudelReplState = { code: DEFAULT_CODE, started: false } as StrudelReplState;

  private constructor(options: StrudelServiceOptions = {}) {
    this.storageKeyPrefix = options.storageKeyPrefix ?? DEFAULT_STORAGE_PREFIX;
  }

  /**
   * Get or create the singleton instance
   */
  static instance(options: StrudelServiceOptions = {}): StrudelService {
    if (!StrudelService._instance) {
      StrudelService._instance = new StrudelService(options);
    }

    return StrudelService._instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    if (StrudelService._instance) {
      StrudelService._instance.dispose();
      StrudelService._instance = null;
    }
  }

  // ============================================
  // Loading Progress
  // ============================================

  /**
   * Register a callback to receive loading progress updates
   */
  onLoadingProgress(callback: LoadingCallback): () => void {
    this.loadingCallbacks.push(callback);
    
    // Immediately notify if already initialized
    if (this.isReady) {
      callback("Ready", 100);
    }

    return () => {
      this.loadingCallbacks = this.loadingCallbacks?.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyLoading(status: string, progress: number): void {
    this.loadingCallbacks.forEach((cb) => cb(status, progress));
  }

  // ============================================
  // Audio Engine
  // ============================================

  async init(): Promise<void> {
    if (this.isReady) return;
    
    await this.attach(document.createElement("div"));

    // @ts-expect-error -- expose for debugging
    window.__strudel = this;
  }

  /**
   * Check if audio engine is initialized
   */
  get isReady(): boolean {
    return this.isAudioInitialized && this.editorInstance !== null;
  }

  /**
   * Check if currently playing
   */
  get isPlaying(): boolean {
    return this.editorInstance?.repl.scheduler.started || false;
  }

  // ============================================
  // Code Persistence
  // ============================================

  private getStorageKey(threadId: string): string {
    return `${this.storageKeyPrefix}${threadId}`;
  }

  /**
   * Load saved code for a thread from localStorage
   */
  getSavedCode = (threadId?: string): string | null => {
    if (typeof window === "undefined") return null;
    const currentThreadId = threadId || this.currentThreadId;
    if (!currentThreadId) return null;
    try {
      return localStorage.getItem(this.getStorageKey(currentThreadId));
    } catch {
      return null;
    }
  }

  loadCode = (): void => {
    if (typeof window === "undefined") return;
    if (!this.currentThreadId) return;
    if (!this.editorInstance) return;
    
    const savedCode = this.getSavedCode(this.currentThreadId) ?? DEFAULT_CODE;
    this.setCode(savedCode);
  }

  /**
   * Save code for a thread to localStorage
   */
  saveCode = (): void => {
    if (typeof window === "undefined") return;
    if (!this.currentThreadId) return;
    if (this.currentThreadId.includes("placeholder")) return;
    try {
      localStorage.setItem(this.getStorageKey(this.currentThreadId), this._state.code.toString());
    } catch {}
  }

  /**
   * Set the current thread ID and load its saved code
   */
  setThreadId = (threadId: string | null): void => {
    if (threadId === this.currentThreadId) {
      return;
    }

    this.currentThreadId = threadId;

    if (this.currentThreadId && this.editorInstance) {
      this.loadCode();
    }
  }

  /**
   * Get the current thread ID
   */
  getThreadId(): string | null {
    return this.currentThreadId;
  }

  // ============================================
  // State Change Callbacks
  // ============================================

  getReplState = (): StrudelReplState => {
    return this._state;
  }

  /**
   * Register a callback to receive state change notifications
   */
  onStateChange= (callback: CodeChangeCallback): () => void => {
    this.stateChangeCallbacks.push(callback);
    return () => {
      this.stateChangeCallbacks = this.stateChangeCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyStateChange(state: StrudelReplState): void {
    this._state = state;
    this.stateChangeCallbacks.forEach((cb) => cb(state));

    if (this.currentThreadId) {
      this.saveCode();
    }
  }

  // ============================================
  // Editor Management
  // ============================================

  /**
   * Set options for the StrudelMirror editor
   */
  setEditorOptions(options: Partial<StrudelMirrorOptions>): void {
    this.editorOptions = { ...this.editorOptions, ...options };

    // If editor is already attached, we'd need to recreate it
    // For now, options should be set before attach()
  }

  /**
   * Get current code from the editor
   */
  getCode(): string {
    if (!this.editorInstance) return DEFAULT_CODE;

    // Try to get from CodeMirror editor state first (most up-to-date)
    if (this.editorInstance.repl?.state?.code) {
      return this.editorInstance.repl.state.code;
    }

    // Fall back to the code property
    return this.editorInstance.code || DEFAULT_CODE;
  }

  /**
   * Set code in the editor
   */
  setCode(code: string): void {
    if (this.editorInstance) {
      this.editorInstance.setCode(code);
    }
  }

  fixTheme(): void {
   const themeSettings = {
      background: 'var(--card-background)',
      foreground: 'var(--card-foreground)',
      caret: 'var(--muted-foreground)',
      selection: 'color-mix(in oklch, var(--primary) 20%, transparent)',
      selectionMatch: 'color-mix(in oklch, var(--primary) 20%, transparent)',
      lineHighlight: 'color-mix(in oklch, var(--primary) 20%, transparent)',
      lineBackground: 'color-mix(in oklch, var(--card-foreground) 20%, transparent)',
      gutterBackground: 'transparent',
      gutterForeground: 'var(--muted-foreground)',
    }
    const styleID = "strudel-theme-vars";
    let styleEl = document.getElementById(styleID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleID;
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `:root .cm-editor {
      ${Object.entries(themeSettings)
        // important to override fallback
        .map(([key, value]) => `--${key}: ${value};`)
        .join('\n')}
    }`;
    setTheme(themeSettings);
  }

  /**
   * Attach the StrudelMirror editor to an HTML element
   */
  async attach(container: HTMLElement): Promise<void> {
    const { StrudelMirror } = await import("@strudel/codemirror");

    // If already attached to this container, do nothing
    if (this.containerElement === container && this.editorInstance) {
      return;
    }

    const oldEditor = this.editorInstance;
    this.containerElement = container;

    // Determine initial code
    this.loadCode();

    this.containerElement.innerHTML = "";

    const prebakePromise = async () => {
      initAudioOnFirstClick(); // needed to make the browser happy (don't await this here..)

      let totalWeight = 0;
      let loadedWeight = 0;
      const loadAndReport = async <T>(p: Promise<T>, message: string, weight: number): Promise<T> => {
        totalWeight += weight;
        await p;
        loadedWeight += weight;
        const progress = Math.floor((loadedWeight / totalWeight) * 100);
        this.notifyLoading(message, progress);
        return p;
      };

      const core = loadAndReport(import('@strudel/core'), "Loaded core module", 20);
      const draw = loadAndReport(import('@strudel/draw'), "Loaded draw module", 20);
      const mini = loadAndReport(import('@strudel/mini'), "Loaded mini module", 20);
      const tonal = loadAndReport(import('@strudel/tonal'), "Loaded tonal module", 20);
      const webAudio = loadAndReport(import('@strudel/webaudio'), "Loaded webaudio module", 20);
      const loadModules = evalScope(core, draw, mini, tonal, webAudio);

      const sampleList = prebake().map(([name, sample]) => {
        return loadAndReport(sample, `Loaded sample: ${name}`, 30);
      });
      
      const synthSounds = loadAndReport(registerSynthSounds(), "Loaded synth sounds", 30);
      
      await Promise.all([loadModules, synthSounds, ...sampleList]);
      this.isAudioInitialized = true;
      this.notifyLoading("Ready", 100);

      if (oldEditor) {
        oldEditor.dispose?.();
      }
    }

    // Create the editor
    const editor = new StrudelMirror({
      root: this.containerElement,
      initialCode: this.getSavedCode() ?? DEFAULT_CODE,
      transpiler,
      defaultOutput: webaudioOutput,
      getTime: () => getAudioContext().currentTime,
      drawTime: [0, -2],
      drawContext: getDrawContext(),
      onUpdateState: (state) => {
        this.notifyStateChange(state);
      },
      prebake: prebakePromise,
    });
    
    await prebakePromise();

    this.editorInstance = editor;
    this.fixTheme();
  }

  /**
   * Detach the editor from its container
   */
  detach(): void {
    if (this.editorInstance) {
      this.editorInstance.dispose?.();
      this.editorInstance = null;
    }

    if (this.containerElement) {
      this.containerElement.innerHTML = "";
      this.containerElement = null;
    }
  }

  /**
   * Check if editor is attached
   */
  get isAttached(): boolean {
    return this.editorInstance !== null;
  }

  // ============================================
  // Playback Control
  // ============================================

  play = (): void => {
    this.editorInstance?.evaluate();
  }
  
  stop = (): void => {
    this.editorInstance?.repl.stop();
  }

  evaluate = async (code: string, play: boolean = false): Promise<void> => {
    const result = await this.editorInstance?.repl.evaluate(code, play);
    if (!result) {
      throw new Error(`Evaluation failed: ${this.editorInstance?.repl.state.evalError}`);
    }
  }

  /**
   * Update the editor with new code and optionally play it
   * Used by external tools (like AI-generated updates)
   */
  updateAndPlay = async (
    code: string
  ) => {
    try {
      await this.evaluate(code);
      await this.setCode(code);
      this.play();
      return { success: true, code };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Reset the editor to default code and stop playback
   */
  reset = (): void => {
    this.stop();
    this.setCode(DEFAULT_CODE);
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop();
    this.detach();

    this.loadingCallbacks = [];
    this.stateChangeCallbacks = [];
    this.isAudioInitialized = false;
    this.currentThreadId = null;
  }
}
