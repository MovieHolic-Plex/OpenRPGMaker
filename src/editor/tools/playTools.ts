// editor/tools/playTools.ts
// Play validation tools. They create their own runtime sessions and never mutate the project.

import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { runWalkthrough, type WalkthroughStep } from "@/testing/walkthroughRunner";
import type { ToolDefinition, ToolExecResult } from "./types";

const playWalkthrough: ToolDefinition = {
  name: "play_walkthrough",
  description:
    "시나리오 스텝을 브라우저 없이 실행해 완주 가능성/막힘 지점을 검증한다. 스텝: " +
    "{do:'interact',eventId} / {do:'choose',index} / {do:'moveTo',mapId,x,y} / {do:'battle',expect:'victory'|'defeat'} / " +
    "{expect:'switch'|'item'|'variable'|'mapId'|'gold'|'ended', ...}. 도달 스텝/실패 지점/최종 상태를 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      scenario: { type: "array", description: "워크스루 스텝 배열", items: { type: "object" } },
      seed: { type: "integer", description: "전투 판정 시드(선택, 재현용)" },
    },
    required: ["scenario"],
  },
  run(project, args): ToolExecResult {
    const scenario = Array.isArray(args.scenario) ? (args.scenario as WalkthroughStep[]) : [];
    const seed = typeof args.seed === "number" ? args.seed : undefined;
    const result = runWalkthrough(project, scenario, { seed });
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
    "{mapId,start:{x,y},steps:[{kind:'wait',ticks}|{kind:'move',dir|to}|{kind:'interact'}|{kind:'choose',index}|{kind:'expect',...}]}." +
    " expect는 playerAt, switchOn/Off, variableEquals, eventAt, cameraAt, spawnedCount, pictureVisible, bgmPlaying, gameOver, mapId를 지원한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      start: { type: "object", description: "{x,y}" },
      steps: { type: "array", description: "SceneStep[]", items: { type: "object" } },
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
