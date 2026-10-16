/**
 * 몬스터 수집 장르 기본 효과음 세트 — 원본 칩튠 합성음(CC0).
 *
 * 만드는 법: `scripts/content/monster-sfx/` — 텍스트 모델(Argon)이 합성기 패치(JSON)를 쓰고, `synth.py` 가 펄스·삼각·
 * 웨이브·LFSR 잡음으로 렌더한다. 녹음·샘플·원작 멜로디는 쓰지 않았다. 패치·모델·검사 수치는
 * `public/assets/monster-sfx/manifest.json`. 문서: `openwiki/monster-sfx.md`.
 *
 * 이 파일은 id↔파일 표와 장르 판정(순수 함수)만 둔다. 재생은 `player/monsterSfx.ts`.
 */
import type { Project } from "@/project/types";

export const MONSTER_SFX_CUES = [
  "ui-cursor", "ui-confirm", "ui-cancel", "ui-error",
  "hit-weak", "hit-normal", "hit-super",
  "ball-throw", "ball-shake", "ball-break", "capture-success",
  "level-up", "faint", "center-heal", "encounter",
  // 2차 세트(진화·획득·상태 이상·날씨·필드)
  "evolve-before", "evolve-during", "evolve-after", "badge-get", "item-get", "shop-buy",
  "status-poison", "status-burn", "status-paralysis", "status-sleep", "status-confusion",
  "stat-up", "stat-down",
  "weather-rain", "weather-sun", "weather-sand", "weather-hail",
  "walk-grass", "dialogue-tick", "crit", "battle-start", "door-open", "gym-door",
  "hm-rock-smash", "hm-cut", "hm-surf",
] as const;
export type MonsterSfxCue = (typeof MONSTER_SFX_CUES)[number];

export const MONSTER_SFX_TITLES: Readonly<Record<MonsterSfxCue, string>> = {
  "ui-cursor": "메뉴 커서",
  "ui-confirm": "결정",
  "ui-cancel": "취소",
  "ui-error": "오류",
  "hit-weak": "타격 · 효과가 별로",
  "hit-normal": "타격 · 보통",
  "hit-super": "타격 · 효과가 굉장",
  "ball-throw": "포획 볼 던지기",
  "ball-shake": "포획 볼 흔들림",
  "ball-break": "포획 실패",
  "capture-success": "포획 성공",
  "level-up": "레벨 업",
  "faint": "기절",
  "center-heal": "센터 회복",
  "encounter": "야생 조우 전환",
  "evolve-before": "진화 · 시작",
  "evolve-during": "진화 · 변신 중",
  "evolve-after": "진화 · 완료",
  "badge-get": "배지 획득",
  "item-get": "아이템 획득",
  "shop-buy": "상점 구매",
  "status-poison": "상태 이상 · 독",
  "status-burn": "상태 이상 · 화상",
  "status-paralysis": "상태 이상 · 마비",
  "status-sleep": "상태 이상 · 잠듦",
  "status-confusion": "상태 이상 · 혼란",
  "stat-up": "능력 상승",
  "stat-down": "능력 하락",
  "weather-rain": "날씨 · 비",
  "weather-sun": "날씨 · 쾌청",
  "weather-sand": "날씨 · 모래바람",
  "weather-hail": "날씨 · 싸라기눈",
  "walk-grass": "풀숲 걷기",
  "dialogue-tick": "대사 글자",
  "crit": "급소 타격",
  "battle-start": "전투 시작",
  "door-open": "문 열림",
  "gym-door": "체육관 문",
  "hm-rock-smash": "비전 · 바위 깨기",
  "hm-cut": "비전 · 풀 베기",
  "hm-surf": "비전 · 파도타기",
};

export function monsterSfxResourceId(cue: MonsterSfxCue): string {
  return `cc0-sound-monster-${cue}`;
}

export function monsterSfxPath(cue: MonsterSfxCue): string {
  return `assets/monster-sfx/${cue}.ogg`;
}

/** 이 세트가 기본 소리가 되는 프로젝트 — 몬스터 수집 장르(몬스터 파티 전투 또는 수집 시스템 켜짐)뿐이다.
 *  다른 장르의 소리는 건드리지 않는다. 저작된 슬롯(메뉴 소리·시스템 오디오 덮어쓰기·승패 큐)은 언제나 이 세트보다 우선한다. */
export function usesMonsterSfxSet(project: Pick<Project, "system">): boolean {
  const system = project.system;
  return system.monsterCollection === true || system.battleParty === "monsters" || system.monsterBattleParty === true;
}

/** 내보내기에 얹을 id — 소스에서 고르는 소리라 프로젝트 문자열 훑기로는 보이지 않는다. */
export function monsterSfxRuntimeResourceIds(project: Pick<Project, "system">): readonly string[] {
  return usesMonsterSfxSet(project) ? MONSTER_SFX_CUES.map(monsterSfxResourceId) : [];
}

/** 필드 메뉴·타이틀 UI 사건 → 몬스터 세트 큐(runtimeJuice). 기존 RTP 짝: cursor1·decision1/2·cancel1/2·buzzer1. */
export const MONSTER_SFX_UI_CUE: Readonly<Record<
  "menu-back" | "menu-close" | "menu-confirm" | "menu-invalid" | "menu-open" | "menu-select" | "title-confirm" | "title-enter" | "title-select",
  MonsterSfxCue
>> = {
  "menu-select": "ui-cursor",
  "title-select": "ui-cursor",
  "menu-confirm": "ui-confirm",
  "menu-open": "ui-confirm",
  "title-confirm": "ui-confirm",
  "title-enter": "ui-confirm",
  "menu-back": "ui-cancel",
  "menu-close": "ui-cancel",
  "menu-invalid": "ui-error",
};
