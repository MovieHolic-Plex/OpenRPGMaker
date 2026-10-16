// project/charsetFamily.ts
// 캐릭터 칩(걷기 그림) 계열 — 장르 잠금(genreLock.ts)의 charset 잠금이 쓰는 분류. 맵 타일셋 계열(tilesetFamily.ts)의 짝이다.
// 이 파일은 일부러 charsetCatalog 를 불러오지 않는다(장르 잠금은 프리셋·런타임 양쪽이 가져가므로 무거운 번들 표를 끌어오지 않는다) —
// 리소스 id·텍스처 키의 모양만 보고 가른다. 새 번들 시트가 생기면 아래 표에 한 줄을 더한다(모르는 번들은 "other").

export type CharsetFamilyId =
  | "rtp-people"        // EasyRPG RTP Actor1~4 · People1~5 — 판타지 RPG 사람 칩(포켓몬풍 아님)
  | "scarloxy-people"   // Scarloxy MPWSP01 People1~2 — 몬스터 테이밍 팩의 트레이너·도장 보스
  | "oprn-creature"     // OPRN 자체 제작 몬스터 칩: Monster4~6 · 몬스터 수집 하네스 따라다니기 칩
  | "rtp-creature"      // RTP Monster1~3 · Animal · 농장 동물 — 판타지 RPG 몬스터·동물(포켓몬풍 아님)
  | "object"            // 문·상자·표지·탈것·템플릿 같은 기능 칩(사람이 아님)
  | "heroes"           // OPRN Heroes1 — 시간여행·제국군 직업 인물(CT·FF6풍, 포켓몬풍 아님)
  | "wizarding"         // 마법 학교 인물·생물 칩
  | "shared-actor"      // 공용 캐릭터 공방(charset-actor)에서 사람이 남긴 칩
  | "uploaded"          // 이 프로젝트에 사용자가 올린 칩
  | "other";            // 위 어디에도 안 맞는 번들(허용 여부는 프리셋 표가 정한다)

export const CHARSET_FAMILY_LABELS: Readonly<Record<CharsetFamilyId, string>> = {
  "rtp-people": "RTP 사람 칩(Actor·People)",
  "scarloxy-people": "Scarloxy 트레이너 칩",
  "oprn-creature": "OPRN 몬스터 칩",
  "rtp-creature": "RTP 몬스터·동물 칩",
  object: "기물·탈것 칩",
  heroes: "CT·FF6풍 영웅 칩",
  wizarding: "마법 학교 칩",
  "shared-actor": "공용 공방 캐릭터",
  uploaded: "업로드한 칩",
  other: "기타 번들 칩",
};

/** 리소스 id(`easyrpg-charset-people1`)와 텍스처 키(`tex_easyrpg_charset_people1`)는 접두사·구분자만 다르다 — 둘을 한 모양으로 접는다. */
function shape(id: string): string {
  return id.toLowerCase().replace(/^tex[-_]/u, "").replace(/_/gu, "-");
}

export interface CharsetFamilyContext {
  /** 프로젝트에 사용자가 올린 자산(없으면 업로드 판정을 건너뛴다). */
  readonly assets?: { readonly uploaded?: Readonly<Record<string, { readonly kind?: string }>> };
}

/** 칩 하나(리소스 id 또는 텍스처 키)의 계열. */
export function charsetFamilyOf(project: CharsetFamilyContext | undefined, idOrTextureKey: string): CharsetFamilyId {
  const s = shape(idOrTextureKey);
  if (s.startsWith("shared-charset-actor-")) return "shared-actor";
  if (/^easyrpg-charset-(actor|people)\d+$/u.test(s)) return "rtp-people";
  if (/^scarloxy-charset-people\d+$/u.test(s)) return "scarloxy-people";
  if (/^easyrpg-charset-monster[456]$/u.test(s) || /^oprn-charset-harness-monster\d+$/u.test(s)) return "oprn-creature";
  if (/^easyrpg-charset-monster\d+$/u.test(s) || s === "easyrpg-charset-animal" || /^farming-charset-/u.test(s)) return "rtp-creature";
  if (/^easyrpg-charset-(object\d+|vehicles?|template)$/u.test(s)) return "object";
  if (/^oprn-charset-heroes\d+$/u.test(s)) return "heroes";
  if (/^oprn-charset-wizarding\d+$/u.test(s)) return "wizarding";
  if (project?.assets?.uploaded?.[idOrTextureKey]?.kind === "charset") return "uploaded";
  return "other";
}
