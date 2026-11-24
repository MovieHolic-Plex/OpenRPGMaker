import { describe, expect, it, afterEach, vi } from "vitest";
import { SVG_ICON_NAMES } from "@/editor/panels/tileToolbarIcons";
import { createBlankProject, TILE } from "@/project/defaults";
import { regionEventChangeLabel, summarizeOutsideRegionChanges, summarizeRegionEventChanges } from "@/editor/regionTask/regionChangeSummary";
import type { GameEvent, MapId, Project, RegionRect } from "@/project/types";
import { buildChunkOverlayShapes, defaultOverlayLayer, hitRectFor, MIN_CHUNK_HIT_PX, nextChunkInDirection, selectionAfterToggle } from "@/editor/regionTask/regionChunkOverlay";
import { type RegionChangeGroups, type RegionChunk, groupRegionChanges, withChunkLabels } from "@/editor/regionTask/regionChangeGroups";
import { createRegionSelectionProjection } from "@/editor/regionTask/regionSelectionProjection";
import { closeRegionChunkOverlay, isRegionChunkOverlayOpen, openRegionChunkOverlay, regionChunkOverlayLayer, repositionRegionChunkOverlay, setRegionChunkOverlayLayer, type RegionChunkOverlayConfig } from "@/editor/regionTask/regionChunkOverlayView";
import { FakeElement, installFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

// test/regionChangeSummary.test.ts
// 영역 작업 제안의 "타일이 아닌 변경" 요약 — 이벤트 목록 + 영역 밖 변경 경고.
describe("regionChangeSummary", () => {
  isolateTimers();
  const REGION: RegionRect = { x: 4, y: 4, width: 6, height: 6 };
  function makeProject(): { project: Project; mapId: MapId } {
    const project = createBlankProject();
    return { project, mapId: project.startMapId };
  }
  function withEvents(base: Project, mapId: MapId, events: GameEvent[]): Project {
    const next: Project = structuredClone(base);
    next.maps[mapId]!.events = events;
    return next;
  }
  function npc(id: string, x: number, y: number, name?: string): GameEvent {
    return {
      id,
      x,
      y,
      trigger: "action",
      commands: [],
      sprite: { kind: "character", key: "villager", index: 0 } as never,
      ...(name ? { pages: [{ name, trigger: "action", priority: "same", commands: [], conditions: [] }] as never } : {}),
    } as GameEvent;
  }
  describe("summarizeRegionEventChanges", () => {
    it("영역 안에 새로 놓인 이벤트를 잡는다", () => {
      const { project, mapId } = makeProject();
      const proposed = withEvents(project, mapId, [npc("shop_merchant", 6, 6, "잡화점 주인")]);
      const changes = summarizeRegionEventChanges(project, proposed, mapId, REGION);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.kind).toBe("added");
      expect(changes[0]!.name).toBe("잡화점 주인");
      expect(changes[0]!.icon).toBe("shop"); // id 에 shop → 상점 아이콘
      expect(SVG_ICON_NAMES).toContain(changes[0]!.icon);
      expect(regionEventChangeLabel(changes[0]!)).toContain("(6,6)");
      expect(regionEventChangeLabel(changes[0]!)).toContain("새로 놓임");
    });

    it("영역 밖에 놓인 이벤트는 목록에 넣지 않는다", () => {
      const { project, mapId } = makeProject();
      const proposed = withEvents(project, mapId, [npc("npc_far", 20, 20)]);
      expect(summarizeRegionEventChanges(project, proposed, mapId, REGION)).toHaveLength(0);
    });

    it("이동과 삭제를 구분한다", () => {
      const { project, mapId } = makeProject();
      const before = withEvents(project, mapId, [npc("npc_a", 5, 5), npc("npc_b", 7, 7)]);
      const after = withEvents(project, mapId, [npc("npc_a", 6, 5)]);
      const changes = summarizeRegionEventChanges(before, after, mapId, REGION);
      const byId = new Map(changes.map((change) => [change.eventId, change.kind]));
      expect(byId.get("npc_a")).toBe("moved");
      expect(byId.get("npc_b")).toBe("removed");
    });

    it("좌표는 같고 내용만 바뀌면 '내용 바뀜'", () => {
      const { project, mapId } = makeProject();
      const before = withEvents(project, mapId, [npc("npc_a", 5, 5, "경비")]);
      const after = withEvents(project, mapId, [npc("npc_a", 5, 5, "대장장이")]);
      const changes = summarizeRegionEventChanges(before, after, mapId, REGION);
      expect(changes).toHaveLength(1);
      expect(changes[0]!.kind).toBe("modified");
    });

    it("변경이 없으면 빈 목록", () => {
      const { project, mapId } = makeProject();
      expect(summarizeRegionEventChanges(project, structuredClone(project), mapId, REGION)).toHaveLength(0);
    });

    it("변경 아이콘이 SvgIconName 이고 라벨·이름에 이모지가 없다", () => {
      const { project, mapId } = makeProject();
      const proposed = withEvents(project, mapId, [npc("shop_merchant", 6, 6, "잡화점 주인")]);
      const changes = summarizeRegionEventChanges(project, proposed, mapId, REGION);
      for (const change of changes) {
        expect(SVG_ICON_NAMES).toContain(change.icon);
        expect(change.name).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(regionEventChangeLabel(change)).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      const outside = summarizeOutsideRegionChanges(project, proposed, mapId);
      for (const row of outside) {
        expect(row.label).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    });
  });
  describe("summarizeOutsideRegionChanges", () => {
    // 안전 관련 핵심: clipToRegion 은 영역 밖 **타일·이벤트만** 되돌린다. 아래 변경들은
    // 미리보기도 승인도 없이 통과하므로 최소한 목록에 드러나야 한다.
    it("타일만 바뀌면 영역 밖 변경이 없다", () => {
      const { project, mapId } = makeProject();
      const proposed: Project = structuredClone(project);
      proposed.maps[mapId]!.lowerTiles[0] = 999;
      expect(summarizeOutsideRegionChanges(project, proposed, mapId)).toHaveLength(0);
    });

    it("다른 맵 변경을 잡는다", () => {
      const { project, mapId } = makeProject();
      const otherId = Object.keys(project.maps).find((id) => id !== mapId);
      if (!otherId) {
        // 빈 프로젝트에 맵이 하나뿐이면 새 맵 추가 경로로 확인한다.
        const proposed: Project = structuredClone(project);
        proposed.maps["map_new"] = { ...structuredClone(project.maps[mapId]!), id: "map_new", name: "새 맵" } as never;
        const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
        expect(changes.some((change) => change.kind === "map-added")).toBe(true);
        return;
      }
      const proposed: Project = structuredClone(project);
      proposed.maps[otherId]!.lowerTiles[0] = 999;
      const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
      expect(changes.some((change) => change.kind === "map-changed")).toBe(true);
    });

    it("퀘스트·스위치 신규 등록을 개수 변화로 알린다", () => {
      const { project, mapId } = makeProject();
      const proposed: Project = structuredClone(project);
      proposed.switches = [...(proposed.switches ?? []), { id: "sw_new", name: "새 스위치" } as never];
      const changes = summarizeOutsideRegionChanges(project, proposed, mapId);
      const row = changes.find((change) => change.kind === "switches");
      expect(row).toBeTruthy();
      expect(row!.label).toContain("개 →");
    });

    it("타일셋 변경은 경고하지 않는다 — 배치에 필요한 보조 데이터라 매번 떠서 소음이 된다", () => {
      const { project, mapId } = makeProject();
      const proposed: Project = structuredClone(project);
      const tilesetId = Object.keys(proposed.tilesets)[0];
      if (tilesetId) {
        proposed.tilesets[tilesetId] = { ...proposed.tilesets[tilesetId]!, name: "바뀐 이름" } as never;
      }
      expect(summarizeOutsideRegionChanges(project, proposed, mapId)).toHaveLength(0);
    });
  });
});

// test/regionChunkOverlay.test.ts
// 청크를 캔버스 위 도형으로 그리기 위한 순수 기하·순회 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.
describe("regionChunkOverlay", () => {
  isolateTimers();
  const REGION: RegionRect = { x: 10, y: 20, width: 12, height: 11 };
  /** 영역 로컬 좌표 목록으로 청크 만들기. index 는 이 테스트에서 쓰이지 않는다. */
  function chunk(
    id: string,
    layer: "lower" | "upper",
    cells: readonly (readonly [number, number])[],
    label = id,
  ): RegionChunk {
    return {
      id,
      layer,
      label,
      dominantTile: 1,
      cells: cells.map(([x, y]) => ({ x, y, index: y * REGION.width + x })),
    };
  }
  function groups(lower: readonly RegionChunk[], upper: readonly RegionChunk[]): RegionChangeGroups {
    return { lower, upper, unchangedCells: 0 };
  }
  describe("buildChunkOverlayShapes", () => {
    it("셀 하나짜리 청크는 타일 한 칸 사각형과 사방 외곽선 4변이 된다", () => {
      const shapes = buildChunkOverlayShapes({
        chunks: [chunk("a", "lower", [[0, 0]])],
        region: REGION,
        tileSize: 24,
      });

      expect(shapes).toHaveLength(1);
      const [shape] = shapes;
      expect(shape!.cellRects).toEqual([{ x: 0, y: 0, width: 24, height: 24 }]);
      expect(shape!.bounds).toEqual({ x: 0, y: 0, width: 24, height: 24 });
      expect(shape!.outline).toHaveLength(4);
    });

    it("가로로 붙은 두 칸은 내부 경계를 뺀 외곽선 6변이 된다", () => {
      const [shape] = buildChunkOverlayShapes({
        chunks: [chunk("a", "lower", [[0, 0], [1, 0]])],
        region: REGION,
        tileSize: 24,
      });

      // 사각형 2개가 공유하는 세로 변 1쌍이 사라진다: 8 - 2 = 6
      expect(shape!.outline).toHaveLength(6);
      expect(shape!.bounds).toEqual({ x: 0, y: 0, width: 48, height: 24 });
    });

    it("origin 과 tileSize 를 화면 좌표에 반영한다", () => {
      const [shape] = buildChunkOverlayShapes({
        chunks: [chunk("a", "lower", [[2, 3]])],
        region: REGION,
        tileSize: 32,
        origin: { x: 100, y: 50 },
      });

      expect(shape!.cellRects).toEqual([{ x: 100 + 64, y: 50 + 96, width: 32, height: 32 }]);
    });

    it("순회 순서는 위에서 아래로, 같은 줄에서는 왼쪽에서 오른쪽으로 매긴다", () => {
      const shapes = buildChunkOverlayShapes({
        chunks: [
          chunk("right-top", "lower", [[8, 0]]),
          chunk("bottom", "lower", [[0, 5]]),
          chunk("left-top", "lower", [[1, 0]]),
        ],
        region: REGION,
        tileSize: 24,
      });

      expect(shapes.map((s) => s.id)).toEqual(["left-top", "right-top", "bottom"]);
      expect(shapes.map((s) => s.order)).toEqual([0, 1, 2]);
    });

    it("aria-label 은 라벨과 describeChunkPosition 의 위치말을 함께 읽어준다", () => {
      // 12×11 영역의 오른쪽 아래 → "우하단"
      const [shape] = buildChunkOverlayShapes({
        chunks: [chunk("a", "lower", [[10, 9]], "잔디밭(1칸)")],
        region: REGION,
        tileSize: 24,
      });

      expect(shape!.ariaLabel).toContain("잔디밭(1칸)");
      expect(shape!.ariaLabel).toContain("우하단");
    });

    it("셀이 없는 청크는 도형을 만들지 않는다", () => {
      const shapes = buildChunkOverlayShapes({
        chunks: [chunk("empty", "lower", [])],
        region: REGION,
        tileSize: 24,
      });

      expect(shapes).toEqual([]);
    });
  });
  describe("defaultOverlayLayer", () => {
    it("변경 칸이 더 많은 레이어를 기본 활성으로 고른다", () => {
      const g = groups(
        [chunk("l", "lower", [[0, 0]])],
        [chunk("u", "upper", [[0, 0], [1, 0], [2, 0]])],
      );
      expect(defaultOverlayLayer(g)).toBe("upper");
    });

    it("칸 수가 같으면 바닥(lower)을 고른다", () => {
      const g = groups([chunk("l", "lower", [[0, 0]])], [chunk("u", "upper", [[5, 5]])]);
      expect(defaultOverlayLayer(g)).toBe("lower");
    });

    it("한쪽이 비어 있으면 변경이 있는 쪽을 고른다", () => {
      const g = groups([], [chunk("u", "upper", [[0, 0]])]);
      expect(defaultOverlayLayer(g)).toBe("upper");
    });
  });
  describe("selectionAfterToggle", () => {
    it("포함된 청크를 누르면 제외되고, 원본 집합은 바뀌지 않는다", () => {
      const before = new Set(["a", "b"]);
      const after = selectionAfterToggle(before, "a");

      expect([...after]).toEqual(["b"]);
      expect([...before]).toEqual(["a", "b"]);
    });

    it("제외된 청크를 누르면 다시 포함된다", () => {
      expect([...selectionAfterToggle(new Set(["b"]), "a")].sort()).toEqual(["a", "b"]);
    });
  });
  describe("nextChunkInDirection", () => {
    const shapes = buildChunkOverlayShapes({
      chunks: [
        chunk("tl", "lower", [[0, 0]]),
        chunk("tr", "lower", [[6, 0]]),
        chunk("bl", "lower", [[0, 6]]),
      ],
      region: REGION,
      tileSize: 24,
    });

    it("오른쪽으로는 같은 줄에서 더 오른쪽 청크로 간다", () => {
      expect(nextChunkInDirection(shapes, "tl", "right")).toBe("tr");
    });

    it("아래로는 더 아래 청크로 간다", () => {
      expect(nextChunkInDirection(shapes, "tl", "down")).toBe("bl");
    });

    it("갈 곳이 없으면 null 을 준다", () => {
      expect(nextChunkInDirection(shapes, "tr", "right")).toBeNull();
      expect(nextChunkInDirection(shapes, "tl", "up")).toBeNull();
    });

    it("모르는 id 는 null 을 준다", () => {
      expect(nextChunkInDirection(shapes, "nope", "down")).toBeNull();
    });
  });
  describe("hitRectFor", () => {
    it("타일이 작아도 최소 히트 타깃까지 넓힌다 — 1칸 청크는 16px 라 그냥 두면 누를 수 없다", () => {
      // 실측(2026-09-11, 호수 마을 12×10 영역): 청크 22개 중 18개가 1칸 = 16×16px.
      const hit = hitRectFor({ x: 100, y: 50, width: 16, height: 16 });

      expect(hit.width).toBe(MIN_CHUNK_HIT_PX);
      expect(hit.height).toBe(MIN_CHUNK_HIT_PX);
      // 원래 칸의 중심을 유지한다 — 넓힌 쪽이 한쪽으로 치우치면 커서가 엉뚱한 칸을 가리킨다.
      expect(hit.x + hit.width / 2).toBe(100 + 8);
      expect(hit.y + hit.height / 2).toBe(50 + 8);
    });

    it("이미 최소치보다 큰 사각형은 그대로 둔다", () => {
      const rect = { x: 0, y: 0, width: 48, height: 32 };
      expect(hitRectFor(rect)).toEqual(rect);
    });

    it("한 축만 작으면 그 축만 넓힌다", () => {
      const hit = hitRectFor({ x: 0, y: 0, width: 48, height: 16 });
      expect(hit.width).toBe(48);
      expect(hit.height).toBe(MIN_CHUNK_HIT_PX);
    });
  });
});

// test/regionChunkOverlayView.test.ts
// 캔버스 위 청크 도형 레이어 + 검토 액션 바의 DOM 계약.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.
describe("regionChunkOverlayView", () => {
  isolateTimers();
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
});
