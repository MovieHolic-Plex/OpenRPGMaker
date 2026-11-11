// 작은 일 시각 칸의 그림: 저장 문서 전/후에서 «플레이어가 보는 모습»의 맵 그림을 1배로 찍고, 바뀐 곳만 잘라 낸다(모델 없음).
//   - 타일은 편집기 캔버스와 같은 함수(scripts/qa-game/render.mts)로 그린다.
//   - 이벤트는 새 게임 상태에서 엔진이 고르는 페이지(resolveEventPage)의 그림만 그린다. 그림이 없거나 투명한 이벤트는 게임처럼 안 보인다 —
//     편집기 표식(분홍·파랑 테두리)·시작 위치 표시·이름으로 그려 주는 표지판 아이콘은 넣지 않는다.
//   - 바뀐 곳 = 전/후 그림의 화소가 다른 칸 + 새로 생기거나 옮겨지거나 없어진 이벤트의 칸(안 보이는 것도 — 그 자리를 비추려는 것이다).
import { PNG } from 'pngjs';
import { resolveEventPage } from '../../../../project/io';
import type { GameMap, Project } from '../../../../project/types';
import { renderMapPng } from '../../../../../scripts/qa-game/render.mts';
import { freshSession, type CheckSpec, type Doc } from './checkSupport';

export type Surface = 'map' | 'title' | 'start' | 'field' | 'gameover' | 'none';
export type VisualPlan = {
  surface: Surface;
  /** 요청한 것이 그림에 보여야 하는가. false 면 shown 은 n/a 이고 clean 만 본다(있던 것에 글만 붙이는 일 등). */
  expectShown: boolean;
  /** field: 실제 화면을 찍을 맵. */
  mapId?: string;
  why: string;
};

const MAP_KINDS = new Set(['eventMoved', 'newNpc', 'serviceSpot', 'bossFight', 'paidHeal', 'eventRemoved', 'dressed', 'transferLink']);

/** 판정 종류로 정하는 «어디를 보면 그 일이 보이는가». 도구 이름·조수의 말은 보지 않는다. */
export function visualPlan(check: CheckSpec): VisualPlan {
  const kind = check.kind;
  if (MAP_KINDS.has(kind)) return { surface: 'map', expectShown: true, why: '맵에 놓이거나 옮겨지는 것' };
  if (kind === 'shop' || kind === 'giveOnce') return check.eventId ? { surface: 'none', expectShown: false, why: '있던 사람에게 기능만 붙인다 — 모습은 그대로' } : { surface: 'map', expectShown: true, why: '맵에 새로 놓이는 것' };
  if (kind === 'textSpot' || kind === 'battleEvent') return { surface: 'map', expectShown: check.visible !== false, why: check.visible === false ? '있던 물건·길목에 붙이는 일 — 새로 보일 것은 없고 깨진 곳만 본다' : '맵에 새로 놓이는 것' };
  if (kind === 'gameTitle') return { surface: 'title', expectShown: true, why: '타이틀 화면의 제목 글자' };
  if (kind === 'projectField') {
    const paths: string[] = [check.path, ...(check.paths ?? [])].filter(Boolean);
    if (paths.some(path => /titleScreen\.(logoSubtitle|title|subtitle)/u.test(path))) return { surface: 'title', expectShown: true, why: '타이틀 화면의 글자' };
    if (paths.some(path => path.startsWith('system.gameOver'))) return { surface: 'gameover', expectShown: true, why: '게임 오버 화면의 글자' };
    return { surface: 'none', expectShown: false, why: '화면에 보이지 않는 설정' };
  }
  if (kind === 'startAt') return { surface: 'start', expectShown: true, why: '새 게임 첫 화면에서 주인공이 선 곳' };
  if (kind === 'mapWeather') return { surface: 'field', expectShown: true, mapId: check.mapId, why: '그 맵의 실제 화면(날씨)' };
  if (kind === 'mapDark') return { surface: 'field', expectShown: true, mapId: check.mapId, why: '그 맵의 실제 화면(어둠)' };
  if (kind === 'onEnterOnce') return check.moves ? { surface: 'start', expectShown: true, why: '새 게임 첫 장면(걸어오는 움직임은 정지 그림 한 장으로만 본다)' } : { surface: 'field', expectShown: true, mapId: check.mapId, why: '그 맵에 들어섰을 때의 실제 화면' };
  return { surface: 'none', expectShown: false, why: '자료·대사·소리·규칙만 바뀐다 — 그림으로 볼 것이 없다' };
}

