// 조수 v2 끝맺음 자동 단계 — 실행기(scripts/lib/assistantV2Runtime.ts)가 끝맺음 관문 직전·늦은 청사진 차례에 도는 순서 그대로.
// 장소 → 경로(+ 회복 길) → 출구·이동 칸 마감 → 조립 기본값(타이틀·오프닝) → 출하 기본값(applyShipDefaults).
// 재생 스크립트(scripts/qa/assistant-v2/finishReplay.mts)도 이 함수를 불러, 실제 실행기와 같은 순서를 지나는지 따로 맞추지 않아도 된다.
import type { PiAssistantV2Env } from "./env";
import type { V2Session } from "./verbs";
import { BLUEPRINT_PATH_IDS, walkBlueprint } from "./blueprint";
import { battleSites, healingSources } from "./combatChecks";
import { wantsWholeGame } from "./shipChecks";
import { applyShipDefaults } from "./shipDefaults";
import { refreshObjectiveRoutes } from "./discoverability";
import { fitUnwinnableStepBattlesIn, orderStepBattlesIn } from "./blueprintPath";
import { ensureBossRest } from "./healingAccess";
import { createBuildRun } from "./buildRun";
import { applyBlueprintAssembly } from "@/project/blueprintAssembly";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";
import { renameBareBlueprintPlaces } from "./blankStart";
import { alignCodeClues, humanizeBlueprintTokens } from "./codeClues";
import { settleFurnitureSpots } from "./examineSpot";
import { createBuildRun } from "./buildRun";

/** 청사진 자동 짓기(한 실행에 한 번씩 — 세션 깃발). 무엇을 지었는지 조수에게 줄 글(없으면 undefined). */
export async function runFinishAutoBuild(env: PiAssistantV2Env, session: V2Session): Promise<string | undefined> {
  let autoPath: string | undefined;
  if (env.ctx.project.gameBlueprint) {
    const done: string[] = [];
    // 청사진 장소가 잔디 한 장뿐인 빈 맵이면 장소 이름을 요청의 장소 낱말로 바꿔 아래 장소 짓기가 실제 방을 짓게 한다(blankStart.renameBareBlueprintPlaces).
    if (session.buildPlaces && !session.autoPlacesDone) {
      const bare = renameBareBlueprintPlaces(env.ctx.project);
      if (bare.renamed.size) {
        env.ctx.project = bare.project;
        session.barePlaces = bare.renamed;
        done.push(`빈 맵 장소: 청사진 장소 「빈 맵」을 ${[...bare.renamed.keys()].map((n) => `「${n}」`).join("·")}(으)로 지을 장소로 바꿈`);
      }
    }
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
    // 번호 자물쇠 ↔ 단서 대사 맞추기 + 청사진 영문 id 대사 고치기(codeClues.ts) — 모델이 지은 경로에도 돈다.
    {
      const aligned = alignCodeClues(env.ctx.project);
      const human = humanizeBlueprintTokens(aligned.project);
      env.ctx.project = human.project;
      const fixed = [...aligned.notes, ...(human.notes.length ? [`청사진 id 대사 ${human.notes.length}줄을 뜻 낱말로`] : [])];
      if (fixed.length) done.push(`번호·단서 대사: ${fixed.join(" / ").slice(0, 500)}`);
    }
    // 그림 없는 조사 칸은 가구에 앉히고, 가구 위 조사는 가구 전체에서 받는다(examineSpot.settleFurnitureSpots).
    {
      const run = createBuildRun(env.ctx);
      const settled = Object.keys(env.ctx.project.maps).flatMap((mapId) => settleFurnitureSpots(run, mapId));
      if (settled.length) done.push(`조사 자리: ${settled.join(" / ").slice(0, 500)}`);
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
    // 단계 순서 보호 — 앞 단계 전엔 길을 막는 보스가 안 나타나고, 잠김 대사가 앞 단계 이벤트를 가리킨다(2026-10-29 vm3 terra jrpg). 경로를 다시 짓지 않는 판에도.
    // 시작 파티로 못 이기는 길목 보스를 맞춘 사본으로 — 경로를 다시 짓지 않는 판에도(2026-10-29 vm3 flash jrpg 리치).
    try { assembled.push(...fitUnwinnableStepBattlesIn(env.ctx.project)); }
    catch { /* 맞추기 실패는 끝맺음을 깨지 않는다 */ }
    // 보스 앞 쉼터 — 깎인 HP·독으로 보스 앞에 서지 않게(2026-10-29 vm3 flash jrpg 리치). 던전 빌더도 같은 함수를 부른다.
    try { assembled.push(...ensureBossRest(createBuildRun(env.ctx))); }
    catch { /* 쉼터 넣기 실패는 끝맺음을 깨지 않는다 */ }
    try { assembled.push(...orderStepBattlesIn(env.ctx.project)); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `단계 순서 보호를 하지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
    // 목표 꼬리 「(<맵> 입구: 방위)」를 마지막 연결로 다시 쓴다 — 목표가 걸리는 자리에서 본 첫 출구 방위·그 뒤 대상(2026-10-29 vm2 jrpg 길 못 찾음).
    try { const n = refreshObjectiveRoutes(env.ctx.project); if (n) assembled.push(`목표 길 안내 ${n}곳`); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `목표 길 안내를 다시 쓰지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
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
