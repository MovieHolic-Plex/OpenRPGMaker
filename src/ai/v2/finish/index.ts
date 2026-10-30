// 조수 v2 끝맺음 자동 단계 — 실행기(scripts/lib/assistantV2Runtime.ts)가 끝맺음 관문 직전·늦은 청사진 차례에 도는 순서 그대로.
// 단계 하나 = finish/stages/<id>.ts 하나({ id, phase, order, run }), 목록 = finish/stages/index.ts(한 줄에 하나). 실행 순서는 묶음(phase) → order.
//   blueprint(청사진이 있을 때): 빈 맵 이름 → 장소 → 경로(+ 회복 길) → 단서·주인공·조사 자리 → 출구·이동 칸 마감
//   assembly(게임 전체 요청일 때): 조립 기본값(타이틀·오프닝) → 출하 기본값 → 단계 순서·전투 맞춤 → 목표·출구 다듬기
//   reload(맨 끝): 저장 → 다시 읽기 관문
// 재생 스크립트(scripts/qa/assistant-v2/finishReplay.mts)도 이 함수를 불러, 실제 실행기와 같은 순서를 지나는지 따로 맞추지 않아도 된다.
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../verbs";
import { BLUEPRINT_PATH_IDS, walkBlueprint } from "../blueprint";
import { battleSites, healingSources } from "../combatChecks";
import { wantsWholeGame } from "../shipChecks";
import { lanesStale } from "./lanesStamp";
import type { FinishCtx, FinishPhase, FinishStage } from "./types";
import * as registered from "./stages";

export { lanesStamp } from "./lanesStamp";
export type { FinishCtx, FinishPhase, FinishStage } from "./types";

const PHASES: readonly FinishPhase[] = ["blueprint", "assembly", "reload"];

/** 묶음 → order 순 단계 목록. 같은 묶음 안 order 가 겹치거나 reload 가 맨 끝이 아니면 모듈을 읽을 때 던진다(순서가 import 순서에 기대지 않게). */
export function orderedFinishStages(stages: readonly FinishStage[] = Object.values(registered)): FinishStage[] {
  const out: FinishStage[] = [];
  for (const phase of PHASES) {
    const list = stages.filter((s) => s.phase === phase).sort((a, b) => a.order - b.order);
    for (let i = 1; i < list.length; i++) if (list[i]!.order === list[i - 1]!.order) throw new Error(`끝맺음 단계 order 겹침: ${phase} ${list[i - 1]!.id}·${list[i]!.id} = ${list[i]!.order}`);
    out.push(...list);
  }
  const ids = new Set<string>();
  for (const s of out) { if (ids.has(s.id)) throw new Error(`끝맺음 단계 id 겹침: ${s.id}`); ids.add(s.id); }
  if (out.length !== stages.length) throw new Error("끝맺음 단계 phase 가 알 수 없는 값이다");
  return out;
}

export const FINISH_STAGES: readonly FinishStage[] = orderedFinishStages();

/** 청사진 자동 짓기(한 실행에 한 번씩 — 세션 깃발). 무엇을 지었는지 조수에게 줄 글(없으면 undefined). */
export async function runFinishAutoBuild(env: PiAssistantV2Env, session: V2Session): Promise<string | undefined> {
  if (lanesStale(env, session)) { session.autoLanesDone = false; session.lanesReruns++; }
  const ctx: FinishCtx = { env, session, done: [], assembled: [], walked: [] };
  const phase = (p: FinishPhase) => FINISH_STAGES.filter((s) => s.phase === p);
  if (env.ctx.project.gameBlueprint) {
    for (const stage of phase("blueprint")) { const pending = stage.run(ctx); if (pending) await pending; }
    if (ctx.done.length) ctx.autoPath = [`[자동으로 지음] 청사진이 엔딩까지 이어지지 않거나 길목·출구가 막혀 함수가 대신 지었다 — 최종 보고에 「자동으로 지음:」으로 이 목록을 그대로 적는다(네가 지었다고 쓰지 않는다):`, ...ctx.done.map((d) => `- ${d}`), "대사를 다듬으려면 build_blueprint_path{steps:[{id,lines,lockedLines}]} 로 다시 부른다(같은 이벤트를 고쳐 쓴다). 자동으로 지은 장소를 꾸미려면 edit_place·dress_room."].join("\n");
  }
  if (wantsWholeGame(env.request.task)) {
    for (const stage of phase("assembly")) { const pending = stage.run(ctx); if (pending) await pending; }
    if (ctx.assembled.length) {
      env.emit({ type: "execution_status", name: "v2.assembly", ok: true, summary: `청사진 조립 기본값: ${ctx.assembled.join(" · ")}` });
      await env.checkpoint("blueprint_assembly");
    }
  }
  for (const stage of phase("reload")) { const pending = stage.run(ctx); if (pending) await pending; }
  return ctx.autoPath;
}

/** 끝맺음 뒤 차례에서 자동 단계를 다시 돌릴 일이 남았나(늦게 쓴 청사진·다시 끊긴 경로·회복 길). */
export function finishBuildPending(env: PiAssistantV2Env, session: V2Session): boolean {
  if (env.ctx.project.gameBlueprint && lanesStale(env, session)) return true;
  return Boolean(env.ctx.project.gameBlueprint) && (!session.autoPlacesDone || !session.autoPathDone || !session.autoLanesDone)
    && (!session.autoLanesDone || (!session.autoPathDone && battleSites(env.ctx.project).length > 0 && healingSources(env.ctx.project).length === 0)
      || walkBlueprint(env.ctx.project).blockers.some((b) => b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable" || BLUEPRINT_PATH_IDS.has(b.id)));
}
