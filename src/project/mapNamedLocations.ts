// project/mapNamedLocations.ts
// 명명 로케이션 레이어의 단일 진실 공급원. 순수 함수만 둔다(브라우저 전역·store 접근 금지) —
// 편집기 UI, 조수 툴, 런타임 조건, 인카운터, lint 가 모두 이 모듈 하나를 통과해야 규칙이 갈라지지 않는다.
//
// ## 왜 layoutPlan.regions 와 별개인가 (OPRN-OUT-020 결정)
//
// `map.layoutPlan` 은 **빌더 기록**이다. `setMapLayoutPlan` 이 배열을 통째로 갈아치우고
// (`village/builder.ts`, `largeRiverMarketVillageBuild.ts`), `houseProtection`·`villageEvaluate` 가
// `role === "house"` 같은 시공 의미로 읽는다. 사람이 그 배열을 편집하게 하면
//   (1) 다시 시공할 때 사람의 편집이 조용히 사라지고,
//   (2) 사람이 붙인 역할 낱말이 시공 검증기의 판정을 오염시킨다.
// 그래서 사람·이벤트·인카운터가 이름으로 가리키는 층은 `map.locations` 로 분리했다.
//
// 두 층의 관계는 **한 방향뿐**이다: `adoptLayoutRegionsAsLocations` 가 빌더 영역을 로케이션으로
// 복사한다(명시적 사용자/툴 행위). 역방향 동기화는 없고, 승격 후 layoutPlan 은 한 바이트도 변하지
// 않는다 — 옛 빌더 맵의 동작을 바꾸지 않겠다는 계약이다. 승격된 로케이션은 `origin` 에 출처를 남겨
// 추적할 수 있게 한다(스냅샷이므로 원본이 사라져도 로케이션은 남는다).

import type { GameMap, MapLayoutRegion, MapNamedLocation, Rect } from "./types";

/** 로케이션 최소 크기. 0 폭/높이는 "안에 있음" 판정이 영원히 거짓이라 저작 실수다. */
export const MIN_LOCATION_SIZE = 1;
/** 표시명 길이 상한 — 프롬프트·라벨 렌더가 폭주하지 않게 막는다. */
export const MAX_LOCATION_NAME_LENGTH = 64;

export type LocationPoint = { readonly x: number; readonly y: number };

export function mapLocations(map: GameMap): readonly MapNamedLocation[] {
  return map.locations ?? [];
}

export function findLocationById(map: GameMap, locationId: string): MapNamedLocation | undefined {
  return mapLocations(map).find((location) => location.id === locationId);
}

/** 표시명으로 찾기. 완전일치(대소문자·공백 무시) 우선, 없으면 부분일치. 동명이인은 저작 순서가 이긴다. */
export function findLocationsByName(map: GameMap, name: string): MapNamedLocation[] {
  const needle = normalizeName(name);
  if (!needle) return [];
  const exact = mapLocations(map).filter((location) => normalizeName(location.name) === needle);
  if (exact.length > 0) return exact;
  return mapLocations(map).filter((location) => normalizeName(location.name).includes(needle));
}

/**
 * ID 또는 표시명 어느 쪽으로도 해석한다 — 조수가 사용자의 말("정문 광장")을 그대로 넘길 수 있게 하는
 * 유일한 진입점이다. ID 가 먼저다(안정 참조가 사람 낱말보다 강하다).
 */
export function resolveLocation(map: GameMap, idOrName: string): MapNamedLocation | undefined {
  const byId = findLocationById(map, idOrName);
  if (byId) return byId;
  return findLocationsByName(map, idOrName)[0];
}

export function locationRect(location: MapNamedLocation): Rect {
  return { x: location.x, y: location.y, w: location.w, h: location.h };
}

export function pointInLocation(location: MapNamedLocation, point: LocationPoint): boolean {
  return (
    point.x >= location.x &&
    point.y >= location.y &&
    point.x < location.x + Math.max(0, location.w) &&
    point.y < location.y + Math.max(0, location.h)
  );
}

/** 그 점을 덮는 로케이션 전부. 겹침은 허용이며, 순서는 저작 순서(앞이 먼저 만든 것). */
export function locationsAtPoint(map: GameMap, point: LocationPoint): MapNamedLocation[] {
  return mapLocations(map).filter((location) => pointInLocation(location, point));
}

