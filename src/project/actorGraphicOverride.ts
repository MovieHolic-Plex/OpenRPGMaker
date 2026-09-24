// project/actorGraphicOverride.ts
// 「주인공 모습 변경」(m2 Change Actor Graphic) 의 세션 값. 예전에는 charset 시트 id 만 담아 시트의 첫 칸(0번)
// 인물로만 바꿀 수 있었다 — 꿈 세계의 「효과」(촛불 머리·우산·고양이 귀)처럼 한 시트 안의 다른 인물로 갈아입히려면
// 칸 번호가 필요하다(2026-09-24 꿈 세계 도그푸딩). 저장 모양은 그대로 문자열: "시트id" 또는 "시트id#칸".

export interface ActorGraphicOverride {
  readonly resourceId: string;
  readonly characterIndex: number;
}

export function parseActorGraphicOverride(value: string): ActorGraphicOverride {
  // list_resources 의 검색 id(charset:<텍스처>:<칸>)도 그대로 받는다.
  const search = /^charset:(.+):(\d+)$/u.exec(value.trim());
  if (search) return { resourceId: search[1]!, characterIndex: Number(search[2]) };
  const hash = /^(.+)#(\d+)$/u.exec(value.trim());
  if (hash) return { resourceId: hash[1]!, characterIndex: Number(hash[2]) };
  return { resourceId: value.trim(), characterIndex: 0 };
}

export function formatActorGraphicOverride(resourceId: string, characterIndex: number | undefined): string {
  const index = Number.isInteger(characterIndex) && characterIndex! > 0 && characterIndex! < 8 ? characterIndex! : 0;
  return index === 0 ? resourceId : `${resourceId}#${index}`;
}
