import type { AiJobsRepository, JsonValue } from '../../../src/ai/jobs/contracts';
import type { AiJobsRuntime, AiJobsScheduler } from './scheduler.mjs';
export const DUPLICATE_SPEND_ACKNOWLEDGED: 'duplicate-spend-acknowledged';
export class AiJobsServiceError extends Error {
  constructor(code: string, status: number, message: string);
  readonly code: string;
  readonly status: number;
}
export function conflict(code: string, message: string): never;
export function rejectSecrets(value: unknown): void;
export function createProviderOperations(options: { readonly repository: AiJobsRepository; readonly change: AiJobsScheduler['change']; readonly dispatchProvider?: AiJobsRuntime['dispatchProvider'] }): {
  run(operation: { readonly jobId: string; readonly attemptId: string; readonly key: string; readonly request: JsonValue; readonly signal: AbortSignal }): Promise<JsonValue>;
  drain(): Promise<void>;
};
