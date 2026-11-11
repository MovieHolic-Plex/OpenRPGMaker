// 화면 검수 한 판 — 검수자 후보를 차례로 부르고(runVqaRound), 결함을 장부와 할 일에 맞춘다(vqaStep). 2026-11-11 리팩토링 R3: runAssistantV2 에서 옮겼다.
import { reviewVqaRound, vqaReviewerCandidates, vqaClean, vqaFixBrief, vqaReviewerLabel, VQA_MAX_ROUNDS, VQA_ROUND_CAP, vqaBlockers, vqaLedgerLine, type VqaRound } from "../judge/vqa";
import { closeVqaUnchanged, handCarriedBlockers, noteVqaRound } from "./vqaItems";
import { familyOfProviderId } from "../../assistantRoles";
import type { PiAssistantV2Env } from "../shared/env";
import { projectFingerprint } from "../loop/continuation";
import type { TodoItem } from "../todo/types";
import type { TurnContext } from "./context";

/** vqaStep = ⑥ 화면 검수 한 판(안에서 runVqaRound 가 그림을 찍고 검수자를 부른다). */
export function turnVqa(turn: TurnContext) {
  const { io, store, state, vqaRounds, vqaBook } = turn;
  const runVqaRound = async (env: PiAssistantV2Env): Promise<VqaRound> => {
    if (!env.render && !env.renderArt) {
      // 그림 경로가 없는 실행(편집기 렌더 브로커 없음): 검수자를 부르지 않고 «검수 못 함» 판 하나를 남긴다.
      const round: VqaRound = { round: vqaRounds.length + 1, shots: [], defects: [], ms: 0, reviewer: "-", problem: "그림 경로 없음(편집기 렌더 연결 없음) — 화면 검수를 하지 못함" };
      vqaRounds.push(round);
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 못 함 — ${round.problem}`, data: round });
      return round;
    }
    // 검수자 후보(다른 계열 먼저, 같은 계열은 맨 뒤 — «같은 계열 검수»). 한 후보가 답하지 못하면(호출 실패·빈 답·JSON 없음) 같은 그림을 다음 후보에게.
    state.vqaCandidates ??= vqaReviewerCandidates({
      main: { provider: env.request.provider, model: env.request.model ?? "" },
      ...(env.request.roleModels?.vision ? { vision: env.request.roleModels.vision } : {}),
      ...(env.request.assistantRoles?.advisor && env.request.assistantRoles.advisor !== "off" ? { advisor: env.request.assistantRoles.advisor } : {}),
      keyed: env.keyedProviders ?? new Set([env.request.provider]),
      // 사용자 지정 엔드포인트(openai-compat:*)는 계정 이름으로 계열을 모른다 — 그 계정에 실린 모델 이름으로 가린다(8318 Argon → gemini).
      familyOf: (id) => familyOfProviderId(id, [env.request.roleModels?.vision, env.request.assistantRoles?.advisor === "off" ? undefined : env.request.assistantRoles?.advisor, { provider: env.request.provider, model: env.request.model ?? "" }]
        .filter((slot): slot is { provider: string; model: string } => Boolean(slot && slot.provider === id)).map((slot) => slot.model)),
    });
    const t0 = Date.now();
    const { shots, failed } = await io.captureVqaShots(env);
    const tried: string[] = [];
    let round: VqaRound | undefined;
    let reviewer = "-";
    for (const [index, pick] of state.vqaCandidates.entries()) {
      if (index < state.vqaCandidateIndex) continue;
      reviewer = vqaReviewerLabel(pick);
      // 주 모델이 검수자일 때도 roleChat 으로 부른다 — Argon 이면 그림을 보는 high 별칭으로 가야 한다(sideChat 은 주 모델 강도 그대로).
      const chat = env.roleChat ? (messages: readonly unknown[], signal?: AbortSignal) => env.roleChat!(pick, messages, signal) : env.sideChat;
      round = await reviewVqaRound({ task: env.request.task, shots, round: vqaRounds.length + 1, previous: vqaRounds.at(-1)?.defects ?? vqaBook.filter((f) => !f.gone).slice(-12).map((f) => ({ ...f.defect, what: f.lastWhat })), chat, reviewer, ...(env.signal ? { signal: env.signal } : {}) });
      if (!round.problem || !shots.length) { state.vqaCandidateIndex = index; break; }
      tried.push(`${reviewer}: ${round.problem}`);
      env.emit({ type: "execution_status", name: "v2.vqa.reviewer_fallback", ok: false, summary: `화면 검수자 ${reviewer} 가 답하지 못함(${round.problem}) — 다음 검수자로`, data: { reviewer, problem: round.problem } });
      state.vqaCandidateIndex = index + 1;
    }
    if (state.vqaCandidateIndex >= state.vqaCandidates.length) state.vqaCandidateIndex = 0;
    if (!round) round = { round: vqaRounds.length + 1, shots: [], defects: [], ms: 0, reviewer: "-", problem: "검수자 후보가 없음" };
    else if (round.problem && tried.length > 1) round = { ...round, problem: `검수자 ${tried.length}명 모두 답하지 못함 — ${tried.join(" / ").slice(0, 400)}` };
    const withFailed: VqaRound = failed.length && !round.problem && !shots.length ? { ...round, problem: `그림을 찍지 못함: ${failed.join(", ").slice(0, 400)}` } : round;
    vqaRounds.push(withFailed);
    state.vqaMs += Date.now() - t0;
    env.emit({ type: "execution_status", name: "v2.vqa", ok: vqaClean(withFailed), summary: `화면 검수 ${withFailed.round}/${withFailed.round > VQA_MAX_ROUNDS ? VQA_ROUND_CAP : VQA_MAX_ROUNDS} · ${withFailed.problem ?? `결함 ${withFailed.defects.length}건${vqaBlockers(withFailed).length ? `(막음 ${vqaBlockers(withFailed).length})` : ""}`} · 그림 ${shots.length}장${failed.length ? ` (못 찍음 ${failed.length}: ${failed.join(" / ").slice(0, 300)})` : ""} · ${reviewer} · ${Math.round((Date.now() - t0) / 1000)}초`,
      data: { ...withFailed, failed } });
    return withFailed;
  };
  /** ⑥ 화면 검수 한 판 — 결함을 장부와 vqa 항목에 맞추고(noteVqaRound), 새로 건넬 항목을 돌려준다. 건넬 것이 없으면 화면 검수는 끝이다. */
  const vqaStep = async (env: PiAssistantV2Env): Promise<TodoItem[]> => {
    const fingerprint = projectFingerprint(env.ctx.project);
    // 앞 판(이 턴) 또는 앞 턴의 마지막 검수 뒤로 프로젝트가 그대로면 같은 그림이다 — 다시 찍지 않는다.
    if (!vqaRounds.at(-1)?.problem && fingerprint && fingerprint === state.vqaReviewedFingerprint) {
      // 앞 턴이 판이 남지 않아 건네지 못한 막음은 같은 그림이니 다시 찍지 않고 지금 건넨다.
      const carried = vqaRounds.length ? { opened: [], offered: [] } : handCarriedBlockers(vqaBook, store, env.ctx.project);
      if (carried.opened.length) {
        env.emit({ type: "execution_status", name: "v2.vqa.carried", ok: false, summary: `앞 턴이 건네지 못한 화면 검수 막음 ${carried.opened.length}건을 할 일로 건넴(다시 찍지 않음 — 앞 턴 검수 뒤로 바뀐 것이 없음)`, data: { items: carried.opened.map((i) => i.id) } });
        state.pendingBrief = vqaFixBrief(env.request.task, env.ctx.project, carried.offered, state.draft);
        state.freshNext = true;
        return carried.opened;
      }
      const left = closeVqaUnchanged(vqaBook, store);
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 ${vqaRounds.length + 1}판 건너뜀 — ${vqaRounds.length ? "앞 판" : "앞 턴의 검수"} 뒤로 바뀐 것이 없음(건넨 결함 ${left.length}건 그대로)`, data: { skipped: true, left: left.map((f) => f.key) } });
      state.vqaDone = true; return [];
    }
    state.vqaReviewedFingerprint = fingerprint;
    const round = await runVqaRound(env);
    const out = noteVqaRound(vqaBook, store, round, env.ctx.project);
    for (const f of out.outside) env.emit({ type: "execution_status", name: "v2.vqa.outside", ok: false, summary: vqaLedgerLine(f.defect).slice(0, 600), data: { round: round.round, defect: f.defect } });
    if (out.left.length) env.emit({ type: "execution_status", name: "v2.vqa.stuck", ok: false, summary: `건넨 뒤에도 그대로인 결함 ${out.left.length}건 — 그 항목을 닫는다: ${out.left.map((f) => f.lastWhat).join(" / ").slice(0, 400)}`, data: { round: round.round, stuck: out.left.map((f) => ({ key: f.key, item: f.itemId, what: f.lastWhat })) } });
    if (!out.opened.length) {
      // 검수 못 함·깨끗함·건넬 것 없음·판 상한 — 남은 것은 보고(할 일 표와 장부)로.
      if (!vqaClean(round)) env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 ${round.round}판 뒤 끝 — ${round.problem ?? `남은 결함 ${round.defects.length}건(모델 밖 ${out.outside.length} · 그대로 ${out.left.length})`}` });
      state.vqaDone = true; return [];
    }
    state.pendingBrief = vqaFixBrief(env.request.task, env.ctx.project, out.offered, state.draft);
    state.freshNext = true;
    return out.opened;
  };
  return { vqaStep };
}
