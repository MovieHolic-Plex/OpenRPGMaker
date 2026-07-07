import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { proposalCompletenessWarnings, type ProposalCompletenessCall } from "@/ai/proposalCompleteness";
import { proposalSummaryLines } from "@/editor/panels/aiChatPanel";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { allTools } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ChangeSummary, ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import type { ProjectWorld, WorldEntity } from "@/project/world";

function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function call(name: string, args: Record<string, unknown>, diff: Partial<ChangeSummary>): ProposalCompletenessCall {
  return { name, args, result: { ok: true, diff: changeSummary(diff) } };
}

function entity(patch: Partial<WorldEntity> = {}): WorldEntity {
  return {
    id: "w_hero",
    type: "character",
    name: "아린",
    summary: "마을 수호자",
    origin: "user",
    ...patch,
  };
}

function world(entities: readonly WorldEntity[], relations: ProjectWorld["relations"] = []): ProjectWorld {
  return { entities, relations };
}

function ctxWithMap(): ToolContext {
  const ctx: ToolContext = { project: createEmptyToolProject("세계관 W3 테스트") };
  const created = runTool(ctx, "create_map", { id: "map_w3", name: "W3 마을", width: 12, height: 10 });
  expect(created.ok, created.summary).toBe(true);
  return ctx;
}

