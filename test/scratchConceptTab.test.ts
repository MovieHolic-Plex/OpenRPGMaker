import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { TAB_GROUPS } from "@/editor/panels/database";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import {
  ensureThingKitForEdit,
  renderScratchConceptTab,
  resetScratchConceptTabSession,
} from "@/editor/panels/scratchConceptTab";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { validateTileset } from "@/project/io/shapeResourceFields";
import { store } from "@/project/store";
import type { ConceptBundleRecord } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetScratchConceptTabSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  resetScratchConceptTabSession();
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.scratchConceptBundles;
    }
  });
});

function renderOnTileset(tilesetId: string): FakeElement {
  const current = store.getCurrent();
  const mapId = Object.keys(current.maps)[0]!;
  editorState.set({ currentMapId: mapId });
  const host = new FakeElement("div");
  renderScratchConceptTab(host as unknown as HTMLElement, () => {});
  host.querySelector(`[data-testid='scratch-concept-tileset-${tilesetId}']`)!.click();
  return host;
}

describe("scratchConceptTab 레일", () => {
  it("임시 그룹에 개념 꾸러미 탭이 있다", () => {
    const scratch = TAB_GROUPS.find((group) => group.slug === "scratch");
    expect(scratch?.label).toBe("임시");
    expect(scratch?.tabs).toEqual(["scratchConcepts"]);
  });

  it("제목은 개념 꾸러미이고 구조물 앨범이 아니다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-heading']")?.textContent).toBe("개념 꾸러미");
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
    expect(host.querySelector("[data-testid='tileset-spaces-kind-add']")).toBeNull();
  });
});

describe("scratchConceptTab 실내 시드", () => {
  it("마을 칩셋은 여관을 기본으로 얹지 않는다", () => {
    const host = renderOnTileset(DEFAULT_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-empty']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).toBeNull();
    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
  });

  it("실내 칩셋은 시설 초안 묶음을 시드하고 첫 시설(여관)의 세 장소를 그린다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const bundles = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles;
    expect(bundles).toHaveLength(CONCEPT_FACILITY_TEMPLATES.length);
    expect(bundles?.[0]?.id).toBe(SCRATCH_INN_BUNDLE.id);
    for (const template of CONCEPT_FACILITY_TEMPLATES) {
      expect(host.querySelector(`[data-testid='scratch-concept-facility-${template.id}']`), template.id).not.toBeNull();
    }
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-corridor']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-dining']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-thing-bed_h']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-thing-stairs']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-line']")?.textContent).toContain("여관");
  });

  it("빈 배열은 다시 시드하지 않고, 빈 화면의 「초안 넣기」가 묶음을 넣는다", () => {
    store.update((project) => {
      const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
      if (tileset) tileset.scratchConceptBundles = [];
    });
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-empty']")).not.toBeNull();
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual([]);
    host.querySelector("[data-testid='scratch-concept-seed-templates']")!.click();
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toHaveLength(CONCEPT_FACILITY_TEMPLATES.length);
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).not.toBeNull();
  });
});

