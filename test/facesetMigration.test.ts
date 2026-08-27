// test/facesetMigration.test.ts
// v3 → v4 얼굴 마이그레이션. 저장된 (시트 리소스 id, faceIndex) 짝이 낱장 얼굴 id 하나로
// 바뀌는지, 그리고 faceIndex 키가 프로젝트 어디에도 남지 않는지 검증한다.
//
// 왜 이 테스트가 필요한가: 인덱스가 생략된 저장본은 "0번 칸"을 뜻한다. 마이그레이션이
// 생략을 못 읽으면 주인공 얼굴이 조용히 빈 그림이 된다(recon-data-model.md §7-3).

import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { SCHEMA_VERSION } from "@/project/types";

type Json = Record<string, unknown>;

function legacyChangeFace(faceIndex: number): Json {
  return {
    kind: "changeFace",
    resourceId: "easyrpg-faceset-actor1",
    faceIndex,
    position: "left",
    flipHorizontally: false,
  };
}

function legacyV3Payload(): Json {
  const raw = JSON.parse(serialize(createBlankProject())) as Json;
  raw.version = 3;

  const database = raw.database as { actors: Json[]; troops: Json[] };
  const actors = database.actors;
  expect(actors.length).toBeGreaterThanOrEqual(3);
  actors[0]!.faceResourceId = "easyrpg-faceset-actor1";
  actors[0]!.faceIndex = 7;
  actors[1]!.faceResourceId = "easyrpg-faceset-actor1";
  delete actors[1]!.faceIndex;
  actors[2]!.faceResourceId = "easyrpg-faceset-actor1";
  actors[2]!.faceIndex = 99;

  const mapId = raw.startMapId as string;
  const maps = raw.maps as Record<string, { events: Json[] }>;
  maps[mapId]!.events = [
    {
      id: "ev_face",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "ev_face_page_1",
          name: "Page 1",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            legacyChangeFace(15),
            {
              kind: "choices",
              prompt: "누구 얼굴?",
              options: [{ text: "주인공", branch: [legacyChangeFace(15)] }],
            },
            {
              kind: "m2Command",
              commandId: "m2-025-change-actor-faceset",
              fields: { target: "actor_hero", value: "easyrpg-faceset-people1", faceIndex: 3 },
            },
            // 칸 번호가 기본값 0 이라 짧게 직렬화된 생기본 — faceIndex 키가 아예 없다.
            {
              kind: "m2Command",
              commandId: "m2-025-change-actor-faceset",
              fields: { target: "actor_hero", value: "easyrpg-faceset-people1" },
            },
            // 얼굴과 믴상관없는 m2 명령은 건드리지 않는다.
            {
              kind: "m2Command",
              commandId: "m2-024-change-actor-graphic",
              fields: { target: "actor_hero", value: "easyrpg-charset-actor1" },
            },
          ],
        },
      ],
    },
  ];

  (raw.commonEvents as Json[]).push({
    id: "ce_face",
    name: "얼굴 공통",
    trigger: "parallel",
    commands: [legacyChangeFace(15)],
  });

  database.troops[0]!.battleEventPages = [
    {
      id: "bp_face",
      name: "전투 얼굴",
      conditions: [],
      span: "battle",
      commands: [legacyChangeFace(15)],
    },
  ];

  const session = raw.session as Json;
  session.actorFaceResourceIds = { actor_hero: "easyrpg-faceset-people1" };
  session.actorFaceIndices = { actor_hero: 4 };

  return raw;
}

function keyPaths(value: unknown, key: string, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => keyPaths(entry, key, `${path}[${index}]`));
  }
  if (value === null || typeof value !== "object") return [];
  const found: string[] = [];
  for (const [name, child] of Object.entries(value as Json)) {
    if (name === key) found.push(`${path}.${name}`);
    found.push(...keyPaths(child, key, `${path}.${name}`));
  }
  return found;
}

