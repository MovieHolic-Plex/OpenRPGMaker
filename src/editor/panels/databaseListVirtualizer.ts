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
  // 그리드(갤러리) 모드의 열 수. 기본 1 = 기존 행 단위 윈도잉과 동일.
  readonly columns?: number;
};

// 순수 함수: 현재 스크롤/뷰포트 기준으로 렌더할 항목 구간을 계산한다.
// columns>1 이면 항목을 열 수만큼 묶어 '행' 단위로 윈도우를 잡고, 항목 인덱스로 환산해
// 반환한다(시작/끝이 항상 온전한 행 경계 = start 는 columns 의 배수).
export function computeRowWindow(params: RowWindowParams): RowWindow {
  const total = Math.max(0, Math.floor(params.total));
  if (total === 0) return { start: 0, end: 0 };
  const columns = normalizeColumns(params.columns);
  const rows = Math.ceil(total / columns);
  const rowHeight = params.rowHeight && params.rowHeight > 0 ? params.rowHeight : DEFAULT_ROW_HEIGHT;
  const overscan = Math.max(0, params.overscan ?? DEFAULT_OVERSCAN);
  const threshold = params.threshold ?? VIRTUALIZATION_THRESHOLD;
  // 임계값 이하이거나 높이를 알 수 없으면 가상화하지 않고 전부 렌더한다.
  // (columns>1 이어도 판정 기준은 항목 수 자체다 — 행 수가 아니다. 그래야 갤러리에서도
  // 80개 초과 픽스처가 실제로 윈도잉된다.)
  if (total <= threshold || params.viewportHeight <= 0) return { start: 0, end: total };
  const scrollTop = Math.max(0, params.scrollTop);
  const firstVisibleRow = Math.floor(scrollTop / rowHeight);
  const endRow = Math.min(rows, Math.ceil((scrollTop + params.viewportHeight) / rowHeight) + overscan);
  // 스크롤이 콘텐츠를 넘어서더라도 start 가 end 를 초과하지 않도록 클램프한다.
  const startRow = Math.min(Math.max(0, firstVisibleRow - overscan), endRow);
  return { start: startRow * columns, end: Math.min(total, endRow * columns) };
}

function normalizeColumns(columns: number | undefined): number {
  const value = Math.floor(columns ?? 1);
  // 0/음수/NaN 등 손상된 값은 1(단일 열)로 안전 폴백한다 — columns>total 도 rows=1 로 처리돼
  // 0 나눗셈 없이 전체가 렌더된다.
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export type VirtualList = {
  readonly element: HTMLElement;
  // 현재 스크롤/높이를 다시 측정해 필요한 경우 보이는 슬라이스를 재렌더한다.
  render(): void;
  // Reveal uses the same measured pitch and bounds as windowing/spacers.
  scrollToIndex(index: number): void;
};

export type VirtualListOptions<T> = {
  readonly items: readonly T[];
  readonly renderRow: (item: T, index: number) => HTMLElement;
  readonly rowHeight?: number;
  readonly overscan?: number;
  readonly threshold?: number;
  // 그리드 열 수. 숫자(고정) 또는 컨테이너를 받아 렌더 폭에 따라 열 수를 정하는 함수
  // (브라우저에서 ResizeObserver 가 크기 변화를 render() 로 연결한다). 기본 1.
  readonly columns?: number | ((container: HTMLElement) => number);
  readonly className?: string;
  // Opt-in CSS contract: block scroller, grid rowsHost, uniform border-box
  // row heights, gaps only inside rowsHost (not between the spacers).
  readonly measureRows?: boolean;
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

  // options.columns 는 프로퍼티 접근이라 클로저 안에서 타입 내로잉이 유지되지 않으므로
  // const 로 먼저 고정한다 (숫자 고정값 또는 폭 기반 함수).
  const columnsOption = options.columns;
  const resolveColumns: (container: HTMLElement) => number =
    typeof columnsOption === "function" ? columnsOption : () => columnsOption ?? 1;

  let current: RowWindow = { start: -1, end: -1 };
  let currentColumns = -1;
  let pitch = rowHeight;
  let gap = 0;
  let insetTop = 0;
  let insetBottom = 0;
  let maxScrollTop = 0;

  const render = (): void => {
    const columns = normalizeColumns(resolveColumns(container));
    // Apply responsive columns BEFORE measuring: card height can depend on width.
    container.style.setProperty("--db-gallery-columns", String(columns));
    const sample = rowsHost.firstElementChild;
    if (options.measureRows && sample && typeof getComputedStyle === "function") {
      const height = sample.getBoundingClientRect().height;
      if (height > 0) {
        const hostStyle = getComputedStyle(rowsHost);
        const containerStyle = getComputedStyle(container);
        gap = Number.parseFloat(hostStyle.rowGap) || 0;
        pitch = height + gap;
        insetTop = (Number.parseFloat(hostStyle.paddingTop) || 0) + (Number.parseFloat(containerStyle.paddingTop) || 0);
        insetBottom = (Number.parseFloat(hostStyle.paddingBottom) || 0) + (Number.parseFloat(containerStyle.paddingBottom) || 0);
      }
    }
    const total = options.items.length;
    const rows = Math.ceil(total / columns);
    const viewportHeight = readNumber(container, "clientHeight");
    maxScrollTop = Math.max(0, insetTop + rows * pitch - (rows > 0 ? gap : 0) + insetBottom - viewportHeight);
    let scrollTop = readNumber(container, "scrollTop");
    // A wider gallery has fewer rows. Clamp against its NEW extent before
    // computing a slice, rather than producing an empty host at the old offset.
    if (options.measureRows && viewportHeight > 0 && scrollTop > maxScrollTop) {
      scrollTop = maxScrollTop;
      container.scrollTop = scrollTop;
    }
    const next = computeRowWindow({
      total,
      scrollTop: Math.max(0, scrollTop - insetTop),
      viewportHeight,
      rowHeight: pitch,
      columns,
      overscan: options.overscan,
      threshold: options.threshold,
    });
    // Each omitted row owns one pitch, including its boundary gap. The host
    // supplies the remaining rows' internal gaps and its padding exactly once.
    const startRow = Math.floor(next.start / columns);
    const endRow = Math.ceil(next.end / columns);
    topSpacer.style.height = `${startRow * pitch}px`;
    bottomSpacer.style.height = `${Math.max(0, rows - endRow) * pitch}px`;
    if (next.start === current.start && next.end === current.end && columns === currentColumns) return;
    current = next;
    currentColumns = columns;
    const rendered: HTMLElement[] = [];
    for (let index = next.start; index < next.end; index += 1) {
      rendered.push(options.renderRow(options.items[index], index));
    }
    rowsHost.replaceChildren(...rendered);
  };

  container.addEventListener("scroll", () => {
    options.onScroll?.(readNumber(container, "scrollTop"));
    render();
  });
  // 렌더 폭 변화(모달 리사이즈 등)에 따라 열 수를 다시 계산한다. 브라우저 전용 —
  // fake DOM(테스트)에는 ResizeObserver 가 없어 무시되고, 테스트는 clientWidth 를
  // 주입한 뒤 scroll 이벤트로 render() 를 트리거해 결정적으로 검증한다.
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => render());
    observer.observe(container);
  }
  render();
  return {
    element: container,
    render,
    scrollToIndex(index) {
      render();
      container.scrollTop = Math.min(maxScrollTop, Math.max(0, insetTop + Math.floor(index / currentColumns) * pitch));
      render();
    },
  };
}

function readNumber(node: HTMLElement, key: "scrollTop" | "clientHeight"): number {
  const value = (node as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
