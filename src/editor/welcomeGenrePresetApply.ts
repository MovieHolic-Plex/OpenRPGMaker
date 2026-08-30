// editor/welcomeGenrePresetApply.ts
// 포스터(장르 칩) 클릭의 **결정적** 부분: system.* 장르 토글을 지금 열린 프로젝트에 바로 적용한다.
//
// 왜 필요한가 (2026-08-30 실측): 포스터 클릭은 AI 채팅에 프롬프트를 자동 전송하는 것이 전부였고
// applyGenrePreset 은 이 경로에서 한 번도 호출되지 않았다. 그래서 "몬스터 수집"을 눌러도
// system.monsterCollection / battleParty / battleUiStyle 이 전부 꺼진 채로 남았다 — 모델이
// configure_monster_system 을 우연히 부르지 않으면 장르 엔진이 켜지지 않는 구조였다.
// AI 는 콘텐츠를 저작하고, 엔진 토글은 코드가 보장한다.

import { officialGenrePackIdForWelcomePreset, type WelcomeGenrePresetId } from "@/editor/welcomeGenrePresets";
import type { GenrePackId } from "@/project/genrePackId";
import { applyGenrePreset } from "@/project/genrePresets";
import { store } from "@/project/store";

/** 열린 프로젝트에 장르 프리셋 토글을 적용하고 적용된 pack id 를 돌려준다. */
export function applyWelcomeGenrePresetToOpenProject(presetId: WelcomeGenrePresetId): GenrePackId {
  const packId = officialGenrePackIdForWelcomePreset(presetId);
  store.update((draft) => {
    applyGenrePreset(draft, packId);
  }, { scope: "project", label: `장르 프리셋 적용: ${packId}`, origin: "system" });
  return packId;
}
