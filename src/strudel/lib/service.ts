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
import { isSampleErrorMessage as matchesSampleErrorMessage } from "@/strudel/lib/errors";
import type {
  StrudelStorageAdapter,
  ReplSummary,
} from "@/hooks/use-strudel-storage";
import { DEFAULT_KEYBINDINGS, getKeybindings } from "@/lib/editor-preferences";

type LoadingCallback = (status: string, progress: number) => void;
type CodeChangeCallback = (state: StrudelReplState) => void;

type UpdateSource = "ai" | "user";

const DEFAULT_CODE = `// Welcome to StrudelLM!
// Write patterns here or ask the AI for help

// Example: Synth line with scope + gain slider, and a pianoroll
// slider(initial, min, max, step) is a built-in UI control; pass its value to .gain
n("0 2 4 7")
  .s("sawtooth")
  .gain(slider(0.4, 0, 1, 0.01))
  ._scope({ height: 120, scale: 0.5 })

// Add a pianoroll visualization on a simple pattern
s("bd sd bd sd")._pianoroll({ fold: 1 })
`;

const ALLOWED_KEYBINDINGS = ["codemirror", "vim", "emacs", "vscode"] as const;

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
    missingSample: null,
    revertNotification: null,
  } as StrudelReplState;
  // Global handlers for async scheduler errors
  private unhandledRejectionHandler: ((
    event: PromiseRejectionEvent,
  ) => void) | null = null;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private originalConsoleError: ((...data: unknown[]) => void) | null = null;

  private revertNotificationId = 0;
  private updateOperationId = 0;
  private pendingSchedulerWaitCancel: (() => void) | null = null;

  // Thread/REPL persistence state
  private currentThreadId: string | null = null;
  private currentReplId: string | null = null;
  private isInitializing = false;
  private isRestartingEditor = false;

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

  /**
   * Clear the revert notification
   */
  clearRevertNotification = (): void => {
    this.notifyStateChange({ revertNotification: null });
  };

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

  private notifyStateChange(state: Partial<StrudelReplState>): void {
    const hasEvalError = Object.prototype.hasOwnProperty.call(state, "evalError");
    const hasSchedulerError = Object.prototype.hasOwnProperty.call(
      state,
      "schedulerError",
    );
    const hasMissingSample = Object.prototype.hasOwnProperty.call(
      state,
      "missingSample",
    );
    const hasRevertNotification = Object.prototype.hasOwnProperty.call(
      state,
      "revertNotification",
    );

    const mergedState: StrudelReplState = {
      ...this._state,
      ...state,
      // Preserve existing errors/missingSample unless new values are provided
      evalError: hasEvalError ? state.evalError : this._state.evalError,
      schedulerError: hasSchedulerError
        ? state.schedulerError
        : this._state.schedulerError,
      missingSample: hasMissingSample
        ? state.missingSample
        : this._state.missingSample,
      revertNotification: hasRevertNotification
        ? state.revertNotification
        : this._state.revertNotification,
    };

    this._state = mergedState;
    this.stateChangeCallbacks.forEach((cb) => cb(mergedState));

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

// Editor runtime restart (for keybindings)

  /**
   * Restart the editor runtime.
   * Used when changing keybindings which require recreating the editor.
   */
  async applyKeybindingsAndRestart(): Promise<void> {
    if (typeof window === "undefined") return;

    const container = this.containerElement;
    if (!container) return;
    if (this.isRestartingEditor || this.isInitializing) return;

    this.isRestartingEditor = true;

    // Get current state
    const wasPlaying = this.isPlaying;
    const stateBeforeRestart = { ...this._state };
    const currentCode = this.getCode();
    this._state = { ...this._state, code: currentCode };

    let didAttach = false;
    try {
      // Stop playback
      if (wasPlaying) {
        this.stop();
      }

      // Detach current editor
      this.detach();

      await this.attach(container);
      didAttach = true;

      // Restart playback if it was playing
      if (wasPlaying) {
        await this.play();
      }
    } catch (error) {
      if (!didAttach) {
        this.detach();

        try {
          this._state = { ...stateBeforeRestart, code: currentCode };
          await this.attach(container);
          if (wasPlaying) {
            await this.play();
          }
        } catch (restoreError) {
          console.error(
            "Failed to restore editor after restart failure:",
            restoreError,
          );
        }
      }
      console.error(
        "Failed to reattach editor after keybindings change:",
        error,
      );
      throw error;
    } finally {
      this.isRestartingEditor = false;
    }
  }

  /**
   * Normalize scheduler/runtime errors so they flow through the same path
   */
  private captureSchedulerError = (error: unknown): void => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const normalizedMessage = errorMessage || "Unknown error";

    const isSampleError = this.isSampleErrorMessage(normalizedMessage);
    const isAudioWorkletError = this.isAudioWorkletErrorMessage(normalizedMessage);

    // TODO: Some missing-sample errors still escape this path; investigate deeper Strudel scheduler/getTrigger flows.
    const normalizedError = isSampleError
      ? new Error(`Sample error: ${normalizedMessage}`)
      : isAudioWorkletError
        ? new Error(`Audio engine error: ${normalizedMessage}`)
        : error instanceof Error
          ? error
          : new Error(normalizedMessage);

    const missingSample = isSampleError
      ? this.extractMissingSampleName(normalizedMessage)
      : null;

    this.notifyStateChange({
      schedulerError: normalizedError,
      missingSample,
    });
  };

  private isSampleErrorMessage(message: string): boolean {
    return matchesSampleErrorMessage(message);
  }

  private isAudioWorkletErrorMessage(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes("audioworklet") ||
      lowerMessage.includes("audio worklet") ||
      lowerMessage.includes("workletnode") ||
      lowerMessage.includes("worklet node")
    );
  }

  private extractMissingSampleName(message: string): string | null {
    // Common formats:
    // "sound supersquare not found! Is it loaded?"
    // "sample foo not found"
    const match =
      /(?:sound|sample)\s+([a-zA-Z0-9-_]+)/i.exec(message) ||
      /"([^"]+)"\s+not\s+found/i.exec(message);

    if (match?.[1]) {
      return match[1];
    }
    return null;
  }

  private isResourceErrorMessage(message: string): boolean {
    return (
      this.isSampleErrorMessage(message) || this.isAudioWorkletErrorMessage(message)
    );
  }

  /**
   * Capture async Strudel scheduler promise rejections (e.g., missing samples)
   * and global errors that bypass evaluate/play try-catch flows.
   */
  private registerGlobalErrorHandlers(): void {
    if (typeof window === "undefined") return;

    if (!this.unhandledRejectionHandler) {
      this.unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
        const { reason } = event;
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "";

        const shouldHandle = !!message && this.isResourceErrorMessage(message);

        if (shouldHandle) {
          this.captureSchedulerError(reason);
        }
      };

      window.addEventListener("unhandledrejection", this.unhandledRejectionHandler, {
        capture: true,
      });
    }

    if (!this.errorHandler) {
      this.errorHandler = (event: ErrorEvent) => {
        const message = event.message || (event.error?.message ?? "");
        const shouldHandle = this.isResourceErrorMessage(message);

        if (shouldHandle) {
          this.captureSchedulerError(event.error || message);
        }
      };

      window.addEventListener("error", this.errorHandler, { capture: true });
    }
  }

  private unregisterGlobalErrorHandlers(): void {
    if (typeof window === "undefined") return;

    if (this.unhandledRejectionHandler) {
      window.removeEventListener("unhandledrejection", this.unhandledRejectionHandler, {
        capture: true,
      });
      this.unhandledRejectionHandler = null;
    }

    if (this.errorHandler) {
      window.removeEventListener("error", this.errorHandler, { capture: true });
      this.errorHandler = null;
    }
  }

  /**
   * Strudel's internal errorLogger uses console.error in development.
   * Filter out sample-not-found noise while keeping other errors visible.
   */
  private installConsoleErrorFilter(): void {
    if (process.env.NODE_ENV !== "development") return;
    if (this.originalConsoleError || typeof console === "undefined") return;

    this.originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const joinedMessage = args
        .map((arg) => {
          if (arg instanceof Error) return arg.message;
          if (typeof arg === "string") return arg;
          return "";
        })
        .join(" ");

      if (joinedMessage && this.isResourceErrorMessage(joinedMessage)) {
        return; // swallow sample/audio engine noise
      }

      this.originalConsoleError?.(...args);
    };
  }

  private removeConsoleErrorFilter(): void {
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
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
    const codemirror = loadAndReport(
      import("@strudel/codemirror"),
      "Loaded codemirror helpers",
      10,
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
    const loadModules = evalScope(core, codemirror, draw, mini, tonal, webAudio);

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
          this.captureSchedulerError(error);
        },
        prebake: this.prebake,
      });

