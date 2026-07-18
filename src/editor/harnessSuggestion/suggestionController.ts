// harnessSuggestion/suggestionController.ts
// §③ "찍으면 배운다" — 편집 스트림 관찰 → 휴지기 감지 → 조용한 제안 1장.
// 예절 구현: 붓질 중 표출 금지(휴지 2초), 한 번에 1개, [무시] 세션 톰스톤,
// 등록된 패턴 재제안 금지, 붓질 재개 시 소리 없이 소멸.

import { editorState } from "@/editor/editorState";
import { detectRepeatedSectionPattern, type PatternRegion } from "@/editor/harnessSuggestion/patternDetect";
import {
  dismissSuggestionCard,
  isSuggestionCardVisible,
  showSuggestionCard,
} from "@/editor/harnessSuggestion/suggestionCard";
import { registerStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { paletteStampFromKit, registeredKitSignatures } from "@/editor/harnessSuggestion/structureKitModel";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

/** 마지막 편집 후 이 시간이 지나야 제안을 표출한다(설계 미결 다이얼 — 프로토 기본 2초). */
const IDLE_DELAY_MS = 2000;
/** 감지 영역 여유 — 최근 편집 bbox 를 상하좌우로 넓혀 패턴 경계 절단을 막는다. */
const REGION_MARGIN_TILES = 6;

type DirtyRect = { x0: number; y0: number; x1: number; y1: number };

let installed = false;
let unsubscribeStore: (() => void) | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const dirtyByMap = new Map<MapId, DirtyRect>();
/** [무시] 톰스톤 — 세션(페이지 수명) 동안 같은 패턴 재제안 금지. */
const ignoredSignatures = new Set<string>();

export function installHarnessSuggestionController(): void {
  if (installed) return;
  installed = true;
  unsubscribeStore = store.subscribe((_project, change) => {
    if (change.scope !== "map") return;
    const tileCells = change.cells?.filter((cell) => cell.layer !== "event") ?? [];
    if (tileCells.length === 0) return;
    // 붓질 중 — 떠 있는 카드는 소리 없이 사라진다(톰스톤 아님).
    dismissSuggestionCard();
    const rect = dirtyByMap.get(change.mapId) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const cell of tileCells) {
      rect.x0 = Math.min(rect.x0, cell.x);
      rect.y0 = Math.min(rect.y0, cell.y);
      rect.x1 = Math.max(rect.x1, cell.x);
      rect.y1 = Math.max(rect.y1, cell.y);
    }
    dirtyByMap.set(change.mapId, rect);
    scheduleIdleCheck();
  });
}

export function uninstallHarnessSuggestionController(): void {
  installed = false;
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = null;
  dirtyByMap.clear();
  dismissSuggestionCard();
}

function scheduleIdleCheck(): void {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    runIdleCheck();
  }, IDLE_DELAY_MS);
}

function runIdleCheck(): void {
  if (!installed) return;
  if (isSuggestionCardVisible()) return; // 한 번에 하나.
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  if (!map) return;
  const dirty = dirtyByMap.get(mapId);
  if (!dirty || !Number.isFinite(dirty.x0)) return;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return;

  const region: PatternRegion = {
    x: Math.max(0, dirty.x0 - REGION_MARGIN_TILES),
    y: Math.max(0, dirty.y0 - REGION_MARGIN_TILES),
    width: dirty.x1 - dirty.x0 + 1 + REGION_MARGIN_TILES * 2,
    height: dirty.y1 - dirty.y0 + 1 + REGION_MARGIN_TILES * 2,
  };
  const pattern = detectRepeatedSectionPattern(map, { region });
  if (!pattern) return;
  // 확신 임계 미달·기등록·무시 톰스톤은 전부 침묵.
  if (ignoredSignatures.has(pattern.signature)) return;
  if (registeredKitSignatures(tileset).has(pattern.signature)) return;

  showSuggestionCard({
    map,
    tileset,
    pattern,
    onRegister: (kit) => {
      const registered = registerStructureKit(map.tilesetId, kit);
      dirtyByMap.delete(mapId);
      // 등록 즉시 브러시를 그 스탬프로 — "네 번째부터는 스탬프로 찍는다"의 최단 경로.
      editorState.set({
        activePaletteStamp: paletteStampFromKit(registered),
        activeStampId: null,
        activeStructureStampId: null,
        tool: "paint",
      });
      toast(`'${registered.name ?? "패턴"}' 스탬프 등록 — 팔레트 '내 스탬프'에서 다시 고를 수 있어요`, "info");
    },
    onIgnore: () => {
      ignoredSignatures.add(pattern.signature);
      dirtyByMap.delete(mapId);
    },
  });
}
