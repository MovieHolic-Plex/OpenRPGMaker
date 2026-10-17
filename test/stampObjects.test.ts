// 바로 깔기 물건 찾기 — 이름 대조·동의어 묶음·거절·칸 고르기·실제 변경 측정. 네트워크·스토어 없음.
// 코퍼스(scripts/qa/stamp-place-corpus.mts) 2026-10-15: 「화분」이 자갈·물고기·풀 얼룩으로 깔리고 「완료」라 적히던 것을 막는 순수 규칙.
import { describe, expect, it } from "vitest";
import {
  acceptedObjectNames,
  baseName,
  nearestStampObjects,
  resolveStampObject,
  type StampObjectEntry,
} from "@/ai/stampObjects";
import { expandStampObjects, parseStampPlan, type StampPlanFacts } from "@/ai/stampPlanner";
import { describeStampEffect, hasVisibleChange, measureStampEffect } from "@/editor/stampEffect";
import { createBlankProject } from "@/project/defaults";

function entry(id: string, name: string, extra: Partial<StampObjectEntry> = {}): StampObjectEntry {
  const text = name.toLowerCase();
  return { id, kind: "kit", name, source: "pack", width: 1, height: 1, nameText: text, descText: "", floorStanding: true, ...extra };
}

const INDEX: readonly StampObjectEntry[] = [
  entry("k-pot", "화분"),
  entry("k-table", "탁자"),
  entry("k-torch", "벽 횃불", { floorStanding: false }),
  entry("k-bench", "나무 벤치", { width: 2 }),
];

const FACTS: StampPlanFacts = {
  text: "화분 깔아 줘",
  mapId: "m",
  mapWidth: 20,
  mapHeight: 20,
  target: { x: 2, y: 2, w: 8, h: 6 },
  targetIsSelection: true,
  fillMaterials: ["흙"],
  materialHint: "",
  objects: INDEX,
  isOpenCell: () => true,
  hasArtAt: () => false,
};

describe("resolveStampObject", () => {
  it("finds a thing by its name and refuses things that are not in the chipset", () => {
    expect(resolveStampObject(INDEX, ["화분"])?.entry.id).toBe("k-pot");
    expect(resolveStampObject(INDEX, ["자판기"])).toBeNull();
  });

  it("never returns a wall-mounted piece for a floor request", () => {
    expect(resolveStampObject(INDEX, ["횃불"])).toBeNull();
  });

  it("fixes a one-letter typo only on the user's own word", () => {
    const hit = resolveStampObject(INDEX, ["화뷴"]);
    expect(hit?.entry.id).toBe("k-pot");
    expect(hit?.corrected).toBe(true);
  });

  it("accepts only same-group synonyms from the model, never a similar different thing", () => {
    const accepted = acceptedObjectNames("탁자", ["테이블", "왕좌"]);
    expect(accepted.names).toContain("테이블");
    expect(accepted.rejected).toContain("왕좌");
  });

  it("lists nearest names for a refusal and strips size/coordinate suffixes", () => {
    expect(nearestStampObjects(INDEX, ["화뷴"])).toContain("화분");
    expect(baseName("화분 고사리 (0,0)")).toBe("화분 고사리");
    expect(baseName("버들항 소품 둥근 돌 화분 1×1")).toBe("버들항 소품 둥근 돌 화분");
  });

  it("avoids wooden furniture false matches on tree queries and respects maxSize", () => {
    const pool: readonly StampObjectEntry[] = [
      entry("k-chair", "학교 나무 의자"),
      entry("k-garden", "학급 밭(이랑·새싹·나무 팻말)"),
      entry("k-tree-big", "가로수 · ginkgo", { width: 4, height: 6 }),
      entry("k-tree-small", "벚나무", { width: 2, height: 3 }),
    ];
    const names = acceptedObjectNames("나무", ["가로수", "벚나무"]).names;
    expect(resolveStampObject(pool, names)?.entry.id).toBe("k-tree-small");
    expect(resolveStampObject(pool, ["가로수"], { w: 10, h: 5 })?.entry.id).toBe("k-tree-big");
    const bridges: readonly StampObjectEntry[] = [
      entry("b-tall", "바위 다리", { width: 3, height: 7, placement: "water" }),
      entry("b-fit", "나무 널다리", { width: 5, height: 4, placement: "water" }),
    ];
    expect(resolveStampObject(bridges, acceptedObjectNames("다리", []).names, { w: 40, h: 5 })?.entry.id).toBe("b-fit");
  });
});

describe("place_object planning", () => {
  it("turns a known name into a pending object step and a missing one into a refusal", () => {
    const plan = parseStampPlan(JSON.stringify({ steps: [
      { tool: "place_object", args: { name: "화분", count: 3 } },
      { tool: "place_object", args: { name: "자판기" } },
    ] }), FACTS);
    expect(plan.steps.map((step) => step.tool)).toEqual(["place_object"]);
    expect(plan.steps[0]!.args).toMatchObject({ entryId: "k-pot", count: 3 });
    expect(plan.refused).toHaveLength(1);
    expect(plan.refused[0]!.wanted).toBe("자판기");
  });

  it("does not stand a person in for a thing, and drops hotspots on bare floor", () => {
    const plan = parseStampPlan(JSON.stringify({ steps: [
      { tool: "place_npc", args: { at: { x: 3, y: 3 }, name: "자판기 관리인" } },
      { tool: "place_examine_hotspots", args: { spots: [{ at: { x: 4, y: 4 }, name: "비석" }] } },
    ] }), { ...FACTS, text: "자판기 놓아 줘" });
    expect(plan.steps).toHaveLength(0);
    expect(plan.dropped).toHaveLength(2);
  });

  it("expands to real tool calls on open cells inside the target, one per requested piece", () => {
    const plan = parseStampPlan(JSON.stringify({ steps: [{ tool: "place_object", args: { name: "화분", count: 3 } }] }), FACTS);
    const expanded = expandStampObjects(plan.steps, FACTS);
    expect(expanded.steps).toHaveLength(3);
    for (const step of expanded.steps) {
      expect(step.tool).toBe("stamp_tileset_object");
      const at = step.at![0]!;
      expect(at.x).toBeGreaterThanOrEqual(2);
      expect(at.x).toBeLessThan(10);
      expect(at.y).toBeGreaterThanOrEqual(2);
      expect(at.y).toBeLessThan(8);
    }
    const keys = new Set(expanded.steps.map((step) => `${step.at![0]!.x},${step.at![0]!.y}`));
    expect(keys.size).toBe(3);
  });

  it("says why nothing was placed when no cell is open", () => {
    const plan = parseStampPlan(JSON.stringify({ steps: [{ tool: "place_object", args: { name: "화분" } }] }), FACTS);
    const expanded = expandStampObjects(plan.steps, { ...FACTS, isOpenCell: () => false });
    expect(expanded.steps).toHaveLength(0);
    expect(expanded.dropped[0]).toContain("놓을 자리가 없습니다");
  });
});

describe("measureStampEffect", () => {
  it("counts changed tiles and tells visible events from invisible ones", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const mapId = before.startMapId;
    const map = after.maps[mapId]!;
    map.lowerTiles[0] = 99999;
    map.lowerTiles[1] = 99998;
    const none = measureStampEffect(before, before, mapId);
    expect(hasVisibleChange(none)).toBe(false);
    const changed = measureStampEffect(before, after, mapId);
    expect(changed.tilesChanged).toBe(2);
    expect(hasVisibleChange(changed)).toBe(true);
    expect(describeStampEffect(changed)).toContain("타일 2칸");
  });
});
