// 지형 템플릿 지식뱅크 계약(2026-07-05): list/get(라벨 조인)/stamp(결정 실행)/validate(문법 기계 검증)
// + extract(초안 추출)/upsert(확정 저장) — 설계 문서 docs/superpowers/specs/2026-07-05-*.md.
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

const TEMPLATE_ID = "small_house_01_table";

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

function ctxWithMap(width = 30, height = 30): { context: ToolContext; mapId: string } {
  const context = ctx();
  const created = runTool(context, "create_map", { name: "템플릿 테스트", width, height, id: "map_tpl" });
  expect(created.ok, created.summary).toBe(true);
  return { context, mapId: "map_tpl" };
}

describe("list/get_terrain_template", () => {
  it("번들 템플릿이 목록에 나오고 스탬프 가능 표시가 붙는다", () => {
    const result = runTool(ctx(), "list_terrain_templates", {});
    expect(result.ok, result.summary).toBe(true);
    const templates = (result.data as { templates: Array<{ id: string; hasBuildPlan: boolean }> }).templates;
    const bundled = templates.find((entry) => entry.id === TEMPLATE_ID);
    expect(bundled).toBeDefined();
    expect(bundled?.hasBuildPlan).toBe(true);
  });

  it("전체 지식과 타일 라벨 사전을 돌려준다(단어장 조인)", () => {
    const result = runTool(ctx(), "get_terrain_template", { templateId: TEMPLATE_ID });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { template: { rules: string[]; grammar: unknown[] }; tileLabels: Record<number, string> };
    expect(data.template.rules.length).toBeGreaterThan(0);
    expect((data.template.grammar ?? []).length).toBeGreaterThan(0);
    expect(Object.keys(data.tileLabels).length).toBeGreaterThan(0);
    // 모르는 템플릿은 보유 목록을 안내하며 실패.
    const missing = runTool(ctx(), "get_terrain_template", { templateId: "ghost" });
    expect(missing.ok).toBe(false);
    expect(missing.summary).toContain(TEMPLATE_ID);
  });
});

