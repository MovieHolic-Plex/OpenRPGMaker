import { describe, expect, it } from "vitest";
import type { Project } from "@/project/types";
import {
  buildWorldDigest,
  lintWorld,
  normalizeProjectWorld,
  normalizeWorld,
  type ProjectWorld,
  type WorldEntity,
} from "@/project/world";

function world(entities: readonly WorldEntity[], relations: ProjectWorld["relations"] = []): ProjectWorld {
  return { entities, relations };
}

function entity(patch: Partial<WorldEntity> = {}): WorldEntity {
  return {
    id: "w_entity",
    type: "character",
    name: "아린",
    summary: "마을의 수호자",
    origin: "user",
    ...patch,
  };
}

function smallProject(): Project {
  return {
    startMapId: "map_1",
    maps: {
      map_1: {
        id: "map_1",
        name: "테스트 맵",
        width: 10,
        height: 10,
        tilesetId: "tileset_1",
        tileSize: 16,
        lowerTiles: [],
        upperTiles: [],
        events: [],
      },
    },
    database: {
      items: [],
      skills: [],
      actors: [],
    },
  } as unknown as Project;
}

function addNamedNpc(project: Project, id = "ev_sera"): void {
  project.maps[project.startMapId].events.push({
    id,
    x: 4,
    y: 5,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "세라",
        conditions: [],
        graphic: { sprite: { type: "bundled", id: "charset_sera" } },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  });
}

describe("world guards", () => {
  it("project.world가 없으면 빈 world로 정규화한다", () => {
    expect(normalizeProjectWorld({ title: "legacy" })).toEqual({ entities: [], relations: [] });
  });

  it("알 수 없는 필드를 제거하고 world id prefix와 relation id를 정규화한다", () => {
    const normalized = normalizeWorld({
      extra: "drop",
      entities: [
        {
          id: "hero",
          type: "character",
          name: "아린",
          summary: "수호자",
          origin: "user",
          tags: ["hero"],
          refs: [{ kind: "map", id: "map_1", extra: "drop" }],
          extra: "drop",
        },
        { id: "guild", type: "faction", name: "상단", summary: "상인 조직", origin: "ai" },
      ],
      relations: [{ a: "hero", b: "guild", kind: "memberOf", extra: "drop" }],
    });

    expect(normalized).toEqual({
      entities: [
        {
          id: "w_hero",
          type: "character",
          name: "아린",
          summary: "수호자",
          origin: "user",
          tags: ["hero"],
          refs: [{ kind: "map", id: "map_1" }],
        },
        { id: "w_guild", type: "faction", name: "상단", summary: "상인 조직", origin: "ai" },
      ],
      relations: [{ a: "w_hero", b: "w_guild", kind: "memberOf" }],
    });
  });

  it("잘못된 entity type을 거부한다", () => {
    expect(() =>
      normalizeWorld({ entities: [{ ...entity(), type: "monster" }], relations: [] })
    ).toThrow(/type/);
  });

  it("잘못된 ref kind를 거부한다", () => {
    expect(() =>
      normalizeWorld({ entities: [{ ...entity({ refs: [{ kind: "monster", id: "m1" } as never] }) }], relations: [] })
    ).toThrow(/refs\[0\]\.kind/);
  });

  it("중복 id를 거부한다", () => {
    expect(() =>
      normalizeWorld({ entities: [entity({ id: "hero" }), entity({ id: "w_hero", name: "복제" })], relations: [] })
    ).toThrow(/중복/);
  });

  it("relation이 없는 entity를 가리키면 거부한다", () => {
    expect(() =>
      normalizeWorld({ entities: [entity({ id: "hero" })], relations: [{ a: "hero", b: "ghost", kind: "knows" }] })
    ).toThrow(/entities에 없습니다/);
  });
});

