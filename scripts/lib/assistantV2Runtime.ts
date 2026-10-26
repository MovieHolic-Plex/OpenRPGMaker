// 조수 v2 실행기 — v1 의 runPiAgent 를 그대로 쓰되(체크포인트·실시간 시공·맵 소유권·사용량·로컬 CLI), 도구를 v2 동사로,
// 시스템 지시를 v2 카드로 바꾼다. v1 레지스트리 도구는 하나도 노출하지 않는다(options.toolNames 가 아무것도 고르지 않는다).
// 켜는 곳: 편집기 ?assistant=v2 또는 localStorage oprn:assistant-v2=1 → 요청 assistantVersion:"v2" → 워커가 여기로 보낸다.
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { applyMapLighting, litShotNote, type LitShot } from "../../src/ai/v2/vqaLighting.ts";
import type { GameMap, Project } from "../../src/project/types.ts";
import { runPiAgent, type RunPiAgentOptions } from "./piAgentRuntime.ts";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { buildV2SystemPrompt } from "../../src/ai/v2/prompt.ts";
import { createV2Tools, V2Session, v2FinishGate } from "../../src/ai/v2/verbs.ts";
import { shipBlockers } from "../../src/ai/v2/shipChecks.ts";
import { reviewVqaRound, vqaReviewerCandidates, vqaClean, vqaFixBrief, vqaFixRetry, vqaFollowUp, vqaLeftoverInstruction, vqaShotPlan, vqaReviewerLabel, vqaShouldContinue, vqaSummary, wantsWholeGame, VQA_MAX_ROUNDS, type VqaReviewerPick, type VqaRound, type VqaShot } from "../../src/ai/v2/vqa.ts";
import { familyOfProviderId } from "../../src/ai/assistantRoles.ts";
import type { PiAssistantV2Env } from "../../src/ai/v2/env.ts";
import { adviseTurn, advisorFollowUp, withShipBlockers, advisorSummary, compactToolLog, summarizeProjectDiff, type AdvisorToolCall, type AdvisorVerdict } from "../../src/ai/v2/advisor.ts";

/** 독립 검토자(src/ai/v2/advisor.ts). 끄려면 OPRN_V2_ADVISOR=0 — 비교 실행·장애 때만 쓴다. 읽기 전용 실행에는 돌지 않는다. */
// 설정에서 검토자를 끈 경우(assistantRoles.advisor = "off")도 돌지 않는다. 검토자 모델은 env.advisorChat(따로 고른 칸) → 없으면 주 모델(sideChat).
const advisorEnabled = (request: PiAgentRequest): boolean => process.env.OPRN_V2_ADVISOR !== "0" && !request.readOnly && request.assistantRoles?.advisor !== "off";
const advisorChatOf = (env: PiAssistantV2Env) => env.advisorChat ?? env.sideChat;
const safeShip = (env: PiAssistantV2Env) => { try { return shipBlockers(env.ctx.project, env.request.task); } catch { return []; } };
const safeDiff = (env: PiAssistantV2Env): string => {
  try { return summarizeProjectDiff(env.request.project, env.ctx.project); } catch (error) { return `(변경 요약 실패: ${error instanceof Error ? error.message : String(error)})`; }
};

/**
 * 화면 검수 고리(src/ai/v2/vqa.ts) — 게임 전체를 만드는 요청에만, 읽기 전용이 아닐 때만. 끄려면 OPRN_V2_VQA=0.
 * 사용자 규칙(2026-10-25): 최소 한 판, 결함 없는 판이 나오거나 3판을 돌 때까지. 그림 경로가 없는 실행은 «검수 못 함»으로 보고한다.
 */
/** 프로젝트 내용 지문(판 사이 변화 확인용). 직렬화가 실패하면 빈 값 — 그때는 건너뛰지 않는다. */
const projectFingerprint = (project: unknown): string => { try { return createHash("sha256").update(JSON.stringify(project)).digest("hex"); } catch { return ""; } };
const vqaEnabled = (request: PiAgentRequest): boolean => process.env.OPRN_V2_VQA !== "0" && !request.readOnly && wantsWholeGame(request.task);

