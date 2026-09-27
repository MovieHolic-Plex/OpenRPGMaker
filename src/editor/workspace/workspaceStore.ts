// editor/workspace/workspaceStore.ts
// 워크스페이스 레이아웃의 살아 있는 상태 + `oprn:workspace:v1` 저장.
//
// 2026-09-03 까지 있던 `setWorkspaceDensity`(밀도 이름으로 편집 모드를 바꾸던 두 번째 함수)와
// `setWorkspacePreset`(톱바 작업 칩이 부르던 도크 프리셋)은 그 표면들과 함께 걷었다.
// 밀도 자체는 2026-09-27 에 편집 모드와 함께 없앴다.

import type { DockZone, PanelId } from "@/editor/workspace/panelRegistry";
import {
  closePanel,
  movePanel,
  parseWorkspaceLayout,
  reopenPanel,
  serializeWorkspaceLayout,
  WORKSPACE_STORAGE_KEY,
  type WorkspaceLayout,
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
  return parseWorkspaceLayout(raw);
}

export function getWorkspaceLayout(): WorkspaceLayout {
  if (!current) current = hydrate();
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
 * 도크 구성 갱신.
 * 구독자가 다시 그린다 — 호출자가 직접 렌더하면 전환 1회에 2번 그려진다.
 */
export function updateWorkspaceLayout(next: WorkspaceLayout): void {
  current = next;
  persist(current);
  notify();
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
