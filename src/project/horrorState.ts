/** Optional session state. Authored events stay immutable; eventLocations owns their positions. */
export interface PursuitDoor {
  mapId: string;
  x: number;
  y: number;
  remainingMs: number;
}
export interface PursuitState {
  home: { mapId: string; x: number; y: number };
  active: boolean;
  searchMs: number;
  lastSeen?: { x: number; y: number };
  /** Deterministic local search survives saving, unlike the transient path cache. */
  searchTarget?: { x: number; y: number };
  searchCursor?: number;
  /** 마지막으로 본 주인공의 진행 방향(한 칸 단위). 놓치면 마지막 목격 자리 다음으로 이 방향을 먼저 뒤진다. */
  lastHeading?: { x: number; y: number };
  /** 마지막으로 꺾은 쪽(+1 시계, -1 반시계) — 갈림길에서 수색 방향을 고른다. */
  lastTurn?: 1 | -1;
  /** 진행 방향으로 내다본 수색 중심. 있으면 둘레 훑기가 마지막 목격 자리 대신 여기를 중심으로 돈다. */
  searchCenter?: { x: number; y: number };
  doors: PursuitDoor[];
}
export interface HorrorState {
  pursuits: Record<string, PursuitState>;
  hiding?: { mapId: string; eventId: string; witnessedBy: string[] };
}

export function isHorrorState(value: unknown): value is HorrorState {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const unit = (v: unknown): boolean => v === -1 || v === 0 || v === 1;
  const point = (v: unknown): boolean => record(v) && finite(v.x) && finite(v.y) && Number.isInteger(v.x) && Number.isInteger(v.y);
  if (!record(value) || !record(value.pursuits)) return false;
  if (!Object.values(value.pursuits).every(p => record(p) && point(p.home) && record(p.home)
    && typeof p.home.mapId === 'string' && typeof p.active === 'boolean' && finite(p.searchMs)
    && (p.lastSeen === undefined || point(p.lastSeen))
    && (p.searchTarget === undefined || point(p.searchTarget))
    && (p.searchCursor === undefined || (finite(p.searchCursor) && Number.isInteger(p.searchCursor) && p.searchCursor < 12))
    && (p.searchCenter === undefined || point(p.searchCenter))
    && (p.lastHeading === undefined || (record(p.lastHeading) && unit(p.lastHeading.x) && unit(p.lastHeading.y)))
    && (p.lastTurn === undefined || p.lastTurn === 1 || p.lastTurn === -1)
    && Array.isArray(p.doors) && p.doors.length <= 64
    && p.doors.every(d => point(d) && record(d) && typeof d.mapId === 'string' && finite(d.remainingMs)))) return false;
  const h = value.hiding;
  return h === undefined || (record(h) && typeof h.mapId === 'string' && typeof h.eventId === 'string'
    && Array.isArray(h.witnessedBy) && h.witnessedBy.every(id => typeof id === 'string'));
}
