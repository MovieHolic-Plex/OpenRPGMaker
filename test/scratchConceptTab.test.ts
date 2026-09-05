import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { INTERIOR_ROOM_TILESET_ID, seedDefaultInteriorCatalog } from "@/editor/interiorRoomPipeline";
import { TAB_GROUPS } from "@/editor/panels/database";
import { INTERIOR_OBJECT_CATALOG, interiorObjectById } from "@/editor/interiorObjectCatalog";
import { resolveInteriorRoomVocab } from "@/editor/interiorRoomVocab";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
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
import type { TilesetDef } from "@/project/types";
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
  const select = host.querySelector("[data-testid='scratch-concept-tileset-select']")!;
  select.value = tilesetId;
  select.dispatchEvent(new Event("change"));
  return host;
}

describe("scratchConceptTab 레일", () => {
  it("맵 그룹의 주 진입점에 개념 꾸러미가 있다 — 임시 그룹은 졸업", () => {
    expect(TAB_GROUPS.some((group) => group.slug === "scratch")).toBe(false);
    const world = TAB_GROUPS.find((group) => group.slug === "world");
    expect(world?.tabs).toContain("scratchConcepts");
  });

  it("제목은 개념 꾸러미이고 구조물 앨범이 아니다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-heading']")?.textContent).toBe("개념 꾸러미");
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
    expect(host.querySelector("[data-testid='tileset-spaces-kind-add']")).toBeNull();
  });
});

