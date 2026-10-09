// OPRN-OUT-018 — 지원 상한을 "생성/크기변경 전 경로 + lint" 한 곳으로 맞춘다.
//
// 실측 결함: create_map·resize_map·generate_map·author_village 는 257을 거부했는데
// build_world 만 상한이 없어 257×257 셀 배열을 실제로 할당했고(라이브 재현: 제안 생성은
// 성공, 이어진 검토가 입력 크기 HTTP 400 으로 실패), projectLint 는 그 맵을 warning 으로만
// 보고해 "지원하지 않는데 존재하는" 상태가 그대로 남았다.
//
// 경계는 항상 짝으로 본다 — 현재 1024는 통과, 1025는 할당 전에 거부.
import { describe, expect, it } from "vitest";
import { addChildMap, addMap, createMapFromSpec, deleteMap, resizeMap } from "@/editor/actions";
import { selectEditorMap } from "@/editor/mapSelection";
import { editorState } from "@/editor/editorState";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import { deserialize, serialize } from '@/project/io';

const OVER = MAX_TOOL_MAP_DIMENSION + 1;

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

/** 거부 메시지는 상한과 회복 수단(맵 분할 + transfer 연결)을 함께 말해야 한다. */
function expectRejection(summary: string): void {
  expect(summary).toContain(`최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}`);
  expect(summary).toContain("여러 맵");
  expect(summary).toContain("transfer");
}

