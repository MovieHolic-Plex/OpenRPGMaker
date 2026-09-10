// editor/mapLocationLayer.ts
// 명명 로케이션 편집 레이어의 화면. 캔버스 위에 얹히는 DOM 오버레이 하나 + 그 안의 인스펙터.
//
// 왜 DOM 인가: 이름·메모·버튼이 붙는 저작 표면이고, Phaser 텍스처로 그리면 한글 라벨과
// 접근성(포커스·키보드)을 다시 만들어야 한다. 기존 `layoutBboxOverlay` 와 같은 자리
// (`.phaser-container` 자식)에 붙되, **레이어가 켜졌을 때만** `pointer-events` 를 받는다 —
// 꺼져 있으면 타일 편집을 한 픽셀도 방해하지 않는다.
//
// 제스처 계약(로케이션 레이어가 켜진 동안만):
//   - 빈 곳 드래그          → 새 구역을 그린다(놓는 순간 생성 + 선택 + 이름 입력 포커스)
//   - 구역 클릭             → 선택
//   - 선택된 구역의 몸통 드래그 → 이동
//   - 선택된 구역의 우하단 손잡이 드래그 → 크기 변경
//   - Delete/Backspace      → 선택 구역 삭제(참조가 있으면 확인 문구를 먼저 보여준다)
//   - Escape                → 선택 해제, 드래그 취소
// 겹침은 허용이므로 클릭 판정은 «가장 구체적인(작은) 구역» 이 이긴다(순수 모듈 규칙).

import { TILE_SIZE } from "@/assets/bundled";
import { editorState } from "@/editor/editorState";
import { resolveClientPointTile } from "@/editor/regionClientRect";
import {
  adoptLayoutRegions,
  createLocationFromRect,
  currentLocationMap,
  deleteLocation,
  locationAt,
  locationDeletionImpact,
  locationLayerState,
  locationReferenceCount,
  renameSelectedLocation,
  repairBrokenLocationReferences,
  resizeLocation,
  selectLocation,
  selectedLocation,
  selectedOverlaps,
  setLocationDrag,
  setShowLayoutRegions,
  subscribeLocationLayer,
  toggleLocationLayer,
  updateLocationNote,
  type LocationActionResult,
} from "@/editor/mapLocationLayerState";
import { collectMapLocationReferenceIssues } from "@/project/mapLocationReferences";
import { locationDisplayColor, mapLocations, rectFromDrag } from "@/project/mapNamedLocations";
import { store } from "@/project/store";
import type { GameMap, MapNamedLocation, Rect } from "@/project/types";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

let overlayEl: HTMLElement | null = null;
let inspectorEl: HTMLElement | null = null;
let teardown: (() => void) | null = null;
/** 방금 만든 구역의 이름 칸에 초점을 준다 — 그리자마자 이름을 붙이는 게 이 레이어의 목적이다. */
let focusNameOnNextRender = false;

function ensureHost(): HTMLElement | null {
  const host = document.querySelector<HTMLElement>(".phaser-container");
  if (!host) return null;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  return host;
}

function ensureOverlay(): HTMLElement | null {
  if (overlayEl?.isConnected) return overlayEl;
  const host = ensureHost();
  if (!host) return null;
  overlayEl = el("div", { class: "map-location-layer", dataset: { testid: "map-location-layer" } });
  host.appendChild(overlayEl);
  return overlayEl;
}

function ensureInspector(): HTMLElement | null {
  if (inspectorEl?.isConnected) return inspectorEl;
  const host = ensureHost();
  if (!host) return null;
  inspectorEl = el("div", { class: "map-location-inspector", dataset: { testid: "map-location-inspector" } });
  host.appendChild(inspectorEl);
  return inspectorEl;
}

