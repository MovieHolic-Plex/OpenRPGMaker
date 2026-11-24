// editor/regionResultCard.ts
// 영역 지시의 결과를 그 자리(맵 위)에서 본다 — 오너 흐름 「드래그로 영역 → 지시 → 그 자리에서 보고 받아들이기/되돌리기」의 끝.
//
// 예전에는 영역에 시킨 조수 턴의 결과가 오른쪽 채팅 영수증 카드에만 남았다(ideal-flow-edit 간극 2순위). 맵 위에는
// 아무 표시가 없어 사람은 채팅과 맵을 번갈아 봐야 했다. 이제 그 턴이 맵을 바꾸면 영역 바로 아래에 작은 카드가 뜬다:
//   「지시 · 칸 N개 바뀜」 + 전/후(누르면 영역 위에 실행 전 그림을 덮는다) · 유지 · 다시 · 되돌리기.
// 되돌리기는 새 장치를 만들지 않는다 — 채팅 영수증과 같은 onUndo(편집 기록 한 칸)를 부른다.
//
// 칸 → 화면 좌표는 EditScene 이 등록한 해석기(regionClientRect)를 쓴다(aiPlacementPop 과 같은 덧그림).
// 카메라가 움직여도 따라가도록 카드가 떠 있는 동안만 프레임마다 자리를 다시 잡는다.
import { editorState } from "@/editor/editorState";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import { renderRegionSnapshot } from "@/editor/regionSnapshot";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import type { MapId, Project } from "@/project/types";
import { el } from "@/util/dom";

export interface RegionResultInput {
  readonly mapId: MapId;
  readonly region: RegionRect;
  /** 사람이 친 지시 원문. 카드 머리에 그대로 보인다. */
  readonly instruction: string;
  readonly before: Project;
  readonly after: Project;
  /** 채팅 영수증과 같은 되돌리기 — 편집 기록 한 칸을 되돌린다. */
  readonly onUndo: () => void;
  /** 되돌린 뒤 같은 지시를 같은 영역에 다시 보낸다. 없으면 「다시」 단추를 그리지 않는다. */
  readonly onRetry?: () => void;
}

export interface RegionChangeCounts {
  readonly cells: number;
  readonly events: number;
  /** 이 지시가 영역 밖에 새로 만든 맵(실내·던전) 이름. 없으면 필드도 없다. */
  readonly newMaps?: readonly string[];
}

/**
 * 영역 안에서 바뀐 칸 수(아래·위 타일 중 하나라도 다르면 1) + 영역 안에서 생기거나 옮겨지거나 사라진 이벤트 수
 * + 영역 밖에 새로 생긴 맵(「여기 상점」의 실내). 되돌리기는 턴 하나를 통째로 되돌리므로 새 맵도 함께 사라진다.
 */
export function countRegionChanges(before: Project, after: Project, mapId: MapId, region: RegionRect): RegionChangeCounts {
  const base = before.maps[mapId];
  const next = after.maps[mapId];
  if (!base || !next) return { cells: 0, events: 0 };
  let cells = 0;
  if (base.width === next.width && base.height === next.height) {
    const x1 = Math.min(base.width, region.x + region.width);
    const y1 = Math.min(base.height, region.y + region.height);
    for (let y = Math.max(0, region.y); y < y1; y += 1) {
      for (let x = Math.max(0, region.x); x < x1; x += 1) {
        const i = y * base.width + x;
        if (base.lowerTiles[i] !== next.lowerTiles[i] || base.upperTiles[i] !== next.upperTiles[i]) cells += 1;
      }
    }
  }
  const inside = (x: number, y: number): boolean => x >= region.x && y >= region.y && x < region.x + region.width && y < region.y + region.height;
  const beforeEvents = new Map(base.events.map((event) => [event.id, event]));
  const afterEvents = new Map(next.events.map((event) => [event.id, event]));
  let events = 0;
  for (const [id, event] of afterEvents) {
    const old = beforeEvents.get(id);
    if ((!old || old.x !== event.x || old.y !== event.y || JSON.stringify(old) !== JSON.stringify(event)) && (inside(event.x, event.y) || (old && inside(old.x, old.y)))) events += 1;
  }
  for (const [id, event] of beforeEvents) if (!afterEvents.has(id) && inside(event.x, event.y)) events += 1;
  const newMaps = Object.keys(after.maps).filter((id) => !before.maps[id]).map((id) => after.maps[id]!.name || id);
  return newMaps.length > 0 ? { cells, events, newMaps } : { cells, events };
}

