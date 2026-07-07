// editor/editorToolHook.ts
// 헤드리스(Playwright) 에디터 조작 훅 — 플레이어의 __rpgzzuInput 훅과 같은 계열.
// window.__rpgzzuEditorTool(name, args)로 에디터 툴을 직접 실행한다.
// 쓰기 툴 성공 시 undo 스냅샷을 남기고 store에 반영하므로 Ctrl+Z 복구가 가능하다.

import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  applyBuildPalettePrimitive,
  type BuildPaletteApplyOptions,
  type BuildPalettePrimitive,
  type BuildPaletteResult,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { runRegionTask, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { getTool, runTool } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

type RegionWrite = { readonly layer: "lower" | "upper"; readonly x: number; readonly y: number; readonly tile: number };

// 헤드리스 영역 작업 검증용. Phaser 캔버스 입력/LLM 없이 실제 store에 clip/적용을 재현한다.
type RegionTaskHarness = {
  setSelection: (selection: { mapId: MapId; x: number; y: number; width: number; height: number } | null) => void;
  readCell: (mapId: MapId, layer: "lower" | "upper", x: number, y: number) => number | null;
  runMock: (mapId: MapId, region: RegionRect, writes: readonly RegionWrite[]) => Promise<RegionTaskResult>;
  openModal: (mapId: MapId, region: RegionRect) => void;
};

type EditorToolHookWindow = Window & {
  __rpgzzuEditorTool?: (name: string, args: Record<string, unknown>) => ToolResult;
  __rpgzzuRegionTaskHarness?: RegionTaskHarness;
  // 헤드리스 건축 팔레트 — UI 드래그 없이 프리미티브/프리셋 시공을 재현(스냅샷+store 반영+자동저장 동일).
  __rpgzzuBuildPalette?: (
    selection: BuildPaletteSelection,
    primitive: BuildPalettePrimitive,
    options?: BuildPaletteApplyOptions
  ) => BuildPaletteResult;
};

const MAP_ONLY_WRITE_TOOLS = new Set([
  "paint_tiles",
  "paint_road",
  "stamp_structure",
  "stamp_template_house",
  "build_house",
  "clear_region",
  "set_map_properties",
  "place_npc",
  "upsert_event",
  "move_event",
  "remove_event",
]);

function recordToolSnapshot(name: string, args: Record<string, unknown>): void {
  const mapId = typeof args.mapId === "string" ? args.mapId : null;
  if (mapId && MAP_ONLY_WRITE_TOOLS.has(name)) {
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
    return;
  }
  recordProjectSnapshot();
}

export function installEditorToolHook(): void {
  if (typeof window === "undefined") return;
  const w = window as EditorToolHookWindow;
  w.__rpgzzuEditorTool = (name, args) => {
    const ctx = { project: store.getCurrent() };
    const result = runTool(ctx, name, args, { dryRun: false });
    const tool = getTool(name);
    if (result.ok && tool?.mode === "write") {
      recordToolSnapshot(name, args);
      store.replace(ctx.project); // runTool이 성공 시 ctx.project를 커밋된 draft로 교체한다.
    }
    return result;
  };

  w.__rpgzzuBuildPalette = (selection, primitive, options = {}) =>
    applyBuildPalettePrimitive(selection, primitive, options);

  w.__rpgzzuRegionTaskHarness = {
    setSelection: (selection) => editorState.set({ selection: selection ?? null }),
    readCell: (mapId, layer, x, y) => {
      const map = store.getCurrent().maps[mapId];
      if (!map) return null;
      const index = y * map.width + x;
      const value = layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index];
      return value ?? null;
    },
    // 결정적 세션(주어진 writes를 proposed로 산출)을 주입해 실제 store에 clip/적용한다.
    runMock: (mapId, region, writes) =>
      runRegionTask(
        { mapId, region, instruction: "headless mock" },
        {
          getProject: () => store.getCurrent(),
          applyProject: (project, label, snapshotMapId) => {
            recordProjectSnapshot(label, snapshotMapId, { kind: "map" });
            store.replace(project);
          },
          createSession: (project) => ({
            sendUserMessage: async () => ({ assistantText: "mock", proposedCalls: [], stoppedReason: "final" }),
            getProposedProject: () => {
              const next = structuredClone(project);
              const map = next.maps[mapId];
              if (map) {
                for (const write of writes) {
                  const index = write.y * map.width + write.x;
                  if (index < 0 || index >= map.lowerTiles.length) continue;
                  if (write.layer === "upper") map.upperTiles[index] = write.tile;
                  else map.lowerTiles[index] = write.tile;
                }
              }
              return next;
            },
          }),
        },
      ),
    openModal: (mapId, region) => {
      openRegionTaskModal({ mapId, region });
    },
  };
}
