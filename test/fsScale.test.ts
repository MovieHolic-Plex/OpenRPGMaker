import { describe, expect, it } from "vitest";
import { loadWeights, measure, scoreProject } from "../scripts/fs-scale/score.mjs";
import { applyArtPenalty, artPenalty, characterSheetEnemies, isCharacterSheetId, PENALTY_CAP, PENALTY_PER_FAMILY, similarMapPairs } from "../scripts/fs-scale/artPenalty.mjs";
import { MEASURE_ID, THRESHOLDS, features, isLater, judgeGame, similarity } from "../scripts/fs-scale/lookSimilarity.mjs";
import { judgeCorpus } from "../scripts/fs-scale/looks.mjs";
import { isolateTimers } from "./mergedTeardown";

describe("fsScale", () => {
  isolateTimers();
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
});

describe("fsScaleArtPenalty", () => {
  isolateTimers();
  type Doc = Record<string, unknown>;
  function map(id: string, tiles: number[], name = id, tilesetId = "ts") {
    return { id, name, tilesetId, width: 10, height: 10, lowerTiles: tiles, upperTiles: Array(tiles.length).fill(-1), events: [] as unknown[] };
  }
  const forest = (seed: number) => Array.from({ length: 100 }, (_, i) => 1 + ((i + seed) % 3));
  const town = () => Array.from({ length: 100 }, (_, i) => 20 + (i % 5));
  function doc(maps: unknown[], extra: Doc = {}): Doc {
    return { startMapId: "start", maps: Object.fromEntries((maps as { id: string }[]).map((m) => [m.id, m])), database: { troops: [], enemies: [] }, ...extra };
  }
  describe("art penalty — map lookalike", () => {
    it("does not flag maps whose tile distributions differ", () => {
      const d = doc([map("start", town()), map("a", forest(0)), map("b", town().map((t) => t + 40)), map("c", forest(0).map((t) => t + 80))]);
      expect(artPenalty(d).families).toEqual([]);
      expect(artPenalty(d).penalty).toBe(0);
    });

    it("flags a game whose maps share one tile distribution: 3 or more pairs is −5 once", () => {
      const d = doc([map("start", town()), map("a", forest(0)), map("b", forest(1)), map("c", forest(2)), map("d", forest(0))]);
      const art = artPenalty(d);
      expect(art.mapLookalike.similarPairs).toBeGreaterThanOrEqual(3);
      expect(art.families).toEqual(["map-lookalike"]);
      expect(art.penalty).toBe(PENALTY_PER_FAMILY);
      expect(art.lines[0]).toContain("map-lookalike");
    });

    it("one similar pair is not enough", () => {
      const d = doc([map("start", town()), map("a", forest(0)), map("b", forest(1)), map("c", forest(2).map((t) => t + 50))]);
      expect(similarMapPairs(d).pairs.length).toBe(1);
      expect(artPenalty(d).penalty).toBe(0);
    });

    it("maps on different tilesets are never alike even when the tile numbers match", () => {
      const d = doc([map("start", town()), map("a", forest(0), "a", "ts1"), map("b", forest(0), "b", "ts2"), map("c", forest(0), "c", "ts3"), map("d", forest(0), "d", "ts4")]);
      expect(similarMapPairs(d).pairs.length).toBe(0);
      expect(artPenalty(d).penalty).toBe(0);
    });

    it("excludes the start map and map_ref_ preset maps", () => {
      const d = doc([map("start", forest(0)), map("map_ref_a", forest(0)), map("map_ref_b", forest(1)), map("map_ref_c", forest(2)), map("x", town())]);
      expect(similarMapPairs(d).maps).toBe(1);
      expect(artPenalty(d).penalty).toBe(0);
    });

    it("a game with many maps is judged by the share of similar pairs, not the count", () => {
      const distinct = Array.from({ length: 12 }, (_, i) => map(`m${i}`, Array.from({ length: 100 }, (_, k) => 100 + i * 10 + (k % (2 + (i % 7))))));
      const d = doc([map("start", town()), ...distinct, map("f1", forest(0)), map("f2", forest(1)), map("f3", forest(2))]);
      const art = artPenalty(d);
      expect(art.mapLookalike.similarPairs).toBeGreaterThanOrEqual(3);
      expect(art.mapLookalike.share).toBeLessThan(0.5);
      expect(art.families).toEqual([]);
    });

    it("reports the 0.99 pairs without an extra penalty", () => {
      const d = doc([map("start", town()), map("a", forest(0)), map("b", forest(1)), map("c", forest(2)), map("d", forest(0))]);
      const art = artPenalty(d);
      expect(art.mapLookalike.extraPairs099).toBeGreaterThanOrEqual(1);
      expect(art.penalty).toBe(PENALTY_PER_FAMILY);
    });
  });
  describe("art penalty — NPC chipset as monster art", () => {
    const withEnemy = (monsterResourceId: string, placed = true): Doc => {
      const m = map("start", town());
      m.events = placed ? [{ id: "e1", pages: [{ commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }] : [];
      return doc([m], { database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "적", monsterResourceId }] } });
    };

    it("recognises character sheets and keeps monster art out", () => {
      expect(isCharacterSheetId("easyrpg-charset-actor1")).toBe(true);
      expect(isCharacterSheetId("oprn-charset-modern2")).toBe(true);
      expect(isCharacterSheetId("tex_scarloxy_charset_people1")).toBe(true);
      expect(isCharacterSheetId("generated-enemy-imp-mischief")).toBe(false);
      expect(isCharacterSheetId("harness-monster-leafling-front")).toBe(false);
      expect(isCharacterSheetId(undefined)).toBe(false);
    });

    it("is zero for a game whose enemies are monster art (the hero-0074 case)", () => {
      expect(characterSheetEnemies(withEnemy("generated-enemy-demon-lord"))).toEqual([]);
      expect(artPenalty(withEnemy("generated-enemy-demon-lord")).penalty).toBe(0);
    });

    it("penalises −5 when a placed troop's enemy art is a people sheet", () => {
      const art = artPenalty(withEnemy("tex_scarloxy_charset_people1"));
      expect(art.families).toEqual(["npc-chipset"]);
      expect(art.penalty).toBe(PENALTY_PER_FAMILY);
      expect(art.npcChipset.hits).toBe(1);
    });

    it("a battler sheet drawn for combat (charset-battler-*) is not NPC art", () => {
      expect(isCharacterSheetId("charset-battler-actor1-2")).toBe(false);
      expect(characterSheetEnemies(withEnemy("charset-battler-people3-7"))).toEqual([]);
    });

    it("penalises an enemy that stands as a walking chip, even when monsterResourceId looks like a monster", () => {
      const m = map("start", town());
      m.events = [{ id: "e1", pages: [{ commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }];
      const d = doc([m], { database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "병사", monsterResourceId: "generated-enemy-imp", walkChip: { characterResourceId: "easyrpg-charset-actor2", characterIndex: 3 } }] } });
      const art = artPenalty(d);
      expect(art.families).toEqual(["npc-chipset"]);
      expect(art.npcChipset.enemies[0].resourceId).toBe("easyrpg-charset-actor2");
    });

    it("a walking chip that is a monster sheet is not NPC art", () => {
      const m = map("start", town());
      m.events = [{ id: "e1", pages: [{ commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }];
      const d = doc([m], { database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "슬라임", monsterResourceId: "generated-enemy-slime", walkChip: { characterResourceId: "tex_easyrpg_charset_monster1", characterIndex: 2 } }] } });
      expect(artPenalty(d).penalty).toBe(0);
    });

    it("ignores an enemy no map places", () => {
      expect(characterSheetEnemies(withEnemy("tex_scarloxy_charset_people1", false))).toEqual([]);
    });

    it("leaves a trainer preset alone: the people sheet is only the field symbol, the troop art is a monster", () => {
      const m = map("start", town());
      m.events = [{ id: "trainer", pages: [{ graphic: { sprite: { type: "bundled", id: "tex_scarloxy_charset_people1" } }, commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }];
      const d = doc([m], { database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "새싹", monsterResourceId: "harness-monster-leafling-front" }] } });
      expect(artPenalty(d).penalty).toBe(0);
    });
  });
  describe("art penalty — size and cap", () => {
    it("both families cost −10 at most, and the score never goes below 0", () => {
      const m = map("start", town());
      m.events = [{ id: "e1", pages: [{ commands: [{ kind: "battleProcessing", troopId: "t1" }] }] }];
      const d = doc([m, map("a", forest(0)), map("b", forest(1)), map("c", forest(2)), map("d", forest(0))], {
        database: { troops: [{ id: "t1", enemyIds: ["en1"] }], enemies: [{ id: "en1", name: "사람", monsterResourceId: "oprn-charset-modern1" }] },
      });
      const art = artPenalty(d);
      expect(art.families).toEqual(["npc-chipset", "map-lookalike"]);
      expect(art.penalty).toBe(PENALTY_CAP);
      expect(applyArtPenalty(21.8, art)).toBe(11.8);
      expect(applyArtPenalty(6, art)).toBe(0);
    });
  });
});

