// editor/workspace/workspaceStore.ts
// 워크스페이스 레이아웃의 살아 있는 상태 + `oprn:workspace:v1` 저장.
//
// 밀도(density)는 여기서 **소유하지 않는다** — `editorUiMode` 가 원천이고 이 모듈은 읽기만
// 한다. 밀도를 바꾸는 요청은 `setEditorUiMode` 로 넘긴다. 그래야 커맨드 팔레트의
// 「전문가 모드」 명령이나 코치마크가 모드를 직접 바꿔도 두 값이 갈라지지 않는다.

import { getEditorUiMode, setEditorUiMode } from "@/editor/editorUiMode";
import type { DockZone, PanelId } from "@/editor/workspace/panelRegistry";
import {
  closePanel,
  densityForUiMode,
  layoutFromPreset,
  movePanel,
  parseWorkspaceLayout,
  presetById,
  reopenPanel,
  serializeWorkspaceLayout,
  uiModeForDensity,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceDensity,
  type WorkspaceLayout,
  type WorkspacePresetId,
} from "@/editor/workspace/workspaceLayout";

type Listener = () => void;

let current: WorkspaceLayout | null = null;
const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function hydrate(): WorkspaceLayout {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(WORKSPACE_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  return parseWorkspaceLayout(raw, getEditorUiMode());
}

/** 밀도는 매번 `editorUiMode` 에서 다시 읽는다 — 사본이 낡지 않게. */
function withLiveDensity(layout: WorkspaceLayout): WorkspaceLayout {
  const density = densityForUiMode(getEditorUiMode());
  return layout.density === density ? layout : { ...layout, density };
}

export function getWorkspaceLayout(): WorkspaceLayout {
  if (!current) current = hydrate();
  current = withLiveDensity(current);
  return current;
}

function persist(layout: WorkspaceLayout): void {
  try {
    storage()?.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspaceLayout(layout));
  } catch {
    /* private mode / quota — 레이아웃 저장 실패가 편집을 막을 이유는 없다 */
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * 도크 구성·크기 갱신. 밀도는 무시된다(원천이 editorUiMode).
 * 구독자가 다시 그린다 — 호출자가 직접 렌더하면 전환 1회에 2번 그려진다.
 */
export function updateWorkspaceLayout(next: WorkspaceLayout): void {
  current = withLiveDensity(next);
  persist(current);
  notify();
}

/**
 * 프리셋은 도크 구성만 바꾼다. 현재 밀도/EditorUiMode는 사용자의 별도 선택이므로 보존한다.
 */
export function setWorkspacePreset(id: WorkspacePresetId): void {
  const preset = presetById(id);
  current = { ...layoutFromPreset(preset.id), density: densityForUiMode(getEditorUiMode()) };
  persist(current);
  notify();
}

/** 밀도만 바꾼다. 프리셋 구성은 건드리지 않는다 — 두 축은 독립이다. */
export function setWorkspaceDensity(density: WorkspaceDensity): void {
  const targetMode = uiModeForDensity(density);
  if (targetMode === getEditorUiMode()) return;
  setEditorUiMode(targetMode);
}

export function moveWorkspacePanel(panelId: PanelId, zone: DockZone): void {
  updateWorkspaceLayout(movePanel(getWorkspaceLayout(), panelId, zone));
}

export function toggleWorkspacePanel(panelId: PanelId): void {
  const layout = getWorkspaceLayout();
  const visible = [...layout.docks.left, ...layout.docks.right, ...layout.docks.bottom].includes(panelId);
  updateWorkspaceLayout(visible ? closePanel(layout, panelId) : reopenPanel(layout, panelId));
}

export function subscribeWorkspace(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 테스트 헬퍼 — 실제 localStorage 를 건드리지 않고 모듈 상태만 되돌린다. */
export function resetWorkspaceForTests(layout?: WorkspaceLayout): void {
  current = layout ?? null;
  listeners.clear();
}