function tileToOverlayRect(rect: Rect): { left: number; top: number; width: number; height: number } {
  const zoom = editorState.get().zoom ?? 1;
  return {
    left: rect.x * TILE_SIZE * zoom,
    top: rect.y * TILE_SIZE * zoom,
    width: Math.max(1, rect.w * TILE_SIZE * zoom),
    height: Math.max(1, rect.h * TILE_SIZE * zoom),
  };
}

function report(result: LocationActionResult): void {
  if (!result.ok) {
    toast(result.error, "error");
    return;
  }
  if (result.message) toast(result.message, "info");
}

// ───────────────────────────────────────────────────────────────── 렌더

function render(): void {
  const state = locationLayerState();
  const overlay = ensureOverlay();
  const inspector = ensureInspector();
  if (!overlay || !inspector) return;
  overlay.classList.toggle("is-active", state.enabled);
  inspector.classList.toggle("is-active", state.enabled);
  if (!state.enabled) {
    clearChildren(overlay);
    clearChildren(inspector);
    return;
  }
  const map = currentLocationMap();
  clearChildren(overlay);
  clearChildren(inspector);
  if (!map) return;
  renderBoxes(overlay, map, state.selectedId);
  renderDragPreview(overlay);
  inspector.append(renderInspector(map, state.selectedId));
}

function renderBoxes(overlay: HTMLElement, map: GameMap, selectedId: string | null): void {
  const state = locationLayerState();
  if (state.showLayoutRegions) {
    for (const region of map.layoutPlan?.regions ?? []) {
      const geometry = tileToOverlayRect(region);
      const box = el("div", {
        class: "map-location-region-ghost",
        dataset: { testid: `map-location-region-${region.id}` },
        children: [el("span", { class: "map-location-region-label", text: `설계 ${region.label}` })],
      });
      Object.assign(box.style, {
        left: `${geometry.left}px`,
        top: `${geometry.top}px`,
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
      });
      overlay.append(box);
    }
  }
  // 큰 구역이 작은 구역을 덮지 않도록 넓은 것부터 그린다(겹침 허용의 시각 대응).
  const ordered = [...mapLocations(map)].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const location of ordered) {
    const selected = location.id === selectedId;
    const geometry = tileToOverlayRect(location);
    const color = locationDisplayColor(location);
    const box = el("div", {
      class: `map-location-box${selected ? " is-selected" : ""}`,
      attrs: { role: "button", tabindex: "0", "aria-label": `구역 ${location.name}`, "aria-pressed": String(selected) },
      dataset: { testid: `map-location-box-${location.id}`, locationId: location.id },
    });
    Object.assign(box.style, {
      left: `${geometry.left}px`,
      top: `${geometry.top}px`,
      width: `${geometry.width}px`,
      height: `${geometry.height}px`,
      "--map-location-color": color,
    });
    box.append(
      el("span", {
        class: "map-location-box-label",
        text: location.name,
        dataset: { testid: `map-location-label-${location.id}` },
      }),
    );
    if (selected) {
      box.append(
        el("span", {
          class: "map-location-resize-handle",
          attrs: { "aria-hidden": "true" },
          dataset: { testid: `map-location-resize-${location.id}` },
        }),
      );
    }
    box.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLocation(location.id);
      }
    });
    overlay.append(box);
  }
}

function renderDragPreview(overlay: HTMLElement): void {
  const drag = locationLayerState().drag;
  if (!drag) return;
  const rect =
    drag.kind === "draw"
      ? rectFromDrag(drag.from, drag.to)
      : drag.kind === "resize"
        ? rectFromDrag(drag.anchor, drag.to)
        : { ...drag.origin };
  const geometry = tileToOverlayRect(rect);
  const preview = el("div", { class: "map-location-draw-preview", dataset: { testid: "map-location-draw-preview" } });
  Object.assign(preview.style, {
    left: `${geometry.left}px`,
    top: `${geometry.top}px`,
    width: `${geometry.width}px`,
    height: `${geometry.height}px`,
  });
  preview.append(el("span", { class: "map-location-draw-size", text: `${rect.w}×${rect.h}` }));
  overlay.append(preview);
}

