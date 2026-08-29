// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { CONDITION_KINDS, COMMAND_KINDS } from "@/project/commandKindRegistry";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { ProjectFormatError } from "@/project/io/errors";
import { getRelationshipState } from "@/project/relationshipState";
import { BATTLE_CONDITION_SESSION_STATE_FIELDS } from "@/battle/battleEvents";
import { relationshipRank } from "@/project/relationshipState";
import { stampEventIfNeeded } from "@/project/characterIdStamp";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

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

  /* 정규화기를 통하지 않고 세션에 열거 밖 값이 남았을 때를 고정한다. 이 단정이 없으면
     읽기 접근자의 검사를 지워도 전 스위트가 녹색이라 이중 방어가 말뿐이 된다. */
  it("읽기 접근자가 정규화기와 독립으로 열거 밖 값을 막는다", () => {
    const hostile = { relationships: { npc_ha: "maried" } } as unknown as Parameters<typeof getRelationshipState>[0];
    expect(getRelationshipState(hostile, "npc_ha")).toBe("single");
    expect(relationshipRank("maried" as never)).toBe(-1);
  });

  it("관계 조건만 있는 이벤트도 소셜로 도장받는다", () => {
    const event = {
      id: "ev_only_condition",
      x: 0, y: 0,
      pages: [{ conditions: [{ kind: "relationshipAtLeast", state: "dating" }], commands: [], trigger: "action" }],
    } as unknown as Parameters<typeof stampEventIfNeeded>[0];
    expect(stampEventIfNeeded(event)).toBe(true);
    expect(event.characterId).toBe("ev_only_condition");
  });

  /* 전투 실행자가 사본만 바꾸고 write-back 이 없으면 트룹 페이지의 결혼이 전투 종료와 함께
     사라진다. troop:"full" 보증이 참인지를 실제 복귀 경로로 확인한다. */
  it("전투에서 바뀐 관계가 세션으로 되돌아온다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    applyBattleRewardsToSession(
      session,
      {
        result: "victory",
        rewards: { exp: 0, gold: 0, items: [] },
        actors: [],
        eventState: { switches: {}, variables: {}, inventory: {}, relationships: { npc_ha: "married" } },
      } as unknown as Parameters<typeof applyBattleRewardsToSession>[1],
      project
    );
    expect(getRelationshipState(session, "npc_ha")).toBe("married");
  });
});
