// 회귀: 통행 화면에 보이는 탭 다섯 개(타일 규칙·타일 지식·구성 / 통행·지형)가 전부
// 클릭에 반응하지 않았다. database.ts 가 매 렌더마다 applyTilesetFolderFacet 을 불렀고
// 그 함수가 editMode 를 무조건 "passage" 로 되돌려서, setMode 가 자기가 부른 rerender 에
// 곧바로 덮였다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import {
  getTilesetMetadataEditMode,
  getTilesetSectionTab,
  resetTilesetFolderFacet,
  setTilesetFolderTabRequestHandler,
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
  resetTilesetFolderFacet();
  setTilesetFolderTabRequestHandler(null);
  setDatabaseActiveTab("worldGen");
});

afterEach(() => {
  resetStructureKitsTabSession();
  resetTilesetSpacesTabSession();
  resetTilesetFolderFacet();
  setTilesetFolderTabRequestHandler(null);
  restoreDom?.();
  restoreDom = undefined;
});

function openPassageTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  document.body.append(host as unknown as Node);
  renderDatabasePanel(host as unknown as HTMLElement);
  host.querySelector("[data-testid='db-tab-tilesets']")!.click();
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

describe("타일셋 섹션 탭과 좌측 폴더 자식 탭", () => {
  it("타일 지식 섹션은 지식 모드 + 미분류 폴더 탭으로 함께 간다", () => {
    const host = openPassageTab();
    click(host, "tileset-section-tab-knowledge");
    expect(getTilesetSectionTab()).toBe("knowledge");
    expect(getTilesetMetadataEditMode()).toBe("ai");
    expect(getDatabaseActiveTab()).toBe("tilesetUnlabeled");
  });

  it("구성 섹션은 오토타일 모드 + 오토타일 폴더 탭으로 함께 간다", () => {
    const host = openPassageTab();
    click(host, "tileset-section-tab-compose");
    expect(getTilesetSectionTab()).toBe("compose");
    expect(getTilesetMetadataEditMode()).toBe("autotile");
    expect(getDatabaseActiveTab()).toBe("tilesetAutotile");
  });

  it("타일 규칙으로 돌아오면 통행 폴더 탭이 선택된다", () => {
    const host = openPassageTab();
    click(host, "tileset-section-tab-compose");
    click(host, "tileset-section-tab-rules");
    expect(getTilesetSectionTab()).toBe("rules");
    expect(getDatabaseActiveTab()).toBe("tilesets");
  });

  it("좌측 폴더 탭을 옮기면 섹션 탭도 따라온다", () => {
    const host = openPassageTab();
    expect(getTilesetSectionTab()).toBe("rules");
    click(host, "db-tab-tileset-autotile");
    expect(getTilesetSectionTab()).toBe("compose");
    click(host, "db-tab-tileset-unlabeled");
    expect(getTilesetSectionTab()).toBe("knowledge");
  });
});
