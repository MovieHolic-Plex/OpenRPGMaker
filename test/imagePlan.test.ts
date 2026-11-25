import { describe, expect, it, afterEach } from "vitest";
import { applyCellFixes, cellGridSize, dungeonPlanFromCells, forestDesignFromCells, parseCellMap, villageArgsFromCells } from "@/ai/imagePlanCells";
import { PLAN_FOLLOW_BAR, parsePlanFollowCheck, planFollowFixRequest } from "@/ai/imagePlanCheck";
import { builtMapOf } from "@/editor/imagePlanFollowCheck";
import { createBlankProject } from "@/project/defaults";
import { describeNote, imagePlanBuildNote, parseImagePlanDescription, type ImagePlanRead } from "@/ai/imagePlan";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig } from "@/ai/llmClient";
import { meetsBar, parsePlanJudge, pickBest, readYield } from "@/ai/imagePlanPick";
import { isolateTimers } from "./mergedTeardown";

describe("imagePlanCells", () => {
  isolateTimers();
  const ring = [
    "________________________",
    "____......____......____",
    "____......====......____",
    "____..A...____......____",
    "_____=__________=_______",
    "_____=___......_=_______",
    "_____=___..BB.._=_______",
    "_____=___......_=_______",
    "_____=__________=_______",
    "____......____......____",
    "____......====......____",
    "____......____......____",
  ];
  describe("imagePlanCells", () => {
    it("sizes the grid at 48 cells on the long side and keeps the aspect", () => {
      expect(cellGridSize(1536, 1024)).toEqual({ cols: 48, rows: 32 });
      expect(cellGridSize(1024, 1536)).toEqual({ cols: 32, rows: 48 });
    });

    it("pads short rows, rejects an almost empty map, and keeps landmarks inside the grid", () => {
      const map = parseCellMap({ cells: ["...", ...ring.slice(1)], landmarks: [{ id: "a", kind: "Altar", x: 99, y: 2, w: 9, h: 1 }] }, "dungeon", 24, 12);
      expect(map?.cells[0]).toBe("...".padEnd(24, "_"));
      expect(map?.landmarks[0]).toMatchObject({ id: "A", kind: "altar", x: 23, w: 1 });
      expect(parseCellMap({ cells: Array(12).fill("_".repeat(24)) }, "dungeon", 24, 12)).toBeNull();
    });

    it("turns a ring of rooms into rooms scaled uniformly with the ring links, island room unlinked", () => {
      const map = parseCellMap({ cells: ring, landmarks: [{ id: "A", kind: "altar", x: 6, y: 3, w: 1, h: 1 }] }, "dungeon", 24, 12)!;
      const plan = dungeonPlanFromCells(map);
      expect(plan.rooms).toHaveLength(5);
      expect(plan.rooms.map((r) => [r.kind, r.x, r.y, r.w, r.h])).toEqual([
        ["entrance", 28, 22, 12, 6], ["boss", 8, 2, 12, 6], ["hall", 28, 2, 12, 6], ["hall", 18, 12, 12, 6], ["hall", 8, 22, 12, 6],
      ]);
      expect(dungeonPlanFromCells(map, 1).rooms[0]).toMatchObject({ x: 14, w: 6, h: 5 });
      expect(plan.links).toHaveLength(4);
    });

    it("splices a fix region and adds a missed landmark once", () => {
      const map = parseCellMap({ cells: ring }, "dungeon", 24, 12)!;
      const { map: fixed, fixed: n } = applyCellFixes(map, { fixes: [{ x: 0, y: 0, rows: ["~~", "~~"] }, { x: 30, y: 0, rows: ["~"] }], landmarks: [{ id: "C", kind: "well", x: 1, y: 1 }] });
      expect(n).toBe(1);
      expect(fixed.cells[1]!.slice(0, 2)).toBe("~~");
      expect(fixed.landmarks.map((l) => l.id)).toEqual(["C"]);
    });

    it("sizes a village map from the plan aspect and carries tiers and water as terrainMap", () => {
      const rows = Array.from({ length: 24 }, (_, y) => (y < 8 ? "2" : y < 16 ? "1" : "0").repeat(30) + "~~" + "0".repeat(16));
      rows[20] = "0".repeat(10) + "hhh" + "0".repeat(35);
      const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "giant_tree", x: 20, y: 3, w: 4, h: 4 }] }, "village", 48, 24)!;
      const args = villageArgsFromCells(map);
      expect([args.width, args.height]).toEqual([56, 32]);
      expect((args.terrainMap as string[])[0]).toBe("2".repeat(30) + "~~" + "0".repeat(16));
      expect((args.terrainMap as string[])[20]).toBe("0".repeat(48));
      expect((args.layout as { landmark: unknown }).landmark).toEqual({ x: 25, y: 6 });
    });

    it("pads short outdoor rows with the row's own ground, not sea", () => {
      const rows = Array.from({ length: 32 }, (_, y) => (y < 20 ? "0".repeat(46) : ""));
      const map = parseCellMap({ cells: rows.slice(0, 20) }, "village", 48, 32)!;
      expect(map.cells[0]).toBe("0".repeat(48));
      expect(map.cells[31]).toBe("0".repeat(48));
      expect((villageArgsFromCells(map).terrainMap as string[]).join("")).not.toContain("_");
    });

    it("does not smear landmark letters when padding short outdoor rows", () => {
      const map = parseCellMap({ cells: Array.from({ length: 20 }, () => "00AAA" + "0".repeat(10)) }, "village", 48, 32)!;
      expect(map.cells[0]!.slice(5)).toBe("0".repeat(43));
      expect(map.cells[25]).not.toContain("A");
      const raised = parseCellMap({ cells: ["2222==2222h", ...Array.from({ length: 19 }, () => "2".repeat(13))] }, "village", 48, 32)!;
      expect(raised.cells[0]!.slice(11)).toBe("2".repeat(37));
      expect(raised.cells[31]).toBe("2".repeat(48));
    });

    it("keeps explicit landmark ids even when an id-less one comes first", () => {
      const map = parseCellMap({ cells: Array.from({ length: 12 }, () => "...." + "_".repeat(20)), landmarks: [{ id: "A", kind: "altar", x: 1, y: 1 }, { kind: "well", x: 2, y: 2 }, { id: "B", kind: "statue", x: 3, y: 3 }] }, "dungeon", 24, 12)!;
      expect(map.landmarks.map((l) => `${l.id}:${l.kind}`).sort()).toEqual(["A:altar", "B:statue", "C:well"]);
    });

    it("reads a fork joined to the main path and its side", () => {
      for (const [side, toward] of [[14, "right"], [6, "left"]] as const) {
        const rows: string[] = [];
        for (let y = 0; y < 20; y += 1) {
          const r = "t".repeat(24).split(""); r[10] = "="; r[11] = "=";
          if (y >= 4 && y <= 8) { r[side] = "="; r[side + 1] = "="; }
          if (y === 9) for (let x = Math.min(side, 10); x <= Math.max(side + 1, 11); x += 1) r[x] = "=";
          rows.push(r.join(""));
        }
        expect(forestDesignFromCells(parseCellMap({ cells: rows }, "forest", 24, 20)!).branches).toEqual([{ at: 0.58, toward, end: "clearing" }]);
      }
    });

    it("takes the entrance room from an entrance landmark before the bottom edge", () => {
      const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
      const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "statue", label: "입구 석상", x: 15, y: 3 }] }, "dungeon", 24, 16)!;
      const plan = dungeonPlanFromCells(map);
      expect(plan.rooms[0]!.kind).toBe("entrance");
      expect(plan.rooms[0]!.x).toBeGreaterThan(20);
    });

    it("does not take a boss room's gate as the entrance", () => {
      const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
      const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "gate", label: "보스방 입구 문", x: 15, y: 3 }] }, "dungeon", 24, 16)!;
      const plan = dungeonPlanFromCells(map);
      expect(plan.rooms[0]!.y).toBeGreaterThan(20);
    });

    it("does not make the throne room the entrance because its door is labelled an entrance", () => {
      const rows = Array.from({ length: 16 }, (_, y) => (y >= 2 && y <= 5 ? ".........." + "_".repeat(4) + ".........." : y >= 12 && y <= 14 ? "____" + "......" + "_".repeat(14) : "_".repeat(24)));
      const map = parseCellMap({ cells: rows, landmarks: [{ id: "A", kind: "gate", label: "왕좌의 방 입구", x: 15, y: 3 }, { id: "B", kind: "throne", label: "옥좌", x: 18, y: 2 }] }, "dungeon", 24, 16)!;
      const plan = dungeonPlanFromCells(map);
      expect(plan.rooms[0]!.y).toBeGreaterThan(20);
      expect(plan.rooms.some((r) => r.kind === "boss")).toBe(true);
    });

    it("gives a fix-pass landmark without an id the next free letter", () => {
      const map = parseCellMap({ cells: Array.from({ length: 12 }, () => "...." + "_".repeat(20)), landmarks: [{ id: "A", kind: "altar", x: 1, y: 1 }] }, "dungeon", 24, 12)!;
      const fixed = applyCellFixes(map, { fixes: [], landmarks: [{ kind: "statue", x: 2, y: 2 }] }).map;
      expect(fixed.landmarks.map((l) => l.id)).toEqual(["A", "B"]);
    });
  });
});