describe("stamp_terrain_template", () => {
  it("buildPlan을 실행해 집을 찍고 문 좌표를 돌려준다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "stamp_terrain_template", { mapId, templateId: TEMPLATE_ID, origin: { x: 1, y: 1 }, material: "stone" });
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.tilesChanged ?? 0).toBeGreaterThan(0);
    const door = (result.data as { door: { x: number; y: number } }).door;
    expect(door).toEqual({ x: 14, y: 11 }); // buildPlan door(13,10) + origin(1,1)
  });

  it("buildPlan 없는 템플릿은 grammar 조립 경로를 안내하며 거부한다", () => {
    const { context, mapId } = ctxWithMap();
    const saved = runTool(context, "upsert_terrain_template", { name: "문법 전용", grammar: [{ kind: "wall-row", role: "w", layer: "lower", middle: 16, meaning: "m" }] });
    expect(saved.ok, saved.summary).toBe(true);
    const templateId = (saved.data as { templateId: string }).templateId;
    const result = runTool(context, "stamp_terrain_template", { mapId, templateId, origin: { x: 1, y: 1 } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("grammar");
  });

  it("발자국이 맵을 벗어나면 거부한다", () => {
    const { context, mapId } = ctxWithMap(12, 12);
    const result = runTool(context, "stamp_terrain_template", { mapId, templateId: TEMPLATE_ID, origin: { x: 0, y: 0 } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("맵을 벗어");
  });
});

describe("validate_structure", () => {
  it("스탬프로 지은 정상 구조물은 위반 0건이다", () => {
    const { context, mapId } = ctxWithMap();
    expect(runTool(context, "stamp_terrain_template", { mapId, templateId: TEMPLATE_ID, origin: { x: 1, y: 1 } }).ok).toBe(true);
    const result = runTool(context, "validate_structure", { mapId, templateId: TEMPLATE_ID, x: 0, y: 0, w: 30, h: 30 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { ok: boolean; violations: unknown[] };
    expect(data.violations).toEqual([]);
    expect(data.ok).toBe(true);
  });

  it("지붕 아래 벽 상단부를 지우면 위반을 검출한다", () => {
    const { context, mapId } = ctxWithMap();
    expect(runTool(context, "stamp_terrain_template", { mapId, templateId: TEMPLATE_ID, origin: { x: 1, y: 1 } }).ok).toBe(true);
    // wall-top 행(y=9 = origin1 + wall.origin.y 8)을 잔디로 덮는다 → 지붕 아래 벽 없음 + wall-middle 위 규칙 위반.
    expect(runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "rect", tile: 240, from: { x: 8, y: 9 }, to: { x: 18, y: 9 } }).ok).toBe(true);
    const result = runTool(context, "validate_structure", { mapId, templateId: TEMPLATE_ID, x: 0, y: 0, w: 30, h: 30 });
    const data = result.data as { ok: boolean; violations: Array<{ role: string }> };
    expect(data.ok).toBe(false);
    expect(data.violations.length).toBeGreaterThan(0);
  });
});

describe("extract_terrain_template", () => {
  it("행 패턴(좌/중/우)과 mustTouch 체인, 행별 추측 요약을 초안으로 뽑는다", () => {
    const { context, mapId } = ctxWithMap(20, 20);
    const map = context.project.maps[mapId];
    // 합성 구조물: 상위 지붕 행 1개 + 하위 벽 3행(상/중/하), x=5..9.
    const put = (layer: "lower" | "upper", y: number, tiles: number[]): void => {
      tiles.forEach((tile, index) => {
        const cell = y * map.width + 5 + index;
        if (layer === "lower") map.lowerTiles[cell] = tile;
        else map.upperTiles[cell] = tile;
      });
    };
    put("upper", 4, [375, 375, 375, 375, 377]);
    put("lower", 5, [15, 16, 16, 16, 17]);
    put("lower", 6, [45, 46, 46, 46, 47]);
    put("lower", 7, [75, 76, 76, 76, 77]);
    const result = runTool(context, "extract_terrain_template", { mapId, x: 5, y: 3, w: 5, h: 6, name: "실험 집" });
    expect(result.ok, result.summary).toBe(true);
    const draft = (result.data as { draft: { grammar: Array<{ kind: string; role: string; left?: number; middle?: number; right?: number; mustTouch?: string }>; guessSummary: string[]; rows: unknown[] } }).draft;
    const wallTop = draft.grammar.find((rule) => rule.left === 15 && rule.middle === 16 && rule.right === 17);
    expect(wallTop).toBeDefined();
    const wallMiddle = draft.grammar.find((rule) => rule.left === 45);
    expect(wallMiddle?.mustTouch).toBe(wallTop?.role); // 위 행이 mustTouch 초안.
    const roof = draft.grammar.find((rule) => rule.kind === "roof-row");
    expect(roof?.middle).toBe(375);
    expect(draft.guessSummary.length).toBe(draft.grammar.length);
    expect(draft.guessSummary.join("\n")).toContain("y=");
  });

  it("검토 모달용 rowSpans(y범위+사람 말 요약)가 grammar와 1:1로 나온다", () => {
    const { context, mapId } = ctxWithMap(20, 20);
    const map = context.project.maps[mapId];
    [15, 16, 16, 17].forEach((tile, index) => {
      map.lowerTiles[5 * map.width + 4 + index] = tile;
    });
    const result = runTool(context, "extract_terrain_template", { mapId, x: 4, y: 5, w: 4, h: 1 });
    const draft = (result.data as { draft: { grammar: unknown[]; rowSpans: Array<{ y0: number; y1: number; humanText: string; layer: string }> } }).draft;
    expect(draft.rowSpans.length).toBe(draft.grammar.length);
    const wallSpan = draft.rowSpans.find((span) => span.layer === "lower" && span.y0 === 5);
    expect(wallSpan).toBeDefined();
    expect(wallSpan?.humanText).toContain("행"); // 사람 말 요약(좌표 나열이 아니라 종류+패턴).
  });
});

describe("upsert_terrain_template", () => {
  it("초안 저장은 source=ai, confirmedByUser면 user로 저장된다", () => {
    const context = ctx();
    const draftSave = runTool(context, "upsert_terrain_template", { name: "AI 초안 집", rules: ["r1"] });
    expect(draftSave.ok, draftSave.summary).toBe(true);
    const draftId = (draftSave.data as { templateId: string }).templateId;
    // 쓰기 툴은 성공 시 context.project를 새 draft로 교체하므로 매번 다시 조회한다.
    const findTemplate = (id: string) => context.project.tilesets[DEFAULT_TILESET_ID].terrainTemplates?.find((tpl) => tpl.id === id);
    expect(findTemplate(draftId)?.source).toBe("ai");

    const confirmedSave = runTool(context, "upsert_terrain_template", { name: "확정 집", confirmedByUser: true, tags: ["집"] });
    const confirmedId = (confirmedSave.data as { templateId: string }).templateId;
    expect(findTemplate(confirmedId)?.source).toBe("user");
  });

  it("기존 템플릿 갱신은 사용자 확인 없이는 거부된다(지식 보호)", () => {
    const context = ctx();
    const blocked = runTool(context, "upsert_terrain_template", { id: TEMPLATE_ID, name: "덮어쓰기 시도" });
    expect(blocked.ok).toBe(false);
    expect(blocked.summary).toContain("confirmedByUser");
    const allowed = runTool(context, "upsert_terrain_template", { id: TEMPLATE_ID, name: "small_house_01 표 템플릿 v2", confirmedByUser: true });
    expect(allowed.ok, allowed.summary).toBe(true);
    expect(runTool(context, "upsert_terrain_template", { id: "ghost", name: "x", confirmedByUser: true }).ok).toBe(false);
  });
});

describe("show_tile_grid", () => {
  it("영역을 20×20으로 캡해 하위/상위 2차원 배열로 돌려준다", () => {
    const { context, mapId } = ctxWithMap(30, 30);
    const result = runTool(context, "show_tile_grid", { mapId, x: 0, y: 0, w: 25, h: 5 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { w: number; h: number; lower: number[][]; upper: number[][] };
    expect(data.w).toBe(20);
    expect(data.lower.length).toBe(5);
    expect(data.lower[0].length).toBe(20);
    expect(data.upper.length).toBe(5);
  });
});

describe("시스템 프롬프트 배선", () => {
  it("지형 템플릿 목록 섹션이 실린다", () => {
    const prompt = buildSystemPrompt(createBlankProject());
    expect(prompt).toContain("지형 템플릿");
    expect(prompt).toContain(TEMPLATE_ID);
    expect(prompt).toContain("validate_structure");
  });
});
