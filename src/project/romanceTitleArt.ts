// project/romanceTitleArt.ts
// 연애 게임의 타이틀 배경 선택 규칙(2026-10-16 romance-fix-4, romance-real-2 R03/R05).
// 카페 연애 판의 타이틀에 「노을 지는 픽셀 농장」(oprn-still-harbor)이 걸렸다 — 조수는 타이틀 배경을 목록에서 아무거나 골랐고, 연애 기본 타이틀은
// 「코드가 깐 기본값일 때만」 지켜졌다. 번들 그림(oprn-still-*·oprn-title-*)은 장르마다 어울림이 다르므로 연애에는 허용 목록만 쓴다.
// 이 게임 전용으로 생성한 키아트(title_art_*)·사용자 업로드는 막지 않는다.
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import type { Project } from "@/project/types";

/** 연애 기본 타이틀(벚꽃 캠퍼스) id. romancePreset 이 다시 내보낸다(순환 import 를 피해 여기에 둔다). */
export const ROMANCE_TITLE_RESOURCE_ID = "oprn-title-romance-campus";

/** 연애에 어울리는 번들 타이틀·스틸 — 벚꽃 교정 옥상의 노을, 노을빛 빈 음악실, 옥상에서 내려다본 밤의 마을(뒤 둘은 현대 스틸 팩이 설치된 프로젝트에서만 보인다). */
export const ROMANCE_TITLE_BACKGROUNDS: readonly string[] = [
  ROMANCE_TITLE_RESOURCE_ID,
  "oprn-title-romance-cafe",
  "oprn-title-romance-school",
  "oprn-title-romance-office",
  "oprn-title-romance-town",
  "oprn-pack-still-modern-02",
  "oprn-pack-still-modern-03",
];

/**
 * 소재별 연애 타이틀 키아트(2026-10-17 romance-loop-2, R1-06: 카페·학원물 판에도 벚꽃 캠퍼스 그림 하나뿐이었다).
 * 캠퍼스 그림과 같은 화풍(gpt-image-2.5-sunburst, 노을빛 수채풍 애니 배경, 뒷모습 둘, 인물은 오른쪽·왼쪽 글자 자리는 조용)으로 만들었고
 * public/assets/generated/title/romance-<setting>.jpg 에 있다. 출처·프롬프트·후보 판정: public/assets/generated/title/romance-keyart-provenance.json.
 */
export interface RomanceTitleArt { readonly id: string; readonly setting: string; readonly label: string; readonly keywords: RegExp }
export const ROMANCE_TITLE_ARTS: readonly RomanceTitleArt[] = [
  { id: ROMANCE_TITLE_RESOURCE_ID, setting: "campus", label: "벚꽃 캠퍼스 옥상", keywords: /대학|캠퍼스|동아리|학과|MT|강의|과 ?선배|새내기|벚꽃/giu },
  { id: "oprn-title-romance-cafe", setting: "cafe", label: "노을 카페 테라스", keywords: /카페|커피|바리스타|라떼|디저트|베이커리|브런치|café|cafe/giu },
  { id: "oprn-title-romance-school", setting: "school", label: "저녁 학교 복도 창가", keywords: /학원|고등학교|고교|중학교|교실|교복|야자|학생회|반장|입시|수능|담임|보충수업|hagwon/giu },
  { id: "oprn-title-romance-office", setting: "office", label: "황혼 사옥 옥상", keywords: /회사|직장|사무실|출근|퇴근|사내|오피스|야근|상사|동기 사원|신입 사원|인턴|office/giu },
  { id: "oprn-title-romance-town", setting: "town", label: "황혼 바닷가 마을", keywords: /이웃마을|바닷가|해변|항구|어촌|섬마을|시골|귀촌|한옥|등대|갯마을|해안/giu },
];

function setting(id: string | undefined): RomanceTitleArt | undefined {
  return ROMANCE_TITLE_ARTS.find((art) => art.id === id);
}

