// 장르 칩셋 잠금(2026-10-15) — 옵트인 판정·실행기 거부·무음 대체 금지·사용자 경로 불간섭·직렬화 왕복.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { disableGenreLock, enableGenreLock, genreLockReport, genreLockViolations } from "@/project/genreLock";
import { deserialize, serialize } from "@/project/io";

beforeEach(() => resetMapEditHistory());

function lockedProject() {
  const project = createBlankProject();
  applyGenrePreset(project, "monster-collect");
  return project;
}

const create = (ctx: ToolContext, name: string, tilesetId?: string, extra: Record<string, unknown> = {}) =>
  runTool(ctx, "create_map", { name, width: 24, height: 18, ...(tilesetId ? { tilesetId } : {}), ...extra }, { dryRun: false });

describe("장르 칩셋 잠금", () => {
  it("옵트인이다 — 몬스터 프리셋이 없으면 필드도 직렬화 바이트도 없다", () => {
    const project = createBlankProject();
    expect(project.system.genreLock).toBeUndefined();
    expect(serialize(project)).not.toContain("genreLock");
    const ctx: ToolContext = { project, assistantRun: true };
    expect(create(ctx, "사막", "desert_east").ok).toBe(true);
  });

  it("몬스터 프리셋이 잠금을 켜고 직렬화·역직렬화를 거쳐 보존된다", () => {
    const project = lockedProject();
    expect(project.system.genreLock).toMatchObject({ preset: "monster-collect", mode: "enforce" });
    expect(project.system.genreLock!.allowedFamilies).toContain("oprn-monster");
    const reloaded = deserialize(serialize(project));
    expect(reloaded.system.genreLock).toEqual(project.system.genreLock);
  });

  it("조수의 허용 밖 칩셋은 거부되고 허용 칩셋·대안 이름이 메시지에 있으며 맵은 생기지 않는다", () => {
    const ctx: ToolContext = { project: lockedProject(), currentMapId: "map_blank_start", assistantRun: true };
    const desert = create(ctx, "사막 마을", "desert_east");
    expect(desert.ok).toBe(false);
    expect(desert.issues?.[0]?.code).toBe("genre-lock");
    expect(desert.issues?.[0]?.message).toContain("monster_climate");
    const campus = create(ctx, "벚꽃 캠퍼스", "modern_campus");
    expect(campus.ok).toBe(false);
    expect(campus.issues?.[0]?.message).toContain("monster_overworld");
    expect(Object.values(ctx.project.maps).map((map) => map.name)).not.toContain("사막 마을");
  });

  it("themeScene 우회와 비허용 전용 도구도 거부된다", () => {
    const ctx: ToolContext = { project: lockedProject(), currentMapId: "map_blank_start", assistantRun: true };
    const themed = create(ctx, "캠퍼스", undefined, { width: 60, height: 44, themeScene: "campus:school" });
    expect(themed.ok).toBe(false);
    const hidden = runTool(ctx, "author_beodeul_town", { mapId: "map_blank_start", theme: "river" });
    expect(hidden.ok).toBe(false);
    expect(hidden.issues?.[0]?.code).toBe("genre-lock");
  });

  it("tilesetId 를 생략하면 허용 칩셋으로 대체하고 그 사실을 경고로 남긴다(무음 아님)", () => {
    const project = lockedProject();
    project.maps.map_blank_start!.tilesetId = "beodeul_city";   // 보는 맵이 잠금 밖 계열이어도 기본값은 허용 칩셋이다
    const ctx: ToolContext = { project, currentMapId: "map_blank_start", assistantRun: true };
    const result = create(ctx, "별싹 마을");
    expect(result.ok).toBe(true);
    const made = Object.values(ctx.project.maps).find((map) => map.name === "별싹 마을")!;
    expect(made.tilesetId).toBe("monster_overworld");
    expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("장르 잠금");
  });

  it("사용자 손 편집 경로(assistantRun 아님)는 막지 않고, 검사 도구는 잠금 이후 위반으로 보고한다", () => {
    const ctx: ToolContext = { project: lockedProject() };
    expect(create(ctx, "사용자 사막", "desert_east").ok).toBe(true);
    const report = genreLockReport(ctx.project);
    expect(report.violations.map((violation) => violation.mapName)).toEqual(["사용자 사막"]);
    expect(report.preexisting).toEqual([]);
  });

  it("사용자가 카드로 승인한 계열은 그 계열 한정으로 통과한다", () => {
    const ctx: ToolContext = { project: lockedProject(), currentMapId: "map_blank_start", assistantRun: true, approvedTilesetFamilies: ["oprn-campus"] };
    expect(create(ctx, "승인된 캠퍼스", "modern_campus").ok).toBe(true);
    expect(create(ctx, "승인 안 된 사막", "desert_east").ok).toBe(false);
  });

  it("켜기 전부터 있던 허용 밖 맵은 따로 보고하고 막지 않는다", () => {
    const project = createBlankProject();   // 버들항 빈 시작 맵
    expect(enableGenreLock(project, "monster-collect")).toBe(true);
    const violations = genreLockViolations(project);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.preexisting).toBe(true);
    expect(genreLockReport(project).violations).toEqual([]);
    const ctx: ToolContext = { project, currentMapId: "map_blank_start", assistantRun: true };
    expect(runTool(ctx, "set_map_properties", { mapId: "map_blank_start", name: "이름만 바꿈" }, { dryRun: false }).ok).toBe(true);
  });

  it("configure_monster_system(enabled:false) 는 잠금을 풀면서 「장르 잠금 해제됨」 경고를 남긴다", () => {
    const ctx: ToolContext = { project: lockedProject(), assistantRun: true };
    const result = runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(ctx.project.system.genreLock).toBeUndefined();
    expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("장르 잠금 해제됨");
  });

  it("configure_monster_system(enabled:true) 는 잠금을 켠다", () => {
    const project = createBlankProject();
    // 역방향 잠금(#2812): 몬스터 게임이 아닌 프로젝트에서는 몬스터 수집 요청 턴(monsterTurn)에만 몬스터 도구가 풀린다.
    const ctx: ToolContext = { project, assistantRun: true, monsterTurn: true };
    expect(runTool(ctx, "configure_monster_system", { enabled: true }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.system.genreLock?.preset).toBe("monster-collect");
  });

  it("disableGenreLock 은 잠금이 없으면 false", () => {
    expect(disableGenreLock(createBlankProject())).toBe(false);
  });

  it("find_tools 는 잠금 중 비허용 계열 전용 도구를 결과에서 뺀다", () => {
    const ctx: ToolContext = { project: lockedProject(), assistantRun: true };
    const result = runTool(ctx, "find_tools", { query: "author_beodeul_town" });
    const names = ((result.data as { matches: { name: string }[] }).matches ?? []).map((match) => match.name);
    expect(names).not.toContain("author_beodeul_town");
    expect(result.summary).toContain("장르 잠금");
  });
});
