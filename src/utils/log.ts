// --- Structured logger with verbose gate ---
// INFO logs only appear when verbose=true.
// WARN and ERROR always appear.
// Format: [LEVEL][Component] message

let _verbose = false;

export function setVerbose(value: boolean): void {
  _verbose = value;
}

export function logInfo(component: string, message: string): void {
  if (_verbose) {
    console.log(`[INFO][${component}] ${message}`);
  }
}

export function logWarn(component: string, message: string): void {
  console.warn(`[WARN][${component}] ${message}`);
}

export function logError(component: string, message: string): void {
  console.error(`[ERROR][${component}] ${message}`);
}
