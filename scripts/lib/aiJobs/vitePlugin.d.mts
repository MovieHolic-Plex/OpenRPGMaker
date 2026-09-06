import type { Plugin } from 'vite';
import type { AiJobsRuntime } from './scheduler.mjs';
export function aiJobsPlugin(runtime?: AiJobsRuntime | ((options: { origin: () => string; cacheDir: string }) => Promise<AiJobsRuntime>)): Plugin;