/**
 * 기획·요청 문장이 가리키는 소재의 키아트. 소재 낱말이 하나도 없거나 캠퍼스가 이기면 undefined(= 기본 캠퍼스 그림이 맞다).
 * 「대학 카페 알바」처럼 섞이면 낱말이 더 많은 쪽이 이기고 동률이면 캠퍼스를 둔다.
 */
export function romanceTitleArtForText(text: string | undefined | null, includeCampus = false): RomanceTitleArt | undefined {
  if (typeof text !== "string") return undefined;
  // 장르 프리셋 지시문에 실린 제작 매뉴얼은 사용자 요청이 아니다(그 안의 「캠퍼스」 같은 낱말을 세지 않는다).
  text = text.replace(/AUTHORING_PRESET_BEGIN [\s\S]*?AUTHORING_PRESET_END[^\n]*/gu, "");
  if (!text.trim()) return undefined;
  const score = (art: RomanceTitleArt) => (text.match(new RegExp(art.keywords.source, "giu")) ?? []).length;
  const campus = ROMANCE_TITLE_ARTS[0]!;
  let best: RomanceTitleArt | undefined = includeCampus && score(campus) > 0 ? campus : undefined;
  let bestScore = score(campus);
  for (const art of ROMANCE_TITLE_ARTS.slice(1)) {
    const value = score(art);
    if (value > bestScore) { best = art; bestScore = value; }
  }
  return best;
}

/** 지금 타이틀이 소재 키아트 중 하나인데 문장은 다른 소재를 더 강하게 가리키면 바꿔야 할 그림을 돌려준다(캠퍼스 기본이든 조수가 고른 엉뚱한 소재 그림이든). 저작자가 고른 생성·업로드 그림은 건드리지 않는다. */
export function romanceTitleArtSettingGap(backgroundResourceId: string | undefined, text: string | undefined | null): RomanceTitleArt | undefined {
  const current = setting(backgroundResourceId);
  if (!current) return undefined;
  const best = romanceTitleArtForText(text, true);
  if (!best || best.id === current.id) return undefined;
  const clean = typeof text === "string" ? text.replace(/AUTHORING_PRESET_BEGIN [\s\S]*?AUTHORING_PRESET_END[^\n]*/gu, "") : "";
  const count = (art: RomanceTitleArt) => (clean.match(new RegExp(art.keywords.source, "giu")) ?? []).length;
  return count(best) > count(current) ? best : undefined;
}

export function isRomanceTitleArtId(id: string | undefined): boolean {
  return setting(id) !== undefined;
}

const BUNDLED_TITLE_ART = /^(?:oprn|rpg-zzu)-(?:pack-)?(?:still|title)-/u;

/** 번들 그림인데 연애 허용 목록에 없으면 그 그림의 이름(없으면 id)을 돌려준다. 생성·업로드 그림은 undefined. */
export function romanceTitleMismatch(resourceId: string | undefined): string | undefined {
  const id = resourceId?.trim();
  if (!id || !BUNDLED_TITLE_ART.test(id) || ROMANCE_TITLE_BACKGROUNDS.includes(id)) return undefined;
  return findOpeningStillMood(id)?.name ?? id;
}

export function isRomanceTitleTarget(project: Pick<Project, "system" | "gameDesignBrief">): boolean {
  return project.system?.genreLock?.preset === "romance" || project.gameDesignBrief?.interview?.genre === "romance";
}

export function romanceTitleMismatchMessage(name: string): string {
  return `타이틀 배경 「${name}」은(는) 연애 게임에 어울리지 않는 그림입니다 — 연애에 맞는 번들 그림(${ROMANCE_TITLE_BACKGROUNDS.join(", ")}) 중에서 고르거나, generate_title_art 로 이 게임 장면(예: 카페 앞 저녁, 교정 벚꽃길, 비 오는 정류장)을 전용 키아트로 만드세요.`;
}
