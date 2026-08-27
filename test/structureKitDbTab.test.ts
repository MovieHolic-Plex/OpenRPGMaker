import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderStructureKitsTab, resetStructureKitsTabSession } from "@/editor/panels/structureKitDbTab";
import { registerStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { StructureKitDef } from "@/project/types";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetStructureKitsTabSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  resetStructureKitsTabSession();
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.structureKits;
    }
  });
});

function createTestSectionKit(id: string, name: string, parts?: StructureKitDef["parts"]): StructureKitDef {
  return {
    id,
    kind: "section",
    name,
    width: 3,
    height: 3,
    rows: [
      { tiles: [240, 240, 240], upperTiles: [0, 0, 0] },
      { tiles: [240, 116, 240], upperTiles: [0, 0, 0] },
      { tiles: [240, 240, 240], upperTiles: [0, 0, 0] },
    ],
    parts,
    learnedFrom: "user-paint",
  };
}

describe("structureKitDbTab album UI contract", () => {
  it("renders tileset rail as an album and defaults to current map tileset", () => {
    const current = store.getCurrent();
    const tilesetIds = Object.keys(current.tilesets);
    const mapId = Object.keys(current.maps)[0]!;
    const mapTilesetId = current.maps[mapId]!.tilesetId;
    const otherTilesetId = tilesetIds.find((id) => id !== mapTilesetId)!;

    registerStructureKit(mapTilesetId, createTestSectionKit("kit_t1_1", "타일셋1 구조물 1"));
    registerStructureKit(otherTilesetId, createTestSectionKit("kit_t2_1", "타일셋2 구조물 1"));
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    const heading = host.querySelector("[data-testid='structure-kit-heading']");
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain("구조물");
    expect(heading!.textContent).not.toContain("스탬프");

    const rail = host.querySelector("[data-testid='structure-kit-album-rail']");
    expect(rail).not.toBeNull();

    expect(host.querySelector("[data-testid='structure-kit-db-kit_t1_1']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-db-kit_t2_1']")).toBeNull();
    expect(host.textContent).toContain("타일셋1 구조물 1");
    expect(host.textContent).not.toContain("타일셋2 구조물 1");
  });

  it("shows exact empty copy when active tileset has 0 kits", () => {
    const current = store.getCurrent();
    const tilesetIds = Object.keys(current.tilesets);
    const mapId = Object.keys(current.maps)[0]!;
    const mapTilesetId = current.maps[mapId]!.tilesetId;
    const emptyTilesetId = tilesetIds.find((id) => id !== mapTilesetId)!;
    registerStructureKit(mapTilesetId, createTestSectionKit("kit_t1_1", "마을 구조물"));
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    const targetRailItem = host.querySelector(`[data-testid='structure-kit-tileset-${emptyTilesetId}']`);
    expect(targetRailItem).not.toBeNull();
    targetRailItem?.click();

    expect(host.textContent).toContain("이 타일셋에는 아직 구조물이 없습니다.");
  });

  it("renders inspector with name, parts list with instance numbers, 문에서 입구 추정, 지금 저장, 팔레트에서 쓰기, 삭제", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    const firstTilesetId = current.maps[mapId]!.tilesetId;
    editorState.set({ currentMapId: mapId });

    const kitWithParts = createTestSectionKit("kit_inspector", "돌집 · 남쪽 현관", [
      { id: "p1", kind: "entrance", dx: 1, dy: 1, w: 1, h: 2, note: "워프는 앞칸" },
      { id: "p2", kind: "window", dx: 0, dy: 1, w: 1, h: 1 },
      { id: "p3", kind: "window", dx: 2, dy: 1, w: 1, h: 1 },
    ]);
    registerStructureKit(firstTilesetId, kitWithParts);

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    // 기본 선택이 내장 킷이므로, 등록 킷 행을 직접 선택한다.
    const kitRow = host.querySelector(`[data-testid='structure-kit-db-${kitWithParts.id}']`);
    expect(kitRow).not.toBeNull();
    kitRow!.click();

    const inspector = host.querySelector(".structure-kit-inspector") ?? host.querySelector(".inspector");
    expect(inspector).not.toBeNull();

    const nameInput = host.querySelector(`[data-testid='structure-kit-db-name-${kitWithParts.id}']`);
    expect(nameInput).not.toBeNull();

    expect(inspector?.textContent).toContain("입구");
    expect(inspector?.textContent).toContain("창문");

    const estimateEntranceBtn = host.querySelector("[data-testid='structure-kit-estimate-entrance']");
    expect(estimateEntranceBtn).not.toBeNull();
    expect(estimateEntranceBtn?.textContent).toContain("문에서 입구 추정");

    const saveNowBtn = host.querySelector("[data-testid='structure-kit-save-now']");
    expect(saveNowBtn).not.toBeNull();
    expect(saveNowBtn?.textContent).toContain("지금 저장");

    const useInPaletteBtn = host.querySelector(`[data-testid='structure-kit-db-use-${kitWithParts.id}']`);
    expect(useInPaletteBtn).not.toBeNull();
    expect(useInPaletteBtn?.textContent).toContain("팔레트에서 쓰기");

    const deleteBtn = host.querySelector(`[data-testid='structure-kit-db-delete-${kitWithParts.id}']`);
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toContain("삭제");
  });
});

