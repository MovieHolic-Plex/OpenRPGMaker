/**
 * 루프 반복 가드는 **루프마다 따로** 세어야 한다.
 *
 * 회귀 배경: `state.loopIterations` 가 인터프리터 전역 카운터 하나였고
 * `commandCatalog` 의 `case "loop"` 이 루프에 **진입할 때마다** 그 카운터를 0 으로
 * 되돌렸다. 그래서 안쪽 루프가 바깥 루프의 반복 수를 매 바깥 반복마다 지웠고,
 * 바깥 루프의 `maxLoopIterations` 가드는 영원히 울리지 않았다. 실제로 멈춘 것은
 * `maxInstructions` 였다 — 엉뚱한 가드가 울리니 로그도 원인을 가리키지 못했다.
 */
import { describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function mkSession(): PlaySessionLike {
  return {
    flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
    partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
    currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
  } as unknown as PlaySessionLike;
}

/** 예산 소진 경고만 순서대로 모은다. 루프 종료는 `console.warn` 도 내므로 함께 삼킨다. */
function runCollectingBudgetWarnings(
  commands: Command[],
  options: { maxLoopIterations: number; maxInstructions: number },
): string[] {
  const warnings: string[] = [];
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    createInterpreter(commands, mkSession(), undefined, {
      ...options,
      onUnverified: (message) => warnings.push(message),
    }).start();
  } finally {
    consoleWarn.mockRestore();
  }
  return warnings;
}

describe("루프 반복 예산", () => {
  it("안쪽 루프가 바깥 루프의 반복 수를 지우지 않는다", () => {
    // 바깥 루프는 끝나지 않는다. 본문은 「즉시 빠져나오는 안쪽 루프」 하나뿐이라
    // 바깥 반복마다 안쪽 루프 진입이 일어난다.
    const commands: Command[] = [{
      kind: "loop",
      body: [{ kind: "loop", body: [{ kind: "breakLoop" }] }],
    }];

    const warnings = runCollectingBudgetWarnings(commands, {
      maxLoopIterations: 5,
      maxInstructions: 1000,
    });

    // 바깥 루프가 6번째 반복에서 자기 예산으로 멈춰야 한다 — 명령 예산이 아니라.
    expect(warnings).toEqual(["Interpreter loop budget exhausted"]);
  });

  it("앞선 루프가 소진돼도 다음 루프는 자기 예산을 새로 받는다", () => {
    const neverEnding = (): Command => ({ kind: "loop", body: [{ kind: "label", name: "x" }] });
    const commands: Command[] = [neverEnding(), neverEnding()];

    const warnings = runCollectingBudgetWarnings(commands, {
      maxLoopIterations: 3,
      maxInstructions: 1000,
    });

    expect(warnings).toEqual([
      "Interpreter loop budget exhausted",
      "Interpreter loop budget exhausted",
    ]);
  });
});
