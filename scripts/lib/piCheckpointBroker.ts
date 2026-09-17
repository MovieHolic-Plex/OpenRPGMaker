import type { Project } from "../../src/project/types.ts";
import type { PiAgentEvent, PiProjectCheckpoint } from "../../src/ai/piAgent/protocol.ts";

const pending = new Map<string, (decision: { ok: boolean; issue?: string; project?: Project }) => void>();
/** Random one-use capability, scoped to the connected run and retired on abort/timeout. */
export function resolvePiCheckpoint(id: string, decision: { ok: boolean; issue?: string; project?: Project }): boolean {
  const resolve = pending.get(id);
  if (!resolve) return false;
  pending.delete(id);
  resolve(decision);
  return true;
}
export function requestPiCheckpoint(checkpoint: PiProjectCheckpoint, emit: (event: PiAgentEvent) => void, signal: AbortSignal): Promise<Project | void> {
  signal.throwIfAborted();
  const checkpointId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { pending.delete(checkpointId); clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("적용 대기가 중단되었습니다.")); };
    const timer = setTimeout(abort, 30 * 60 * 1000);
    signal.addEventListener("abort", abort, { once: true });
    pending.set(checkpointId, decision => {
      cleanup();
      if (decision.ok) resolve(decision.project);
      else reject(new Error(decision.issue || "사용자가 적용을 중단했습니다."));
    });
    emit({ type: "checkpoint", checkpointId, ...checkpoint });
  });
}
