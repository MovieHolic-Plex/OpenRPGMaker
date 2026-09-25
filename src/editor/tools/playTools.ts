// editor/tools/playTools.ts
// Play validation tools. They create their own runtime sessions and never mutate the project.

import { isSceneTestInput, runSceneTest, sceneTestInputProblem } from "@/testing/sceneTestRunner";
import { runWalkthrough } from "@/testing/walkthroughRunner";
import type { ToolDefinition, ToolExecResult } from "./types";
import { ToolError } from "./types";
import { COORD_SCHEMA } from "./schemaShapes";

const playWalkthrough: ToolDefinition = {
  name: "play_walkthrough",
  description:
    "브라우저 없이 명령 흐름을 검사하며 실제 키보드 플레이 증거는 아니다. " +
    "moveTo는 좌표 이동만 하고 playerTouch/eventTouch를 자동 실행하지 않는다. " +
    "이동문은 interact로 해당 이벤트를 실행한 뒤 mapId를 검사한다. 실제 터치 발동은 플레이어에서 별도 확인한다. 스텝: " +
    "{do:'interact',eventId} / {do:'choose',index} / {do:'moveTo',mapId,x,y} / {do:'battle',expect:'victory'|'defeat'} / " +
    "{expect:'switch'|'item'|'variable'|'mapId'|'gold'|'ended', ...}. 도달 스텝/실패 지점/최종 상태를 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      scenario: {
        type: "array",
        description: "워크스루 스텝 배열",
        items: {
          type: "object",
          properties: {
            do: { type: "string", enum: ["moveTo", "interact", "choose", "battle"] },
            expect: { type: "string", enum: ["switch", "item", "variable", "mapId", "gold", "ended", "victory", "defeat"] },
            mapId: { type: "string" },
            x: { type: "integer" },
            y: { type: "integer" },
            facing: { type: "string", enum: ["up", "down", "left", "right"], description: "set 전용: 순간이동 뒤 바라볼 방향" },
            eventId: { type: "string" },
            index: { type: "integer", minimum: 0 },
            switchId: { type: "string" },
            value: { description: "switch에는 boolean, variable/gold에는 number" },
            present: { type: "boolean" },
            count: { type: "integer", minimum: 0 },
            variableId: { type: "string" },
            op: { type: "string", enum: ["=", ">=", "<=", ">", "<"] },
            itemId: { type: "string" },
          },
          // 스텝 variant 별 전용 필드는 워크스루 실행기가 검증한다.
          additionalProperties: false,
        },
      },
      seed: { type: "integer", description: "전투 판정 시드(선택, 재현용)" },
    },
    required: ["scenario"],
  },
  run(project, args): ToolExecResult {
    const seed = typeof args.seed === "number" ? args.seed : undefined;
    const result = runWalkthrough(project, args.scenario, { seed });
    const summary = result.ok
      ? `완주 성공 (${result.stepsRun}/${result.totalSteps} 스텝, 엔딩=${result.reachedEnding})`
      : `스텝 ${result.failedStepIndex}에서 실패: ${result.failureReason}`;
    return {
      summary,
      data: {
        ok: result.ok,
        stepsRun: result.stepsRun,
        totalSteps: result.totalSteps,
        failedStepIndex: result.failedStepIndex,
        failedStep: result.failedStep,
        failureReason: result.failureReason,
        reachedEnding: result.reachedEnding,
        finalState: {
          currentMapId: result.session.currentMapId,
          x: result.session.x,
          y: result.session.y,
          gold: result.session.gold,
          switchesOn: Object.entries(result.session.switches).filter(([, v]) => v).map(([k]) => k),
          inventory: result.session.inventory,
        },
        log: result.log,
      },
    };
  },
};

/**
 * `{kind:"expect", expect:{inventoryCount:…}}` 처럼 단언을 한 겹 더 감싼 스텝을 펼친다. 추리 도그푸딩 gen 두 판에서
 * 모델이 동봉 시나리오를 옮겨 적으며 이 모양을 만들어 run_scene_test 가 한 번씩 헛돌았다. 뜻이 하나라 추측이 아니다.
 */
export function flattenNestedExpectSteps(args: unknown): { input: unknown; flattened: number[] } {
  if (!args || typeof args !== "object" || !Array.isArray((args as { steps?: unknown }).steps)) return { input: args, flattened: [] };
  const flattened: number[] = [];
  const steps = ((args as { steps: unknown[] }).steps).map((step, index) => {
    if (!step || typeof step !== "object") return step;
    const record = step as Record<string, unknown>;
    const inner = record.expect;
    if (record.kind !== "expect" || !inner || typeof inner !== "object" || Array.isArray(inner)) return step;
    const { expect: _nested, ...rest } = record;
    if (Object.keys(inner).some((key) => key in rest)) return step;
    flattened.push(index);
    return { ...rest, ...(inner as Record<string, unknown>) };
  });
  return flattened.length > 0 ? { input: { ...(args as object), steps }, flattened } : { input: args, flattened };
}

