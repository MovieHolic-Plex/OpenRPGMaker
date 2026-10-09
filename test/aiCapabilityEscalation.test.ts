import { describe, expect, it } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { toOpenAiTools, activeTools, allTools } from "@/editor/tools";
import {
  ESCALATION_DENYLIST,
  MAX_CAPABILITY_ESCALATED_TOOLS,
  capabilityEscalationSchemas,
} from "@/ai/capabilityEscalation";
import { mentionedToolSchemas } from "@/ai/planToolExposure";

const TITLE_REQUEST = "타이틀 화면 바꿔줘";

// 선언 없는(폴백) 턴의 도메인 슬라이스 — 코어 + UI 도메인만. 승격은 이 슬라이스 밖의 능력을 되살린다.
function domainExposedNames(_text: string): Set<string> {
  const domains = computeActiveToolDomains(null);
  return new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
}

function names(schemas: readonly { readonly function: { readonly name: string } }[]): string[] {
  return schemas.map((schema) => schema.function.name);
}

describe("자연어 능력 승격 리졸버", () => {
  it("finds tools outside an explicitly scoped caller catalog", () => {
    const exposed = domainExposedNames(TITLE_REQUEST);
    // 케이스 전제: 도메인 슬라이스에도, 정확한 이름 언급 승격에도 없다.
    expect(exposed.has("set_title_screen")).toBe(false);
    expect(names(mentionedToolSchemas(TITLE_REQUEST))).not.toContain("set_title_screen");

    expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toContain("set_title_screen");
  });

  it("빈 문자열·공백·구두점만 있는 입력은 예외 없이 []", () => {
    for (const text of ["", "   ", "\n\t ", "!!!", " ... ?! ", "---"]) {
      expect(capabilityEscalationSchemas(text, new Set()), JSON.stringify(text)).toEqual([]);
    }
  });

  it("이미 노출된 툴은 다시 반환하지 않는다", () => {
    const exposed = domainExposedNames(TITLE_REQUEST);
    const first = names(capabilityEscalationSchemas(TITLE_REQUEST, exposed));
    expect(first.length).toBeGreaterThan(0);
    const withAll = names(capabilityEscalationSchemas(TITLE_REQUEST, new Set([...exposed, ...first])));
    for (const name of first) expect(withAll).not.toContain(name);
  });

  it("deprecated(supersededBy) 툴은 절대 반환하지 않는다", () => {
    const deprecated = allTools().filter((tool) => tool.deprecated === true && tool.supersededBy);
    expect(deprecated.length).toBeGreaterThan(0);
    const active = new Set(activeTools().map((tool) => tool.name));
    for (const tool of deprecated) {
      const returned = names(capabilityEscalationSchemas(`${tool.name} ${tool.description}`, new Set()));
      expect(returned, tool.name).not.toContain(tool.name);
      for (const name of returned) expect(active.has(name), name).toBe(true);
    }
  });

  it("bounds optional search suggestions without truncating the native catalog", () => {
    for (const text of [TITLE_REQUEST, "속성 상성표 설정하고 세이브 시작 지점도 바꾸고 장비랑 직업도 추가해줘"]) {
      expect(capabilityEscalationSchemas(text, new Set()).length).toBeLessThanOrEqual(MAX_CAPABILITY_ESCALATED_TOOLS);
    }
    const all = toOpenAiTools(activeTools());
    expect(all.length).toBeGreaterThan(128);
    expect(names(all)).toEqual(activeTools().map((tool) => tool.name));
    expect(capabilityEscalationSchemas(TITLE_REQUEST, new Set(names(all)))).toEqual([]);
  });

  // 되돌릴 수 없는 폐기 툴은 어휘가 아무리 맞아도 자동으로 얹히지 않는다.
  it("폐기 툴은 이름·설명을 그대로 던져도 승격되지 않는다", () => {
    const byName = new Map(allTools().map((tool) => [tool.name, tool] as const));
    for (const name of ESCALATION_DENYLIST) {
      const tool = byName.get(name);
      expect(tool, name).toBeDefined();
      const returned = names(capabilityEscalationSchemas(`${name} ${tool!.description}`, new Set()));
      expect(returned, name).not.toContain(name);
    }
  });

  it("부분 재작업 요청이 프로젝트 폐기 툴을 끌어오지 않는다", () => {
    for (const text of ["이 맵 상점 재고를 초기화해줘", "이 맵 처음부터 다시 칠해줘", "여기 지워버리고 다시 깔아줘"]) {
      const returned = names(capabilityEscalationSchemas(text, new Set()));
      expect(returned, text).not.toContain("reset_project");
      expect(returned, text).not.toContain("remove_map");
    }
  });

  it("같은 입력은 같은 순서를 낸다", () => {
    const exposed = domainExposedNames(TITLE_REQUEST);
    expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toEqual(
      names(capabilityEscalationSchemas(TITLE_REQUEST, exposed)),
    );
  });
});