describe("structureKitDbTab 내장 파라메트릭 킷 노출", () => {
  it("combined_town 앨범에 내장 킷 행(kit_house_blue-stone)이 표시된다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    expect(current.maps[mapId]!.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")).not.toBeNull();
  });

  it("combined_town 레일 항목의 킷 수는 6 이상이다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    const railItem = host.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`);
    expect(railItem).not.toBeNull();
    const count = Number.parseInt(railItem!.textContent.match(/(\d+)\s*$/)![1]!, 10);
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it("내장·등록 킷이 모두 없는 타일셋은 정확한 빈 상태 카피를 던지지 않고 렌더링한다", () => {
    const current = store.getCurrent();
    const tilesetIds = Object.keys(current.tilesets);
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    const emptyTilesetId = tilesetIds.find((id) => id !== DEFAULT_TILESET_ID)!;

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    const railItem = host.querySelector(`[data-testid='structure-kit-tileset-${emptyTilesetId}']`);
    expect(railItem).not.toBeNull();
    expect(() => railItem!.click()).not.toThrow();

    const empty = host.querySelector("[data-testid='structure-kit-db-empty']");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain("이 타일셋에는 아직 구조물이 없습니다.");
  });

  it("rows가 비거나 크기가 0인 등록 킷도 렌더링 시 던지지 않는다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    registerStructureKit(DEFAULT_TILESET_ID, {
      id: "kit_malformed",
      kind: "section",
      name: "깨진 킷",
      width: 0,
      height: 0,
      rows: [],
      learnedFrom: "user-paint",
    });

    const host = new FakeElement("div");
    expect(() => renderStructureKitsTab(host, () => {})).not.toThrow();
    expect(host.querySelector("[data-testid='structure-kit-db-kit_malformed']")).not.toBeNull();
  });

  it("내장 킷 인스펙터에는 삭제 버튼이 없고 등록 킷에는 있다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_registered", "등록 킷"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    // 내장 킷 선택
    const builtinRow = host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']");
    expect(builtinRow).not.toBeNull();
    builtinRow!.click();
    expect(host.querySelector("[data-testid='structure-kit-inspector-kit_house_blue-stone']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-db-delete-kit_house_blue-stone']")).toBeNull();

    // 등록 킷 선택
    const registeredRow = host.querySelector("[data-testid='structure-kit-db-kit_registered']");
    expect(registeredRow).not.toBeNull();
    registeredRow!.click();
    expect(host.querySelector("[data-testid='structure-kit-inspector-kit_registered']")).not.toBeNull();
    const registeredDelete = host.querySelector("[data-testid='structure-kit-db-delete-kit_registered']");
    expect(registeredDelete).not.toBeNull();
    expect(registeredDelete!.textContent).toContain("삭제");
  });
});
