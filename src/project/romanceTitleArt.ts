// project/romanceTitleArt.ts
// 연애 게임의 타이틀 배경 선택 규칙(2026-10-16 romance-fix-4, romance-real-2 R03/R05).
// 카페 연애 판의 타이틀에 「노을 지는 픽셀 농장」(oprn-still-harbor)이 걸렸다 — 조수는 타이틀 배경을 목록에서 아무거나 골랐고, 연애 기본 타이틀은
// 「코드가 깐 기본값일 때만」 지켜졌다. 번들 그림(oprn-still-*·oprn-title-*)은 장르마다 어울림이 다르므로 연애에는 허용 목록만 쓴다.
// 이 게임 전용으로 생성한 키아트(title_art_*)·사용자 업로드는 막지 않는다.
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { ROMANCE_TITLE_RESOURCE_ID } from "@/project/romancePreset";
import type { Project } from "@/project/types";

/** 연애에 어울리는 번들 타이틀·스틸 — 벚꽃 교정 옥상의 노을, 노을빛 빈 음악실, 옥상에서 내려다본 밤의 마을(뒤 둘은 현대 스틸 팩이 설치된 프로젝트에서만 보인다). */
export const ROMANCE_TITLE_BACKGROUNDS: readonly string[] = [
  ROMANCE_TITLE_RESOURCE_ID,
  "oprn-pack-still-modern-02",
  "oprn-pack-still-modern-03",
];

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
