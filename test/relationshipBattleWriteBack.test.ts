// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { getRelationshipState, setRelationshipState } from "@/project/relationshipState";
import { startSession } from "@/project/session";
import type { Command, Project } from "@/project/types";

const PAGE_ID = "page_relationship";

function tier1Project(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function runBattle(project: Project, commands: readonly Command[], relationships: Record<string, string>) {
  const troop = project.database.troops.find((record) => record.id === "troop_slime");
  if (!troop) throw new Error("missing troop_slime");
  troop.battleEventPages = [{
    id: PAGE_ID,
    name: "관계",
    conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
    span: "battle",
    commands: [...commands],
  }];
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    sessionState: { relationships } as never,
  } as never);
  runtime.tick(1_000);
  runtime.performActorCommand({ kind: "defend" });
  return runtime;
}

/* 이 스위트는 손으로 만든 스냅숏이 아니라 실제 createBattleRuntime 을 지나야 한다.
   스냅숏 빌더가 관계 지도 전체를 싣는지 전투가 쓴 키만 싣는지가 여기서만 드러난다. */
describe("전투 관계 write-back", () => {
  it("전투가 건드리지 않은 관계는 스냅숏에 실리지 않는다", () => {
    const runtime = runBattle(tier1Project(), [], { npc_ha: "married" });
    expect(runtime.snapshot().eventState.relationships ?? {}).toEqual({});
  });

  it("전투 중 맵에서 헤어진 관계를 전투 종료가 되살리지 않는다", () => {
    const project = tier1Project();
    const runtime = runBattle(project, [], { npc_ha: "married" });
    const session = startSession(project);
    setRelationshipState(session, "npc_ha", "married");
    setRelationshipState(session, "npc_ha", "single");

    applyBattleRewardsToSession(
      session,
      { result: "escape", rewards: { exp: 0, gold: 0, items: [] }, actors: [], eventState: runtime.snapshot().eventState },
      project
    );
    expect(getRelationshipState(session, "npc_ha")).toBe("single");
  });

  it("전투에서 바꾼 관계만 세션으로 되돌아온다", () => {
    const project = tier1Project();
    const runtime = runBattle(
      project,
      [{ kind: "setRelationship", npcKey: "npc_yu", state: "married" } as Command],
      { npc_ha: "dating" }
    );
    expect(runtime.snapshot().eventState.relationships ?? {}).toEqual({ npc_yu: "married" });

    const session = startSession(project);
    setRelationshipState(session, "npc_ha", "dating");
    applyBattleRewardsToSession(
      session,
      { result: "victory", rewards: { exp: 0, gold: 0, items: [] }, actors: [], eventState: runtime.snapshot().eventState },
      project
    );
    expect(session.relationships).toEqual({ npc_ha: "dating", npc_yu: "married" });
  });

  it("전투가 관계 없음으로 바꾸면 항목이 삭제된다", () => {
    const project = tier1Project();
    const runtime = runBattle(
      project,
      [{ kind: "setRelationship", npcKey: "npc_ha", state: "single" } as Command],
      { npc_ha: "married" }
    );
    const session = startSession(project);
    setRelationshipState(session, "npc_ha", "married");
    applyBattleRewardsToSession(
      session,
      { result: "victory", rewards: { exp: 0, gold: 0, items: [] }, actors: [], eventState: runtime.snapshot().eventState },
      project
    );
    expect(session.relationships).toEqual({});
  });
});
