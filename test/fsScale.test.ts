import { describe, expect, it } from "vitest";
import { loadWeights, measure, scoreProject } from "../scripts/fs-scale/score.mjs";

type Doc = Record<string, unknown>;

function tiles(width: number, height: number, kinds: number): number[] {
  return Array.from({ length: width * height }, (_, index) => index % kinds);
}

function talk(body: string, speaker = "화자") {
  return { kind: "text", speaker, body };
}

function event(id: string, commands: unknown[]) {
  return { id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, conditions: [], trigger: { kind: "action" }, commands }] };
}

function map(id: string, events: unknown[], kinds = 8, seed = 0) {
  const lower = tiles(12, 10, kinds).map((tile) => tile + seed);
  return { id, name: id, width: 12, height: 10, tilesetId: "ts_a", lowerTiles: lower, upperTiles: Array(120).fill(-1), events };
}

function doc(maps: Record<string, unknown>, extra: Doc = {}): Doc {
  return { startMapId: "m1", maps, commonEvents: [], endings: [], quests: [], database: {}, system: {}, meta: {}, ...extra };
}

const transferTo = (mapId: string) => ({ kind: "transfer", mapId, x: 1, y: 1 });

describe("Fallen Star level completeness scale", () => {
  it("scores an empty project 0 and an authored small game low", () => {
    expect(scoreProject(doc({})).score).toBe(0);
    const small = doc({ m1: map("m1", [event("e1", [talk("안녕하세요 여행자님")])]) });
    const score = scoreProject(small).score;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(15);
  });

  it("does not score padding: empty maps, unreachable maps, cloned maps and cloned events", () => {
    const base = doc({ m1: map("m1", [event("e1", [talk("안녕하세요 여행자님")])]) });
    const baseRaw = measure(base);
    const padded = doc({
      m1: map("m1", [
        event("e1", [talk("안녕하세요 여행자님")]),
        { ...event("e2", [talk("안녕하세요 여행자님")]), x: 5, y: 5 },
        event("e3", []),
      ]),
      empty: map("empty", [], 8, 1),
      orphan: map("orphan", [event("o1", [talk("외딴 맵의 새로운 대사")])], 8, 2),
    });
    expect(measure(padded)).toEqual(baseRaw);
  });

  it("counts a reachable map once, and a cloned layout once", () => {
    const connected = doc({
      m1: map("m1", [event("e1", [talk("첫 번째 마을 대사"), transferTo("m2")])]),
      m2: map("m2", [event("e2", [talk("두 번째 마을 대사"), transferTo("m3")])], 8, 1),
      m3: map("m3", [event("e3", [talk("세 번째 마을 대사")])], 8, 1),
    });
    expect(measure(connected).maps).toBe(2);
  });

  it("counts dialogue lines that differ only by digits or punctuation once", () => {
    const lines = ["정말 좋아요 1", "정말 좋아요 2", "정말 좋아요 3", "정말 좋아요!!!", "전혀 다른 문장입니다"].map((body, index) => event(`e${index}`, [talk(body)]));
    expect(measure(doc({ m1: map("m1", lines) })).dialogue).toBe(2);
  });

  it("counts only reached, baseline-different database entries, and renamed copies once", () => {
    const enemy = (id: string, name: string, maxHp: number) => ({ id, name, stats: { maxHp, attack: 10 } });
    const database = { enemies: [enemy("en_a", "A", 50), enemy("en_b", "B", 50), enemy("en_c", "C", 90), enemy("en_unused", "U", 7), enemy("en_base", "슬라임", 3)] };
    const baseline = { database: { enemies: [enemy("en_base", "슬라임", 3)] } };
    const troops = [{ id: "tr_1", name: "t", enemyIds: ["en_a", "en_b", "en_c", "en_base"] }];
    const withDb = doc({ m1: map("m1", [event("e1", [{ kind: "battleProcessing", troopId: "tr_1" }])]) }, { database: { troops, enemies: database.enemies } });
    expect(measure(withDb, baseline).enemies).toBe(2);
  });

  it("measures the longest switch chain between counted events", () => {
    const flag = (id: string) => ({ kind: "setSwitch", switchId: id, value: true });
    const need = (id: string) => ({ kind: "switch", switchId: id, value: true });
    const chain = doc({
      m1: map("m1", [
        event("a", [talk("체인의 첫 번째"), flag("s1")]),
        event("b", [need("s1"), talk("체인의 두 번째"), flag("s2")]),
        event("c", [need("s2"), talk("체인의 세 번째")]),
      ]),
    });
    expect(measure(chain).act_structure).toBe(2);
  });

  it("is monotonic and saturates at the reference (no bonus beyond Fallen Star)", () => {
    const weights = loadWeights();
    const one = doc({ m1: map("m1", [event("e1", [talk("안녕하세요 여행자님")])]) });
    const more = doc({
      m1: map("m1", [event("e1", [talk("안녕하세요 여행자님"), transferTo("m2")]), event("e2", [talk("한 줄 더 있습니다")])]),
      m2: map("m2", [event("e3", [talk("또 다른 줄이 있습니다")])], 8, 1),
    });
    expect(scoreProject(more).score).toBeGreaterThan(scoreProject(one).score);
    const tiny = { ...weights, components: weights.components.map((component) => ({ ...component, reference: 1 })) };
    const saturated = scoreProject(more, { weights: tiny });
    for (const component of saturated.components) expect(component.ratio).toBeLessThanOrEqual(1);
    expect(saturated.score).toBeLessThanOrEqual(100);
  });

  it("ships weights that add up to 100 with a reason and a positive reference for every component", () => {
    const weights = loadWeights();
    const sum = weights.components.reduce((total: number, component: { weight: number }) => total + component.weight, 0);
    expect(sum).toBe(100);
    for (const component of weights.components) {
      expect(component.reason.length).toBeGreaterThan(20);
      expect(component.reference).toBeGreaterThan(0);
    }
    expect(Object.keys(measure(doc({}))).sort()).toEqual(weights.components.map((component: { id: string }) => component.id).sort());
  });
});