/**
 * 겹침 계약: **허용한다.** 상점가 안의 좌판, 마을 안의 광장처럼 포함 관계가 정상 저작이기 때문이다.
 * 대신 조회는 결정론적이어야 하므로 선택 우선순위를 여기 한 곳에서 정한다 —
 * 면적이 작은 것이 먼저(가장 구체적인 장소), 동률이면 저작 순서.
 */
export function topLocationAtPoint(map: GameMap, point: LocationPoint): MapNamedLocation | undefined {
  const hits = locationsAtPoint(map, point);
  if (hits.length <= 1) return hits[0];
  const order = new Map(mapLocations(map).map((location, index) => [location.id, index] as const));
  return [...hits].sort((a, b) => {
    const areaDelta = a.w * a.h - b.w * b.h;
    if (areaDelta !== 0) return areaDelta;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  })[0];
}

export function locationsOverlap(
  a: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  b: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): boolean {
  return (
    a.x < b.x + Math.max(0, b.w) &&
    b.x < a.x + Math.max(0, a.w) &&
    a.y < b.y + Math.max(0, b.h) &&
    b.y < a.y + Math.max(0, a.h)
  );
}

/** 이 로케이션과 겹치는 다른 로케이션들. 편집기 정보 배지용(차단이 아니다). */
export function overlappingLocations(map: GameMap, locationId: string): MapNamedLocation[] {
  const target = findLocationById(map, locationId);
  if (!target) return [];
  return mapLocations(map).filter((other) => other.id !== target.id && locationsOverlap(target, other));
}

// ─────────────────────────────────────────────────────────── 변경(mutation) 계약

export type LocationDraft = {
  readonly name?: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly note?: string;
  readonly tags?: readonly string[];
  readonly color?: string;
};

export type LocationChange =
  | { readonly ok: true; readonly location: MapNamedLocation }
  | { readonly ok: false; readonly error: string };