describe("scratchConceptTab 시설 띠", () => {
  function select(host: FakeElement, testid: string): { value: string; dispatchEvent: (event: Event) => void } {
    return host.querySelector(`[data-testid='${testid}']`) as unknown as { value: string; dispatchEvent: (event: Event) => void };
  }

  it("시설 칩을 누르면 그 시설의 장소가 그려지고 벽 재질이 보인다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-place-workshop']")).toBeNull();
    host.querySelector("[data-testid='scratch-concept-facility-smithy']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-place-workshop']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-crumb']")?.textContent).toContain("대장간");
    expect(select(host, "scratch-concept-facility-wall").value).toBe("stone-brick");
    expect(select(host, "scratch-concept-place-floor-workshop").value).toBe("stone");
    expect(host.querySelector("[data-testid='scratch-concept-line']")?.textContent).toContain("대장간");
  });

  it("벽·바닥 재질을 바꾸면 저장되고 기본값(크림·나무)은 필드를 비운다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-facility-smithy']")!.click();
    const wall = select(host, "scratch-concept-facility-wall");
    wall.value = "cream";
    wall.dispatchEvent(new Event("change"));
    const floor = select(host, "scratch-concept-place-floor-workshop");
    floor.value = "plank";
    floor.dispatchEvent(new Event("change"));
    const smithy = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find((bundle) => bundle.id === "smithy")!;
    expect(smithy.facilities[0]!.wall).toBeUndefined();
    expect(smithy.places.find((place) => place.id === "workshop")?.floor).toBe("plank");
    const floorAgain = select(host, "scratch-concept-place-floor-workshop");
    floorAgain.value = "wood";
    floorAgain.dispatchEvent(new Event("change"));
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find((bundle) => bundle.id === "smithy")!.places.find((place) => place.id === "workshop")?.floor).toBeUndefined();
  });

  it("장소 카드의 「층」을 바꾸면 level 이 저장되고 1층은 필드를 비운다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const level = select(host, "scratch-concept-place-level-bedroom");
    expect(level.value).toBe("1");
    level.value = "2";
    level.dispatchEvent(new Event("change"));
    const inn = (): ConceptBundleRecord => store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
    expect(inn().places.find((place) => place.id === "bedroom")?.level).toBe(2);
    const again = select(host, "scratch-concept-place-level-bedroom");
    expect(again.value).toBe("2");
    again.value = "1";
    again.dispatchEvent(new Event("change"));
    expect(inn().places.find((place) => place.id === "bedroom")?.level).toBeUndefined();
  });

  it("시설을 지우면 띠에서 빠지고 「초안 넣기」로 되돌릴 수 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-template-select']")).toBeNull();
    host.querySelector("[data-testid='scratch-concept-facility-church']")!.click();
    host.querySelector("[data-testid='scratch-concept-facility-remove']")!.click();
    let ids = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.map((bundle) => bundle.id);
    expect(ids).not.toContain("church");
    expect(ids).toHaveLength(CONCEPT_FACILITY_TEMPLATES.length - 1);
    expect(host.querySelector("[data-testid='scratch-concept-facility-church']")).toBeNull();
    const picker = select(host, "scratch-concept-template-select");
    expect(picker).not.toBeNull();
    picker.value = "church";
    picker.dispatchEvent(new Event("change"));
    ids = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.map((bundle) => bundle.id);
    expect(ids).toContain("church");
    expect(host.querySelector("[data-testid='scratch-concept-place-chapel']")).not.toBeNull();
  });

  it("마지막 시설까지 지우면 빈 배열이 남고 다시 시드하지 않는다", () => {
    store.update((project) => {
      const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
      if (tileset) tileset.scratchConceptBundles = [cloneConceptBundle(SCRATCH_INN_BUNDLE)];
    });
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-facility-remove']")!.click();
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual([]);
    expect(host.querySelector("[data-testid='scratch-concept-empty']")).not.toBeNull();
  });

  it("「+ 시설」은 빈 시설을 만들고 그 시설로 옮긴다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-facility-add']")!.click();
    const bundles = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!;
    expect(bundles).toHaveLength(CONCEPT_FACILITY_TEMPLATES.length + 1);
    expect(host.querySelector("[data-testid='scratch-concept-crumb']")?.textContent).toContain("새 시설");
  });

  it("피커에 카탈로그의 새 소품이 있고 러그는 통행·바닥 칩으로 들어온다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-add-bedroom']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-pick-religious']")).not.toBeNull();
    host.querySelector("[data-testid='scratch-concept-pick-rug_red']")!.click();
    const inn = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    const rug = inn.things.find((thing) => thing.objectId === "rug_red");
    expect(rug?.placeIds).toContain("bedroom");
    expect(rug?.chips).toEqual(["pass", "floor"]);
  });
});