/** PNG dataURL 에 맵 조명을 입힌다. 해독·인코딩이 실패하면 undefined(원래 그림을 쓴다). */
function litMapImage(dataUrl: string, map: GameMap, project: Project): { image: string; lit: LitShot } | undefined {
  try {
    const m = /^data:image\/png;base64,(.+)$/u.exec(dataUrl);
    if (!m) return undefined;
    const png = PNG.sync.read(Buffer.from(m[1]!, "base64"));
    const lit = applyMapLighting(png.data, png.width, png.height, map, project);
    if (!lit.applied) return undefined;
    return { image: `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`, lit };
  } catch { return undefined; }
}

async function captureVqaShots(env: PiAssistantV2Env): Promise<{ shots: VqaShot[]; failed: string[] }> {
  const changed = new Set(Object.keys(env.ctx.project.maps).filter((id) => env.request.project.maps[id] !== env.ctx.project.maps[id]));
  const shots: VqaShot[] = [], failed: string[] = [];
  for (const item of vqaShotPlan(env.ctx.project, changed)) {
    try {
      let image: string | undefined;
      let where = item.where;
      if (item.kind === "map" && item.ref && env.render) {
        const map = env.ctx.project.maps[item.ref]!;
        image = await env.render(item.ref, 0, 0, map.width, map.height);
        // 맵 그림은 조명을 그리지 않는다 — 게임처럼 어둠·빛을 입혀 검수자가 실제 화면의 밝기를 보게 한다.
        if (image && map.defaultLighting?.ambient) {
          const lit = litMapImage(image, map, env.ctx.project);
          if (lit) { image = lit.image; where = `${item.where}${litShotNote(lit.lit)}`; }
          else where = `${item.where} — 조명을 입히지 못한 편집기 그림(게임에서는 어둠 ${map.defaultLighting.ambient})`;
        }
      } else if (env.renderArt && item.shotId && item.atMs) image = await env.renderArt({ shotId: item.shotId, atMs: item.atMs });
      else if (env.renderArt && item.ref) image = await env.renderArt({ resourceId: item.ref });
      if (image) shots.push({ where, kind: item.kind, ...(item.ref ? { ref: item.ref } : {}), image });
      else failed.push(`${item.where}: 그릴 경로 없음`);
    } catch (error) {
      if (env.signal?.aborted) throw error;
      // 왜 못 찍었는지 남긴다(2026-10-26 hf2-school-claude-j79: 타이틀 그림이 판마다 「못 찍음 1」로만 남았다 — 원인은 이 설치에 없는 오프닝 스틸 팩 그림).
      const reason = error instanceof Error ? error.message : String(error);
      failed.push(`${item.where}${item.ref ? `(${item.ref})` : ""}: ${reason.slice(0, 160)}`);
    }
  }
  return { shots, failed };
}

