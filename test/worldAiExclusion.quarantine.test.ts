// 세계관(project.world) AI 배제 계약.
//
// 2026-08-28 감독 결정: 세계관은 온톨로지 전제가 실제 저작 흐름에 붙지 않은 상태에서
// 매 턴 다이제스트 토큰 + 툴 예산 + 프로포절 경고 + lint warning 만 걷어가고 있었다.
// 데이터(project.world)와 사용자 패널은 그대로 두고 **AI 배선만** 끊는다.
// 이 파일은 그 배제가 조용히 되살아나지 않게 고정한다. 되돌릴 때는 이 파일을 지우고
// 이전 계약(worldAiW3.test.ts, git history)을 복원하면 된다.

import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { proposalCompletenessWarnings, type ProposalCompletenessCall } from "@/ai/proposalCompleteness";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { allTools } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ChangeSummary, ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import type { ProjectWorld, WorldEntity } from "@/project/world";

const EXCLUDED_WORLD_TOOLS = ["query_world", "upsert_world_entities", "link_world_ref", "set_world_relations"] as const;

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
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
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
  const ctx: ToolContext = { project: createEmptyToolProject("세계관 배제 테스트") };
  const created = runTool(ctx, "create_map", { id: "map_w3", name: "테스트 마을", width: 12, height: 10 });
  expect(created.ok, created.summary).toBe(true);
  return ctx;
}

describe("세계관 AI 툴 배제", () => {
  it("세계관 쓰기·조회 툴이 레지스트리에 없다", () => {
    const names = new Set(allTools().map((tool) => tool.name));

    for (const name of EXCLUDED_WORLD_TOOLS) {
      expect(names.has(name), `${name}이 다시 노출됐다`).toBe(false);
    }
  });

  it("맵 연결 그래프 툴(plan_world/build_world)은 그대로 남는다", () => {
    const names = new Set(allTools().map((tool) => tool.name));

    // project.worldGraph 는 세계관과 별개 시스템이다 — 이름만 겹친다.
    expect(names.has("plan_world")).toBe(true);
    expect(names.has("build_world")).toBe(true);
  });

  it("세계관 툴 호출은 알 수 없는 툴로 실패한다", () => {
    const ctx = ctxWithMap();

    const result = runTool(ctx, "upsert_world_entities", {
      entities: [{ type: "character", name: "아린", summary: "마을 수호자" }],
    });

    expect(result.ok).toBe(false);
    expect(ctx.project.world).toBeUndefined();
  });
});

describe("세계관 AI 컨텍스트·경고 배제", () => {
  it("contextBuilder는 세계관 다이제스트를 주입하지 않는다", () => {
    const project = createBlankProject();
    project.world = world([entity({ name: "아린", summary: "잿불을 지킨다" })]);

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).not.toContain("## 세계관 다이제스트");
    expect(prompt).not.toContain("[character] 아린: 잿불을 지킨다");
  });

  it("세계관이 있어도 villageInfoDocuments는 기존 발췌 경로를 그대로 쓴다", () => {
    const project = createBlankProject();
    project.world = world([entity({ type: "place", name: "빈 맵", summary: "시작 지점" })]);
    project.villageInfoDocuments = [{
      id: "doc_start",
      mapId: project.startMapId,
      title: "빈 맵 문서",
      markdown: "발췌돼야 하는 본문",
    }];

    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });

    expect(prompt).toContain("## 게임 스타일 문서(발췌)");
    expect(prompt).toContain("발췌돼야 하는 본문");
    expect(prompt).not.toContain("원문 보존");
  });

  it("proposalCompleteness는 NPC·맵·아이템 생성에 세계관 미기재 warning을 내지 않는다", () => {
    const warnings = proposalCompletenessWarnings({
      calls: [
        call("place_npc", { mapId: "m1", name: "세라" }, { eventsAdded: 1 }),
        call("create_map", { name: "항구" }, { mapsAdded: 1 }),
        call("upsert_item", { item: { id: "it_key", name: "등대 열쇠" } }, { dbRecordsChanged: 1 }),
      ],
    });

    expect(warnings.filter((warning) => warning.includes("세계관"))).toEqual([]);
  });

  it("run_lint는 세계관 lint 를 합류시키지 않는다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([
      entity({ type: "place", refs: [{ kind: "item", id: "missing_item" }] }),
      entity({ id: "w_rule", type: "guideline", name: "문체", summary: "담백하게", body: " " }),
    ]);

    const lint = runTool(ctx, "run_lint", {});
    const data = lint.data as { issues: Array<{ code: string }> };

    expect(lint.ok, lint.summary).toBe(true);
    expect(data.issues.filter((issue) => issue.code.startsWith("world-"))).toEqual([]);
  });

  it("evaluate_game_quality의 integrity에 world 항목이 없다", () => {
    const ctx = ctxWithMap();
    ctx.project.world = world([entity({ type: "place", refs: [{ kind: "item", id: "missing_item" }] })]);

    const result = runTool(ctx, "evaluate_game_quality", {});
    const data = result.data as { integrity: Record<string, unknown> };

    expect(result.ok, result.summary).toBe(true);
    expect(Object.keys(data.integrity)).not.toContain("world");
  });
});

// 데이터 계층은 배제 대상이 아니다 — 저장·마이그레이션은 계속 살아 있어야 한다.
describe("villageInfoDocuments to world migration", () => {
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
