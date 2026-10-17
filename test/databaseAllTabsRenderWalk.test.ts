// @vitest-environment happy-dom
// Phaser 4 는 모듈을 평가할 때 window 를 읽는다. installFakeDom 은 beforeEach 라 그 전에 못 닿는다.
// 캔버스 스텁은 database(→ Phaser) import 보다 먼저 평가되어야 한다.
import "./happyDomCanvas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab, TAB_GROUPS, type DatabaseTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { DATABASE_PRIMARY_SENTINELS } from "./databasePrimarySentinels";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  // 캐릭터 그래픽은 공용 목록 fetch 가 끝나기 전에는 로딩 문구만 그린다.
  // 끝나지 않는 요청으로 두면, 테스트가 DOM 을 되돌린 뒤 redraw 가 happy-dom 노드를 가짜 요소에 붙이지 않는다.
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("database all-tabs render walk", () => {
  it.each([
    "spatialTiles", "spatialObjects", "spatialSpaces", "spatialPlaces", "spatialRegions", "spatialWorlds",
  ] as const)("renders a destination-specific authoring surface when %s is selected", (tab) => {
    // Given: a blank project and a primary destination or the retained room editor.
    const root = document.createElement("div");
    setDatabaseActiveTab(tab);
    // When: the real database panel renders that primary.
    renderDatabasePanel(root);
    // Then: its specific destination contains the gallery and canvas, not an empty shell.
    const destination = root.querySelector(tab === "spatialSpaces" ? '[data-testid="spatial-shell-spaces"]' : DATABASE_PRIMARY_SENTINELS[tab]);
    expect(destination).not.toBeNull();
    if (tab === "spatialObjects") {
      expect(destination?.querySelector("[data-testid='spatial-browser-results']")).not.toBeNull();
      expect(destination?.querySelector(".asset-browser-detail")).not.toBeNull();
    } else if (tab === "spatialSpaces") {
      expect(destination?.querySelector("[data-testid='composition-board']") ?? destination?.querySelector("[data-testid='spatial-canvas']")).not.toBeNull();
    } else if (tab === "spatialTiles") {
      // 타일은 배치 셸이 아니라 타일셋 자료집이다.
      expect(destination?.getAttribute("data-testid") ?? destination?.dataset?.testid).toBe("tileset-db-search");
    } else {
      // 장소·지역·세계는 목록이 기본이고, 캔버스는 속성을 열기 전에는 접혀 있다.
      expect(destination?.querySelector("[data-testid='spatial-gallery']")).not.toBeNull();
    }
  }, 180_000);

  it("every registered tab renders a non-empty body without throwing", () => {
    const all: DatabaseTab[] = ["overview", ...TAB_GROUPS.flatMap((g) => g.tabs)];
    expect(all.length).toBeGreaterThanOrEqual(34);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(Object.keys(DATABASE_PRIMARY_SENTINELS)));
    const failures: string[] = [];
    for (const tab of all) {
      try {
        setDatabaseActiveTab(tab);
        const root = document.createElement("div");
        renderDatabasePanel(root);
        const body = root.querySelector(".db-body");
        if (!body || body.childNodes.length === 0) failures.push(`${tab}: empty body`);
        if (!body?.querySelector(DATABASE_PRIMARY_SENTINELS[tab])) failures.push(`${tab}: missing destination sentinel ${DATABASE_PRIMARY_SENTINELS[tab]}`);
      } catch (e) {
        failures.push(`${tab}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  }, 180_000);
});
