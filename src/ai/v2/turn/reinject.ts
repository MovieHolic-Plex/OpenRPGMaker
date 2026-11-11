// 재주입 — 열린 항목이 있으면 숨은 지시로 같은 대화를 한 차례 더 돈다(고리 규칙이 막으면 멈춘다). 2026-11-11 리팩토링 R3: runAssistantV2 에서 옮겼다.
import type { PiAssistantV2Env } from "../shared/env";
import { formatCall, nextForItem } from "../loop/nextCall";
import { continuationPrompt, projectFingerprint, textHash, STOP_REASON_KO } from "../loop/continuation";
import type { TodoItem } from "../todo/types";
import type { TurnContext } from "./context";

/** reinject = ② 재주입 하나 · newBatch = 판정자가 항목을 덧붙인 뒤의 재주입(묶음 수를 새로 센다). */
export function turnReinject(turn: TurnContext) {
  const { session, store, state, toolNames } = turn;
  /** ② 재주입 하나 — 고리 규칙이 막으면 undefined(loopStop 이 선다). */
  const reinject = (env: PiAssistantV2Env, batchNote?: string): string | undefined => {
    const c = store.counts();
    const d = session.loop.evaluate({ open: c.open, total: c.total, projectFp: projectFingerprint(env.ctx.project), draftHash: textHash(state.draft), asked: session.questions.length > 0 });
    if (d.kind === "stop") {
      state.loopStop = STOP_REASON_KO[d.reason];
      env.emit({ type: "execution_status", name: "v2.loop.stop", ok: false, summary: `할 일 고리 멈춤 — ${state.loopStop} · 열림 ${c.open}/${c.total}`, data: { reason: d.reason, list: store.view() } });
      if (d.reason !== "ask_user") for (const item of store.open()) store.block(item, `고리 멈춤 — ${state.loopStop}`, "auto");
      return undefined;
    }
    state.reinjections += 1;
    // H7: 재주입의 「지금 할 것」에 그 항목의 다음 호출(실패 뒤 남긴 meta.nextCall, 없으면 항목 확인 종류에서 뽑은 동사+뼈대)을 붙인다.
    const nextCallFor = (item: TodoItem): string | undefined => {
      let text = store.meta.get(item.id)?.nextCall?.text;
      if (!text) { try { const nc = nextForItem(item, env.ctx.project, toolNames); text = nc ? formatCall(nc) : undefined; } catch { text = undefined; } }
      if (text) session.hooks.fire("reinject", `${item.id} «${item.content.slice(0, 60)}» → ${text.slice(0, 200)}`, { item: item.id });
      return text;
    };
    const prompt = continuationPrompt(store, { ...(state.pendingBrief ? { brief: state.pendingBrief } : {}), ...(batchNote ? { batchNote } : {}), nextCallFor });
    store.markOffered();
    state.pendingBrief = undefined;
    env.emit({ type: "execution_status", name: "v2.loop.continue", ok: true, summary: `할 일 재주입 ${d.n}/${8}(전체 ${state.reinjections}) — 열림 ${c.open}/${c.total}${batchNote ? ` · ${batchNote.slice(0, 80)}` : ""}`, data: { n: d.n, total: state.reinjections, open: c.open, items: c.total, prompt } });
    env.requireToolNextTurn?.();
    if (state.freshNext) { state.freshNext = false; env.freshContextNextTurn?.(); }
    return prompt;
  };
  /** 새 묶음을 덧붙였으면 묶음 수를 새로 세고 재주입. */
  const newBatch = (env: PiAssistantV2Env, opened: readonly TodoItem[], note: string): string | undefined => {
    if (!opened.length) return undefined;
    session.loop.resetBatch();
    return reinject(env, note);
  };
  return { reinject, newBatch };
}