type LookEvent = { id: string; x: number; y: number; look: string };
/** 플레이어가 보는 이벤트만 남긴 맵: 새 게임 상태의 페이지 하나, 그림 없는·투명한 이벤트는 뺀다. 이름은 지운다(렌더러의 이름표 아이콘을 끈다). */
export function playerLookMap(map: GameMap): { map: GameMap; shown: LookEvent[]; all: Array<{ id: string; x: number; y: number }> } {
  const session = freshSession(), shown: LookEvent[] = [], events: any[] = [];
  for (const event of (map.events ?? []) as any[]) {
    let page: any = null;
    try { page = event.pages?.length ? resolveEventPage(event as never, session) : null; } catch { page = null; }
    const graphic = page?.graphic;
    if (!graphic || graphic.transparent || !graphic.sprite?.id) continue;
    events.push({ id: 'e', x: event.x, y: event.y, name: '', pages: [{ ...page, name: '', graphic }] });
    shown.push({ id: event.id, x: event.x, y: event.y, look: JSON.stringify([graphic.sprite, graphic.pattern ?? null, graphic.direction ?? null]) });
  }
  return { map: { ...map, events } as GameMap, shown, all: ((map.events ?? []) as any[]).map(event => ({ id: event.id, x: event.x, y: event.y })) };
}

export type Raster = { width: number; height: number; data: Buffer };
export function renderLook(project: Project, map: GameMap): Raster {
  const { png } = renderMapPng({ ...project, startMapId: '' } as Project, playerLookMap(map).map);
  const image = PNG.sync.read(png);
  return { width: image.width, height: image.height, data: image.data };
}
/** pad = 높이 지형이 그림 위쪽으로 넓힌 화소(없으면 0). */
export function cropPng(raster: Raster, rect: { x: number; y: number; w: number; h: number }, tile: number, pad = 0): Buffer {
  const out = new PNG({ width: rect.w * tile, height: rect.h * tile });
  const dy = pad;
  for (let y = 0; y < out.height; y += 1) {
    const sy = rect.y * tile + y + dy;
    if (sy < 0 || sy >= raster.height) continue;
    raster.data.copy(out.data, y * out.width * 4, (sy * raster.width + rect.x * tile) * 4, (sy * raster.width + rect.x * tile + out.width) * 4);
  }
  return PNG.sync.write(out);
}

export type MapChange = {
  mapId: string; name: string; width: number; height: number; tile: number;
  /** 화소가 달라진 칸 수. */
  pixelCells: number;
  /** 새로 생기거나 옮겨지거나 없어진 이벤트(안 보이는 것 포함)의 칸 수. */
  eventCells: number;
  isNew: boolean; removed: boolean;
  rect: { x: number; y: number; w: number; h: number };
  before: Buffer | null; after: Buffer | null;
};

const MARGIN = 5, MIN_W = 15, MIN_H = 11, WHOLE_W = 26, WHOLE_H = 20;
function focusRect(cells: Array<{ x: number; y: number }>, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const whole = { x: 0, y: 0, w: width, h: height };
  if (!cells.length || (width <= WHOLE_W && height <= WHOLE_H)) return whole;
  let x0 = Math.min(...cells.map(cell => cell.x)) - MARGIN, x1 = Math.max(...cells.map(cell => cell.x)) + MARGIN;
  let y0 = Math.min(...cells.map(cell => cell.y)) - MARGIN, y1 = Math.max(...cells.map(cell => cell.y)) + MARGIN;
  const grow = (lo: number, hi: number, min: number, size: number): [number, number] => {
    while (hi - lo + 1 < min) { lo -= 1; if (hi - lo + 1 < min) hi += 1; }
    if (lo < 0) { hi -= lo; lo = 0; }
    if (hi > size - 1) { lo -= hi - (size - 1); hi = size - 1; }
    return [Math.max(0, lo), hi];
  };
  [x0, x1] = grow(x0, x1, MIN_W, width); [y0, y1] = grow(y0, y1, MIN_H, height);
  const rect = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return rect.w * rect.h >= width * height * 0.7 ? whole : rect;
}

