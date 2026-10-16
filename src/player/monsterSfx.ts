import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  MONSTER_SFX_CUES,
  monsterSfxResourceId,
  usesMonsterSfxSet,
  type MonsterSfxCue,
} from "@/assets/monsterSfxAssets";
import { battleAudioContext } from "@/player/battleSfx";
import { playBattleSample, preloadBattleSamples } from "@/player/battleSeSamples";
import { getPlayerPreferences } from "@/player/playerPreferences";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

/**
 * 몬스터 수집 장르 기본 효과음 세트 재생(원본 칩튠 합성, assets/monsterSfxAssets.ts).
 *
 * - 몬스터 장르 프로젝트에서만 소리가 난다. 다른 장르는 false 만 돌려주고 아무것도 안 한다.
 * - 저작된 슬롯(메뉴 소리·시스템 오디오 덮어쓰기·승패 큐)이 있는 호출부는 이 세트를 부르기 전에 자기 저작을 먼저 본다.
 * - 오디오 컨텍스트가 없는 환경(헤드리스·단위 테스트)에서는 조용히 넘어간다.
 */

/** 큐별 기본 크기. 파일 자체가 비슷한 라우드니스(활성 구간 RMS)로 맞춰져 있어 이 값은 장면 균형만 잡는다. */
const CUE_VOLUME: Readonly<Record<MonsterSfxCue, number>> = {
  "ui-cursor": 0.4, "ui-confirm": 0.4, "ui-cancel": 0.4, "ui-error": 0.4,
  "hit-weak": 0.4, "hit-normal": 0.4, "hit-super": 0.4,
  "ball-throw": 0.4, "ball-shake": 0.4, "ball-break": 0.4, "capture-success": 0.5,
  "level-up": 0.5, "faint": 0.4, "center-heal": 0.5, "encounter": 0.45,
};

/** 설정 메뉴 「효과음」 기본값(playerPreferences). 기본값일 때 큐별 크기가 그대로 나오게 나눈다 — 전투 타격음(battleJuice)은 설정을 안 곱하므로 기본 균형을 맞춘다. */
const DEFAULT_SE_PREFERENCE = 0.8;

/** 몬스터 장르 프로젝트의 전투·결과 장면에서 쓰는 큐 전부를 미리 디코드한다(전투 진입 커버 동안). */
export function preloadMonsterSfx(project: Project = store.getCurrent()): void {
  if (!usesMonsterSfxSet(project)) return;
  preloadBattleSamples(MONSTER_SFX_CUES.map(monsterSfxResourceId));
}

/** 전투 사건 → 몬스터 세트 큐. 세트에 없는 사건은 undefined(기존 소리 그대로). */
export function monsterBattleCue(
  event: "command-select" | "command-confirm" | "command-cancel" | "attack-swing" | "hit-damage" | "hit-critical" | "hit-miss" | "hit-heal" | "faint" | "defend" | "escape" | "victory" | "defeat",
  tier: "weak" | "normal" | "super" = "normal",
): MonsterSfxCue | undefined {
  switch (event) {
    case "command-select": return "ui-cursor";
    case "command-confirm": return "ui-confirm";
    case "command-cancel": return "ui-cancel";
    case "hit-damage": return tier === "weak" ? "hit-weak" : tier === "super" ? "hit-super" : "hit-normal";
    case "hit-critical": return "hit-super";
    case "faint": return "faint";
    default: return undefined;
  }
}

/** 큐 하나를 재생한다. 몬스터 세트를 쓰는 프로젝트가 아니거나 소리를 낼 수 없으면 false. */
export function playMonsterSfx(project: Project, cue: MonsterSfxCue, volumeScale = 1, rate = 1): boolean {
  if (!usesMonsterSfxSet(project)) return false;
  if (!battleAudioContext()) return false; // 헤드리스·테스트 환경
  const volume = Math.max(0, Math.min(1, CUE_VOLUME[cue] * volumeScale * (getPlayerPreferences().se / DEFAULT_SE_PREFERENCE)));
  if (volume <= 0) return true; // 사용자가 효과음을 껐다 — 소리를 낸 것으로 쳐서 호출부가 옛 소리로 폴백하지 않게 한다
  const id = monsterSfxResourceId(cue);
  if (playBattleSample(id, volume, rate, "other")) return true;
  // 디코드 캐시가 비었으면 이번 한 번은 요소 경로로 낸다(캐시는 위에서 적재를 시작했다).
  const url = resolveAssetResourceUrl(id, { project });
  if (!url || typeof Audio === "undefined") return false;
  const audio = new Audio(url);
  audio.volume = volume;
  audio.playbackRate = rate;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException) return;
    console.warn("[monster-sfx] playback failed", error);
  });
  return true;
}

/** 현재 열린 프로젝트 기준 편의 호출(연출 코드가 프로젝트를 들고 있지 않을 때). */
export function playMonsterSfxNow(cue: MonsterSfxCue, volumeScale = 1, rate = 1): boolean {
  return playMonsterSfx(store.getCurrent(), cue, volumeScale, rate);
}