describe("scratchConceptTab 편집", () => {
  it("칩을 누르면 물건 칩이 토글된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    const before = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    expect(before.things.find((thing) => thing.id === "bed_h")?.chips).toContain("block");
    host.querySelector("[data-testid='scratch-concept-chip-block']")!.click();
    const after = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    expect(after.things.find((thing) => thing.id === "bed_h")?.chips).not.toContain("block");
  });

  it("자유 칩을 입력하면 저장되고 눌러서 지울 수 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    const input = host.querySelector("[data-testid='scratch-concept-chip-add']") as unknown as { value: string; dispatchEvent: (event: Event) => void };
    input.value = "guest-only";
    input.dispatchEvent(new Event("change"));
    const added = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    expect(added.things.find((thing) => thing.id === "bed_h")?.chips).toContain("guest-only");
    expect(host.querySelector("[data-testid='scratch-concept-chip-custom-guest-only']")).not.toBeNull();
    host.querySelector("[data-testid='scratch-concept-chip-custom-guest-only']")!.click();
    const removed = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    expect(removed.things.find((thing) => thing.id === "bed_h")?.chips).not.toContain("guest-only");
  });

  it("물건 인스펙터에 그림 칠하기 버튼이 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-thing-paint']")).not.toBeNull();
  });

  it("그림을 바꾸면 물건의 objectId가 저장된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const graphic = host.querySelector("[data-testid='scratch-concept-thing-graphic']") as unknown as { value: string; dispatchEvent: (event: Event) => void };
    expect(graphic.value).toBe("bed_h");
    graphic.value = "bed_v";
    graphic.dispatchEvent(new Event("change"));
    const thing = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!.things.find((entry) => entry.id === "bed_h");
    expect(thing?.objectId).toBe("bed_v");
    const again = host.querySelector("[data-testid='scratch-concept-thing-graphic']") as unknown as { value: string };
    expect(again.value).toBe("bed_v");
  });

  it("장소 이름을 바꾸면 저장된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const input = host.querySelector("[data-testid='scratch-concept-place-name-bedroom']") as { value: string; dispatchEvent: (event: Event) => void };
    input.value = "객실";
    input.dispatchEvent(new Event("change"));
    const bundle = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    expect(bundle.places.find((place) => place.id === "bedroom")?.label).toBe("객실");
  });

  it("장소 역할·크기를 바꾸면 저장된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const role = host.querySelector("[data-testid='scratch-concept-place-role-bedroom']") as { value: string; dispatchEvent: (event: Event) => void };
    role.value = "entrance";
    role.dispatchEvent(new Event("change"));
    const size = host.querySelector("[data-testid='scratch-concept-place-size-bedroom']") as { value: string; dispatchEvent: (event: Event) => void };
    size.value = "l";
    size.dispatchEvent(new Event("change"));
    const place = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!.places.find((entry) => entry.id === "bedroom");
    expect(place?.role).toBe("entrance");
    expect(place?.size).toBe("l");
  });

  it("장소 개수를 바꾸면 저장되고 1은 비운다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const count = host.querySelector("[data-testid='scratch-concept-place-count-bedroom']") as { value: string; dispatchEvent: (event: Event) => void };
    expect(count.value).toBe("2");
    count.value = "3";
    count.dispatchEvent(new Event("change"));
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!.places.find((entry) => entry.id === "bedroom")?.count).toBe(3);
    count.value = "1";
    count.dispatchEvent(new Event("change"));
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!.places.find((entry) => entry.id === "bedroom")?.count).toBeUndefined();
  });

  it("피커에서 물건을 넣으면 그 장소에 붙는다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-add-bedroom']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-picker']")).not.toBeNull();
    host.querySelector("[data-testid='scratch-concept-pick-bookshelf']")!.click();
    const bundle = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    const shelf = bundle.things.find((thing) => thing.objectId === "bookshelf");
    expect(shelf?.placeIds).toContain("bedroom");
  });
});

