import type { AiJob, AiJobFamily, AiJobsSnapshot } from '../../../src/ai/jobs/contracts';

type JobStates = Pick<AiJob, 'generation' | 'report' | 'application' | 'save'>;
export class AiJobsRepositoryError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: ErrorOptions);
}
export function requireValue(condition: unknown, message: string): void;
export const families: AiJobFamily[];
export function object(value: unknown): boolean;
export function keys(value: unknown, names: readonly string[]): void;
export function canonicalJson(value: unknown): string;
export function sha256(bytes: string | Uint8Array): string;
export function validateRef(value: unknown): void;
export function validateInput(value: unknown): void;
export function validateResult(value: unknown): void;
export function validateCheckpoint(value: unknown): void;
export function jobStates(job: JobStates): JobStates;
export function isOutcome(before: JobStates | null | undefined, after: JobStates): boolean;
export function validateSnapshot(value: unknown): void;
export function validateHistory(before: AiJobsSnapshot, after: AiJobsSnapshot): void;
