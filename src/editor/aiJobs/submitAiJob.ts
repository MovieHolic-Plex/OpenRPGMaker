import { randomUuid } from "@/util/id";
import type { AiJob } from "@/ai/jobs/contracts";
import { getJobClient, type JobAdmission, type JobClient } from "./jobClient";
import { JobSubmitError } from "./jobSubmitError";

export type JobAdmitFn = (request: JobAdmission, idempotencyKey: string) => Promise<{ job: AiJob; created: boolean }>;

export interface SubmitJobOptions {
  readonly client?: JobClient;
  readonly admit?: JobAdmitFn;
  readonly idempotencyKey?: string;
  readonly owner?: object;
  readonly fingerprint?: string;
}

type FrozenAdmission = {
  readonly fingerprint: string;
  readonly key: string;
};

const pendingKeys = new WeakMap<object, FrozenAdmission>();

export function stableIdempotencyKey(owner: object, fingerprint = "", create = randomUuid): string {
  const existing = pendingKeys.get(owner);
  if (existing && existing.fingerprint === fingerprint) return existing.key;
  const key = create();
  pendingKeys.set(owner, { fingerprint, key });
  return key;
}

export function clearIdempotencyKey(owner: object): void {
  pendingKeys.delete(owner);
}

export async function admitCapturedJob(
  request: JobAdmission,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string }> {
  const key = options.idempotencyKey
    ?? (options.owner ? stableIdempotencyKey(options.owner, options.fingerprint ?? "") : randomUuid());
  const admit = options.admit ?? ((body, idempotencyKey) => (options.client ?? getJobClient()).admit(body, idempotencyKey));
  try {
    const receipt = await admit(request, key);
    if (options.owner) clearIdempotencyKey(options.owner);
    return { ...receipt, idempotencyKey: key };
  } catch (error) {
    throw error instanceof JobSubmitError ? error : new JobSubmitError("admission-failed", error instanceof Error ? error.message : String(error));
  }
}
