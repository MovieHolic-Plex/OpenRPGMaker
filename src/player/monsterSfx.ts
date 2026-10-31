import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  MONSTER_SFX_CUES,
  monsterSfxResourceId,
  usesMonsterSfxSet,
  type MonsterSfxCue,
} from "@/assets/monsterSfxAssets";
import { WEATHER_START_LINES } from "@/battle/weather";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { SkillWeatherKind, StateRecord } from "@/project/types";
import { isVoicedChar, type DialogueVoicePlayer } from "@/player/dialogueVoice";
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
  "evolve-before": 0.5, "evolve-during": 0.45, "evolve-after": 0.5, "badge-get": 0.5, "item-get": 0.45, "shop-buy": 0.4,
  "status-poison": 0.4, "status-burn": 0.4, "status-paralysis": 0.4, "status-sleep": 0.4, "status-confusion": 0.4,
  "stat-up": 0.4, "stat-down": 0.4,
  "weather-rain": 0.4, "weather-sun": 0.4, "weather-sand": 0.4, "weather-hail": 0.4,
  "walk-grass": 0.25, "dialogue-tick": 0.2, "crit": 0.45, "battle-start": 0.45, "door-open": 0.4, "gym-door": 0.45,
  "hm-rock-smash": 0.45, "hm-cut": 0.45, "hm-surf": 0.45,
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
  event: "command-select" | "command-confirm" | "command-cancel" | "attack-swing" | "hit-damage" | "hit-actor" | "hit-critical" | "hit-miss" | "hit-heal" | "faint" | "boss-collapse" | "defend" | "escape" | "victory" | "defeat",
  tier: "weak" | "normal" | "super" = "normal",
): MonsterSfxCue | undefined {
  switch (event) {
    case "command-select": return "ui-cursor";
    case "command-confirm": return "ui-confirm";
    case "command-cancel": return "ui-cancel";
    case "hit-damage": case "hit-actor": return tier === "weak" ? "hit-weak" : tier === "super" ? "hit-super" : "hit-normal";
    case "hit-critical": return "hit-super";
    case "faint": case "boss-collapse": return "faint";
    default: return undefined;
  }
}

const WEATHER_CUE: Readonly<Record<SkillWeatherKind, MonsterSfxCue>> = {
  rain: "weather-rain", sun: "weather-sun", sandstorm: "weather-sand", hail: "weather-hail",
};

/**
 * 전투 타임라인 엔트리 → 몬스터 세트 큐(상태 이상 걸림·능력 단계 변화·날씨 시작). 해당 없으면 undefined.
 * 순수 함수 — 상태 레코드의 gen1MajorStatus/volatileStatus 로 종류를 고른다(빙결은 세트에 없다).
 */
export function monsterTimelineCue(
  entry: Pick<BattleTimelineEntrySnapshot, "kind" | "stateId" | "statStage" | "weatherKind" | "weatherAfter" | "message">,
  states: ReadonlyArray<Pick<StateRecord, "id" | "gen1MajorStatus" | "volatileStatus">>,
): MonsterSfxCue | undefined {
  if (entry.kind === "stateAdded" && entry.stateId) {
    const record = states.find((state) => state.id === entry.stateId);
    if (record?.volatileStatus === "confusion") return "status-confusion";
    switch (record?.gen1MajorStatus) {
      case "poison": case "toxic": return "status-poison";
      case "burn": return "status-burn";
      case "paralysis": return "status-paralysis";
      case "sleep": return "status-sleep";
      default: return undefined;
    }
  }
  if (entry.kind === "special") {
    if (entry.statStage) {
      if (entry.statStage.after > entry.statStage.before) return "stat-up";
      if (entry.statStage.after < entry.statStage.before) return "stat-down";
      return undefined;
    }
    // 날씨 시작 문장(지속·종료 엔트리와 구분: 시작만 weatherAfter 가 새로 켜진 날씨이고 메시지가 시작 문장이다).
    if (entry.weatherKind && entry.weatherAfter && entry.message === WEATHER_START_LINES[entry.weatherKind]) return WEATHER_CUE[entry.weatherKind];
  }
  return undefined;
}

/**
 * 몬스터 장르 기본 대사 글자 소리. 대사 목소리를 저작하지 않은(look.voice 없음) 몬스터 프로젝트에서만 쓴다.
 * 글자 둘에 한 번, 최소 간격 60ms — 빠른 글자에서 윙윙거리지 않게 한다. 음 높이는 조금씩 흔든다.
 */
export function createMonsterDialogueTick(project: Project, random: () => number = Math.random): DialogueVoicePlayer {
  if (!usesMonsterSfxSet(project)) return { speak() {} };
  preloadBattleSamples([monsterSfxResourceId("dialogue-tick")]);
  let count = 0;
  let lastAt = -Infinity;
  return {
    speak(char: string): void {
      if (!isVoicedChar(char)) return;
      count += 1;
      if (count % 2 === 0) return;
      const now = performance.now();
      if (now - lastAt < 60) return;
      lastAt = now;
      playMonsterSfx(project, "dialogue-tick", 1, 0.94 + random() * 0.12);
    },
  };
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
