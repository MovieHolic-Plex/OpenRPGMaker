/** Wire/disk version 1. No DOM, provider credentials, callbacks, or live store objects. */
export type JsonValue = null | boolean | number | string | JsonObject | readonly JsonValue[];
export interface JsonObject { readonly [key: string]: JsonValue }
export type AiJobFamily = 'assistant' | 'region' | 'database' | 'event-commands' | 'tileset' | 'image';
export interface BlobRef {
  readonly sha256: string;
  readonly byteLength: number;
  readonly mediaType: string;
}
/** backend is a stable backend namespace (e.g. Supabase origin), not an auth token.
 * Local projects use backend='local' and a persisted project UUID. */
export interface AiProjectIdentity {
  readonly backend: string;
  readonly projectId: string;
}
interface JobInputBase {
  readonly version: 1;
  readonly project: AiProjectIdentity;
  readonly projectSnapshot: BlobRef;
  readonly artwork: readonly BlobRef[];
  readonly target: JsonObject;
  readonly mode: string;
  /** Complete family request, including captured nonsecret provider settings/context.
   * Family adapters validate their semantic schema; the repository validates lossless JSON. */
  readonly payload: JsonObject;
  readonly dependsOn: readonly string[];
}
export type AiJobInput = {
  [F in AiJobFamily]: JobInputBase & { readonly family: F }
}[AiJobFamily];
interface JobResultBase {
  readonly version: 1;
  readonly jobId: string;
  readonly attemptId: string;
  readonly project: AiProjectIdentity;
  readonly baseSnapshot: BlobRef;
  readonly generatedSnapshot: BlobRef | null;
  readonly artifacts: readonly BlobRef[];
  readonly payload: JsonObject;
}
export type AiJobResult = {
  [F in AiJobFamily]: JobResultBase & { readonly family: F }
}[AiJobFamily];
export type GenerationState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
export type ReportState = 'pending' | 'running' | 'ready' | 'partial' | 'failed' | 'interrupted';
export type ApplicationState = 'not-requested' | 'awaiting-editor' | 'awaiting-review' | 'applying' | 'applied' | 'conflict' | 'outcome-unknown';
export type SaveState = 'not-requested' | 'unsaved' | 'saving' | 'saved' | 'failed' | 'unknown';
export interface AiJob {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly family: AiJobFamily;
  readonly project: AiProjectIdentity;
  readonly inputRef: BlobRef;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly generation: GenerationState;
  readonly report: ReportState;
  readonly application: ApplicationState;
  readonly save: SaveState;
  readonly activeAttemptId: string | null;
  readonly resultRef: BlobRef | null;
  readonly reportRef: BlobRef | null;
  readonly applicationEvidence: JsonObject | null;
  readonly saveEvidence: JsonObject | null;
}
export interface AiJobAttempt {
  readonly id: string;
  readonly jobId: string;
  readonly stage: 'generation' | 'report';
  readonly status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly error: string | null;
}
export interface AiProviderOperation {
  readonly id: string;
  readonly jobId: string;
  readonly attemptId: string;
  readonly kind: string;
  readonly status: 'prepared' | 'dispatched' | 'succeeded' | 'failed' | 'outcome-unknown';
  readonly requestRef: BlobRef;
  readonly responseRef: BlobRef | null;
  readonly error: string | null;
}
export interface AiJobEvent {
  readonly seq: number;
  readonly jobId: string;
  readonly kind: 'admitted' | 'updated' | 'outcome' | 'inbox-read';
  readonly createdAt: number;
  readonly states: {
    readonly generation: GenerationState;
    readonly report: ReportState;
    readonly application: ApplicationState;
    readonly save: SaveState;
  };
}
export interface AiJobInboxItem {
  readonly eventSeq: number;
  readonly jobId: string;
  readonly createdAt: number;
  readonly readAt: number | null;
}
export interface AiJobsSnapshot {
  readonly version: 1;
  readonly revision: number;
  readonly jobs: readonly AiJob[];
  readonly attempts: readonly AiJobAttempt[];
  readonly operations: readonly AiProviderOperation[];
  readonly events: readonly AiJobEvent[];
  readonly inbox: readonly AiJobInboxItem[];
}
/** Only the transaction callback owns mutable records. Events/inbox are repository-owned. */
export type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
export interface AiJobsDraft {
  jobs: Mutable<AiJob>[];
  attempts: Mutable<AiJobAttempt>[];
  operations: Mutable<AiProviderOperation>[];
}
export interface AiJobsRepository {
  snapshot(): AiJobsSnapshot;
  putBlob(bytes: Uint8Array, mediaType: string): Promise<BlobRef>;
  putJson(value: JsonValue): Promise<BlobRef>;
  readBlob(ref: BlobRef): Promise<Uint8Array>;
  readJson(ref: BlobRef): Promise<JsonValue>;
  admit(request: { readonly idempotencyKey: string; readonly input: AiJobInput }): Promise<{ readonly created: boolean; readonly job: AiJob }>;
  /** Synchronous callback; atomically updates records, appends events and deduplicated inbox outcomes.
   * Scheduler owns transitions/retry/fencing policy. Identity/history cannot be rewritten. */
  transaction(change: (draft: AiJobsDraft) => void): Promise<AiJobsSnapshot>;
  markInboxRead(eventSeq: number): Promise<AiJobsSnapshot>;
  close(): Promise<void>;
}