// ───────────────────────────────────────────────────────────── 인스펙터

function renderInspector(map: GameMap, selectedId: string | null): HTMLElement {
  const panel = el("div", { class: "map-location-inspector-body" });
  const locations = mapLocations(map);
  panel.append(
    el("div", {
      class: "map-location-inspector-header",
      children: [
        el("strong", { text: "로케이션 레이어" }),
        el("button", {
          class: "btn btn-ghost",
          text: "닫기",
          attrs: { type: "button", title: "레이어 끄기" },
          dataset: { testid: "map-location-layer-close" },
          on: { click: () => toggleLocationLayer() },
        }),
      ],
    }),
  );
  panel.append(
    el("p", {
      class: "map-location-hint",
      text:
        locations.length === 0
          ? "빈 곳을 드래그하면 새 구역이 생깁니다. 구역은 이름으로 이벤트 조건과 랜덤 인카운터가 가리킵니다."
          : "구역을 눌러 고르고, 몸통을 끌어 옮기고, 오른쪽 아래 손잡이로 크기를 바꿉니다.",
      dataset: { testid: "map-location-hint" },
    }),
  );

  if (map.layoutPlan?.regions.length) {
    const toggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "map-location-show-regions" } }) as HTMLInputElement;
    toggle.checked = locationLayerState().showLayoutRegions;
    toggle.addEventListener("change", () => setShowLayoutRegions(toggle.checked));
    const row = el("label", { class: "map-location-check-row" });
    row.append(toggle, el("span", { text: `빌더 설계 영역 ${map.layoutPlan.regions.length}개 함께 보기` }));
    panel.append(
      row,
      el("button", {
        class: "btn",
        text: "설계 영역을 구역으로 가져오기",
        attrs: { type: "button", title: "layoutPlan.regions 를 복사한다. 설계 기록 자체는 바뀌지 않는다." },
        dataset: { testid: "map-location-adopt-regions" },
        on: { click: () => report(adoptLayoutRegions()) },
      }),
    );
  }

  panel.append(renderList(locations, selectedId));
  const selected = selectedLocation();
  if (selected) panel.append(renderSelectedEditor(selected));
  const issues = renderBrokenReferences(map);
  if (issues) panel.append(issues);
  return panel;
}

function renderList(locations: readonly MapNamedLocation[], selectedId: string | null): HTMLElement {
  const list = el("ul", { class: "map-location-list", dataset: { testid: "map-location-list" } });
  if (locations.length === 0) {
    list.append(el("li", { class: "map-location-empty", text: "아직 구역이 없습니다." }));
    return list;
  }
  for (const location of locations) {
    const item = el("li", { class: location.id === selectedId ? "is-selected" : "" });
    item.append(
      el("button", {
        class: "map-location-list-button",
        attrs: { type: "button", "aria-pressed": String(location.id === selectedId) },
        dataset: { testid: `map-location-list-${location.id}` },
        on: { click: () => selectLocation(location.id) },
        children: [
          el("span", { class: "map-location-list-name", text: location.name }),
          el("span", { class: "map-location-list-rect", text: `(${location.x},${location.y}) ${location.w}×${location.h}` }),
        ],
      }),
    );
    list.append(item);
  }
  return list;
}

