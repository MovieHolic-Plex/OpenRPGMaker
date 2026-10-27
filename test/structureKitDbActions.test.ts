import { beforeEach, describe, expect, it } from "vitest";
import {
  conceptThingsReferencingKit,
  deleteStructureKit,
  registerStructureKit,
  renameStructureKit,
} from "@/editor/harnessSuggestion/structureKitActions";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { store } from "@/project/store";
import type { SectionStructureKitDef } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";

beforeEach(() => {
  // 이 시험은 합본 마을(EasyRPG) 칩셋을 겨냥한다 — 정리(0d4f13e7c8) 뒤 빈 프로젝트엔 없으니 정의와 시작 맵을 되살린다(#3657 패턴).
  // 되살린 정의엔 로드 정규화가 심는 킷(실내 가구 카탈로그·버들항 내장 킷)이 있으므로 등록 킷 0개 상태로 시작한다.
  store.replace(withRetiredCombinedTownMaps(createBlankProject()));
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.structureKits;
      delete tileset.scratchConceptBundles;
    }
  });
});

function bedKit(id: string): SectionStructureKitDef {
  return {
    id,
    kind: "section",
    name: "Fence 단면",
    width: 1,
    height: 3,
    rows: [
      { tiles: [240], upperTiles: [379] },
      { tiles: [240], upperTiles: [288] },
      { tiles: [240], upperTiles: [379] },
    ],
    learnedFrom: "user-paint",
  };
}

describe("structureKit DB 관리 액션 — 등록/개명/삭제", () => {
  it("등록·중복 서명 병합·이름 변경·삭제가 스토어에 반영된다", () => {
    const tilesetId = Object.keys(store.getCurrent().tilesets)[0]!;

    const registered = registerStructureKit(tilesetId, bedKit("kit_bed_a"));
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits?.some((kit) => kit.id === registered.id)).toBe(true);

    // 같은 서명(동일 rows)은 새로 만들지 않고 기존 킷을 돌려준다.
    const duplicate = registerStructureKit(tilesetId, bedKit("kit_bed_b"));
    expect(duplicate.id).toBe(registered.id);
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits).toHaveLength(1);

    renameStructureKit(tilesetId, registered.id, "울타리 화단");
    expect(
      store.getCurrent().tilesets[tilesetId]!.structureKits?.find((kit) => kit.id === registered.id)?.name,
    ).toBe("울타리 화단");

    deleteStructureKit(tilesetId, registered.id);
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits ?? []).toHaveLength(0);
  });

  it("개념 꾸러미 물건이 가리키는 킷을 조회한다 — 참조 없으면 빈 배열", () => {
    const project = store.getCurrent();
    const tilesetId = Object.keys(project.tilesets)[0]!;
    const registered = registerStructureKit(tilesetId, bedKit("kit_orphan_a"));
    const tileset = store.getCurrent().tilesets[tilesetId]!;
    expect(conceptThingsReferencingKit(tilesetId, registered.id)).toEqual([]);
    // 참조 심기: 꾸러미 물건이 이 킷을 그림으로 쓴다.
    store.update((draft) => {
      const target = draft.tilesets[tilesetId]!;
      target.scratchConceptBundles = [{
        id: "bundle_t",
        label: "시험 시설",
        facilities: [{ id: "facility_t", label: "시험", placeIds: ["place_t"] }],
        places: [{ id: "place_t", label: "시험실" }],
        things: [{ id: "thing_t", label: "시험 침대", objectId: registered.id, placeIds: ["place_t"], chips: ["block"] }],
      }];
    });
    const refs = conceptThingsReferencingKit(tilesetId, registered.id);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ bundleId: "bundle_t", thingId: "thing_t", thingLabel: "시험 침대" });
    expect(conceptThingsReferencingKit(tilesetId, "kit_nope")).toEqual([]);
    expect(tileset.id).toBe(tilesetId);
  });

  it("시드된 카탈로그 id 킷도 조인된다 — bed_h 물건은 kit bed_h를 가리킨다", () => {
    const tilesetId = Object.keys(store.getCurrent().tilesets)[0]!;
    // 카탈로그에 실제로 있는 id를 쓴다 — 카탈로그 폴백 렌더 경로의 조인 계약.
    const catalogId = interiorObjectById("bed_h") ? "bed_h" : "bed";
    const kit: SectionStructureKitDef = { ...bedKit(catalogId), id: catalogId };
    const registered = registerStructureKit(tilesetId, kit);
    store.update((draft) => {
      draft.tilesets[tilesetId]!.scratchConceptBundles = [{
        id: "bundle_c",
        label: "시험 시설",
        facilities: [{ id: "facility_c", label: "시험", placeIds: ["place_c"] }],
        places: [{ id: "place_c", label: "시험실" }],
        things: [{ id: "thing_c", label: "시험 침대", objectId: registered.id, placeIds: ["place_c"], chips: ["block"] }],
      }];
    });
    const refs = conceptThingsReferencingKit(tilesetId, registered.id);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.thingId).toBe("thing_c");
    deleteStructureKit(tilesetId, registered.id);
  });
});
