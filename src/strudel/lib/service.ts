"use client";

/**
 * Strudel Service V2
 *
 * Singleton service that manages all Strudel functionality:
 * - Audio engine initialization
 * - Code evaluation and playback
 * - StrudelMirror editor attachment and configuration
 */

import { evalScope } from "@strudel/core";
import { transpiler } from "@strudel/transpiler";
import {
  getAudioContext,
  initAudioOnFirstClick,
  registerSynthSounds,
  webaudioOutput,
} from "@strudel/webaudio";
import { prebake } from "@/strudel/lib/prebake";
import {
  StrudelMirror,
  StrudelMirrorOptions,
  StrudelReplState,
} from "@strudel/codemirror";
import { getDrawContext, setTheme } from "@strudel/draw";
import type {
  StrudelStorageAdapter,
  ReplSummary,
} from "@/hooks/use-strudel-storage";

type LoadingCallback = (status: string, progress: number) => void;
type CodeChangeCallback = (state: StrudelReplState) => void;

const DEFAULT_CODE = `// Welcome to StrudelLM!
// Write patterns here or ask the AI for help

// Example: A simple drum pattern
s("bd sd bd sd")
`;

export class StrudelService {
  private static _instance: StrudelService | null = null;

  // Audio engine state
  private isAudioInitialized = false;

  // Editor state
  private editorInstance: StrudelMirror | null = null;
  private containerElement: HTMLElement | null = null;
  private editorOptions: Omit<StrudelMirrorOptions, "root"> = {};

  // Callbacks
  private loadingCallbacks: LoadingCallback[] = [];
  private stateChangeCallbacks: CodeChangeCallback[] = [];

  // Repl state
  private _state: StrudelReplState = {
    code: DEFAULT_CODE,
    started: false,
  } as StrudelReplState;

  // Thread/REPL persistence state
  private currentThreadId: string | null = null;
  private currentReplId: string | null = null;
  private isInitializing = false;

  // Storage adapter (can be swapped for Jazz or localStorage)
  private storageAdapter: StrudelStorageAdapter | null = null;

  private constructor() {}

