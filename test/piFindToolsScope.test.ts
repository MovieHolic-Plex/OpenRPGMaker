// find_tools 는 레지스트리 전체를 찾는다 — 실행 경계 밖 이름은 결과에서 빼고 「범위 밖」으로만 알린다
// (2026-10-05 스트레스 g-ember-mine: 팀 빌더가 찾은 set_map_properties 를 부르다 「Tool … not found」 연속).
import { describe, expect, it } from "vitest";
import { scopeFindToolsResult } from "@/ai/piAgent/toolAdapter";
import type { ToolResult } from "@/editor/tools/types";

const found = (names: string[], suffix = ""): ToolResult => ({
  ok: true,
  summary: `편집기 툴 ${names.length}개 발견: ${names.join(", ")}${suffix}`,
  data: { matches: names.map(name => ({ name, mode: "write", description: name })) },
});

describe("scopeFindToolsResult", () => {
  it("경계 밖 후보를 matches 에서 빼고 요약에 범위 밖으로 남긴다", () => {
    const allowed = new Set(["paint_tiles", "place_event"]);
    const result = scopeFindToolsResult(found(["paint_tiles", "set_map_properties", "place_event"]), name => allowed.has(name));
    expect((result.data as { matches: { name: string }[] }).matches.map(match => match.name)).toEqual(["paint_tiles", "place_event"]);
    expect(result.summary).toContain("편집기 툴 2개 발견: paint_tiles, place_event");
    expect(result.summary).toContain("범위 밖");
    expect(result.summary).toContain("set_map_properties");
  });

  it("모두 경계 밖이면 부를 수 있는 것이 없다고 말한다", () => {
    const result = scopeFindToolsResult(found(["set_project_settings"]), () => false);
    expect((result.data as { matches: unknown[] }).matches).toEqual([]);
    expect(result.summary).toMatch(/^이 실행에서 호출할 수 있는 툴 중 맞는 것이 없습니다/);
    expect(result.summary).toContain("set_project_settings");
  });

  it("없는 툴 이름 안내는 유지한다", () => {
    const result = scopeFindToolsResult(found(["paint_tiles", "set_map_properties"], ". 없는 툴 이름: get_project_settings"), name => name === "paint_tiles");
    expect(result.summary).toContain("없는 툴 이름: get_project_settings");
  });

  it("전부 경계 안이거나 실패 결과면 그대로 돌려준다", () => {
    const ok = found(["paint_tiles"]);
    expect(scopeFindToolsResult(ok, () => true)).toBe(ok);
    const failed: ToolResult = { ok: false, summary: "x" };
    expect(scopeFindToolsResult(failed, () => false)).toBe(failed);
  });
});
