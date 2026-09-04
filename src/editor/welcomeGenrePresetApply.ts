// editor/welcomeGenrePresetApply.ts
// 포스터(장르 칩) 클릭의 **결정적** 부분: system.* 장르 토글을 지금 열린 프로젝트에 바로 적용한다.
//
// 왜 필요한가 (2026-08-30 실측): 포스터 클릭은 AI 채팅에 프롬프트를 자동 전송하는 것이 전부였고
// applyGenrePreset 은 이 경로에서 한 번도 호출되지 않았다. 그래서 "몬스터 수집"을 눌러도
// system.monsterCollection / battleParty / battleUiStyle 이 전부 꺼진 채로 남았다 — 모델이
// configure_monster_system 을 우연히 부르지 않으면 장르 엔진이 켜지지 않는 구조였다.
// AI 는 콘텐츠를 저작하고, 엔진 토글은 코드가 보장한다.

import {
  officialGenrePackIdForWelcomePreset,
  WELCOME_GENRE_PRESETS,
  type WelcomeGenrePresetId,
} from "@/editor/welcomeGenrePresets";
import type { GenrePackId } from "@/project/genrePackId";
import { applyGenrePreset } from "@/project/genrePresets";
import { store } from "@/project/store";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { worldCanonHasContent, type WorldCanon, type WorldCanonTone } from "@/project/world/canon";

const CANON_TONES: Record<WelcomeGenrePresetId, readonly WorldCanonTone[]> = {
  "monster-collect": ["hopeful", "fairytale"],
  "partner-raise": ["hopeful", "slice"],
  "farm-life": ["slice", "hopeful"],
  "adventure-jrpg": ["hopeful", "mythic"],
  "horror-gallery": ["gothic", "grim"],
  "school-horror": ["grim", "slice"],
  "story-cutscene": ["grim", "political"],
};

export function welcomeCanonSeed(presetId: WelcomeGenrePresetId): WorldCanon {
  const preset = WELCOME_GENRE_PRESETS.find((entry) => entry.id === presetId);
  return {
    ...(preset ? { premise: preset.tone } : {}),
    tones: CANON_TONES[presetId],
  };
}

/** 열린 프로젝트에 장르 프리셋 토글을 적용하고 적용된 pack id 를 돌려준다.
 *  세계관이 비어 있으면 장르 톤·전제를 초안으로 심는다 — 사용자가 적어 둔 세계는 건드리지 않는다. */
export function applyWelcomeGenrePresetToOpenProject(presetId: WelcomeGenrePresetId): GenrePackId {
  const packId = officialGenrePackIdForWelcomePreset(presetId);
  // 한 번의 클릭이 엔진 토글 + 세계관 시드를 함께 덮어쓰므로 실행 취소 한 장으로 묶는다.
  recordProjectSnapshot(`장르 프리셋 적용: ${packId}`);
  store.update((draft) => {
    applyGenrePreset(draft, packId);
    if (!worldCanonHasContent(draft.worldCanon)) draft.worldCanon = welcomeCanonSeed(presetId);
  }, { scope: "project", label: `장르 프리셋 적용: ${packId}`, origin: "system" });
  return packId;
}
