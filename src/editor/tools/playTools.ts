// editor/tools/playTools.ts
// Play validation tools. They create their own runtime sessions and never mutate the project.

import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { runWalkthrough } from "@/testing/walkthroughRunner";
import type { ToolDefinition, ToolExecResult } from "./types";
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

const runSceneTestTool: ToolDefinition = {
  name: "run_scene_test",
  description:
    "브라우저 없이 장면을 고정 tick으로 실행해 컷신/카메라/스폰/픽처/오디오 상태를 검증한다. 입력: " +
    "{mapId,start:{x,y},steps:[{kind:'wait',ticks}|{kind:'face',dir}|{kind:'set',switches?,variables?,inventory?,mapId?,x?,y?}|{kind:'move',dir|to}|{kind:'interact'}|{kind:'gift',eventId?,itemId}|{kind:'choose',index}|{kind:'retryCheckpoint'}|{kind:'advanceDays',days}|{kind:'expect',...}]}." +
    " expect는 playerAt, switchOn/Off, variableEquals, variableAtLeast, eventAt, eventOnMap, eventDistanceToPlayerLessThan, followerCount, followerAt, cameraAt, lightingAmbient, lightAt, lightCount, weatherKind, animationPlaying, fieldSpawnCount, spawnedCount, pictureVisible, bgmPlaying, gameOver, endingReached, cutsceneLocked, mapId, gameTimeAt, timePhase, cropStageAt, inventoryCount, friendshipAtLeast, shopStock를 지원한다.",
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
            mapId: { type: "string" },
            x: { type: "integer" },
            y: { type: "integer" },
            eventId: { type: "string" },
            text: { type: "string" },
          },
          required: ["kind"],
          additionalProperties: true,
        },
      },
    },
    required: ["mapId", "start", "steps"],
  },
  run(project, args): ToolExecResult {
    const input = {
      mapId: args.mapId as string,
      start: args.start as { x: number; y: number },
      steps: Array.isArray(args.steps) ? (args.steps as SceneStep[]) : [],
    };
    const result = runSceneTest(project, input);
    return {
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
        log: result.log,
      },
    };
  },
};

export const PLAY_TOOLS: readonly ToolDefinition[] = [playWalkthrough, runSceneTestTool];