  /**
   * Get or create the singleton instance
   */
  static instance(): StrudelService {
    if (!StrudelService._instance) {
      StrudelService._instance = new StrudelService();
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
        (cb) => cb !== callback,
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
  // Code Persistence (REPL/Thread Model)
  // ============================================

  /**
   * Set the storage adapter (Jazz or localStorage)
   * Called from React components that have access to the useStrudelStorage hook
   */
  setStorageAdapter(adapter: StrudelStorageAdapter): void {
    this.storageAdapter = adapter;
  }

  /**
   * Check if storage is loaded (Jazz data synced)
   */
  get isStorageLoaded(): boolean {
    return this.storageAdapter?.isLoaded ?? false;
  }

  /**
   * Get the current REPL ID
   */
  getCurrentReplId(): string | null {
    return this.currentReplId;
  }

  /**
   * Get the REPL ID associated with a thread
   */
  getReplIdForThread(threadId: string): string | null {
    if (this.storageAdapter) {
      return this.storageAdapter.getThreadReplId(threadId);
    }
    return null;
  }

  /**
   * Check if a thread is attached to a different REPL than the current one
   */
  isThreadOnDifferentRepl(threadId: string): boolean {
    if (!this.currentReplId) return false;
    const threadReplId = this.getReplIdForThread(threadId);
    return threadReplId !== null && threadReplId !== this.currentReplId;
  }

  /**
   * Get all REPLs for tab display
   */
  getAllRepls(): ReplSummary[] {
    if (!this.storageAdapter) return [];
    return this.storageAdapter.getAllRepls();
  }

  /**
   * Delete a REPL by its ID
   */
  deleteRepl(replId: string): void {
    if (!this.storageAdapter) return;
    this.storageAdapter.deleteRepl(replId);
  }

  /**
   * Save current code to the active REPL
   */
  private saveCode(): void {
    if (typeof window === "undefined" || !this.currentReplId) return;

    // Use adapter if available
    if (this.storageAdapter) {
      this.storageAdapter.saveRepl(this.currentReplId, this._state.code);
      return;
    }
  }

  /**
   * Load code for a REPL
   */
  private loadReplCode(replId: string): string | null {
    if (this.storageAdapter) {
      const repl = this.storageAdapter.getRepl(replId);
      return repl?.code ?? null;
    }
    return null;
  }

  /**
   * Set the current REPL and load its code
   */
  setReplId(replId: string): void {
    if (replId === this.currentReplId) return;

    // Save current REPL's code before switching
    if (this.currentReplId) {
      this.saveCode();
    }

    this.currentReplId = replId;

    // Update active REPL in storage
    if (this.storageAdapter) {
      this.storageAdapter.setActiveReplId(replId);
    }

    // Load code for the REPL
    if (this.editorInstance) {
      const savedCode = this.loadReplCode(replId);
      if (savedCode) {
        this.setCode(savedCode);
      }
    }
  }

  /**
   * Set the current thread ID and ensure it's attached to the current REPL.
   * If the thread is attached to a different REPL, this will NOT switch REPLs.
   * Use setReplId() to switch REPLs explicitly.
   */
  setThreadId(threadId: string | null): void {
    if (threadId === this.currentThreadId) return;

    this.currentThreadId = threadId;

    // Attach thread to current REPL if we have one
    if (threadId && this.currentReplId && this.storageAdapter) {
      // Only attach if thread doesn't already have a REPL
      const existingReplId = this.storageAdapter.getThreadReplId(threadId);
      if (!existingReplId) {
        this.storageAdapter.attachThreadToRepl(threadId, this.currentReplId);
      }
    }
  }

  /**
   * Create a new REPL with the given code (or default) and set it as active.
   * Also attaches the current thread to the new REPL.
   */
  createNewRepl(code?: string): string | null {
    if (!this.storageAdapter) return null;

    // Save current REPL first
    if (this.currentReplId) {
      this.saveCode();
    }

    // Create new REPL
    const replId = this.storageAdapter.createRepl(code ?? DEFAULT_CODE);
    this.currentReplId = replId;
    this.storageAdapter.setActiveReplId(replId);

    // Load the code into the editor
    if (this.editorInstance) {
      this.setCode(code ?? DEFAULT_CODE);
    }

    // Attach current thread to new REPL
    if (this.currentThreadId) {
      this.storageAdapter.attachThreadToRepl(this.currentThreadId, replId);
    }

    return replId;
  }

  /**
   * Initialize REPL state - called on app startup.
   * Loads the active REPL or creates a new one.
   *
   * Priority:
   * 1. Use active REPL from localStorage if it exists in storage with real code
   * 2. Use the most recently updated REPL from Jazz with real code
   * 3. For anonymous users: create a new REPL
   * 4. For authenticated users: wait for Jazz sync (return null, sync will handle it)
   */
  initializeRepl(): string | null {
    if (!this.storageAdapter) {
      console.log("[Service.initializeRepl] No storage adapter");
      return null;
    }

    const isAuthenticated = this.storageAdapter.isAuthenticated;
    let replId = this.storageAdapter.getActiveReplId();
    console.log(
      "[Service.initializeRepl] Active REPL from localStorage:",
      replId,
      "isAuthenticated:",
      isAuthenticated,
    );

    // Helper to check if code is real (not default)
    const isRealCode = (code: string) => !code.includes("Welcome to StrudelLM");

    // Check if the active REPL from localStorage actually exists with real code
    if (replId) {
      const repl = this.storageAdapter.getRepl(replId);
      console.log(
        "[Service.initializeRepl] REPL exists in storage:",
        !!repl,
        repl?.code?.substring(0, 50),
      );
      if (repl && isRealCode(repl.code)) {
        // Found a valid REPL with real code
        this.currentReplId = replId;
        this.storageAdapter.setActiveReplId(replId);
        if (this.editorInstance) {
          this.setCode(repl.code);
        }
        return replId;
      }
      // REPL doesn't exist or only has default code
      replId = null;
    }

    // If no valid active REPL, try to get one from storage with real code
    const allRepls = this.storageAdapter.getAllRepls();
    console.log(
      "[Service.initializeRepl] All REPLs from storage:",
      allRepls.length,
    );

    for (const replSummary of allRepls) {
      const repl = this.storageAdapter.getRepl(replSummary.id);
      if (repl && isRealCode(repl.code)) {
        console.log(
          "[Service.initializeRepl] Found REPL with real code:",
          replSummary.id,
          repl.code.substring(0, 50),
        );
        this.currentReplId = replSummary.id;
        this.storageAdapter.setActiveReplId(replSummary.id);
        if (this.editorInstance) {
          this.setCode(repl.code);
        }
        return replSummary.id;
      }
    }

    // No REPLs with real code found
    // Use the first REPL if available (even with default code)
    if (allRepls.length > 0) {
      replId = allRepls[0].id;
      console.log("[Service.initializeRepl] Using first REPL:", replId);
      this.currentReplId = replId;
      this.storageAdapter.setActiveReplId(replId);
      // Also load the code into the editor
      const repl = this.storageAdapter.getRepl(replId);
      if (repl?.code && this.editorInstance) {
        this.setCode(repl.code);
      }
      return replId;
    }

    // No REPLs at all - StrudelStorageSync will handle creating one if needed
    console.log(
      "[Service.initializeRepl] No REPLs found, waiting for StrudelStorageSync",
    );
    return null;
  }

  // ============================================
  // State Change Callbacks
  // ============================================

  getReplState = (): StrudelReplState => {
    return this._state;
  };

  /**
   * Register a callback to receive state change notifications
   */
  onStateChange = (callback: CodeChangeCallback): (() => void) => {
    this.stateChangeCallbacks.push(callback);
    return () => {
      this.stateChangeCallbacks = this.stateChangeCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  };

  private notifyStateChange(state: StrudelReplState): void {
    this._state = state;
    this.stateChangeCallbacks.forEach((cb) => cb(state));

    // Auto-save on code change (skip during initialization)
    if (!this.isInitializing) {
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
      background: "var(--card-background)",
      foreground: "var(--card-foreground)",
      caret: "var(--muted-foreground)",
      selection: "color-mix(in oklch, var(--primary) 20%, transparent)",
      selectionMatch: "color-mix(in oklch, var(--primary) 20%, transparent)",
      lineHighlight: "color-mix(in oklch, var(--primary) 20%, transparent)",
      lineBackground:
        "color-mix(in oklch, var(--card-foreground) 20%, transparent)",
      gutterBackground: "transparent",
      gutterForeground: "var(--muted-foreground)",
    };
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
        .join("\n")}
    }`;
    setTheme(themeSettings);
  }

  prebake = async (): Promise<void> => {
    initAudioOnFirstClick(); // needed to make the browser happy (don't await this here..)

    let totalWeight = 0;
    let loadedWeight = 0;
    const loadAndReport = async <T>(
      p: Promise<T>,
      message: string,
      weight: number,
    ): Promise<T> => {
      totalWeight += weight;
      await p;
      loadedWeight += weight;
      const progress = Math.floor((loadedWeight / totalWeight) * 100);
      this.notifyLoading(message, progress);
      return p;
    };

    const core = loadAndReport(
      import("@strudel/core"),
      "Loaded core module",
      20,
    );
    const draw = loadAndReport(
      import("@strudel/draw"),
      "Loaded draw module",
      20,
    );
    const mini = loadAndReport(
      import("@strudel/mini"),
      "Loaded mini module",
      20,
    );
    const tonal = loadAndReport(
      import("@strudel/tonal"),
      "Loaded tonal module",
      20,
    );
    const webAudio = loadAndReport(
      import("@strudel/webaudio"),
      "Loaded webaudio module",
      20,
    );
    const loadModules = evalScope(core, draw, mini, tonal, webAudio);

    const sampleList = prebake().map(([name, sample]) => {
      return loadAndReport(sample, `Loaded sample: ${name}`, 30);
    });

    const synthSounds = loadAndReport(
      registerSynthSounds(),
      "Loaded synth sounds",
      30,
    );

    await Promise.all([loadModules, synthSounds, ...sampleList]);

    this.isAudioInitialized = true;
  };

  /**
   * Attach the StrudelMirror editor to an HTML element
   */
  attach = async (container: HTMLElement): Promise<void> => {
    const { StrudelMirror } = await import("@strudel/codemirror");

    // If already attached to this container, do nothing
    if (this.containerElement === container && this.editorInstance) {
      return;
    }

    this.isInitializing = true;

    try {
      // Preserve current code when reattaching to a new container
      const currentCode = this._state.code || DEFAULT_CODE;

      const oldEditor = this.editorInstance;
      this.containerElement = container;
      this.containerElement.innerHTML = "";

      // Create the editor
      this.editorInstance = new StrudelMirror({
        root: this.containerElement,
        initialCode: currentCode,
        transpiler,
        defaultOutput: webaudioOutput,
        getTime: () => getAudioContext().currentTime,
        drawTime: [0, -2],
        drawContext: getDrawContext(),
        onUpdateState: (state) => {
          this.notifyStateChange(state);
        },
        onError: (error: Error) => {
          // Capture runtime errors (including sample not found errors)
          // and propagate them through state
          const errorMessage = error.message || String(error);

          // Check if it's a sample-related error
          const isSampleError =
            errorMessage.toLowerCase().includes("sample") ||
            errorMessage.toLowerCase().includes("sound") ||
            errorMessage.toLowerCase().includes("not found");

          this._state = {
            ...this._state,
            schedulerError: isSampleError
              ? new Error(`Sample error: ${errorMessage}`)
              : error,
          };
          this.notifyStateChange(this._state);
        },
        prebake: this.prebake,
      });

      await this.prebake();

      if (oldEditor) {
        oldEditor.dispose?.();
      }

      // Sync the REPL's internal state with the editor's actual code
      // This is necessary because StrudelMirror doesn't sync initialCode to repl.state
      this.editorInstance.repl.setCode(currentCode);

      // Load saved code for current REPL if we don't already have code
      if (this.currentReplId && currentCode === DEFAULT_CODE) {
        const savedCode = this.loadReplCode(this.currentReplId);
        if (savedCode) {
          this.setCode(savedCode);
        }
      }

      this.fixTheme();
    } finally {
      this.isInitializing = false;
    }
    this.notifyLoading("Ready", 100);
    this.notifyStateChange(this.editorInstance.repl.state);
  };

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

  play = async (): Promise<void> => {
    return await this.editorInstance?.evaluate();
  };

  stop = (): void => {
    this.editorInstance?.repl.stop();
  };

  evaluate = async (code: string, play: boolean = false): Promise<void> => {
    const result = await this.editorInstance?.repl.evaluate(code, play);
    if (!result) {
      throw new Error(
        `Evaluation failed: ${this.editorInstance?.repl.state.evalError}`,
      );
    }
  };

  /**
   * Update the editor with new code and optionally play it
   * Used by external tools (like AI-generated updates)
   *
   * Validates that the code evaluates to a valid Strudel pattern
   * before applying and playing it.
   */
  updateAndPlay = async (code: string) => {
    try {
      await this.setCode(code);
      await this.play();

      // Check if there was an evaluation error after play
      const state = this.getReplState();
      if (state.evalError) {
        const errorMsg =
          typeof state.evalError === "string"
            ? state.evalError
            : state.evalError.message || String(state.evalError);
        return {
          success: false,
          error: `Evaluation error: ${errorMsg}\n\nCode:\n${code}`,
        };
      }

      // Check if the pattern is undefined (code didn't return a valid pattern)
      // This happens when code like `console.log("hello")` is executed
      const hasPatternField = Object.prototype.hasOwnProperty.call(
        state,
        "pattern",
      );
      if (
        hasPatternField &&
        state.pattern === undefined &&
        state.activeCode === code
      ) {
        return {
          success: false,
          error: `Code must return a valid Strudel pattern. Got 'undefined' instead. Make sure your code ends with a pattern expression like s("bd sd") or note("c3 e3 g3").\n\nCode:\n${code}`,
        };
      }

      return { success: true, code };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  };

  /**
   * Clear any existing errors in the state
   */
  clearError = (): void => {
    // Update state to clear errors
    this._state = {
      ...this._state,
      evalError: undefined,
      schedulerError: undefined,
    };
    this.notifyStateChange(this._state);
  };

  /**
   * Reset the editor to default code and stop playback
   */
  reset = (): void => {
    this.stop();
    this.clearError();
    this.setCode(DEFAULT_CODE);
  };

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
  }
}
