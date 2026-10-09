// 의도 파서 계약 — 모델의 출력 표면은 (op + params) JSON 하나뿐이고,
// 그 값조차 레지스트리 스펙으로 검증·클램프된 뒤에야 생성기에 닿는다.
import { describe, expect, it, vi } from "vitest";
import {
  buildOperatorIntentPrompt,
  describeIntent,
  heuristicOperatorIntent,
  isOperatorIntentFailure,
  parseOperatorIntentJson,
  resolveOperatorIntent,
} from "@/editor/operators/operatorIntent";
import { getOperator, listOperators } from "@/editor/operators/operatorRegistry";

const forest = () => {
  const def = getOperator("forest");
  if (!def) throw new Error("forest 등록 필요");
  return def;
};

describe("프롬프트 생성", () => {
  it("레지스트리에서 만들어진다 — 오퍼레이터를 늘려도 프롬프트를 손댈 필요가 없다", () => {
    const prompt = buildOperatorIntentPrompt();
    for (const operator of listOperators()) {
      expect(prompt).toContain(operator.id);
      expect(prompt).toContain(operator.label);
      for (const spec of operator.params) expect(prompt).toContain(spec.id);
    }
  });

  it("타일·좌표를 만들지 말라고 명시한다", () => {
    const prompt = buildOperatorIntentPrompt();
    expect(prompt).toContain("좌표");
    expect(prompt).toMatch(/타일 번호[^\n]*만들지 마라/);
  });
});

describe("모델 응답 검증", () => {
  it("정상 JSON 을 의도로 옮긴다", () => {
    const intent = parseOperatorIntentJson('{"op":"forest","params":{"density":0.9,"path":false}}');
    expect(isOperatorIntentFailure(intent)).toBe(false);
    if (isOperatorIntentFailure(intent)) return;
    expect(intent.operatorId).toBe("forest");
    expect(intent.params.density).toBe(0.9);
    expect(intent.params.path).toBe(false);
    expect(intent.source).toBe("llm");
  });

  it("코드펜스·잡담이 섞여 와도 JSON 을 건진다", () => {
    const intent = parseOperatorIntentJson('```json\n{"op":"forest","params":{"density":0.8}}\n```');
    expect(isOperatorIntentFailure(intent)).toBe(false);
    const withChatter = parseOperatorIntentJson('알겠습니다 {"op":"forest","params":{}} 이렇게 하겠습니다');
    expect(isOperatorIntentFailure(withChatter)).toBe(false);
  });

  it("범위 밖·스펙 밖 값은 생성기에 닿기 전에 잘린다", () => {
    const intent = parseOperatorIntentJson('{"op":"forest","params":{"density":99,"clearings":2.6,"tileId":306,"주입":"x"}}');
    expect(isOperatorIntentFailure(intent)).toBe(false);
    if (isOperatorIntentFailure(intent)) return;
    expect(intent.params.density).toBe(1);
    expect(intent.params.clearings).toBe(3);
    expect(intent.params).not.toHaveProperty("tileId");
    expect(intent.params).not.toHaveProperty("주입");
  });

  it("모르는 생성기·깨진 JSON 은 실패로 끝난다", () => {
    expect(isOperatorIntentFailure(parseOperatorIntentJson('{"op":"nuke","params":{}}'))).toBe(true);
    expect(isOperatorIntentFailure(parseOperatorIntentJson("설명만 하고 JSON 이 없음"))).toBe(true);
    expect(isOperatorIntentFailure(parseOperatorIntentJson('{"params":{}}'))).toBe(true);
  });
});

describe("키워드 폴백", () => {
  it("정도를 나타내는 말을 수치로 옮긴다", () => {
    const dense = heuristicOperatorIntent("숲을 울창하게 만들어줘");
    const sparse = heuristicOperatorIntent("나무를 듬성듬성 심어줘");
    if (isOperatorIntentFailure(dense) || isOperatorIntentFailure(sparse)) throw new Error("해석 실패");
    expect(dense.params.density).toBeGreaterThan(sparse.params.density as number);
    expect(dense.source).toBe("heuristic");
  });

  it("오솔길 유무를 읽는다", () => {
    const withPath = heuristicOperatorIntent("숲에 오솔길 하나");
    const without = heuristicOperatorIntent("숲인데 길 없이");
    if (isOperatorIntentFailure(withPath) || isOperatorIntentFailure(without)) throw new Error("해석 실패");
    expect(withPath.params.path).toBe(true);
    expect(without.params.path).toBe(false);
  });

  it("생성기를 특정 못 하면 추측하지 않고 실패한다", () => {
    const result = heuristicOperatorIntent("여기 뭔가 멋있게 해줘");
    expect(isOperatorIntentFailure(result)).toBe(true);
    if (!isOperatorIntentFailure(result)) return;
    expect(result.error).toContain("숲");
  });
});

describe("resolveOperatorIntent", () => {
  it("LLM 이 있으면 한 번만 부른다", async () => {
    const complete = vi.fn(async () => '{"op":"forest","params":{"density":0.85}}');
    const intent = await resolveOperatorIntent("울창한 숲", { complete });
    expect(complete).toHaveBeenCalledTimes(1);
    if (isOperatorIntentFailure(intent)) throw new Error("해석 실패");
    expect(intent.source).toBe("llm");
    expect(intent.params.density).toBe(0.85);
  });

  it("LLM 이 실패하면 키워드로 떨어지고 그 사실을 밝힌다", async () => {
    const complete = vi.fn(async () => { throw new Error("401"); });
    const intent = await resolveOperatorIntent("울창한 숲", { complete });
    if (isOperatorIntentFailure(intent)) throw new Error("폴백이 동작해야 한다");
    expect(intent.source).toBe("heuristic");
    expect(intent.params.density).toBe(0.9);
  });

  it("모델이 형식을 어겨도 키워드로 구제한다", async () => {
    const complete = vi.fn(async () => "숲을 만들겠습니다!");
    const intent = await resolveOperatorIntent("울창한 숲", { complete });
    if (isOperatorIntentFailure(intent)) throw new Error("폴백이 동작해야 한다");
    expect(intent.source).toBe("heuristic");
  });

  it("LLM 도 키워드도 못 읽으면 실패를 그대로 돌려준다", async () => {
    const complete = vi.fn(async () => "{}");
    const intent = await resolveOperatorIntent("아무 말", { complete });
    expect(isOperatorIntentFailure(intent)).toBe(true);
  });

  it("빈 문장은 부르지도 않는다", async () => {
    const complete = vi.fn(async () => "{}");
    const intent = await resolveOperatorIntent("   ", { complete });
    expect(complete).not.toHaveBeenCalled();
    expect(isOperatorIntentFailure(intent)).toBe(true);
  });
});

describe("describeIntent", () => {
  it("기본값과 다른 것만 적는다", () => {
    const def = forest();
    const defaults: Record<string, number | boolean> = {};
    for (const spec of def.params) defaults[spec.id] = spec.defaultValue;
    expect(describeIntent(def, defaults)).toContain("기본 설정");
    expect(describeIntent(def, { ...defaults, density: 0.95 })).toContain("밀도 0.95");
  });
});
