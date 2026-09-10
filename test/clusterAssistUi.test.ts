// OPRN-OUT-017 — 두 보조가 화면에서도 **서로 다른 계약**으로 보이는가, 그리고 거부가
// 조용한 무동작이 아니라 누를 수 있는 복구 행동을 내놓는가.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clusterAssistCopy,
  clusterRecoveryOffer,
  presentClusterRecovery,
  toggleClusterAssistMode,
} from "@/editor/clusterAssistRecovery";
import { editorState } from "@/editor/editorState";
import { makeTileBrushAssistPanel } from "@/editor/panels/tilePalettePreviewPanel";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { paintTilesBulk, type TilePaintRejection } from "@/editor/tileActions";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { resetToastsForTest } from "@/util/toast";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreFakeDom: () => void;

function seed(): MapId {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 8;
  map.height = 8;
  map.lowerTiles = Array(64).fill(TILE.GRASS);
  map.upperTiles = Array(64).fill(TILE.EMPTY);
  map.events = [];
  project.startPos = { x: 0, y: 7 };
  store.replace(project);
  resetMapEditHistory();
  return project.startMapId;
}

function renderAssist(mapId: MapId) {
  const project = store.getCurrent();
  const map = project.maps[mapId]!;
  const state = editorState.get();
  return renderWithFakeDom(() =>
    makeTileBrushAssistPanel({
      autoConnectMode: state.autoConnectMode,
      clusterAssistMode: state.clusterAssistMode,
      mapId,
      onSelectTile: () => {},
      rerender: () => {},
      selectedTile: 290,
      tileset: project.tilesets[map.tilesetId]!,
    })
  );
}

beforeEach(() => {
  restoreFakeDom = installFakeDom();
  resetToastsForTest();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
  editorState.set({ autoConnectMode: false, clusterAssistMode: true });
});

afterEach(() => {
  resetToastsForTest();
  restoreFakeDom();
  editorState.set({ autoConnectMode: false, clusterAssistMode: true });
});

describe("이웃 연결과 구조 보조는 화면에서 따로 표현된다", () => {
  it("두 토글이 각자의 줄·testid·상태로 존재한다", () => {
    const mapId = seed();

    const panel = renderAssist(mapId);

    const neighbor = findByTestId(panel, "auto-connect-mode-toggle");
    const cluster = findByTestId(panel, "cluster-assist-mode-toggle");
    expect(neighbor).toBeTruthy();
    expect(cluster).toBeTruthy();
    expect(neighbor).not.toBe(cluster);
    // 이웃 연결 수동 + 구조 보조 켜짐 — 두 상태가 독립적으로 표시된다.
    expect(neighbor!.getAttribute("aria-pressed")).toBe("false");
    expect(cluster!.getAttribute("aria-pressed")).toBe("true");
  });

  it("이웃 연결 수동 설명이 구조물 짝 배치를 따로 가리킨다 — 하나가 둘을 끈다고 읽히지 않는다", () => {
    const mapId = seed();

    const title = findByTestId(renderAssist(mapId), "auto-connect-mode-toggle")!.getAttribute("title") ?? "";

    expect(title).toContain("지형 연결만");
    expect(title).toContain("구조 보조");
  });

  it("구조 보조 문구가 켜짐/꺼짐에서 서로 다른 계약을 말한다", () => {
    const on = clusterAssistCopy(true);
    const off = clusterAssistCopy(false);

    expect(on.chip).not.toBe(off.chip);
    expect(on.title).toContain("동반 칸까지");
    expect(off.title).toContain("고른 칸·레이어 하나만");
    // 정확 배치도 보호셀·남의 덧그림은 덮지 않는다는 사실이 문구에 남아야 한다.
    expect(off.title).toContain("보호셀");
  });

  it("구조 보조 토글은 이웃 연결 상태를 건드리지 않는다", () => {
    editorState.set({ autoConnectMode: true, clusterAssistMode: true });

    expect(toggleClusterAssistMode()).toBe(false);

    expect(editorState.get().clusterAssistMode).toBe(false);
    expect(editorState.get().autoConnectMode).toBe(true);
  });
});

describe("거부는 실행 가능한 복구 경로를 화면에 낸다", () => {
  it("경계 거부 토스트에 규칙 문장과 정확 배치 버튼이 함께 있고, 누르면 그 칸이 칠해진다", () => {
    const mapId = seed();
    const rejections: TilePaintRejection[] = [];
    paintTilesBulk(mapId, [{ layer: "lower", tile: 291, x: 4, y: 0 }], {
      autoConnect: false,
      onRejected: (rejection) => rejections.push(rejection),
    });
    expect(rejections).toHaveLength(1);

    presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

    const toastEl = document.querySelector<HTMLElement>('[data-testid="toast"]');
    expect(toastEl).toBeTruthy();
    expect(toastEl!.textContent).toContain("261");
    const button = document.querySelector<HTMLElement>('[data-testid="cluster-exact-place"]');
    expect(button).toBeTruthy();

    button!.click();

    const map = store.getCurrent().maps[mapId]!;
    expect(map.lowerTiles[0 * map.width + 4]).toBe(291);
  });

  it("복구 불가(보호셀 자체)일 때는 버튼 대신 다음에 할 일을 말한다", () => {
    const mapId = seed();
    store.update((project) => {
      project.startMapId = mapId;
      project.startPos = { x: 4, y: 4 };
    });
    const rejections: TilePaintRejection[] = [];
    paintTilesBulk(mapId, [{ layer: "lower", tile: 290, x: 4, y: 4 }], {
      autoConnect: false,
      exactPlacement: true,
      onRejected: (rejection) => rejections.push(rejection),
    });

    presentClusterRecovery(clusterRecoveryOffer(mapId, rejections[0]!));

    expect(document.querySelector('[data-testid="cluster-exact-place"]')).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-testid="toast"]')!.textContent).toContain("먼저 그 칸을 비우거나");
  });
});
