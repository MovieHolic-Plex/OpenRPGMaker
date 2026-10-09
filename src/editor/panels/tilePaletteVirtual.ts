/**
 * 커스텀 팔레트 2차원 가상화 — 버들항(23,936칸)처럼 큰 아틀라스에서 칸 전부를 DOM 에 두지 않는다.
 *
 * 그리드는 명시적 `grid-template-rows` 로 전체 높이를 레이아웃에 유지하고(스크롤바·스크롤 길이가 그대로),
 * 보이는 행·열 범위 + 여유분의 칸만 `.chipset-tile` 로 만든다. 칸은 인라인 `grid-area` 로 제자리에 놓는다.
 * 필터는 칸 목록을 바꾸지 않고 **그려진 칸**의 `is-filtered-out` 만 다시 맞춘다 — 비용이 전체 칸 수가 아니라
 * 화면 칸 수에 비례한다.
 */

export interface VirtualPaletteView {
  visibleTiles: ReadonlySet<number> | null;
  selectedTile: number;
}

export interface VirtualPalette {
  /** 필터·선택이 바뀐 뒤 그려진 칸의 `is-filtered-out` 만 다시 맞춘다. */
  refreshFilter(): void;
  /** 활성(선택) 칸 표시를 옮긴다. 칸이 그려져 있지 않아도 상태는 기억한다. */
  setActive(tile: number): void;
  /** 칸을 만들어 두고 가운데로 스크롤한다(그려진 칸은 잠시 고정). 그 칸을 돌려준다. */
  reveal(tile: number): HTMLElement | null;
}

const BUFFER_ROWS = 18;
const BUFFER_COLS = 1;
const INITIAL_ROWS = 24;
const INITIAL_COLS = 36;
const REVEAL_PIN_MS = 1800;

