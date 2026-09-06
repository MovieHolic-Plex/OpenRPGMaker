import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AiJobsRepository } from '../../../src/ai/jobs/contracts';
import type { AiJobsScheduler } from './scheduler.mjs';
export interface AiJobsHttpHandler {
  (req: IncomingMessage, res: ServerResponse, next?: () => void): void | Promise<void>;
  close(): void;
}
export function rejectSecrets(value: unknown): void;
export function createAiJobsHttpHandler(options: {
  readonly repository: AiJobsRepository;
  readonly scheduler: AiJobsScheduler;
  readonly origins: readonly string[] | (() => readonly string[]);
  readonly maxBodyBytes?: number;
  readonly onError?: (error: unknown) => void;
}): AiJobsHttpHandler;
