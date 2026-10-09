// 맵 선택 영역 → 구조물(section 킷) 저장 경로.
// 순수 추출(structureKitFromMapRegion) → 스토어 등록(saveSelectionAsStructureKit) → 칩(구조물로 저장) 3층을 잠근다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { structureKitFromMapRegion } from "@/editor/harnessSuggestion/structureKitModel";
import { saveSelectionAsStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { renderSelectionActionChips } from "@/editor/selectionActionChips";
import type { TileSelection } from "@/editor/editorState";
import { store } from "@/project/store";
import { TILE } from "@/project/defaults";
import type { GameMap, StructureKitDef } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const MAP_ID = "map_blank_start";
const OWN_TILESET = "easyrpg_chipset_combined_town";
const OTHER_TILESET = "easyrpg_chipset_interior";

/** 3×2 구획: 하위는 전부 채우고, 상위는 둘째 행에만 그린다(상위 유무 분기 검증용). */
function paintFixture(): void {
  store.update((project) => {
    const map = project.maps[MAP_ID];
    if (!map) throw new Error(`fixture map missing: ${MAP_ID}`);
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const index = (4 + row) * map.width + (2 + column);
        map.lowerTiles[index] = 240 + column;
        map.upperTiles[index] = row === 1 ? 380 + column : TILE.EMPTY;
      }
    }
  });
}

function kitsOf(tilesetId: string): readonly StructureKitDef[] {
  return store.getCurrent().tilesets[tilesetId]?.structureKits ?? [];
}

describe("structureKitFromMapRegion — 맵 구획을 section 킷으로 추출(순수)", () => {
  const map = {
    id: "m",
    name: "m",
    width: 4,
    height: 3,
    tilesetId: OWN_TILESET,
    lowerTiles: [
      -1, -1, -1, -1,
      -1, 11, 12, -1,
      -1, 21, 22, -1,
    ],
    upperTiles: [
      -1, -1, -1, -1,
      -1, -1, -1, -1,
      -1, 91, -1, -1,
    ],
    events: [],
  } as unknown as GameMap;

  it("Given 그려진 구획, When 추출, Then 행렬·크기·출처가 킷에 담긴다", () => {
    const kit = structureKitFromMapRegion(map, { x: 1, y: 1, width: 2, height: 2 });
    expect(kit.kind).toBe("section");
    if (kit.kind !== "section") return;
    expect({ width: kit.width, height: kit.height }).toEqual({ width: 2, height: 2 });
    expect(kit.rows.map((row) => row.tiles)).toEqual([[11, 12], [21, 22]]);
    expect(kit.learnedFrom).toBe("user-paint");
    expect(kit.name).toBe("구조물 2×2");
  });

  it("Given 상위 레이어가 한 행에만 있음, When 추출, Then 그 행만 upperTiles를 가진다", () => {
    const kit = structureKitFromMapRegion(map, { x: 1, y: 1, width: 2, height: 2 });
    if (kit.kind !== "section") throw new Error("section 킷이어야 한다");
    expect(kit.rows[0]?.upperTiles).toBeUndefined();
    expect(kit.rows[1]?.upperTiles).toEqual([91, TILE.EMPTY]);
  });

  it("Given 이름 지정, When 추출, Then 지정 이름이 기본 이름을 덮는다", () => {
    const kit = structureKitFromMapRegion(map, { x: 1, y: 1, width: 2, height: 2 }, { name: "우물" });
    expect(kit.name).toBe("우물");
  });
});

describe("saveSelectionAsStructureKit — 현재 맵 타일셋에만 등록", () => {
  let restoreKits: () => void;
  beforeEach(() => {
    const before = new Map<string, StructureKitDef[] | undefined>(
      Object.values(store.getCurrent().tilesets).map((tileset) => [
        tileset.id,
        tileset.structureKits ? structuredClone(tileset.structureKits) : undefined,
      ]),
    );
    restoreKits = () => {
      store.update((project) => {
        for (const [tilesetId, kits] of before) {
          const tileset = project.tilesets[tilesetId];
          if (!tileset) continue;
          if (kits) tileset.structureKits = structuredClone(kits);
          else delete tileset.structureKits;
        }
      });
    };
    paintFixture();
  });
  afterEach(() => { restoreKits(); });

  it("Given 선택 영역, When 저장, Then 그 맵의 타일셋에만 킷이 생긴다", () => {
    const otherBefore = kitsOf(OTHER_TILESET).length;
    const saved = saveSelectionAsStructureKit({ mapId: MAP_ID, x: 2, y: 4, width: 3, height: 2 });

    expect(saved).not.toBeNull();
    const stored = kitsOf(OWN_TILESET).find((kit) => kit.id === saved?.id);
    expect(stored?.kind).toBe("section");
    if (stored?.kind !== "section") throw new Error("section 킷이어야 한다");
    expect(stored.rows.map((row) => row.tiles)).toEqual([[240, 241, 242], [240, 241, 242]]);
    expect(stored.rows[1]?.upperTiles).toEqual([380, 381, 382]);
    expect(stored.name).toBe("구조물 3×2");
    expect(kitsOf(OTHER_TILESET)).toHaveLength(otherBefore);
  });

  it("Given 없는 맵, When 저장, Then null이고 어떤 타일셋도 바뀌지 않는다", () => {
    const ownBefore = kitsOf(OWN_TILESET).length;
    expect(saveSelectionAsStructureKit({ mapId: "map_does_not_exist", x: 0, y: 0, width: 2, height: 2 })).toBeNull();
    expect(kitsOf(OWN_TILESET)).toHaveLength(ownBefore);
  });

  describe("구조물로 저장 칩", () => {
    let restoreDom: () => void;
    beforeEach(() => { restoreDom = installFakeDom(); });
    afterEach(() => { restoreDom(); });

    it("Given 선택 칩 바, When 구조물로 저장 클릭, Then 현재 맵 타일셋에 킷이 등록된다", () => {
      const selection: TileSelection = { mapId: MAP_ID, x: 2, y: 4, width: 3, height: 2 };
      const bar = renderSelectionActionChips(selection, (() => document.createElement("div")) as never);
      document.body.append(bar);
      const chip = findByTestId(document.body as unknown as FakeElement, "selection-chip-save-structure");
      expect(chip).toBeTruthy();
      expect(chip?.textContent).toBe("구조물로 저장");

      (chip as unknown as HTMLElement).click();

      const kit = kitsOf(OWN_TILESET).at(-1);
      expect(kit?.name).toBe("구조물 3×2");
      expect(kit?.kind === "section" ? kit.width : 0).toBe(3);
    });
  });
});
