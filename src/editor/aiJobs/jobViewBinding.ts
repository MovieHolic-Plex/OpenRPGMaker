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

/**
 * 이 작업의 **결과가 프로젝트에 반영됐다** 는 사실 하나만 관찰한다. 새 이벤트/버스가 아니라
 * 기존 JobClient 변경 알림 + 기존 반영 상태(로컬 outcome 또는 서버 job.application)를 읽는다.
 *
 * 자동 반영(JobClient.reconcile)과 검토 반영(JobClient.apply)이 같은 신호로 모인다 — 앞면은
 * 「누가 적용했는가」가 아니라 「이 작업이 무엇을 바꿨는가」를 보여야 한다.
 */
export function bindJobApplied(
  jobId: string,
  onApplied: () => void,
  client: JobClient = getJobClient(),
): () => void {
  let done = false;
  const applied = (): boolean =>
    client.outcomes.get(jobId)?.application === "applied"
    || client.jobs.get(jobId)?.application === "applied";
  const check = (): void => {
    if (done || !applied()) return;
    done = true;
    off();
    onApplied();
  };
  const off = client.subscribe(check);
  check();
  return () => {
    done = true;
    off();
  };
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
