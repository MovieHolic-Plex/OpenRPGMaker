import type { AiJobsRepository } from '../../../src/ai/jobs/contracts';
import type { AiJobsRuntime, AiJobsScheduler } from './scheduler.mjs';
import type { AiJobsHttpHandler } from './http.mjs';
export function aiJobsDirectory(root?: string): string;
export function openAiJobsService(options: AiJobsRuntime & {
  readonly directory: string;
  readonly origins: readonly string[] | (() => readonly string[]);
}): Promise<{ readonly repository: AiJobsRepository; readonly scheduler: AiJobsScheduler; readonly handler: AiJobsHttpHandler; close(): Promise<void> }>;
