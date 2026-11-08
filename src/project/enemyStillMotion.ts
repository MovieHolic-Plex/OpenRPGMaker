// project/enemyStillMotion.ts — 적 그림을 엔진이 움직이는 설정(system.enemyStillMotion).
//
// 왜: 전투 적 그림은 두 갈래다. 도트 시트(3×3·4×4 칸)·걷기 칩·확장 배틀러 시트는 칸이 이미 공격·피격·
// 쓰러짐을 그린다. 그러나 그림 한 장만 올린 적(업로드 초상만 있는 몬스터·스토어 팩 밖 그림)은 대기 숨쉬기
// 말고는 아무 일도 없어 「맞아도 서 있고, 죽어도 서 있다」로 읽힌다. 이 설정이 그런 적에게 엔진 연출
// 한 벌(숨쉬기·예비동작→정수 px 돌진→복귀·피격 반동+번쩍·쓰러짐 기울기+계단 소멸)을 붙인다.
//
// 계약 — 칸이 있는 그림의 소유자는 그 칸·포즈 원장이다. 칸 선택(background-position·data-pixel-cell)·
// filter·scale·opacity·clip-path 는 절대 건드리지 않는다. 걸 수 있는 것은 정수 px `translate` 와 `rotate` 뿐이고,
// 이 둘은 `transform`·`scale` 과 다른 CSS 속성이라 칸 전환·CSS 숨쉬기·보스 등장과 합성된다.
//
// 모드(1줄 스위치):
//   all      (기본) 칸 없는 정지 그림 = 전체 연출 · 칸 있는 그림 = translate·rotate 만
//   stillOnly       칸 없는 정지 그림에만 건다 — 칸 있는 그림은 지금 그대로 둔다
//   off             아무 데도 걸지 않는다

import { getPlayerPreferences } from "@/player/playerPreferences";

export const ENEMY_STILL_MOTION_MODES = ["all", "stillOnly", "off"] as const;
export type EnemyStillMotionMode = (typeof ENEMY_STILL_MOTION_MODES)[number];

/** 저작이 없을 때의 모드. */
export const ENEMY_STILL_MOTION_DEFAULT: EnemyStillMotionMode = "all";

export const ENEMY_STILL_MOTION_LABELS: Readonly<Record<EnemyStillMotionMode, string>> = {
  all: "모든 적 그림에 (기본)",
  stillOnly: "정지 그림 하나뿐인 적만",
  off: "끄기 (정지 그림 그대로)",
};

export const ENEMY_STILL_MOTION_DESCRIPTION = "지금은 숲늑대·엄니멧돼지 두 적에만 적용됩니다. 그림 한 장뿐인 적을 엔진이 숨쉬기·돌진·피격 반동·쓰러짐으로 움직입니다. "
  + "공격·피격·쓰러짐 칸이 있는 도트 시트와 걷기 칩은 그 칸을 그대로 쓰고, 이 연출은 정수 픽셀 이동·기울이기만 더합니다. "
  + "플레이어가 「메뉴 움직임 줄이기」나 OS 의 동작 줄이기를 켜면 멈춥니다.";

export function isEnemyStillMotionMode(value: unknown): value is EnemyStillMotionMode {
  return typeof value === "string" && (ENEMY_STILL_MOTION_MODES as readonly string[]).includes(value);
}

export function normalizeEnemyStillMotion(value: unknown): EnemyStillMotionMode | undefined {
  return isEnemyStillMotionMode(value) ? value : undefined;
}

export function resolveEnemyStillMotion(project: { readonly system?: { readonly enemyStillMotion?: unknown } } | undefined): EnemyStillMotionMode {
  return normalizeEnemyStillMotion(project?.system?.enemyStillMotion) ?? ENEMY_STILL_MOTION_DEFAULT;
}

/** 사용자가 움직임을 줄이기로 했는가(OS 설정 또는 게임 메뉴의 「메뉴 움직임 줄이기」). */
export function prefersReducedBattleMotion(view: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  try {
    if (getPlayerPreferences().reduceMenuMotion) return true;
  } catch {
    return view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }
  return view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * 엔진 연출이 이 적 그림의 속성을 얼마나 쓸 수 있는가.
 *   "full"      칸이 없는 정지 그림 하나 — 숨쉬기·돌진·피격 번쩍·쓰러짐 소멸 전부 엔진 몫.
 *   "translate" 칸이 있는 그림 — 정수 px translate·rotate 만. 셀 선택·배경 위치·filter·scale·opacity 는 그 원장 몫.
 *   "off"       그림을 못 읽었거나 설정이 꺼졌다(또는 stillOnly 인데 칸이 있다).
 */
export type StillMotionLevel = "full" | "translate" | "off";

export function framedArt(node: HTMLElement, image: HTMLElement | null | undefined): boolean {
  if (node.dataset.pixelEnemy !== undefined) return true;
  if (node.dataset.pixelParty !== undefined) return true;
  if (node.dataset.charsetEnemy !== undefined) return true;
  if (node.dataset.battlerExtended === "true") return true;
  return image?.dataset.battlerAnim !== undefined;
}

/**
 * 엔진 몸짓을 받는 적 레코드 id — 오너 선택 A(2026-11-08, 「A로 몬스터 2마리만」). 이 목록 밖의 적은 지금 그대로 둔다.
 * 몬스터별 수치는 없다: 목록은 「누가 받는가」만 정하고, 받는 몸짓은 위 단계 규칙(칸 있는 그림 = 정수 이동·기울기)이 정한다.
 * 넓힐 때는 여기에 레코드 id 를 더한다.
 *   enemy_fs_wolf  숲늑대   — 4×4 도트 시트(dash), 1막 숲 가장자리 부대의 일반 적
 *   enemy_fs_boar  엄니멧돼지 — 4×4 도트 시트(dash), 같은 부대(troop_fs_edge_boar)의 일반 적
 */
export const ENEMY_MOTION_RECORD_IDS: ReadonlySet<string> = new Set(["enemy_fs_wolf", "enemy_fs_boar"]);

export function enemyMotionAllowed(node: HTMLElement): boolean {
  return ENEMY_MOTION_RECORD_IDS.has(node.dataset.recordId ?? "");
}

export function stillMotionLevel(node: HTMLElement, image: HTMLElement | null | undefined, mode: EnemyStillMotionMode): StillMotionLevel {
  if (!image || mode === "off" || !enemyMotionAllowed(node)) return "off";
  if (!framedArt(node, image)) return "full";
  return mode === "all" ? "translate" : "off";
}

/**
 * 무대 연출이 이 노드의 filter·scale·opacity 를 이미 쓰는가 — 그러면 translate·rotate 만 쓴다.
 * 보스 등장(29-impact-contact.css bf-boss-entry)은 1.4초 동안 filter: brightness(0) 와 scale 을 걸고,
 * 씬의 data-battle-director-step="intro" 는 그 창 전체를 가리킨다. 큰 보스 무대(data-battle-big-boss)는
 * 배치·배율을 CSS 변수로 잡는다.
 */
export function stageOwnsFilters(node: HTMLElement): boolean {
  if (node.dataset.collapse === "bossSink") return true;
  const scene = node.closest<HTMLElement>(".battle-scene");
  if (scene?.dataset.battleBigBoss === "true") return true;
  return scene?.dataset.battleDirectorStep === "intro";
}
