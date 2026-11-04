// QA 체크포인트 startTroopId: 필드 적 이벤트 id 는 굽기마다 새로 뽑히므로, 부대 id 로 그 부대와 싸우는 맵 이벤트를 찾는다.
import { describe, expect, it } from "vitest";
import { qaCheckpointStartEventId, sessionFromQaCheckpoint, type QaCheckpoint } from "@/player/qaCheckpoint";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function fieldEnemy(id: string, x: number, y: number, troopId: string): GameEvent {
  return {
    id, x, y, trigger: { kind: "eventTouch" }, commands: [],
    pages: [{
      id: `${id}_fight`, name: "필드 적", conditions: [], trigger: { kind: "eventTouch" },
      commands: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_x", value: true },
        then: [{ kind: "battleProcessing", troopId, canEscape: true, canLose: false }] }],
    }],
  } as unknown as GameEvent;
}

function projectWith(events: GameEvent[]): { project: Project; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events.push(...events);
  return { project, mapId };
}

describe("QA checkpoint startTroopId", () => {
  it("finds the field enemy that fights the troop, whatever its generated id", () => {
    const { project, mapId } = projectWith([
      fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves"),
      fieldEnemy("ev_field_enemy_bbb", 9, 9, "troop_golem"),
    ]);
    const checkpoint: QaCheckpoint = { id: "golem", mapId, x: 9, y: 10, startTroopId: "troop_golem" };
    const session = sessionFromQaCheckpoint(project, checkpoint);
    expect(qaCheckpointStartEventId(project, checkpoint, session.currentMapId)).toBe("ev_field_enemy_bbb");
  });

  it("picks the event nearest the player when several fight the same troop", () => {
    const { project, mapId } = projectWith([
      fieldEnemy("ev_field_enemy_far", 1, 1, "troop_dogs"),
      fieldEnemy("ev_field_enemy_near", 14, 3, "troop_dogs"),
    ]);
    const checkpoint: QaCheckpoint = { id: "dogs", mapId, x: 14, y: 4, startTroopId: "troop_dogs" };
    expect(qaCheckpointStartEventId(project, checkpoint, mapId)).toBe("ev_field_enemy_near");
  });

  it("keeps startEventId ahead of startTroopId", () => {
    const { project, mapId } = projectWith([fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves")]);
    const checkpoint: QaCheckpoint = { id: "fixed", mapId, startEventId: "ev_field_enemy_aaa", startTroopId: "troop_missing" };
    expect(qaCheckpointStartEventId(project, checkpoint, mapId)).toBe("ev_field_enemy_aaa");
  });

  it("throws when no event on the map fights the troop", () => {
    const { project, mapId } = projectWith([fieldEnemy("ev_field_enemy_aaa", 3, 3, "troop_wolves")]);
    expect(() => qaCheckpointStartEventId(project, { id: "none", mapId, startTroopId: "troop_golem" }, mapId))
      .toThrow(/부대 troop_golem 와 싸우는 이벤트가 없다/u);
  });
});
