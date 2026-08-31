import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
  TILESET_FOLDER_TAB_IDS,
} from "@/editor/panels/database";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { getTilesetMetadataEditMode } from "@/editor/panels/tilesetMetadataEditor";
import { resetStructureKitsTabSession } from "@/editor/panels/structureKitDbTab";
import { resetTilesetSpacesTabSession } from "@/editor/panels/tilesetSpacesTab";
import { getSelectedTilesetId, setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    },
  });
  store.replace(createBlankProject());
  resetStructureKitsTabSession();
  resetTilesetSpacesTabSession();
  setDatabaseActiveTab("worldGen");
});

afterEach(() => {
  resetStructureKitsTabSession();
  resetTilesetSpacesTabSession();
  restoreDom?.();
  restoreDom = undefined;
});

function renderHost(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

describe("세계 → 타일셋 중간 카테고리", () => {
  it("폴더와 다섯 자식 탭이 레일에 있다", () => {
    const host = renderHost();
    expect(host.querySelector("[data-testid='db-tileset-folder']")?.textContent).toContain("타일셋");
    expect(host.querySelector("[data-testid='db-tab-tilesets']")?.textContent).toContain("통행");
    expect(host.querySelector("[data-testid='db-tab-tileset-autotile']")?.textContent).toContain("오토타일");
    expect(host.querySelector("[data-testid='db-tab-tileset-unlabeled']")?.textContent).toContain("미분류");
    expect(host.querySelector("[data-testid='db-tab-structure-kits']")?.textContent).toContain("구조물");
    expect(host.querySelector("[data-testid='db-tab-tileset-spaces']")?.textContent).toContain("공간 종류");
    expect(TILESET_FOLDER_TAB_IDS).toEqual([
      "tilesets",
      "tilesetAutotile",
      "tilesetUnlabeled",
      "structureKits",
      "tilesetSpaces",
    ]);
  });

  it("자식 탭은 folder-child 로 들여쓴다", () => {
    const host = renderHost();
    for (const testid of [
      "db-tab-tilesets",
      "db-tab-tileset-autotile",
      "db-tab-tileset-unlabeled",
      "db-tab-structure-kits",
      "db-tab-tileset-spaces",
    ]) {
      expect(host.querySelector(`[data-testid='${testid}']`)?.dataset.folderChild).toBe("1");
    }
  });

  it("공간 종류를 누르면 전용 워크스페이스가 열린다", () => {
    const host = renderHost();
    host.querySelector("[data-testid='db-tab-tileset-spaces']")!.click();
    expect(getDatabaseActiveTab()).toBe("tilesetSpaces");
    expect(host.querySelector("[data-testid='tileset-spaces-workspace']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-source-all']")).toBeNull();
  });

  it("오토타일 설정은 타일셋 워크스페이스를 autotile 모드로 연다", () => {
    const host = renderHost();
    host.querySelector("[data-testid='db-tab-tileset-autotile']")!.click();
    expect(getDatabaseActiveTab()).toBe("tilesetAutotile");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
  });

  it("폴더 버튼은 .db-tab 이 아니다 — 키보드 순서 계약은 자식 탭만 센다", () => {
    const host = renderHost();
    const folder = host.querySelector("[data-testid='db-tileset-folder']");
    expect(folder).not.toBeNull();
    expect(folder!.classList.contains("db-tab")).toBe(false);
    expect(folder!.classList.contains("db-tab-folder")).toBe(true);
  });

  it("공간 종류 면의 제목은 「공간 종류」다", () => {
    const host = renderHost();
    host.querySelector("[data-testid='db-tab-tileset-spaces']")!.click();
    expect(host.querySelector("[data-testid='tileset-spaces-heading']")?.textContent).toBe("공간 종류");
    expect(host.querySelector("[data-testid='structure-kit-heading']")).toBeNull();
  });

  it("통행에서 고른 칩셋이 구조물 앨범에도 이어진다", () => {
    setSelectedTileset(INTERIOR_ROOM_TILESET_ID);
    const host = renderHost();
    host.querySelector("[data-testid='db-tab-structure-kits']")!.click();
    expect(getSelectedTilesetId()).toBe(INTERIOR_ROOM_TILESET_ID);
    expect(
      host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`)?.classList.contains("active"),
    ).toBe(true);
  });
});
