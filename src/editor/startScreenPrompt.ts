// 첫 화면(새 게임) 한 문장 → 조수에게 보내는 첫 지시. DOM·저장소를 모르는 순수 함수라
// 편집기 인계(startScreenHandoff.ts)와 조수 측정 하네스(작은 일 다섯째 묶음)가 같은 글을 쓴다.
import { newProjectChoiceById, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import { buildWelcomeFreeTextPrompt } from "@/editor/welcomeGenrePresets";

/** 장르를 골랐으면 한 문장 앞에 장르 계약을 붙인다 — 모델이 장르 엔진(이미 켜져 있다)을 끄지 않게 한다. */
export function startScreenPrompt(intent: { readonly choiceId: NewProjectChoiceId | null; readonly intent: string }): string | null {
  const text = intent.intent.trim();
  if (!text) return null;
  const choice = intent.choiceId ? newProjectChoiceById(intent.choiceId) : undefined;
  const base = buildWelcomeFreeTextPrompt(text);
  if (!choice) return base;
  return [
    base,
    "",
    "선택한 시작 장르: " + choice.label + " — 장르 시스템 설정은 이미 적용돼 있다. 끄지 말고 그 위에 만든다.",
    "장르 톤: " + choice.tone,
  ].join("\n");
}
