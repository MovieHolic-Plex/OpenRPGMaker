// editor/workspace/workspaceLayout.ts
// 워크스페이스 레이아웃 — 어떤 패널이 어느 도크에 있고 얼마나 넓은지. 데이터다.
//
// ── 왜 프리셋이 3단 모드를 대체하나 ─────────────────────────────────────────────
// 초보/표준/전문가는 **밀도** 축 하나를 세 칸으로 쪼갠 것이었다. 그런데 실제로 감독이
// 하는 일은 세 종류다 — 맵을 그리거나, 이벤트를 연출하거나, 자료(밸런스)를 만진다.
// 일마다 필요한 패널이 다르므로 "얼마나 빽빽하게 보여줄까"보다 "지금 무슨 일을 하나"가
// 더 쓸모 있는 축이다. 그래서 사용자에게 보이는 컨트롤은 **작업 프리셋**이 되고,
// 밀도는 프리셋에 딸린 값이 된다.
//
// ⚠ 단계적 이행: `EditorUiMode`(beginner/standard/expert)와 `EditorChromeVisibility`
// 18개 플래그는 **아직 살아 있다.** 프리셋이 그 모드를 파생시키므로 기존 플래그와
// CSS 게이트 38곳이 그대로 동작한다. 플래그를 실제로 걷어내는 일(패널 구성으로 대체된
// mapTree·paletteRail·leftPanelMaxWidthPx 삭제 등)은 CSS 38곳을 함께 고쳐야 하고
// 검증 단위가 커서 다음 라운드로 남긴다. 지금 바뀌는 것은 **사용자가 만지는 축**이다.

import { STORAGE_PREFIX } from "@/util/appStorage";
import type { EditorUiMode } from "@/editor/editorUiMode";
import { defaultDockFor, isPanelId, sortPanels, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";

export const WORKSPACE_STORAGE_KEY = `${STORAGE_PREFIX}workspace:v1`;

export type WorkspacePresetId = "map" | "event" | "data";

/** 정보 밀도 — 예전 3단 모드에서 "얼마나 빽빽한가" 만 남긴 축. */
export type WorkspaceDensity = "guided" | "comfortable" | "dense";

// 패널 **크기**(좌패널 폭·맵 트리 높이)는 여기서 다루지 않는다. 기존 `oprn:editor-layout:v4`
// 가 이미 저장하고 리사이저가 그 값을 쓴다. 같은 수치를 워크스페이스에도 넣으면 원천이
// 둘이 되고, 옮기려면 기존 사용자 저장값 이전이 필요하다 — 이번 라운드 범위 밖이다.
// 도크가 다루는 것은 **구성**(어떤 패널이 어디에)뿐이다.

export type WorkspaceLayout = {
  readonly presetId: WorkspacePresetId;
  /**
   * **파생값.** 저장하지 않는다 — `editorUiMode` 가 밀도의 유일한 원천이고 이 필드는 그것을
   * 읽어 온 사본이다. 커맨드 팔레트·코치마크가 모드를 직접 바꿔도 두 값이 갈라지지 않게
   * 하려면 원천이 하나여야 한다.
   */
  readonly density: WorkspaceDensity;
  readonly docks: Readonly<Record<DockZone, readonly PanelId[]>>;
};

export type WorkspacePreset = {
  readonly id: WorkspacePresetId;
  readonly label: string;
  readonly hint: string;
  readonly docks: Readonly<Record<DockZone, readonly PanelId[]>>;
  readonly density: WorkspaceDensity;
};

/**
 * 작업 프리셋. 「무슨 일을 하나」로 갈린다.
 *
 * · 맵 그리기  — 타일과 맵 트리가 둘 다 왼쪽에. 예전 표준/전문가 화면과 사실상 같다.
 * · 이벤트 연출 — 타일 팔레트를 접는다(이벤트 편집은 모달이고 팔레트를 안 쓴다).
 *                맵 트리만 남겨 장면 간 이동을 빠르게 하고 조수를 넓게 쓴다.
 * · 자료 밸런싱 — 자료집이 모달로 화면을 덮으므로 왼쪽 도크를 비운다. 조수만 남긴다.
 */
export const WORKSPACE_PRESETS: readonly WorkspacePreset[] = [
  {
    id: "map",
    label: "맵 그리기",
    hint: "타일 팔레트와 맵 트리를 왼쪽에 둔다",
    docks: { left: ["tiles", "maps"], right: ["assistant"], bottom: [] },
    density: "comfortable",
  },
  {
    id: "event",
    label: "이벤트 연출",
    hint: "팔레트를 접고 맵 트리와 조수에 집중한다",
    docks: { left: ["maps"], right: ["assistant"], bottom: [] },
    density: "comfortable",
  },
  {
    id: "data",
    label: "자료 밸런싱",
    hint: "자료집을 넓게 쓰고 조수만 곁에 둔다",
    docks: { left: [], right: ["assistant"], bottom: [] },
    density: "dense",
  },
] as const;

const PRESET_BY_ID = new Map(WORKSPACE_PRESETS.map((preset) => [preset.id, preset]));

export function presetById(id: WorkspacePresetId): WorkspacePreset {
  return PRESET_BY_ID.get(id) ?? WORKSPACE_PRESETS[0]!;
}

export function layoutFromPreset(id: WorkspacePresetId): WorkspaceLayout {
  const preset = presetById(id);
  return { presetId: preset.id, density: preset.density, docks: preset.docks };
}

/**
 * 밀도 → 기존 `EditorUiMode` 파생.
 *
 * 이 함수가 이행의 핵심이다 — 사용자는 프리셋·밀도만 만지고, 18개 크롬 플래그와
 * `.editor-ui-*` CSS 게이트는 여기서 나온 모드로 예전처럼 동작한다. 플래그를 실제로
 * 걷어낼 때 이 함수가 삭제 지점이 된다.
 */
export function uiModeForDensity(density: WorkspaceDensity): EditorUiMode {
  if (density === "guided") return "beginner";
  if (density === "dense") return "expert";
  return "standard";
}

/** 역방향 — 기존 저장값(3단 모드)에서 처음 워크스페이스를 만들 때 쓴다. */
export function densityForUiMode(mode: EditorUiMode): WorkspaceDensity {
  if (mode === "beginner") return "guided";
  if (mode === "expert") return "dense";
  return "comfortable";
}

function parseDocks(value: unknown): Record<DockZone, PanelId[]> | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const out: Record<DockZone, PanelId[]> = { left: [], right: [], bottom: [] };
  const seen = new Set<PanelId>();
  for (const zone of ["left", "right", "bottom"] as const) {
    const raw = record[zone];
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      if (!isPanelId(entry) || seen.has(entry)) continue;
      seen.add(entry);
      out[zone].push(entry);
    }
  }
  return { left: sortPanels(out.left), right: sortPanels(out.right), bottom: sortPanels(out.bottom) };
}

