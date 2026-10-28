import type { Project } from "../../src/project/types.ts";
import type { PiAgentEvent, PiProjectCheckpoint } from "../../src/ai/piAgent/protocol.ts";

const pending = new Map<string, (decision: { ok: boolean; issue?: string; project?: Project }) => void>();
// 끊긴 소켓 뒤 재전달(ohMyPiPiAi workerJson)이 이미 받은 결정을 409 로 되돌리지 않게 최근 id 를 기억한다.
const resolved = new Set<string>();
/** Random one-use capability, scoped to the connected run and retired on abort/timeout. */
export function resolvePiCheckpoint(id: string, decision: { ok: boolean; issue?: string; project?: Project }): boolean {
  const resolve = pending.get(id);
  if (!resolve) return resolved.has(id);
  pending.delete(id);
  resolved.add(id);
  if (resolved.size > 256) resolved.delete(resolved.values().next().value!);
  resolve(decision);
  return true;
}
export function requestPiCheckpoint(checkpoint: PiProjectCheckpoint, emit: (event: PiAgentEvent) => void, signal: AbortSignal): Promise<Project | void> {
  signal.throwIfAborted();
  const checkpointId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { pending.delete(checkpointId); clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("적용 대기가 중단되었습니다.")); };
    // 30분은 «사람이 확인 카드에 답할 시간» 상한이다 — 적용 자체는 수 초다. 줄이지 않는다: 자리를 비운 사용자의 실행을 죽인다.
    // 이 대기가 30분 내내 멈춘 사고(2026-10-29 vm1 argon, 카드에 글로 답함)는 타이머가 아니라 카드·새 메시지의 맞물림이었고,
    // 보내기가 열린 카드를 먼저 닫아 푼다(src/editor/panels/aiDecisionPrompt.ts 「열린 카드 대장」).
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