/** 이 턴이 영역 맵을 바꿨거나 새 맵을 만들었으면 맵 위 카드를 띄운다(영수증이 실내 맵을 가리켜도). */
export function regionTurnTouched(before: Project, after: Project, mapId: MapId, region: RegionRect): boolean {
  if (!after.maps[mapId]) return false;
  const counts = countRegionChanges(before, after, mapId, region);
  return counts.cells > 0 || counts.events > 0 || (counts.newMaps?.length ?? 0) > 0;
}

export function regionResultSummary(counts: RegionChangeCounts): string {
  const parts: string[] = [];
  if (counts.cells > 0) parts.push(`칸 ${counts.cells}개`);
  if (counts.events > 0) parts.push(`이벤트 ${counts.events}개`);
  const changed = parts.length > 0 ? `${parts.join(" · ")} 바뀜` : "";
  const made = counts.newMaps?.length ? `새 맵 ${counts.newMaps.join("·")}` : "";
  return [changed, made].filter(Boolean).join(" · ") || "이 영역은 그대로";
}

const MAX_INSTRUCTION_CHARS = 28;

function shortInstruction(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_INSTRUCTION_CHARS ? `${flat.slice(0, MAX_INSTRUCTION_CHARS - 1)}…` : flat;
}

let current: { readonly root: HTMLElement; readonly close: () => void } | null = null;

export function closeRegionResultCard(): void {
  current?.close();
}

export function isRegionResultCardOpen(): boolean {
  return current !== null;
}

/**
 * 영역 결과 카드를 띄운다. 이미 떠 있으면 바꾼다(한 번에 하나). 지금 보고 있는 맵이 아니면 아무 것도 하지 않는다.
 * 맵을 바꾸면 닫힌다. host 를 주지 않으면 `.phaser-container` 에 붙는다.
 */