function renderSelectedEditor(location: MapNamedLocation): HTMLElement {
  const box = el("div", { class: "map-location-editor", dataset: { testid: "map-location-editor" } });
  const name = el("input", {
    attrs: { type: "text", "aria-label": "구역 이름", maxlength: "64" },
    value: location.name,
    dataset: { testid: "map-location-name-input" },
  }) as HTMLInputElement;
  const commitName = (): void => {
    if (name.value.trim() === location.name) return;
    report(renameSelectedLocation(location.id, name.value));
  };
  name.addEventListener("change", commitName);
  name.addEventListener("blur", commitName);
  box.append(el("label", { class: "map-location-field", children: [el("span", { text: "이름" }), name] }));
  box.append(
    el("p", {
      class: "map-location-id",
      text: `ID ${location.id} — 이름을 바꿔도 이 ID 를 가리키는 조건·인카운터는 그대로입니다.`,
      dataset: { testid: "map-location-id" },
    }),
  );

  const rectRow = el("div", { class: "map-location-rect-row" });
  for (const key of ["x", "y", "w", "h"] as const) {
    const input = el("input", {
      attrs: { type: "number", min: key === "w" || key === "h" ? "1" : "0", "aria-label": `구역 ${key}` },
      value: String(location[key]),
      dataset: { testid: `map-location-rect-${key}` },
    }) as HTMLInputElement;
    input.addEventListener("change", () => {
      const value = Math.trunc(Number(input.value));
      if (!Number.isFinite(value)) return;
      report(resizeLocation(location.id, { x: location.x, y: location.y, w: location.w, h: location.h, [key]: value }));
    });
    rectRow.append(el("label", { class: "map-location-rect-field", children: [el("span", { text: key }), input] }));
  }
  box.append(rectRow);

  const note = el("textarea", {
    attrs: { rows: "2", placeholder: "이 구역의 저작 의도(조수도 읽습니다)", "aria-label": "구역 메모" },
    dataset: { testid: "map-location-note" },
  }) as HTMLTextAreaElement;
  note.value = location.note ?? "";
  note.addEventListener("change", () => report(updateLocationNote(location.id, note.value)));
  box.append(note);

  const overlaps = selectedOverlaps();
  if (overlaps.length > 0) {
    box.append(
      el("p", {
        class: "map-location-overlap",
        text: `겹치는 구역 ${overlaps.length}개: ${overlaps.map((entry) => entry.name).join(", ")} — 겹침은 허용됩니다. 한 칸을 여러 구역이 덮으면 조회는 가장 작은 구역을 먼저 씁니다.`,
        dataset: { testid: "map-location-overlap" },
      }),
    );
  }

  const references = locationReferenceCount(location.id);
  box.append(
    el("p", {
      class: "map-location-refs",
      text: references === 0 ? "이 구역을 가리키는 조건·인카운터가 없습니다." : `이 구역을 가리키는 참조 ${references}건.`,
      dataset: { testid: "map-location-refs" },
    }),
  );

  box.append(
    el("button", {
      class: "btn btn-danger",
      text: "구역 삭제",
      attrs: { type: "button" },
      dataset: { testid: "map-location-delete" },
      on: { click: () => confirmDelete(location.id) },
    }),
  );

  if (focusNameOnNextRender) {
    focusNameOnNextRender = false;
    queueMicrotask(() => {
      name.focus();
      name.select();
    });
  }
  return box;
}

function confirmDelete(locationId: string): void {
  const impact = locationDeletionImpact(locationId);
  if (impact && impact.sites.length > 0) {
    const proceed =
      typeof window === "undefined" ||
      window.confirm(
        `'${impact.name}' 을 지우면 ${impact.sites.length}건의 참조가 끊깁니다:\n${impact.sites.join("\n")}\n\n` +
          "지운 뒤 아래 「끊긴 참조」에서 다른 구역으로 다시 지정하거나, 예전 사각형으로 굳히거나, 조건을 뗄 수 있습니다.\n계속할까요?",
      );
    if (!proceed) return;
  }
  report(deleteLocation(locationId));
}

/**
 * 끊긴 참조 진단 + 복구 경로. **눈에 보이는 자리**가 있어야 삭제가 안전해진다.
 * 세 가지 복구를 준다: 다른 구역으로 다시 지정 / 예전 사각형으로 굳히기 / 조건 떼기.
 */