/**
 * `{kind:"interact", to:{x,y}, adjacent:true}` 처럼 걷기와 조사를 한 스텝에 쓴 것을 walk + interact 두 스텝으로 나눈다.
 * JRPG 도그푸딩 ember-4 에서 합류·엔딩 검증 세 번이 모두 이 모양으로 거부됐다. walk(adjacent) 는 도착하면 대상 쪽을
 * 바라보므로 뜻이 하나다. to 가 {x,y} 가 아니거나 dir 처럼 다른 틀린 필드가 섞이면 그대로 두고 원래 오류를 낸다.
 */
export function splitInteractWalkSteps(args: unknown): { input: unknown; split: number[] } {
  if (!args || typeof args !== "object" || !Array.isArray((args as { steps?: unknown }).steps)) return { input: args, split: [] };
  const split: number[] = [];
  const steps = ((args as { steps: unknown[] }).steps).flatMap((step, index) => {
    if (!step || typeof step !== "object") return [step];
    const { to, adjacent, ...rest } = step as Record<string, unknown>;
    if (rest.kind !== "interact" || !to || typeof to !== "object") return [step];
    const { x, y } = to as { x?: unknown; y?: unknown };
    if (!Number.isInteger(x) || !Number.isInteger(y) || (adjacent !== undefined && typeof adjacent !== "boolean")) return [step];
    split.push(index);
    return [{ kind: "walk", to: { x, y }, adjacent: adjacent ?? true }, rest];
  });
  return split.length > 0 ? { input: { ...(args as object), steps }, split } : { input: args, split };
}

