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
  doors: PursuitDoor[];
}
export interface HorrorState {
  pursuits: Record<string, PursuitState>;
  hiding?: { mapId: string; eventId: string; witnessedBy: string[] };
}

export function isHorrorState(value: unknown): value is HorrorState {
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const point = (v: unknown): boolean => record(v) && finite(v.x) && finite(v.y) && Number.isInteger(v.x) && Number.isInteger(v.y);
  if (!record(value) || !record(value.pursuits)) return false;
  if (!Object.values(value.pursuits).every(p => record(p) && point(p.home) && record(p.home)
    && typeof p.home.mapId === 'string' && typeof p.active === 'boolean' && finite(p.searchMs)
    && (p.lastSeen === undefined || point(p.lastSeen))
    && (p.searchTarget === undefined || point(p.searchTarget))
    && (p.searchCursor === undefined || (finite(p.searchCursor) && Number.isInteger(p.searchCursor) && p.searchCursor < 12))
    && Array.isArray(p.doors) && p.doors.length <= 64
    && p.doors.every(d => point(d) && record(d) && typeof d.mapId === 'string' && finite(d.remainingMs)))) return false;
  const h = value.hiding;
  return h === undefined || (record(h) && typeof h.mapId === 'string' && typeof h.eventId === 'string'
    && Array.isArray(h.witnessedBy) && h.witnessedBy.every(id => typeof id === 'string'));
}
