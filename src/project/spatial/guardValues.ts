import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "../io/guards";
import type * as S from "./types";
import { SPATIAL_SIZE_MAX } from "./types";

export type Parser<T> = (value: unknown, path: string) => T;
export const text: Parser<string> = (v, p) => requireString(p, v);
export const boolean: Parser<boolean> = (v, p) => requireBoolean(p, v);
export const id: Parser<S.SpatialId> = (v, p) => {
  const valid = (value: unknown): value is S.SpatialId => typeof value === "string" && value.trim().length > 0;
  assert(valid(v), `${p}: expected nonblank opaque ID`);
  return v;
};
export const integer = (range: readonly [number, number]): Parser<number> => (v, p) => {
  const n = requireNumber(p, v);
  assert(Number.isSafeInteger(n) && n >= range[0] && n <= range[1], `${p}: expected integer in ${range.join("..")} `);
  return n;
};
export const coordinate = integer([-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
export const positive = integer([1, Number.MAX_SAFE_INTEGER]);
export const size = integer([1, SPATIAL_SIZE_MAX]);
export const choice = <T extends string | number>(values: readonly T[]): Parser<T> => (v, p) => {
  const match = values.find(entry => entry === v);
  assert(match !== undefined, `${p}: unsupported value ${String(v)}`);
  return match;
};
export function record(v: unknown, p: string, fields?: string): Record<string, unknown> {
  const r = requireRecord(p, v);
  if (fields !== undefined) {
    const allowed = new Set(fields.split(" "));
    for (const key of Object.keys(r)) assert(allowed.has(key), `${p}.${key}: unsupported field`);
  }
  return Object.fromEntries(Object.entries(r));
}
export function list<T>(v: unknown, p: string, parse: Parser<T>): readonly T[] {
  return requireArray(p, v).map((entry, i) => parse(entry, `${p}[${i}]`));
}
export function dictionary<T>(v: unknown, p: string, parse: Parser<T>): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(record(v, p)).map(([key, entry]) => [key, parse(entry, `${p}.${key}`)]));
}
export const ids: Parser<readonly S.SpatialId[]> = (v, p) => list(v, p, id);
export const texts: Parser<readonly string[]> = (v, p) => list(v, p, text);
export const nullableId: Parser<S.SpatialId | null> = (v, p) => v === null ? null : id(v, p);
export const digest: Parser<string> = (v, p) => {
  const s = text(v, p);
  assert(/^[a-fA-F0-9]{64}$/.test(s), `${p}: expected SHA-256 hex digest`);
  return s;
};
export const point: Parser<S.SpatialPoint> = (v, p) => {
  const r = record(v, p);
  return { x: coordinate(r.x, `${p}.x`), y: coordinate(r.y, `${p}.y`) };
};
export const vertex: Parser<S.SpatialPoint> = (v, p) => point(record(v, p, "x y"), p);
export const rect: Parser<S.SpatialRect> = (v, p) => {
  const r = record(v, p, "x y width height");
  return { ...point(r, p), width: size(r.width, `${p}.width`), height: size(r.height, `${p}.height`) };
};
export const concreteEndpoint: Parser<S.SpatialConnection["from"]> = (v, p) => {
  const r = record(v, p, "occurrenceId portId");
  return { occurrenceId: id(r.occurrenceId, `${p}.occurrenceId`), portId: id(r.portId, `${p}.portId`) };
};
export const overviewRoute: Parser<S.SpatialOverviewRoute> = (v, p) => {
  const r = record(v, p, "occurrenceId localConnectionId");
  return { occurrenceId: id(r.occurrenceId, `${p}.occurrenceId`), localConnectionId: id(r.localConnectionId, `${p}.localConnectionId`) };
};
export const overviewEntries: Parser<readonly S.SpatialOverviewEntry[]> = (v, p) => {
  const entries = list(v, p, (value, path) => {
    const r = record(value, path, "target x y eventId returnEventId");
    return { ...point(r, path), target: concreteEndpoint(r.target, `${path}.target`),
      eventId: text(r.eventId, `${path}.eventId`), returnEventId: text(r.returnEventId, `${path}.returnEventId`) };
  });
  assert(entries.length > 0, `${p}: expected nonempty entries`);
  return entries;
};