describe("build_world 맵 크기 상한", () => {
  it(`${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION} 노드는 만든다`, () => {
    const context = ctx();
    const result = runTool(context, "build_world", {
      plan: {
        nodes: [{ mapId: "map_world_max", role: "field", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION }],
        edges: [],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps.map_world_max?.width).toBe(MAX_TOOL_MAP_DIMENSION);
  });

  it(`${OVER}×${OVER} 노드는 셀 할당 전에 거부한다`, () => {
    const context = ctx();
    const result = runTool(context, "build_world", {
      plan: {
        nodes: [{ mapId: "map_world_over", role: "field", width: OVER, height: OVER }],
        edges: [],
      },
    });
    expect(result.ok).toBe(false);
    expectRejection(result.summary);
    expect(context.project.maps.map_world_over).toBeUndefined();
  });

  it("size:{w,h} 별칭으로 우회할 수 없다", () => {
    const context = ctx();
    const result = runTool(context, "build_world", {
      plan: {
        nodes: [{ mapId: "map_world_alias", role: "town", size: { w: OVER, h: 40 } }],
        edges: [],
      },
    });
    expect(result.ok).toBe(false);
    expectRejection(result.summary);
    expect(context.project.maps.map_world_alias).toBeUndefined();
  });

  it("초대형 노드 하나가 섞이면 같은 요청의 정상 노드도 만들지 않는다", () => {
    const context = ctx();
    const result = runTool(context, "build_world", {
      plan: {
        nodes: [
          { mapId: "map_world_ok", role: "town", width: 30, height: 30 },
          { mapId: "map_world_bad", role: "dungeon", width: OVER, height: 30 },
        ],
        edges: [],
      },
    });
    expect(result.ok).toBe(false);
    expect(context.project.maps.map_world_ok).toBeUndefined();
    expect(context.project.maps.map_world_bad).toBeUndefined();
  });
});

describe("plan_world 크기 힌트 상한", () => {
  it("build_world 가 그대로 읽는 초대형 힌트는 계획 단계에서 거부한다", () => {
    const context = ctx();
    const result = runTool(context, "plan_world", {
      nodes: [{ mapId: "map_plan_over", role: "field", width: OVER, height: OVER }],
      edges: [],
    });
    expect(result.ok).toBe(false);
    expectRejection(result.summary);
    expect(context.project.worldGraph?.nodes.some((node) => node.mapId === "map_plan_over")).not.toBe(true);
  });

  it(`${MAX_TOOL_MAP_DIMENSION} 힌트는 계획으로 등록한다`, () => {
    const context = ctx();
    const result = runTool(context, "plan_world", {
      nodes: [{ mapId: "map_plan_max", role: "field", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION }],
      edges: [],
    });
    expect(result.ok, result.summary).toBe(true);
  });
});

describe("나머지 조수 생성/크기변경 경로", () => {
  it.each([{ size: 512 }, { size: 1024 }])('official $size×$size maps retain the edge cells through export and reload', ({ size }) => {
    const context = ctx();
    const created = runTool(context, 'create_map', { name: `${size} 경계`, width: size, height: size, id: 'map_edge' });
    expect(created.ok, created.summary).toBe(true);
    const map = context.project.maps.map_edge!;
    expect(map.lowerTiles).toHaveLength(size * size);
    const edgeTile = map.lowerTiles[0] === 0 ? 1 : 0;
    map.lowerTiles[size * size - 1] = edgeTile;
    map.upperTiles[size * size - 1] = edgeTile;
    map.lowerOverlayTiles = new Array(size * size).fill(-1);
    map.upperOverlayTiles = new Array(size * size).fill(-1);
    map.shadowBits = new Array(size * size).fill(0);
    map.lowerOverlayTiles[size * size - 1] = edgeTile;
    map.upperOverlayTiles[size * size - 1] = edgeTile;
    map.shadowBits[size * size - 1] = 15;
    const restored = deserialize(serialize(context.project)).maps.map_edge!;
    expect([restored.width, restored.height]).toEqual([size, size]);
    for (const layer of [restored.lowerTiles, restored.upperTiles, restored.lowerOverlayTiles, restored.upperOverlayTiles]) {
      expect(layer).toHaveLength(size * size);
      expect(layer![size * size - 1]).toBe(edgeTile);
    }
    expect(restored.shadowBits).toHaveLength(size * size);
    expect(restored.shadowBits![size * size - 1]).toBe(15);
    expect(projectLint(context.project).filter(issue => issue.code === 'map-size')).toEqual([]);
  });
  it.each([
    ["create_map", { name: "경계", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION, id: "map_edge" }, true],
    ["create_map", { name: "초과", width: OVER, height: OVER, id: "map_edge" }, false],
    ["generate_map", { theme: "forest", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION, id: "map_edge" }, true],
    ["generate_map", { theme: "forest", width: OVER, height: OVER, id: "map_edge" }, false],
  ] as const)("%s %o → ok:%s", (tool, args, ok) => {
    const context = ctx();
    const result = runTool(context, tool, { ...args,
      ...(tool === 'generate_map' ? { tilesetId: 'easyrpg_chipset_combined_town' } : {}) });
    expect(result.ok, result.summary).toBe(ok);
    if (!ok) {
      expectRejection(result.summary);
      expect(context.project.maps.map_edge).toBeUndefined();
    }
  });

  it("resize_map 은 지원 상한까지 늘리고 초과는 거부한다", () => {
    const context = ctx();
    expect(runTool(context, "create_map", { name: "확장", width: 12, height: 12, id: "map_resize" }).ok).toBe(true);
    const grown = runTool(context, "resize_map", { mapId: "map_resize", width: MAX_TOOL_MAP_DIMENSION, height: MAX_TOOL_MAP_DIMENSION });
    expect(grown.ok, grown.summary).toBe(true);
    const over = runTool(context, "resize_map", { mapId: "map_resize", width: OVER, height: MAX_TOOL_MAP_DIMENSION });
    expect(over.ok).toBe(false);
    expectRejection(over.summary);
    expect(context.project.maps.map_resize?.width).toBe(MAX_TOOL_MAP_DIMENSION);
  });

  it("start_dungeon_room_session 은 초대형 방을 거부한다", () => {
    const context = ctx();
    const result = runTool(context, "start_dungeon_room_session", {
      mapId: "map_room_over",
      theme: "lava",
      width: OVER,
      height: OVER,
    });
    expect(result.ok).toBe(false);
    expectRejection(result.summary);
    expect(context.project.maps.map_room_over).toBeUndefined();
  });

  it("start_interior_room_session 은 초대형 실내를 거부한다", () => {
    const context = ctx();
    const result = runTool(context, "start_interior_room_session", {
      mapId: "map_interior_over",
      theme: "bedroom",
      width: OVER,
      height: OVER,
      door: { x: 4, y: OVER - 1 },
      wings: [{ x: 1, y: 1, w: OVER - 2, h: OVER - 2 }],
    });
    expect(result.ok).toBe(false);
    expectRejection(result.summary);
    expect(context.project.maps.map_interior_over).toBeUndefined();
  });

  it("author_village 는 초대형 새 맵 대상을 거부한다", () => {
    const context = ctx();
    const result = runTool(context, "author_village", {
      target: { kind: "new", mapId: "map_village_over", name: "초대형 마을", width: OVER, height: OVER },
      houseCount: 2,
    });
    expect(result.ok).toBe(false);
    expect(context.project.maps.map_village_over).toBeUndefined();
  });

  it("build_village/build_castle 은 상한을 넘는 맵을 만들지 않는다", () => {
    const context = ctx();
    const village = runTool(context, "build_village", { name: "큰 마을", width: OVER, height: OVER, seed: 7 });
    if (village.ok) {
      for (const map of Object.values(context.project.maps)) {
        expect(map.width).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
        expect(map.height).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
      }
    }
  });
});

describe("사람 생성/크기변경 경로", () => {
  const withDom = <T>(run: () => T): T => {
    const restore = installFakeDom();
    try {
      return run();
    } finally {
      restore();
    }
  };

  it("addMap 은 초대형 요청으로 맵을 만들지 않는다", () => {
    withDom(() => {
      store.replace(createBlankProject());
      const id = addMap("초대형", OVER, OVER);
      expect(id).toBe("");
      expect(Object.values(store.getCurrent().maps).some((map) => map.width > MAX_TOOL_MAP_DIMENSION)).toBe(false);
    });
  });

  it("addChildMap 도 초대형 요청으로 맵을 만들지 않는다", () => {
    withDom(() => {
      store.replace(createBlankProject());
      const parentId = store.getCurrent().startMapId;
      const id = addChildMap(parentId, "초대형 하위", { width: OVER, height: 20 });
      expect(id).toBe("");
      expect(Object.values(store.getCurrent().maps).some((map) => map.width > MAX_TOOL_MAP_DIMENSION)).toBe(false);
    });
  });

  it("addMap 은 지원 상한을 그대로 만든다", () => {
    withDom(() => {
      store.replace(createBlankProject());
      const id = addMap("경계", MAX_TOOL_MAP_DIMENSION, MAX_TOOL_MAP_DIMENSION);
      expect(id).not.toBe("");
      expect(store.getCurrent().maps[id]?.width).toBe(MAX_TOOL_MAP_DIMENSION);
    });
  });

  it("resizeMap 은 초대형 크기로 바꾸지 않는다", () => {
    withDom(() => {
      store.replace(createBlankProject());
      const mapId = store.getCurrent().startMapId;
      const before = store.getCurrent().maps[mapId]!.width;
      resizeMap(mapId, OVER, OVER);
      expect(store.getCurrent().maps[mapId]?.width).toBe(before);
    });
  });

  it("createMapFromSpec 은 상한 밖 스펙으로 초대형 맵을 남기지 않는다", () => {
    withDom(() => {
      store.replace(createBlankProject());
      const id = createMapFromSpec({
        name: "스펙 초과",
        width: OVER,
        height: OVER,
        tilesetId: store.getCurrent().maps[store.getCurrent().startMapId]!.tilesetId,
        parentId: "",
        preset: "blank",
      });
      const created = id ? store.getCurrent().maps[id] : undefined;
      expect(created?.width ?? 0).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
      expect(created?.height ?? 0).toBeLessThanOrEqual(MAX_TOOL_MAP_DIMENSION);
    });
  });
});

describe("lint 계약이 생성 계약과 일치한다", () => {
  it(`${OVER} 맵은 error 로 보고한다(warning-only 미지원 상태 금지)`, () => {
    const project = createBlankProject();
    const huge = createBlankMap("외부 초대형", OVER, 12);
    project.maps[huge.id] = huge;
    project.mapTree.children.push({ mapId: huge.id, children: [] });

    const issues = projectLint(project);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "map-size", mapId: huge.id })
    );
    expect(issues.some((issue) => issue.code === "map-size" && issue.severity === "warning")).toBe(false);
  });

  it(`${MAX_TOOL_MAP_DIMENSION} 맵은 보고하지 않는다`, () => {
    const project = createBlankProject();
    const edge = createBlankMap("경계 맵", MAX_TOOL_MAP_DIMENSION, MAX_TOOL_MAP_DIMENSION);
    project.maps[edge.id] = edge;
    project.mapTree.children.push({ mapId: edge.id, children: [] });

    expect(projectLint(project).some((issue) => issue.code === "map-size")).toBe(false);
  });
});

