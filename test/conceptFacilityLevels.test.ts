// 개념 꾸러미 — 장소 `level`(층). 2층 이상 장소는 별도 맵으로 서고 계단(transfer 칩)이 층을 잇는다.
import { describe, expect, it } from "vitest";
import { conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { createBlankProject } from "@/project/defaults";
import { ATLAS_BIOME_INTERIOR_ID } from "@/project/defaults/atlasBiomeInterior";
import { cloneConceptBundle } from "@/project/defaults/scratchInnBundle";
import { SCRATCH_INN_BUNDLE } from "./fixtures/legacyConceptInn";
import { validateTileset } from "@/project/io/shapeResourceFields";
import type { ConceptBundleRecord } from "@/project/types";

// Concept bundles are validated on the current default interior, the hand-pixel v5 sheet (openwiki/atlas-biome-interior.md).
const INTERIOR = ATLAS_BIOME_INTERIOR_ID;

/** 여관을 두 층으로: 식당·홀(dining)은 1층, 복도·침실은 2층. 계단은 홀(올라감)과 복도(내려감) 양쪽에. */
function twoStoryInn(): ConceptBundleRecord {
  const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
  for (const place of bundle.places) {
    if (place.id === "corridor" || place.id === "bedroom") place.level = 2;
  }
  bundle.things.push({id:"stairs",label:"층 연결 계단",objectId:"stairs_small",placeIds:["dining","corridor"],chips:["transfer"],required:true});
  return bundle;
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

  // Removed it "place_concept 이 층마다 맵을 짓고": place_concept was removed from the tool registry on purpose.

  // Removed it "1층에 계단이 없으면 위층은": place_concept was removed from the tool registry on purpose.
});
