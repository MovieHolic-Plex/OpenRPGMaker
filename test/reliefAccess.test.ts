import { describe, expect, it, afterEach } from "vitest";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { reliefAccess } from "@/editor/tools/reliefAccess";
import { createBlankProject as createBlankDefaultProject } from "@/project/defaults";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { reliefFromGrid } from "@/project/relief/types";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { GROUP_SAMPLE_TOOLS } from "@/editor/tools/groupSampleTool";
import { runTool } from "@/editor/tools/toolRunner";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { TileGroupMetadata, Command, EventPage, GameEvent, Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { withRetiredEasyRpgTilesets, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { repairTreePairsOnMap, repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { resolveForestCanopyReplacementExemptTileIds } from "@/editor/tools/forestComposition";
import { stripResourceSearchIdPrefixes } from "@/editor/tools/resourceSearchIdArgs";
import { searchResources } from "@/assets/resourceSearch";
import { projectCommonEventReferenceMessage } from "@/editor/databaseReferences";
import { strandedByRemoval } from "@/editor/tools/strandedSwitches";
import { findUnwrittenSelfSwitchGates } from "@/project/eventPageShadow";
import { projectLint } from "@/project/lint/projectLint";
import { dynamicRefKinds, expandScriptEffects, projectScriptUsage, scriptCalls, scriptCommandEffects, scriptHasDynamic, scriptWrites } from "@/project/script/effects";
import type { ScriptEffects } from "@/project/script/types";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import { buildMapGraph, checkMapGraph } from "@/qa/gameCheck/mapGraph";
import { checkProgression } from "@/qa/gameCheck/progression";
import { isolateTimers } from "./mergedTeardown";

// 지형 리뷰 F3·F7: 경사로 없는 고원은 걸어 오를 수 없는데 도구가 말하지 않았다.
describe("reliefAccess", () => {
  isolateTimers();
  describe("높은 땅 통행 검사", () => {
    it("경사로 없는 고원을 도달 못 함으로 세고, 제안한 자리에 경사로를 놓으면 0이 된다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const start = project.startPos;
      const x0 = start.x >= map.width / 2 ? 1 : map.width - 9, x1 = x0 + 7;
      const grid = Array.from({ length: map.height }, (_, y) =>
        Array.from({ length: map.width }, (_, x) => (x >= x0 && x <= x1 && y >= 2 && y <= 8 ? 2 : 0)));
      map.relief = reliefFromGrid(grid);

      const before = reliefAccess(project, map);
      expect(before).not.toBeNull();
      expect(before!.unreachableHigh).toBe(before!.highCells);
      expect(before!.unreachableHigh).toBeGreaterThan(0);
      const ramp = before!.regions[0]!.ramp;
      expect(ramp).not.toBeNull();
      expect(before!.text).toContain("place_terrain_ramp");

      const plan = planReliefRamp(map, { ...ramp!, face: "top" }, 2, false);
      expect(plan.ok).toBe(true);
      plan.apply!(map);
      expect(reliefAccess(project, map)!.unreachableHigh).toBe(0);
    });
  });
});

describe("renderGroupSampleTool", () => {
  isolateTimers();
  type RenderGroupSampleData = {
    readonly samples: readonly {
      readonly h: number;
      readonly label: string;
      readonly lower: readonly number[];
      readonly upper: readonly number[];
      readonly w: number;
    }[];
    readonly tilesetId: string;
  };
  type FakeCanvasContext = {
    fillStyle: string;
    imageSmoothingEnabled: boolean;
    drawImage: () => void;
    fillRect: () => void;
  };
  let restoreCanvasDom: (() => void) | null = null;
  function context(): ToolContext {
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [wallGroup()];
    return { project };
  }
  function wallGroup(): TileGroupMetadata {
    return {
      defaultLayer: "lower",
      description: "테스트 벽",
      id: "wall-main",
      name: "담장",
      patternGrammar: {
        axis: "both",
        kind: "nine_slice_expandable",
        minHeight: 3,
        minWidth: 3,
        parts: [
          { role: "topLeft", tileIds: [1] },
          { role: "top", tileIds: [2] },
          { role: "topRight", tileIds: [3] },
          { role: "left", tileIds: [4] },
          { role: "center", tileIds: [5] },
          { role: "right", tileIds: [6] },
          { role: "bottomLeft", tileIds: [7] },
          { role: "bottom", tileIds: [8] },
          { role: "bottomRight", tileIds: [9] },
        ],
        preserveCaps: true,
        repeat: "center",
      },
      placementRules: "3x3 벽",
      role: "wall",
      tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    };
  }
  function isRenderGroupSampleData(value: unknown): value is RenderGroupSampleData {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const tilesetId = Reflect.get(value, "tilesetId");
    const samples = Reflect.get(value, "samples");
    return typeof tilesetId === "string" && Array.isArray(samples)
      && samples.every((sample) => {
        if (typeof sample !== "object" || sample === null || Array.isArray(sample)) return false;
        return typeof Reflect.get(sample, "label") === "string"
          && Number.isInteger(Reflect.get(sample, "w"))
          && Number.isInteger(Reflect.get(sample, "h"))
          && Array.isArray(Reflect.get(sample, "lower"))
          && Array.isArray(Reflect.get(sample, "upper"));
      });
  }
  describe("render_group_sample", () => {
    afterEach(() => {
      restoreCanvasDom?.();
      restoreCanvasDom = null;
    });

    it("returns one current sample when called with groupId only", () => {
      const ctx = context();
      const result = runTool(ctx, "render_group_sample", { tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "wall-main" });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("샘플 렌더: 담장");
      if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
      expect(result.data.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
      expect(result.data.samples).toHaveLength(1);
      expect(result.data.samples[0]?.label).toBe("현재");
      expect(result.data.samples[0]?.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("exposes patternGrammar kind and part enums in the tool schema", () => {
      const tool = GROUP_SAMPLE_TOOLS.find((entry) => entry.name === "render_group_sample");
      const patternGrammar = tool?.parameters.properties?.patternGrammar;
      const proposedPatternGrammar = tool?.parameters.properties?.proposed?.properties?.patternGrammar;

      expect(patternGrammar?.properties?.kind?.enum).toEqual(expect.arrayContaining(["vertical_expandable", "source_rect", "nine_slice_expandable"]));
      expect(patternGrammar?.properties?.parts?.items?.properties?.role?.enum).toEqual(expect.arrayContaining(["top", "bottom", "topLeft"]));
      expect(proposedPatternGrammar).toBe(patternGrammar);
    });

    it("reports valid patternGrammar kinds when an invalid kind is provided", () => {
      const ctx = context();
      const result = runTool(ctx, "render_group_sample", {
        patternGrammar: { kind: "vertical", parts: [] },
        role: "terrain",
        tileIds: [1],
        tilesetId: COMBINED_TOWN_TILESET_ID,
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("vertical_expandable");
      expect(result.issues?.[0]?.message).toContain("source_rect");
    });

    it("returns before and after samples when proposed data changes the group", () => {
      const ctx = context();
      const result = runTool(ctx, "render_group_sample", {
        tilesetId: COMBINED_TOWN_TILESET_ID,
        groupId: "wall-main",
        proposed: { role: "fence", tileIds: [12, 13, 14] },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("전/후");
      if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
      expect(result.data.samples.map((sample) => sample.label)).toEqual(["수정 전", "수정 후"]);
      expect(result.data.samples[0]?.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(result.data.samples[1]?.lower).toEqual([12, 13, 14]);
    });

    it("keeps structural rule proposals as before and after changes", () => {
      const ctx = context();
      const result = runTool(ctx, "render_group_sample", {
        groupId: "wall-main",
        proposed: {
          junctions: [{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }],
          overlays: [{ tileIds: [16], when: "ridge" }],
        },
        tilesetId: COMBINED_TOWN_TILESET_ID,
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("전/후");
      if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
      expect(result.data.samples.map((sample) => sample.label)).toEqual(["수정 전", "수정 후"]);
    });

    it("returns a single ad-hoc sample when tileIds are provided without a group", () => {
      const ctx = context();
      const result = runTool(ctx, "render_group_sample", { tilesetId: COMBINED_TOWN_TILESET_ID, role: "terrain", tileIds: [30, 31] });

      expect(result.ok, result.summary).toBe(true);
      if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");
      expect(result.data.samples).toHaveLength(1);
      expect(result.data.samples[0]?.label).toBe("샘플");
      expect(result.data.samples[0]?.lower).toEqual([30, 31]);
    });

    it("lets renderToolImages accept render_group_sample data without mutating the project", async () => {
      const ctx = context();
      const before = JSON.stringify(ctx.project);
      const result = runTool(ctx, "render_group_sample", { tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "wall-main" });
      if (!isRenderGroupSampleData(result.data)) throw new Error("render_group_sample data shape mismatch");

      const images = await renderToolImages(ctx.project, "render_group_sample", result.data);

      expect(images.length).toBeGreaterThanOrEqual(0);
      expect(JSON.stringify(ctx.project)).toBe(before);
    });

    it("renders transparent areas on a neutral checker instead of magenta", async () => {
      const fillStyles: string[] = [];
      restoreCanvasDom = installFakeCanvasDom(fillStyles);
      const ctx = context();

      await renderToolImages(ctx.project, "render_group_sample", {
        samples: [{ h: 1, label: "현재", lower: [-1], upper: [-1], w: 1 }],
        tilesetId: COMBINED_TOWN_TILESET_ID,
      });

      expect(fillStyles).toContain("#2a2a2e");
      expect(fillStyles).toContain("#33333a");
      expect(fillStyles).not.toContain("#ff00ff");
    });
  });
  function installFakeCanvasDom(fillStyles: string[]): () => void {
    const previousDocument = globalThis.document;
    const previousImage = globalThis.Image;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      writable: true,
      value: {
        createElement: (tagName: string) => {
          if (tagName !== "canvas") throw new Error(`unexpected element: ${tagName}`);
          const context: FakeCanvasContext = {
            drawImage: () => undefined,
            fillRect: () => undefined,
            imageSmoothingEnabled: false,
            get fillStyle() {
              return fillStyles.at(-1) ?? "";
            },
            set fillStyle(value: string) {
              fillStyles.push(value);
            },
          };
          return {
            getContext: () => context,
            height: 0,
            toDataURL: () => "data:image/png;base64,neutral-checker",
            width: 0,
          };
        },
      },
    });
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: class FakeImage {
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    });
    return () => {
      restoreGlobal("document", previousDocument);
      restoreGlobal("Image", previousImage);
    };
  }
  function restoreGlobal(key: "document" | "Image", value: unknown): void {
    if (value === undefined) {
      Reflect.deleteProperty(globalThis, key);
      return;
    }
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
});

describe("repairTreePairs", () => {
  isolateTimers();
  // TILE.* 는 합본 마을 칩 번호다 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵이 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
  const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
  const MAP = "map_blank_start";
  describe("repairTreePairs", () => {
    it("places canopy upper above an orphan trunk on lower", () => {
      const project = createBlankProject();
      const map = project.maps[MAP];
      // (5,5) 밑동만 있음 — (5,4) 수관 없음
      map.lowerTiles[5 * map.width + 5] = 290;
      map.upperTiles[5 * map.width + 5] = TILE.EMPTY;
      map.upperTiles[4 * map.width + 5] = TILE.EMPTY;
      map.lowerTiles[4 * map.width + 5] = TILE.GRASS;

      const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId]);
      expect(result.canopiesPlaced).toBe(1);
      expect(map.upperTiles[4 * map.width + 5]).toBe(260);
      expect(map.lowerTiles[5 * map.width + 5]).toBe(290);
    });

    it("removes trunk on top row where canopy cannot exist", () => {
      const project = createBlankProject();
      const map = project.maps[MAP];
      map.lowerTiles[0 * map.width + 3] = 290;

      const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId]);
      expect(result.orphanTrunksRemoved).toBe(1);
      expect(map.lowerTiles[0 * map.width + 3]).toBe(TILE.GRASS);
    });

    it("event writes preserve pre-existing orphan trunks", () => {
      const ctx = { project: createBlankProject() };
      const mapId = "map_tree_hook";
      runTool(ctx, "create_map", { id: mapId, name: "훅", width: 12, height: 12 });
      const map = ctx.project.maps[mapId];
      // 강제로 고아 밑동 심기
      map.lowerTiles[6 * map.width + 4] = 290;
      map.upperTiles[5 * map.width + 4] = TILE.EMPTY;

      // Event-only writes must not repair the existing raster.
      const result = runTool(ctx, "place_npc", {
        mapId,
        x: 1,
        y: 1,
        name: "테스트",
        pages: [{ lines: ["ok"] }],
      });
      expect(result.ok).toBe(true);
      expect(ctx.project.maps[mapId].upperTiles[5 * map.width + 4]).toBe(TILE.EMPTY);
      expect(result.summary).not.toMatch(/수관 보완|나무 상·하/);
    });

    it("tile writes repair only the raster map changed by the tool", () => {
      const ctx = { project: createBlankProject() };
      const other = structuredClone(ctx.project.maps[MAP]);
      other.id = "map_unrelated";
      other.lowerTiles[3 * other.width + 3] = 290;
      ctx.project.maps[other.id] = other;
      const sentinel = structuredClone(other);
      const result = runTool(ctx, "paint_tiles", { mapId: MAP, layer: "lower", mode: "cells", tile: 290, cells: [{ x: 5, y: 5 }] });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[MAP].upperTiles[4 * other.width + 5]).toBe(260);
      expect(ctx.project.maps[other.id]).toEqual(sentinel);
    });

    it("repairTreePairsOnProject scans all maps", () => {
      const project = createBlankProject();
      const map = project.maps[MAP];
      map.lowerTiles[3 * map.width + 3] = 292; // 활엽 좌하
      map.lowerTiles[3 * map.width + 4] = 293; // 활엽 우하 — 2×2 는 짝으로만 존재한다
      const result = repairTreePairsOnProject(project);
      expect(result.canopiesPlaced).toBeGreaterThanOrEqual(2);
      expect(map.upperTiles[2 * map.width + 3]).toBe(262);
      expect(map.upperTiles[2 * map.width + 4]).toBe(263);
    });

    it("짝 없는 활엽수 반쪽은 수관을 올리지 않고 통째로 걷어낸다 — tile_erase 가 2×2 를 반만 물었을 때", () => {
      // 2026-09-18 실측: 반쪽 위에 수관을 다시 올리면 lint hard 규칙(262 왼쪽에 263)이 영구히 깨져 초안 적용이 막혔다.
      const project = createBlankProject();
      const map = project.maps[MAP];
      const at = (x: number, y: number) => y * map.width + x;
      map.upperTiles[at(3, 2)] = 262; map.upperTiles[at(4, 2)] = 263;
      map.lowerTiles[at(3, 3)] = 292; map.lowerTiles[at(4, 3)] = 293;
      // 오른쪽 열만 지운 상태(erase rect 가 x=4 부터 시작)
      map.upperTiles[at(4, 2)] = TILE.EMPTY; map.lowerTiles[at(4, 3)] = TILE.GRASS;
      const result = repairTreePairsOnProject(project);
      expect(result.orphanTrunksRemoved).toBe(1);
      expect(map.lowerTiles[at(3, 3)]).toBe(TILE.GRASS);
      expect(map.upperTiles[at(3, 2)]).toBe(TILE.EMPTY);
      expect(map.upperTiles[at(4, 2)]).toBe(TILE.EMPTY);
    });

    it("대각으로 겹친 활엽수(293 자리에 다음 나무의 262)는 반쪽으로 보지 않는다", () => {
      const project = createBlankProject();
      const map = project.maps[MAP];
      const at = (x: number, y: number) => y * map.width + x;
      // 첫 나무 (3,2)-(4,3), 둘째 나무 (4,3)-(5,4): 둘째의 262 가 첫째의 293 칸(upper)에 앉는다.
      map.upperTiles[at(3, 2)] = 262; map.upperTiles[at(4, 2)] = 263;
      map.lowerTiles[at(3, 3)] = 292; map.lowerTiles[at(4, 3)] = 293;
      map.upperTiles[at(4, 3)] = 262; map.upperTiles[at(5, 3)] = 263;
      map.lowerTiles[at(4, 4)] = 292; map.lowerTiles[at(5, 4)] = 293;
      const before = structuredClone(map);
      const result = repairTreePairsOnProject(project);
      expect(result.orphanTrunksRemoved).toBe(0);
      expect(map.lowerTiles).toEqual(before.lowerTiles);
      expect(map.upperTiles).toEqual(before.upperTiles);
    });

    it("밑동 위 덤불은 수관으로 덮어쓰지 않는다 — impassable 숲이 다시 뚫린다", () => {
      // 수관 타일(260·262·263)은 칩셋에서 4방향 통행 가능이다(주인공이 나무 뒤로 지나가는 관례).
      // 그래서 impassable 숲은 그 칸의 상위 레이어에 막는 칩(덤불 289)을 둬서 경로를 끊는다.
      // 보정이 덤불을 수관으로 되돌리면 그 경로가 살아난다(실측: 밴드 통행 13%→35%).
      const project = createBlankProject();
      const map = project.maps[MAP];
      map.lowerTiles[5 * map.width + 5] = 290; // 침엽 밑동
      map.upperTiles[4 * map.width + 5] = 289; // 그 위에 덤불(저작 의도)
      const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId], {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(project),
      });
      expect(map.upperTiles[4 * map.width + 5]).toBe(289);
      expect(result.canopiesPlaced).toBe(0);
    });

    it("밑동 위 일반 소품은 수관으로 보정한다 — post-write hook 계약을 우회하지 못한다", () => {
      // 왜 이 케이스인가(실측): 나무 상자 237도 "다른 오버레이" 예외에 들어가 수관 없는 밑동과
      // 머리 위 상자가 그대로 hook을 통과했다. forest gap-closing 덤불 id 외에는 원래 계약대로 보정한다.
      const directProject = createBlankProject();
      const directMap = directProject.maps[MAP];
      directMap.lowerTiles[5 * directMap.width + 5] = 290;
      directMap.upperTiles[4 * directMap.width + 5] = 237;

      const direct = repairTreePairsOnMap(directMap, directProject.tilesets[directMap.tilesetId], {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(directProject),
      });
      expect(direct.canopiesPlaced).toBe(1);
      expect(directMap.upperTiles[4 * directMap.width + 5]).toBe(260);

      const ctx = { project: createBlankProject() };
      const hookedMap = ctx.project.maps[MAP];
      hookedMap.lowerTiles[5 * hookedMap.width + 5] = 290;
      hookedMap.upperTiles[4 * hookedMap.width + 5] = 237;
      // 이벤트·DB 편집은 나무를 고치지 않는다(toolRunner: 「Event/DB/name edits must not normalize trees」) —
      // 같은 맵의 다른 칸을 칠하는 래스터 도구로 post-write hook 을 태운다. (밑동을 상자 밑에 직접 칠하는 것은
      // paint_tiles 의 동반 배치 규칙이 이제 먼저 거부한다.)
      const hooked = runTool(ctx, "paint_tiles", { mapId: MAP, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 10, y: 10 }] });
      expect(hooked.ok, hooked.summary).toBe(true);
      expect(ctx.project.maps[MAP].upperTiles[4 * hookedMap.width + 5]).toBe(260);
    });
  });
});

// 검색 id(backdrop:…)를 리소스 칸에 넣어도 받아 준다 — 2026-09-24 꿈 세계 dream-6.
describe("resourceSearchIdArgs", () => {
  isolateTimers();
  describe("backdrop 검색 id", () => {
    it("리소스 칸의 backdrop: 접두만 걷는다", () => {
      expect(stripResourceSearchIdPrefixes({ backgroundResourceId: "backdrop:x", title: "backdrop:x", presentation: { backgroundResourceId: "backdrop:y" } }))
        .toEqual({ backgroundResourceId: "x", title: "backdrop:x", presentation: { backgroundResourceId: "y" } });
    });

    it("set_title_screen 이 검색 결과 id 를 그대로 받아 배경을 건다", () => {
      const hit = searchResources("backdrop", "sky")[0]!;
      expect(hit.id.startsWith("backdrop:")).toBe(true);
      expect(hit.resourceId).toBe(hit.id.slice("backdrop:".length));
      const ctx: ToolContext = { project: createBlankProject() };
      const result = runTool(ctx, "set_title_screen", { title: "잠의 서랍", backgroundResourceId: hit.id });
      expect(result.ok, result.summary + JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.system.titleScreen?.backgroundResourceId).toBe(hit.resourceId);
    });
  });
});

// Validators and graphs read `script` command effects (openwiki/script-sandbox.md 「검증기」).
// Effects are hand-written here — no TypeScript compiler involved.
describe("scriptEffectsValidation", () => {
  isolateTimers();
  function effects(partial: Partial<ScriptEffects>): ScriptEffects {
    return { reads: [], writes: [], calls: [], dynamic: [], ...partial };
  }
  function script(fx: ScriptEffects | undefined, compiled = "/* compiled */"): Command {
    return { kind: "script", source: "// ts", compiled, ...(fx ? { effects: fx } : {}) } as Command;
  }
  function page(id: string, commands: Command[], conditions: EventPage["conditions"] = []): EventPage {
    return {
      id, name: id, conditions, graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    } as EventPage;
  }
  function event(id: string, x: number, pages: EventPage[]): GameEvent {
    return { id, name: id, x, y: 1, trigger: { kind: "action" }, commands: [], pages } as GameEvent;
  }
  function project(): Project {
    const p = createBlankProject();
    p.switches = [...p.switches, { id: "sw_gate", name: "gate open" }];
    return p;
  }
  function startMap(p: Project) {
    return p.maps[p.startMapId]!;
  }
  describe("script effects helpers", () => {
    it("merges @lib effects transitively with a cycle guard", () => {
      const library = [
        { id: "a", source: "", compiled: "x", effects: effects({ writes: [{ kind: "switch", id: "sw_a" }], calls: [{ kind: "library", id: "b" }] }) },
        { id: "b", source: "", compiled: "x", effects: effects({ calls: [{ kind: "commonEvent", id: "ce_b" }, { kind: "library", id: "a" }] }) },
      ];
      const merged = expandScriptEffects(effects({ calls: [{ kind: "library", id: "a" }] }), library);
      expect(merged.writes).toEqual([{ kind: "switch", id: "sw_a" }]);
      expect(merged.calls.map((ref) => `${ref.kind}:${ref.id}`).sort()).toEqual(["commonEvent:ce_b", "library:a", "library:b"]);
    });

    it("treats compiled scripts without effects as fully dynamic, empty ones as inert", () => {
      expect(scriptHasDynamic(script(undefined), "switch", { access: "write" })).toBe(true);
      expect(scriptCommandEffects({ kind: "script", compiled: "  " })).toEqual(effects({}));
    });

    it("maps dynamic api names to ref kinds", () => {
      expect(dynamicRefKinds("setSwitch")).toEqual([{ kind: "switch", access: "write" }]);
      expect(dynamicRefKinds("cmd.transfer.mapId")).toEqual([{ kind: "map", access: "call" }]);
      expect(dynamicRefKinds("cmd").length).toBeGreaterThan(10);
      const fx = script(effects({ dynamic: [{ api: "getSwitch", line: 3 }] }));
      expect(scriptHasDynamic(fx, "switch", { access: "write" })).toBe(false);
      expect(scriptHasDynamic(fx, "switch", { access: "read" })).toBe(true);
    });

    it("resolves switch names to ids", () => {
      const p = project();
      const command = script(effects({ writes: [{ kind: "switch", id: "gate open" }] }));
      expect(scriptWrites(command, "switch", p)).toEqual(["sw_gate"]);
    });
  });
  describe("validators read script effects", () => {
    it("a switch written only by a script is not reported as never set", () => {
      const p = project();
      startMap(p).events.push(
        event("ev_lever", 2, [page("p1", [script(effects({ writes: [{ kind: "switch", id: "sw_gate" }] }))])]),
        event("ev_door", 4, [page("p1", [{ kind: "text", body: "closed" } as Command]), page("p2", [{ kind: "text", body: "open" } as Command], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
      );
      const codes = checkProgression(p).filter((finding) => finding.code === "page-switch-never-set");
      expect(codes).toEqual([]);
      const index = buildStoryFlagUsageIndex(p);
      expect(usageBucketFor(index, "switch", "sw_gate").writes.map((site) => site.detail)).toContain("script");
    });

    it("removing the only setSwitch event is not stranded when a script also writes the switch", () => {
      const p = project();
      startMap(p).events.push(
        event("ev_boss", 2, [page("p1", [{ kind: "setSwitch", switchId: "sw_gate", value: true } as Command])]),
        event("ev_lever", 3, [page("p1", [script(effects({ writes: [{ kind: "switch", id: "sw_gate" }] }))])]),
        event("ev_door", 5, [page("p1", [], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
      );
      expect(strandedByRemoval(p, p.startMapId, "ev_boss")).toEqual([]);
      // Control: without the script the same removal is stranded.
      startMap(p).events = startMap(p).events.filter((entry) => entry.id !== "ev_lever");
      expect(strandedByRemoval(p, p.startMapId, "ev_boss").map((entry) => entry.switchId)).toEqual(["sw_gate"]);
    });

    it("dynamic switch writes downgrade never-set to info with a note", () => {
      const p = project();
      startMap(p).events.push(
        event("ev_lever", 2, [page("p1", [script(effects({ dynamic: [{ api: "setSwitch", line: 1 }] }))])]),
        event("ev_door", 4, [page("p1", [], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
      );
      const hits = checkProgression(p).filter((finding) => finding.code === "page-switch-never-set");
      expect(hits).toHaveLength(1);
      expect(hits[0]!.severity).toBe("info");
      expect(hits[0]!.message).toContain("계산된 id");
    });

    it("a common event called only by a script is referenced (delete guard, usage)", () => {
      const p = project();
      p.commonEvents.push({ id: "ce_reward", name: "reward", trigger: "none", commands: [] });
      expect(projectCommonEventReferenceMessage(p, "ce_reward")).toBeNull();
      startMap(p).events.push(event("ev_chest", 2, [page("p1", [script(effects({ calls: [{ kind: "commonEvent", id: "ce_reward" }] }))])]));
      expect(projectScriptUsage(p).ids("call", "commonEvent").has("ce_reward")).toBe(true);
      expect(projectCommonEventReferenceMessage(p, "ce_reward")).toContain("스크립트");
    });

    it("a script transfer is a map edge in the game-check graph", () => {
      const p = project();
      const start = startMap(p);
      const cave = { ...structuredClone(start), id: "map_cave", name: "cave", events: [] };
      p.maps[cave.id] = cave;
      const before = buildMapGraph(p);
      expect(before.reachable.has("map_cave")).toBe(false);
      start.events.push(event("ev_portal", 2, [page("p1", [script(effects({ calls: [{ kind: "map", id: "map_cave" }] }))])]));
      const graph = buildMapGraph(p);
      expect(graph.edges.some((edge) => edge.via === "script" && edge.from === p.startMapId && edge.to === "map_cave")).toBe(true);
      expect(graph.reachable.has("map_cave")).toBe(true);
      // Script edges have no landing cell — no out-of-bounds finding for them.
      expect(checkMapGraph(p, graph).filter((finding) => finding.code === "transfer-out-of-bounds")).toEqual([]);
      expect(scriptCalls(start.events.at(-1)!.pages![0]!.commands[0], "map", p)).toEqual(["map_cave"]);
    });

    it("library effects count for the command that imports them", () => {
      const p = project();
      p.scriptLibrary = [{ id: "gates", source: "", compiled: "x", effects: effects({ writes: [{ kind: "switch", id: "sw_gate" }] }) }];
      startMap(p).events.push(
        event("ev_lever", 2, [page("p1", [script(effects({ calls: [{ kind: "library", id: "gates" }] }))])]),
        event("ev_door", 4, [page("p1", [], [{ kind: "switch", switchId: "sw_gate", value: true }])]),
      );
      expect(checkProgression(p).filter((finding) => finding.code === "page-switch-never-set")).toEqual([]);
      expect(projectScriptUsage(p).ids("write", "switch").has("sw_gate")).toBe(true);
    });

    it("a script on the event suppresses the self-switch gate judgement", () => {
      const pages = [page("p1", [script(effects({}))]), page("p2", [], [{ kind: "selfSwitch", key: "A", value: true }])];
      expect(findUnwrittenSelfSwitchGates({ pages })).toEqual([]);
    });

    it("projectLint warns (not errors) about literal script refs to missing records", () => {
      const p = project();
      startMap(p).events.push(event("ev_x", 2, [page("p1", [script(effects({ writes: [{ kind: "item", id: "item_nope" }] }))])]));
      const issues = projectLint(p, { skipRoundtrip: true }).filter((issue) => issue.code === "script-reference-missing");
      expect(issues).toHaveLength(1);
      expect(issues[0]!.severity).toBe("warning");
    });
  });
});
