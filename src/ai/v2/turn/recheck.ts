// 모델이 멈출 때마다 기계 확인을 다시 재고(끝난 항목이 ✗ 면 다시 열고 막힌 항목이 ✓ 면 닫는다), 할 일 상태를 프로젝트에 싣는다. 2026-11-11 리팩토링 R3: runAssistantV2 에서 옮겼다.
import { saveVqaBook } from "./vqaItems";
import { stampTargets } from "./carryOver";
import type { PiAssistantV2Env } from "../env";
import { TODO_MAX_ATTEMPTS, isOpen } from "../loop/todoStore";
import { changedSince, checkItem, indexProject } from "../loop/refs";
import type { TodoItem } from "../todo/types";
import type { TurnContext } from "./context";

/** refreshChecks = ① 기계 확인 다시 · stamp = 할 일·판정자 기억을 프로젝트에 싣기. */
export function turnRecheck(turn: TurnContext) {
  const { store, state, vqaRounds, vqaBook, carriedVqaFp } = turn;
  const checkOf = (env: PiAssistantV2Env, item: TodoItem) => {
    if (!item.check || item.check.kind === "none") return undefined;
    try { return checkItem(env.ctx.project, store, item, state.changedNow); } catch { return undefined; }
  };
  /** ① 기계 확인 다시 — 끝난 항목이 지금 ✗ 면 다시 연다(거짓 완료·뒤 편집이 깬 것), 막힌 항목이 지금 ✓ 면 닫는다(함수 마감이 해냈다). */
  const refreshChecks = (env: PiAssistantV2Env, final = false): void => {
    try { state.changedNow = store.baseline ? changedSince(store.baseline, indexProject(env.ctx.project)) : undefined; } catch { state.changedNow = undefined; }
    for (const item of store.items) {
      if (!item.check || item.check.kind === "none") continue;
      if (item.status === "completed") {
        const r = checkOf(env, item);
        if (r && !r.pass) {
          store.reopen(item, r);
          env.emit({ type: "execution_status", name: "v2.todo.reopen", ok: false, summary: `할 일 ${item.id} 끝났던 것이 기계 확인 ✗ — 다시 연다: ${r.detail.slice(0, 160)}` });
          if (item.attempts >= TODO_MAX_ATTEMPTS) store.block(item, `기계 확인이 ${item.attempts}번 ✗ — ${r.detail.slice(0, 160)}`, "auto");
        }
      } else if (item.status === "blocked" || (final && isOpen(item.status))) {
        const r = checkOf(env, item);
        if (r?.pass) { store.done(item, r, "auto"); env.emit({ type: "execution_status", name: "v2.todo.auto_done", ok: true, summary: `할 일 ${item.id} 기계 확인 ✓ — 닫음: ${r.detail.slice(0, 120)}` }); }
      }
    }
    state.changedNow = undefined;
  };
  // 할 일 상태를 프로젝트에 싣는다(새 뿌리 객체 — 요청 사본과 뿌리를 나눠 쓸 수 있어 제자리 수정하지 않는다). 다음 체크포인트·끝 저장에 같이 간다.
  // 막힌 항목의 대상 지문과 화면 검수 장부를 같이 싣는다 — 다음 턴이 같은 것을 처음부터 다시 다투지 않게(턴 사이 기억).
  const stamp = (env: PiAssistantV2Env) => {
    if (!store.items.length) return;
    try { stampTargets(store, indexProject(env.ctx.project)); } catch { /* 지문이 없으면 다음 턴에 «바뀌었다»로 열리지 않을 뿐이다 */ }
    // 검수하지 못한 판(problem)의 지문은 남기지 않는다 — 다음 턴이 «그대로»라며 건너뛰면 한 번도 검수되지 않는다.
    const reviewed = vqaRounds.length ? (vqaRounds.at(-1)!.problem ? undefined : state.vqaReviewedFingerprint) : carriedVqaFp;
    const memory = saveVqaBook(vqaBook, store, env.ctx.project, reviewed);
    if (memory) store.memory.vqa = memory; else delete store.memory.vqa;
    env.ctx.project = { ...env.ctx.project, assistantTodo: store.serialize(env.request.task) };
  };
  return { refreshChecks, stamp };
}