function isPresetId(value: unknown): value is WorkspacePresetId {
  return value === "map" || value === "event" || value === "data";
}

/** 메뉴 dataset 처럼 문자열로 들어오는 밀도값 검증용. */
export function isWorkspaceDensity(value: unknown): value is WorkspaceDensity {
  return value === "guided" || value === "comfortable" || value === "dense";
}

/**
 * 저장값 파싱. 깨진 값은 조용히 기본으로 되돌린다 — 레이아웃이 부팅을 막을 이유가 없다.
 * 밀도는 저장값을 **읽지 않는다**: 항상 `mode`(=`editorUiMode`)에서 파생시켜, 쓰던 3단
 * 모드가 그대로 첫 화면 밀도가 되게 한다.
 */
export function parseWorkspaceLayout(raw: string | null, mode: EditorUiMode): WorkspaceLayout {
  const density = densityForUiMode(mode);
  const fallback = { ...layoutFromPreset("map"), density };
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== "object" || parsed === null) return fallback;
  const record = parsed as Record<string, unknown>;
  const presetId: WorkspacePresetId = isPresetId(record["presetId"]) ? record["presetId"] : "map";
  const preset = presetById(presetId);
  const docks = parseDocks(record["docks"]) ?? structuredDocks(preset.docks);
  return { presetId, density, docks };
}

/** 도크마다 레지스트리 순서로 정렬한다 — 자리마다 성격이 다르다(sortPanels 주석 참고). */
function structuredDocks(docks: Readonly<Record<DockZone, readonly PanelId[]>>): Record<DockZone, PanelId[]> {
  return {
    left: sortPanels(docks.left),
    right: sortPanels(docks.right),
    bottom: sortPanels(docks.bottom),
  };
}

/** `density` 는 일부러 빠진다 — `editorUiMode` 가 자기 키에 저장한다(원천 하나). */
export function serializeWorkspaceLayout(layout: WorkspaceLayout): string {
  return JSON.stringify({
    presetId: layout.presetId,
    docks: layout.docks,
  });
}

/**
 * 패널을 다른 도크로 옮긴다. 같은 패널이 두 도크에 있지 않도록 먼저 뺀다.
 * 넣은 뒤 **다시 정렬**한다 — push 로 끝내면 클릭 순서가 자리를 결정해 그리드 행이
 * 어긋난다(팔레트가 300px 칸에 갇혀 73px 로 찌그러졌다. sortPanels 주석 참고).
 */
export function movePanel(layout: WorkspaceLayout, panelId: PanelId, target: DockZone): WorkspaceLayout {
  const docks = structuredDocks(layout.docks);
  for (const zone of ["left", "right", "bottom"] as const) {
    docks[zone] = docks[zone].filter((id) => id !== panelId);
  }
  docks[target] = sortPanels([...docks[target], panelId]);
  return { ...layout, docks };
}

/** 패널을 닫는다(어느 도크에도 없는 상태). 선호 도크는 registry 가 기억하므로 복구 가능. */
export function closePanel(layout: WorkspaceLayout, panelId: PanelId): WorkspaceLayout {
  const docks = structuredDocks(layout.docks);
  for (const zone of ["left", "right", "bottom"] as const) {
    docks[zone] = docks[zone].filter((id) => id !== panelId);
  }
  return { ...layout, docks };
}

/** 닫힌 패널을 선호 도크로 되돌린다. */
export function reopenPanel(layout: WorkspaceLayout, panelId: PanelId): WorkspaceLayout {
  if (visiblePanels(layout).includes(panelId)) return layout;
  return movePanel(layout, panelId, defaultDockFor(panelId));
}

export function visiblePanels(layout: WorkspaceLayout): readonly PanelId[] {
  return [...layout.docks.left, ...layout.docks.right, ...layout.docks.bottom];
}

export function isPanelVisible(layout: WorkspaceLayout, panelId: PanelId): boolean {
  return visiblePanels(layout).includes(panelId);
}

export function dockOf(layout: WorkspaceLayout, panelId: PanelId): DockZone | null {
  for (const zone of ["left", "right", "bottom"] as const) {
    if (layout.docks[zone].includes(panelId)) return zone;
  }
  return null;
}