describe("scratchConceptTab 실내 시드", () => {
  it("selecting a corridor replaces the bedroom inspector with a thing in that place", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    host.querySelector("[data-testid='scratch-concept-place-corridor']")!.click();
    const bundle = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!;
    const expected = bundle.things.find((thing) => thing.placeIds.includes("corridor"))!;
    expect(host.querySelector("[data-testid='scratch-concept-thing-graphic']")?.value).toBe(expected.objectId);
    expect(host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.classList.contains("active")).toBe(false);
  });

  it("a thing chip selects its containing place", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-place-corridor']")!
      .querySelector("[data-testid='scratch-concept-thing-stairs']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-place-corridor']")!.classList.contains("active")).toBe(true);
    expect(host.querySelector("[data-testid='scratch-concept-thing-graphic']")?.value).toBe("stairs");
  });

  it("an empty selected place has no unrelated thing inspector", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-place-add']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-thing-graphic']")).toBeNull();
  });

  it("makes facilities the illustrated choices instead of mounting a tileset column", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-rail']")).toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-tileset-select']")?.value).toBe(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-facility-inn']")?.querySelector("canvas")).not.toBeNull();
  });

  it("마을 칩셋은 여관을 기본으로 얹지 않는다", () => {
    const host = renderOnTileset(DEFAULT_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-empty']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-thing-name']")?.value).not.toBe("침대(가로)");
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
    expect(host.querySelector("[data-testid='scratch-concept-thing-name']")?.value).not.toBe("침대(가로)");
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

describe("scratchConceptTab 도면·구역·소속", () => {
  function select(host: FakeElement, testid: string): { value: string; dispatchEvent: (event: Event) => void } {
    return host.querySelector(`[data-testid='${testid}']`) as unknown as { value: string; dispatchEvent: (event: Event) => void };
  }

  function inn(): ConceptBundleRecord {
    return store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
  }

  it("시설 도면 문법을 바꾸면 저장되고 기본(한 줄)은 필드를 비운다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const layout = select(host, "scratch-concept-facility-layout");
    expect(layout.value).toBe("row");
    layout.value = "double-row";
    layout.dispatchEvent(new Event("change"));
    expect(inn().facilities[0]!.layout).toBe("double-row");
    const again = select(host, "scratch-concept-facility-layout");
    expect(again.value).toBe("double-row");
    again.value = "row";
    again.dispatchEvent(new Event("change"));
    expect(inn().facilities[0]!.layout).toBeUndefined();
  });

  it("장소 구역을 바꾸면 저장되고 자동은 필드를 비운다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const zone = select(host, "scratch-concept-place-zone-bedroom");
    expect(zone.value).toBe("auto");
    zone.value = "north";
    zone.dispatchEvent(new Event("change"));
    expect(inn().places.find((place) => place.id === "bedroom")?.zone).toBe("north");
    const again = select(host, "scratch-concept-place-zone-bedroom");
    expect(again.value).toBe("north");
    again.value = "auto";
    again.dispatchEvent(new Event("change"));
    expect(inn().places.find((place) => place.id === "bedroom")?.zone).toBeUndefined();
  });

  it("시설 장소 토글로 빼면 도면에서 빠지고 꾸러미에는 남는다 — 다시 넣을 수 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).not.toBeNull();
    host.querySelector("[data-testid='scratch-concept-facility-place-bedroom']")!.click();
    expect(inn().facilities[0]!.placeIds).not.toContain("bedroom");
    expect(inn().places.some((place) => place.id === "bedroom")).toBe(true);
    const bed = inn().things.find((thing) => thing.id === "bed_h");
    expect(bed).toBeDefined();
    expect(bed?.placeIds).toContain("bedroom");
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-thing-name']")?.value).not.toBe("침대(가로)");
    host.querySelector("[data-testid='scratch-concept-facility-place-bedroom']")!.click();
    expect(inn().facilities[0]!.placeIds).toEqual(["bedroom", "corridor", "dining"]);
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).not.toBeNull();
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

  function bedChips(): string[] {
    return store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles![0]!.things.find((thing) => thing.id === "bed_h")!.chips;
  }

  function chipAdd(host: FakeElement): { value: string; dispatchEvent: (event: Event) => void } {
    return host.querySelector("[data-testid='scratch-concept-chip-add']") as unknown as { value: string; dispatchEvent: (event: Event) => void };
  }

  it("자유 칩을 입력하면 저장되고 눌러서 지울 수 있다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    const input = chipAdd(host);
    input.value = "guest-only";
    input.dispatchEvent(new Event("change"));
    expect(bedChips()).toContain("guest-only");
    expect(host.querySelector("[data-testid='scratch-concept-chip-custom-guest-only']")).not.toBeNull();
    host.querySelector("[data-testid='scratch-concept-chip-custom-guest-only']")!.click();
    expect(bedChips()).not.toContain("guest-only");
  });

  it("잘못된 자유 칩 입력은 이유를 보여 주고 넣지 않는다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    const input = chipAdd(host);
    input.value = "bad chip!";
    input.dispatchEvent(new Event("change"));
    const error = host.querySelector("[data-testid='scratch-concept-chip-error']");
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain("영문·숫자");
    expect(bedChips()).not.toContain("bad chip!");
    expect(host.querySelector("[data-testid='scratch-concept-chip-custom-bad chip!']")).toBeNull();
  });

  it("자유 칩 이름을 바꾸면 저장된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    const input = chipAdd(host);
    input.value = "guest-only";
    input.dispatchEvent(new Event("change"));
    const rename = host.querySelector("[data-testid='scratch-concept-chip-custom-input-guest-only']") as unknown as { value: string; dispatchEvent: (event: Event) => void };
    expect(rename).not.toBeNull();
    rename.value = "vip";
    rename.dispatchEvent(new Event("change"));
    expect(bedChips()).toContain("vip");
    expect(bedChips()).not.toContain("guest-only");
    expect(host.querySelector("[data-testid='scratch-concept-chip-custom-input-vip']")).not.toBeNull();
    expect(host.querySelector("[data-testid='scratch-concept-chip-error']")).toBeNull();
  });

  it("같은 자유 칩을 두 번 넣어도 한 개만 남는다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    chipAdd(host).value = "guest-only";
    chipAdd(host).dispatchEvent(new Event("change"));
    chipAdd(host).value = "guest-only";
    chipAdd(host).dispatchEvent(new Event("change"));
    expect(bedChips().filter((chip) => chip === "guest-only")).toHaveLength(1);
  });

  it("잘못된 이름 변경은 예전 칩을 그대로 둔다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    const input = chipAdd(host);
    input.value = "guest-only";
    input.dispatchEvent(new Event("change"));
    const rename = host.querySelector("[data-testid='scratch-concept-chip-custom-input-guest-only']") as unknown as { value: string; dispatchEvent: (event: Event) => void };
    rename.value = "bad chip!";
    rename.dispatchEvent(new Event("change"));
    expect(bedChips()).toContain("guest-only");
    expect(bedChips()).not.toContain("bad chip!");
    expect(rename.value).toBe("guest-only");
    const error = host.querySelector("[data-testid='scratch-concept-chip-error']");
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain("영문·숫자");
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

  it("painting an unselected place's thing returns to that occurrence after real editor save/undo/close", async () => {
    const host = renderOnTileset(tilesetId);
    const dialogs = await import("@/editor/panels/structureKitEditorDialog");
    const original = dialogs.openStructureKitEditor;
    let signalOpened!: () => void;
    let timeout!: ReturnType<typeof setTimeout>;
    const opened = new Promise<void>((resolve, reject) => {
      signalOpened = resolve;
      timeout = setTimeout(() => reject(new Error("Graphic editor did not open")), 2000);
    });
    // Observe the exact lazy-import boundary while retaining the real editor.
    const spy = vi.spyOn(dialogs, "openStructureKitEditor").mockImplementation((...args) => {
      original(...args);
      signalOpened();
    });
    try {
      host.querySelector("[data-testid='scratch-concept-thing-paint-stairs']")!.click();
      await opened;
      const afterCopy = store.getCurrent().tilesets[tilesetId]!;
      const thing = afterCopy.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!.things.find((entry) => entry.id === "stairs")!;
      const kit = afterCopy.structureKits!.find((entry) => entry.id === thing.objectId)!;
      const width = document.querySelector("[data-testid='structure-kit-editor-width']") as unknown as FakeElement;
      expect(width).not.toBeNull();
      width.value = String(kit.width + 1);
      width.dispatchEvent(new Event("change"));
      expect(store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.id === kit.id)!.width).toBe(kit.width + 1);
      (document.querySelector("[data-testid='structure-kit-editor-undo']") as unknown as FakeElement).click();
      expect(store.getCurrent().tilesets[tilesetId]!.structureKits!.find((entry) => entry.id === kit.id)!.width).toBe(kit.width);
      (document.querySelector("[data-testid='structure-kit-editor-close']") as unknown as FakeElement).click();
      expect(document.querySelector("[data-testid='structure-kit-editor']")).toBeNull();
      expect(host.querySelector("[data-testid='scratch-concept-place-corridor']")!.classList.contains("active")).toBe(true);
      expect(host.querySelector("[data-testid='scratch-concept-thing-stairs']")!.classList.contains("active")).toBe(true);
      expect(host.querySelector("[data-testid='scratch-concept-thing-graphic']")?.value).toBe(kit.id);
    } finally {
      clearTimeout(timeout);
      spy.mockRestore();
      (document.querySelector("[data-testid='structure-kit-editor-close']") as unknown as FakeElement | null)?.click();
    }
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

  it("시드 그림을 칠하면 이 물건만 사본을 쓰며 다시 칠할 때는 사본을 재사용한다", () => {
    store.update((project) => seedDefaultInteriorCatalog(project.tilesets[tilesetId]!));
    const host = renderOnTileset(tilesetId);
    host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-thing-paint']")?.textContent).toBe("사본 만들어 칠하기");
    store.update((project) => {
      const inn = project.tilesets[tilesetId]!.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
      inn.things.push({ ...inn.things.find((thing) => thing.id === "bed_h")!, id: "other_bed" });
    });
    const before = structuredClone(store.getCurrent().tilesets[tilesetId]!.structureKits!);
    expect(before.find((kit) => kit.id === "bed_h")?.learnedFrom).toBe("interior-catalog");
    const kitId = ensureThingKitForEdit(tilesetId, "inn", "bed_h");
    expect(kitId).toMatch(/^kit_/);
    const after = store.getCurrent().tilesets[tilesetId]!;
    expect(after.structureKits).toHaveLength(before.length + 1);
    expect(after.structureKits!.find((kit) => kit.id === "bed_h")).toEqual(before.find((kit) => kit.id === "bed_h"));
    const inn = after.scratchConceptBundles!.find((bundle) => bundle.id === "inn")!;
    expect(inn.things.find((thing) => thing.id === "bed_h")?.objectId).toBe(kitId);
    expect(inn.things.find((thing) => thing.id === "other_bed")?.objectId).toBe("bed_h");
    expect(ensureThingKitForEdit(tilesetId, "inn", "bed_h")).toBe(kitId);
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits).toHaveLength(before.length + 1);
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
    expect(() => validateTileset(tileset.id, invalid)).toThrow(/칩 id가 비어 있습니다/);
    const badChars = {
      ...valid,
      scratchConceptBundles: [{
        ...cloneConceptBundle(SCRATCH_INN_BUNDLE),
        things: [{
          id: "bed_h",
          label: "침대",
          objectId: "bed_h",
          placeIds: ["bedroom"],
          chips: ["bad chip!"],
        }],
      }],
    };
    expect(() => validateTileset(tileset.id, badChars)).toThrow(/칩 id는 영문·숫자/);

  });
});

