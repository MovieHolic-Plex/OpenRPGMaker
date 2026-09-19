import { describe, expect, it } from "vitest";
import { buildSystemPrompt, DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";
import { buildToolCapabilityIndex } from "@/ai/toolCapabilityIndex";
import { EVENT_PAGE_SEMANTICS_BLOCK } from "@/ai/eventPageSemantics";
import { activeTools, allTools, createEmptyToolProject } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// 색인은 프롬프트 앞머리에 붙으므로 기본 예산(12000)에서도 살아남지만,
// 기존 후순위 섹션(현재 맵 요약 등)까지 함께 보려면 예산을 넉넉히 준다.
const WIDE_BUDGET = 40_000;
// tokenBudget.calibratedBudgetChars 하한(CALIBRATION_CLAMP_MIN_RATIO 0.5 × 12000).
const CALIBRATED_MIN_BUDGET = 6000;
// 색인 문자 상한: 툴 추가/이름 변경으로 프롬프트가 조용히 부푸는 것을 막는 카나리아.
// 실측: 파사드 37개를 들이기 전 3,170자 → 들인 후 3,843자(활성 툴 185개)
// → canonical spatial 여섯 도구 시대 4,701자(활성 툴 220개). 상한은 그 위로 여유를 둔다.
// → 오프닝 시네마틱 네 툴(get/set/remove_opening·list_opening_media)을 들인 뒤 4,811자(활성 툴 226개).
// → 게임오버·오디오 탐색 파사드를 등록한 뒤 5,043자(활성 툴 238개).
// → 범용 이미지 에셋 생성(generate_image_asset)을 등록한 뒤 5,065자(활성 툴 239개).
// 이 상한이 프롬프트 예산을 잡아먹지는 않는다 — buildSystemPrompt 가 색인 길이만큼 예산을 늘려
// 기존 섹션 자리를 지키기 때문이다(아래 "does not push ... over its budget" 케이스가 그것을 고정한다).
// 상한을 올릴 때는 이 주석의 실측 자수를 함께 갱신한다 — 조용한 상향은 금지다.
const INDEX_CHAR_CEILING = 5100;

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

  it("indexes only the supplied active capabilities", () => {
    const readTools = activeTools().filter((tool) => tool.mode === "read");
    const body = buildToolCapabilityIndex(readTools).split("### 색인 사용 규칙")[0] ?? "";
    const listed = body.split("\n").filter((line) => line.startsWith("- "))
      .flatMap((line) => (line.split(": ")[1] ?? "").split(", "));
    expect(listed.sort()).toEqual(readTools.map((tool) => tool.name).sort());
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
  });

  it("does not push the pre-existing prompt over its budget", () => {
    const prompt = buildSystemPrompt(createEmptyToolProject("x"), {});

    // 베이스 실측: 이 fixture 는 색인 이전에 11,978자로 예산(12,000) 이하였다. 예산 밖 고정 블록이
    // 그 자리를 먹지 않았음을 고정한다. 고정 블록은 둘이다 — 툴 능력 색인 + 이벤트 페이지 의미론.
    expect(prompt).not.toContain("[예산 초과");
    const withoutFixed = prompt
      .replace(`${buildToolCapabilityIndex()}\n\n`, "")
      .replace(`${EVENT_PAGE_SEMANTICS_BLOCK}\n\n`, "");
    expect(withoutFixed).not.toContain("## 툴 능력 색인");
    expect(withoutFixed).not.toContain("## 이벤트 페이지 의미론");
    expect(withoutFixed.length).toBeLessThanOrEqual(DEFAULT_BUDGET_CHARS);
    expect(withoutFixed).toContain("## 프로젝트 요약");
  });

  it("keeps the event page semantics block whole at the smallest calibrated budget", () => {
    const prompt = buildSystemPrompt(createBlankProject(), { budgetChars: CALIBRATED_MIN_BUDGET });
    expect(prompt).toContain(EVENT_PAGE_SEMANTICS_BLOCK);
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
