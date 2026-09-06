// 개념 꾸러미 — 장소 `level`(층). 2층 이상 장소는 별도 맵으로 서고 계단(transfer 칩)이 층을 잇는다.
import { describe, expect, it } from "vitest";
import { conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { listConceptConnections } from "@/editor/interiorConceptEvents";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { cloneConceptBundle } from "@/project/defaults/scratchInnBundle";
import { SCRATCH_INN_BUNDLE } from "./fixtures/legacyConceptInn";
import { validateTileset } from "@/project/io/shapeResourceFields";
import type { ConceptBundleRecord } from "@/project/types";

const INTERIOR = "easyrpg_chipset_interior";

/** 여관을 두 층으로: 식당·홀(dining)은 1층, 복도·침실은 2층. 계단은 홀(올라감)과 복도(내려감) 양쪽에. */
function twoStoryInn(): ConceptBundleRecord {
  const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
  for (const place of bundle.places) {
    if (place.id === "corridor" || place.id === "bedroom") place.level = 2;
  }
  bundle.things.push({id:"stairs",label:"층 연결 계단",objectId:"stairs_small",placeIds:["dining","corridor"],chips:["transfer"],required:true});
  return bundle;
}

function projectWith(bundle: ConceptBundleRecord): ToolContext {
  const project = createBlankProject();
  project.tilesets[INTERIOR]!.scratchConceptBundles = [bundle];
  return { project };
}

describe("개념 꾸러미 — 층", () => {
  it("level 없는 초안은 한 층이고 도면은 종전과 같다", () => {
    expect(conceptFacilityLevels(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!)).toEqual([1]);
    const whole = layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!);
    const ground = layoutConceptFacility(SCRATCH_INN_BUNDLE, SCRATCH_INN_BUNDLE.facilities[0]!, { level: 1 });
    expect(ground).toEqual(whole);
  });

  it("검증기는 1..3 정수만 받고 복제가 보존한다", () => {
    const bundle = twoStoryInn();
    expect(cloneConceptBundle(bundle).places.find((place) => place.id === "bedroom")?.level).toBe(2);
    const tileset = { ...createBlankProject().tilesets[INTERIOR]!, scratchConceptBundles: [bundle] };
    expect(() => validateTileset(INTERIOR, tileset)).not.toThrow();
    const bad = cloneConceptBundle(bundle);
    (bad.places.find((place) => place.id === "bedroom") as { level: number }).level = 4;
    expect(() => validateTileset(INTERIOR, { ...tileset, scratchConceptBundles: [bad] })).toThrow(/level/u);
  });

  it("층별 도면: 1층은 홀만, 2층은 복도와 침실 둘", () => {
    const bundle = twoStoryInn();
    const facility = bundle.facilities[0]!;
    expect(conceptFacilityLevels(bundle, facility)).toEqual([1, 2]);
    const ground = layoutConceptFacility(bundle, facility, { level: 1 });
    expect(ground.rooms.map((room) => room.placeId)).toEqual(["dining"]);
    const upper = layoutConceptFacility(bundle, facility, { level: 2 });
    expect(upper.rooms.map((room) => room.placeId).sort()).toEqual(["bedroom", "bedroom", "corridor"]);
    expect(upper.level).toBe(2);
  });

  it("place_concept 이 층마다 맵을 짓고 계단을 양방향으로 잇는다", () => {
    const ctx = projectWith(twoStoryInn());
    const result = runTool(ctx, "place_concept", { query: "여관", mapId: "map_inn", seed: 7 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      floors: { level: number; mapId: string; name: string }[];
      connections: { mapId?: string; target: { mapId: string; x: number; y: number } | null }[];
    };
    expect(data.floors.map((floor) => [floor.level, floor.mapId])).toEqual([[1, "map_inn"], [2, "map_inn_2f"]]);
    const ground = ctx.project.maps.map_inn!;
    const upper = ctx.project.maps.map_inn_2f!;
    expect(upper.name).toBe("여관 2층");
    expect(upper.tilesetId).toBe(INTERIOR);

    // 1층 계단 → 2층 착지(위층 맵 안의 바닥 칸).
    const up = listConceptConnections(ground);
    expect(up.length).toBeGreaterThan(0);
    for (const connection of up) {
      expect(connection.target?.mapId).toBe("map_inn_2f");
      const target = connection.target!;
      expect(target.y).toBeGreaterThanOrEqual(0);
      expect(target.y).toBeLessThan(upper.height);
    }
    // 2층의 문 자리 = 내려가는 계단. 1층 계단 앞으로 간다.
    const descent = upper.events.find((event) => event.id === "ev_entrance_map_inn_2f")!;
    expect(descent).toBeTruthy();
    const commands = (descent.pages ?? []).flatMap((page) => page.commands);
    const transfer = commands.find((command) => command.kind === "transfer");
    expect(transfer && transfer.kind === "transfer" ? transfer.mapId : null).toBe("map_inn");
    expect(commands.some((command) => command.kind === "text" && /내려/u.test(command.body))).toBe(true);
    // 2층 복도의 계단도 아래로.
    const down = listConceptConnections(upper);
    expect(down.length).toBeGreaterThan(0);
    for (const connection of down) expect(connection.target?.mapId).toBe("map_inn");
    // 미연결 경고 없음.
    const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
    expect(warnings.filter((line) => line.includes("연결 대상이 없다"))).toEqual([]);
    expect(result.summary).toContain("2층");
  });

  it("1층에 계단이 없으면 위층은 서되 내려오는 자리는 1층 정문 앞이고 경고를 남긴다", () => {
    const bundle = twoStoryInn();
    bundle.things.find((thing) => thing.id === "stairs")!.placeIds = ["corridor"];
    const ctx = projectWith(bundle);
    const result = runTool(ctx, "place_concept", { query: "여관", mapId: "map_inn", seed: 7 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_inn_2f).toBeTruthy();
    const warnings = [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])];
    expect(warnings.some((line) => /1층.*계단/u.test(line))).toBe(true);
    const descent = ctx.project.maps.map_inn_2f!.events.find((event) => event.id === "ev_entrance_map_inn_2f")!;
    const transfer = (descent.pages ?? []).flatMap((page) => page.commands).find((command) => command.kind === "transfer");
    expect(transfer && transfer.kind === "transfer" ? transfer.mapId : null).toBe("map_inn");
  });
});