describe("imagePlanCheck", () => {
  isolateTimers();
  const els = (marks: string[]) => marks.map((mark, i) => ({ element: `e${i}`, mark, where: `w${i}`, fix: `f${i}` }));
  describe("imagePlanCheck", () => {
    it("scores present + half partial over the element count and drops malformed rows", () => {
      const check = parsePlanFollowCheck({ elements: [...els(["present", "partial", "missing", "present"]), { element: "", mark: "present" }, { element: "x", mark: "maybe" }], layout: "partly" })!;
      expect(check.elements).toHaveLength(4);
      expect(check.score).toBeCloseTo(2.5 / 4);
      expect(parsePlanFollowCheck({ elements: els(["present", "present"]) })).toBeNull();
    });

    it("asks to fix only non-present elements below the bar and nothing at or above it", () => {
      const low = parsePlanFollowCheck({ elements: els(["present", "missing", "partial"]), layout: "partly" })!;
      const fix = planFollowFixRequest(low)!;
      expect(fix).toContain("e1(없음, w1): f1");
      expect(fix).toContain("e2(부분, w2): f2");
      expect(fix).not.toContain("e0(");
      const high = parsePlanFollowCheck({ elements: els(["present", "present", "present", "present", "partial"]), layout: "yes" })!;
      expect(high.score).toBeGreaterThanOrEqual(PLAN_FOLLOW_BAR);
      expect(planFollowFixRequest(high)).toBeNull();
    });

    it("finds the map the turn built", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      expect(builtMapOf(before, after)).toBeNull();
      const id = after.startMapId!;
      after.maps[id]!.lowerTiles[0] = 7;
      expect(builtMapOf(before, after)?.id).toBe(id);
    });
  });
});

