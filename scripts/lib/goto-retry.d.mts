// Type declarations for goto-retry.mjs (shared by the capture scripts and the e2e helpers).

export const TRANSIENT_NAVIGATION_NET_ERRORS: readonly string[];

export function isTransientNavigationError(error: unknown): boolean;

export interface GotoRetryOptions {
  /** Total navigation attempts, including the first one. Default 2. */
  attempts?: number;
  /** Pause between attempts in ms. Default 500. */
  delayMs?: number;
  /** Injectable sleep — tests pass a no-op so they do not wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Called before each retry with the swallowed error and the 1-based attempt that failed. */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Forwarded verbatim to `page.goto`. */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  timeout?: number;
  referer?: string;
}

export function gotoWithRetry<Response>(
  page: { goto: (url: string, options?: Record<string, unknown>) => Promise<Response> },
  url: string,
  options?: GotoRetryOptions,
): Promise<Response>;
