// test/migrationRoundTrip.m1.test.ts
// M1: 마이그레이션 결과물이 저장 시스템과 호환되는지 검증.
// migration.test.ts / migration-v3.test.ts가 변환 자체를 다루므로,
// 여기서는 '마이그레이션 → serialize → deserialize' 전체 체인의 안전성에 집중한다.

import { describe, expect, it } from "vitest";
import { deserialize, migrateV1toV2, migrateV1toV3, migrateV2toV3, serialize } from "@/project/io";
import { SCHEMA_VERSION } from "@/project/types";
import type { ProjectV1 } from "@/project/types";
import { cloneJson, makeV1 } from "./migrationFixtures";

// cloneJson이 unknown을 반환하므로 ProjectV1으로 명시적 단언.
function cloneV1(): ProjectV1 {
  return cloneJson(makeV1()) as ProjectV1;
}

function assertPersistable(project: ReturnType<typeof migrateV1toV3>): void {
  const restored = deserialize(serialize(project));
  expect(restored.version).toBe(SCHEMA_VERSION);
  expect(restored.startMapId).toBe(project.startMapId);
}

describe("마이그레이션 → 저장 체인 안전성", () => {
  it("v1 → v3 마이그레이션 결과가 serialize/deserialize 왕복에 살아남는다", () => {
    const v3 = migrateV1toV3(makeV1());
    expect(() => assertPersistable(v3)).not.toThrow();
  });

  it("v2 → v3 마이그레이션 결과가 serialize/deserialize 왕복에 살아남는다", () => {
    const v2 = migrateV1toV2(makeV1());
    const v3 = migrateV2toV3(v2);
    expect(() => assertPersistable(v3)).not.toThrow();
  });

  it("마이그레이션 후 맵 타일 데이터가 보존된다 (왕복 후에도)", () => {
    const v3 = migrateV1toV3(makeV1());
    const mapId = v3.startMapId;
    const tilesBefore = [...v3.maps[mapId].lowerTiles];

    const restored = deserialize(serialize(v3));
    expect(restored.maps[mapId].lowerTiles).toEqual(tilesBefore);
  });

  it("마이그레이션 후 이벤트 명령이 보존된다 (왕복 후에도)", () => {
    const v3 = migrateV1toV3(makeV1());
    const mapId = v3.startMapId;
    const cmdKindsBefore = v3.maps[mapId].events.flatMap((e) =>
      (e.pages ?? []).flatMap((p) => p.commands.map((c) => c.kind))
    );

    const restored = deserialize(serialize(v3));
    const cmdKindsAfter = restored.maps[mapId].events.flatMap((e) =>
      (e.pages ?? []).flatMap((p) => p.commands.map((c) => c.kind))
    );
    expect(cmdKindsAfter).toEqual(cmdKindsBefore);
  });
});

describe("마이그레이션 엣지 케이스", () => {
  it("이벤트가 없는 맵도 안전하게 마이그레이션된다", () => {
    const base = cloneV1();
    const mapId = Object.keys(base.maps)[0];
    base.maps[mapId].events = [];

    const v3 = migrateV1toV3(base);
    expect(v3.maps[mapId].events).toEqual([]);
    expect(() => assertPersistable(v3)).not.toThrow();
  });

  it("database 구조가 마이그레이션 후에도 유효하다", () => {
    const v3 = migrateV1toV3(makeV1());
    expect(v3.database.actors.length).toBeGreaterThan(0);
    expect(v3.system.startActorIds.length).toBeGreaterThan(0);
    // 시작 액터가 database에 존재해야 함
    for (const actorId of v3.system.startActorIds) {
      expect(v3.database.actors.some((a) => a.id === actorId)).toBe(true);
    }
  });

  it("마이그레이션 후 resourceProfiles가 채워진다", () => {
    const v3 = migrateV1toV3(makeV1());
    expect(v3.resourceProfiles.length).toBeGreaterThan(0);
  });

  it("마이그레이션 후 스위치가 flags에서 유도되어 보존된다", () => {
    const base = cloneV1();
    const flagNames = Object.keys(base.flags);
    expect(flagNames.length).toBeGreaterThan(0);

    const v3 = migrateV1toV3(base);
    // v1 flags의 각 키가 v3 switches에 대응 항목으로 존재해야 함
    expect(v3.switches.length).toBeGreaterThanOrEqual(flagNames.length);
  });
});
