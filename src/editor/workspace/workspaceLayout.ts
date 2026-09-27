// editor/workspace/workspaceLayout.ts
// 워크스페이스 레이아웃 — 어떤 패널이 어느 도크에 있고 얼마나 넓은지. 데이터다.
//
// 프리셋은 작업 자체가 아니라 패널 배치다. 실제 작업 시작은 authoringTasks가 담당하며,
// 배치만 바꾼다.
//
// 초보/표준/전문가 편집 모드(`EditorUiMode`)와 거기서 파생되던 밀도(`density`)는
// 2026-09-27 에 없앴다 — 편집기 화면은 하나다. 옛 저장값에 남은 `density` 는 읽지 않는다.

import { STORAGE_PREFIX } from "@/util/appStorage";
import { defaultDockFor, isPanelId, sortPanels, type DockZone, type PanelId } from "@/editor/workspace/panelRegistry";

export const WORKSPACE_STORAGE_KEY = `${STORAGE_PREFIX}workspace:v1`;

export type WorkspacePresetId = "map" | "event" | "data";

// 패널 **크기**(좌패널 폭·맵 트리 높이)는 여기서 다루지 않는다. 기존 `oprn:editor-layout:v4`
// 가 이미 저장하고 리사이저가 그 값을 쓴다. 같은 수치를 워크스페이스에도 넣으면 원천이
// 둘이 되고, 옮기려면 기존 사용자 저장값 이전이 필요하다 — 이번 라운드 범위 밖이다.
// 도크가 다루는 것은 **구성**(어떤 패널이 어디에)뿐이다.

export type WorkspaceLayout = {
  readonly presetId: WorkspacePresetId;
  readonly docks: Readonly<Record<DockZone, readonly PanelId[]>>;
};

export type WorkspacePreset = {
  readonly id: WorkspacePresetId;
  readonly label: string;
  readonly hint: string;
  readonly docks: Readonly<Record<DockZone, readonly PanelId[]>>;
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
    label: "맵 중심",
    hint: "타일 팔레트와 맵 트리를 왼쪽에 둔다",
    docks: { left: ["tiles", "maps"], right: ["assistant"], bottom: [] },
  },
  {
    id: "event",
    label: "이벤트 중심",
    hint: "팔레트를 접고 맵 트리와 조수에 집중한다",
    docks: { left: ["maps"], right: ["assistant"], bottom: [] },
  },
  {
    id: "data",
    label: "데이터 중심",
    hint: "자료집을 넓게 쓰고 조수만 곁에 둔다",
    docks: { left: [], right: ["assistant"], bottom: [] },
  },
] as const;

const PRESET_BY_ID = new Map(WORKSPACE_PRESETS.map((preset) => [preset.id, preset]));

export function presetById(id: WorkspacePresetId): WorkspacePreset {
  return PRESET_BY_ID.get(id) ?? WORKSPACE_PRESETS[0]!;
}

export function layoutFromPreset(id: WorkspacePresetId): WorkspaceLayout {
  const preset = presetById(id);
  return { presetId: preset.id, docks: preset.docks };
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

/**
 * 저장값 파싱. 깨진 값은 조용히 기본으로 되돌린다 — 레이아웃이 부팅을 막을 이유가 없다.
 */
export function parseWorkspaceLayout(raw: string | null): WorkspaceLayout {
  const fallback = layoutFromPreset("map");
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
  return { presetId, docks };
}

/** 도크마다 레지스트리 순서로 정렬한다 — 자리마다 성격이 다르다(sortPanels 주석 참고). */
function structuredDocks(docks: Readonly<Record<DockZone, readonly PanelId[]>>): Record<DockZone, PanelId[]> {
  return {
    left: sortPanels(docks.left),
    right: sortPanels(docks.right),
    bottom: sortPanels(docks.bottom),
  };
}

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