export function showRegionResultCard(input: RegionResultInput, host?: HTMLElement | null): HTMLElement | null {
  closeRegionResultCard();
  if (editorState.get().currentMapId !== input.mapId) return null;
  const container = host ?? (typeof document !== "undefined" ? document.querySelector<HTMLElement>(".phaser-container") : null);
  if (!container) return null;
  const counts = countRegionChanges(input.before, input.after, input.mapId, input.region);

  const beforeLayer = el("div", { class: "canvas-region-result-before", attrs: { "aria-hidden": "true" }, dataset: { testid: "region-result-before" } });
  beforeLayer.hidden = true;
  const frame = el("div", { class: "canvas-region-result-frame", attrs: { "aria-hidden": "true" }, dataset: { testid: "region-result-frame" } });
  const compare = el("button", {
    class: "canvas-region-result-button",
    text: "전/후",
    attrs: { type: "button", "aria-pressed": "false", title: "실행 전 모습을 이 자리에 겹쳐 봅니다" },
    dataset: { testid: "region-result-compare" },
  }) as HTMLButtonElement;
  const keep = el("button", {
    class: "canvas-region-result-button is-primary",
    text: "유지",
    attrs: { type: "button", title: "이대로 둡니다" },
    dataset: { testid: "region-result-keep" },
  }) as HTMLButtonElement;
  const retry = input.onRetry ? el("button", {
    class: "canvas-region-result-button",
    text: "다시",
    attrs: { type: "button", title: "되돌리고 같은 지시를 다시 보냅니다" },
    dataset: { testid: "region-result-retry" },
  }) as HTMLButtonElement : null;
  const undo = el("button", {
    class: "canvas-region-result-button",
    text: "되돌리기",
    attrs: { type: "button", title: "이 지시로 바뀐 것을 실행 전으로 돌립니다 (Ctrl+Z)" },
    dataset: { testid: "region-result-undo" },
  }) as HTMLButtonElement;
  const card = el("div", {
    class: "canvas-region-result-card",
    attrs: { role: "group", "aria-label": "영역 지시 결과" },
    dataset: { testid: "region-result-card" },
    children: [
      el("div", { class: "canvas-region-result-head", children: [
        el("span", { class: "canvas-region-result-instruction", text: shortInstruction(input.instruction) || "영역 지시" }),
        el("span", { class: "canvas-region-result-count", text: regionResultSummary(counts), dataset: { testid: "region-result-count" } }),
      ] }),
      el("div", { class: "canvas-region-result-actions", children: [compare, keep, ...(retry ? [retry] : []), undo] }),
    ],
  });
  const root = el("div", { class: "canvas-region-result-layer", dataset: { testid: "region-result-layer" }, children: [beforeLayer, frame, card] });
  container.append(root);
  // 카드가 떠 있는 동안 선택 막대(지시 입력 줄)는 숨긴다 — 같은 자리를 덮어 결과를 가린다. 다시 시킬 때는 「다시」나 채팅 입력.
  document.body.classList.add("canvas-region-result-open");

  let shotRequested = false;
  const showBefore = (on: boolean): void => {
    compare.setAttribute("aria-pressed", String(on));
    compare.classList.toggle("is-active", on);
    beforeLayer.hidden = !on;
    root.classList.toggle("is-showing-before", on);
    if (!on || shotRequested) return;
    shotRequested = true;
    const map = input.before.maps[input.mapId];
    if (!map) return;
    void renderRegionSnapshot(input.before, map, input.region, { targetWidth: Math.max(64, input.region.width * map.tileSize) })
      .then((canvas) => { canvas.classList.add("canvas-region-result-before-shot"); beforeLayer.append(canvas); })
      .catch(() => { beforeLayer.append(el("span", { class: "canvas-region-result-before-text", text: "실행 전 그림을 그리지 못했습니다" })); });
  };

  let frameHandle = 0;
  let lastKey = "";
  const place = (): void => {
    if (!root.isConnected) return;
    const rect = resolveRegionClientRect(input.region);
    const box = container.getBoundingClientRect();
    if (rect) {
      const left = Math.round(rect.x - box.left), top = Math.round(rect.y - box.top);
      const width = Math.round(rect.width), height = Math.round(rect.height);
      const key = `${left},${top},${width},${height},${Math.round(box.width)},${Math.round(box.height)}`;
      if (key !== lastKey) {
        lastKey = key;
        for (const node of [beforeLayer, frame]) {
          node.style.left = `${left}px`; node.style.top = `${top}px`;
          node.style.width = `${width}px`; node.style.height = `${height}px`;
        }
        // 카드는 영역 아래. 아래 공간이 모자라면 영역 위로, 그래도 모자라면 화면 안쪽에 붙인다.
        const cardHeight = card.offsetHeight || 64, cardWidth = card.offsetWidth || 240;
        let cardTop = top + height + 8;
        if (cardTop + cardHeight > box.height - 8) cardTop = top - cardHeight - 8;
        cardTop = Math.max(8, Math.min(cardTop, box.height - cardHeight - 8));
        const cardLeft = Math.max(8, Math.min(left, box.width - cardWidth - 8));
        card.style.left = `${cardLeft}px`;
        card.style.top = `${cardTop}px`;
      }
    }
    frameHandle = requestAnimationFrame(place);
  };

  const unsubscribe = editorState.subscribe((state) => {
    if (state.currentMapId !== input.mapId) close();
  });
  const close = (): void => {
    if (current?.root !== root) return;
    current = null;
    cancelAnimationFrame(frameHandle);
    unsubscribe();
    root.remove();
    document.body.classList.remove("canvas-region-result-open");
  };
  current = { root, close };

  compare.addEventListener("click", () => showBefore(compare.getAttribute("aria-pressed") !== "true"));
  keep.addEventListener("click", close);
  undo.addEventListener("click", () => { close(); input.onUndo(); });
  retry?.addEventListener("click", () => { close(); input.onUndo(); input.onRetry?.(); });
  place();
  return root;
}
