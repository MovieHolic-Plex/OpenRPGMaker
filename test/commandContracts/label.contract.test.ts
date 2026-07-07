// test/commandContracts/label.contract.test.ts
// G1 계약: label (스펙 §5.2 label/gotoLabel 행).
//
// 실측 메모:
// - label 은 실행 위치 표식일 뿐 단독으로는 상태를 바꾸지 않고 다음 명령으로 진행한다.
import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

describe("label 계약", () => {
  it("정상 효과: label 은 no-op 으로 다음 명령을 실행한다", () => {
    const result = runCommandContract([
      { kind: "label", name: "start" },
      { kind: "setSwitch", switchId: "after_label", value: true },
    ]);

    expect(result.session.switches.after_label).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("경계: 빈 label 이름도 경고 없이 no-op 으로 처리된다", () => {
    const result = runCommandContract([
      { kind: "label", name: "" },
      { kind: "setSwitch", switchId: "after_empty_label", value: true },
    ]);

    expect(result.session.switches.after_empty_label).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: serialize→deserialize 후 실행해도 최종 세션 상태가 같다", () => {
    const commands: Command[] = [
      { kind: "label", name: "roundtrip_label" },
      { kind: "setSwitch", switchId: "after_label_roundtrip", value: true },
    ];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands, (project) => {
      project.switches.push({ id: "after_label_roundtrip", name: "after label" });
    });
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
  });

  it("pause 의미론: label 은 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([{ kind: "label", name: "pause_label" }]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
