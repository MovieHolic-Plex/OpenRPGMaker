import type * as fs from 'node:fs/promises';
import type { AiJobsRepository } from '../../../src/ai/jobs/contracts';
export interface AiJobsRepositoryOptions {
  readonly directory: string;
  /** Fault-injection seam; omitted in production. All unspecified operations use node:fs. */
  readonly fileOps?: Partial<typeof fs>;
  readonly now?: () => number;
}
export type AiJobsRepositoryErrorCode = 'INVALID_DATA' | 'PERSISTENCE_FAILED' | 'DURABILITY_UNKNOWN' | 'CORRUPT_STORAGE' | 'WRITER_LOCKED' | 'REPOSITORY_CLOSED' | 'IDEMPOTENCY_CONFLICT';
export class AiJobsRepositoryError extends Error {
  constructor(code: AiJobsRepositoryErrorCode, message: string, options?: ErrorOptions);
  readonly code: AiJobsRepositoryErrorCode;
}
export function openAiJobsRepository(options: AiJobsRepositoryOptions): Promise<AiJobsRepository>;
