// 테스트용 의도 선언 픽스처 — 모델이 읽은 것처럼(source "llm") 선언을 만든다.
// 라우팅 테스트는 문장을 넣지 않는다: 문장을 읽는 것은 모델의 일이고, 코드는 선언 필드만 소비한다.
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { IntentDeclarationOutcome, IntentDeclarer } from "@/ai/intentDeclarationClient";

export function declaredIntent(partial: Partial<IntentDeclaration> = {}): IntentDeclaration {
  return {
    mode: "create",
    space: "none",
    facility: null,
    targetMapId: null,
    useSelection: false,
    clarify: null,
    clarifyOptions: [],
    needsPlan: false,
    resetsContext: false,
    tools: [],
    summary: "테스트 선언",
    source: "llm",
    ...partial,
  };
}

/** 항상 같은 선언을 돌려주는 선언자. 세션 라우팅 테스트에 주입한다. */
export function fixedDeclarer(partial: Partial<IntentDeclaration> = {}): IntentDeclarer {
  return async (facts): Promise<IntentDeclarationOutcome> => ({
    intent: declaredIntent({ summary: facts.userText, ...partial }),
    elapsedMs: 0,
  });
}
