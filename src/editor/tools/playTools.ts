// editor/tools/playTools.ts
// 플레이 검증 툴: play_walkthrough — 헤드리스 워크스루 러너를 프로젝트에 실행해 완주 가능성을 검증한다.
// 읽기 툴(프로젝트 불변). 러너는 자체 세션을 만들어 진행하므로 draft를 변형하지 않는다.
// 이 툴로 AI 어시스턴트가 자기가 만든 콘텐츠를 스스로 완주 검증하는 루프가 완성된다.

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

export const PLAY_TOOLS: readonly ToolDefinition[] = [playWalkthrough];