const keybindings = getKeybindings();
      const resolvedKeybindings =
        keybindings &&
        (ALLOWED_KEYBINDINGS as readonly string[]).includes(keybindings)
          ? keybindings
          : DEFAULT_KEYBINDINGS;

      if (typeof this.editorInstance.changeSetting === "function") {
        this.editorInstance.changeSetting("keybindings", resolvedKeybindings);
      }
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
    this.pendingSchedulerWaitCancel?.();
    this.unregisterGlobalErrorHandlers();
    this.removeConsoleErrorFilter();

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
    this.registerGlobalErrorHandlers();
    this.installConsoleErrorFilter();
    try {
      return await this.editorInstance?.evaluate();
    } catch (error) {
      // Capture runtime errors (like "sound X not found") that are thrown
      // during evaluate. The onError callback should also capture these,
      // but we catch here to prevent unhandled rejections.
      this.captureSchedulerError(error);
      this.unregisterGlobalErrorHandlers();
      this.removeConsoleErrorFilter();
      throw error;
    }
  };

  stop = (): void => {
    this.editorInstance?.repl.stop();
    this.pendingSchedulerWaitCancel?.();
    this.unregisterGlobalErrorHandlers();
    this.removeConsoleErrorFilter();
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
   * Wait for potential scheduler errors that occur asynchronously
   * after evaluate() returns but before audio actually plays.
   * Returns the error if one occurs within the timeout, or null.
   */
  private waitForSchedulerError = (
    operationId: number,
    timeoutMs: number = 500,
  ): Promise<Error | string | null> => {
    return new Promise((resolve) => {
      let resolved = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      let unsubscribe = () => {};

      const cancel = () => {
        if (resolved) return;
        resolved = true;
        unsubscribe();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (this.pendingSchedulerWaitCancel === cancel) {
          this.pendingSchedulerWaitCancel = null;
        }
        resolve(null);
      };

      // Set up a one-time listener for state changes
      unsubscribe = this.onStateChange((state) => {
        if (operationId !== this.updateOperationId) {
          cancel();
          return;
        }

        if (!resolved && state.schedulerError) {
          resolved = true;
          unsubscribe();
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (this.pendingSchedulerWaitCancel === cancel) {
            this.pendingSchedulerWaitCancel = null;
          }
          resolve(state.schedulerError);
        }
      });

      // After timeout, resolve with null (no error) or current error
      timeoutId = setTimeout(() => {
        if (operationId !== this.updateOperationId) {
          cancel();
          return;
        }

        if (!resolved) {
          resolved = true;
          unsubscribe();
          if (this.pendingSchedulerWaitCancel === cancel) {
            this.pendingSchedulerWaitCancel = null;
          }
          // Check one more time for any error that might have been set
          resolve(this._state.schedulerError ?? null);
        }
      }, timeoutMs);

      this.pendingSchedulerWaitCancel?.();
      this.pendingSchedulerWaitCancel = cancel;
    });
  };

  /**
   * Update the editor with new code and play it
   * Used by external tools (like AI-generated updates)
   *
   * Validates that the code evaluates to a valid Strudel pattern
   * before applying and playing it. If the code fails, reverts to
   * the previous working code and restarts playback if it was playing.
   */
  updateAndPlay = async (
    code: string,
    options?: {
      source?: UpdateSource;
    },
  ) => {
    const source = options?.source ?? "user";

    this.updateOperationId += 1;
    const operationId = this.updateOperationId;

    // Save current state before attempting update
    const previousCode = this.getCode();
    const wasPlaying = this.isPlaying;

    try {
      // Stop playback first to avoid partial broken state
      if (wasPlaying) {
        this.stop();
      }

      // Clear any previous errors
      this.clearError();

      // Set the new code
      this.setCode(code);

      // Try to evaluate/play the new code
      await this.play();

      if (operationId !== this.updateOperationId) {
        return { success: false, error: "Update superseded by a newer update." };
      }

      // Check if there was an immediate evaluation error
      const state = this.getReplState();
      if (state.evalError) {
        const errorMsg =
          typeof state.evalError === "string"
            ? state.evalError
            : state.evalError.message || String(state.evalError);

        // Revert to previous working code
        if (operationId === this.updateOperationId) {
          await this.revertToCode(previousCode, wasPlaying, source);
        }

        return {
          success: false,
          error: `Evaluation error: ${errorMsg}\n\nCode:\n${code}`,
        };
      }

      // Wait for potential async scheduler errors (like "sound X not found")
      // These happen when the scheduler starts playing and discovers missing samples
      const schedulerError = await this.waitForSchedulerError(operationId, 500);

      if (operationId !== this.updateOperationId) {
        return { success: false, error: "Update superseded by a newer update." };
      }
      if (schedulerError) {
        const errorMsg =
          typeof schedulerError === "string"
            ? schedulerError
            : schedulerError.message || String(schedulerError);

        // Revert to previous working code
        if (operationId === this.updateOperationId) {
          await this.revertToCode(previousCode, wasPlaying, source);
        }

        return {
          success: false,
          error: `Runtime error: ${errorMsg}\n\nCode:\n${code}`,
        };
      }

      // Re-check state after waiting for scheduler errors
      const finalState = this.getReplState();

      // Check if the pattern is undefined (code didn't return a valid pattern)
      // This happens when code like `console.log("hello")` is executed
      const hasPatternField = Object.prototype.hasOwnProperty.call(
        finalState,
        "pattern",
      );
      if (
        hasPatternField &&
        finalState.pattern === undefined &&
        finalState.activeCode === code
      ) {
        // Revert to previous working code
        if (operationId === this.updateOperationId) {
          await this.revertToCode(previousCode, wasPlaying, source);
        }

        return {
          success: false,
          error: `Code must return a valid Strudel pattern. Got 'undefined' instead. Make sure your code ends with a pattern expression like s("bd sd") or note("c3 e3 g3").\n\nCode:\n${code}`,
        };
      }

      return { success: true, code };
    } catch (error) {
      // On any error, revert to previous working code
      if (operationId === this.updateOperationId) {
        await this.revertToCode(previousCode, wasPlaying, source);
      } else {
        console.warn(
          "[StrudelService] updateAndPlay: superseded operation error:",
          error,
        );
      }

      return { success: false, error: (error as Error).message };
    }
  };

  /**
   * Revert to a previous code state and optionally restart playback
   * Used internally by updateAndPlay when new code fails
   */
  private revertToCode = async (
    code: string,
    restartPlayback: boolean,
    source: UpdateSource,
  ): Promise<void> => {
    // Stop any current playback
    this.stop();

    // Clear errors from the failed attempt
    this.clearError();

    if (source === "ai") {
      this.revertNotificationId += 1;
      this.notifyStateChange({
        revertNotification: {
          id: this.revertNotificationId,
          message: "That update didn't play. Reverted to the last working pattern.",
        },
      });
    }

    // Restore the previous code
    this.setCode(code);

    // Restart playback if it was playing before
    if (restartPlayback) {
      try {
        await this.play();
      } catch {
        // If restart fails, just leave it stopped
        console.warn("[StrudelService] Failed to restart playback after revert");
      }
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
      missingSample: null,
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
    this.unregisterGlobalErrorHandlers();
    this.removeConsoleErrorFilter();

    this.loadingCallbacks = [];
    this.stateChangeCallbacks = [];
    this.isAudioInitialized = false;
  }
}