function renderBrokenReferences(map: GameMap): HTMLElement | null {
  const project = store.getCurrent();
  const missing = collectMapLocationReferenceIssues(project)
    .filter((issue) => issue.mapId === map.id && issue.code === "map-location-missing-ref");
  if (missing.length === 0) return null;
  const brokenIds = [...new Set(missing.map((issue) => issue.locationId))];
  const box = el("div", { class: "map-location-broken", dataset: { testid: "map-location-broken" } });
  box.append(el("strong", { text: `끊긴 참조 ${missing.length}건` }));
  for (const brokenId of brokenIds) {
    const row = el("div", { class: "map-location-broken-row", dataset: { testid: `map-location-broken-${brokenId}` } });
    row.append(
      el("p", {
        text: missing.filter((issue) => issue.locationId === brokenId).map((issue) => issue.message).join(" "),
      }),
    );
    const locations = mapLocations(map);
    if (locations.length > 0) {
      const picker = el("select", { dataset: { testid: `map-location-repair-target-${brokenId}` } }) as HTMLSelectElement;
      for (const location of locations) {
        picker.append(el("option", { attrs: { value: location.id }, text: location.name }));
      }
      row.append(
        picker,
        el("button", {
          class: "btn",
          text: "이 구역으로 다시 지정",
          attrs: { type: "button" },
          dataset: { testid: `map-location-repair-remap-${brokenId}` },
          on: { click: () => report(repairBrokenLocationReferences(brokenId, { kind: "remap", locationId: picker.value })) },
        }),
      );
    }
    row.append(
      el("button", {
        class: "btn btn-ghost",
        text: "구역 조건 떼기",
        attrs: { type: "button", title: "인카운터는 맵 전체가 되고, 이벤트 조건에서는 그 줄이 사라집니다." },
        dataset: { testid: `map-location-repair-detach-${brokenId}` },
        on: { click: () => report(repairBrokenLocationReferences(brokenId, { kind: "detach" })) },
      }),
    );
    box.append(row);
  }
  return box;
}

// ─────────────────────────────────────────────────────────────── 제스처

function overlayPointToTile(event: PointerEvent): { readonly x: number; readonly y: number } | null {
  const tile = resolveClientPointTile({ x: event.clientX, y: event.clientY });
  if (!tile) return null;
  const map = currentLocationMap();
  if (!map) return null;
  if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) return null;
  return tile;
}

function onPointerDown(event: PointerEvent): void {
  if (!locationLayerState().enabled || event.button !== 0) return;
  const tile = overlayPointToTile(event);
  if (!tile) return;
  const target = event.target as HTMLElement | null;
  const selected = selectedLocation();
  if (selected && target?.classList.contains("map-location-resize-handle")) {
    // 손잡이는 반대쪽 모서리를 고정하고 끈다.
    event.preventDefault();
    overlayEl?.setPointerCapture?.(event.pointerId);
    setLocationDrag({ kind: "resize", locationId: selected.id, anchor: { x: selected.x, y: selected.y }, to: tile });
    return;
  }
  const hit = locationAt(tile);
  if (hit) {
    event.preventDefault();
    selectLocation(hit.id);
    overlayEl?.setPointerCapture?.(event.pointerId);
    setLocationDrag({
      kind: "move",
      locationId: hit.id,
      grab: tile,
      origin: { x: hit.x, y: hit.y, w: hit.w, h: hit.h },
    });
    return;
  }
  event.preventDefault();
  selectLocation(null);
  overlayEl?.setPointerCapture?.(event.pointerId);
  setLocationDrag({ kind: "draw", from: tile, to: tile });
}

function onPointerMove(event: PointerEvent): void {
  const drag = locationLayerState().drag;
  if (!drag) return;
  const tile = overlayPointToTile(event);
  if (!tile) return;
  if (drag.kind === "draw" || drag.kind === "resize") {
    setLocationDrag({ ...drag, to: tile });
    return;
  }
  // 이동은 미리보기와 확정 기하를 같은 식으로 만든다 — 놓을 때 다시 계산하지 않는다.
  // 드래그 상태는 그대로 두고(재렌더 폭주 방지) 고스트만 직접 옮긴다.
  movePreview = {
    x: drag.origin.x + (tile.x - drag.grab.x),
    y: drag.origin.y + (tile.y - drag.grab.y),
    w: drag.origin.w,
    h: drag.origin.h,
  };
  renderMovePreview();
}

