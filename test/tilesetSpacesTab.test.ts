import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { INTERIOR_ROOM_THEME_CATALOG, INTERIOR_ROOM_THEMES, INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { renderTilesetSpacesTab, resetTilesetSpacesTabSession } from "@/editor/panels/tilesetSpacesTab";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetTilesetSpacesTabSession();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  resetTilesetSpacesTabSession();
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.interiorRoomKinds;
    }
  });
});

function renderOnTileset(tilesetId: string): FakeElement {
  const current = store.getCurrent();
  const mapId = Object.keys(current.maps)[0]!;
  editorState.set({ currentMapId: mapId });
  const host = new FakeElement("div");
  renderTilesetSpacesTab(host as unknown as HTMLElement, () => {});
  host.querySelector(`[data-testid='tileset-spaces-tileset-${tilesetId}']`)!.click();
  return host;
}

describe("tilesetSpacesTab 은 구조물 앨범이 아니다", () => {
  it("제목은 공간 종류이고 [+ 새 구조물]·원본 칩이 없다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='tileset-spaces-heading']")?.textContent).toBe("공간 종류");
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-source-all']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-source-interior']")).toBeNull();
    expect(host.querySelector("[data-testid='tileset-spaces-kind-add']")).not.toBeNull();
  });

  it("마을 칩셋은 침실·주방을 기본으로 얹지 않는다", () => {
    const host = renderOnTileset(DEFAULT_TILESET_ID);
    expect(host.querySelector("[data-testid='tileset-spaces-empty']")).not.toBeNull();
    expect(host.querySelector("[data-testid='tileset-spaces-kind-bedroom']")).toBeNull();
    expect(host.querySelector("[data-testid='tileset-spaces-seed-builtin']")).toBeNull();
    expect(store.getCurrent().tilesets[DEFAULT_TILESET_ID]?.interiorRoomKinds).toBeUndefined();
  });
});

describe("tilesetSpacesTab 실내 시드와 카드", () => {
  it("실내 칩셋은 기본 7종을 시드하고 카드를 그린다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    expect(INTERIOR_ROOM_THEMES.length).toBe(7);
    for (const theme of INTERIOR_ROOM_THEMES) {
      const card = host.querySelector(`[data-testid='tileset-spaces-kind-${theme}']`);
      expect(card, theme).not.toBeNull();
      expect(card!.textContent).toContain(INTERIOR_ROOM_THEME_CATALOG[theme].label);
    }
    expect(host.querySelectorAll(".structure-kit-theme-card").length).toBe(7);
    expect(store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]?.interiorRoomKinds).toHaveLength(7);

    for (const theme of ["storage", "corridor"] as const) {
      const card = host.querySelector(`[data-testid='tileset-spaces-kind-${theme}']`)!;
      expect(card.querySelector("canvas")).toBeNull();
      expect(card.textContent).toContain("필수 가구가 없는 공간입니다");
    }
  });

  it("침실 카드는 침대 역할 썸네일을, 선술집 카드는 탁자·카운터를 보여준다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);

    const bedroom = host.querySelector("[data-testid='tileset-spaces-kind-bedroom']")!;
    const bedSlot = bedroom.querySelector("[data-testid='tileset-spaces-kind-bedroom-role-bed']");
    expect(bedSlot).not.toBeNull();
    expect(bedSlot!.querySelector("canvas")).not.toBeNull();
    expect(bedroom.textContent).toContain("침대");

    const tavern = host.querySelector("[data-testid='tileset-spaces-kind-tavern']")!;
    expect(tavern.querySelector("[data-testid='tileset-spaces-kind-tavern-role-table']")?.querySelector("canvas")).not.toBeNull();
    expect(tavern.querySelector("[data-testid='tileset-spaces-kind-tavern-role-counter']")?.querySelector("canvas")).not.toBeNull();
    expect(tavern.textContent).toContain("탁자");
    expect(tavern.textContent).toContain("카운터");
    expect(tavern.textContent).toContain("소박함");
    expect(tavern.textContent).toContain("화려함");
  });

  it("카드를 고르면 그 공간의 인스펙터가 열리고 구조물 표는 없다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='tileset-spaces-kind-study']")!.click();

    expect(host.querySelector("[data-testid='tileset-spaces-inspector-study']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-object-bed_h']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-object-bookshelf']")).toBeNull();
    expect((host.querySelector("[data-testid='tileset-spaces-kind-label-study']") as unknown as HTMLInputElement).value).toBe("서재");
  });
});

describe("tilesetSpacesTab 저작", () => {
  it("이름을 고치면 타일셋 레코드가 바뀐다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='tileset-spaces-kind-bedroom']")!.click();
    const input = host.querySelector("[data-testid='tileset-spaces-kind-label-bedroom']") as unknown as HTMLInputElement;
    input.value = "큰 침실";
    input.dispatchEvent(new Event("change"));

    const kinds = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.interiorRoomKinds ?? [];
    expect(kinds.find((kind) => kind.id === "bedroom")?.label).toBe("큰 침실");
    expect(host.querySelector("[data-testid='tileset-spaces-kind-bedroom']")?.textContent).toContain("큰 침실");
  });

  it("역할 칩을 누르면 requiredRoles 가 토글된다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='tileset-spaces-kind-storage']")!.click();
    host.querySelector("[data-testid='tileset-spaces-role-chip-storage-stove']")!.click();

    const storage = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.interiorRoomKinds!.find((kind) => kind.id === "storage");
    expect(storage?.requiredRoles).toEqual(["stove"]);
  });

  it("[+ 공간 종류]가 빈 문법을 추가한다", () => {
    const host = renderOnTileset(DEFAULT_TILESET_ID);
    host.querySelector("[data-testid='tileset-spaces-empty-add']")!.click();

    const kinds = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.interiorRoomKinds ?? [];
    expect(kinds).toHaveLength(1);
    expect(kinds[0]!.label).toBe("새 공간");
    expect(host.querySelector("[data-testid='tileset-spaces-empty']")).toBeNull();
  });

  it("삭제는 그 공간 종류만 지운다", () => {
    const host = renderOnTileset(INTERIOR_ROOM_TILESET_ID);
    host.querySelector("[data-testid='tileset-spaces-kind-corridor']")!.click();
    host.querySelector("[data-testid='tileset-spaces-kind-delete-corridor']")!.click();

    const ids = (store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.interiorRoomKinds ?? []).map((kind) => kind.id);
    expect(ids).not.toContain("corridor");
    expect(ids).toHaveLength(6);
    expect(host.querySelector("[data-testid='tileset-spaces-kind-corridor']")).toBeNull();
  });
});
