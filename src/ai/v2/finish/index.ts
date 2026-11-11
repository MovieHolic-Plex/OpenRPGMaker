// 조수 v2 끝맺음 자동 단계 — 실행기(scripts/lib/assistantV2Runtime.ts)가 끝맺음 관문 직전·늦은 청사진 차례에 도는 순서 그대로.
// 단계 하나 = finish/stages/<id>.ts 하나({ id, phase, order, run }), 목록 = finish/stages/index.ts(한 줄에 하나). 실행 순서는 묶음(phase) → order.
//   blueprint(청사진이 있을 때): 빈 맵 이름 → 장소 → 경로(+ 회복 길) → 단서·주인공·조사 자리 → 출구·이동 칸 마감
//   assembly(게임 전체 요청일 때): 조립 기본값(타이틀·오프닝) → 출하 기본값 → 단계 순서·전투 맞춤 → 목표·출구 다듬기
//   reload(맨 끝): 저장 → 다시 읽기 관문
// 재생 스크립트(scripts/qa/assistant-v2/finishReplay.mts)도 이 함수를 불러, 실제 실행기와 같은 순서를 지나는지 따로 맞추지 않아도 된다.
import { worldOf } from "../place/world";
import type { PiAssistantV2Env } from "../shared/env";
import type { V2Session } from "../turn/session";
import { BLUEPRINT_PATH_IDS, walkBlueprint } from "../story/blueprint";
import { battleSites, healingSources } from "../judge/combatChecks";
import { buildsWholeGame } from "../request/readers";
import { classifyRequest } from "../request/intent";
import { lanesStale } from "./lanesStamp";
import type { FinishCtx, FinishPhase, FinishStage } from "./types";
import * as registered from "./stages";
import { recordStageWrites } from "../shared/stageWrites";
import { createBuildRun } from "../shared/buildRun";
import { orderedStages } from "./stageOrder";
import { yieldToLoop } from "../shared/yieldLoop";

export { lanesStamp } from "./lanesStamp";
export type { FinishCtx, FinishPhase, FinishStage } from "./types";

/** 2초 넘게 걸린 단계는 이름·시간을 stderr 에 남긴다(2026-11-09 monster «terminated»: assembly:ship-defaults 414초 — 동작 불변). */
const timedStage = async (id: string, run: () => void | Promise<void>): Promise<void> => { const t0 = Date.now(); try { await run(); } finally { const ms = Date.now() - t0; if (ms >= 2000) console.error(`[v2-stage] ${id} took ${Math.round(ms / 1000)}s`); } };

// 단계마다 끝에 루프에 차례를 준다(shared/yieldLoop.ts) — 동기 단계가 줄줄이 돌면 그 합만큼 워커가 말이 없다.
const recordedRun = async (ctx: FinishCtx, stage: FinishStage): Promise<void> => { await recordStageWrites(() => ctx.env.ctx.project, ctx.session.stageWrites, () => stage.run(ctx, "")); await yieldToLoop(); };

/** 이 실행기가 도는 묶음(마감 묶음 lane-* 은 finish/lanes/index.ts 가 돈다). */
const PHASES: readonly FinishPhase[] = ["blueprint", "assembly", "reload"];

const FINISH_STAGES: readonly FinishStage[] = orderedStages(Object.values(registered), PHASES);

/**
 * 이번 턴이 청사진의 게임을 짓는 일인가 — 게임 하나(또는 그 이어 하기)·맵 여러 장과 이야기를 맡긴 요청이거나, 이번 턴에 청사진을 쓰거나 고쳤다.
 * 작은 요청(사람 옮기기·문 하나·대사 고치기)은 지은 게임에서도 청사진 끝맺음을 돌리지 않는다 — 돌리면 요청과 무관한 사람이 옮겨지고
 * (2026-11-11 작은 일 기준선: 불합격 7건 중 2건), 턴마다 모든 맵을 다시 훑는다.
 */
function blueprintTurn(env: PiAssistantV2Env): boolean {
  const blueprint = env.ctx.project.gameBlueprint;
  if (!blueprint) return false;
  const intent = classifyRequest(env.request.task, env.ctx.project);
  if (intent.wholeGame || intent.makeGame) return true;
  const before = (env.request.project as { gameBlueprint?: unknown } | undefined)?.gameBlueprint;
  return blueprint !== before && JSON.stringify(blueprint) !== JSON.stringify(before ?? null);
}

/** 청사진 자동 짓기(한 실행에 한 번씩 — 세션 깃발). 무엇을 지었는지 조수에게 줄 글(없으면 undefined). */
export async function runFinishAutoBuild(env: PiAssistantV2Env, session: V2Session): Promise<string | undefined> {
  if (lanesStale(env, session)) { session.autoLanesDone = false; session.lanesReruns++; }
  const ctx: FinishCtx = { env, session, done: [], assembled: [], walked: [], run: createBuildRun(env.ctx), notes: [], map: {} };
  const phase = (p: FinishPhase) => FINISH_STAGES.filter((s) => s.phase === p);
  if (env.ctx.project.gameBlueprint) {
    const whole = blueprintTurn(env);
    for (const stage of phase("blueprint")) if (whole || stage.ownWork) await timedStage(`blueprint:${stage.id}`, () => recordedRun(ctx, stage));
    if (ctx.done.length) ctx.autoPath = [`[자동으로 지음] 청사진이 엔딩까지 이어지지 않거나 길목·출구가 막혀 함수가 대신 지었다 — 최종 보고에 「자동으로 지음:」으로 이 목록을 그대로 적는다(네가 지었다고 쓰지 않는다):`, ...ctx.done.map((d) => `- ${d}`), `대사를 다듬으려면 build_blueprint_path{steps:[{id,lines,lockedLines}]} 로 다시 부른다(같은 이벤트를 고쳐 쓴다). ${worldOf(env.ctx.project)?.composer ? "세계 장소는 구성기가 한 번에 깐 맵이라 다시 짓지 않는다 — 꾸미려면 place_object·add_people." : "자동으로 지은 장소를 꾸미려면 edit_place·dress_room."}`].join("\n");
  }
  if (buildsWholeGame(env.ctx.project, env.request.task)) {
    for (const stage of phase("assembly")) await timedStage(`assembly:${stage.id}`, () => recordedRun(ctx, stage));
    if (ctx.assembled.length) {
      env.emit({ type: "execution_status", name: "v2.assembly", ok: true, summary: `청사진 조립 기본값: ${ctx.assembled.join(" · ")}` });
      await env.checkpoint("blueprint_assembly");
    }
  }
  for (const stage of phase("reload")) await timedStage(`reload:${stage.id}`, () => recordedRun(ctx, stage));
  return ctx.autoPath;
}

/** 끝맺음 뒤 차례에서 자동 단계를 다시 돌릴 일이 남았나(늦게 쓴 청사진·다시 끊긴 경로·회복 길). */
export function finishBuildPending(env: PiAssistantV2Env, session: V2Session): boolean {
  if (!blueprintTurn(env)) return false;
  if (env.ctx.project.gameBlueprint && lanesStale(env, session)) return true;
  return Boolean(env.ctx.project.gameBlueprint) && (!session.autoPlacesDone || !session.autoPathDone || !session.autoLanesDone)
    && (!session.autoLanesDone || (!session.autoPathDone && battleSites(env.ctx.project).length > 0 && healingSources(env.ctx.project).length === 0)
      || walkBlueprint(env.ctx.project).blockers.some((b) => b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable" || BLUEPRINT_PATH_IDS.has(b.id)));
}
