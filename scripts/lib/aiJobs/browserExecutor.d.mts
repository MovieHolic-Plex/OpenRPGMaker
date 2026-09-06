import type { AiJobsRuntime } from './scheduler.mjs';
import type { BrowserType } from 'playwright';
export interface BrowserRuntimeOptions {
  origin: string | (() => string);
  executablePath?: string;
  chromium?: BrowserType;
  dispatchProvider?: AiJobsRuntime['dispatchProvider'];
}
export function createBrowserRuntime(options: BrowserRuntimeOptions): Promise<AiJobsRuntime>;