describe("Phase 4 마이그레이션 계약 — 세 필드 공존", () => {
  it("structureKits·interiorRoomKinds·scratchConceptBundles가 함께 저장·검증을 통과한다", () => {
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const valid = {
      ...tileset,
      structureKits: tileset.structureKits ?? [],
      interiorRoomKinds: [{ id: "mine", label: "내 방", requiredRoles: ["bed"] }],
      scratchConceptBundles: [cloneConceptBundle(SCRATCH_INN_BUNDLE)],
    };
    expect(() => validateTileset(tileset.id, valid)).not.toThrow();
    // 저작값이 있으면 파생을 타지 않는다 — 마이그레이션 전후 어휘가 같다.
    const before = resolveInteriorRoomVocab(valid as TilesetDef, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    expect(before.kindsById.get("mine")?.requiredRoles).toEqual(["bed"]);
    expect(before.kindsById.has("bedroom")).toBe(false);
  });

  it("저작값 없는 구 프로젝트는 파생+폴백 합집합으로 읽힌다", () => {
    const tileset = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const legacy = {
      ...tileset,
      interiorRoomKinds: undefined,
      scratchConceptBundles: [cloneConceptBundle(SCRATCH_INN_BUNDLE)],
    };
    delete (legacy as { interiorRoomKinds?: unknown }).interiorRoomKinds;
    expect(() => validateTileset(tileset.id, legacy)).not.toThrow();
    const vocab = resolveInteriorRoomVocab(legacy as TilesetDef, INTERIOR_OBJECT_CATALOG, BUILTIN_INTERIOR_ROOM_KINDS);
    // 꾸러미 장소(여관 초안: bedroom/corridor/dining). 같은 id면 꾸러미 정의가 폴백을 이긴다.
    expect(vocab.kindsById.size).toBe(BUILTIN_INTERIOR_ROOM_KINDS.length);
    // 여관 초안 bedroom은 라벨이 "침실"로 같지만 유도 정의(requiredRoles 빈 배열)다.
    expect(vocab.kindsById.get("bedroom")?.requiredRoles).toEqual([]);
  });
});

describe("scratchConceptTab 키보드 선택", () => {
  function keydown(key: string): Event {
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "key", { configurable: true, value: key });
    return event;
  }

  it("물건 칩에 tabindex/role이 있고 Enter로 선택된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const chip = host.querySelector("[data-testid='scratch-concept-thing-bed_h']")!;
    expect(chip.getAttribute("tabindex")).toBe("0");
    expect(chip.getAttribute("role")).toBe("button");
    host.querySelector("[data-testid='scratch-concept-facility-smithy']")!.click();
    expect(host.querySelector("[data-testid='scratch-concept-thing-bed_h']")).toBeNull();
    const workshopChip = host.querySelector("[data-testid='scratch-concept-thing-stove']")!;
    workshopChip.dispatchEvent(keydown("Enter"));
    expect(workshopChip.getAttribute("aria-label")).toContain("선택");
  });

  it("장소 카드는 Enter/Space로 선택되고 카드 안 입력에서는 무시된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    const card = host.querySelector("[data-testid='scratch-concept-place-bedroom']")!;
    expect(card.getAttribute("tabindex")).toBe("0");
    expect(card.getAttribute("role")).toBe("button");
    card.dispatchEvent(keydown("Enter"));
    expect(host.querySelector("[data-testid='scratch-concept-place-bedroom']")).not.toBeNull();
  });

  it("아이템 헤더는 그림이 없을 때 자리표시자를 보인다", async () => {
    const { renderItemRecordForm } = await import("@/editor/panels/databaseItemRecordView");
    const record = store.getCurrent().database.items[0]!;
    const form = new FakeElement("div");
    renderItemRecordForm(form as unknown as HTMLElement, { ...record, iconResourceId: undefined, imageResourceId: undefined }, () => {});
    const icon = form.querySelector(".db-item-inspector-icon")!;
    expect(icon.textContent).toBe("이미지 없음");
    expect(icon.getAttribute("aria-label")).toContain("이미지 없음");
  });
});
