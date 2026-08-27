import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { buildToolCapabilityIndex } from "@/ai/toolCapabilityIndex";
import { activeTools, allTools, createEmptyToolProject } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// 색인은 프롬프트 앞머리에 붙으므로 기본 예산(12000)에서도 살아남지만,
// 기존 후순위 섹션(현재 맵 요약 등)까지 함께 보려면 예산을 넉넉히 준다.
const WIDE_BUDGET = 40_000;

function liveToolNames(): readonly string[] {
  return activeTools().filter((tool) => tool.supersededBy === undefined).map((tool) => tool.name);
}

describe("tool capability index", () => {
  it("advertises every live registry tool inside the system prompt", () => {
    const project = createEmptyToolProject();
    const prompt = buildSystemPrompt(project);
    const names = liveToolNames();

    const missing = names.filter((name) => !prompt.includes(name));

    expect(missing).toEqual([]);
    expect(names.length).toBeGreaterThan(100);
  });

  it("states the never-say-missing rule and the find_tools escalation route", () => {
    const index = buildToolCapabilityIndex();

    expect(index).toContain("find_tools");
    expect(index).toContain("그 기능이 없습니다");
    expect(index).toContain("지원하지 않습니다");
    // 엔진 진짜 한계는 색인이 뒤집지 않는다.
    expect(index).toContain("3D");
  });

  it("never advertises a deprecated (superseded) tool", () => {
    const index = buildToolCapabilityIndex();
    const deprecated = allTools().filter((tool) => tool.supersededBy !== undefined).map((tool) => tool.name);
    expect(deprecated.length).toBeGreaterThan(0);

    const listedSection = index.split("### 색인 사용 규칙")[0] ?? "";
    const advertised = deprecated.filter((name) => new RegExp(`(^|[\\s,])${name}([\\s,]|$)`, "m").test(listedSection));

    expect(advertised).toEqual([]);
  });

  it("keeps the pre-existing prompt sections alongside the index", () => {
    const project = createBlankProject();
    const prompt = buildSystemPrompt(project, { currentMapId: project.startMapId, budgetChars: WIDE_BUDGET });

    expect(prompt).toContain("## 툴 능력 색인");
    expect(prompt).toContain("## 프로젝트 요약");
    expect(prompt).toContain("## 현재 맵 요약");
    expect(prompt).toContain("## 밸런스 상수(검증됨)");
    // 색인은 INTRO 직후에 와야 예산 슬라이서가 잘라내지 못한다.
    expect(prompt.indexOf("## 툴 능력 색인")).toBeLessThan(prompt.indexOf("## 프로젝트 요약"));
  });

  it("builds a deterministic string", () => {
    expect(buildToolCapabilityIndex()).toBe(buildToolCapabilityIndex());
    expect(buildToolCapabilityIndex(activeTools())).toBe(buildToolCapabilityIndex(activeTools()));
  });

  it("covers every live tool exactly once in the index body", () => {
    const index = buildToolCapabilityIndex();
    const body = index.split("### 색인 사용 규칙")[0] ?? "";
    const listed = body
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .flatMap((line) => (line.split(": ")[1] ?? "").split(", "))
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    expect([...listed].sort()).toEqual([...liveToolNames()].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});
