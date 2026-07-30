// editor/editorToolHook.ts
// 헤드리스(Playwright) 에디터 조작 훅 — 플레이어의 __rpgzzuInput 훅과 같은 계열.
// window.__rpgzzuEditorTool(name, args)로 에디터 툴을 직접 실행한다.
// 쓰기 툴 성공 시 undo 스냅샷을 남기고 store에 반영하므로 Ctrl+Z 복구가 가능하다.

import { editorState } from "@/editor/editorState";
import {
  stampFootprintHouseKit,
  stampRectHouseKit,
  type FootprintHousePlan,
  type RectHousePlan,
  type RectHouseStampResult,
} from "@/editor/houseKit";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  applyBuildPalettePrimitive,
  ensureBuildPalettePresets,
  type BuildPaletteApplyOptions,
  type BuildPalettePrimitive,
  type BuildPaletteResult,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { openRegionTaskModal } from "@/editor/panels/regionTaskModal";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { runRegionTask, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { commitChangeset, getTool, runTool } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools";
import { store } from "@/project/store";
import type { GameEvent, MapId } from "@/project/types";

type RegionWrite = { readonly layer: "lower" | "upper"; readonly x: number; readonly y: number; readonly tile: number };

// 헤드리스 영역 작업 검증용. Phaser 캔버스 입력/LLM 없이 실제 store에 clip/적용을 재현한다.
type RegionTaskHarness = {
  currentMapId: () => MapId;
  setSelection: (selection: { mapId: MapId; x: number; y: number; width: number; height: number } | null) => void;
  readCell: (mapId: MapId, layer: "lower" | "upper", x: number, y: number) => number | null;
  runMock: (mapId: MapId, region: RegionRect, writes: readonly RegionWrite[]) => Promise<RegionTaskResult>;
  /** writes 를 주면 모달이 그 결과로 자동 실행되어 제안 검토 UI 까지 렌더된다. */
  openModal: (
    mapId: MapId,
    region: RegionRect,
    writes?: readonly RegionWrite[],
    events?: readonly GameEvent[],
  ) => void;
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
  // 하네싱 집 키트 시공 — 기준 집 문법(houseKit) 그대로. 커밋 게이트(신규 오류만 차단) 포함.
  __rpgzzuHouseKit?: (mapId: MapId, plan: RectHousePlan) => RectHouseStampResult;
  // 임의 평면(ㄱ/ㄴ/ㄷ/ㅁ/O …) — 날개 사각형 합집합을 하네싱 국소 규칙으로 전개.
  __rpgzzuFootprintHouse?: (mapId: MapId, plan: FootprintHousePlan) => RectHouseStampResult;
};

const MAP_ONLY_WRITE_TOOLS = new Set([
  "paint_tiles",
  "paint_road",
  "stamp_structure",
  "build_house",
  "build_house_kit",
  "build_house_lots",
  "build_village",
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

  w.__rpgzzuHouseKit = (mapId, plan) => {
    const current = store.getCurrent();
    if (!current.maps[mapId]) return { ok: false, reason: `맵을 찾을 수 없습니다: ${mapId}` };
    const draft = structuredClone(current);
    // 키트 벽 세트가 문/창 배치의 "승인된 벽 어휘" 검사를 통과하도록 프리셋/승인 상태를 보장.
    const tileset = draft.tilesets[draft.maps[mapId].tilesetId];
    if (tileset) ensureBuildPalettePresets(tileset);
    const result = stampRectHouseKit(draft.maps[mapId], plan);
    if (!result.ok) return result;
    const commit = commitChangeset(draft, current);
    if (!commit.ok) {
      const issue = commit.issues.find((entry) => entry.severity === "error");
      return { ok: false, reason: issue?.message ?? "무결성 오류" };
    }
    recordProjectSnapshot(`집 키트: ${plan.kitId}`, mapId, { kind: "map" });
    store.replace(draft);
    return result;
  };

  w.__rpgzzuFootprintHouse = (mapId, plan) => {
    const current = store.getCurrent();
    if (!current.maps[mapId]) return { ok: false, reason: `맵을 찾을 수 없습니다: ${mapId}` };
    const draft = structuredClone(current);
    const tileset = draft.tilesets[draft.maps[mapId].tilesetId];
    if (tileset) ensureBuildPalettePresets(tileset);
    const result = stampFootprintHouseKit(draft.maps[mapId], plan);
    if (!result.ok) return result;
    const commit = commitChangeset(draft, current);
    if (!commit.ok) {
      const issue = commit.issues.find((entry) => entry.severity === "error");
      return { ok: false, reason: issue?.message ?? "무결성 오류" };
    }
    recordProjectSnapshot(`평면 집 키트: ${plan.kitId}`, mapId, { kind: "map" });
    store.replace(draft);
    return result;
  };

  w.__rpgzzuRegionTaskHarness = {
    currentMapId: () => editorState.get().currentMapId ?? store.getCurrent().startMapId,
    setSelection: (selection) => editorState.set({ selection: selection ?? null }),
    readCell: (mapId, layer, x, y) => {
      const map = store.getCurrent().maps[mapId];
      if (!map) return null;
      const index = y * map.width + x;
      const value = layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index];
      return value ?? null;
    },
    // 결정적 세션(주어진 writes를 proposed로 산출)을 주입해 승인 게이트까지 재현한다 —
    // 적용하려면 반환된 result.pending.apply() 또는 window.__rpgzzuRegionTaskPending.apply()를 호출.
    runMock: (mapId, region, writes) => runMockRegionTask(mapId, region, writes, "headless mock"),
    // 모달을 통째로 목업 실행에 물린다 — 제안 검토 UI(before/after, 변경 칸 하이라이트,
    // 적용/다시 만들기/버리기)는 실제 LLM 없이 이 경로로만 e2e 검증할 수 있다.
    openModal: (mapId, region, writes, events) => {
      openRegionTaskModal({
        mapId,
        region,
        ...(writes
          ? {
              initialInstruction: "여기에 둥근 호수를 만들어줘",
              autoRun: true,
              run: ({ instruction }) => runMockRegionTask(mapId, region, writes, instruction, events),
            }
          : {}),
      });
    },
  };
}

/** runMock/openModal 공용 — 주어진 writes 를 proposed 로 산출하는 결정적 세션.
 *  events 를 주면 그 맵의 이벤트 목록에 덧붙인다 — 변경 목록(NPC·상자 줄) e2e 검증용. */
function runMockRegionTask(
  mapId: MapId,
  region: RegionRect,
  writes: readonly RegionWrite[],
  instruction: string,
  events?: readonly GameEvent[],
): Promise<RegionTaskResult> {
  return runRegionTask(
        { mapId, region, instruction },
        {
          getProject: () => store.getCurrent(),
          applyProject: (project, label, snapshotMapId) => {
            recordProjectSnapshot(label, snapshotMapId, { kind: "map" });
            store.replace(project);
          },
          createSession: (project) => ({
            // 실제 세션은 tool_call 이벤트로 고스트 프리뷰 업데이터를 흘려보내지만,
            // 목업은 툴콜 스트림이 없으므로 여기서 직접 하나 흘려 캔버스 고스트/인라인
            // 승인 툴바가 실제 세션과 동일하게 렌더되도록 재현한다(writes 자체는 getProposedProject가 반영).
            sendUserMessage: async (_text, onEvent) => {
              if (writes.length > 0) {
                onEvent?.({ type: "tool_call", name: "paint_tiles", args: { mapId }, result: { ok: true, summary: "mock" } });
              }
              return { assistantText: "mock", proposedCalls: [], stoppedReason: "final" };
            },
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
                if (events && events.length > 0) {
                  map.events = [...(map.events ?? []), ...structuredClone(events as GameEvent[])];
                }
              }
              return next;
            },
          }),
        },
      );
}