describe("scratchConceptTab 물건 그림 칠하기", () => {
  const tilesetId = INTERIOR_ROOM_TILESET_ID;
  let kitsSnapshot: ReturnType<typeof structuredClone> | undefined;

  beforeEach(() => {
    kitsSnapshot = structuredClone(store.getCurrent().tilesets[tilesetId]?.structureKits);
  });

  afterEach(() => {
    store.update((project) => {
      const tileset = project.tilesets[tilesetId];
      if (!tileset) return;
      if (kitsSnapshot) tileset.structureKits = structuredClone(kitsSnapshot);
      else delete tileset.structureKits;
    });
  });

  it("그려진 물건 칩마다 칠하기 버튼이 있다", () => {
    const host = renderOnTileset(tilesetId);
    const inn = store.getCurrent().tilesets[tilesetId]!.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
    const facility = inn.facilities[0]!;
    expect(facility.placeIds.length).toBeGreaterThan(0);
    for (const placeId of facility.placeIds) {
      const things = inn.things.filter((thing) => thing.placeIds.includes(placeId));
      expect(things.length, placeId).toBeGreaterThan(0);
      const row = host.querySelector(`[data-testid='scratch-concept-things-${placeId}']`);
      expect(row, placeId).not.toBeNull();
      for (const thing of things) {
        expect(
          row!.querySelector(`[data-testid='scratch-concept-thing-paint-${thing.id}']`),
          `${placeId}:${thing.id}`,
        ).not.toBeNull();
      }
    }
  });

  it("ensureThingKitForEdit 는 카탈로그 물건을 타일셋에 복제하고 objectId 를 붙이며 카탈로그는 그대로 둔다", () => {
    renderOnTileset(tilesetId);
    const catalogId = "rug_red";
    const catalog = interiorObjectById(catalogId)!;
    const catalogCells = structuredClone(catalog.cells);
    store.update((project) => {
      const tileset = project.tilesets[tilesetId]!;
      tileset.structureKits = (tileset.structureKits ?? []).filter((kit) => kit.id !== catalogId);
      const inn = tileset.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
      if (!inn.things.some((thing) => thing.id === catalogId)) {
        inn.things.push({
          id: catalogId,
          label: catalog.label,
          objectId: catalogId,
          placeIds: ["bedroom"],
          chips: ["pass", "floor"],
        });
      }
    });
    const beforeCount = store.getCurrent().tilesets[tilesetId]!.structureKits?.length ?? 0;

    const kitId = ensureThingKitForEdit(tilesetId, "inn", catalogId);
    expect(kitId).toBeTruthy();
    expect(kitId).not.toBe(catalogId);

    const after = store.getCurrent().tilesets[tilesetId]!;
    expect(after.structureKits).toHaveLength(beforeCount + 1);
    expect(after.structureKits!.some((kit) => kit.id === kitId && kit.kind === "section")).toBe(true);
    expect(after.structureKits!.some((kit) => kit.id === catalogId)).toBe(false);
    expect(after.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!.things.find((thing) => thing.id === catalogId)?.objectId).toBe(kitId);
    expect(interiorObjectById(catalogId)?.cells).toEqual(catalogCells);
    expect(interiorObjectById(catalogId)?.id).toBe(catalogId);
  });

  it("ensureThingKitForEdit 는 이미 저장된 킷이면 같은 id 를 돌려주고 복제하지 않는다", () => {
    renderOnTileset(tilesetId);
    const storedId = "kit_already_stored";
    store.update((project) => {
      const tileset = project.tilesets[tilesetId]!;
      tileset.structureKits = [
        ...(tileset.structureKits ?? []),
        {
          id: storedId,
          kind: "section",
          name: "이미 저장",
          width: 1,
          height: 1,
          rows: [{ tiles: [240] }],
          learnedFrom: "db-authored",
          ai: { description: "", placementRules: "", snap: "floor", themes: [] },
        },
      ];
      const inn = tileset.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
      inn.things.push({
        id: "stored_paint",
        label: "저장 물건",
        objectId: storedId,
        placeIds: ["bedroom"],
        chips: ["block"],
      });
    });
    const beforeIds = (store.getCurrent().tilesets[tilesetId]!.structureKits ?? []).map((kit) => kit.id);

    const kitId = ensureThingKitForEdit(tilesetId, "inn", "stored_paint");
    expect(kitId).toBe(storedId);
    expect((store.getCurrent().tilesets[tilesetId]!.structureKits ?? []).map((kit) => kit.id)).toEqual(beforeIds);
    expect(
      store.getCurrent().tilesets[tilesetId]!.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!.things.find((thing) => thing.id === "stored_paint")?.objectId,
    ).toBe(storedId);
  });
});

describe("scratchConceptBundles 스키마", () => {
  it("여관 초안과 자유 칩은 타일셋 검증을 통과하고 빈 칩은 거절한다", () => {
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const valid = { ...tileset, scratchConceptBundles: [cloneConceptBundle(SCRATCH_INN_BUNDLE)] };
    expect(() => validateTileset(tileset.id, valid)).not.toThrow();
    const custom = {
      ...valid,
      scratchConceptBundles: [{
        ...cloneConceptBundle(SCRATCH_INN_BUNDLE),
        things: [{
          id: "bed_h",
          label: "침대",
          objectId: "bed_h",
          placeIds: ["bedroom"],
          chips: ["block", "guest-only"],
        }],
      }],
    };
    expect(() => validateTileset(tileset.id, custom)).not.toThrow();
    const invalid = {
      ...valid,
      scratchConceptBundles: [{
        ...cloneConceptBundle(SCRATCH_INN_BUNDLE),
        things: [{
          id: "bed_h",
          label: "침대",
          objectId: "bed_h",
          placeIds: ["bedroom"],
          chips: [""],
        }],
      }],
    };
    expect(() => validateTileset(tileset.id, invalid)).toThrow(/empty chip/);
  });
});
