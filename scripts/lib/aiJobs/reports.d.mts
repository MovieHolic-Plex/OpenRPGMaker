import type { AiJob, AiJobCheckpoint, AiJobInput, AiJobResult, BlobRef } from '../../../src/ai/jobs/contracts';
import type { AppliedReportBinding, JobReport } from '../../../src/ai/jobs/reportModel';
export function reportEvidenceKey(job: AiJob): string;
export function appliedReportBinding(job: AiJob): AppliedReportBinding;
export function createReportShell(job: AiJob, result: AiJobResult | null, attemptId: string, previous: JobReport | null, input: AiJobInput, checkpoint: AiJobCheckpoint | null): JobReport;
export function validateReportDocument(document: JobReport, shell: JobReport, allowed: Map<string, BlobRef>): void;
