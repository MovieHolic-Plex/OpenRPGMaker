// 턴의 끝 — 기계 표로 만든 최종 보고와 실행 요약. 2026-11-11 리팩토링 R3: runAssistantV2 의 꼬리에서 옮겼다.
import type { PiAgentDoneEvent } from "../../piAgent/protocol";
import { V2_MAX_REPAIR_ROUNDS } from "./session";
import { buildsWholeGame } from "../request/readers";
import { todoReport } from "../judge/finalReport";
import { vqaSummary } from "../judge/vqa";
import { vqaLedgerLines, vqaUnofferedBlockers } from "./vqaItems";
import { countMaps, RECOMMENDED_MAPS } from "../judge/mapCount";
import { countQuests, RECOMMENDED_QUESTS } from "../judge/questCount";
import type { TurnContext } from "./context";
import type { turnRecheck } from "./recheck";
import { artGapsIn } from "@/project/artGap";

/** finishTurn = 실행기가 끝난 뒤 한 번 — 기계 확인을 마지막으로 재고 최종 보고(v2.todo.final)와 요약(v2.summary)을 낸다. */
export function turnFinish(turn: TurnContext & Pick<ReturnType<typeof turnRecheck>, "refreshChecks" | "stamp">) {
  const { options, session, store, started, state, preexisting, vqaRounds, vqaBook, autoNotes, leadItems, refreshChecks, stamp } = turn;
  const finishTurn = (done: PiAgentDoneEvent): void => {
    // 최종 보고 — 할 일이 있으면 기계 표로(완료는 열림 0·막힘 0·확인 전부 ✓ 일 때만). 모델 글이 «했다»고 쓴 ✗ 항목은 기계 결과로 고친다.
    try {
      const env = state.liveEnv;
      if (env && store.items.length) refreshChecks(env, true);
      if (env) stamp(env);
      const left = session.unresolved().filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS || !store.items.length);
      const leftovers = left.flatMap((o) => o.problems.slice(0, 3).map((p) => `${o.name}(${o.mapId}): ${p.replace(/ — (dress_room|네가 설계한 방이다).*$/u, "").slice(0, 200)}`));
      try { if (env && buildsWholeGame(env.ctx.project, env.request.task)) { const { counted } = countMaps(env.ctx.project); if (counted.length < RECOMMENDED_MAPS) autoNotes.push(`세는 맵 ${counted.length}/${RECOMMENDED_MAPS}장(권장) — ${RECOMMENDED_MAPS - counted.length}장 부족(차단 아님)`); } } catch { /* 이 줄이 없어도 최종 보고는 나간다 */ }
      try { if (env && buildsWholeGame(env.ctx.project, env.request.task)) { const n = countQuests(env.ctx.project).counted.length; autoNotes.push(`세는 퀘스트 ${n}/${RECOMMENDED_QUESTS}개${n < RECOMMENDED_QUESTS ? ` — ${RECOMMENDED_QUESTS - n}개 부족` : ""}`); } } catch { /* 이 줄이 없어도 최종 보고는 나간다 */ }
      if (session.fitIncomplete) autoNotes.push(`${session.fitIncomplete} — 게임은 열리지만 첫 관문 승률은 이 요청에서 보정되지 않았다`);
      const vqaLeft = vqaRounds.length ? vqaSummary(vqaRounds) : undefined;
      if (!(options.signal?.aborted) && !session.questions.length && (store.items.length || leftovers.length || session.fitIncomplete)) {
        const report = todoReport({ store, draft: state.draft, leftovers, missing: [...session.missingArt], autoNotes, preexisting: [...preexisting.values()], ...(state.loopStop ? { loopStop: state.loopStop } : {}), ...(vqaLeft && !vqaLeft.clean ? { vqa: vqaLeft.text } : {}), vqaLedger: vqaLedgerLines(vqaBook, store), vqaUnoffered: vqaUnofferedBlockers(vqaBook, store) });
        options.onEvent?.({ type: "execution_status", name: "v2.todo.final", ok: report.complete, at: Date.now(), summary: `할 일 최종 — ${report.complete ? "완료" : "아직 완료 아님"} · ${store.view(0).split("\n")[0]}${report.receipts.length ? ` · 보고와 다른 것 ${report.receipts.length}` : ""}`, data: { complete: report.complete, receipts: report.receipts, list: store.view(), items: store.items, reinjections: state.reinjections, loopStop: state.loopStop } });
        if (store.items.length || /통과|없음|다\s*됐|완료/u.test(state.draft) || !state.draft) options.onEvent?.({ type: "assistant", text: report.text });
      }
    } catch { /* 보고 조립 실패는 실행을 막지 않는다 */ }
    options.onEvent?.({ type: "execution_status", name: "v2.summary", ok: (done as { ok?: boolean }).ok, at: Date.now(), summary: `v2 요약: 할 일 ${store.view(0).split("\n")[0]}·재주입 ${state.reinjections}·갈고리 ${[...session.hooks.counts].map(([k, v]) => `${k}${v}`).join(" ") || "0"}${state.loopStop ? `(멈춤: ${state.loopStop})` : ""}·장소 ${new Set([...session.places.values()]).size}·사람/사건 ${session.content.length}·비평 ${session.criticCalls}회(${Math.round(session.criticMs / 1000)}초)·남은 문제 ${session.unresolved().length}·그림 없음 ${session.missingArt.size}${state.advice ? `·검토 ${state.advice.notes.filter((n) => n.level === "blocker").length}막음(${(state.advice.ms / 1000).toFixed(1)}초)` : ""}${vqaRounds.length ? `·${vqaSummary(vqaRounds).text}(${Math.round(state.vqaMs / 1000)}초)` : ""} · 전체 ${Math.round((Date.now() - started) / 1000)}초`,
      data: { ...(state.leadPlan ? { split: { lead: state.liveEnv?.leadModel, planChars: state.leadPlan.length, reviews: state.leadReviews, leadItems: leadItems.size } } : {}), todo: store.items, reinjections: state.reinjections, loopStop: state.loopStop, hooks: session.hooks.toJSON(), places: [...session.places.keys()], unresolved: session.unresolved(), missingArt: [...session.missingArt], artGaps: artGapsIn(session.missingArt), criticCalls: session.criticCalls, criticMs: session.criticMs, ...(vqaRounds.length ? { vqa: { rounds: vqaRounds.map(({ round, defects, problem, reviewer, ms }) => ({ round, defects, problem, reviewer, ms })), ...vqaSummary(vqaRounds), ms: state.vqaMs, ledger: vqaBook.map(({ key, work, lastRound, lastWhat, itemId, gone }) => ({ key, work, lastRound, what: lastWhat, ...(itemId ? { item: itemId } : {}), ...(gone ? { gone } : {}) })) } } : {}), ...(state.advice ? { advisor: { blockers: state.advice.notes.filter((n) => n.level === "blocker").length, notes: state.advice.notes.length, ms: state.advice.ms, inputChars: state.advice.inputChars } } : {}) } });
  };
  return { finishTurn };
}
