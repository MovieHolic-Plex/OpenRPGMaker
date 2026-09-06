import type { AiJobCheckpoint, AiJobFamily, AiJobInput, AiJobResult, AiProjectIdentity, ApplicationState, BlobRef, GenerationState, JsonObject, JsonValue, SaveState } from "./contracts";

export type ReportPhase = "before" | "generated" | "applied" | "applied-draft" | "staged";
export type PreviewStatus = "pending" | "ready" | "missing" | "unsupported" | "failed";
export interface ReportPreview {
  readonly id: string;
  readonly role: "map" | "artwork" | "atlas" | "crop" | "flow";
  readonly status: PreviewStatus;
  readonly source: BlobRef | null;
  readonly artifact: BlobRef | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly error: string | null;
}
export interface ReportSection {
  readonly id: string;
  readonly kind: "map" | "artwork" | "tileset" | "commands" | "quest" | "change";
  readonly objectId: string;
  readonly title: string;
  readonly phase: ReportPhase;
  readonly snapshot: BlobRef;
  /** Exact captured records, crop geometry, graph nodes/edges or command lists. Never a live lookup. */
  readonly data: JsonObject;
  readonly previews: readonly ReportPreview[];
}
export interface AppliedReportBinding {
  readonly status: "available" | "unavailable" | "not-applied";
  readonly scope: "project" | "draft" | null;
  readonly noChanges: boolean;
  readonly receiptId: string | null;
  readonly hashScheme: string | null;
  readonly artifact: BlobRef | null;
  readonly reason: string | null;
}
export interface JobReport {
  readonly version: 1;
  readonly kind: "ai-job-report";
  readonly jobId: string;
  readonly family: AiJobFamily;
  readonly project: AiProjectIdentity;
  readonly generationAttemptId: string | null;
  readonly source: "result" | "checkpoint" | "input";
  readonly checkpoint: BlobRef | null;
  readonly reportAttemptId: string;
  readonly input: BlobRef;
  readonly result: BlobRef | null;
  readonly baseSnapshot: BlobRef;
  readonly generatedSnapshot: BlobRef | null;
  readonly previous: BlobRef | null;
  readonly evidenceKey: string;
  readonly states: { readonly generation: GenerationState; readonly application: ApplicationState; readonly save: SaveState };
  readonly applied: AppliedReportBinding;
  readonly applicationEvidence: JsonObject | null;
  readonly saveEvidence: JsonObject | null;
  readonly output: JsonObject;
  readonly usage: JsonValue;
  readonly sections: readonly ReportSection[];
  /** Includes all historical revision/preview refs so old open reports remain accessible. */
  readonly artifacts: readonly BlobRef[];
  readonly failure: { readonly stage: "renderer"; readonly message: string } | null;
}
export interface ReportContext {
  readonly input: AiJobInput;
  readonly result: AiJobResult | null;
  readonly checkpoint: AiJobCheckpoint | null;
  readonly document: JobReport;
}
/** Submission callers pin bundled/raw artwork by image ID here; uploaded data URLs
 * already live inside the pinned snapshot. No URL is a report asset binding. */
export interface ReportAssetBindings { readonly [imageId: string]: BlobRef }
