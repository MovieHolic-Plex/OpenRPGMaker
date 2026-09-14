// 회귀: 통행 화면에 보이는 탭 다섯 개(타일 규칙·타일 지식·구성 / 통행·지형)가 전부
// 클릭에 반응하지 않았다. database.ts 가 매 렌더마다 applyTilesetFolderFacet 을 불렀고
// 그 함수가 editMode 를 무조건 "passage" 로 되돌려서, setMode 가 자기가 부른 rerender 에
// 곧바로 덮였다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab, switchDatabaseActiveTab } from "@/editor/panels/database";
import {
  getTilesetMetadataEditMode,
  getTilesetSectionTab,
  setTilesetMetadataEditMode,
} from "@/editor/panels/tilesetMetadataEditor";
import { resetStructureKitsTabSession } from "@/editor/panels/structureKitDbTab";
import { resetTilesetSpacesTabSession } from "@/editor/panels/tilesetSpacesTab";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } },
  });
  store.replace(createBlankProject());
  resetStructureKitsTabSession();
  resetTilesetSpacesTabSession();
  setTilesetMetadataEditMode("passage", () => {});
  setDatabaseActiveTab("worldGen");
});

afterEach(() => {
  resetStructureKitsTabSession();
  resetTilesetSpacesTabSession();
  restoreDom?.();
  restoreDom = undefined;
});

function openPassageTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  document.body.append(host as unknown as Node);
  renderDatabasePanel(host as unknown as HTMLElement);
  host.querySelector("[data-testid='db-tab-spatial-tiles']")!.click();
  return host;
}

function click(host: FakeElement, testid: string): void {
  const node = host.querySelector(`[data-testid='${testid}']`);
  if (!node) throw new Error(`missing control: ${testid}`);
  node.click();
}

describe("타일셋 편집 모드 탭", () => {
  it("지형 모드 탭을 누르면 실제로 지형 모드가 된다", () => {
    const host = openPassageTab();
    expect(getTilesetMetadataEditMode()).toBe("passage");
    click(host, "tileset-edit-mode-terrain");
    expect(getTilesetMetadataEditMode()).toBe("terrain");
  });

  it("지형 모드는 이어지는 렌더에도 살아남는다", () => {
    const host = openPassageTab();
    click(host, "tileset-edit-mode-terrain");
    click(host, "tileset-edit-mode-terrain");
    expect(getTilesetMetadataEditMode()).toBe("terrain");
  });

  it("통행으로 되돌릴 수 있다", () => {
    const host = openPassageTab();
    click(host, "tileset-edit-mode-terrain");
    click(host, "tileset-edit-mode-passage");
    expect(getTilesetMetadataEditMode()).toBe("passage");
  });

  it("모드 탭의 aria-selected 가 실제 모드를 따라간다", () => {
    const host = openPassageTab();
    click(host, "tileset-edit-mode-terrain");
    expect(host.querySelector("[data-testid='tileset-edit-mode-terrain']")?.getAttribute("aria-selected")).toBe("true");
    expect(host.querySelector("[data-testid='tileset-edit-mode-passage']")?.getAttribute("aria-selected")).toBe("false");
  });
});

describe("one internal tileset section navigation", () => {
  it("tile descriptions change the mode without creating a secondary rail selection", () => {
    const host = openPassageTab();
    click(host, "tileset-section-tab-knowledge");
    expect(getTilesetSectionTab()).toBe("knowledge");
    expect(getTilesetMetadataEditMode()).toBe("ai");
    expect(getDatabaseActiveTab()).toBe("spatialTiles");
  });

  it("automatic connections change the mode within the primary workspace", () => {
    const host = openPassageTab();
    click(host, "tileset-section-tab-compose");
    expect(getTilesetSectionTab()).toBe("compose");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    expect(getDatabaseActiveTab()).toBe("spatialTiles");
  });

  it("returning to rules keeps the tileset primary selected", () => {
    const host = openPassageTab();
    click(host, "tileset-section-tab-compose");
    click(host, "tileset-section-tab-rules");
    expect(getTilesetSectionTab()).toBe("rules");
    expect(getDatabaseActiveTab()).toBe("spatialTiles");
  });

  it("legacy route requests still open the matching section", () => {
    const host = openPassageTab();
    expect(getTilesetSectionTab()).toBe("rules");
    switchDatabaseActiveTab("tilesetAutotile", host as unknown as HTMLElement);
    expect(getTilesetSectionTab()).toBe("compose");
    switchDatabaseActiveTab("tilesetUnlabeled", host as unknown as HTMLElement);
    expect(getTilesetSectionTab()).toBe("knowledge");
  });
});
