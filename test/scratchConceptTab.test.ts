import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { TAB_GROUPS } from "@/editor/panels/database";
import { renderScratchConceptTab, resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";
import { validateTileset } from "@/project/io/shapeResourceFields";
import { store } from "@/project/store";
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

  it("실내 칩셋은 여관 초안을 시드하고 세 장소를 그린다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const bundles = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles;
    expect(bundles).toHaveLength(1);
    expect(bundles?.[0]?.id).toBe(SCRATCH_INN_BUNDLE.id);
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-corridor']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-dining']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-thing-bed_h']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-thing-stairs']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-line']")?.textContent).toContain("여관");
  });

  it("빈 배열은 다시 시드하지 않는다", () => {
    store.update((project) => {
      const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
      if (tileset) tileset.scratchConceptBundles = [];
    });
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-empty']")).not.toBeNull();
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual([]);
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

  it("장소 이름을 바꾸면 저장된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const input = host.querySelector("[data-testid='scratch-concept-place-name-bedroom']") as { value: string; dispatchEvent: (event: Event) => void };
    input.value = "객실";
    input.dispatchEvent(new Event("change"));
    const bundle = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    expect(bundle.places.find((place) => place.id === "bedroom")?.label).toBe("객실");
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

describe("scratchConceptTab 스튜디오", () => {
  it("타일셋 그림판이 보이고 칸을 고를 수 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-sheet']")).not.toBeNull();
    const cell = host.querySelector("[data-testid='scratch-concept-sheet-tile-222']");
    expect(cell).not.toBeNull();
    cell!.click();
    expect(host.querySelector("[data-testid='scratch-concept-sheet-tile-222']")?.className).toContain("on");
  });

  it("장소 카드에 그림 무대가 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-stage-bedroom']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-stage-bedroom'] canvas, [data-testid='scratch-concept-stage-bedroom'] .scratch-concept-thumb")).not.toBeNull();
  });

  it("고른 칸으로 물건을 만들면 그 타일셋에 내 그림이 생긴다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-sheet-tile-222']")!.click();
    host.querySelector("[data-testid='scratch-concept-thing-from-sheet']")!.click();
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const stamp = tileset.scratchConceptBundles![0]!.things.find((thing) => thing.objectId.startsWith("kit_"));
    expect(stamp).toBeTruthy();
    expect(tileset.structureKits?.some((kit) => kit.id === stamp?.objectId)).toBe(true);
  });

  it("그림 고치기는 카탈로그 침대를 내 킷으로 옮긴다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    host.querySelector("[data-testid='scratch-concept-claim-art']")!.click();
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const thing = tileset.scratchConceptBundles![0]!.things.find((entry) => entry.id === "bed_h");
    expect(thing?.objectId).toMatch(/^kit_/);
    expect(tileset.structureKits?.some((kit) => kit.id === thing?.objectId)).toBe(true);
  });

  it("마을 칩셋 피커에 내장 집 그림이 있다", () => {
    store.update((project) => {
      const tileset = project.tilesets[DEFAULT_TILESET_ID];
      if (tileset) tileset.scratchConceptBundles = [];
    });
    const host = renderOnTileset(DEFAULT_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-empty-add']")!.click();
    const placeId = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.scratchConceptBundles![0]!.places[0]!.id;
    host.querySelector(`[data-testid='scratch-concept-thing-add-${placeId}']`)!.click();
    expect(host.querySelector("[data-testid='scratch-concept-picker']")?.textContent).toMatch(/집|오두막|통나무/);
  });
});

describe("scratchConceptBundles 스키마", () => {
  it("여관 초안은 타일셋 검증을 통과하고 모르는 칩은 거절한다", () => {
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const valid = { ...tileset, scratchConceptBundles: [cloneConceptBundle(SCRATCH_INN_BUNDLE)] };
    expect(() => validateTileset(tileset.id, valid)).not.toThrow();
    const invalid = {
      ...valid,
      scratchConceptBundles: [{
        ...cloneConceptBundle(SCRATCH_INN_BUNDLE),
        things: [{
          id: "bed_h",
          label: "침대",
          objectId: "bed_h",
          placeIds: ["bedroom"],
          chips: ["king-size"],
        }],
      }],
    };
    expect(() => validateTileset(tileset.id, invalid)).toThrow(/unknown chip/);
  });
});
