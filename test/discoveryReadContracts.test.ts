// 2026-09-24 헤드리스 「등대지기의 겨울」: find_tools("define_ending") 이 define_ending 과 함께 설명에 그 이름이
// 나오는 툴 5개를 스키마째 돌려줘 한 번에 약 45k자였다. 정확한 이름 검색은 그 툴만 돌려준다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function names(query: string): { names: string[]; summary: string } {
  const result = runTool({ project: createBlankProject() }, "find_tools", { query });
  expect(result.ok, result.summary).toBe(true);
  return { names: (result.data as { matches: { name: string }[] }).matches.map(match => match.name), summary: result.summary };
}

describe("find_tools exact names", () => {
  it("returns only the named tool for an exact tool name", () => {
    expect(names("define_ending").names).toEqual(["define_ending"]);
  });

  it("returns every named tool and reports names that do not exist", () => {
    const found = names("configure_time_system configure_weather_system");
    expect(found.names).toEqual(["configure_time_system"]);
    expect(found.summary).toContain("configure_weather_system");
  });

  it("keyword queries still rank across tools", () => {
    expect(names("ending").names.length).toBeGreaterThan(1);
  });
});

describe("list_resources empty query", () => {
  it("browses the catalog like '*' instead of returning nothing", () => {
    for (const kind of ["charset", "monster"]) {
      const project = createBlankProject();
      const empty = runTool({ project }, "list_resources", { kind, query: "", limit: 5 });
      const star = runTool({ project }, "list_resources", { kind, query: "*", limit: 5 });
      expect(empty.ok, empty.summary).toBe(true);
      expect((empty.data as { matches: unknown[] }).matches.length, kind).toBeGreaterThan(0);
      expect(empty.data).toEqual(star.data);
    }
  });
});
