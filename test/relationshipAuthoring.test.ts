// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { CONDITION_KINDS, COMMAND_KINDS } from "@/project/commandKindRegistry";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { ProjectFormatError } from "@/project/io/errors";
import { getRelationshipState } from "@/project/relationshipState";
import { BATTLE_CONDITION_SESSION_STATE_FIELDS } from "@/battle/battleEvents";

describe("관계 상태 저작 경로", () => {
  it("조건과 명령이 모두 레지스트리에 있다", () => {
    expect(CONDITION_KINDS).toContain("relationshipAtLeast");
    expect(COMMAND_KINDS).toContain("setRelationship");
  });

  /* shapeCommandFields 는 유니온이 아니라 string 으로 스위치하므로 컴파일러가 잡아주지 않는다.
     빠뜨리면 저장은 되고 프로젝트 로드에서 던져 다시 열리지 않는 프로젝트가 된다. */
  it("io 모양 검사가 열거 밖 상태를 거부한다", () => {
    expect(() => validateCommandArray("test", [{ kind: "setRelationship", npcKey: "npc_ha", state: "dating" }]))
      .not.toThrow();
    expect(() => validateCommandArray("test", [{ kind: "setRelationship", npcKey: "npc_ha", state: "maried" }]))
      .toThrow(ProjectFormatError);
    expect(() => validateCommandArray("test", [{ kind: "setRelationship", npcKey: "npc_ha" }]))
      .toThrow(ProjectFormatError);
  });

  /* 조사 지적: 필드를 선언만 하고 브리지에 안 실으면 전투 중 undefined 로 평가되는데
     기존 브리지 테스트는 그걸 잡지 못한다. 관계 상태가 목록에 있어야 한다. */
  it("전투 조건 상태 필드에 관계가 포함된다", () => {
    expect(BATTLE_CONDITION_SESSION_STATE_FIELDS).toContain("relationships");
  });

  it("연결된 인물이 없으면 닫힌 채로 거짓이다", () => {
    expect(getRelationshipState({ relationships: {} }, "npc_none")).toBe("single");
  });
});