export function installVirtualPalette(options: {
  readonly sheet: HTMLElement;
  readonly grid: HTMLElement;
  readonly columns: number;
  readonly count: number;
  readonly view: VirtualPaletteView;
  readonly makeCell: (tile: number) => HTMLButtonElement;
  readonly passesFilter: (tile: number) => boolean;
}): VirtualPalette {
  const { sheet, grid, columns, count, view } = options;
  const rows = Math.max(1, Math.ceil(count / columns));
  const cells = new Map<number, HTMLButtonElement>();
  const pinned = new Set<number>();
  let range = { r0: 0, r1: -1, c0: 0, c1: -1 };
  let measured = false;
  let activeTile = view.selectedTile;
  let tabStop: HTMLElement | null = null;
  let frame = 0;

  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

  interface Metrics { cell: number; x0: number; x1: number; y0: number; y1: number; scale: number; gridLeft: number; gridTop: number }
  const measure = (): Metrics | null => {
    const g = grid.getBoundingClientRect();
    if (!g.width) return null;
    const s = sheet.getBoundingClientRect();
    const scale = sheet.offsetWidth ? s.width / sheet.offsetWidth : 1;
    const cell = g.width / columns;
    const viewW = (sheet.clientWidth || sheet.offsetWidth) * scale;
    const viewH = (sheet.clientHeight || sheet.offsetHeight) * scale;
    const x0 = s.left + sheet.clientLeft * scale - g.left;
    const y0 = s.top + sheet.clientTop * scale - g.top;
    return { cell, x0, x1: x0 + viewW, y0, y1: y0 + viewH, scale, gridLeft: g.left - s.left, gridTop: g.top - s.top };
  };

  const makeAt = (tile: number): HTMLButtonElement => {
    const cell = options.makeCell(tile);
    cell.style.setProperty("--vr", String(Math.floor(tile / columns)));
    cell.style.setProperty("--vc", String(tile % columns));
    cell.tabIndex = -1;
    if (tile === activeTile) {
      cell.classList.add("active");
      cell.setAttribute("aria-pressed", "true");
    }
    if (!options.passesFilter(tile)) cell.classList.add("is-filtered-out");
    cells.set(tile, cell);
    return cell;
  };

  const ensureTabStop = (r0v: number, c0v: number): void => {
    if (tabStop && tabStop.isConnected) return;
    const preferred = cells.get(activeTile) ?? cells.get(clamp(r0v, 0, rows - 1) * columns + c0v) ?? cells.values().next().value;
    if (!preferred) return;
    preferred.tabIndex = 0;
    tabStop = preferred;
  };

  const render = (force: boolean): void => {
    const m = measure();
    let r0v = 0;
    let r1v = INITIAL_ROWS - 1;
    let c0v = 0;
    let c1v = INITIAL_COLS - 1;
    if (m) {
      r0v = clamp(Math.floor(m.y0 / m.cell), 0, rows - 1);
      r1v = clamp(Math.ceil(m.y1 / m.cell) - 1, 0, rows - 1);
      c0v = clamp(Math.floor(m.x0 / m.cell), 0, columns - 1);
      c1v = clamp(Math.ceil(m.x1 / m.cell) - 1, 0, columns - 1);
      if (!measured) { measured = true; force = true; }
    }
    r1v = Math.min(r1v, rows - 1);
    c1v = Math.min(c1v, columns - 1);
    const contained = range.r0 <= r0v && range.r1 >= r1v && range.c0 <= c0v && range.c1 >= c1v;
    if (contained && !force) return;
    const next = {
      r0: Math.max(0, r0v - BUFFER_ROWS),
      r1: Math.min(rows - 1, r1v + BUFFER_ROWS),
      c0: Math.max(0, c0v - BUFFER_COLS),
      c1: Math.min(columns - 1, c1v + BUFFER_COLS),
    };
    const focused = typeof document === "undefined" ? null : document.activeElement;
    for (const [tile, cell] of cells) {
      const r = Math.floor(tile / columns);
      const c = tile % columns;
      if (r >= next.r0 && r <= next.r1 && c >= next.c0 && c <= next.c1) continue;
      if (pinned.has(tile) || cell === focused) continue;
      cell.remove();
      cells.delete(tile);
      if (cell === tabStop) tabStop = null;
    }
    const fresh: HTMLButtonElement[] = [];
    for (let r = next.r0; r <= next.r1; r += 1) {
      for (let c = next.c0; c <= next.c1; c += 1) {
        const tile = r * columns + c;
        if (tile >= count || cells.has(tile)) continue;
        fresh.push(makeAt(tile));
      }
    }
    if (fresh.length) grid.append(...fresh);
    range = next;
    ensureTabStop(r0v, c0v);
  };

  const schedule = (): void => {
    if (frame) return;
    if (typeof window.requestAnimationFrame !== "function") { render(false); return; }
    frame = window.requestAnimationFrame(() => { frame = 0; render(false); });
  };

  const setTabStop = (cell: HTMLElement): void => {
    if (tabStop === cell) return;
    if (tabStop) tabStop.tabIndex = -1;
    cell.tabIndex = 0;
    tabStop = cell;
  };

  const ensureVisible = (tile: number): void => {
    const m = measure();
    if (!m) return;
    const r = Math.floor(tile / columns);
    const c = tile % columns;
    const x = c * m.cell;
    const y = r * m.cell;
    if (x < m.x0) sheet.scrollLeft -= (m.x0 - x) / m.scale;
    else if (x + m.cell > m.x1) sheet.scrollLeft += (x + m.cell - m.x1) / m.scale;
    if (y < m.y0) sheet.scrollTop -= (m.y0 - y) / m.scale;
    else if (y + m.cell > m.y1) sheet.scrollTop += (y + m.cell - m.y1) / m.scale;
  };

  const focusTile = (tile: number): void => {
    ensureVisible(tile);
    render(false);
    const cell = cells.get(tile) ?? makeAt(tile);
    if (!cell.isConnected) grid.append(cell);
    setTabStop(cell);
    cell.focus({ preventScroll: true });
  };

  // 초기: 레이아웃 전이라도 왼쪽 위 창을 바로 그린다 — 붙은 뒤 첫 측정에서 실제 창으로 바로잡는다.
  render(true);
  sheet.addEventListener("scroll", schedule, { passive: true });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(schedule).observe(sheet);
  else if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(schedule);

  grid.addEventListener("keydown", (event: KeyboardEvent) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !grid.contains(active)) return;
    const current = Number(active.dataset.tileIndex);
    if (!Number.isInteger(current)) return;
    let next = current;
    switch (event.key) {
      case "ArrowRight": next = current + 1; break;
      case "ArrowLeft": next = current - 1; break;
      case "ArrowDown": next = current + columns; break;
      case "ArrowUp": next = current - columns; break;
      case "Home": next = 0; break;
      case "End": next = count - 1; break;
      default: return;
    }
    // 화살표는 맵 스크롤을 부르므로 판 안에서는 항상 삼킨다. 경계에서는 줄바꿈 없이 멈춘다.
    event.preventDefault();
    event.stopPropagation();
    if (next < 0 || next >= count || next === current) return;
    // 왼쪽·오른쪽 이동이 행을 넘지 않게: 같은 행 안에서만 ±1.
    if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && Math.floor(next / columns) !== Math.floor(current / columns)) return;
    focusTile(next);
  });
  grid.addEventListener("focusin", (event: FocusEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains("chipset-tile") && grid.contains(target)) setTabStop(target);
  });

  return {
    refreshFilter(): void {
      for (const [tile, cell] of cells) cell.classList.toggle("is-filtered-out", !options.passesFilter(tile));
    },
    setActive(tile: number): void {
      if (tile === activeTile) return;
      const old = cells.get(activeTile);
      old?.classList.remove("active");
      old?.setAttribute("aria-pressed", "false");
      activeTile = tile;
      const next = cells.get(tile);
      if (!next) return;
      next.classList.add("active");
      next.setAttribute("aria-pressed", "true");
      setTabStop(next);
    },
    reveal(tile: number): HTMLElement | null {
      if (tile < 0 || tile >= count) return null;
      const m = measure();
      const cell = cells.get(tile) ?? makeAt(tile);
      if (!cell.isConnected) grid.append(cell);
      pinned.add(tile);
      window.setTimeout(() => { pinned.delete(tile); schedule(); }, REVEAL_PIN_MS);
      if (m) {
        const left = m.gridLeft + sheet.scrollLeft + ((tile % columns) + 0.5) * (m.cell / m.scale) - sheet.clientWidth / 2;
        const top = m.gridTop + sheet.scrollTop + (Math.floor(tile / columns) + 0.5) * (m.cell / m.scale) - sheet.clientHeight / 2;
        sheet.scrollTo?.({ left: Math.max(0, left), top: Math.max(0, top), behavior: "smooth" });
      }
      return cell;
    },
  };
}
