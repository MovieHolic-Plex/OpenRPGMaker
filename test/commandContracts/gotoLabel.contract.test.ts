// test/commandContracts/gotoLabel.contract.test.ts
// G1 계약: gotoLabel (스펙 §5.2 label/gotoLabel 행).
//
// 실측 메모:
// - 없는 label 은 [interpreter] warn 후 다음 명령으로 진행한다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("gotoLabel 계약", () => {
  it("정상 효과: 같은 프레임의 label 로 점프하고 중간 명령을 건너뛴다", () => {
    const result = runCommandContract([
      { kind: "setSwitch", switchId: "before_goto", value: true },
      { kind: "gotoLabel", name: "target" },
      { kind: "setSwitch", switchId: "skipped_by_goto", value: true },
      { kind: "label", name: "target" },
      { kind: "setSwitch", switchId: "after_goto", value: true },
    ]);

    expect(result.session.switches.before_goto).toBe(true);
    expect(result.session.switches.skipped_by_goto).toBeUndefined();
    expect(result.session.switches.after_goto).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 없는 label 은 warn 후 다음 명령으로 진행한다", () => {
    const result = runCommandContract([
      { kind: "gotoLabel", name: "missing_target" },
      { kind: "setSwitch", switchId: "after_missing_goto", value: true },
    ]);

    expect(result.session.switches.after_missing_goto).toBe(true);
    expect(result.warnings.some((message) => message.includes("[interpreter]"))).toBe(true);
    expect(result.warnings.some((message) => message.includes("라벨을 찾을 수 없음"))).toBe(true);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 점프 결과가 같다", () => {
    const commands: Command[] = [
      { kind: "gotoLabel", name: "roundtrip_target" },
      { kind: "setSwitch", switchId: "goto_roundtrip_skipped", value: true },
      { kind: "label", name: "roundtrip_target" },
      { kind: "setSwitch", switchId: "goto_roundtrip_after", value: true },
    ];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands, (project) => {
      project.switches.push(
        { id: "goto_roundtrip_skipped", name: "skipped" },
        { id: "goto_roundtrip_after", name: "after" }
      );
    });
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
  });

  it("pause 의미론: gotoLabel 은 non-blocking — 대상 branch 가 non-blocking 이면 pause 가 없다", () => {
    const result = runCommandContract([
      { kind: "gotoLabel", name: "pause_target" },
      { kind: "text", body: "skipped" },
      { kind: "label", name: "pause_target" },
    ]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
