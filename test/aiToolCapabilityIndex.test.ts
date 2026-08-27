import { describe, expect, it } from "vitest";
import { buildSystemPrompt, DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";
import { buildToolCapabilityIndex } from "@/ai/toolCapabilityIndex";
import { activeTools, allTools, createEmptyToolProject } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// 색인은 프롬프트 앞머리에 붙으므로 기본 예산(12000)에서도 살아남지만,
// 기존 후순위 섹션(현재 맵 요약 등)까지 함께 보려면 예산을 넉넉히 준다.
const WIDE_BUDGET = 40_000;
// tokenBudget.calibratedBudgetChars 하한(CALIBRATION_CLAMP_MIN_RATIO 0.5 × 12000).
const CALIBRATED_MIN_BUDGET = 6000;
// 색인 문자 상한: 툴 추가/이름 변경으로 프롬프트가 조용히 부푸는 것을 막는 카나리아.
// 실측: 파사드 37개를 들이기 전 3,170자 → 들인 후 3,843자(활성 툴 185개). 상한은 그 위로 여유를 둔다.
// 이 상한이 프롬프트 예산을 잡아먹지는 않는다 — buildSystemPrompt 가 색인 길이만큼 예산을 늘려
// 기존 섹션 자리를 지키기 때문이다(아래 "does not push ... over its budget" 케이스가 그것을 고정한다).
// 상한을 올릴 때는 이 주석의 실측 자수를 함께 갱신한다 — 조용한 상향은 금지다.
const INDEX_CHAR_CEILING = 4600;

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

  it("survives the smallest calibrated budget", () => {
    const prompt = buildSystemPrompt(createBlankProject(), { budgetChars: CALIBRATED_MIN_BUDGET });
    const missing = liveToolNames().filter((name) => !prompt.includes(name));

    expect(missing).toEqual([]);
    expect(prompt).toContain("find_tools(query)");
    expect(prompt).toContain("그 기능이 없습니다");
  });

  it("does not push the pre-existing prompt over its budget", () => {
    const prompt = buildSystemPrompt(createEmptyToolProject("x"), {});

    // 베이스 실측: 이 fixture 는 색인 이전에 11,978자로 예산(12,000) 이하였다. 색인이 그 자리를 먹지 않았음을 고정한다.
    expect(prompt).not.toContain("[예산 초과");
    const withoutIndex = prompt.replace(`${buildToolCapabilityIndex()}\n\n`, "");
    expect(withoutIndex).not.toContain("## 툴 능력 색인");
    expect(withoutIndex.length).toBeLessThanOrEqual(DEFAULT_BUDGET_CHARS);
    expect(withoutIndex).toContain("## 프로젝트 요약");
  });

  it("stays under the stated char ceiling", () => {
    expect(buildToolCapabilityIndex().length).toBeLessThanOrEqual(INDEX_CHAR_CEILING);
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
