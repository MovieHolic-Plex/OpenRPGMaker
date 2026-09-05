import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { WorldRef } from "@/project/world/types";
import { clearChildren, el } from "@/util/dom";
import {
  type WorldLintSummary,
  type WorldPanelOptions,
  type WorldPanelState,
  currentWorld,
  ensureSelectedEntity,
  jumpToWorldRefTarget,
  setPersistedCodexView,
  summarizeWorldLint,
} from "./worldManager";
import { renderHeader, renderMain } from "./worldPanelViews";
import { readCodexEntryFromUrl, writeCodexEntryToUrl } from "./worldEntries";

export { openWorldCodexPanel, openWorldPanel } from "./worldEntries";

export function renderWorldPanel(options: WorldPanelOptions = {}): HTMLElement {
  const state: WorldPanelState = {
    tab: options.initialTab ?? "overview",
    search: "",
    selectedId: options.initialEntityId ?? null,
    addType: "character",
    editDraft: null,
    editError: "",
  };
  const root = el("section", {
    class: options.embedded ? "world-panel world-panel-embedded" : "world-panel",
    attrs: { role: options.embedded ? "region" : "dialog", "aria-label": "설정집" },
    dataset: { testid: "world-panel" },
  });

  let urlAdopted = false;

  const refresh = (): void => {
    const project = store.getCurrent();
    const world = currentWorld(project);
    const lint = memoWorldLint(project, world);
    if (!urlAdopted) {
      urlAdopted = true;
      adoptCodexUrlEntry(state, world);
    }
    ensureSelectedEntity(state, world);
    syncCodexUrl(state);
    clearChildren(root);
    root.append(renderHeader(state, refresh, options), renderMain(state, world, project, lint, refresh));
  };

  refresh();
  return root;
}

export function jumpToWorldRef(ref: WorldRef, project: Project = store.getCurrent()): boolean {
  return jumpToWorldRefTarget(ref, project);
}

// 첫 렌더에서만 URL 딥링크를 받아 탭·선택을 세운다 — 이후 카드 클릭이 URL 을
// 쓰는 쪽이므로 매번 읽으면 뒤로가기 대신 클릭이 진다. 플래그는 패널 인스턴스별이다.
function adoptCodexUrlEntry(state: WorldPanelState, world: ReturnType<typeof currentWorld>): void {
  if (typeof window === "undefined") return;
  const entry = readCodexEntryFromUrl(window.location.search);
  if (!entry) return;
  if (!world.entities.some((entity) => entity.id === entry.entityId)) return;
  state.tab = entry.tab;
  state.selectedId = entry.entityId;
  state.editDraft = null;
  state.editError = "";
  setPersistedCodexView(state.tab, state.selectedId);
}

// 카드 클릭 같은 명시적 선택만 URL 에 기록한다 — 마운트 시 복원된 선택으로
// URL 을 덮으면 새로고침·공유 링크가 깨진다. 이미 같은 값이 있으면 쓰지 않는다.
function syncCodexUrl(state: WorldPanelState): void {
  if (!state.selectedId || typeof window === "undefined") return;
  const current = readCodexEntryFromUrl(window.location.search);
  if (current && current.tab === state.tab && current.entityId === state.selectedId) return;
  writeCodexEntryToUrl(state.tab, state.selectedId);
}

// 검색 타이핑·탭 전환 같은 비저장 리렌더에서는 전체 lint 를 다시 돌리지 않는다.
// store.getCurrent() 는 저장 전까지 같은 객체를 돌려주므로 프로젝트 참조가
// 그대로면 이전 요약을 재사용한다. 저장(writeCanon·saveDraft·잠금)은 새 객체를
// 만들므로 캐시는 그때만 무효화된다.
let memoProject: Project | null = null;
let memoLint: WorldLintSummary | null = null;

function memoWorldLint(project: Project, world: ReturnType<typeof currentWorld>): WorldLintSummary {
  if (memoLint && memoProject === project) return memoLint;
  memoProject = project;
  memoLint = summarizeWorldLint(world, project);
  return memoLint;
}