// 2026-11-05 imageplan-follow r3: the plan image is there to feed the assistant ideas (owner: 「이미지는 LLM 의 빈곤한 상상력을 극복하는 용도로」).
// The vision description (must-keeps, landmarks with look and place, mood) rides in the build note next to the light cell map.
describe("imagePlanDescribe", () => {
  isolateTimers();
  const raw = {
    mustKeep: ["북쪽 가운데 속 빈 거대 고목", "남쪽 진입로가 Y자로 갈라진다", "동쪽 연못에 수련", "", 42],
    landmarks: [{ name: "속 빈 고목", look: "검은 입구, 굵은 뿌리", where: "북쪽 가운데" }, { look: "이름 없음" }],
    mood: "안개 낀 어두운 숲, 발광 버섯",
    materials: "이끼 낀 흙길",
  };
  describe("plan description", () => {
    it("keeps named must-keeps and landmarks and drops empty ones", () => {
      const d = parseImagePlanDescription(raw)!;
      expect(d.mustKeep).toEqual(["북쪽 가운데 속 빈 거대 고목", "남쪽 진입로가 Y자로 갈라진다", "동쪽 연못에 수련"]);
      expect(d.landmarks.map((l) => l.name)).toEqual(["속 빈 고목"]);
      expect(parseImagePlanDescription({ mood: "only mood" })).toBeNull();
    });

    it("puts the ideas into the build note ahead of the cell map, within the note budget", () => {
      const d = parseImagePlanDescription(raw)!;
      expect(describeNote(d).length).toBeLessThanOrEqual(1600);
      const cells = parseCellMap({ cells: Array.from({ length: 32 }, () => "t".repeat(23) + "==" + "t".repeat(23)) }, "forest", 48, 32)!;
      const note = imagePlanBuildNote({ subject: "forest" } as never, { subject: "forest", cols: 48, rows: 32, data: {}, cells, description: d });
      expect(note.indexOf("속 빈 고목")).toBeGreaterThan(0);
      expect(note.indexOf("속 빈 고목")).toBeLessThan(note.indexOf("author_forest_route"));
      expect(note).toContain("generate_missing_object");
    });

    it("carries the ideas on the point-read and no-layout paths too", () => {
      const d = parseImagePlanDescription(raw)!;
      const village = imagePlanBuildNote({ subject: "village" } as never, { subject: "village", cols: 24, rows: 18, data: { width: 24, height: 18, buildings: [] }, description: d });
      expect(village).toContain("속 빈 고목");
      expect(village).toContain("author_beodeul_town");
      const bare = imagePlanBuildNote({ subject: "dungeon" } as never, { subject: "dungeon", cols: 0, rows: 0, data: {}, description: d });
      expect(bare).toContain("속 빈 고목");
      expect(bare).not.toContain("author_dungeon");
    });

    it("drops landmarks from the end, not the rule or mood line, when the note is too long", () => {
      const long = parseImagePlanDescription({
        mustKeep: Array.from({ length: 8 }, (_, i) => `꼭 살릴 것 ${i} `.padEnd(60, "가")),
        landmarks: Array.from({ length: 10 }, (_, i) => ({ name: `랜드마크${i}`.padEnd(30, "나"), look: "다".repeat(50), where: "라".repeat(30) })),
        mood: "마".repeat(80), materials: "바".repeat(80),
      })!;
      const note = describeNote(long);
      expect(note.length).toBeLessThanOrEqual(1600);
      expect(note).toContain("generate_missing_object");
      expect(note).toContain("분위기·재질");
      expect(note).toContain("랜드마크0");
      expect(note).not.toContain("랜드마크9");
    });
  });
  describe("describe switch", () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    afterEach(() => store.clear());

    it("keeps imagePlanDescribe:false through loadAiConfig", () => {
      store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex", imagePlanDescribe: false }));
      expect(loadAiConfig().imagePlanDescribe).toBe(false);
      store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex" }));
      expect(loadAiConfig().imagePlanDescribe).toBeUndefined();
    });
  });
});

