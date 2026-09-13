import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
  switchDatabaseActiveTab,
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

describe("Map primary workspaces and preserved legacy renderers", () => {
  it("mounts the primary workspaces without a folder", () => {
    const host = renderHost();
    expect(host.querySelector("[data-testid='db-tileset-folder']")).toBeNull();
    expect(host.querySelector("[data-testid='db-tab-spatial-tiles']")).not.toBeNull();
    expect(host.querySelector("[data-testid='db-tab-spatial-places']")).not.toBeNull();
  });

  it("primary entries are not indented folder children", () => {
    const host = renderHost();
    for (const testid of [
      "db-tab-spatial-tiles",
      "db-tab-spatial-places",
    ]) {
      expect(host.querySelector(`[data-testid='${testid}']`)?.dataset.folderChild).toBeUndefined();
    }
  });

  it("공간 종류를 누르면 전용 워크스페이스가 열린다", () => {
    const host = renderHost();
    switchDatabaseActiveTab("tilesetSpaces", host as unknown as HTMLElement);
    expect(getDatabaseActiveTab()).toBe("spatialSpaces");
    expect(host.querySelector("[data-testid='spatial-gallery']")).not.toBeNull();
    expect(host.querySelector("[data-testid='tileset-spaces-workspace']")).not.toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-new']")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-source-all']")).toBeNull();
  });

  it("오토타일 설정은 타일셋 워크스페이스를 autotile 모드로 연다", () => {
    const host = renderHost();
    switchDatabaseActiveTab("tilesetAutotile", host as unknown as HTMLElement);
    expect(getDatabaseActiveTab()).toBe("tilesetAutotile");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
  });

  it("context return buttons do not add primary keyboard rail entries", () => {
    const host = renderHost();
    switchDatabaseActiveTab("terrain", host as unknown as HTMLElement);
    const back = host.querySelector("[data-testid='db-context-back']");
    expect(back).not.toBeNull();
    expect(back!.classList.contains("db-tab")).toBe(false);
    expect(back!.tagName).toBe("BUTTON");
  });

  it("공간 종류 면의 제목은 「공간 종류」다", () => {
    const host = renderHost();
    switchDatabaseActiveTab("tilesetSpaces", host as unknown as HTMLElement);
    expect(getDatabaseActiveTab()).toBe("spatialSpaces");
    expect(host.querySelector("[data-testid='tileset-spaces-heading']")?.textContent).toBe("공간 종류");
    expect(host.querySelector("[data-testid='structure-kit-heading']")).toBeNull();
  });

  it("통행에서 고른 칩셋이 구조물 앨범에도 이어진다", () => {
    setSelectedTileset(INTERIOR_ROOM_TILESET_ID);
    const host = renderHost();
    switchDatabaseActiveTab("structureKits", host as unknown as HTMLElement);
    expect(getDatabaseActiveTab()).toBe("spatialObjects");
    expect(getSelectedTilesetId()).toBe(INTERIOR_ROOM_TILESET_ID);
    expect(host.querySelector("[data-testid='spatial-gallery']")).not.toBeNull();
  });
});
