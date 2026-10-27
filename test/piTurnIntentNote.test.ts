// Pi 턴이 의도 노트를 싣는가 — 세션 → Pi 이관(2026-09-11)에서 formatIntentNote/formatScopeNote 가 빠져
// 「마을을 만들어달라」의 계획·실행 모델이 author_village·권장 크기를 한 번도 못 봤다(2026-09-17 실측:
// 계획은 도구 이름 없는 산문, 실행은 paint_road 5번으로 16턴 소진). 여기서 본문이 읽는 문자열을 고정한다.
import { describe, expect, it } from "vitest";
import { buildPiIntentNote, composePiTask } from "@/ai/piAgent/executionRoute";
import { INTENT_NOTE_BOUNDARY } from "@/ai/piAgent/monsterGameRequest";
import { emptyIntentDeclaration, type IntentDeclaration } from "@/ai/intentDeclaration";

const villageIntent: IntentDeclaration = {
  ...emptyIntentDeclaration(),
  mode: "create",
  space: "outdoor",
  needsPlan: true,
  tools: ["author_village"],
  construction: { scale: "medium" },
  summary: "마을을 만들어달라",
  source: "llm",
};

describe("Pi 턴 의도 노트", () => {
  // 마을 시공 노트(author_village·author_house·설계서 houseCount·resize 선행) 사례 10개는 은퇴 —
  // 두 도구가 2026-10-07 저작권 정리로 삭제됐다(toolRegistry CONSTRUCTION_WRITE_SUPERSEDED 주석).

  it("모호한 점은 되묻지 않고 해석을 밝히라고 한다 — Pi 경로에는 되묻는 자리가 없다", () => {
    const note = buildPiIntentNote({ intent: { ...villageIntent, clarify: "어느 맵에?" }, targetMap: null, selection: null });
    expect(note).toContain("모호한 점: 어느 맵에?");
    expect(note).toContain("되묻지 않는다");
  });

  it("폴백 선언은 노트가 없고 지시문은 그대로다", () => {
    const fallback: IntentDeclaration = { ...emptyIntentDeclaration(), source: "fallback" };
    expect(buildPiIntentNote({ intent: fallback, targetMap: null, selection: null })).toBeNull();
    expect(composePiTask("마을을 만들어달라", null)).toBe("마을을 만들어달라");
  });

  it("지시문 뒤에 노트를 붙인다 — 사용자 문장이 먼저, 노트가 뒤", () => {
    const task = composePiTask("마을을 만들어달라", "[의도] 야외 시공");
    expect(task.startsWith("마을을 만들어달라")).toBe(true);
    expect(task).toBe(`마을을 만들어달라${INTENT_NOTE_BOUNDARY}[의도] 야외 시공`);
  });
});
