import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { unaskedChanges, battleDataEmptied } from "@/ai/v2/judge/sideEffectChecks";
import { isStageWrite, recordStageWrites, stageWriteKey, type StageWrites } from "@/ai/v2/shared/stageWrites";
import { fitFirstLevelUp } from "@/ai/v2/story/pathBattleBudget";
import type { Project } from "@/project/types";
import { findingLine } from "@/ai/v2/judge/finding";

// 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
const unaskedLines = (...args: Parameters<typeof unaskedChanges>): string[] => unaskedChanges(...args).map(findingLine);

// 2026-11-10 treasure 두 판(80분 측정): 끝맺음 단계가 쓴 값(경험치 곡선·주인공 이름·적 체력)을 관문이 «요청에 없는 기존 데이터를 바꿨다» 로 짚어
// 모델이 옛 값을 몰라 13건을 «막힘» 으로 닫았다. 단계가 쓴 칸은 기록해 관문에서 빼고, 모델이 그 뒤에 다른 값으로 바꾼 칸은 다시 짚는다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const TASK = "보물 퍼즐 게임을 만들어 줘";

function pair(): { before: Project; after: Project } {
  const before = createBlankProject() as Project;
  return { before, after: structuredClone(before) };
}

describe("finish-stage writes are recorded and excluded from the side-effect gate", () => {
  it("flags an unrecorded change to an existing actor (the old behaviour)", () => {
    const { before, after } = pair();
    after.database.actors[0]!.expCurve = { base: 0, extra: 229, acceleration: 13 };
    expect(unaskedLines(before, after, TASK).some((line) => line.includes("[게임 검사 부작용]") && line.includes("expCurve"))).toBe(true);
  });

  it("does not flag a change that a recorded stage wrote", () => {
    const { before, after } = pair();
    const writes: StageWrites = new Map();
    recordStageWrites(after, writes, () => { after.database.actors[0]!.expCurve = { base: 0, extra: 229, acceleration: 13 }; });
    expect(writes.has(stageWriteKey("actors", after.database.actors[0]!.id, "expCurve"))).toBe(true);
    expect(unaskedLines(before, after, TASK, writes)).toEqual([]);
  });

  it("flags the key again when the model changes it to another value after the stage", () => {
    const { before, after } = pair();
    const writes: StageWrites = new Map();
    const hero = after.database.actors[0]!;
    recordStageWrites(after, writes, () => { hero.name = "도윤"; });
    hero.name = "다른 이름";
    expect(isStageWrite(writes, "actors", hero as never, "name")).toBe(false);
    expect(unaskedLines(before, after, TASK, writes).some((line) => line.includes("name"))).toBe(true);
  });

  it("keeps the last value when a stage writes the same key twice", () => {
    const { after } = pair();
    const writes: StageWrites = new Map();
    const hero = after.database.actors[0]!;
    recordStageWrites(after, writes, () => { hero.name = "첫째"; });
    recordStageWrites(after, writes, () => { hero.name = "둘째"; });
    expect(isStageWrite(writes, "actors", hero as never, "name")).toBe(true);
    hero.name = "첫째";
    expect(isStageWrite(writes, "actors", hero as never, "name")).toBe(false);
  });

  it("records every database field a stage changes and nothing it left alone (coverage)", () => {
    const { after } = pair();
    const writes: StageWrites = new Map();
    const actors = after.database.actors;
    const untouched = JSON.stringify(actors[1]);
    recordStageWrites(after, writes, () => {
      actors[0]!.name = "도윤";
      actors[0]!.expCurve = { base: 0, extra: 1, acceleration: 1 };
      if (after.database.enemies[0]) after.database.enemies[0].stats = { ...after.database.enemies[0].stats, maxHp: 1 };
    });
    expect([...writes.keys()].every((key) => key.startsWith("actors:") || key.startsWith("enemies:"))).toBe(true);
    expect(writes.has(stageWriteKey("actors", actors[0]!.id, "name"))).toBe(true);
    expect(writes.has(stageWriteKey("actors", actors[0]!.id, "expCurve"))).toBe(true);
    expect(JSON.stringify(actors[1])).toBe(untouched);
    expect([...writes.keys()].some((key) => key.startsWith(`actors:${String(actors[1]!.id)}:`))).toBe(false);
  });

  it("does not record rows a stage created", () => {
    const { after } = pair();
    const writes: StageWrites = new Map();
    recordStageWrites(after, writes, () => { after.database.actors.push({ ...structuredClone(after.database.actors[0]!), id: "actor_new", name: "새 인물" }); });
    expect([...writes.keys()].some((key) => key.startsWith("actors:actor_new:"))).toBe(false);
  });

  it("battleDataEmptied skips a recorded initialEquipment strip", () => {
    const { before, after } = pair();
    before.database.actors[0]!.initialEquipment = { weapon: "equip_sword" } as never;
    const writes: StageWrites = new Map();
    recordStageWrites(after, writes, () => { after.database.actors[0]!.initialEquipment = {} as never; });
    expect(battleDataEmptied(before, after, TASK).length).toBeGreaterThan(0);
    expect(battleDataEmptied(before, after, TASK, writes)).toEqual([]);
  });
});

describe("fitFirstLevelUp touches only the starting party", () => {
  it("rewrites the curve of party actors and leaves other actors with the same curve alone", () => {
    const p = createBlankProject() as Project;
    const [hero, other] = p.database.actors;
    expect(JSON.stringify(hero!.expCurve)).toBe(JSON.stringify(other!.expCurve));
    p.system.startActorIds = [hero!.id];
    const troop = p.database.troops.find((t) => t.id === "troop_slime")!;
    const enemy = p.database.enemies.find((e) => e.id === troop.enemyIds[0])!;
    enemy.rewards = { ...enemy.rewards, exp: 40 };
    const untouched = JSON.stringify(other!.expCurve);
    const notes = fitFirstLevelUp(p, troop.id, { ids: [hero!.id], level: 1 });
    expect(notes.length).toBe(1);
    expect(JSON.stringify(hero!.expCurve)).not.toBe(untouched);
    expect(JSON.stringify(other!.expCurve)).toBe(untouched);
  });
});
