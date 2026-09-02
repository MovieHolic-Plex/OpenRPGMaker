// ai/contextFooter.ts
// 패널·영역 작업이 사용자 발화 뒤에 붙이는 `[컨텍스트] …` 줄(현재 맵·선택 영역)을 읽고 걷어내는 순수 함수.
//
// 이 줄은 **사실**(코드가 아는 값)이라 모델에게는 그대로 가고, 사용자 발화만 봐야 하는 자리
// (의도 선언·시선 문구 해석·제안 카드 표시)에서는 걷어낸다. 예전에는 여기에 「도구 규칙」 가이드
// 17줄도 실려 왔고, 그 기계 텍스트를 분류기들이 사용자 말로 읽어 라우팅이 어긋났다(2026-09-03 감사).
// 이제 가이드는 없다 — 규칙은 툴 설명에 있고, 뜻은 의도 선언(intentDeclaration)이 정한다.

/** `[컨텍스트]` 줄을 뗀 사용자 발화. */
export function stripContextFooter(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("[컨텍스트]"))
    .join("\n")
    .trim();
}

/** footer 의 현재 맵 id(가장 마지막 것). 없으면 null. */
export function contextFooterMapId(text: string): string | null {
  const pattern = /^\[컨텍스트\] 현재 맵: .+? \(([^)]+)\)/gm;
  let found: string | null = null;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match[1] !== undefined) found = match[1];
    match = pattern.exec(text);
  }
  return found;
}