export async function runAssistantV2(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const session = new V2Session();
  const started = Date.now();
  // 검토자의 재료: 이 실행의 도구 기록과 마지막 보고 초안. 사용자 화면으로 가는 이벤트를 그대로 흘려보내며 옆에서 모은다.
  const calls: AdvisorToolCall[] = [];
  const argsById = new Map<string, unknown>();
  let draft = "";
  const onEvent = (event: PiAgentEvent) => {
    if (event.type === "tool_start") argsById.set(event.id, event.args);
    else if (event.type === "tool_end") { calls.push({ name: event.name, ok: event.ok, args: argsById.get(event.id), summary: event.summary }); argsById.delete(event.id); }
    else if (event.type === "assistant" && event.text.trim()) draft = event.text;
    options.onEvent?.(event);
  };
  let advice: AdvisorVerdict | undefined;
  // 검토자가 더한 시간: 검토 호출(advice.ms) + 검토자 글로 한 차례 더 돈 시간(followMs, 막음이 있을 때만).
  let followFrom = 0, followMs = 0;
  // 화면 검수 고리 상태 — 판 기록, 다음 afterMain 차례가 무엇을 할지.
  const vqaRounds: VqaRound[] = [];
  let vqaPhase: "advisor" | "advisor-recheck" | "vqa" | "final-check" | "done" = "advisor";
  // 고치기 차례 감시: 고치기 지시를 낼 때의 도구 기록 길이. 다음 걸음에서 그대로면 그 차례는 도구 0회 — 판으로 세지 않는다.
  let fixFromCalls: number | undefined;
  let fixRetried = false;
  let vqaCandidates: VqaReviewerPick[] | undefined;
  let vqaCandidateIndex = 0;
  let vqaMs = 0;
  let vqaReviewedFingerprint: string | undefined;
  const runVqaRound = async (env: PiAssistantV2Env): Promise<VqaRound> => {
    if (!env.render && !env.renderArt) {
      // 그림 경로가 없는 실행(편집기 렌더 브로커 없음): 검수자를 부르지 않고 «검수 못 함» 판 하나를 남긴다. vqaStep 이 거기서 멈춘다.
      const round: VqaRound = { round: vqaRounds.length + 1, shots: [], defects: [], ms: 0, reviewer: "-", problem: "그림 경로 없음(편집기 렌더 연결 없음) — 화면 검수를 하지 못함" };
      vqaRounds.push(round);
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 못 함 — ${round.problem}`, data: round });
      return round;
    }
    // 검수자 후보(다른 계열 먼저, 같은 계열은 맨 뒤 — «같은 계열 검수»). 한 후보가 답하지 못하면(호출 실패·빈 답·JSON 없음) 같은 그림을 다음 후보에게.
    // 답한 후보는 다음 판에도 그대로 쓴다. 검수를 말없이 건너뛰지 않는다 — 끝내 아무도 못 답하면 «검수 못 함» 판으로 남는다.
    vqaCandidates ??= vqaReviewerCandidates({
      main: { provider: env.request.provider, model: env.request.model ?? "" },
      ...(env.request.roleModels?.vision ? { vision: env.request.roleModels.vision } : {}),
      ...(env.request.assistantRoles?.advisor && env.request.assistantRoles.advisor !== "off" ? { advisor: env.request.assistantRoles.advisor } : {}),
      keyed: env.keyedProviders ?? new Set([env.request.provider]),
      // 사용자 지정 엔드포인트(openai-compat:*)는 계정 이름으로 계열을 모른다 — 그 계정에 실린 모델 이름으로 가린다(8318 Argon → gemini).
      familyOf: (id) => familyOfProviderId(id, [env.request.roleModels?.vision, env.request.assistantRoles?.advisor === "off" ? undefined : env.request.assistantRoles?.advisor, { provider: env.request.provider, model: env.request.model ?? "" }]
        .filter((slot): slot is { provider: string; model: string } => Boolean(slot && slot.provider === id)).map((slot) => slot.model)),
    });
    const t0 = Date.now();
    const { shots, failed } = await captureVqaShots(env);
    const tried: string[] = [];
    let round: VqaRound | undefined;
    let reviewer = "-";
    for (const [index, pick] of vqaCandidates.entries()) {
      if (index < vqaCandidateIndex) continue;
      reviewer = vqaReviewerLabel(pick);
      // 주 모델이 검수자일 때도 roleChat 으로 부른다 — Argon 이면 그림을 보는 high 별칭으로 가야 한다(sideChat 은 주 모델 강도 그대로).
      const chat = env.roleChat ? (messages: readonly unknown[], signal?: AbortSignal) => env.roleChat!(pick, messages, signal) : env.sideChat;
      round = await reviewVqaRound({ task: env.request.task, shots, round: vqaRounds.length + 1, previous: vqaRounds.at(-1)?.defects ?? [], chat, reviewer, ...(env.signal ? { signal: env.signal } : {}) });
      // 그림이 없는 판은 검수자 탓이 아니다 — 다음 후보로 넘기지 않는다.
      if (!round.problem || !shots.length) { vqaCandidateIndex = index; break; }
      tried.push(`${reviewer}: ${round.problem}`);
      env.emit({ type: "execution_status", name: "v2.vqa.reviewer_fallback", ok: false, summary: `화면 검수자 ${reviewer} 가 답하지 못함(${round.problem}) — 다음 검수자로`, data: { reviewer, problem: round.problem } });
      vqaCandidateIndex = index + 1;
    }
    // 모두 답하지 못한 판 뒤에는 다음 판에서 처음 후보부터 다시 시도한다(일시 장애일 수 있다).
    if (vqaCandidateIndex >= vqaCandidates.length) vqaCandidateIndex = 0;
    if (!round) round = { round: vqaRounds.length + 1, shots: [], defects: [], ms: 0, reviewer: "-", problem: "검수자 후보가 없음" };
    else if (round.problem && tried.length > 1) round = { ...round, problem: `검수자 ${tried.length}명 모두 답하지 못함 — ${tried.join(" / ").slice(0, 400)}` };
    const withFailed: VqaRound = failed.length && !round.problem && !shots.length ? { ...round, problem: `그림을 찍지 못함: ${failed.join(", ")}` } : round;
    vqaRounds.push(withFailed);
    vqaMs += Date.now() - t0;
    env.emit({ type: "execution_status", name: "v2.vqa", ok: vqaClean(withFailed), summary: `화면 검수 ${withFailed.round}/${VQA_MAX_ROUNDS} · ${withFailed.problem ?? `결함 ${withFailed.defects.length}건`} · 그림 ${shots.length}장${failed.length ? ` (못 찍음 ${failed.length}: ${failed.join(" / ").slice(0, 300)})` : ""} · ${reviewer} · ${Math.round((Date.now() - t0) / 1000)}초`,
      data: { ...withFailed, failed } });
    return withFailed;
  };
  /** 화면 검수 한 걸음: 판 하나를 돌고, 결함이 있으면 고치기 지시, 끝났으면 (남은 결함이 있을 때) 정직한 최종 보고 지시. */
  const vqaStep = async (env: PiAssistantV2Env): Promise<string | undefined> => {
    if (!vqaEnabled(env.request) || (vqaRounds.length && !vqaShouldContinue(vqaRounds))) { vqaPhase = "done"; return undefined; }
    const previous = vqaRounds.at(-1);
    // 고치기 차례가 도구를 하나도 부르지 않았다(보고만 고쳐 씀) — 판으로 세지 않는다. 결함 목록을 다시 주고 도구 호출을 강제해 한 번 더,
    // 그래도 0회면 «미해결 N건»으로 끝낸다(2026-10-25 hf2 실측: 결함 9→9→9, 판마다 도구 0회).
    if (previous && fixFromCalls !== undefined && calls.length === fixFromCalls) {
      if (!fixRetried) {
        fixRetried = true;
        env.emit({ type: "execution_status", name: "v2.vqa.fix_retry", ok: false, summary: `화면 검수 ${previous.round}/${VQA_MAX_ROUNDS} 고치기 차례에 도구 0회 — 판으로 세지 않고 결함 ${previous.defects.length}건을 다시 주며 도구 호출을 강제`, data: { round: previous.round, defects: previous.defects.length } });
        env.requireToolNextTurn?.();
        env.freshContextNextTurn?.();
        return vqaFixRetry(previous, vqaFixBrief(env.request.task, env.ctx.project, previous.defects, draft));
      }
      fixFromCalls = undefined;
      vqaPhase = "final-check";
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 끝 — 고치기 차례 두 번 다 도구 0회, 미해결 결함 ${previous.defects.length}건`, data: { unresolved: previous.defects.length, round: previous.round } });
      return vqaLeftoverInstruction(vqaRounds, `고치기 차례에 도구를 하나도 부르지 않았다 — 미해결: 결함 ${previous.defects.length}건`);
    }
    fixFromCalls = undefined;
    // 고치기 차례에 프로젝트 내용이 하나도 바뀌지 않았으면 같은 그림을 다시 검수하지 않는다 — 결함이 그대로 남았다고 적고 끝낸다.
    const fingerprint = projectFingerprint(env.ctx.project);
    if (previous && !previous.problem && fingerprint && fingerprint === vqaReviewedFingerprint) {
      vqaPhase = "final-check";
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 ${previous.round + 1}/${VQA_MAX_ROUNDS} 건너뜀 — 앞 판 뒤로 바뀐 것이 없음, 결함 ${previous.defects.length}건 그대로`, data: { skipped: true, round: previous.round + 1 } });
      return vqaLeftoverInstruction(vqaRounds, "앞 판 결함을 고치는 동안 프로젝트가 하나도 바뀌지 않았다");
    }
    vqaReviewedFingerprint = fingerprint;
    const round = await runVqaRound(env);
    const noRenderPath = !env.render && !env.renderArt;
    if (!noRenderPath && !vqaClean(round) && vqaShouldContinue(vqaRounds)) {
      // 검수 못 한 판(결함 0, problem)은 고칠 것이 없다 — 도구 강제·0회 감시는 결함이 있는 판에만.
      if (!round.defects.length) return vqaFollowUp(round);
      fixFromCalls = calls.length;
      env.requireToolNextTurn?.();
      env.freshContextNextTurn?.();
      return vqaFollowUp(round, vqaFixBrief(env.request.task, env.ctx.project, round.defects, draft));
    }
    // 결함이 남은 채 끝나면 조수가 최종 보고에 남은 목록을 쓰게 한 번 더 돌린다(고치지 말고 정직하게). 그 보고는 검토자가 실제 변경에 대어 본다.
    if (vqaClean(round)) { vqaPhase = "done"; return undefined; }
    vqaPhase = "final-check";
    return vqaLeftoverInstruction(vqaRounds);
  };
  const done = await runPiAgent({
    ...request,
    systemPrompt: buildV2SystemPrompt(request.project, request.currentMapId, request.task),
    initialToolNames: [],
    openingProduction: false,
  }, {
    ...options,
    onEvent,
    // 존재하지 않는 이름 하나 — 레지스트리 도구를 하나도 고르지 않고, 이름 지정 실행이라 v1 확인표·작가 도구도 꺼진다.
    toolNames: ["__assistant_v2__"],
    v2: {
      tools: (env) => createV2Tools(env, session),
      // 차례 순서: ① 끝맺음 관문 + 검토자 → (막음이면) ② 재검토(기록만) → ③ 화면 검수 1~3판(게임 전체 요청만). 판마다 결함이 있으면 고치는 한 바퀴.
      // 화면 검수: 판마다 한 차례 + 고치기 다시 한 번 + 남은 결함 보고 + 그 보고의 최종 검토 후속.
      maxRounds: 2 + VQA_MAX_ROUNDS + 3,
      afterMain: async (env) => {
        if (vqaPhase === "advisor-recheck") {
          if (followFrom) followMs = Date.now() - followFrom;
          vqaPhase = "vqa";
          if (advisorEnabled(env.request) && advice) {
            const recheck = withShipBlockers(await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: draft }, advisorChatOf(env), env.signal), safeShip(env));
            advice = { ...recheck, ms: advice.ms + recheck.ms, inputChars: advice.inputChars + recheck.inputChars };
            env.emit({ type: "execution_status", name: "v2.advisor.recheck", ok: !recheck.notes.some((n) => n.level === "blocker"), summary: `다시 검토 — ${advisorSummary(recheck)}`, data: recheck });
          }
        }
        if (vqaPhase === "vqa") return vqaStep(env);
        if (vqaPhase === "final-check") {
          // 남은 결함을 적은 최종 보고를 검토자가 실제 변경(diff)에 대어 본다 — 바꾸지 않은 것을 «고쳤다»고 쓴 보고는 막음 한 번으로 고치게 한다.
          vqaPhase = "done";
          if (!advisorEnabled(env.request)) return undefined;
          const final = withShipBlockers(await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: draft }, advisorChatOf(env), env.signal), safeShip(env));
          advice = advice ? { ...final, ms: advice.ms + final.ms, inputChars: advice.inputChars + final.inputChars } : final;
          env.emit({ type: "execution_status", name: "v2.advisor.final", ok: !final.notes.some((n) => n.level === "blocker"), summary: `화면 검수 뒤 최종 보고 검토 — ${advisorSummary(final)}`, data: final });
          return advisorFollowUp(final);
        }
        if (vqaPhase === "done") return undefined;
        // ① 끝맺음 관문 + 검토자. 보고 초안을 «실제로 바뀐 것»에 대어 본다. 막는 메모는 끝맺음 관문 글과 함께 한 차례 더 돌린다.
        // 우려·참고는 조수에게만(관문 글에 붙거나 실행 기록 v2.advisor) — 사용자 대화창에는 싣지 않는다.
        const gate = v2FinishGate(session, env);
        let text: string | undefined = gate;
        if (advisorEnabled(env.request)) {
          advice = withShipBlockers(await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: draft }, advisorChatOf(env), env.signal), safeShip(env));
          env.emit({ type: "execution_status", name: "v2.advisor", ok: !advice.notes.some((n) => n.level === "blocker"), summary: `${advisorSummary(advice)} · ${env.advisorModel ?? "주 모델"}`, data: { ...advice, model: env.advisorModel ?? "main" } });
          const blockerText = advisorFollowUp(advice);
          const softNotes = advice.notes.filter((n) => n.level !== "blocker");
          if (blockerText) { followFrom = Date.now(); text = gate ? `${gate}\n\n${blockerText}` : blockerText; }
          else if (gate && softNotes.length) text = `${gate}\n\n[독립 검토자 참고 — 막지는 않음]\n${softNotes.map((n) => `- [${n.level}] ${n.what}`).join("\n")}`;
          if (blockerText) { vqaPhase = "advisor-recheck"; return text; }
        }
        vqaPhase = "vqa";
        // 관문·검토자가 할 말이 없으면 바로 화면 검수 첫 판.
        return text ?? vqaStep(env);
      },
    },
  });
  options.onEvent?.({ type: "execution_status", name: "v2.summary", ok: done.ok, at: Date.now(), summary: `v2 요약: 장소 ${new Set([...session.places.values()]).size}·사람/사건 ${session.content.length}·비평 ${session.criticCalls}회(${Math.round(session.criticMs / 1000)}초)·남은 문제 ${session.unresolved().length}·그림 없음 ${session.missingArt.size}${advice ? `·검토 ${advice.notes.filter((n) => n.level === "blocker").length}막음(${(advice.ms / 1000).toFixed(1)}초${followMs ? `+후속 ${Math.round(followMs / 1000)}초` : ""})` : ""}${vqaRounds.length ? `·${vqaSummary(vqaRounds).text}(${Math.round(vqaMs / 1000)}초)` : ""} · 전체 ${Math.round((Date.now() - started) / 1000)}초`,
    data: { places: [...session.places.keys()], unresolved: session.unresolved(), missingArt: [...session.missingArt], criticCalls: session.criticCalls, criticMs: session.criticMs, ...(vqaRounds.length ? { vqa: { rounds: vqaRounds.map(({ round, defects, problem, reviewer, ms }) => ({ round, defects, problem, reviewer, ms })), ...vqaSummary(vqaRounds), ms: vqaMs } } : {}), ...(advice ? { advisor: { blockers: advice.notes.filter((n) => n.level === "blocker").length, notes: advice.notes.length, ms: advice.ms, followMs, inputChars: advice.inputChars } } : {}) } });
  return done;
}