describe("이미 들어온 초대형 맵(외부/구 데이터)", () => {
  /** 프로젝트에 이미 초대형 맵이 있는 상태(구 저장본/외부 임포트 재현). */
  function contextWithOversizedMap(): { context: ToolContext; hugeId: string } {
    const context = ctx();
    const huge = createBlankMap("외부 초대형", OVER, OVER);
    context.project.maps[huge.id] = huge;
    context.project.mapTree.children.push({ mapId: huge.id, children: [] });
    return { context, hugeId: huge.id };
  }

  // map-size 를 error 로 올리면 커밋 게이트가 걸린다. 기준선 대조가 없으면 "고치려는 조건이
  // 고치는 경로를 막는" 교착이 된다 — 선재 초과 맵이 무관한 편집까지 거부하면 안 된다.
  it("선재 초대형 맵이 무관한 편집을 막지 않는다", () => {
    const { context } = contextWithOversizedMap();
    const created = runTool(context, "create_map", { name: "정상 맵", width: 20, height: 15, id: "map_unrelated" });
    expect(created.ok, created.summary).toBe(true);
    expect(context.project.maps.map_unrelated?.width).toBe(20);
  });

  it("조수 경로에서도 렌더 없이 삭제할 수 있다", () => {
    const { context, hugeId } = contextWithOversizedMap();
    const removed = runTool(context, "remove_map", { mapId: hugeId });
    expect(removed.ok, removed.summary).toBe(true);
    expect(context.project.maps[hugeId]).toBeUndefined();
    expect(projectLint(context.project).some((issue) => issue.code === "map-size")).toBe(false);
  });

  it("캔버스를 열지 않고도 식별하고 지울 수 있다", () => {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      const huge = createBlankMap("외부 초대형", OVER, OVER);
      project.maps[huge.id] = huge;
      project.mapTree.children.push({ mapId: huge.id, children: [] });
      store.replace(project);
      editorState.set({ currentMapId: store.getCurrent().startMapId, selectedEventId: null, selectedEventPageId: null });

      // 식별: lint 가 mapId 를 짚어 준다.
      const found = projectLint(store.getCurrent()).find((issue) => issue.code === "map-size");
      expect(found?.mapId).toBe(huge.id);

      // 편집 캔버스는 열리지 않는다 — 현재 맵이 바뀌지 않아야 한다.
      const beforeMapId = editorState.get().currentMapId;
      expect(selectEditorMap(huge.id)).toBe(false);
      expect(editorState.get().currentMapId).toBe(beforeMapId);

      // 제거는 그래도 된다.
      const removed = deleteMap(huge.id);
      expect(removed.ok, "ok" in removed && !removed.ok ? removed.message : "").toBe(true);
      expect(store.getCurrent().maps[huge.id]).toBeUndefined();
    } finally {
      restore();
    }
  });
});
