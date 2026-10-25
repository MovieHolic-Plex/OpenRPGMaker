// 고르기 창 문구에서 제작 메모 꼬리표를 걷는다(2026-10-25 판정 J37).
//
// 조수가 「마지막으로 가게 문을 닫는다 (엔딩)」「혼자 도망친다 (배드 엔딩)」「침대에서 자고 … (+1일)」처럼 설계 메모를 선택지에 적었다.
// 플레이어에게는 스포일러이자 제작 흔적이다. 런타임은 보여 줄 때 걷고, 조수 검사(gameChecks)는 저작 단계에서 짚는다.
// 엔딩·분기·날짜 경과·호감 증감처럼 «게임 설계»를 말하는 괄호만 걷는다. 값(「(100G)」)·대사 속 괄호는 그대로 둔다.

const META_INSIDE = /엔딩|ending|분기|루트|route|플래그|flag|[+＋]\s*\d+\s*일|\d+\s*일\s*(경과|후|지남)|다음\s*날로|호감(도)?\s*[+\-＋－]\s*\d|[+\-＋－]\s*\d+\s*호감|affection/iu;
const BRACKETED = /\s*[(\[（［【〔]([^()\[\]（）［］【】〔〕]{1,24})[)\]）］】〕]/gu;

/** 제작 메모 괄호를 걷은 문구. 다 걷으면 빈 글이 되는 경우(괄호뿐인 선택지)는 원문을 둔다. */
export function playerChoiceText(text: string): string {
  if (!text || !/[(\[（［【〔]/u.test(text)) return text;
  const cleaned = text.replace(BRACKETED, (whole, inside: string) => (META_INSIDE.test(inside) ? "" : whole)).trim();
  return cleaned || text;
}

/** 선택지 문구에 제작 메모 괄호가 있는가(조수 검사용). */
export function choiceMetaTag(text: string): string | undefined {
  for (const match of String(text ?? "").matchAll(BRACKETED)) if (META_INSIDE.test(match[1] ?? "")) return match[0].trim();
  return undefined;
}