describe("v3 → v4 faceset migration", () => {
  it("rewrites actor (sheet, faceIndex) pairs into per-face resource ids", () => {
    const project = deserialize(JSON.stringify(legacyV3Payload()));

    expect(project.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(4);
    expect(project.database.actors[0]!.faceResourceId).toBe("easyrpg-faceset-actor1-07");
    // 인덱스가 없는 저장본은 0번 칸이다 — 빈 얼굴이 아니다.
    expect(project.database.actors[1]!.faceResourceId).toBe("easyrpg-faceset-actor1-00");
    // 범위를 넘는 값은 마지막 칸으로 고정한다(과거 normalizeOptionalSheetIndex 와 같은 클램프).
    expect(project.database.actors[2]!.faceResourceId).toBe("easyrpg-faceset-actor1-15");
  });

  it("rewrites changeFace commands on pages, nested branches, common events, battle events", () => {
    const project = deserialize(JSON.stringify(legacyV3Payload()));
    const page = project.maps[project.startMapId]!.events[0]!.pages![0]!;

    const face = page.commands[0]!;
    expect(face.kind).toBe("changeFace");
    if (face.kind !== "changeFace") throw new Error("expected changeFace");
    expect(face.resourceId).toBe("easyrpg-faceset-actor1-15");

    const choices = page.commands[1]!;
    if (choices.kind !== "choices") throw new Error("expected choices");
    const nested = choices.options[0]!.branch[0]!;
    if (nested.kind !== "changeFace") throw new Error("expected nested changeFace");
    expect(nested.resourceId).toBe("easyrpg-faceset-actor1-15");

    const common = project.commonEvents.find((entry) => entry.id === "ce_face")!.commands[0]!;
    if (common.kind !== "changeFace") throw new Error("expected common changeFace");
    expect(common.resourceId).toBe("easyrpg-faceset-actor1-15");

    const battle = project.database.troops[0]!.battleEventPages[0]!.commands[0]!;
    if (battle.kind !== "changeFace") throw new Error("expected battle changeFace");
    expect(battle.resourceId).toBe("easyrpg-faceset-actor1-15");
  });

  it("rewrites m2 change-actor-faceset fields and session override maps", () => {
    const project = deserialize(JSON.stringify(legacyV3Payload()));
    const page = project.maps[project.startMapId]!.events[0]!.pages![0]!;
    const m2 = page.commands[2]!;
    if (m2.kind !== "m2Command") throw new Error("expected m2Command");
    expect(m2.fields.value).toBe("easyrpg-faceset-people1-03");
    expect(m2.fields.faceIndex).toBeUndefined();

    // faceIndex 키가 없는 생기본도 0번 칸이다. 안 옮기면 48px 얼굴 자리에 192x192 시트가 통짜로 그려진다
    // — 시트 id 는 여전히 등록되어 있어서 검사도 이걸 말리지 않는다.
    const m2NoIndex = page.commands[3]!;
    if (m2NoIndex.kind !== "m2Command") throw new Error("expected m2Command");
    expect(m2NoIndex.fields.value).toBe("easyrpg-faceset-people1-00");
    expect(m2NoIndex.fields.faceIndex).toBeUndefined();

    // 얼굴 시트가 아닌 id 는 faceIdForSheetCell 이 그대로 되돌린다(무조건 재작성 없음).
    const m2Other = page.commands[4]!;
    if (m2Other.kind !== "m2Command") throw new Error("expected m2Command");
    expect(m2Other.fields.value).toBe("easyrpg-charset-actor1");

    const session = project.session as unknown as {
      actorFaceResourceIds?: Record<string, string>;
      actorFaceIndices?: Record<string, number>;
    };
    expect(session.actorFaceResourceIds?.actor_hero).toBe("easyrpg-faceset-people1-04");
    expect(session.actorFaceIndices).toBeUndefined();
  });

  it("leaves no faceIndex key anywhere in the migrated project", () => {
    const project = deserialize(JSON.stringify(legacyV3Payload()));
    const paths = keyPaths(JSON.parse(serialize(project)), "faceIndex");
    expect(paths, paths.join("\n")).toEqual([]);
  });

  it("is idempotent — per-face ids survive a second load unchanged", () => {
    const once = deserialize(JSON.stringify(legacyV3Payload()));
    const twice = deserialize(serialize(once));
    expect(serialize(twice)).toBe(serialize(once));
    expect(twice.database.actors[0]!.faceResourceId).toBe("easyrpg-faceset-actor1-07");
  });
});