describe("world digest", () => {
  it("빈 world를 짧은 문장으로 반환한다", () => {
    expect(buildWorldDigest(world([]), { maxTokens: 20 })).toBe("세계관 없음");
  });

  it("이름, 타입, summary만 압축해서 출력한다", () => {
    const digest = buildWorldDigest(world([entity({ name: "  아린  ", summary: "  마을을   지킨다  ", body: "긴 본문" })]), {
      maxTokens: 50,
    });
    expect(digest).toBe("[character] 아린: 마을을 지킨다");
    expect(digest).not.toContain("긴 본문");
  });

  it("상한 초과 시 타입 우선순위로 자르고 생략 수를 표시한다", () => {
    const digest = buildWorldDigest(
      world([
        entity({ id: "w_concept", type: "concept", name: "마력", summary: "세계의 힘" }),
        entity({ id: "w_rule", type: "guideline", name: "톤", summary: "차분하게" }),
        entity({ id: "w_faction", type: "faction", name: "상단", summary: "도시를 움직인다" }),
        entity({ id: "w_character", type: "character", name: "세라", summary: "길잡이" }),
      ]),
      { maxTokens: 14 }
    );

    expect(digest).toContain("[guideline] 톤");
    expect(digest).toContain("[faction] 상단");
    expect(digest).not.toContain("[concept] 마력");
    expect(digest).toContain("…외 2개");
  });
});

describe("world lint", () => {
  it.each([
    ["map", "missing_map"],
    ["event", "missing_event"],
    ["item", "missing_item"],
    ["skill", "missing_skill"],
    ["actor", "missing_actor"],
  ] as const)("없는 %s ref를 error로 보고한다", (kind, id) => {
    const project = smallProject();
    const issues = lintWorld(world([entity({ refs: [{ kind, id }] })]), project);

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "world-ref-missing",
        message: expect.stringContaining(`${kind}:${id}`),
      })
    );
    expect(issues.find((issue) => issue.code === "world-ref-missing")).not.toHaveProperty("x");
  });

  it("refs 없는 lore 개체를 warning으로 보고한다", () => {
    const project = smallProject();
    const issues = lintWorld(world([entity({ type: "place", refs: [] })]), project);

    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", code: "world-lore-unlinked" }));
  });

  it("world에 등록되지 않은 명명 NPC 이벤트를 warning으로 보고한다", () => {
    const project = smallProject();
    addNamedNpc(project);
    const issues = lintWorld(world([]), project);

    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "world-npc-unregistered", mapId: project.startMapId, x: 4, y: 5 })
    );
  });

  it("event ref가 있는 명명 NPC 이벤트는 미등록 warning을 내지 않는다", () => {
    const project = smallProject();
    addNamedNpc(project);
    const issues = lintWorld(world([entity({ refs: [{ kind: "event", id: "ev_sera" }] })]), project);

    expect(issues.some((issue) => issue.code === "world-npc-unregistered")).toBe(false);
  });

  it("world에 등록되지 않은 명명 아이템을 warning으로 보고한다", () => {
    const project = smallProject();
    const item = { id: "item_potion", name: "회복약" };
    project.database.items = [item as never];

    const issues = lintWorld(world([]), project);

    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "warning", code: "world-item-unregistered", message: expect.stringContaining(item.id) })
    );
  });

  it("item ref가 있는 명명 아이템은 미등록 warning을 내지 않는다", () => {
    const project = smallProject();
    const item = { id: "item_potion", name: "회복약" };
    project.database.items = [item as never];

    const issues = lintWorld(world([entity({ refs: [{ kind: "item", id: item.id }] })]), project);

    expect(issues.some((issue) => issue.code === "world-item-unregistered")).toBe(false);
  });

  it("body 없는 guideline을 info로 보고한다", () => {
    const project = smallProject();
    const issues = lintWorld(world([entity({ type: "guideline", body: " " })]), project);

    expect(issues).toContainEqual(expect.objectContaining({ severity: "info", code: "world-guideline-body-missing" }));
  });

  it("body가 있는 guideline은 info를 내지 않는다", () => {
    const project = smallProject();
    const issues = lintWorld(world([entity({ type: "guideline", body: "문체는 간결하게." })]), project);

    expect(issues.some((issue) => issue.code === "world-guideline-body-missing")).toBe(false);
  });
});
