// test/commandContracts/cutsceneControl.contract.test.ts
// 계약: cutsceneControl.
import { describe, expect, it } from "vitest";
import { CUTSCENE_LOCK_FLAG, CUTSCENE_SKIPPABLE_FLAG } from "@/player/cutsceneControl";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("cutsceneControl 계약", () => {
  it("begin은 입력 잠금과 스킵 가능 상태를 세션에 기록한다", () => {
    const result = runCommandContract([{ kind: "cutsceneControl", mode: "begin", skippable: true }]);

    expect(result.session.flags[CUTSCENE_LOCK_FLAG]).toBe(true);
    expect(result.session.flags[CUTSCENE_SKIPPABLE_FLAG]).toBe(true);
    expect(result.session.m2Runtime?.cutscene.lockPlayer).toBe(true);
    expect(result.session.m2Runtime?.cutscene.skippable).toBe(true);
    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("end는 입력 잠금과 컷신 owner 플래그를 해제한다", () => {
    const result = runCommandContract([
      { kind: "cutsceneControl", mode: "begin", skippable: true },
      { kind: "cutsceneControl", mode: "end" },
    ]);

    expect(result.session.flags[CUTSCENE_LOCK_FLAG]).toBeUndefined();
    expect(result.session.flags[CUTSCENE_SKIPPABLE_FLAG]).toBeUndefined();
    expect(Object.keys(result.session.flags).some((key) => key.startsWith("cutscene:owner:"))).toBe(false);
    expect(result.session.m2Runtime?.cutscene.lockPlayer).toBe(false);
    expect(result.session.m2Runtime?.cutscene.skippable).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 세션 결과가 같다", () => {
    const commands: Command[] = [
      { kind: "cutsceneControl", mode: "begin", skippable: true },
      { kind: "cutsceneControl", mode: "end" },
    ];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands);
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
  });

  it("pause 의미론: cutsceneControl 은 non-blocking 이다", () => {
    const result = runCommandContract([{ kind: "cutsceneControl", mode: "begin" }]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
