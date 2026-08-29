// 자연어 능력 요청 승격 (2026-08-27 실측).
// 실측 케이스(스크립트로 레지스트리 실데이터에서 고름): "타이틀 화면 바꿔줘"
//   computeActiveToolDomains → core|map|system, toOpenAiTools(undefined,{domains}) 40개 노출.
//   그 40개에 set_title_screen 이 없다(도메인 슬라이스에서 탈락). 사용자가 정확한 레지스트리
//   이름을 타이핑하지 않았으므로 mentionedToolSchemas 도 승격하지 않는다 → 모델은 "그 기능이
//   없습니다"로 답한다. 이 리졸버가 같은 라운드에서 set_title_screen 스키마를 얹어야 한다.
import { describe, expect, it } from "vitest";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { toOpenAiTools, activeTools, allTools } from "@/editor/tools";
import {
  ESCALATION_DENYLIST,
  MAX_CAPABILITY_ESCALATED_TOOLS,
  MAX_TURN_TOOL_SCHEMAS,
  capabilityEscalationSchemas,
  clampTurnToolSchemas,
} from "@/ai/capabilityEscalation";
import { mentionedToolSchemas } from "@/ai/planToolExposure";

const TITLE_REQUEST = "타이틀 화면 바꿔줘";

function domainExposedNames(text: string): Set<string> {
  const domains = computeActiveToolDomains(text);
  return new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
}

function names(schemas: readonly { readonly function: { readonly name: string } }[]): string[] {
  return schemas.map((schema) => schema.function.name);
}

describe("자연어 능력 승격 리졸버", () => {
  it("도메인 40 슬라이스에서 빠진 능력 툴을 같은 라운드에 되살린다", () => {
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

  it("승격은 최대 6개이고, 조립된 목록은 128 이하로 클램프된다", () => {
    for (const text of [TITLE_REQUEST, "속성 상성표 설정하고 세이브 시작 지점도 바꾸고 장비랑 직업도 추가해줘"]) {
      expect(capabilityEscalationSchemas(text, new Set()).length).toBeLessThanOrEqual(MAX_CAPABILITY_ESCALATED_TOOLS);
    }

    const all = toOpenAiTools(activeTools(), {});
    expect(all.length).toBeGreaterThan(MAX_TURN_TOOL_SCHEMAS);
    const escalated = new Set(all.slice(0, 6).map((tool) => tool.function.name));
    const clamped = clampTurnToolSchemas(all, escalated);
    expect(clamped.length).toBe(MAX_TURN_TOOL_SCHEMAS);
    // 승격 후보가 먼저 떨어진다 — 확정 툴은 승격 추측 때문에 밀리지 않는다.
    for (const name of escalated) expect(names(clamped)).not.toContain(name);
    expect(clampTurnToolSchemas(all.slice(0, 10), escalated)).toEqual(all.slice(0, 10));
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