let movePreview: Rect | null = null;

function renderMovePreview(): void {
  const overlay = overlayEl;
  if (!overlay || !movePreview) return;
  const existing = overlay.querySelector<HTMLElement>(".map-location-draw-preview");
  const geometry = tileToOverlayRect(movePreview);
  const node = existing ?? el("div", { class: "map-location-draw-preview", dataset: { testid: "map-location-draw-preview" } });
  Object.assign(node.style, {
    left: `${geometry.left}px`,
    top: `${geometry.top}px`,
    width: `${geometry.width}px`,
    height: `${geometry.height}px`,
  });
  if (!existing) overlay.append(node);
}

function onPointerUp(event: PointerEvent): void {
  const drag = locationLayerState().drag;
  if (!drag) return;
  overlayEl?.releasePointerCapture?.(event.pointerId);
  const tile = overlayPointToTile(event) ?? (drag.kind === "draw" ? drag.to : undefined);
  setLocationDrag(null);
  if (drag.kind === "draw") {
    const rect = rectFromDrag(drag.from, tile ?? drag.to);
    focusNameOnNextRender = true;
    report(createLocationFromRect(rect));
    return;
  }
  if (drag.kind === "resize") {
    const rect = rectFromDrag(drag.anchor, tile ?? drag.to);
    report(resizeLocation(drag.locationId, rect));
    return;
  }
  const moved = movePreview;
  movePreview = null;
  if (!moved) return;
  if (moved.x === drag.origin.x && moved.y === drag.origin.y) return;
  report(resizeLocation(drag.locationId, moved));
}

function onKeyDown(event: KeyboardEvent): void {
  if (!locationLayerState().enabled) return;
  // 이 레이어는 캔버스 위의 비모달 표면이다. 모달(데이터베이스·이벤트 편집기 등)이 열려 있는
  // 동안 Escape/Delete 를 가로채면 위쪽 창의 취소 키를 훔친다 — 모달 계층이 살아 있으면 물러난다.
  if (hasOpenModalLayer()) return;
  const target = event.target as HTMLElement | null;
  const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable === true;
  if (event.key === "Escape") {
    if (locationLayerState().drag) {
      setLocationDrag(null);
      movePreview = null;
      event.preventDefault();
      return;
    }
    if (!typing && locationLayerState().selectedId) {
      selectLocation(null);
      event.preventDefault();
    }
    return;
  }
  if (typing) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const selected = locationLayerState().selectedId;
  if (!selected) return;
  event.preventDefault();
  confirmDelete(selected);
}

export function installMapLocationLayer(): () => void {
  render();
  const overlay = ensureOverlay();
  overlay?.addEventListener("pointerdown", onPointerDown);
  overlay?.addEventListener("pointermove", onPointerMove);
  overlay?.addEventListener("pointerup", onPointerUp);
  overlay?.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  const offLayer = subscribeLocationLayer(() => render());
  const offEditor = editorState.subscribe(() => render());
  const offStore = store.subscribe(() => render());
  teardown = () => {
    offLayer();
    offEditor();
    offStore();
    window.removeEventListener("keydown", onKeyDown);
    overlay?.removeEventListener("pointerdown", onPointerDown);
    overlay?.removeEventListener("pointermove", onPointerMove);
    overlay?.removeEventListener("pointerup", onPointerUp);
    overlay?.removeEventListener("pointercancel", onPointerUp);
  };
  return () => {
    teardown?.();
    teardown = null;
    overlayEl?.remove();
    overlayEl = null;
    inspectorEl?.remove();
    inspectorEl = null;
    movePreview = null;
  };
}
