/**
 * Strudel Service
 *
 * Manages Strudel initialization and provides evaluate/hush functions.
 * Used by both the REPL component and the updateRepl tool.
 */

type EvaluateFunction = (code: string) => Promise<unknown>;
type HushFunction = () => void;
type CodeUpdateCallback = (code: string) => void;
type LoadingCallback = (status: string, progress: number) => void;

// Module-level state
let strudelEvaluate: EvaluateFunction | null = null;
let strudelHush: HushFunction | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// Callback for updating the REPL code
let codeUpdateCallback: CodeUpdateCallback | null = null;

// Loading callbacks
let loadingCallbacks: LoadingCallback[] = [];

/**
 * Register a callback to receive loading progress updates
 */
export function onLoadingProgress(callback: LoadingCallback): () => void {
  loadingCallbacks.push(callback);
  return () => {
    loadingCallbacks = loadingCallbacks.filter((cb) => cb !== callback);
  };
}

function notifyLoading(status: string, progress: number) {
  loadingCallbacks.forEach((cb) => cb(status, progress));
}

/**
 * Initialize Strudel audio engine with full sample loading
 */
export async function initStrudel(): Promise<void> {
  if (isInitialized) return;

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    notifyLoading("Loading Strudel engine...", 5);

    notifyLoading("Loading audio modules...", 15);

    const {
      initStrudel: init,
      evaluate,
      hush,
      samples,
    } = await import("@strudel/web");

    notifyLoading("Initializing audio context...", 25);

    // Initialize core engine
    await init();

    notifyLoading("Loading sample banks...", 35);

    // Load default drum samples from strudel's CDN
    await samples("github:tidalcycles/Dirt-Samples/master");

    notifyLoading("Samples loaded", 90);

    strudelEvaluate = evaluate;
    strudelHush = hush;
    isInitialized = true;

    notifyLoading("Ready", 100);
  })();

  return initPromise;
}

/**
 * Check if Strudel is initialized
 */
export function isStrudelInitialized(): boolean {
  return isInitialized;
}

/**
 * Evaluate Strudel code
 * Returns the pattern on success, undefined on error
 */
export async function evaluate(code: string): Promise<unknown> {
  if (!strudelEvaluate) {
    throw new Error("Strudel not initialized");
  }
  return strudelEvaluate(code);
}

/**
 * Stop all playing patterns
 */
export function hush(): void {
  if (strudelHush) {
    strudelHush();
  }
}

/**
 * Register a callback to receive code updates from the tool
 */
export function registerCodeUpdateCallback(
  callback: CodeUpdateCallback
): () => void {
  codeUpdateCallback = callback;
  // Return cleanup function
  return () => {
    if (codeUpdateCallback === callback) {
      codeUpdateCallback = null;
    }
  };
}

/**
 * Update the REPL code (called by the tool after validation)
 */
export function updateCode(code: string): void {
  if (codeUpdateCallback) {
    codeUpdateCallback(code);
  }
}

/**
 * Validate and update the REPL with new code
 * This is the main function used by the updateRepl tool
 *
 * @throws Error if the code is invalid
 */
export async function validateAndUpdateRepl(
  code: string
): Promise<{ success: true; code: string }> {
  // Ensure Strudel is initialized
  await initStrudel();

  // Validate by evaluating the code
  const result = await evaluate(code);

  if (result === undefined) {
    // Evaluation failed - Strudel caught an error internally
    throw new Error(
      `Invalid Strudel pattern. The code "${code}" contains syntax errors or undefined functions. Please check the pattern syntax.`
    );
  }

  // Code is valid - update the REPL
  updateCode(code);

  return { success: true, code };
}