const runSceneTestTool: ToolDefinition = {
  name: "run_scene_test",
  description:
    "브라우저 없이 장면을 고정 tick으로 실행해 컷신/카메라/스폰/픽처/오디오 상태를 검증한다. 입력: " +
    "{mapId,start:{x,y},steps:[{kind:'wait',ticks}|{kind:'face',dir}|{kind:'set',switches?,variables?,inventory?,mapId?,x?,y?,facing?}|{kind:'move',dir|to}|{kind:'interact',eventId?}|{kind:'snapshotRewards'}|{kind:'gift',eventId?,itemId}|{kind:'choose',index}|{kind:'present',itemId?}|{kind:'retryCheckpoint'}|{kind:'advanceDays',days}|{kind:'expect',...}]}." +
    " present 는 대기 중인 presentItem(아이템 제시)에 itemId 를 내고, itemId 를 빼면 닫는다(cancelBranch)." +
    " expect는 playerAt, switchOn/Off, variableEquals, variableAtLeast, eventAt, eventOnMap, eventDistanceToPlayerLessThan, followerCount, followerAt, partyIncludes, partyExcludes, cameraAt, lightingAmbient, lightAt, lightCount, weatherKind, animationPlaying, fieldSpawnCount, spawnedCount, pictureVisible, bgmPlaying, gameOver, endingReached, cutsceneLocked, mapId, gameTimeAt, timePhase, cropStageAt, inventoryCount, goldDelta, inventoryDelta, ownedMonsterDelta, interactionComplete, friendshipAtLeast, shopStock를 지원한다. " +
    "Purchase proof: walk to/interact with the intended seller, then purchase {eventId,itemId,count,unitPrice}; assert goldDelta and inventoryDelta. Opens a real pending shop; no transaction means interactionComplete:false. Ordinary player-buy stock only, not haggle/shopkeeper/services. lastTransfer:{fromMapId,eventId,toMapId} asserts the last actual interpreter transfer. " +
    "NPC reward proof: snapshotRewards immediately before interacting; expect goldDelta:20 for currency, inventoryDelta:{itemId:count} / ownedMonsterDelta:{speciesId:count} (or {atLeast:1}) and interactionComplete:true. inventoryDelta.gold is an inventory item ID, never currency. For one-time rewards, snapshot again and interact twice in the SAME steps array, then expect zero gold/item/monster deltas. eventId checks the physically selected NPC, never directly executes its commands. finalState includes gold, partyActorIds (actor battle party), ownedMonsterCounts across party+box, monsterParty and monsterBox." +
    " Party-join proof: expect partyIncludes:\"actor_id\" after the join interaction. followerCount/followerAt only prove a walking follower (addFollower), not a battle-party member; only changeParty {actorId,action:\"add\"} changes partyActorIds." +
    " 필드 액션 전투는 실행하지 않으며, wait/스폰 성공은 전투 증거가 아니다. 액션 전투는 run_action_combat_test로 검증한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      start: COORD_SCHEMA,
      steps: {
        type: "array",
        description: "SceneStep[]",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", description: "스텝 종류" },
            dir: { type: "string", enum: ["up", "down", "left", "right"] },
            to: COORD_SCHEMA,
            adjacent: { type: "boolean" },
            ticks: { type: "integer" },
            index: { type: "integer" },
            mapId: { type: "string" },
            x: { type: "integer" },
            y: { type: "integer" },
            eventId: { type: "string" },
            itemId: { type: "string" },
            count: { type: "integer", minimum: 1, maximum: 99 },
            unitPrice: { type: "integer", minimum: 0 },
            lastTransfer: { type: "object", properties: { fromMapId: { type: "string" }, eventId: { type: "string" }, toMapId: { type: "string" } }, required: ["fromMapId", "eventId", "toMapId"], additionalProperties: false },
            text: { type: "string" },
            interactionComplete: { type: "boolean" },
            endingReached: { type: "string", minLength: 1, pattern: "\\S", description: "Exact ending ID reached by the scene (e.g. ending_escape), never a boolean." },
            goldDelta: { description: "Currency delta: exact signed safe integer (e.g. 20 or 0), or {atLeast:1}. Relative to snapshotRewards, scene start by default. Not an inventory item." },
            inventoryDelta: {
              type: "object", description: "Item ID to exact delta or {atLeast:number}, relative to snapshotRewards (scene start by default).",
              additionalProperties: true,
            },
            ownedMonsterDelta: {
              type: "object", description: "Species ID to exact delta or {atLeast:number}; counts owned instances in party and box, not actor party members.",
              additionalProperties: true,
            },
          },
          required: ["kind"],
          additionalProperties: true,
        },
      },
    },
    required: ["mapId", "start", "steps"],
  },
  run(project, rawArgs): ToolExecResult {
    const { input: flatArgs, flattened } = flattenNestedExpectSteps(rawArgs);
    const { input: args, split } = splitInteractWalkSteps(flatArgs);
    const problem = sceneTestInputProblem(args);
    if (problem || !isSceneTestInput(args)) throw new ToolError(`Malformed scene test input: ${problem}`, { code: "invalid-scene-test" });
    const result = runSceneTest(project, args);
    return {
      ...(flattened.length + split.length > 0 ? { warnings: [
        ...(flattened.length > 0 ? [`expect 스텝 ${flattened.join(", ")} 의 { kind:"expect", expect:{…} } 를 { kind:"expect", …} 로 펼쳐 실행했다 — 단언 필드는 스텝에 바로 쓴다.`] : []),
        ...(split.length > 0 ? [`interact 스텝 ${split.join(", ")} 의 to/adjacent 를 앞 스텝 {kind:"walk",to,adjacent:true} 로 나눠 실행했다 — 걷기와 조사는 두 스텝이다(스텝 번호가 하나씩 밀린다).`] : []),
      ] } : {}),
      summary: result.ok
        ? `scene test 성공 (${result.stepsRun}/${result.totalSteps} 스텝)`
        : `scene test 실패: 스텝 ${result.failedStepIndex} — ${result.failureReason}`,
      data: {
        ok: result.ok,
        stepsRun: result.stepsRun,
        totalSteps: result.totalSteps,
        failedStepIndex: result.failedStepIndex,
        failedStep: result.failedStep,
        failureReason: result.failureReason,
        finalState: result.finalState,
        interactions: result.interactions,
        ...(result.setupFailure ? { setupFailure: result.setupFailure } : {}),
        ...(result.failedSelection ? { failedSelection: result.failedSelection } : {}),
        log: result.log,
      },
    };
  },
};

const runActionCombatTestTool: ToolDefinition = {
  name: "run_action_combat_test",
  description: "전용 브라우저 플레이어에서 필드 액션 공격·처치·피격·회피·스태미나·적 투사체·보상을 실제 실행한다. 현재 맵/프로젝트에 귀속된 하네스 증거만 완료 조건을 통과한다. 장면 테스트나 모델 제공 증거로 대체할 수 없다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string", minLength: 1 } },
    required: ["mapId"],
    additionalProperties: false,
  },
  run(): ToolExecResult {
    throw new ToolError("Action combat proof requires the asynchronous browser harness.", { code: "async-harness-required" });
  },
};

export const PLAY_TOOLS: readonly ToolDefinition[] = [playWalkthrough, runSceneTestTool, runActionCombatTestTool];
