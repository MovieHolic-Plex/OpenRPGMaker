// test/commandContracts/getFriendship.contract.test.ts
// G1 계약: getFriendship (Phase 11b 호감도→변수 브리지 커맨드).
import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { CONTRACT_EVENT_ID, roundtripCommands, runCommandContract } from "./harness";

function registerVariable(project: Project, id: string): void {
  project.variables.push({ id, name: id });
}

describe("getFriendship 계약", () => {
  it("정상 효과: 명시 npcKey의 호감도를 일반 변수에 기록한다", () => {
    const result = runCommandContract([
      { kind: "changeFriendship", npcKey: "ev_farmer", delta: 80 },
      { kind: "getFriendship", npcKey: "ev_farmer", variableId: "var_friendship" },
    ]);

    expect(result.session.variables.var_friendship).toBe(80);
    expect(result.warnings).toEqual([]);
    expect(result.finished).toBe(true);
  });

  it("self fallback: npcKey 생략 시 characterId 호감도를 읽는다", () => {
    const result = runCommandContract([
      { kind: "changeFriendship", delta: 45 },
      { kind: "getFriendship", variableId: "var_self_friendship" },
    ], {
      mutateProject: (project) => {
        const event = project.maps[project.startMapId]?.events.find((entry) => entry.id === CONTRACT_EVENT_ID);
        if (event) event.characterId = CONTRACT_EVENT_ID;
      },
    });

    expect(result.session.friendship?.[CONTRACT_EVENT_ID]).toBe(45);
    expect(result.session.variables.var_self_friendship).toBe(45);
    expect(result.finished).toBe(true);
  });

  it("이벤트 컨텍스트 없음: 읽을 npcKey가 없으면 0을 기록한다", () => {
    const result = runCommandContract([{ kind: "getFriendship", variableId: "var_none" }], { currentEventId: null });

    expect(result.session.variables.var_none).toBe(0);
    expect(result.finished).toBe(true);
  });

  it("왕복 동일성: 등록된 variableId 는 serialize→deserialize 후 같은 결과를 낸다", () => {
    const commands: Command[] = [
      { kind: "changeFriendship", npcKey: "ev_farmer", delta: 120 },
      { kind: "getFriendship", npcKey: "ev_farmer", variableId: "var_friendship_roundtrip" },
    ];

    const original = runCommandContract(commands);
    const restoredCommands = roundtripCommands(commands, (project) => registerVariable(project, "var_friendship_roundtrip"));
    expect(restoredCommands).toEqual(commands);
    const restored = runCommandContract(restoredCommands);

    expect(restored.session).toEqual(original.session);
    expect(restored.finished).toBe(true);
  });

  it("pause 의미론: getFriendship 은 non-blocking — pause 가 발생하지 않는다", () => {
    const result = runCommandContract([{ kind: "getFriendship", npcKey: "ev_farmer", variableId: "var_pause_contract" }]);

    expect(result.pauses).toEqual([]);
    expect(result.finished).toBe(true);
  });
});
