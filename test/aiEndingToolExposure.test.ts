// 2026-08-23 실측 회귀: "엔딩 조건도 하나 걸어줘" 요청에서 define_ending 이 도메인 스코핑·노출 상한에
// 밀려 모델에 노출되지 않았고, 모델은 사용자에게 "엔딩을 정의하는 기능이 없습니다"라고 보고했다.
// 있는 기능을 없다고 말하게 만드는 노출 누락은 툴콜 실패보다 나쁘다 — 사용자가 제품 한계로 오해한다.
//
// 2026-09-03: 문장 키워드 스캔은 없다. 어떤 툴이 필요한지는 의도 선언(모델)이 tools 로 말하고,
// 이 가드는 「선언한 툴·도메인이 실제 노출 목록(40 상한·핀·트림)을 통과하는가」만 고정한다.
import { describe, expect, it } from "vitest";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import { declaredIntent } from "./intentFixture";

/**
 * 모델이 **실제로** 받는 도메인 슬라이스(선언 툴 강제 노출은 세션이 따로 얹는다 — assistantSessionIntent.test).
 * 노출 누락은 상한 트림에서만 재현되므로 반드시 `toOpenAiTools` 를 지나야 한다.
 */
function exposedNames(intent: IntentDeclaration): string[] {
  const domains = computeActiveToolDomains(intent);
  return toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
}

describe("선언에 맞는 툴 노출", () => {
  it("엔딩 툴을 선언하면 event 도메인이 열려 define_ending 이 노출된다", () => {
    const intent = declaredIntent({ tools: ["define_ending"] });
    expect(computeActiveToolDomains(intent).has("event")).toBe(true);
    expect(exposedNames(intent)).toContain("define_ending");
  });

  it("상성표 툴을 선언하면 set_type_chart 가 노출된다", () => {
    expect(exposedNames(declaredIntent({ tools: ["set_type_chart"] }))).toContain("set_type_chart");
  });

  it("컷신·회상 선언은 script_cutscene 과 프리셋을 함께 노출한다", () => {
    const names = exposedNames(declaredIntent({ tools: ["script_cutscene", "script_cutscene_preset"] }));
    expect(names).toContain("script_cutscene");
    expect(names).toContain("script_cutscene_preset");
  });

  it("참조 id 조회 툴은 어떤 선언에서도 노출된다(core)", () => {
    for (const intent of [declaredIntent({ mode: "question" }), declaredIntent({ tools: ["define_ending"] }), null]) {
      const names = toOpenAiTools(undefined, { domains: computeActiveToolDomains(intent) }).map((tool) => tool.function.name);
      expect(names).toContain("get_database_records");
      expect(names).toContain("tile_query");
    }
  });

  it("타일 시공만 선언한 턴은 컷신 툴을 끌어오지 않는다(과잉 노출 방지)", () => {
    const names = exposedNames(declaredIntent({ space: "outdoor", tools: ["paint_road"] }));
    expect(names).not.toContain("script_cutscene");
    expect(names).toContain("paint_road");
  });

  it("선언한 툴이 없으면 코어 + UI 도메인만 열린다 — 문장의 어미(켜지면·넓어지면)로 도메인이 열리는 경로는 없다", () => {
    const domains = computeActiveToolDomains(declaredIntent({ mode: "question", tools: [] }));
    expect([...domains].sort()).toEqual(["core", "map"]);
  });
});
