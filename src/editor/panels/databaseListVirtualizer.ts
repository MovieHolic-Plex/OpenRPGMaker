// databaseListVirtualizer.ts
// 레코드 리스트용 간단한 windowing(가상 스크롤) 유틸.
// 외부 라이브러리 없이 고정 행 높이 기준으로 화면에 보이는 슬라이스만 렌더한다.
// - 레코드 수가 THRESHOLD 이하이거나 뷰포트 높이를 측정할 수 없으면 전부 렌더(비활성).
// - 그 이상이면 스크롤 위치에 따라 [start, end) 구간만 렌더하고 위/아래는 스페이서로 높이를 채운다.

import { el } from "@/util/dom";

export const DEFAULT_ROW_HEIGHT = 24;
export const VIRTUALIZATION_THRESHOLD = 80;
export const DEFAULT_OVERSCAN = 8;

export type RowWindow = { readonly start: number; readonly end: number };

export type RowWindowParams = {
  readonly total: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight?: number;
  readonly overscan?: number;
  readonly threshold?: number;
};

// 순수 함수: 현재 스크롤/뷰포트 기준으로 렌더할 행 구간을 계산한다.
export function computeRowWindow(params: RowWindowParams): RowWindow {
  const total = Math.max(0, Math.floor(params.total));
  if (total === 0) return { start: 0, end: 0 };
  const rowHeight = params.rowHeight && params.rowHeight > 0 ? params.rowHeight : DEFAULT_ROW_HEIGHT;
  const overscan = Math.max(0, params.overscan ?? DEFAULT_OVERSCAN);
  const threshold = params.threshold ?? VIRTUALIZATION_THRESHOLD;
  // 임계값 이하이거나 높이를 알 수 없으면 가상화하지 않고 전부 렌더한다.
  if (total <= threshold || params.viewportHeight <= 0) return { start: 0, end: total };
  const scrollTop = Math.max(0, params.scrollTop);
  const firstVisible = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(params.viewportHeight / rowHeight);
  const end = Math.min(total, firstVisible + visibleCount + overscan);
  // 스크롤이 콘텐츠를 넘어서더라도 start 가 end 를 초과하지 않도록 클램프한다.
  const start = Math.min(Math.max(0, firstVisible - overscan), end);
  return { start, end };
}

export type VirtualList = {
  readonly element: HTMLElement;
  // 현재 스크롤/높이를 다시 측정해 필요한 경우 보이는 슬라이스를 재렌더한다.
  render(): void;
};

export type VirtualListOptions<T> = {
  readonly items: readonly T[];
  readonly renderRow: (item: T, index: number) => HTMLElement;
  readonly rowHeight?: number;
  readonly overscan?: number;
  readonly threshold?: number;
  readonly className?: string;
  readonly onScroll?: (scrollTop: number) => void;
};

// 스크롤 컨테이너 + 상/하단 스페이서 + 보이는 행 호스트를 구성한다.
// fake DOM(테스트)에서는 clientHeight/scrollTop 이 없으므로 항상 전부 렌더된다.
export function createVirtualList<T>(options: VirtualListOptions<T>): VirtualList {
  const rowHeight = options.rowHeight && options.rowHeight > 0 ? options.rowHeight : DEFAULT_ROW_HEIGHT;
  const container = el("div", { class: options.className ?? "db-list" });
  const topSpacer = el("div", { class: "db-virtual-spacer db-virtual-spacer-top", attrs: { "aria-hidden": "true" } });
  const rowsHost = el("div", { class: "db-virtual-rows" });
  const bottomSpacer = el("div", { class: "db-virtual-spacer db-virtual-spacer-bottom", attrs: { "aria-hidden": "true" } });
  container.append(topSpacer, rowsHost, bottomSpacer);

  let current: RowWindow = { start: -1, end: -1 };

  const render = (): void => {
    const next = computeRowWindow({
      total: options.items.length,
      scrollTop: readNumber(container, "scrollTop"),
      viewportHeight: readNumber(container, "clientHeight"),
      rowHeight,
      overscan: options.overscan,
      threshold: options.threshold,
    });
    if (next.start === current.start && next.end === current.end) return;
    current = next;
    topSpacer.style.height = `${next.start * rowHeight}px`;
    bottomSpacer.style.height = `${Math.max(0, options.items.length - next.end) * rowHeight}px`;
    const rows: HTMLElement[] = [];
    for (let index = next.start; index < next.end; index += 1) {
      rows.push(options.renderRow(options.items[index], index));
    }
    rowsHost.replaceChildren(...rows);
  };

  container.addEventListener("scroll", () => {
    options.onScroll?.(readNumber(container, "scrollTop"));
    render();
  });
  render();
  return { element: container, render };
}

function readNumber(node: HTMLElement, key: "scrollTop" | "clientHeight"): number {
  const value = (node as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