describe("world AI tools W3", () => {
  it("툴 레지스트리에 세계관 툴 3종이 노출된다", () => {
    const byName = new Map(allTools().map((tool) => [tool.name, tool]));
    expect(byName.get("query_world")?.mode).toBe("read");
    expect(byName.get("upsert_world_entities")?.mode).toBe("write");
    expect(byName.get("link_world_ref")?.mode).toBe("write");
  });

  it("query_world는 type으로 세계관 개체를 필터링한다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([
      entity({ type: "character", name: "아린" }),
      entity({ id: "w_town", type: "place", name: "W3 마을", summary: "시작 마을" }),
    ]);

    const result = runTool(ctx, "query_world", { type: "place" });
    const data = result.data as { entities: WorldEntity[] };

    expect(result.ok, result.summary).toBe(true);
    expect(data.entities.map((entry) => entry.name)).toEqual(["W3 마을"]);
  });

  it("query_world는 tags/text로 상세와 관계를 함께 찾는다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world(
      [
        entity({ id: "w_hero", name: "아린", tags: ["수호자"], body: "잿불 길드와 협력한다." }),
        entity({ id: "w_guild", type: "faction", name: "잿불 길드", summary: "마을 방위 조직", tags: ["수호자"] }),
      ],
      [{ a: "w_hero", b: "w_guild", kind: "allyOf" }]
    );

    const result = runTool(ctx, "query_world", { tags: ["수호자"], text: "길드" });
    const data = result.data as { entities: WorldEntity[]; relations: ProjectWorld["relations"] };

    expect(data.entities.map((entry) => entry.id)).toEqual(["w_hero", "w_guild"]);
    expect(data.relations).toEqual([{ a: "w_hero", b: "w_guild", kind: "allyOf" }]);
  });

  it("query_world는 빈 세계관을 빈 결과로 반환한다", () => {
    const result = runTool(ctxWithMap(), "query_world", {});
    expect(result.ok, result.summary).toBe(true);
    expect((result.data as { entities: unknown[] }).entities).toEqual([]);
  });

  it("upsert_world_entities는 id 없는 신규 세계관 개체에 w_ id를 생성한다", () => {
    const ctx = ctxWithMap();
    const result = runTool(ctx, "upsert_world_entities", {
      entities: [{ type: "character", name: "세라", summary: "약초꾼" }],
    });
    const saved = ctx.project.world?.entities[0];

    expect(result.ok, result.summary).toBe(true);
    expect(saved?.id.startsWith("w_")).toBe(true);
    expect(saved?.origin).toBe("ai");
    expect(result.diff?.worldEntitiesAdded).toBe(1);
  });

  it("upsert_world_entities는 기존 id를 수정하고 normalizeWorld로 prefix를 보정한다", () => {
    const ctx = ctxWithMap();
    const result = runTool(ctx, "upsert_world_entities", {
      entities: [{ id: "hero", type: "character", name: "아린", summary: "수호자" }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.world?.entities[0]?.id).toBe("w_hero");

    const modified = runTool(ctx, "upsert_world_entities", {
      entities: [{ id: "hero", summary: "마을의 수호자", tags: ["hero"] }],
    });
    expect(modified.ok, modified.summary).toBe(true);
    expect(ctx.project.world?.entities[0]).toMatchObject({ summary: "마을의 수호자", tags: ["hero"] });
    expect(modified.diff?.worldEntitiesModified).toBe(1);
  });

  it("upsert_world_entities는 proposal 카드용 세계관 추가/수정 요약을 만든다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity({ id: "w_hero", name: "아린", summary: "옛 요약" })]);

    const result = runTool(ctx, "upsert_world_entities", {
      entities: [
        { id: "w_hero", summary: "새 요약" },
        { type: "place", name: "항구", summary: "새 장소" },
      ],
    });
    const lines = proposalSummaryLines([
      { name: "upsert_world_entities", args: {}, summary: result.summary, result, destructive: false },
    ]);

    expect(result.summary).toContain("세계관 추가 1/수정 1");
    expect(result.summary).toContain("아린");
    expect(result.summary).toContain("항구");
    expect(lines[0]).toContain("세계관 추가 1/수정 1");
  });

  it("upsert_world_entities는 locked 세계관 개체 수정을 거부한다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity({ locked: true })]);
    const before = serialize(ctx.project);

    const result = runTool(ctx, "upsert_world_entities", {
      entities: [{ id: "w_hero", summary: "바꾸기" }],
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("world-entity-locked");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("upsert_world_entities는 신규 필수 필드가 빠지면 거부한다", () => {
    const result = runTool(ctxWithMap(), "upsert_world_entities", {
      entities: [{ name: "요약 없는 항목" }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("world-entity-required");
  });

  it("link_world_ref는 기존 게임 개체 ref를 연결한다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity()]);
    const result = runTool(ctx, "link_world_ref", {
      entityId: "hero",
      kind: "map",
      id: "map_w3",
      action: "link",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.world?.entities[0]?.refs).toEqual([{ kind: "map", id: "map_w3" }]);
    expect(result.diff?.worldEntitiesModified).toBe(1);
  });

  it("link_world_ref는 기존 ref를 해제한다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity({ refs: [{ kind: "map", id: "map_w3" }] })]);
    const result = runTool(ctx, "link_world_ref", {
      entityId: "w_hero",
      kind: "map",
      id: "map_w3",
      action: "unlink",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.world?.entities[0]?.refs).toEqual([]);
  });

  it("link_world_ref는 없는 세계관 개체를 거부한다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity()]);
    const result = runTool(ctx, "link_world_ref", {
      entityId: "ghost",
      kind: "map",
      id: "map_w3",
      action: "link",
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("world-entity-not-found");
  });

  it("link_world_ref는 존재하지 않는 게임 개체 id를 거부한다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity()]);
    const result = runTool(ctx, "link_world_ref", {
      entityId: "w_hero",
      kind: "item",
      id: "missing_item",
      action: "link",
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("world-ref-not-found");
  });
});

describe("world AI context and lint W3", () => {
  it("contextBuilder는 세계관 다이제스트를 매 턴 컨텍스트에 넣는다", () => {
    const project = createBlankProject();
    project.world = world([entity({ name: "아린", summary: "잿불을 지킨다" })]);

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).toContain("## 세계관 다이제스트");
    expect(prompt).toContain("[character] 아린: 잿불을 지킨다");
  });

  it("contextBuilder는 빈 세계관이면 다이제스트 섹션을 생략한다", () => {
    const project = createBlankProject();
    project.world = world([]);

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).not.toContain("## 세계관 다이제스트");
  });

  it("contextBuilder는 세계관이 있으면 villageInfoDocuments 본문 중복 발췌를 피한다", () => {
    const project = createBlankProject();
    project.world = world([entity({ type: "place", name: "빈 맵", summary: "시작 지점" })]);
    project.villageInfoDocuments = [{
      id: "doc_start",
      mapId: project.startMapId,
      title: "빈 맵 문서",
      markdown: "중복되면 안 되는 긴 본문",
    }];

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).toContain("## 게임 스타일 문서(원문 보존)");
    expect(prompt).toContain("빈 맵 문서");
    expect(prompt).not.toContain("중복되면 안 되는 긴 본문");
  });

  it("proposalCompleteness는 NPC 생성에 세계관 툴이 없으면 세계관 미기재 warning을 낸다", () => {
    const warnings = proposalCompletenessWarnings({
      calls: [call("place_npc", { mapId: "m1", name: "세라" }, { eventsAdded: 1 })],
    });

    expect(warnings).toEqual(["⚠ 미이행: 세계관 미기재 — NPC 생성·수정 제안에 세계관 업데이트가 없습니다."]);
  });

  it("proposalCompleteness는 세계관 upsert가 있으면 세계관 미기재 warning을 내지 않는다", () => {
    const warnings = proposalCompletenessWarnings({
      calls: [
        call("place_npc", { mapId: "m1", name: "세라" }, { eventsAdded: 1 }),
        call("upsert_world_entities", {}, { worldEntitiesAdded: 1 }),
      ],
    });

    expect(warnings).toEqual([]);
  });

  it("proposalCompleteness는 맵과 명명 아이템 생성도 세계관 미기재 대상으로 본다", () => {
    const warnings = proposalCompletenessWarnings({
      calls: [
        call("create_map", { name: "항구" }, { mapsAdded: 1 }),
        call("upsert_item", { item: { id: "it_key", name: "등대 열쇠" } }, { dbRecordsChanged: 1 }),
      ],
    });

    expect(warnings[0]).toContain("세계관 미기재");
    expect(warnings[0]).toContain("맵/아이템");
  });

  it("run_lint는 세계관 lint warning/info를 기존 출력에 합류시킨다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([
      entity({ type: "place", refs: [] }),
      entity({ id: "w_rule", type: "guideline", name: "문체", summary: "담백하게", body: " " }),
    ]);

    const lint = runTool(ctx, "run_lint", {});
    const data = lint.data as { counts: { warnings: number; infos: number }; issues: Array<{ code: string; severity: string }> };

    expect(lint.ok, lint.summary).toBe(true);
    expect(data.issues).toContainEqual(expect.objectContaining({ code: "world-lore-unlinked", severity: "warning" }));
    expect(data.issues).toContainEqual(expect.objectContaining({ code: "world-guideline-body-missing", severity: "info" }));
    expect(data.counts.warnings).toBeGreaterThanOrEqual(1);
    expect(data.counts.infos).toBeGreaterThanOrEqual(1);
  });

  it("run_lint는 세계관 ref 무결성 error를 합류시킨다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity({ refs: [{ kind: "item", id: "missing_item" }] })]);

    const lint = runTool(ctx, "run_lint", {});
    const data = lint.data as { issues: Array<{ code: string; severity: string }> };

    expect(data.issues).toContainEqual(expect.objectContaining({ code: "world-ref-missing", severity: "error" }));
  });
});

