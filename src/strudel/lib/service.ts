"use client";

/**
 * Strudel Service V2
 *
 * Singleton service that manages all Strudel functionality:
 * - Audio engine initialization
 * - Code evaluation and playback
 * - StrudelMirror editor attachment and configuration
 */

import { prebake } from "@/strudel/lib/prebake";
import type {
  StrudelMirror,
  StrudelMirrorOptions,
  StrudelReplState,
} from "@strudel/codemirror";
import { isSampleErrorMessage as matchesSampleErrorMessage } from "@/strudel/lib/errors";
import { DEFAULT_KEYBINDINGS, getKeybindings } from "@/lib/editor-preferences";

type LoadingCallback = (status: string, progress: number) => void;
type CodeChangeCallback = (state: StrudelReplState) => void;

type UpdateSource = "ai" | "user";

export const DEFAULT_CODE = `// Welcome to StrudelLM!
// Write patterns here or ask the AI for help

// Example: Piano + drums with scope and pianoroll visualizations
// slider(initial, min, max, step) is a built-in UI control
stack(
  note("c3 e3 g3 b3")
    .s("piano")
    .gain(slider(0.5, 0, 1, 0.01))
    ._pianoroll({ fold: 1 }),
  s("bd sd [bd bd] sd")
    .gain(0.8)
    ._scope({ height: 80 })
)
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

  private isInitializing = false;
  private isRestartingEditor = false;

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
  // Code Persistence (Single REPL Model)
  // ============================================

  // Code persistence is now handled by StrudelStorageSync component
  // which directly syncs editor state with localStorage

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

    // Code persistence is now handled by StrudelStorageSync component
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

  /**
   * Apply theme settings to the Strudel editor and visualizations.
   * This method is async due to dynamic imports.
   *
   * IMPORTANT: This method must be awaited when called to ensure
   * the theme is properly applied before rendering.
   */
  async fixTheme(): Promise<void> {
    const { setTheme } = await import("@strudel/draw");

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
    const { initAudioOnFirstClick } = await import("@strudel/webaudio");
    const { evalScope } = await import("@strudel/core");
    const { registerSynthSounds } = await import("@strudel/webaudio");

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
    const { transpiler } = await import("@strudel/transpiler");
    const { webaudioOutput, getAudioContext } = await import("@strudel/webaudio");
    const { getDrawContext } = await import("@strudel/draw");

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

      // Code loading is now handled by StrudelStorageSync component

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
      await this.editorInstance?.evaluate();

      // Workaround for Strudel bug: when samples need to load, the scheduler
      // briefly stops which kills visualization animations. Re-evaluate after
      // a delay to restart them once samples are loaded.
      // See: https://github.com/tidalcycles/strudel/issues/XXX
      setTimeout(() => {
        if (this.isPlaying && this.editorInstance) {
          // Re-evaluate to restart visualization animations
          // The scheduler will continue playing, just the pattern updates
          this.editorInstance.evaluate();
        }
      }, 500);
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
