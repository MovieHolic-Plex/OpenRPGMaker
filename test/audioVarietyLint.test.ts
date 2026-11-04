// 전투 음악·효과음 다양성 검사(audio-*) — 2026-11-04 폴른 스타: 전투 76개 중 75개가 한 곡, 효과음 하나가 받기·장비·합류·움직임에.
import { describe, expect, it } from "vitest";
import { lintAudioVariety } from "@/ai/v2/audioVarietyLint";
import { createBlankProject } from "@/project/defaults";
import type { Command, EnemyRecord, GameEvent, Project, TroopRecord } from "@/project/types";

const battleBgm = (resourceId: string): Command => ({ kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { cue: "battle", operation: "set", resourceId, volume: "100" } } as unknown as Command);
const fight = (troopId: string): Command => ({ kind: "battleProcessing", troopId, canEscape: false, canLose: false } as unknown as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const event = (id: string, commands: Command[]): GameEvent => ({ id, name: id, x: 1, y: 1, pages: [{ id: `${id}_p`, conditions: [], trigger: { kind: "action" }, commands }] } as unknown as GameEvent);

function fixture(mapCount: number): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  const enemy = project.database.enemies[0]!;
  const boss: EnemyRecord = { ...structuredClone(enemy), id: "enemy_boss", name: "골렘", collapseEffect: "bossSink" };
  project.database.enemies.push(boss);
  project.database.troops.push({ ...structuredClone(project.database.troops[0]!), id: "troop_boss", name: "골렘", enemyIds: [boss.id], members: [{ enemyId: boss.id, x: 160, y: 120 }] } as TroopRecord);
  project.system.battleBgmResourceId = "cc0-bgm-rtp-btl-001";
  for (let i = 0; i < mapCount; i += 1) {
    const map = i === 0 ? start : { ...structuredClone(start), id: `map_area_${i}`, name: `지역 ${i}` };
    map.events = [event(`ev_foe_${i}`, [fight(project.database.troops[0]!.id)])];
    project.maps[map.id] = map;
  }
  return project;
}

const codes = (project: Project): string[] => lintAudioVariety(project).map((issue) => issue.code).sort();

describe("audio-*", () => {
  it("맵 셋의 전투가 모두 같은 곡이면 경고한다", () => {
    expect(codes(fixture(3))).toEqual(["audio-battle-bgm-uniform"]);
  });

  it("지역마다 곡을 바꾸면 조용하다", () => {
    const project = fixture(3);
    ["cc0-bgm-rtp-flt-028", "cc0-bgm-rtp-ccp-005", "cc0-bgm-rtp-vgt-002"].forEach((id, i) => {
      const map = Object.values(project.maps)[i]!;
      map.events[0]!.pages![0]!.commands.unshift(battleBgm(id));
    });
    expect(codes(project)).toEqual([]);
  });

  it("맵 전투곡(battleBgmResourceId)으로 지역마다 곡을 걸어도 조용하다", () => {
    const project = fixture(3);
    ["cc0-bgm-rtp-flt-028", "cc0-bgm-rtp-ccp-005", "cc0-bgm-rtp-vgt-002"].forEach((id, i) => { Object.values(project.maps)[i]!.battleBgmResourceId = id; });
    expect(codes(project)).toEqual([]);
  });

  it("맵이 둘뿐이면 같은 곡이어도 조용하다", () => {
    expect(codes(fixture(2))).toEqual([]);
  });

  it("보스가 일반 전투곡이면 경고하고, 보스곡을 걸면 조용하다", () => {
    const project = fixture(2);
    const map = project.maps[project.startMapId]!;
    map.events.push(event("ev_boss", [fight("troop_boss")]));
    expect(codes(project)).toEqual(["audio-boss-uses-default"]);
    map.events[1]!.pages![0]!.commands.unshift(battleBgm("cc0-bgm-rtp-btl-002"));
    expect(codes(project)).toEqual([]);
  });

  it("보스곡으로 감싼 이야기 적수가 있어도 같은 보스곡을 건 진짜 보스를 오탐하지 않는다", () => {
    const project = fixture(2);
    const map = project.maps[project.startMapId]!;
    project.database.troops.push({ ...structuredClone(project.database.troops[0]!), id: "troop_rival", name: "새라" } as TroopRecord);
    map.events.push(event("ev_rival", [battleBgm("cc0-bgm-rtp-btl-002"), fight("troop_rival")]));
    map.events.push(event("ev_boss", [battleBgm("cc0-bgm-rtp-btl-002"), fight("troop_boss")]));
    expect(codes(project)).toEqual([]);
  });

  it("감싼 보스전이 많아도 일반 전투가 한 곡뿐이면 경고한다", () => {
    const project = fixture(3);
    for (const map of Object.values(project.maps)) {
      for (let i = 0; i < 3; i += 1) map.events.push(event(`ev_boss_${map.id}_${i}`, [battleBgm("cc0-bgm-rtp-btl-002"), fight("troop_boss")]));
    }
    expect(codes(project)).toEqual(["audio-battle-bgm-uniform"]);
  });

  it("효과음 하나가 받기·장비·합류·이동을 다 맡으면 경고하고, 상자처럼 한 가지 일만 하면 조용하다", () => {
    const project = fixture(1);
    const map = project.maps[project.startMapId]!;
    const actorId = project.database.actors[0]!.id;
    const follows: Command[] = [
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 },
      { kind: "changeEquipment", actorId, slot: "weapon", equipmentId: "" },
      { kind: "changeParty", actorId, action: "add" },
      { kind: "transfer", mapId: map.id, x: 1, y: 1, direction: "down" },
    ] as unknown as Command[];
    map.events = Array.from({ length: 12 }, (_, i) => event(`ev_cloth_${i}`, [se("cc0-se-orp-inventory-cloth"), follows[i % follows.length]!]));
    expect(codes(project)).toEqual(["audio-se-overused"]);
    map.events = Array.from({ length: 12 }, (_, i) => event(`ev_chest_${i}`, [se("cc0-se-osx-wooded-box-open"), follows[0]!]));
    expect(codes(project)).toEqual([]);
  });
});
