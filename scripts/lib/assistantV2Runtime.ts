// 조수 v2 실행기 — v1 의 runPiAgent 를 그대로 쓰되(체크포인트·실시간 시공·맵 소유권·사용량·로컬 CLI), 도구를 v2 동사로,
// 시스템 지시를 v2 카드로 바꾼다. v1 레지스트리 도구는 하나도 노출하지 않는다(options.toolNames 가 아무것도 고르지 않는다).
// 켜는 곳: 편집기 ?assistant=v2 또는 localStorage oprn:assistant-v2=1 → 요청 assistantVersion:"v2" → 워커가 여기로 보낸다.
import { PNG } from "pngjs";
import { applyMapLighting, litShotNote, type LitShot } from "../../src/ai/v2/vqaLighting.ts";
import type { GameMap, Project } from "../../src/project/types.ts";
import { runPiAgent, type RunPiAgentOptions } from "./piAgentRuntime.ts";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import { buildV2SystemPrompt } from "../../src/ai/v2/prompt.ts";
import { createV2Tools, V2Session, v2GateProblems, V2_MAX_REPAIR_ROUNDS } from "../../src/ai/v2/verbs.ts";
import { shipBlockers } from "../../src/ai/v2/shipChecks.ts";
import { finishBuildPending, runFinishAutoBuild } from "../../src/ai/v2/finishAutoBuild.ts";
import { assembledReport, isProviderErrorReply, todoReport } from "../../src/ai/v2/finalReport.ts";
import { reviewVqaRound, vqaReviewerCandidates, vqaClean, vqaFixBrief, vqaShotPlan, vqaReviewerLabel, vqaShouldContinue, vqaSummary, wantsWholeGame, VQA_MAX_ROUNDS, VQA_ROUND_CAP, vqaBlockers, vqaActionable, vqaLedgerLine, vqaRepeated, vqaDefectLine, type VqaDefect, type VqaReviewerPick, type VqaRound, type VqaShot } from "../../src/ai/v2/vqa.ts";
import { familyOfProviderId } from "../../src/ai/assistantRoles.ts";
import type { PiAssistantV2Env } from "../../src/ai/v2/env.ts";
import { adviseTurn, scopeAdviceToRequest, withShipBlockers, advisorSummary, compactToolLog, summarizeProjectDiff, type AdvisorToolCall, type AdvisorVerdict } from "../../src/ai/v2/advisor.ts";
import { withTodoLoop, isWriteRequest } from "../../src/ai/v2/loop/todoTools.ts";
import { continuationPrompt, projectFingerprint, textHash, STOP_REASON_KO } from "../../src/ai/v2/loop/continuation.ts";
import { syncGateItems } from "../../src/ai/v2/loop/gates.ts";
import { TODO_MAX_ATTEMPTS, isOpen } from "../../src/ai/v2/loop/todoStore.ts";
import { runTodoCheck } from "../../src/ai/v2/todo/checks.ts";
import type { TodoItem } from "../../src/ai/v2/todo/types.ts";

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

/** 앞 실행이 남긴 할 일을 이어 받을 요청인가(«계속»·«이어서»·«마저»·«남은 것»). */
const CONTINUE_WORDS = /계속|이어서|이어 ?(해|가|만들|짓)|마저|남은 ?(것|일|항목)|끝까지|다시 ?해/u;

