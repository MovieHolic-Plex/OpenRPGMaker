// 할 일 고리 갈고리(hook)의 발화 기록 — 갈고리마다 몇 번 불렸는지 세고, 부를 때마다 `v2.hook.<이름>` 상태를 남긴다.
// 측정(씬 벤치 terra 판)에서 갈고리별 효과를 가르려고 둔다: 판 기록(statusNotes)에서 이 이름들을 세면 된다.
// 이름: arg_fix(H2 고쳐 실행) · arg_reject(H2 실행 전 돌려보냄) · retry_fix(H2 실패 뒤 고쳐 다시) · next_call(H3 다음 호출 한 개)
//       · prefer(H3 다음 차례 동사 우선) · auto_check(H4 쓰기 직후 확인) · auto_done(H4 자동 끝) · skeleton(H1 요청 뼈대)
//       · scope(H5 동사 범위) · context(H6 문맥 정리) · reinject(H7 구체 재주입) · strategy(H8 전략 바꾸기)
import type { PiAgentEvent } from "@/ai/piAgent/protocol";

export type HookName = "arg_fix" | "arg_reject" | "retry_fix" | "next_call" | "prefer" | "prefer_forced" | "auto_check" | "auto_done"
  | "skeleton" | "scope" | "context" | "reinject" | "strategy" | "not_failure";

export class HookStats {
  readonly counts = new Map<HookName, number>();
  /** 상태를 내보낼 곳 — 실행기가 env.emit 을 건다. */
  emit?: (event: PiAgentEvent) => void;
  /** 발화 한 번. summary 는 사람이 읽는 한 줄(무엇을 왜). */
  fire(name: HookName, summary: string, data?: Record<string, unknown>): void {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
    this.emit?.({ type: "execution_status", name: `v2.hook.${name}`, ok: true, summary: summary.slice(0, 400), ...(data ? { data } : {}) } as PiAgentEvent);
  }
  toJSON(): Record<string, number> { return Object.fromEntries(this.counts); }
}
