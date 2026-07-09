import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

// Phase 0-2 회귀: 전투 편성이 project.session(에디터 시작 상태)이 아니라
// 라이브 세션의 partyActorIds(플레이 중 changeParty/순서변경 반영)를 따라야 한다.

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

// 시작 상태 파티에 없는 액터를 런타임에 합류시키는 상황을 위해 주인공을 복제한다.
function withSecondActor(project: Project): Project {
  const hero = project.database.actors[0];
  const clone = structuredClone(hero);
  clone.id = "actor_hero2";
  clone.name = "동료";
  project.database.actors.push(clone);
  return project;
}

describe("전투 편성 — 라이브 세션 파티를 따른다", () => {
  it("partyActorIds 미지정 시 시작 상태 파티로 폴백한다", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    const actors = runtime.snapshot().actors;
    expect(actors.map((a) => a.recordId)).toEqual(["actor_hero"]);
  });

  it("런타임에 합류한 동료(시작 상태에 없는 액터)가 전투에 등장한다", () => {
    const project = withSecondActor(battleProject());
    // 시작 상태는 여전히 [actor_hero] 뿐이지만, 라이브 세션 파티는 둘이다.
    expect(project.session.partyActorIds).toEqual(["actor_hero"]);
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: {}, experience: {}, partyActorIds: ["actor_hero", "actor_hero2"] },
    });
    const recordIds = runtime.snapshot().actors.map((a) => a.recordId);
    expect(recordIds).toEqual(["actor_hero", "actor_hero2"]);
  });

  it("런타임에 이탈한 파티원은 전투에 등장하지 않는다", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: {}, experience: {}, partyActorIds: [] },
    });
    expect(runtime.snapshot().actors).toHaveLength(0);
  });
});
