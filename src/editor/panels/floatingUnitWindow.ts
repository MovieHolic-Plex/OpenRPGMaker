// editor/panels/floatingUnitWindow.ts
// Phase 2 (SCMDraft 2 감성): 위로 길게 뜨는 드래그 가능한 플로팅 「유닛 팔레트」 창.
// - 좌하단 독 「유닛」 또는 U 키로 토글
// - 현재 맵의 시작 위치 ★ + 배치된 NPC·적/보스·이동/문을 실제 캐릭터 스프라이트와 함께 세로 리스트로 표시
// - 행 클릭 시 카메라 점프 + 선택, 「편집」으로 이벤트 편집기 즉시 열기, 「+ 새 유닛」으로 빠른 추가

import { editorState } from "@/editor/editorState";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { triggerLabel } from "@/editor/eventMarkerUx";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { renderEventGraphicIcon } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { eventDisplayName } from "@/project/eventDisplayName";
import { store } from "@/project/store";
import type { Command, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type UnitFilterId = "all" | "npc" | "enemy" | "portal";
type UnitKind = Exclude<UnitFilterId, "all">;

const FILTERS: readonly { readonly id: UnitFilterId; readonly label: string }[] = [
  { id: "all", label: "전체" },
  { id: "npc", label: "NPC" },
  { id: "enemy", label: "적·보스" },
  { id: "portal", label: "이동·문" },
];

function hasCommand(commands: readonly Command[] | undefined, kind: Command["kind"]): boolean {
  if (!commands) return false;
  for (const cmd of commands) {
    if (cmd.kind === kind) return true;
    if (cmd.kind === "fork" && (hasCommand(cmd.then, kind) || hasCommand(cmd.else, kind))) return true;
    if (cmd.kind === "choices") {
      if (cmd.options.some((opt) => hasCommand(opt.branch, kind)) || hasCommand(cmd.cancelBranch, kind)) return true;
    }
    if (cmd.kind === "loop" && hasCommand(cmd.body, kind)) return true;
  }
  return false;
}

function classifyUnit(ev: GameEvent): UnitKind {
  const pages = ev.pages?.length ? ev.pages : [{ commands: ev.commands }];
  if (pages.some((p) => hasCommand(p.commands, "transfer"))) return "portal";
  if (pages.some((p) => hasCommand(p.commands, "battleProcessing"))) return "enemy";
  if (/적|몬스터|보스|산적|슬라임|전투|enemy|boss|monster/iu.test(ev.name ?? "")) return "enemy";
  return "npc";
}

function unitGraphic(ev: GameEvent): EventPageGraphic | null {
  if (ev.pages?.length) {
    for (const page of ev.pages) {
      if (page.graphic.sprite) {
        return page.graphic;
      }
    }
    return ev.pages[0]?.graphic ?? null;
  }
  return null;
}

function unitTriggerText(ev: GameEvent): string {
  const trig = ev.pages?.[0]?.trigger ?? ev.trigger;
  return triggerLabel(trig);
}

function freeEventCell(map: GameMap): { readonly x: number; readonly y: number } {
  const taken = new Set(map.events.map((ev) => `${ev.x},${ev.y}`));
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  for (let r = 0; r < Math.max(map.width, map.height); r += 1) {
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r; x <= cx + r; x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (!taken.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return { x: Math.max(0, cx), y: Math.max(0, cy) };
}

export interface FloatingUnitWindowMount {
  readonly isOpen: () => boolean;
  readonly setOpen: (next: boolean) => void;
  readonly toggle: () => void;
  readonly dispose: () => void;
}

export function mountFloatingUnitWindow(
  canvasArea: HTMLElement,
  onOpenChange: (open: boolean) => void = () => {},
): FloatingUnitWindowMount {
  let open = false;
  let activeFilter: UnitFilterId = "all";
  let searchQuery = "";
  let customPos: { x: number; y: number } | null = null;

  const newUnitBtn = el("button", {
    class: "fdw-head-btn is-primary",
    attrs: { type: "button", title: "빈 칸에 새 유닛/이벤트 추가" },
    dataset: { testid: "floating-unit-new" },
    text: "+ 새 유닛",
    on: {
      click: () => {
        const { mapId, map } = currentContext();
        if (!mapId || !map) return;
        const cell = freeEventCell(map);
        openNewEventEditorModal(mapId, cell.x, cell.y);
      },
    },
  }) as HTMLButtonElement;

  const closeBtn = el("button", {
    class: "fdw-head-btn",
    attrs: { type: "button", title: "유닛 팔레트 닫기 (Esc)", "aria-label": "유닛 팔레트 닫기" },
    dataset: { testid: "floating-unit-close" },
    text: "✕",
    on: { click: () => setOpen(false) },
  }) as HTMLButtonElement;

  const titleBar = el("div", {
    class: "fdw-titlebar",
    dataset: { testid: "floating-unit-titlebar" },
    children: [
      el("div", {
        class: "fdw-title",
        children: [
          el("span", { text: "유닛 팔레트" }),
          el("kbd", { class: "fdw-kbd", text: "U" }),
        ],
      }),
      el("div", { class: "fdw-title-actions", children: [newUnitBtn, closeBtn] }),
    ],
  });

  const searchInput = el("input", {
    class: "fdw-search",
    attrs: { type: "search", placeholder: "NPC · 적 · 이동 문 찾기…", "aria-label": "유닛 찾기", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: "floating-unit-search" },
  }) as HTMLInputElement;

  const filterBar = el("div", { class: "fdw-tabs", attrs: { role: "tablist", "aria-label": "유닛 분류" } });
  const filterButtons = new Map<UnitFilterId, HTMLButtonElement>();
  for (const filter of FILTERS) {
    const btn = el("button", {
      class: "fdw-tab" + (filter.id === activeFilter ? " is-active" : ""),
      attrs: { type: "button", role: "tab", "aria-selected": String(filter.id === activeFilter) },
      dataset: { testid: `floating-unit-filter-${filter.id}` },
      text: filter.label,
      on: {
        click: () => {
          activeFilter = filter.id;
          syncFilterButtons();
          renderList();
        },
      },
    }) as HTMLButtonElement;
    filterButtons.set(filter.id, btn);
    filterBar.append(btn);
  }

  const listBody = el("div", { class: "fuw-body", dataset: { testid: "floating-unit-list" } });
  const statusText = el("span", { class: "fdw-status-name", dataset: { testid: "floating-unit-status" }, text: "" });
  const foot = el("div", { class: "fdw-foot", children: [statusText] });

  const win = el("section", {
    class: "floating-doodad-window floating-unit-window",
    attrs: { role: "dialog", "aria-label": "유닛 팔레트" },
    dataset: { testid: "floating-unit-window" },
    children: [titleBar, el("div", { class: "fdw-controls", children: [searchInput, filterBar] }), listBody, foot],
  });
  win.hidden = true;

  function currentContext(): { readonly project: Project; readonly mapId: string | null; readonly map: GameMap | undefined } {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    return { project, mapId, map: mapId ? project.maps[mapId] : undefined };
  }

  function syncFilterButtons(): void {
    for (const [id, btn] of filterButtons.entries()) {
      const active = id === activeFilter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    }
  }

  function renderList(): void {
    if (!open) return;
    const { project, mapId, map } = currentContext();
    const state = editorState.get();
    clearChildren(listBody);

    if (!mapId || !map) {
      statusText.textContent = "선택된 맵 없음";
      listBody.append(el("div", { class: "fdw-empty", text: "맵을 먼저 선택하세요." }));
      return;
    }

    const q = searchQuery.trim().toLowerCase();
    const counts = { all: map.events.length, npc: 0, enemy: 0, portal: 0 };
    const classified = map.events.map((ev) => {
      const kind = classifyUnit(ev);
      counts[kind] += 1;
      return { ev, kind, name: eventDisplayName(ev) };
    });

    for (const filter of FILTERS) {
      const btn = filterButtons.get(filter.id);
      if (btn) btn.textContent = counts[filter.id] > 0 ? `${filter.label} ${counts[filter.id]}` : filter.label;
    }

    // Start position pinned card (when viewing start map and not filtered out)
    if (!q && activeFilter === "all" && project.startMapId === mapId && project.startPos) {
      const startRow = el("button", {
        class: "fuw-row is-start",
        attrs: { type: "button", title: `주인공 시작 위치 (${project.startPos.x}, ${project.startPos.y})로 카메라 이동` },
        dataset: { testid: "floating-unit-start-row" },
        children: [
          el("span", { class: "fuw-kind-bar is-start", attrs: { "aria-hidden": "true" } }),
          el("div", { class: "fuw-thumb is-start-icon", text: "★" }),
          el("div", {
            class: "fuw-info",
            children: [
              el("span", { class: "fuw-name", text: "주인공 시작 위치" }),
              el("span", { class: "fuw-sub", text: `시작점 · (${project.startPos.x}, ${project.startPos.y})` }),
            ],
          }),
        ],
        on: {
          click: () => {
            requestEditorCameraFocus({ mapId, tileX: project.startPos.x + 0.5, tileY: project.startPos.y + 0.5 });
          },
        },
      });
      listBody.append(startRow);
    }

    const filtered = classified.filter(({ kind, name }) => {
      if (activeFilter !== "all" && kind !== activeFilter) return false;
      if (q && !name.toLowerCase().includes(q)) return false;
      return true;
    });

    for (const { ev, kind, name } of filtered) {
      const selected = state.selectedEventId === ev.id;
      const graphic = unitGraphic(ev);
      const thumb = el("div", { class: "fuw-thumb" });
      if (graphic?.sprite) {
        thumb.append(renderEventGraphicIcon(graphic, { scale: 1.25 }));
      } else {
        thumb.textContent = kind === "portal" ? "🚪" : kind === "enemy" ? "⚔" : "●";
        thumb.classList.add("is-fallback");
      }

      const kindLabel = kind === "portal" ? "이동" : kind === "enemy" ? "적·전투" : "NPC";
      const editBtn = el("button", {
        class: "fuw-edit-btn",
        attrs: { type: "button", title: `${name} 이벤트 편집 열기` },
        text: "편집",
        on: {
          click: (event) => {
            event.stopPropagation();
            selectSidebarLayer("event");
            editorState.set({ selectedEventId: ev.id, selectedEventPageId: null });
            openEventEditorModal(mapId, ev.id);
          },
        },
      });

      const row = el("div", {
        class: "fuw-row" + (selected ? " is-active" : ""),
        attrs: { role: "button", tabindex: "0", title: `${name} (${ev.x}, ${ev.y})로 이동` },
        dataset: { testid: `floating-unit-row-${ev.id}` },
        children: [
          el("span", { class: `fuw-kind-bar is-${kind}`, attrs: { "aria-hidden": "true" } }),
          thumb,
          el("div", {
            class: "fuw-info",
            children: [
              el("span", { class: "fuw-name", text: name }),
              el("span", { class: "fuw-sub", text: `${kindLabel} · ${unitTriggerText(ev)} · (${ev.x}, ${ev.y})` }),
            ],
          }),
          editBtn,
        ],
        on: {
          click: () => {
            selectSidebarLayer("event");
            editorState.set({ selectedEventId: ev.id, selectedEventPageId: null });
            requestEditorCameraFocus({ mapId, tileX: ev.x + 0.5, tileY: ev.y + 0.5 });
          },
          dblclick: () => {
            selectSidebarLayer("event");
            editorState.set({ selectedEventId: ev.id, selectedEventPageId: null });
            openEventEditorModal(mapId, ev.id);
          },
          keydown: (event) => {
            if (!(event instanceof KeyboardEvent)) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectSidebarLayer("event");
              editorState.set({ selectedEventId: ev.id, selectedEventPageId: null });
              requestEditorCameraFocus({ mapId, tileX: ev.x + 0.5, tileY: ev.y + 0.5 });
            }
          },
        },
      });
      listBody.append(row);
    }

    if (filtered.length === 0) {
      listBody.append(el("div", { class: "fdw-empty", text: q ? "일치하는 유닛이 없습니다." : "배치된 유닛이 없습니다. 「+ 새 유닛」으로 추가하세요." }));
    }

    statusText.textContent = `유닛 ${map.events.length}개 · 클릭 점프 · 더블클릭 편집`;
  }

  function applyPosition(): void {
    if (!customPos) return;
    win.style.left = `${customPos.x}px`;
    win.style.top = `${customPos.y}px`;
    win.style.bottom = "auto";
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    win.hidden = !open;
    if (open) {
      applyPosition();
      renderList();
    }
    onOpenChange(open);
  }

  // Smooth drag-to-move title bar
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  titleBar.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    try { titleBar.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });
  titleBar.addEventListener("pointermove", (event: PointerEvent) => {
    if (!dragging) return;
    const hostRect = canvasArea.getBoundingClientRect();
    const maxX = Math.max(8, hostRect.width - win.offsetWidth - 8);
    const maxY = Math.max(8, hostRect.height - win.offsetHeight - 8);
    const x = Math.max(8, Math.min(maxX, Math.round(event.clientX - hostRect.left - offsetX)));
    const y = Math.max(8, Math.min(maxY, Math.round(event.clientY - hostRect.top - offsetY)));
    customPos = { x, y };
    applyPosition();
  });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    try {
      if (titleBar.hasPointerCapture?.(event.pointerId)) titleBar.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  };
  titleBar.addEventListener("pointerup", endDrag);
  titleBar.addEventListener("pointercancel", endDrag);

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderList();
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (hasOpenModalLayer() || shouldIgnoreEditorShortcut(event)) return;
    if (event.key.toLowerCase() === "u") {
      event.preventDefault();
      selectSidebarLayer("event");
      setOpen(!open);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  const unsubEditor = editorState.subscribe(() => {
    if (open) renderList();
  });
  const unsubStore = store.subscribe(() => {
    if (open) renderList();
  });

  canvasArea.append(win);

  return {
    isOpen: () => open,
    setOpen,
    toggle: () => setOpen(!open),
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubEditor();
      unsubStore();
      win.remove();
    },
  };
}