describe("villageInfoDocuments to world migration W3", () => {
  function projectWithVillageDocument(): Project {
    const project = createBlankProject();
    project.villageInfoDocuments = [{
      id: "doc_start",
      mapId: project.startMapId,
      title: "시작 마을",
      markdown: "첫 줄 요약\n\n본문",
    }];
    delete project.world;
    return project;
  }

  it("deserialize는 world가 없으면 villageInfoDocuments를 place 세계관으로 마이그레이션하고 원본을 보존한다", () => {
    const restored = deserialize(serialize(projectWithVillageDocument()));
    const migrated = restored.world?.entities[0];

    expect(restored.villageInfoDocuments).toHaveLength(1);
    expect(migrated).toMatchObject({
      type: "place",
      name: "시작 마을",
      summary: "첫 줄 요약",
      body: "첫 줄 요약\n\n본문",
      refs: [{ kind: "map", id: restored.startMapId }],
      origin: "user",
    });
  });

  it("villageInfoDocuments 마이그레이션은 serialize/deserialize 반복에도 멱등이다", () => {
    const once = deserialize(serialize(projectWithVillageDocument()));
    const twice = deserialize(serialize(once));

    expect(twice.villageInfoDocuments).toHaveLength(1);
    expect(twice.world?.entities).toHaveLength(1);
    expect(twice.world?.entities[0]?.id).toBe(once.world?.entities[0]?.id);
  });

  it("이미 같은 map ref place 세계관이 있으면 중복 생성하지 않는다", () => {
    const project = projectWithVillageDocument();
    project.world = world([
      entity({
        id: "w_existing_place",
        type: "place",
        name: "기존 장소",
        summary: "이미 있음",
        refs: [{ kind: "map", id: project.startMapId }],
      }),
    ]);

    const restored = deserialize(serialize(project));

    expect(restored.world?.entities).toHaveLength(1);
    expect(restored.world?.entities[0]?.name).toBe("기존 장소");
    expect(restored.villageInfoDocuments).toHaveLength(1);
  });
});
