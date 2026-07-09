// test/commandContracts/setSwitch.contract.test.ts
// G1 계약: setSwitch (스펙 §5.2 setFlag/setSwitch/setSelfSwitch/setVariable 행).
//
// 실측 메모:
// - 런타임은 switchId 존재 여부를 검증하지 않고 session.switches 에 값을 쓴다.
// - setFlag 는 이번 웨이브의 16개 파일/화이트리스트 목표 밖에 남겨두되, legacy flags 쓰기
//   동작은 이 파일에서 함께 고정한다.
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { roundtripCommands, runCommandContract } from "./harness";

function registerSwitch(project: Project, id: string): void {
  project.switches.push({ id, name: id });
}

describe("setSwitch 계약", () => {
  it("정상 효과: switch 값을 설정하고 같은 id 를 덮어쓸 수 있다", () => {
    const result = runCommandContract([
      { kind: "setSwitch", switchId: "sw_contract", value: true },
      { kind: "setSwitch", switchId: "sw_contract", value: false },
    ]);

    expect(result.session.switches.sw_contract).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("결측 참조: 등록되지 않은 switchId 도 경고 없이 생성된다", () => {
    const result = runCommandContract([
      { kind: "setSwitch", switchId: "sw_missing_runtime", value: true },
      { kind: "setSwitch", switchId: "sw_missing_runtime", value: false },
    ]);

    expect(result.session.switches.sw_missing_runtime).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("legacy setFlag: flags 값을 설정하고 덮어쓴다", () => {
    const result = runCommandContract([
      { kind: "setFlag", flag: "legacy_flag_contract", value: true },
      { kind: "setFlag", flag: "legacy_flag_contract", value: false },
    ]);

    expect(result.session.flags.legacy_flag_contract).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: 등록된 switchId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
    const commands: Command[] = [{ kind: "setSwitch", switchId: "sw_roundtrip_contract", value: true }];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands, (project) => registerSwitch(project, "sw_roundtrip_contract"));
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
  });

  it("pause 의미론: setSwitch 는 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([{ kind: "setSwitch", switchId: "sw_pause_contract", value: true }]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