describe("fsScaleLooks", () => {
  isolateTimers();
  // 합성 이미지(화면이 아니다): 작은 RGBA 로 해시·규칙을 시험한다. 이미지 파일은 필요 없다.
  const W = 96, H = 64;
  function image(kind: "grad" | "checker" | "noise", corner = 0): Uint8Array {
    const rgba = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      let r = 0, g = 0, b = 0;
      if (kind === "grad") { r = Math.floor((x * 255) / (W - 1)); g = 255 - r; b = 128; }
      else if (kind === "checker") { const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0; [r, g, b] = on ? [255, 255, 255] : [20, 40, 200]; }
      else { r = (x * 7 + y * 3) % 256; g = (x * 3 + y * 11) % 256; b = (x * 13 + y * 5) % 256; }
      if (corner > 0 && x >= W - corner && y >= H - corner) { r = 0; g = 0; b = 0; } // 오른쪽 아래 구석을 검게 — sim 을 단계적으로 낮춘다
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    return rgba;
  }
  const shot = (kind: "grad" | "checker" | "noise", corner = 0) => features(image(kind, corner), W, H);
  const bits = (hex: string) => Array.from(hex, (c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
  const game = (id: string, made_at: string, prompt: string, title: ReturnType<typeof shot>, extra: object = {}) => ({ id, made_at, prompt_sha: prompt, shots: { title }, ...extra });
  const th = THRESHOLDS[MEASURE_ID]!;
  describe("pic-v1 features", () => {
    it("앞 절반이 밝은 가로 그러데이션은 ahash 가 줄마다 1111 0000, dhash 는 전부 0(밝기가 오른쪽으로 줄어든다)", () => {
      expect(bits(shot("grad").ahash)).toBe("1111000011110000111100001111000011110000111100001111000011110000");
      expect(bits(shot("grad").dhash)).toBe("0".repeat(64));
      expect(shot("grad").hist.reduce((a, b) => a + b, 0)).toBe(4096);
      expect(shot("grad").measure).toBe(MEASURE_ID);
    });
    it("같은 그림은 sim 1, 격자와 그러데이션은 낮다(구조 0.4·색 0 — 이 값은 레인 Python 이 같은 합성 이미지에 낸 0.375 와 같다), 이름이 다르면 던진다", () => {
      expect(similarity(shot("grad"), shot("grad")).sim).toBe(1);
      expect(similarity(shot("grad"), shot("checker")).sim).toBeCloseTo(0.375, 3);
      expect(() => similarity({ ...shot("grad"), measure: "pic-v2" }, shot("grad"))).toThrow();
    });
    it("구석을 20칸 검게 하면 0.90~0.999 사이, 2칸이면 0.999 이상이다(규칙 시험에 쓰는 합성 쌍)", () => {
      expect(similarity(shot("grad"), shot("grad", 20)).sim).toBeGreaterThanOrEqual(0.9);
      expect(similarity(shot("grad"), shot("grad", 20)).sim).toBeLessThan(0.999);
      expect(similarity(shot("grad"), shot("grad", 2)).sim).toBeGreaterThanOrEqual(0.999);
    });
  });
  describe("쌍둥이 0점 규칙", () => {
    it("다른 프롬프트의 똑같은 그림은 양쪽 모두 0점, 줄에 사유·상대·점수·화면이 찍힌다", () => {
      const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad"));
      const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
      expect(rows.map((r) => r.zero)).toEqual([true, true]);
      expect(rows[0]!.lines[0]).toBe("zero: identical-preset similar game b 1.000 title");
    });
    it("화소가 조금 다른 프리셋 복사(sim ≥ 0.999)도 똑같은 프리셋으로 보고 양쪽 0점이다", () => {
      const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad", 2));
      expect(a.shots.title.sha).not.toBe(b.shots.title.sha);
      const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
      expect(rows.map((r) => r.zero)).toEqual([true, true]);
      expect(rows[0]!.hits[0]!.reason).toBe("identical-preset");
    });
    it("0.90 이상 0.999 미만으로 닮으면 나중에 만든 쪽만 0점이다", () => {
      const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", shot("grad", 20));
      expect(isLater(b, a)).toBe(true);
      const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never);
      expect(rows.find((r) => r.id === "a")!.zero).toBe(false);
      const later = rows.find((r) => r.id === "b")!;
      expect(later.zero).toBe(true);
      expect(later.lines[0]).toMatch(/^zero: look-similar similar game a 0\.9\d{2} title$/u);
    });
    it("0.70~0.90 사이는 0점이 아니라 −2 감점이고, 상대가 여럿이어도 게임당 한 번이다", () => {
      const a = game("a", "0001", "p1", shot("grad")), c = game("c", "0002", "p3", shot("grad")), b = game("b", "0003", "p2", shot("grad", 38));
      const sim = similarity(a.shots.title, b.shots.title).sim;
      expect(sim).toBeGreaterThanOrEqual(th.penalty);
      expect(sim).toBeLessThan(th.zero);
      const verdict = judgeGame(b, [a, c, b], {});
      expect(verdict.zero).toBe(false);
      expect(verdict.penalty).toBe(th.penaltyPoints);
      expect(verdict.lines.filter((l) => l.startsWith("penalty:"))).toHaveLength(1);
      expect(verdict.hits.filter((h) => h.kind === "penalty").length).toBeGreaterThanOrEqual(2);
    });
    it("같은 프롬프트 쌍은 0점이 아니라 감점이다", () => {
      const a = game("a", "0001", "same", shot("grad")), b = game("b", "0002", "same", shot("grad"));
      const verdict = judgeGame(b, [a, b], {});
      expect(verdict.zero).toBe(false);
      expect(verdict.penalty).toBe(th.penaltyPoints);
    });
    it("기본 화면과 닮은 게임은 0점이다", () => {
      const g = game("g", "0001", "p", shot("noise"));
      const verdict = judgeGame(g, [g], { title: shot("noise") });
      expect(verdict.zero).toBe(true);
      expect(verdict.lines[0]).toBe("zero: default-screen similar game default-title 1.000 title");
    });
    it("시각이 같으면 id 사전순으로 나중을 정한다", () => {
      expect(isLater({ id: "b", made_at: "0001" }, { id: "a", made_at: "0001" })).toBe(true);
      expect(isLater({ id: "a", made_at: "0002" }, { id: "z", made_at: "0001" })).toBe(true);
    });
    it("판정 결과에 project_sha 가 실려 score.mjs --looks 가 파일 내용으로 짝짓는다, 기준값은 인자로 넘기고 전역은 바뀌지 않는다", () => {
      const a = game("a", "0001", "p1", shot("grad"), { project_sha: "abc" }), b = game("b", "0002", "p2", shot("grad", 20), { project_sha: "def" });
      const rows = judgeCorpus({ measure: MEASURE_ID, games: [a, b], defaults: {} } as never, { thresholds: { ...th, zero: 0.99 } });
      expect(rows.map((r) => r.project_sha)).toEqual(["abc", "def"]);
      expect(rows.find((r) => r.id === "b")!.zero).toBe(false); // 0.99 로 올리면 0.94 쌍은 0점이 아니다
      expect(THRESHOLDS[MEASURE_ID]!.zero).toBe(0.9);
    });
    it("다른 판정 이름으로 만든 화면은 비교하지 않고 던진다", () => {
      const a = game("a", "0001", "p1", shot("grad")), b = game("b", "0002", "p2", { ...shot("grad"), measure: "pic-v2" });
      expect(() => judgeGame(b, [a, b], {})).toThrow();
    });
  });
});
