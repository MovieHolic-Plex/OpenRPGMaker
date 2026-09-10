// test/regionChunkOverlayView.test.ts
// 캔버스 위 청크 도형 레이어의 DOM 계약.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { groupRegionChanges, withChunkLabels } from "@/editor/regionTask/regionChangeGroups";
import { createRegionSelectionProjection } from "@/editor/regionTask/regionSelectionProjection";
import {
  closeRegionChunkOverlay,
  isRegionChunkOverlayOpen,
  openRegionChunkOverlay,
  regionChunkOverlayLayer,
  repositionRegionChunkOverlay,
  setRegionChunkOverlayLayer,
} from "@/editor/regionTask/regionChunkOverlayView";
import type { MapId, Project, RegionRect } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

const REGION: RegionRect = { x: 0, y: 0, width: 4, height: 3 };

let restoreDom: (() => void) | null = null;

afterEach(() => {
  closeRegionChunkOverlay();
  restoreDom?.();
  restoreDom = null;
});

/** 캔버스 호스트를 만들어 둔다 — 없으면 레이어가 붙을 자리가 없다. */
function mountCanvasHost(): void {
  const container = new FakeElement("div");
  container.className = "phaser-container";
  (document.body as unknown as FakeElement).append(container as unknown as HTMLElement);
}

function setup() {
  const base = createBlankProject();
  const mapId: MapId = base.startMapId;
  const clipped: Project = structuredClone(base);
  const map = clipped.maps[mapId]!;
  const put = (x: number, y: number, lower?: number, upper?: number): void => {
    const index = (REGION.y + y) * map.width + (REGION.x + x);
    if (lower !== undefined) map.lowerTiles[index] = lower;
    if (upper !== undefined) map.upperTiles[index] = upper;
  };
  // 바닥 청크 둘(붙은 것 하나, 떨어진 것 하나) + 위 청크 하나
  put(0, 0, TILE.WATER);
  put(1, 0, TILE.WATER);
  put(3, 2, TILE.WATER);
  put(3, 0, undefined, TILE.TREE);

  const raw = groupRegionChanges(base, clipped, mapId, REGION);
  const tileset = base.tilesets[base.maps[mapId]!.tilesetId];
  const groups = withChunkLabels(raw, tileset);
  const chunks = [...groups.lower, ...groups.upper];
  const projection = createRegionSelectionProjection({ base, clipped, mapId, region: REGION, groups: raw });
  return { chunks, groups, projection, raw };
}

function shapeNode(id: string): FakeElement | null {
  return (document.body as unknown as FakeElement)
    .querySelector(`[data-testid="region-chunk-shape-${id}"]`);
}

describe("openRegionChunkOverlay", () => {
  it("캔버스 호스트가 없으면 열지 않는다 — 헤드리스에서 조용히 아무것도 안 한다", () => {
    restoreDom = installFakeDom();
    const { chunks, projection } = setup();

    openRegionChunkOverlay({
      region: REGION,
      chunks,
      projection,
      initialLayer: "lower",
      onSelectionChanged: () => {},
    });

    expect(isRegionChunkOverlayOpen()).toBe(false);
  });

  it("청크마다 도형 노드를 하나씩 만들고 role=checkbox 로 노출한다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    openRegionChunkOverlay({
      region: REGION,
      chunks,
      projection,
      initialLayer: "lower",
      onSelectionChanged: () => {},
    });

    expect(isRegionChunkOverlayOpen()).toBe(true);
    for (const chunk of chunks) {
      const node = shapeNode(chunk.id);
      expect(node, chunk.id).not.toBeNull();
      expect(node!.getAttribute("role")).toBe("checkbox");
      expect(node!.getAttribute("aria-checked")).toBe("true");
      // 체크박스가 주던 접근성 대체물 — 라벨과 위치말이 읽혀야 한다.
      expect(node!.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("도형을 누르면 투영에서 빠지고 aria-checked 가 뒤집히며 콜백이 온다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();
    const onSelectionChanged = vi.fn();

    openRegionChunkOverlay({ region: REGION, chunks, projection, initialLayer: "lower", onSelectionChanged });

    const target = groups.lower[0]!;
    shapeNode(target.id)!.click();

    expect(projection.selected().has(target.id)).toBe(false);
    expect(shapeNode(target.id)!.getAttribute("aria-checked")).toBe("false");
    expect(onSelectionChanged).toHaveBeenCalledTimes(1);

    // 다시 누르면 되돌아온다.
    shapeNode(target.id)!.click();
    expect(projection.selected().has(target.id)).toBe(true);
    expect(onSelectionChanged).toHaveBeenCalledTimes(2);
  });

  it("비활성 레이어 도형은 흐리고 만질 수 없다 — 두 레이어를 겹쳐 그리면 읽히지 않으므로", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();
    const onSelectionChanged = vi.fn();

    openRegionChunkOverlay({ region: REGION, chunks, projection, initialLayer: "lower", onSelectionChanged });

    const upper = groups.upper[0]!;
    const node = shapeNode(upper.id)!;
    expect(node.className).toContain("is-dim");
    expect(node.getAttribute("aria-disabled")).toBe("true");

    node.click();
    expect(projection.selected().has(upper.id)).toBe(true); // 그대로
    expect(onSelectionChanged).not.toHaveBeenCalled();
  });

  it("활성 레이어를 바꾸면 만질 수 있는 쪽이 뒤집힌다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    openRegionChunkOverlay({
      region: REGION, chunks, projection, initialLayer: "lower", onSelectionChanged: () => {},
    });
    expect(regionChunkOverlayLayer()).toBe("lower");

    setRegionChunkOverlayLayer("upper");
    expect(regionChunkOverlayLayer()).toBe("upper");

    const upper = groups.upper[0]!;
    const lower = groups.lower[0]!;
    expect(shapeNode(upper.id)!.className).not.toContain("is-dim");
    expect(shapeNode(lower.id)!.className).toContain("is-dim");

    shapeNode(upper.id)!.click();
    expect(projection.selected().has(upper.id)).toBe(false);
  });

  it("재배치는 노드를 다시 만들지 않는다 — 매 프레임 DOM 을 갈면 포인터가 다른 노드에 떨어진다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    openRegionChunkOverlay({
      region: REGION, chunks, projection, initialLayer: "lower", onSelectionChanged: () => {},
    });
    const before = shapeNode(groups.lower[0]!.id);

    repositionRegionChunkOverlay();

    expect(shapeNode(groups.lower[0]!.id)).toBe(before);
  });

  it("닫으면 레이어가 사라진다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    openRegionChunkOverlay({
      region: REGION, chunks, projection, initialLayer: "lower", onSelectionChanged: () => {},
    });
    expect(isRegionChunkOverlayOpen()).toBe(true);

    closeRegionChunkOverlay();

    expect(isRegionChunkOverlayOpen()).toBe(false);
    expect((document.body as unknown as FakeElement).querySelector('[data-testid="region-chunk-layer"]')).toBeNull();
  });
});
