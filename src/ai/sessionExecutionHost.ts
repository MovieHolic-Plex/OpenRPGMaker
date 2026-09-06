import type { Project } from "@/project/types";
import type { IntentDeclaration } from "./intentDeclaration";
import type { ToolDomain, ToolContext } from "@/editor/tools/types";
import type { runTool } from "@/editor/tools/toolRunner";
import type { ApplyProposedProjectOptions, ApplyProposedProjectResult } from "@/editor/tools/applyChangesetToStore";
import type { AuditEntry, SessionEvent } from "./assistantSessionCore";

export interface SessionExecutionHost {
  readonly kind: "editor" | "job";
  readBaseline(): Project;
  checkpointMilestone(project: Project, metadata: ApplyProposedProjectOptions): Promise<ApplyProposedProjectResult | { readonly ok: true; readonly kind: "draft-checkpoint" }>;
  verifyPersistence(ctx: ToolContext, audit: (entry: AuditEntry) => void, event: (event: SessionEvent) => void): Promise<void>;
  activeDomains(intent: IntentDeclaration | null): Set<ToolDomain>;
  preferenceSection(scope?: string): string;
  budgetChars(fallback: number): number;
  recordTokens(observation: { promptChars: number; promptTokens: number; at: string }): void;
  runTool: typeof runTool;
  checkpointTools?(): Promise<void>;
  now(): Date;
}
