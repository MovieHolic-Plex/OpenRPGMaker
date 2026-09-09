import type { AiJob, AiJobResult } from "@/ai/jobs/contracts";
import { getJobClient, type JobClient } from "./jobClient";

export function bindJobView(
  jobId: string,
  onJob: (job: AiJob) => void,
  client: JobClient = getJobClient(),
): () => void {
  const notify = (): void => {
    const job = client.jobs.get(jobId);
    if (job) onJob(job);
  };
  notify();
  return client.subscribe(notify);
}

export function whenJobGeneration(
  jobId: string,
  generation: AiJob["generation"] | readonly AiJob["generation"][],
  client: JobClient = getJobClient(),
  timeoutMs = 120_000,
): Promise<AiJob> {
  const wanted = typeof generation === "string" ? [generation] : generation;
  return new Promise((resolve, reject) => {
    const current = client.jobs.get(jobId);
    if (current && wanted.includes(current.generation)) {
      resolve(current);
      return;
    }
    const deadline = setTimeout(() => {
      off();
      reject(new Error(`Job ${jobId} did not reach ${wanted.join("|")}`));
    }, timeoutMs);
    const off = client.subscribe(() => {
      const job = client.jobs.get(jobId);
      if (job && wanted.includes(job.generation)) {
        clearTimeout(deadline);
        off();
        resolve(job);
      }
    });
  });
}

export async function readJobResult(job: AiJob, client: JobClient = getJobClient()): Promise<AiJobResult | null> {
  if (!job.resultRef) return null;
  return client.artifacts.json<AiJobResult>(job.id, job.resultRef);
}
