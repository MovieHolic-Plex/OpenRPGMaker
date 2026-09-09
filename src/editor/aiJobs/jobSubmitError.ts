export type JobSubmitCode = "unavailable" | "not-loaded" | "not-ready" | "capture-failed" | "admission-failed";

export class JobSubmitError extends Error {
  readonly name = "JobSubmitError";
  constructor(readonly code: JobSubmitCode, message: string) {
    super(message);
  }
}

export function jobSubmitMessage(error: unknown): string {
  if (error instanceof JobSubmitError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

export function assertNever(value: never): never {
  throw new JobSubmitError("not-ready", `Unexpected value: ${String(value)}`);
}
