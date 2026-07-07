// test/commandContracts/displayTextSettings.contract.test.ts
// G1 계약: displayTextSettings (스펙 §5.1 행).
//
// 실측 메모:
// - session.messageWindowSettings 를 갱신하고 이후 text/choices/inputNumber pause 에 전달된다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

const SETTINGS: Extract<Command, { kind: "displayTextSettings" }> = {
  kind: "displayTextSettings",
  format: "transparent",
  position: "center",
  preventObscuringPlayer: false,
  allowEventMovementDuringWait: true,
};

describe("displayTextSettings 계약", () => {
  it("정상 효과: 세션 messageWindowSettings 를 갱신하고 이후 text pause 에 반영한다", () => {
    const result = runCommandContract([SETTINGS, { kind: "text", body: "settings" }]);

    expect(result.session.messageWindowSettings).toEqual({
      format: "transparent",
      position: "center",
      preventObscuringPlayer: false,
      allowEventMovementDuringWait: true,
    });
    expect(result.pauses).toEqual([
      expect.objectContaining({ kind: "text", body: "settings", settings: result.session.messageWindowSettings }),
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: 모든 boolean 옵션 false 조합도 경고 없이 적용된다", () => {
    const result = runCommandContract([
      {
        kind: "displayTextSettings",
        format: "normal",
        position: "bottom",
        preventObscuringPlayer: false,
        allowEventMovementDuringWait: false,
      },
      { kind: "text", body: "bottom" },
    ]);

    expect(result.pauses[0]).toMatchObject({
      kind: "text",
      settings: {
        format: "normal",
        position: "bottom",
        preventObscuringPlayer: false,
        allowEventMovementDuringWait: false,
      },
    });
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("연쇄: 갱신된 settings 가 choices 와 inputNumber pause 에도 전달된다", () => {
    const result = runCommandContract(
      [
        SETTINGS,
        { kind: "choices", options: [{ text: "go", branch: [] }] },
        { kind: "inputNumber", variableId: "var_after_settings", digits: 2 },
      ],
      { answers: [0, 12] }
    );

    expect(result.pauses[0]).toMatchObject({ kind: "choices", settings: result.session.messageWindowSettings });
    expect(result.pauses[1]).toMatchObject({ kind: "inputNumber", settings: result.session.messageWindowSettings });
    expect(result.session.variables.var_after_settings).toBe(12);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 settings 와 pause 가 같다", () => {
    const commands: Command[] = [SETTINGS, { kind: "text", body: "roundtrip settings" }];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
    expect(restored.pauses).toEqual(original.pauses);
  });

  it("pause 의미론: displayTextSettings 자체는 non-blocking — 단독 실행 시 pause 가 없다", () => {
    const result = runCommandContract([SETTINGS]);

    expect(result.pauses).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
