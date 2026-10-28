// 조수 v2 끝맺음 자동 단계 — 실행기(scripts/lib/assistantV2Runtime.ts)가 끝맺음 관문 직전·늦은 청사진 차례에 도는 순서 그대로.
// 장소 → 경로(+ 회복 길) → 출구·이동 칸 마감 → 조립 기본값(타이틀·오프닝) → 출하 기본값(applyShipDefaults).
// 재생 스크립트(scripts/qa/assistant-v2/finishReplay.mts)도 이 함수를 불러, 실제 실행기와 같은 순서를 지나는지 따로 맞추지 않아도 된다.
import type { PiAssistantV2Env } from "./env";
import type { V2Session } from "./verbs";
import { BLUEPRINT_PATH_IDS, walkBlueprint } from "./blueprint";
import { battleSites, healingSources } from "./combatChecks";
import { wantsWholeGame } from "./shipChecks";
import { applyShipDefaults } from "./shipDefaults";
import { applyBlueprintAssembly } from "@/project/blueprintAssembly";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";

/** 청사진 자동 짓기(한 실행에 한 번씩 — 세션 깃발). 무엇을 지었는지 조수에게 줄 글(없으면 undefined). */
export async function runFinishAutoBuild(env: PiAssistantV2Env, session: V2Session): Promise<string | undefined> {
  let autoPath: string | undefined;
  if (env.ctx.project.gameBlueprint) {
    const done: string[] = [];
    let walked = walkBlueprint(env.ctx.project).blockers;
    if (session.buildPlaces && !session.autoPlacesDone && walked.some((b) => b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable")) {
      session.autoPlacesDone = true;
      const notes = await session.buildPlaces();
      env.emit({ type: "execution_status", name: "v2.blueprint.auto_places", ok: true, summary: `청사진 장소 자동 짓기 — ${notes.join(" / ").slice(0, 300)}` });
      if (notes.length) done.push(`장소: ${notes.join(" / ").slice(0, 700)}`);
      walked = walkBlueprint(env.ctx.project).blockers;
    }
    // 전투가 있는데 회복할 길이 0(출하 검사 combat-no-healing)도 경로 짓기가 고친다(build_blueprint_path 끝의 ensureHealingAccess) — 경로 막힘이 없어도 부른다.
    const noHealing = battleSites(env.ctx.project).length > 0 && healingSources(env.ctx.project).length === 0;
    if (session.buildPath && !session.autoPathDone && (noHealing || walked.some((b) => BLUEPRINT_PATH_IDS.has(b.id)))) {
      session.autoPathDone = true;
      const built = await session.buildPath([...walked.map((b) => b.id), ...(noHealing ? ["combat-no-healing"] : [])].join(","));
      env.emit({ type: "execution_status", name: "v2.blueprint.auto_path", ok: built.ok, summary: `청사진 경로 자동 짓기 — ${built.summary.slice(0, 300)}` });
      done.push(built.ok ? `경로: ${built.summary.slice(0, 600)}` : `경로 짓기 실패: ${built.summary.slice(0, 400)} — 이 이유를 고친 뒤 build_blueprint_path 를 부른다.`);
    }
    if (session.clearLanes && !session.autoLanesDone) {
      session.autoLanesDone = true;
      const lanes = await session.clearLanes();
      if (lanes.length) {
        env.emit({ type: "execution_status", name: "v2.blueprint.auto_lanes", ok: true, summary: `출구·이동 칸 마감 — ${lanes.join(" / ").slice(0, 300)}` });
        done.push(`출구·이동 칸 마감: ${lanes.join(" / ").slice(0, 500)}`);
      }
    }
    if (done.length) autoPath = [`[자동으로 지음] 청사진이 엔딩까지 이어지지 않거나 길목·출구가 막혀 함수가 대신 지었다 — 최종 보고에 「자동으로 지음:」으로 이 목록을 그대로 적는다(네가 지었다고 쓰지 않는다):`, ...done.map((d) => `- ${d}`), "대사를 다듬으려면 build_blueprint_path{steps:[{id,lines,lockedLines}]} 로 다시 부른다(같은 이벤트를 고쳐 쓴다). 자동으로 지은 장소를 꾸미려면 edit_place·dress_room."].join("\n");
  }
  // 조립 기본값(2026-10-28): 청사진이 있는 게임 요청이면 아무도 고르지 않은 타이틀 그림·기본 문구·기본 왕국 오프닝을 청사진에 맞춘다 — 모델이 부르지 않아도.
  // 장소 자동 짓기 뒤에 둔다(시작 맵이 생긴 뒤라야 그 맵 화면을 타이틀로 쓸 수 있다).
  if (wantsWholeGame(env.request.task)) {
    const assembled = applyBlueprintAssembly(env.ctx.project);
    // 청사진 기본 오프닝(맵 화면 장면 + 청사진 문장 내레이션) — 모델이 만든 오프닝은 그대로 둔다. 실패해도 마감은 계속한다.
    // autoBuild 안이라 늦게 쓴 청사진(v2.blueprint.late)에서도 장소·경로·출구를 지은 뒤 돈다.
    try { assembled.push(...applyBlueprintOpening(env.ctx.project)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `기본 오프닝을 깔지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
    // 출하 기본값(2026-10-29 vm1): 전투 곡·전투 배경·파티 모습/얼굴·엔딩 맺음·기본 지명 — 출하 검사가 «기본값이 남았다»고 짚는 것만 채운다.
    try { assembled.push(...applyShipDefaults(env.ctx.project, env.request.task)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `출하 기본값을 채우지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
    if (assembled.length) {
      env.emit({ type: "execution_status", name: "v2.assembly", ok: true, summary: `청사진 조립 기본값: ${assembled.join(" · ")}` });
      await env.checkpoint("blueprint_assembly");
    }
  }
  return autoPath;
}

/** 끝맺음 뒤 차례에서 자동 단계를 다시 돌릴 일이 남았나(늦게 쓴 청사진·다시 끊긴 경로·회복 길). */
export function finishBuildPending(env: PiAssistantV2Env, session: V2Session): boolean {
  return Boolean(env.ctx.project.gameBlueprint) && (!session.autoPlacesDone || !session.autoPathDone || !session.autoLanesDone)
    && (!session.autoLanesDone || (!session.autoPathDone && battleSites(env.ctx.project).length > 0 && healingSources(env.ctx.project).length === 0)
      || walkBlueprint(env.ctx.project).blockers.some((b) => b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable" || BLUEPRINT_PATH_IDS.has(b.id)));
}
