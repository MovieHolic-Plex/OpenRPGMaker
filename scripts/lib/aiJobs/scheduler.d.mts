import type { AiJob, AiJobCheckpoint, AiJobEvent, AiJobInput, AiJobResult, AiJobsDraft, AiJobsRepository, AiJobsSnapshot, BlobRef, JsonValue } from '../../../src/ai/jobs/contracts';
export interface AiJobHost {
  readonly jobId: string;
  readonly attemptId: string;
  readonly dependencies: readonly AiJobResult[];
  readBlob(ref: BlobRef): Promise<Uint8Array>;
  readJson(ref: BlobRef): Promise<JsonValue>;
  putBlob(bytes: Uint8Array, mediaType: string): Promise<BlobRef>;
  putJson(value: JsonValue): Promise<BlobRef>;
  loadCheckpoint(): Promise<AiJobCheckpoint | null>;
  saveCheckpoint(checkpoint: Pick<AiJobCheckpoint, 'stageKey' | 'state' | 'artifacts'>): Promise<BlobRef>;
  /** Unique deterministic step path per job; replay MUST use identical request JSON. */
  providerOperation(operation: { readonly key: string; readonly request: JsonValue }): Promise<JsonValue>;
}
export interface AiReportHost extends Omit<AiJobHost, 'providerOperation' | 'loadCheckpoint' | 'saveCheckpoint'> {
  readonly report: import('../../../src/ai/jobs/reportModel').ReportContext;
  saveReport(document: import('../../../src/ai/jobs/reportModel').JobReport): Promise<BlobRef>;
}
export interface AiJobsRuntime {
  readonly unavailableReason?: string;
  readonly executeJob?: (input: AiJobInput, host: AiJobHost, signal: AbortSignal) => Promise<AiJobResult>;
  readonly renderReport?: (result: AiJobResult | null, host: AiReportHost, signal: AbortSignal) => Promise<{ readonly state: 'ready' | 'partial'; readonly document: import('../../../src/ai/jobs/reportModel').JobReport }>;
  /** Trusted Node-only adapter. Owns existing provider auth and accepts NO caller-selected fetch URL. */
  readonly dispatchProvider?: (request: JsonValue, context: { readonly jobId: string; readonly attemptId: string; readonly operationId: string; readonly key: string; readonly signal: AbortSignal }) => Promise<JsonValue>;
  readonly onError?: (error: unknown) => void;
}
export interface AiJobsScheduler {
  start(): void;
  available(stage?: 'generation' | 'report'): void;
  getJob(id: string): AiJob;
  change(callback: (draft: AiJobsDraft) => void): Promise<AiJobsSnapshot>;
  publish(): void;
  status(): { generationAvailable: boolean; reportAvailable: boolean; requiresRestart: boolean; unavailableReason?: string };
  subscribe(listener: (event: AiJobEvent) => void): () => void;
  admit(request: { readonly idempotencyKey: string; readonly input: AiJobInput }): Promise<{ readonly created: boolean; readonly job: AiJob }>;
  cancel(id: string): Promise<AiJob>;
  retry(id: string, options: { readonly stage: 'generation' | 'report'; readonly acknowledgeDuplicateSpend?: boolean }): Promise<AiJob>;
  markInboxRead(seq: number): Promise<AiJobsSnapshot>;
  close(): Promise<void>;
}
export function createAiJobsScheduler(options: AiJobsRuntime & { readonly repository: AiJobsRepository }): AiJobsScheduler;