/** 새 ID. 저작 순서를 읽을 수 있게 `loc1`, `loc2` … 로 매기고 충돌 시 뒤로 밀린다(맵 안에서만 유일). */
export function nextLocationId(map: GameMap): string {
  const used = new Set(mapLocations(map).map((location) => location.id));
  for (let index = 1; index <= used.size + 1; index += 1) {
    const candidate = `loc${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `loc${used.size + 1}`;
}

/** 중복 없는 기본 표시명. 「구역 1」…처럼 사람이 바로 알아보고 곧 고칠 수 있는 이름을 준다. */
export function defaultLocationName(map: GameMap): string {
  const existing = new Set(mapLocations(map).map((location) => normalizeName(location.name)));
  for (let index = 1; index <= existing.size + 1; index += 1) {
    const candidate = `구역 ${index}`;
    if (!existing.has(normalizeName(candidate))) return candidate;
  }
  return `구역 ${existing.size + 1}`;
}

/**
 * 로케이션 추가. 맵을 제자리에서 바꾼다(store.update 안에서 호출할 것).
 * 좌표는 맵 안으로 클램프하고, 클램프 후에도 유효 면적이 없으면 거부한다.
 */
export function addMapLocation(map: GameMap, draft: LocationDraft): LocationChange {
  const rect = clampRectToMap(draft, map);
  if (!rect) return { ok: false, error: "맵 안에 들어오는 영역이 아닙니다." };
  const name = sanitizeName(draft.name ?? defaultLocationName(map));
  if (!name) return { ok: false, error: "이름을 비울 수 없습니다." };
  const location: MapNamedLocation = {
    id: nextLocationId(map),
    name,
    ...rect,
    ...(draft.note === undefined ? {} : { note: draft.note }),
    ...(draft.tags === undefined ? {} : { tags: [...draft.tags] }),
    ...(draft.color === undefined ? {} : { color: draft.color }),
  };
  map.locations = [...mapLocations(map), location];
  return { ok: true, location };
}

/** 이름만 바꾼다 — ID 는 그대로이므로 조건·인카운터 참조가 살아 있다(계약의 핵심). */
export function renameMapLocation(map: GameMap, locationId: string, name: string): LocationChange {
  const location = findLocationById(map, locationId);
  if (!location) return { ok: false, error: `로케이션을 찾을 수 없습니다: ${locationId}` };
  const next = sanitizeName(name);
  if (!next) return { ok: false, error: "이름을 비울 수 없습니다." };
  location.name = next;
  return { ok: true, location };
}

/** 기하만 바꾼다. 맵 밖으로 나가면 클램프한다(참조를 깨지 않는다). */
export function resizeMapLocation(map: GameMap, locationId: string, rect: Rect): LocationChange {
  const location = findLocationById(map, locationId);
  if (!location) return { ok: false, error: `로케이션을 찾을 수 없습니다: ${locationId}` };
  const clamped = clampRectToMap(rect, map);
  if (!clamped) return { ok: false, error: "맵 안에 들어오는 영역이 아닙니다." };
  location.x = clamped.x;
  location.y = clamped.y;
  location.w = clamped.w;
  location.h = clamped.h;
  return { ok: true, location };
}

export function updateMapLocationFields(
  map: GameMap,
  locationId: string,
  fields: { readonly note?: string; readonly tags?: readonly string[]; readonly color?: string },
): LocationChange {
  const location = findLocationById(map, locationId);
  if (!location) return { ok: false, error: `로케이션을 찾을 수 없습니다: ${locationId}` };
  if (fields.note !== undefined) {
    if (fields.note.trim().length === 0) delete location.note;
    else location.note = fields.note;
  }
  if (fields.tags !== undefined) {
    const tags = fields.tags.map((tag) => tag.trim()).filter(Boolean);
    if (tags.length === 0) delete location.tags;
    else location.tags = tags;
  }
  if (fields.color !== undefined) {
    if (fields.color.trim().length === 0) delete location.color;
    else location.color = fields.color;
  }
  return { ok: true, location };
}

/**
 * 삭제. **참조를 함께 지우지 않는다.** 남은 참조는 lint 가 눈에 보이는 진단으로 올리고
 * `repairMapLocationReferences` 가 고친다 — 조용히 조건을 지우면 저작자가 무엇을 잃었는지 모른다.
 */
export function deleteMapLocation(map: GameMap, locationId: string): boolean {
  const before = mapLocations(map);
  const remaining = before.filter((location) => location.id !== locationId);
  if (remaining.length === before.length) return false;
  if (remaining.length === 0) delete map.locations;
  else map.locations = remaining;
  return true;
}

/**
 * 맵 리사이즈 계약: 로케이션을 **클램프하고 절대 삭제하지 않는다.** 축소로 완전히 밖에 나간
 * 로케이션은 경계에 붙은 1×1 로 남고 lint 가 `map-location-degenerate` 로 알린다 —
 * 삭제하면 이벤트 조건과 인카운터 참조가 조용히 끊긴다.
 * 반환값은 실제로 변형된 로케이션 ID 들이다.
 */
export function clampLocationsToMapSize(map: GameMap, width: number, height: number): string[] {
  return retargetLocations(map, (location) => locationRect(location), { width, height });
}

/** 맵 시프트(내용 밀기)와 함께 로케이션도 밀고 클램프한다. */
export function shiftMapLocations(map: GameMap, dx: number, dy: number): string[] {
  return retargetLocations(
    map,
    (location) => ({ x: location.x + dx, y: location.y + dy, w: location.w, h: location.h }),
    { width: map.width, height: map.height },
  );
}

function retargetLocations(
  map: GameMap,
  target: (location: MapNamedLocation) => Rect,
  size: { readonly width: number; readonly height: number },
): string[] {
  const changed: string[] = [];
  const fallback: Rect = {
    x: Math.max(0, size.width - 1),
    y: Math.max(0, size.height - 1),
    w: MIN_LOCATION_SIZE,
    h: MIN_LOCATION_SIZE,
  };
  for (const location of mapLocations(map)) {
    const next = clampRectToMap(target(location), size) ?? fallback;
    if (next.x === location.x && next.y === location.y && next.w === location.w && next.h === location.h) continue;
    location.x = next.x;
    location.y = next.y;
    location.w = next.w;
    location.h = next.h;
    changed.push(location.id);
  }
  return changed;
}

// ────────────────────────────────────────────────── layoutPlan → locations 승격

export type AdoptLayoutRegionsResult = {
  readonly adopted: readonly MapNamedLocation[];
  /** 이미 같은 region 을 출처로 가진 로케이션이 있어 건너뛴 region ID. 멱등성 증거. */
  readonly skipped: readonly string[];
};

/**
 * 빌더 layoutPlan.regions → 명명 로케이션 승격(복사). 명시적 행위여야 하고, 멱등이어야 한다.
 * layoutPlan 은 읽기만 한다 — 옛 빌더 맵의 데이터는 한 바이트도 바뀌지 않는다.
 */
export function adoptLayoutRegionsAsLocations(
  map: GameMap,
  options: { readonly regionIds?: readonly string[]; readonly roles?: readonly string[] } = {},
): AdoptLayoutRegionsResult {
  const regions = map.layoutPlan?.regions ?? [];
  const alreadyAdopted = new Set(
    mapLocations(map)
      .map((location) => (location.origin?.kind === "layoutRegion" ? location.origin.regionId : undefined))
      .filter((regionId): regionId is string => Boolean(regionId)),
  );
  const adopted: MapNamedLocation[] = [];
  const skipped: string[] = [];
  for (const region of regions) {
    if (options.regionIds && !options.regionIds.includes(region.id)) continue;
    if (options.roles && !options.roles.includes(region.role)) continue;
    if (alreadyAdopted.has(region.id)) {
      skipped.push(region.id);
      continue;
    }
    const result = addMapLocation(map, {
      name: layoutRegionDisplayName(region, map),
      x: region.x,
      y: region.y,
      w: region.w,
      h: region.h,
      tags: [`role:${region.role}`, ...(region.tags ?? [])],
    });
    if (!result.ok) continue;
    result.location.origin = {
      kind: "layoutRegion",
      regionId: region.id,
      ...(map.layoutPlan?.kind === undefined ? {} : { planKind: map.layoutPlan.kind }),
    };
    adopted.push(result.location);
  }
  return { adopted, skipped };
}

function layoutRegionDisplayName(region: MapLayoutRegion, map: GameMap): string {
  const base = sanitizeName(region.label) || sanitizeName(region.role) || "구역";
  const used = new Set(mapLocations(map).map((location) => normalizeName(location.name)));
  if (!used.has(normalizeName(base))) return base;
  for (let suffix = 2; suffix <= used.size + 2; suffix += 1) {
    const candidate = sanitizeName(`${base} ${suffix}`);
    if (!used.has(normalizeName(candidate))) return candidate;
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────────── helpers

export function sanitizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_LOCATION_NAME_LENGTH);
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLowerCase();
}

/** 사각형을 맵 안으로 자른다. 완전히 밖이면 undefined. */
export function clampRectToMap(
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  map: { readonly width: number; readonly height: number },
): Rect | undefined {
  const left = Math.trunc(rect.x);
  const top = Math.trunc(rect.y);
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(map.width, left + Math.max(MIN_LOCATION_SIZE, Math.trunc(rect.w)));
  const y1 = Math.min(map.height, top + Math.max(MIN_LOCATION_SIZE, Math.trunc(rect.h)));
  if (x1 <= x0 || y1 <= y0) return undefined;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 두 타일 좌표로 만드는 사각형(드래그 제스처용). 양끝을 포함한다. */
export function rectFromDrag(a: LocationPoint, b: LocationPoint): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

const LOCATION_PALETTE = ["#7ad9ff", "#ffc857", "#8ce99a", "#ff9ec4", "#c3a6ff", "#ffa94d"] as const;

/** 편집기 레이어 표시색. 저작 색이 없으면 ID 로 결정론적 배정(같은 로케이션은 항상 같은 색). */
export function locationDisplayColor(location: MapNamedLocation): string {
  if (location.color) return location.color;
  let hash = 0;
  for (const char of location.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return LOCATION_PALETTE[hash % LOCATION_PALETTE.length];
}

/** 조수·요약용 한 줄 설명. UI 와 프롬프트가 같은 문장을 쓰게 한다. */
export function describeLocation(location: MapNamedLocation): string {
  const area = `@(${location.x},${location.y}) ${location.w}×${location.h}`;
  const note = location.note ? ` — ${location.note}` : "";
  return `${location.name} [${location.id}] ${area}${note}`;
}
