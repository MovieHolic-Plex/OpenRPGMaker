// test/regionChunkOverlayView.test.ts
// 캔버스 위 청크 도형 레이어 + 검토 액션 바의 DOM 계약.
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
  type RegionChunkOverlayConfig,
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

type Overrides = Partial<RegionChunkOverlayConfig>
  & Pick<RegionChunkOverlayConfig, "chunks" | "projection">;

function open(over: Overrides): void {
  openRegionChunkOverlay({
    region: REGION,
    initialLayer: "lower",
    // ⚠ 화면에 보이는 총 칸수는 pending.changedCells 다(청크 합산은 레이어 이중계산).
    changedCells: 42,
    onSelectionChanged: () => {},
    onApply: () => {},
    onRetry: () => {},
    onDiscard: () => {},
    ...over,
  });
}

const body = (): FakeElement => document.body as unknown as FakeElement;
const byTestId = (id: string): FakeElement | null => body().querySelector(`[data-testid="${id}"]`);
const shapeNode = (id: string): FakeElement | null => byTestId(`region-chunk-shape-${id}`);

describe("openRegionChunkOverlay", () => {
  it("캔버스 호스트가 없으면 열지 않는다 — 헤드리스에서 조용히 아무것도 안 한다", () => {
    restoreDom = installFakeDom();
    const { chunks, projection } = setup();

    open({ chunks, projection });

    expect(isRegionChunkOverlayOpen()).toBe(false);
    expect(byTestId("region-review-bar")).toBeNull();
  });

  it("청크마다 도형 노드를 하나씩 만들고 role=checkbox 로 노출한다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    open({ chunks, projection });

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

  it("셀마다 히트 영역을 따로 둔다 — 1칸 청크(16px)를 누를 수 있어야 한다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    open({ chunks, projection });

    const single = groups.lower.find((c) => c.cells.length === 1)!;
    const node = shapeNode(single.id)!;
    expect(node.querySelectorAll(".region-chunk-cell")).toHaveLength(1);
    expect(node.querySelectorAll(".region-chunk-hit")).toHaveLength(1);
  });

  it("도형을 누르면 투영에서 빠지고 aria-checked 가 뒤집히며 콜백이 온다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();
    const onSelectionChanged = vi.fn();

    open({ chunks, projection, onSelectionChanged });

    const target = groups.lower[0]!;
    shapeNode(target.id)!.click();

    expect(projection.selected().has(target.id)).toBe(false);
    expect(shapeNode(target.id)!.getAttribute("aria-checked")).toBe("false");
    expect(onSelectionChanged).toHaveBeenCalledTimes(1);

    shapeNode(target.id)!.click();
    expect(projection.selected().has(target.id)).toBe(true);
    expect(onSelectionChanged).toHaveBeenCalledTimes(2);
  });

  it("비활성 레이어 도형은 흐리고 만질 수 없다 — 두 레이어를 겹쳐 그리면 읽히지 않으므로", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();
    const onSelectionChanged = vi.fn();

    open({ chunks, projection, onSelectionChanged });

    const upper = groups.upper[0]!;
    const node = shapeNode(upper.id)!;
    expect(node.className).toContain("is-dim");
    expect(node.getAttribute("aria-disabled")).toBe("true");

    node.click();
    expect(projection.selected().has(upper.id)).toBe(true);
    expect(onSelectionChanged).not.toHaveBeenCalled();
  });

  it("활성 레이어를 바꾸면 만질 수 있는 쪽이 뒤집힌다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    open({ chunks, projection });
    expect(regionChunkOverlayLayer()).toBe("lower");

    setRegionChunkOverlayLayer("upper");
    expect(regionChunkOverlayLayer()).toBe("upper");

    expect(shapeNode(groups.upper[0]!.id)!.className).not.toContain("is-dim");
    expect(shapeNode(groups.lower[0]!.id)!.className).toContain("is-dim");

    shapeNode(groups.upper[0]!.id)!.click();
    expect(projection.selected().has(groups.upper[0]!.id)).toBe(false);
  });

  it("재배치는 노드를 다시 만들지 않는다 — 매 프레임 DOM 을 갈면 포인터가 다른 노드에 떨어진다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    open({ chunks, projection });
    const before = shapeNode(groups.lower[0]!.id);

    repositionRegionChunkOverlay();

    expect(shapeNode(groups.lower[0]!.id)).toBe(before);
  });

  it("닫으면 레이어와 액션 바가 함께 사라진다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    open({ chunks, projection });
    expect(isRegionChunkOverlayOpen()).toBe(true);

    closeRegionChunkOverlay();

    expect(isRegionChunkOverlayOpen()).toBe(false);
    expect(byTestId("region-chunk-layer")).toBeNull();
    expect(byTestId("region-review-bar")).toBeNull();
  });
});

describe("검토 액션 바", () => {
  it("전량일 때 적용 라벨은 pending.changedCells 를 쓴다 — 청크 합산은 레이어 이중계산이다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    open({ chunks, projection, changedCells: 12 });

    expect(byTestId("region-review-apply")!.textContent).toBe("적용 · 12칸");
  });

  it("일부를 빼면 라벨이 선택 칸수로 바뀐다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    open({ chunks, projection, changedCells: 12 });
    shapeNode(groups.lower[0]!.id)!.click();

    expect(byTestId("region-review-apply")!.textContent).toContain("칸만 적용");
  });

  it("전부 빼면 적용을 막고 다음 행동을 말한다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    open({ chunks, projection });
    // 활성 레이어를 옮겨가며 전부 해제
    for (const layer of ["lower", "upper"] as const) {
      setRegionChunkOverlayLayer(layer);
      for (const chunk of chunks.filter((c) => c.layer === layer)) shapeNode(chunk.id)!.click();
    }

    const apply = byTestId("region-review-apply")!;
    expect(apply.getAttribute("disabled")).not.toBeNull();
    expect(apply.textContent).toBe("되돌릴 구역을 남겨두세요");
  });

  it("레이어 버튼은 포함/전체 개수를 보여주고 누르면 활성 레이어가 바뀐다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection, groups } = setup();

    open({ chunks, projection });

    const lowerBtn = byTestId("region-review-layer-lower")!;
    expect(lowerBtn.textContent).toBe(`바닥 ${groups.lower.length}/${groups.lower.length}`);
    expect(lowerBtn.className).toContain("is-active");

    byTestId("region-review-layer-upper")!.click();
    expect(regionChunkOverlayLayer()).toBe("upper");
    expect(byTestId("region-review-layer-upper")!.className).toContain("is-active");
  });

  it("적용·다시·버리기가 호출부 콜백으로 이어진다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();
    const onApply = vi.fn();
    const onRetry = vi.fn();
    const onDiscard = vi.fn();

    open({ chunks, projection, onApply, onRetry, onDiscard });

    byTestId("region-review-apply")!.click();
    byTestId("region-review-retry")!.click();
    byTestId("region-review-discard")!.click();

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("경로 라벨을 주면 바에 표시한다", () => {
    restoreDom = installFakeDom();
    mountCanvasHost();
    const { chunks, projection } = setup();

    open({ chunks, projection, routeLabel: "생성기 · 숲 (시드 629022113)" });

    expect(byTestId("region-review-route")!.textContent).toContain("생성기 · 숲");
  });
});