export async function runAssistantV2(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const session = new V2Session();
  const store = session.todo;
  const started = Date.now();
  // 앞 실행의 열린 할 일(project.assistantTodo)을 «계속» 요청에서 되살린다.
  if (CONTINUE_WORDS.test(request.task) && store.restore((request.project as { assistantTodo?: unknown }).assistantTodo)) {
    options.onEvent?.({ type: "execution_status", name: "v2.todo.restore", ok: true, at: Date.now(), summary: `앞 실행의 할 일을 이어 받음 — ${store.counts().open}개 열림`, data: { list: store.view() } });
  }
  // 검토자의 재료: 이 실행의 도구 기록과 마지막 보고 초안. 사용자 화면으로 가는 이벤트를 그대로 흘려보내며 옆에서 모은다.
  const calls: AdvisorToolCall[] = [];
  const argsById = new Map<string, unknown>();
  let draft = "";
  const onEvent = (event: PiAgentEvent) => {
    if (event.type === "tool_start") argsById.set(event.id, event.args);
    else if (event.type === "tool_end") { calls.push({ name: event.name, ok: event.ok, args: argsById.get(event.id), summary: event.summary }); argsById.delete(event.id); }
    else if (event.type === "assistant") {
      // 제공자 일반 오류 문장(«Sorry, something went wrong» 등)은 보고가 아니다 — 대화창에 보내지 않는다. 그러면 앞의 정직한 보고가 마지막 답으로 남는다.
      // 앞에 보고가 하나도 없으면 실제 프로젝트 상태로 조립한 보고를 대신 보낸다(2026-10-28 mt3 flash·mt2 argon escape).
      if (isProviderErrorReply(event.text)) {
        options.onEvent?.({ type: "execution_status", name: "v2.answer.provider_error", ok: false, at: Date.now(), summary: `모델이 보고 대신 제공자 오류 문장을 돌려줌 — 최종 답으로 쓰지 않음: ${JSON.stringify(event.text.trim().slice(0, 120))}` });
        if (!draft) { draft = assembledReport(lastProject()); options.onEvent?.({ type: "assistant", text: draft }); }
        return;
      }
      draft = event.text;
    }
    options.onEvent?.(event);
  };
  let liveEnv: PiAssistantV2Env | undefined;
  const lastProject = () => liveEnv?.ctx.project ?? request.project;
  let advice: AdvisorVerdict | undefined;
  // 화면 검수 상태 — 판 기록·검수자 후보·결함 ↔ 할 일 항목.
  const vqaRounds: VqaRound[] = [];
  let vqaCandidates: VqaReviewerPick[] | undefined;
  let vqaCandidateIndex = 0;
  let vqaMs = 0;
  let vqaReviewedFingerprint: string | undefined;
  const vqaLedgerSeen = new Set<string>();
  const vqaItemDefects = new Map<string, VqaDefect>();
  const runVqaRound = async (env: PiAssistantV2Env): Promise<VqaRound> => {
    if (!env.render && !env.renderArt) {
      // 그림 경로가 없는 실행(편집기 렌더 브로커 없음): 검수자를 부르지 않고 «검수 못 함» 판 하나를 남긴다.
      const round: VqaRound = { round: vqaRounds.length + 1, shots: [], defects: [], ms: 0, reviewer: "-", problem: "그림 경로 없음(편집기 렌더 연결 없음) — 화면 검수를 하지 못함" };
      vqaRounds.push(round);
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 못 함 — ${round.problem}`, data: round });
      return round;
    }
    // 검수자 후보(다른 계열 먼저, 같은 계열은 맨 뒤 — «같은 계열 검수»). 한 후보가 답하지 못하면(호출 실패·빈 답·JSON 없음) 같은 그림을 다음 후보에게.
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
      if (!round.problem || !shots.length) { vqaCandidateIndex = index; break; }
      tried.push(`${reviewer}: ${round.problem}`);
      env.emit({ type: "execution_status", name: "v2.vqa.reviewer_fallback", ok: false, summary: `화면 검수자 ${reviewer} 가 답하지 못함(${round.problem}) — 다음 검수자로`, data: { reviewer, problem: round.problem } });
      vqaCandidateIndex = index + 1;
    }
    if (vqaCandidateIndex >= vqaCandidates.length) vqaCandidateIndex = 0;
    if (!round) round = { round: vqaRounds.length + 1, shots: [], defects: [], ms: 0, reviewer: "-", problem: "검수자 후보가 없음" };
    else if (round.problem && tried.length > 1) round = { ...round, problem: `검수자 ${tried.length}명 모두 답하지 못함 — ${tried.join(" / ").slice(0, 400)}` };
    const withFailed: VqaRound = failed.length && !round.problem && !shots.length ? { ...round, problem: `그림을 찍지 못함: ${failed.join(", ").slice(0, 400)}` } : round;
    vqaRounds.push(withFailed);
    vqaMs += Date.now() - t0;
    env.emit({ type: "execution_status", name: "v2.vqa", ok: vqaClean(withFailed), summary: `화면 검수 ${withFailed.round}/${withFailed.round > VQA_MAX_ROUNDS ? VQA_ROUND_CAP : VQA_MAX_ROUNDS} · ${withFailed.problem ?? `결함 ${withFailed.defects.length}건${vqaBlockers(withFailed).length ? `(막음 ${vqaBlockers(withFailed).length})` : ""}`} · 그림 ${shots.length}장${failed.length ? ` (못 찍음 ${failed.length}: ${failed.join(" / ").slice(0, 300)})` : ""} · ${reviewer} · ${Math.round((Date.now() - t0) / 1000)}초`,
      data: { ...withFailed, failed } });
    return withFailed;
  };

  // ── 할 일 고리 ───────────────────────────────────────────────────────────────────────────
  // 모델이 멈출 때마다(afterMain) 순서대로: ① 기계 확인 다시(끝난 항목이 ✗ 면 다시 연다) → ② 열린 항목이 있으면 재주입(상한·진척 규칙)
  // → ③ 끝맺음 자동 짓기(한 번, 결정적) → ④ 끝맺음 관문 문제를 gate·critic 항목으로 → ⑤ 독립 검토자 막음을 critic 항목으로
  // → ⑥ 화면 검수 결함을 vqa 항목으로(게임 전체 요청만). ④~⑥ 이 항목을 덧붙이면 같은 고리로 ② 부터 다시. 아무것도 없으면 끝 — 최종 보고는 기계 표.
  let autoBuilt = false;
  const autoNotes: string[] = [];
  let loopStop: string | undefined;
  let advisorRuns = 0;
  const advisorItems = new Set<string>();
  let vqaDone = !vqaEnabled(request);
  let pendingBrief: string | undefined;
  let freshNext = false;
  let reinjections = 0;
  const writeRequest = isWriteRequest(request);
  /** 이 실행에 노출한 동사·도구 이름 — 관문 항목이 이르는 도구가 없으면 그 항목은 돌리지 않는다. */
  const toolNames = new Set<string>();
  const checkOf = (env: PiAssistantV2Env, item: TodoItem) => {
    if (!item.check || item.check.kind === "none") return undefined;
    try { return runTodoCheck(env.ctx.project, item.check, { startMapId: env.ctx.project.startMapId }); } catch { return undefined; }
  };
  /** ① 기계 확인 다시 — 끝난 항목이 지금 ✗ 면 다시 연다(거짓 완료·뒤 편집이 깬 것), 막힌 항목이 지금 ✓ 면 닫는다(함수 마감이 해냈다). */
  const refreshChecks = (env: PiAssistantV2Env, final = false): void => {
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
  };
  // 할 일 상태를 프로젝트에 싣는다(새 뿌리 객체 — 요청 사본과 뿌리를 나눠 쓸 수 있어 제자리 수정하지 않는다). 다음 체크포인트·끝 저장에 같이 간다.
  const stamp = (env: PiAssistantV2Env) => { if (store.items.length) env.ctx.project = { ...env.ctx.project, assistantTodo: store.serialize(env.request.task) }; };
  /** ② 재주입 하나 — 고리 규칙이 막으면 undefined(loopStop 이 선다). */
  const reinject = (env: PiAssistantV2Env, batchNote?: string): string | undefined => {
    const c = store.counts();
    const d = session.loop.evaluate({ open: c.open, total: c.total, projectFp: projectFingerprint(env.ctx.project), draftHash: textHash(draft), asked: session.questions.length > 0 });
    if (d.kind === "stop") {
      loopStop = STOP_REASON_KO[d.reason];
      env.emit({ type: "execution_status", name: "v2.loop.stop", ok: false, summary: `할 일 고리 멈춤 — ${loopStop} · 열림 ${c.open}/${c.total}`, data: { reason: d.reason, list: store.view() } });
      if (d.reason !== "ask_user") for (const item of store.open()) store.block(item, `고리 멈춤 — ${loopStop}`, "auto");
      return undefined;
    }
    reinjections += 1;
    const prompt = continuationPrompt(store, { ...(pendingBrief ? { brief: pendingBrief } : {}), ...(batchNote ? { batchNote } : {}) });
    pendingBrief = undefined;
    env.emit({ type: "execution_status", name: "v2.loop.continue", ok: true, summary: `할 일 재주입 ${d.n}/${8}(전체 ${reinjections}) — 열림 ${c.open}/${c.total}${batchNote ? ` · ${batchNote.slice(0, 80)}` : ""}`, data: { n: d.n, total: reinjections, open: c.open, items: c.total, prompt } });
    env.requireToolNextTurn?.();
    if (freshNext) { freshNext = false; env.freshContextNextTurn?.(); }
    return prompt;
  };
  /** 새 묶음을 덧붙였으면 묶음 수를 새로 세고 재주입. */
  const newBatch = (env: PiAssistantV2Env, opened: readonly TodoItem[], note: string): string | undefined => {
    if (!opened.length) return undefined;
    session.loop.resetBatch();
    return reinject(env, note);
  };
  /** ⑥ 화면 검수 한 판 — 결함을 vqa 항목으로 맞추고, 고칠 것이 있으면 덧붙인 항목을 돌려준다. */
  const vqaStep = async (env: PiAssistantV2Env): Promise<TodoItem[]> => {
    const closeAll = (why: string) => { for (const [id] of vqaItemDefects) { const item = store.get(id); if (item && isOpen(item.status)) store.block(item, why, "auto"); } vqaDone = true; };
    if (vqaRounds.length && !vqaShouldContinue(vqaRounds)) { closeAll("화면 검수 판 상한 — 남은 결함"); return []; }
    const fingerprint = projectFingerprint(env.ctx.project);
    if (vqaRounds.length && !vqaRounds.at(-1)!.problem && fingerprint && fingerprint === vqaReviewedFingerprint) {
      env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 ${vqaRounds.length + 1}판 건너뜀 — 앞 판 뒤로 바뀐 것이 없음`, data: { skipped: true } });
      closeAll("고치는 동안 프로젝트가 바뀌지 않음 — 남은 결함"); return [];
    }
    vqaReviewedFingerprint = fingerprint;
    const round = await runVqaRound(env);
    const act = vqaActionable(round, vqaRounds.at(-2));
    for (const d of act.ledger) {
      const line = vqaLedgerLine(d);
      if (vqaLedgerSeen.has(line)) continue;
      vqaLedgerSeen.add(line);
      env.emit({ type: "execution_status", name: "v2.vqa.outside", ok: false, summary: line.slice(0, 600), data: { round: round.round, defect: d } });
    }
    if (act.stuck.length) env.emit({ type: "execution_status", name: "v2.vqa.stuck", ok: false, summary: `두 판 연속 그대로인 결함 ${act.stuck.length}건 — 막힘으로 닫는다: ${act.stuck.map((d) => d.what).join(" / ").slice(0, 400)}`, data: { round: round.round, stuck: act.stuck } });
    // 앞 판 결함 항목: 이번 판에 다시 나왔나. 없으면 고쳐졌다(함수가 닫음), 그대로면 다시 열거나(두 판 연속이면) 막힘.
    const matched = new Set<VqaDefect>();
    if (!round.problem) {
      for (const [id, old] of vqaItemDefects) {
        const item = store.get(id);
        if (!item || item.status === "dropped") continue;
        const again = round.defects.find((nd) => vqaRepeated(nd, { ...round, defects: [old] }));
        if (!again) { if (item.status !== "blocked") store.done(item, { pass: true, detail: `화면 검수 ${round.round}판에서 사라짐` }, "auto"); continue; }
        matched.add(again);
        if (act.stuck.includes(again)) store.block(item, `화면 검수 두 판 연속 그대로 — ${again.what.slice(0, 120)}`, "auto");
        else if (!isOpen(item.status)) { store.reopen(item, { pass: false, detail: `화면 검수 ${round.round}판에 다시 나옴: ${again.what.slice(0, 160)}` }); if (item.attempts >= TODO_MAX_ATTEMPTS) store.block(item, "같은 화면 결함이 다시 나옴 — 고치지 못함", "auto"); }
      }
    }
    if (round.problem || !round.defects.length || !act.fix.length || !vqaShouldContinue(vqaRounds)) {
      // 검수 못 함·깨끗함·고칠 것 없음·판 상한 — 남은 것은 보고로.
      if (!vqaClean(round)) env.emit({ type: "execution_status", name: "v2.vqa", ok: false, summary: `화면 검수 ${round.round}판 뒤 끝 — ${round.problem ?? `남은 결함 ${round.defects.length}건(모델 밖 ${act.ledger.length} · 그대로 ${act.stuck.length})`}` });
      closeAll(round.problem ? `화면 검수 못 함 — ${round.problem}` : "화면 검수 판 상한 — 남은 결함");
      return [];
    }
    const fresh = act.fix.filter((d) => !matched.has(d));
    const opened = store.append(`화면 검수 ${round.round}판`, fresh.map((d, i) => ({ content: vqaDefectLine(d, i).replace(/^\d+\.\s*/u, "").slice(0, 220), key: `vqa:${round.round}:${i}` })), "vqa");
    for (const [i, item] of opened.entries()) if (fresh[i]) vqaItemDefects.set(item.id, fresh[i]!);
    const reopened = [...vqaItemDefects.keys()].map((id) => store.get(id)).filter((i): i is TodoItem => !!i && isOpen(i.status) && !opened.includes(i));
    pendingBrief = vqaFixBrief(env.request.task, env.ctx.project, act.fix, draft);
    freshNext = true;
    return [...opened, ...reopened];
  };
  // 청사진 자동 짓기(장소 → 경로 → 출구·이동 칸 마감 → 조립 기본값). 한 실행에 한 번씩(세션 깃발) + 늦게 생긴 청사진.
  const autoBuild = (env: PiAssistantV2Env): Promise<string | undefined> => runFinishAutoBuild(env, session);
  const lateBuildPending = (env: PiAssistantV2Env) => finishBuildPending(env, session);
  const done = await runPiAgent({
    ...request,
    systemPrompt: buildV2SystemPrompt(request.project, request.currentMapId, request.task, store),
    initialToolNames: [],
    openingProduction: false,
  }, {
    ...options,
    onEvent,
    // 존재하지 않는 이름 하나 — 레지스트리 도구를 하나도 고르지 않고, 이름 지정 실행이라 v1 확인표·작가 도구도 꺼진다.
    toolNames: ["__assistant_v2__"],
    v2: {
      tools: (env) => { const tools = withTodoLoop(env, store, session.loop, createV2Tools(env, session)); for (const t of tools) toolNames.add(t.name); return tools; },
      // 첫 호출 todo 강제(omo first-turn) — 쓰기 요청이고 이어 받은 목록이 없을 때. 로컬 CLI 는 감싸개가 첫 쓰기를 되돌린다.
      beforeFirstPrompt: (env) => { if (writeRequest && !store.initialized) env.requireToolNextTurn?.("todo"); },
      // 할 일 고리는 스스로 멈춘다(묶음당 8·진척 없음 2·서명 같음·ask_user). 이 수는 안전 상한일 뿐이다.
      maxRounds: 64,
      afterMain: async (env) => {
        liveEnv = env;
        try {
          refreshChecks(env);
          // 끝맺음 뒤에 청사진이 처음 생겼거나 다시 끊겼으면 지금 짓는다.
          if (autoBuilt && lateBuildPending(env)) {
            const late = await autoBuild(env);
            if (late) { autoNotes.push(late); env.emit({ type: "execution_status", name: "v2.blueprint.late", ok: true, summary: "끝맺음 뒤에 생긴 청사진을 함수가 지었다" }); refreshChecks(env); }
          }
          // ② 열린 항목 — 재주입.
          if (!loopStop && store.openCount()) {
            const prompt = reinject(env);
            if (prompt) return prompt;
          }
          if (session.questions.length) return undefined;
          // ③ 끝맺음 자동 짓기(결정적 — 고리가 멈췄어도 돈다). 지은 뒤 기계 확인을 다시 본다(막힌 항목을 함수가 해냈을 수 있다).
          if (!autoBuilt) {
            autoBuilt = true;
            const note = await autoBuild(env);
            if (note) autoNotes.push(note);
            refreshChecks(env);
            if (!loopStop && store.openCount()) { const prompt = reinject(env, "[함수 마감 뒤 기계 확인이 다시 열린 항목]"); if (prompt) return prompt; }
          }
          if (loopStop) return undefined;
          // ④ 끝맺음 관문 — 남은 문제는 «한 바퀴 더» 글이 아니라 할 일 항목이다.
          const gate = v2GateProblems(session, env);
          const capMapIds = new Set(session.unresolved().filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS).map((o) => o.mapId));
          const synced = syncGateItems(store, gate.problems, capMapIds, toolNames);
          if (synced.closed.length || synced.capped.length) env.emit({ type: "execution_status", name: "v2.gate.sync", ok: true, summary: `관문 항목 — 사라져 닫음 ${synced.closed.length} · 상한 막힘 ${synced.capped.length}` });
          if (synced.opened.length) {
            env.emit({ type: "execution_status", name: "v2.gate.items", ok: false, summary: `끝맺음 관문이 짚은 것 ${synced.opened.length}건을 할 일에 덧붙임`, data: { items: synced.opened.map((i) => ({ id: i.id, source: i.source, content: i.content })) } });
            const prompt = newBatch(env, synced.opened, `[끝맺음 관문 — 함수 검사·비평이 짚은 것 ${synced.opened.length}건을 할 일에 덧붙였다. 고친 뒤 done, 고칠 수 없으면 block(이유)]`);
            if (prompt) return prompt;
            return undefined;
          }
          // ⑤ 독립 검토자 — 보고 초안을 «실제로 바뀐 것»에 대어 본다. 막음만 항목으로(우려·참고는 기록만). 처음 한 번 + 그 항목을 닫은 뒤 한 번.
          const advisorOpen = [...advisorItems].some((id) => { const i = store.get(id); return i && isOpen(i.status); });
          if (advisorEnabled(env.request) && advisorRuns < 2 && !advisorOpen && (advisorRuns === 0 || advisorItems.size > 0)) {
            advisorRuns += 1;
            const verdict = scopeAdviceToRequest(withShipBlockers(await adviseTurn({ task: env.request.task, toolLog: compactToolLog(calls), diff: safeDiff(env), report: draft }, advisorChatOf(env), env.signal), safeShip(env)), env.request.task);
            advice = advice ? { ...verdict, ms: advice.ms + verdict.ms, inputChars: advice.inputChars + verdict.inputChars } : verdict;
            env.emit({ type: "execution_status", name: advisorRuns === 1 ? "v2.advisor" : "v2.advisor.recheck", ok: !verdict.notes.some((n) => n.level === "blocker"), summary: `${advisorRuns === 1 ? "" : "다시 검토 — "}${advisorSummary(verdict)} · ${env.advisorModel ?? "주 모델"}`, data: { ...verdict, model: env.advisorModel ?? "main" } });
            const blockers = verdict.notes.filter((n) => n.level === "blocker");
            const opened = store.append(advisorRuns === 1 ? "검토자" : "검토자 다시", blockers.map((n, i) => ({ content: `${n.what}${n.claim ? ` (보고: «${n.claim.slice(0, 60)}»)` : ""}`.slice(0, 220), key: `adv:${advisorRuns}:${i}` })), "critic");
            for (const item of opened) advisorItems.add(item.id);
            if (opened.length) {
              const prompt = newBatch(env, opened, `[독립 검토자 막음 ${opened.length}건 — 보고 초안이 실제 변경과 맞지 않거나 요청을 빠뜨렸다. 고치거나, 고칠 수 없으면 block(이유)]`);
              if (prompt) return prompt;
              return undefined;
            }
          }
          // ⑥ 화면 검수(게임 전체 요청만) — 결함은 vqa 항목.
          if (!vqaDone) {
            const opened = await vqaStep(env);
            if (opened.length) {
              const r = vqaRounds.at(-1)!;
              const prompt = newBatch(env, opened, `[화면 검수 ${r.round}판 — 다른 모델의 검수자(${r.reviewer})가 실제 그림에서 찾은 결함 ${opened.length}건을 할 일에 덧붙였다. 맵은 inspect 로 다시 보고 고친다]`);
              if (prompt) return prompt;
            }
          }
          return undefined;
        } finally {
          stamp(env);
        }
      },
    },
  });
  // 최종 보고 — 할 일이 있으면 기계 표로(완료는 열림 0·막힘 0·확인 전부 ✓ 일 때만). 모델 글이 «했다»고 쓴 ✗ 항목은 기계 결과로 고친다.
  try {
    const env = liveEnv;
    if (env && store.items.length) { refreshChecks(env, true); stamp(env); }
    const left = session.unresolved().filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS || !store.items.length);
    const leftovers = left.flatMap((o) => o.problems.slice(0, 3).map((p) => `${o.name}(${o.mapId}): ${p.replace(/ — (dress_room|네가 설계한 방이다).*$/u, "").slice(0, 200)}`));
    const vqaLeft = vqaRounds.length ? vqaSummary(vqaRounds) : undefined;
    if (!(options.signal?.aborted) && !session.questions.length && (store.items.length || leftovers.length)) {
      const report = todoReport({ store, draft, leftovers, missing: [...session.missingArt], autoNotes, ...(loopStop ? { loopStop } : {}), ...(vqaLeft && !vqaLeft.clean ? { vqa: vqaLeft.text } : {}) });
      options.onEvent?.({ type: "execution_status", name: "v2.todo.final", ok: report.complete, at: Date.now(), summary: `할 일 최종 — ${report.complete ? "완료" : "아직 완료 아님"} · ${store.view(0).split("\n")[0]}${report.receipts.length ? ` · 보고와 다른 것 ${report.receipts.length}` : ""}`, data: { complete: report.complete, receipts: report.receipts, list: store.view(), items: store.items, reinjections, loopStop } });
      if (store.items.length || /통과|없음|다\s*됐|완료/u.test(draft) || !draft) options.onEvent?.({ type: "assistant", text: report.text });
    }
  } catch { /* 보고 조립 실패는 실행을 막지 않는다 */ }
  options.onEvent?.({ type: "execution_status", name: "v2.summary", ok: (done as { ok?: boolean }).ok, at: Date.now(), summary: `v2 요약: 할 일 ${store.view(0).split("\n")[0]}·재주입 ${reinjections}${loopStop ? `(멈춤: ${loopStop})` : ""}·장소 ${new Set([...session.places.values()]).size}·사람/사건 ${session.content.length}·비평 ${session.criticCalls}회(${Math.round(session.criticMs / 1000)}초)·남은 문제 ${session.unresolved().length}·그림 없음 ${session.missingArt.size}${advice ? `·검토 ${advice.notes.filter((n) => n.level === "blocker").length}막음(${(advice.ms / 1000).toFixed(1)}초)` : ""}${vqaRounds.length ? `·${vqaSummary(vqaRounds).text}(${Math.round(vqaMs / 1000)}초)` : ""} · 전체 ${Math.round((Date.now() - started) / 1000)}초`,
    data: { todo: store.items, reinjections, loopStop, places: [...session.places.keys()], unresolved: session.unresolved(), missingArt: [...session.missingArt], criticCalls: session.criticCalls, criticMs: session.criticMs, ...(vqaRounds.length ? { vqa: { rounds: vqaRounds.map(({ round, defects, problem, reviewer, ms }) => ({ round, defects, problem, reviewer, ms })), ...vqaSummary(vqaRounds), ms: vqaMs } } : {}), ...(advice ? { advisor: { blockers: advice.notes.filter((n) => n.level === "blocker").length, notes: advice.notes.length, ms: advice.ms, inputChars: advice.inputChars } } : {}) } });
  return done;
}