/** 전/후 문서의 맵마다 바뀐 곳과 그 곳의 전/후 그림. focus 는 바뀐 것이 없어도 꼭 찍을 맵(요청이 가리킨 맵). */
export function mapChanges(before: Doc, after: Doc, focusMapIds: string[] = []): MapChange[] {
  const ids = [...new Set([...Object.keys(before.maps ?? {}), ...Object.keys(after.maps ?? {})])];
  const out: MapChange[] = [];
  for (const mapId of ids) {
    const was: GameMap | undefined = before.maps?.[mapId], now: GameMap | undefined = after.maps?.[mapId];
    const ref = (now ?? was)!;
    // 맵 문서가 글자 그대로 같으면 그림도 같다 — 요청이 가리킨 맵이 아니면 그리지 않는다(만든 게임 픽스처는 맵 6장).
    if (was && now && !focusMapIds.includes(mapId) && JSON.stringify(was) === JSON.stringify(now)) continue;
    const tile = (after.tilesets?.[ref.tilesetId] ?? before.tilesets?.[ref.tilesetId])?.tileSize ?? 16;
    const cells = new Map<string, { x: number; y: number }>();
    const add = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < ref.width && y < ref.height) cells.set(`${x},${y}`, { x, y }); };
    let eventCells = 0, pixelCells = 0;
    if (was && now) {
      const a = new Map(playerLookMap(was).all.map(event => [event.id, event])), b = new Map(playerLookMap(now).all.map(event => [event.id, event]));
      for (const [id, event] of b) { const old = a.get(id); if (!old) { add(event.x, event.y); eventCells += 1; } else if (old.x !== event.x || old.y !== event.y) { add(old.x, old.y); add(event.x, event.y); eventCells += 2; } }
      for (const [id, event] of a) if (!b.has(id)) { add(event.x, event.y); eventCells += 1; }
    }
    const rasterWas = was ? renderLook(before as Project, was) : null, rasterNow = now ? renderLook(after as Project, now) : null;
    const pad = Math.max(0, (rasterNow ?? rasterWas)!.height - ref.height * tile);
    if (rasterWas && rasterNow && rasterWas.width === rasterNow.width && rasterWas.height === rasterNow.height) {
      const changed = new Set<string>();
      for (let y = 0; y < rasterNow.height; y += 1) for (let x = 0; x < rasterNow.width; x += 1) {
        const i = (y * rasterNow.width + x) * 4;
        if (rasterWas.data[i] !== rasterNow.data[i] || rasterWas.data[i + 1] !== rasterNow.data[i + 1] || rasterWas.data[i + 2] !== rasterNow.data[i + 2]) changed.add(`${Math.floor(x / tile)},${Math.max(0, Math.floor((y - pad) / tile))}`);
      }
      pixelCells = changed.size;
      for (const key of changed) { const [x, y] = key.split(',').map(Number); add(x!, y!); }
    } else if (rasterWas && rasterNow) { pixelCells = ref.width * ref.height; }
    const isNew = !was && !!now, removed = !!was && !now;
    if (!cells.size && !isNew && !removed && pixelCells === 0 && !focusMapIds.includes(mapId)) continue;
    const rect = pixelCells >= ref.width * ref.height ? { x: 0, y: 0, w: ref.width, h: ref.height } : focusRect([...cells.values()], ref.width, ref.height);
    out.push({ mapId, name: ref.name ?? mapId, width: ref.width, height: ref.height, tile, pixelCells, eventCells, isNew, removed, rect,
      before: rasterWas ? cropPng(rasterWas, rect, tile, pad) : null, after: rasterNow ? cropPng(rasterNow, rect, tile, pad) : null });
  }
  // 요청이 가리킨 맵 먼저, 그다음 많이 바뀐 맵.
  return out.sort((a, b) => Number(focusMapIds.includes(b.mapId)) - Number(focusMapIds.includes(a.mapId)) || (b.pixelCells + b.eventCells) - (a.pixelCells + a.eventCells));
}

/** 판정 인자에서 요청이 가리킨 맵들. */
export function focusMaps(check: CheckSpec): string[] {
  return [check.mapId, check.fromMap, check.toMap].filter((id): id is string => typeof id === 'string');
}
