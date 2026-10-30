// 조수 v2 [지금 프로젝트] 맵 목록 — 맵 id 와 칩셋 id 가 헷갈리지 않게 이름표를 붙인다.
// 2026-10-30 실조수 e2e: 「map_blank_start 「버들 마을」 beodeul_city 20×15」에서 7번 중 5번 set_game_audio mapIds 에 beodeul_city 를 넣었다.
import { describe, expect, it } from "vitest";
import { projectBrief } from "@/ai/v2/prompt";
import { MUSIC_TIER } from "@/ai/v2/game";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";

describe("v2 project brief map list", () => {
  it("labels the map id and puts the tileset id in a labelled field, marking start and current maps", () => {
    const ctx = { project: createEmptyToolProject() };
    expect(runTool(ctx, "create_map", { id: "m_town", name: "버들 마을", width: 20, height: 15 }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "m_gallery", name: "미술관", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
    const project = ctx.project;
    const start = project.maps[project.startMapId]!;
    const brief = projectBrief(project, "m_gallery");
    const lines = brief.split("\n");
    const startLine = lines.find((line) => line.includes(`mapId=${start.id} `))!;
    expect(startLine).toBeDefined();
    expect(startLine).toContain(`(칩셋 ${start.tilesetId}, ${start.width}×${start.height}`);
    expect(startLine).toMatch(/← 시작 맵$/u);
    // 칩셋 id 가 이름표 없이 맵 이름 바로 뒤에 오지 않는다.
    expect(startLine).not.toContain(`」 ${start.tilesetId}`);
    const current = lines.find((line) => line.includes("mapId=m_gallery "))!;
    expect(current).toContain("「미술관」");
    expect(current).toMatch(/← 지금 보는 맵$/u);
    expect(lines[0]).toContain("mapId= 뒤의 값");
  });

  it("the music card says what mapIds holds without naming tileset ids", () => {
    expect(MUSIC_TIER.card).toContain("mapIds 에는 [지금 프로젝트] 맵 목록의 mapId= 값을 쓴다");
    expect(MUSIC_TIER.card).not.toMatch(/타일셋 id/u);
  });
});
