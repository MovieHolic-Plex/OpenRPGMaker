export function normalizeTestPath(name: unknown): string;

export function readVitestReport(report: unknown): { ran: string[]; failed: string[] } | null;

export function vitestFilesVerdict(input: {
  outcome: string;
  failedFiles?: readonly string[];
  ranFiles?: readonly string[] | null;
  baselineTests?: { failedFiles?: readonly string[]; failedFileTags?: Record<string, string> } | null;
}): {
  lines: string[];
  verdict: "CLEAN" | "NEW-FAIL" | "UNKNOWN";
  newFail: string[];
  knownFail: string[];
  nowPassing: string[];
};