describe("imagePlanPick", () => {
  isolateTimers();
  const village = (houses: number, extra: Record<string, unknown> = {}): ImagePlanRead => ({
    subject: "village", cols: 24, rows: 18,
    data: { gather: { x: 5, y: 5 }, landmark: { x: 3, y: 2 }, houses: Array.from({ length: houses }, (_, i) => ({ x: i, y: 4 })), ...extra },
  });
  describe("imagePlanPick", () => {
    it("counts builder inputs a read yields and 0 for no read", () => {
      expect(readYield(null)).toBe(0);
      expect(readYield(village(4))).toBe(6);
      expect(readYield({ subject: "dungeon", cols: 24, rows: 16, data: { rooms: [{}, {}, {}], links: [[0, 1], [1, 2]] } })).toBe(5);
    });

    it("parses a judge answer and rejects a missing candidate", () => {
      const ok = parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: true, clean: true }, { i: 2, elements: 1, setting: "false", clean: true }], reason: "1번이 요소가 다 있다" }, 2);
      expect(ok?.candidates[1]).toEqual({ elements: 1, setting: false, clean: true });
      expect(parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: true, clean: true }] }, 2)).toBeNull();
      expect(parsePlanJudge(null, 2)).toBeNull();
    });

    it("prefers the candidate with the right setting and more builder inputs, and flags when the bar is missed", () => {
      const cands = [{ dataUrl: "", read: village(1) }, { dataUrl: "", read: village(5) }];
      const judge = parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: false, clean: true }, { i: 2, elements: 3, setting: true, clean: true }], reason: "" }, 2)!;
      const best = pickBest("village", cands, judge);
      expect(best.index).toBe(1);
      expect(best.met).toBe(true);
      const weak = parsePlanJudge({ candidates: [{ i: 1, elements: 1, setting: true, clean: true }, { i: 2, elements: 2, setting: true, clean: true }], reason: "" }, 2)!;
      expect(pickBest("village", cands, weak).met).toBe(false);
      expect(meetsBar("village", village(1), { elements: 5, setting: true, clean: true })).toBe(false);
    });

    it("falls back to the first candidate that reads best when the judge is missing", () => {
      const cands = [{ dataUrl: "", read: null }, { dataUrl: "", read: village(4) }];
      expect(pickBest("village", cands, null).index).toBe(1);
    });
  });
});
