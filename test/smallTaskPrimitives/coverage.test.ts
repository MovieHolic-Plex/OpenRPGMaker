import { expect, it } from "vitest";
import { PRIMITIVES, PRIMITIVE_UNITS } from "@/editor/smallTask/primitives";
import { OWNERSHIP } from "@/editor/smallTask/primitives/ownership";
import type { PrimitiveCovers } from "@/editor/smallTask/primitives/types";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";

const dimensions = ["commandKinds", "m2Ids", "conditionKinds", "collections", "tools"] as const;
const prefixes = /^(?:cmd|m2|cond|db|map|tile|event|npc|dialogue|quest|switch|variable|ending|system|project|move|commonEvent)\./u;
const coverKeys = (covers: PrimitiveCovers) => dimensions.flatMap(key => (covers[key] ?? []).map(value => `${key}:${value}`));

it("소유권 표에 명령 종류 90개, 전용 목록 93개, 조건 37개, 자료집 23개가 있다", () => {
  const rows: readonly PrimitiveCovers[] = Object.values(OWNERSHIP);
  const totals = Object.fromEntries(dimensions.slice(0, 4).map(key => [key, rows.flatMap(row => row[key] ?? [])]));
  expect(Object.fromEntries(Object.entries(totals).map(([key, values]) => [key, new Set(values).size])))
    .toEqual({ commandKinds: 90, m2Ids: 93, conditionKinds: 37, collections: 23 });
  expect([...totals.commandKinds!].sort()).toEqual(COMMAND_KINDS.filter(kind => kind !== "m2Command").sort());
  expect([...totals.conditionKinds!].sort()).toEqual([...CONDITION_KINDS].sort());
  const owned = rows.flatMap(coverKeys);
  expect(new Set(owned).size).toBe(owned.length);
});

it("등록한 유닛의 소유 항목을 빠짐없이 한 유닛에서만 다룬다", () => {
  expect(PRIMITIVE_UNITS.map(unit => unit.UNIT)).toEqual(Object.keys(OWNERSHIP));
  const ownerByKey = new Map(Object.entries(OWNERSHIP).flatMap(([unit, covers]) =>
    coverKeys(covers).map(key => [key, unit] as const)));
  for (const unit of PRIMITIVE_UNITS) {
    if (!unit.PRIMITIVES.length) continue;
    const actual = new Set<string>();
    for (const primitive of unit.PRIMITIVES) {
      expect(primitive.unit, primitive.id).toBe(unit.UNIT);
      for (const key of coverKeys(primitive.covers)) {
        expect(ownerByKey.get(key), key).toBe(unit.UNIT);
        actual.add(key);
      }
    }
    const owned = coverKeys(OWNERSHIP[unit.UNIT]);
    expect([...actual], unit.UNIT).toEqual(expect.arrayContaining(owned));
    expect(owned, unit.UNIT).toEqual(expect.arrayContaining([...actual]));
  }
  const ids = new Set<string>();
  for (const primitive of PRIMITIVES) {
    expect(ids.has(primitive.id), primitive.id).toBe(false);
    ids.add(primitive.id);
    if (!primitive.aliasOf) expect(primitive.id).toMatch(prefixes);
  }
});
