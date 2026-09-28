// 스킬 탭 「연출」 카드의 **도트 전투 미리보기 스테이지**(retro2003).
//
// 작은 전투 무대(논리 240×136 px, 화면 2배 nearest) 위에서 스킬 하나의 연출을 재생한다.
//   배경  battle-scenery/plains 네 장(sky·far·mid·ground)을 한 요소의 겹 배경으로 — 한 장이 없으면 그 장만 빠진다.
//   오른쪽 파티 셋(가운데가 시전자) — 전투 도트 48px 셀 3×8(EXTENDED_POSE_FRAME) + 시전 시트 cast/<id>.png.
//   왼쪽 적 셋 — pixel-enemies 셀 3×3(48·64·96px). 스킬 성격(레이어 키·모션)에 맞춰 retroStageEnemyLineup 이 고른다.
//   레이어 pixel-fx/<key>.png 가로 스트립(frame×frames), anchor 대로 올린다. 404 인 시트는 그 레이어만 생략한다.
//
// 순서·길이는 src/battle/retroSkillTimeline.ts 의 순수 함수가 정한다(런타임과 같은 레시피).
// 이 모듈은 그 타임라인의 시각 t 를 DOM 에 옮기기만 한다.
//
// 타이머 수명(하드룰, databaseSkillAnimationStage 와 같은 규약): 스테이지 루트마다 컨트롤러를 WeakMap 에 두고,
// DOM 소유자가 stopSkillAnimationStagesIn / resumeSkillAnimationStagesIn 을 부르면 여기 범위 헬퍼가 함께 불린다.
// 재생 루프는 requestAnimationFrame 하나이고, 루트가 두 틱 연속 문서에서 떨어져 있으면 스스로 멈춘다.
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { charsetBattler, resolvePartyBattleCharset } from "@/assets/charsetBattlers";
import { PIXEL_ENEMY_FRAME, pixelEnemyCell, pixelEnemySheet, pixelEnemySheetUrl, type PixelEnemyCell } from "@/assets/pixelEnemySheets";
import { RETRO_CLASS_SKILLS, retroClassSkill, type RetroClassSkill, type RetroFxAnchor, type RetroSkillMotion } from "@/assets/retroClassSkills";
import { EXTENDED_POSE_FRAME, castFrame, type CastType, type ExtendedBattlerPose } from "@/battle/battlePose";
import {
  retroClassSkillTimeline,
  retroRecipeTimeline,
  retroSideForScope,
  retroSoundsBetween,
  retroTimelineSounds,
  retroTimelineStateAt,
  type RetroSkillTimeline,
  type RetroStagePlace,
  type RetroStageState,
  type RetroTimelineSide,
} from "@/battle/retroSkillTimeline";
import { RETRO_SKILL_RECIPES, retroSkillRecipe, type RetroSkillRecipe } from "@/player/retroSkillChoreography";
import { loadBattleSample, playBattleSample } from "@/player/battleSeSamples";
import { retroMonsterSkill } from "@/assets/retroMonsterSkills";
import {
  isMonsterSkillId,
  monsterFxUrl,
  renderMonsterSkillStage,
  resumeMonsterSkillStagesIn,
  stopMonsterSkillStagesIn,
} from "@/editor/panels/databaseMonsterSkillStage";
import type { Project, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

const STAGE_W = 240;
const STAGE_H = 136;
const CELL = 48;
/** 반복 사이 쉼(ms). 같은 동작이 이어 붙어 보이지 않게 한다. */
const LOOP_REST_MS = 520;
const SOUND_VOLUME = 0.36;
const SOUND_WAIT_MS = 360;
/** screen 레이어는 무대 한가운데 「크게」 — 논리 1.25배(128 → 160px, 무대 높이 136 을 덮는다). */
const SCREEN_FX_SCALE = 1.25;
const SCENERY = ["ground", "mid", "far", "sky"].map((layer) => withInlineAsset("/assets/generated/battle-scenery/plains/" + layer + ".png"));
/** 기본 DB 배우 → 번들 전투 도트. 프로젝트에 배우가 없거나 시트를 못 찾을 때만 쓴다. */
const FALLBACK_BATTLERS: Readonly<Record<string, string>> = {
  actor_hero: "charset-battler-actor1-0", actor_guardian: "charset-battler-actor2-0", actor_mage: "charset-battler-actor1-5",
  actor_scout: "charset-battler-actor4-0", actor_cleric: "charset-battler-actor1-7", actor_ranger: "charset-battler-actor2-3",
  // 2026-09-28 확장 6명(계약 actorId). 배우 기록이 아직 없거나 칩을 못 찾으면 이 매핑으로 그린다.
  // 사무라이는 actor3-0 칩의 전용 변형 시트다(마도사는 2차 로스터에서 actor1-5 로 옮겼다).
  actor_samurai: "charset-battler-actor3-0-samurai", actor_ninja: "charset-battler-actor3-2", actor_monk: "charset-battler-actor3-5",
  actor_bard: "charset-battler-actor3-6", actor_druid: "charset-battler-actor3-4", actor_witch: "charset-battler-actor4-7",
};
const PARTY_ORDER = [...new Set(RETRO_CLASS_SKILLS.map((skill) => skill.actorId))];

/** 직업 필터 칩. 라벨은 프로젝트 직업 이름이 우선이고 없으면 이 값. */
export const RETRO_SKILL_CLASS_FILTERS: readonly { readonly id: string; readonly label: string }[] = [
  { id: "class_hero", label: "전사" }, { id: "class_guardian", label: "수호자" }, { id: "class_mage", label: "마도사" },
  { id: "class_scout", label: "정찰병" }, { id: "class_cleric", label: "성직자" }, { id: "class_ranger", label: "궁수" },
  { id: "class_samurai", label: "사무라이" }, { id: "class_ninja", label: "닌자" }, { id: "class_monk", label: "무도가" },
  { id: "class_bard", label: "음유시인" }, { id: "class_druid", label: "드루이드" }, { id: "class_witch", label: "마녀" },
];
/** 직업 칩 옆 「몬스터」 칩 id. skill_mon_* 스킬(계약 retroMonsterSkills.ts)을 고른다. */
export const RETRO_MONSTER_FILTER_ID = "monster";

// ---- 적 편 구성 ----

const E = {
  slime: "generated-enemy-slime-01", bat: "generated-enemy-bat-01", golem: "generated-enemy-golem-01", dragon: "generated-enemy-dragon-01",
  archer: "generated-enemy-skeleton-archer", wolf: "generated-enemy-wolf-grey", spider: "generated-enemy-spider-cave",
  wisp: "generated-enemy-wisp-blue", redSlime: "generated-enemy-slime-red", zombie: "generated-enemy-zombie-rot",
  // 2026-09-28 확장(retroMonsterPlan). 시트가 아직 없으면 그 자리만 빈다.
  ghost: "generated-enemy-ghost-pale", lich: "generated-enemy-lich-frost", knight: "generated-enemy-skeleton-knight",
  fireSpirit: "generated-enemy-spirit-fire", waterSpirit: "generated-enemy-spirit-water", ironGolem: "generated-enemy-golem-iron",
  goblin: "generated-enemy-goblin-scout", orc: "generated-enemy-orc-warrior", bandit: "generated-enemy-bandit-mask",
  harpy: "generated-enemy-harpy-cliff", bee: "generated-enemy-bee-giant", mantis: "generated-enemy-mantis-blade",
  snake: "generated-enemy-snake-viper", vampire: "generated-enemy-bat-vampire", eye: "generated-enemy-eye-floating",
  plant: "generated-enemy-plant-carnivore", troll: "generated-enemy-troll-cave", demon: "generated-enemy-demon-lord",
  mimic: "generated-enemy-mimic-chest", lizard: "generated-enemy-lizardman-spear", boar: "generated-enemy-boar-tusk",
} as const;
/** [뒤 위, 앞(한 대상 스킬의 과녁), 뒤 아래]. 앞자리만 큰 적(64·96px)을 쓴다 — 뒤 둘은 48px. */
type Lineup = readonly [string, string, string];
const THEME_LINEUPS: readonly (readonly [RegExp, Lineup])[] = [
  // 성·암흑·저주 → 언데드
  [/holy|smite|judgment|requiem|nightmare|drain|mirror/, [E.ghost, E.knight, E.zombie]],
  [/sabbath|hex|blood|frog/, [E.vampire, E.lich, E.ghost]],
  [/fire|flame|meteor|burst|breath|cauldron|poison/, [E.fireSpirit, E.orc, E.redSlime]],
  [/ice|frost|blizzard|snow|water|splash|lullaby|notes_blue/, [E.waterSpirit, E.lich, E.wisp]],
  [/lightning|bolt|storm|chain|thunder/, [E.bat, E.ironGolem, E.eye]],
  [/thorn|roots|swarm|leaves|tree|moonbeam|bark|regrowth/, [E.bee, E.plant, E.snake]],
  [/bat_swarm|notes|sonic|discord|finale|tempo|hymn/, [E.harpy, E.mimic, E.bat]],
  [/shuriken|kunai|needle|paralyze|clone|knife|arrow|scope/, [E.bandit, E.goblin, E.archer]],
  [/quake|earth|palm|fist|kick|bash|charge|fortress|bear|claw/, [E.goblin, E.boar, E.slime]],
  [/moon|cherry|petals|iai|wind|cross|pierce|rising|slash|flurry|whirl|backstab|venom|shadow/, [E.mantis, E.lizard, E.spider]],
];
const DEFAULT_LINEUP: Lineup = [E.slime, E.wolf, E.bat];

/**
 * 스킬 성격에 맞춘 적 셋. 레이어 키 낱말 → 테마 줄, 필살기는 앞자리를 드래곤으로, 내려찍기는 골렘으로 바꾼다.
 * 결정적이다(같은 스킬은 늘 같은 적). 실제 트룹과는 무관한 미리보기 전용 구성이다.
 */
export function retroStageEnemyLineup(source: { readonly keys: string; readonly motion?: string }): Lineup {
  const found = THEME_LINEUPS.find(([pattern]) => pattern.test(source.keys))?.[1] ?? DEFAULT_LINEUP;
  // 필살기 과녁은 96px 보스급: 암흑·저주 계열은 마왕, 검·대지·무술 계열은 트롤, 그 밖(불·빛·음악·별)은 드래곤.
  if (source.motion === "finisher") {
    const boss = /sabbath|nightmare|blood|requiem|assassin/.test(source.keys) ? E.demon
      : /final_sky|final_slash|fortress|world_tree|tree_hit|dragon_aura|thousand/.test(source.keys) ? E.troll : E.dragon;
    return [found[0], boss, found[2]];
  }
  if (source.motion === "leap-strike") return [found[0], E.golem, found[2]];
  return found;
}

const MOTION_LABELS: Readonly<Record<RetroSkillMotion, string>> = {
  "dash-strike": "파고들어 베기", "leap-strike": "뛰어올라 내려찍기", "blink-strike": "순간이동 베기", flurry: "연속 베기",
  spin: "회전 베기", cast: "제자리 시전", shoot: "제자리 사격", buff: "제자리 강화", finisher: "필살기",
};
const ANCHOR_LABELS: Readonly<Record<RetroFxAnchor, string>> = {
  user: "시전자", target: "대상", allTargets: "대상 전원", allAllies: "아군 전원", screen: "화면", projectile: "투사체",
};

// ---- 레시피 해석 ----

type StageSource = {
  readonly name: string;
  readonly timeline: RetroSkillTimeline;
  readonly actorId: string | undefined;
  /** 레이어 번호 → 시트. */
  readonly sheets: readonly { readonly key: string; readonly url: string; readonly frame: number; readonly frames: number; readonly anchor: RetroFxAnchor }[];
  readonly contract: RetroClassSkill | undefined;
  readonly recipe: RetroSkillRecipe | undefined;
};

function fxUrl(key: string): string {
  return withInlineAsset("/assets/generated/pixel-fx/" + key + ".png");
}

function stageSource(record: SkillRecord, project: Project): StageSource | undefined {
  const side: RetroTimelineSide | undefined = retroSideForScope(record.scope);
  const contract = retroClassSkill(record.id);
  if (contract) {
    // 계약 연출은 계약의 편을 쓴다(레코드 scope 가 계약과 어긋나도 그림은 계약대로 — 어긋남은 스킬 설정의 문제다).
    const timeline = retroClassSkillTimeline(contract);
    return {
      name: record.name || contract.name, timeline, actorId: contract.actorId, contract, recipe: undefined,
      sheets: contract.layers.map((layer) => ({ key: layer.key, url: fxUrl(layer.key), frame: layer.frame, frames: layer.frames, anchor: layer.anchor })),
    };
  }
  const recipe = retroSkillRecipe(record);
  if (!recipe) return undefined;
  const timeline = retroRecipeTimeline(recipe, { side: record.effect.kind === "healing" ? "allies" : side });
  return {
    name: record.name || record.id, timeline, actorId: learnerActorId(record, project), contract: undefined, recipe,
    sheets: [{ key: recipe.fx, url: fxUrl(recipe.fx), frame: 64, frames: 8, anchor: "target" }],
  };
}

/** 이 스킬을 배우는 첫 배우(배우 → 직업 습득표 순). 없으면 기본 주인공. */
function learnerActorId(record: SkillRecord, project: Project): string | undefined {
  const actors = project.database.actors;
  const learns = (list: readonly { readonly skillId: string }[] | undefined): boolean => (list ?? []).some((entry) => entry.skillId === record.id);
  const direct = actors.find((actor) => learns(actor.learnedSkills));
  if (direct) return direct.id;
  const classes = project.database.classes.filter((entry) => learns(entry.learnedSkills) || entry.skillIds.includes(record.id));
  return actors.find((actor) => classes.some((entry) => entry.id === actor.classId))?.id ?? actors[0]?.id;
}

/** 목록 배지·필터용: 전용 도트 연출(계약 또는 런타임 고정 레시피)이 있는가. */
export function retroSkillBadgeSheet(record: Pick<SkillRecord, "id">): { readonly url: string; readonly frame: number; readonly frames: number; readonly cell: number } | undefined {
  const monster = retroMonsterSkill(record.id);
  if (monster) {
    const layer = monster.layers.find((entry) => entry.anchor !== "projectile" && entry.anchor !== "user") ?? monster.layers[0]!;
    return { url: monsterFxUrl(layer.key), frame: layer.frame, frames: layer.frames, cell: Math.floor(layer.frames * 0.4) };
  }
  const contract = retroClassSkill(record.id);
  if (contract) {
    // 첫 칸은 대부분 거의 빈 도입 칸이라, 첫 착탄 레이어의 40% 지점 칸을 쓴다(목록에서 알아볼 수 있게).
    const layer = contract.layers.find((entry) => entry.anchor !== "projectile" && entry.anchor !== "user") ?? contract.layers[0]!;
    return { url: fxUrl(layer.key), frame: layer.frame, frames: layer.frames, cell: Math.floor(layer.frames * 0.4) };
  }
  const recipe = RETRO_SKILL_RECIPES[record.id];
  return recipe ? { url: fxUrl(recipe.fx), frame: 64, frames: 8, cell: 3 } : undefined;
}

/** 목록 행 옆 작은 도트 배지. 연출이 없으면 null. */
export function retroSkillListBadge(record: Pick<SkillRecord, "id">, size = 20): HTMLElement | null {
  const sheet = retroSkillBadgeSheet(record);
  if (!sheet) return null;
  const badge = el("span", { class: "db-skill-retro-badge", attrs: { role: "img", "aria-label": "도트 연출" }, dataset: { testid: "db-skill-retro-badge" } });
  badge.style.backgroundImage = 'url("' + sheet.url + '")';
  badge.style.backgroundSize = sheet.frames * size + "px " + size + "px";
  badge.style.backgroundPosition = -sheet.cell * size + "px 0";
  badge.style.width = size + "px";
  badge.style.height = size + "px";
  return badge;
}

/** 직업 필터 판정: 계약 직업이거나, 프로젝트 직업의 습득표·스킬 목록에 있다. */
export function skillMatchesRetroClass(record: Pick<SkillRecord, "id">, classId: string, project: Project): boolean {
  if (classId === RETRO_MONSTER_FILTER_ID) return isMonsterSkillId(record.id);
  if (retroClassSkill(record.id)?.classId === classId) return true;
  const found = project.database.classes.find((entry) => entry.id === classId);
  return Boolean(found && (found.skillIds.includes(record.id) || found.learnedSkills.some((entry) => entry.skillId === record.id)));
}

/** 직업 필터 칩 목록. 프로젝트에 그 직업도 계약 스킬도 없으면 빈 배열(칩 줄을 그리지 않는다). */
export function retroSkillClassFilters(project: Project): readonly { readonly id: string; readonly label: string }[] {
  const skills = project.database.skills;
  const classes = RETRO_SKILL_CLASS_FILTERS.flatMap((entry) => {
    const record = project.database.classes.find((candidate) => candidate.id === entry.id);
    const hasContract = skills.some((skill) => retroClassSkill(skill.id)?.classId === entry.id);
    return record || hasContract ? [{ id: entry.id, label: record?.name || entry.label }] : [];
  });
  // 몬스터 칩은 늘 보인다 — 레코드(skill_mon_*)가 아직 없으면 빈 칩(0개)이고, 고르면 계약 둘러보기가 뜬다.
  return classes.length > 0 || skills.some((skill) => isMonsterSkillId(skill.id))
    ? [...classes, { id: RETRO_MONSTER_FILTER_ID, label: "몬스터" }]
    : classes;
}

// 스킬 목록 직업 필터 — 편집 세션 동안만 기억한다(아이템·장비 필터의 localStorage 계약과 섞지 않는다).
let skillClassFilter = "all";

export function skillClassFilterFor(project: Project): string {
  return skillClassFilter !== "all" && retroSkillClassFilters(project).some((entry) => entry.id === skillClassFilter) ? skillClassFilter : "all";
}

export function setSkillClassFilter(id: string): void {
  skillClassFilter = id || "all";
}

// ---- 시트 적재(404 허용) ----

const sheetState = new Map<string, "ok" | "missing">();
const sheetWaiters = new Map<string, Promise<boolean>>();

function probeSheet(url: string): Promise<boolean> {
  const known = sheetState.get(url);
  if (known === "ok") return Promise.resolve(true);
  const pending = sheetWaiters.get(url);
  if (pending) return pending;
  if (typeof Image !== "function") return Promise.resolve(true);
  const task = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => { sheetState.set(url, "ok"); resolve(true); };
    // 없는 시트는 기억하되 다음 스테이지에서 다시 확인한다(다른 에이전트가 그리는 중일 수 있다).
    image.onerror = () => { sheetState.set(url, "missing"); resolve(false); };
    image.src = url;
  }).finally(() => sheetWaiters.delete(url));
  sheetWaiters.set(url, task);
  return task;
}

// ---- 무대 좌표 ----

type Point = { readonly x: number; readonly y: number };
type Actor = { readonly node: HTMLElement; sheet: string; cast?: string; castOk: boolean; readonly home: Point };
type Enemy = { readonly node: HTMLElement; readonly home: Point; readonly cell: number; readonly idleMs: number };

/** 발 위치(논리 px). 파티는 오른쪽 사선 계단, 가운데가 시전자. 적은 왼쪽 삼각형. */
const PARTY_HOMES: readonly Point[] = [{ x: 176, y: 90 }, { x: 196, y: 106 }, { x: 216, y: 122 }];
/**
 * 적 발 위치. 앞자리(1번)가 크면(64·96px) 앞으로·아래로 조금 내리고 뒤 둘을 왼쪽으로 민다 —
 * 96px 드래곤은 x 50~146 을 차지하고 뒤 둘(0~48)과 겹치지 않는다. 파티(152~)와도 떨어진다.
 */
function enemyHomes(frontCell: number): readonly Point[] {
  const grow = Math.max(0, frontCell - CELL);
  // 뒤 둘은 48px 상자가 무대 왼쪽(0) 밖으로 나가지 않게 x ≥ 24 로 붙든다.
  const backX = Math.max(28, 48 - grow / 2);
  return [{ x: backX, y: 92 }, { x: 86 + grow / 4, y: 108 + grow / 8 }, { x: backX - 4, y: 124 }];
}
/** 한 대상 스킬이 겨누는 적(가장 앞, 시전자에 가까운 쪽). */
const FRONT_ENEMY = 1;
const FRONT_ALLY = 0;

type BattlerSheet = { readonly sheet: string; readonly cast?: string; readonly fallback?: BattlerSheet };

/** 번들 전투 도트 id → 시트·시전 시트 경로. 카탈로그(CHARSET_BATTLERS)에 아직 없는 변형 id 는 규칙대로 경로를 조립한다. */
function battlerPaths(resourceId: string, project: Project): { readonly sheet: string; readonly cast: string } | undefined {
  const entry = charsetBattler(resourceId);
  const match = /^charset-battler-(actor[1-4]-[0-7](?:-[a-z0-9]+)?)$/.exec(resourceId);
  const path = entry?.path ?? (match ? "assets/generated/charset-battlers/" + match[1] + ".png" : undefined);
  const castPath = entry?.castPath ?? (match ? "assets/generated/charset-battlers/cast/" + match[1] + ".png" : undefined);
  if (!path || !castPath) return undefined;
  return {
    sheet: resolveAssetResourceUrl(resourceId, { project }) ?? withInlineAsset("/" + path),
    cast: resolveAssetResourceUrl(resourceId + "-cast", { project }) ?? withInlineAsset("/" + castPath),
  };
}

function battlerSheet(actorId: string | undefined, project: Project): BattlerSheet {
  const actor = actorId ? project.database.actors.find((entry) => entry.id === actorId) : undefined;
  const resolved = actor ? resolvePartyBattleCharset(actor, true) : undefined;
  const fallbackId = FALLBACK_BATTLERS[actorId ?? ""] ?? FALLBACK_BATTLERS.actor_hero!;
  // 배우 기록이 있으면 그 시트, 없으면 계약 매핑. 조립한 변형 경로(…-samurai)가 404 면 밑바탕 칩(actor3-0)으로 한 번 더 물러난다.
  const primary = (resolved ? battlerPaths(resolved, project) : undefined) ?? battlerPaths(fallbackId, project);
  if (!primary) return { sheet: "" };
  const base = /^(charset-battler-actor[1-4]-[0-7])-[a-z0-9]+$/.exec(resolved && battlerPaths(resolved, project) ? resolved : fallbackId)?.[1];
  const fallback = base ? battlerPaths(base, project) : undefined;
  return fallback ? { ...primary, fallback } : primary;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// ---- 스테이지 ----

type RetroStageController = { readonly stop: () => void; readonly resume: () => void; readonly canAutoplay: boolean };
const controllers = new WeakMap<HTMLElement, RetroStageController>();
let sessionSpeed: 0.5 | 1 = 1;
let sessionRepeat = true;

export type SkillRetroStage = { readonly element: HTMLElement; readonly stop: () => void };

/** 이 스킬의 도트 전투 미리보기. 연출이 없으면 null. */
export function renderSkillRetroStage(record: SkillRecord, project: Project): SkillRetroStage | null {
  // 몬스터 스킬은 무대 방향이 반대다(몬스터 왼쪽 시전 → 아군 오른쪽 대상). 레코드가 없어도 계약만으로 돈다.
  const monster = retroMonsterSkill(record.id);
  if (monster) return renderMonsterSkillStage(monster, record.name);
  const source = stageSource(record, project);
  if (!source) return null;
  const { timeline } = source;
  const side = timeline.side;

  const world = el("div", { class: "db-skill-retro-world", attrs: { "aria-hidden": "true" } });
  world.style.width = STAGE_W + "px";
  world.style.height = STAGE_H + "px";
  const scenery = el("div", { class: "db-skill-retro-scenery" });
  scenery.style.backgroundImage = SCENERY.map((url) => 'url("' + url + '")').join(", ");
  const dimVeil = el("div", { class: "db-skill-retro-dim" });
  const cast = el("div", { class: "db-skill-retro-cast" });
  const fxLayer = el("div", { class: "db-skill-retro-fx-layer" });
  const cutin = el("div", { class: "db-skill-retro-cutin", children: [
    el("span", { class: "db-skill-retro-cutin-lines" }),
    el("span", { class: "db-skill-retro-cutin-portrait" }),
    el("span", { class: "db-skill-retro-cutin-name notranslate", attrs: { translate: "no" }, text: source.name }),
  ] });
  const flashVeil = el("div", { class: "db-skill-retro-flash" });
  const popLayer = el("div", { class: "db-skill-retro-pop-layer" });
  world.append(scenery, dimVeil, cast, fxLayer, popLayer, cutin, flashVeil);

  // 파티: 가운데 칸이 시전자. 양옆은 계약 순서에서 시전자 다음 두 배우(사무라이 → 닌자·무도가). 같은 세대끼리 선다.
  let portraitRefresh: (() => void) | undefined;
  const casterAt = Math.max(0, PARTY_ORDER.indexOf(source.actorId ?? ""));
  const others = [1, 2].map((step) => PARTY_ORDER[(casterAt + step) % PARTY_ORDER.length]).filter((id) => id !== source.actorId);
  const partyIds = [others[0], source.actorId, others[1]];
  const party: Actor[] = partyIds.map((actorId, index) => {
    const sheets = battlerSheet(actorId, project);
    const node = el("span", { class: "db-skill-retro-battler", dataset: { role: index === 1 ? "caster" : "ally", actor: actorId ?? "" } });
    node.style.backgroundImage = sheets.sheet ? 'url("' + sheets.sheet + '")' : "none";
    const member: Actor = { node, sheet: sheets.sheet, cast: sheets.cast, castOk: false, home: PARTY_HOMES[index]! };
    const fallback = sheets.fallback;
    if (fallback && sheets.sheet) {
      void probeSheet(sheets.sheet).then((ok) => {
        if (ok) return;
        // 변형 시트가 아직 없다 — 밑바탕 칩 시트로 바꿔 그린다(시전 시트도 같이).
        member.sheet = fallback.sheet;
        member.cast = fallback.cast;
        node.style.backgroundImage = 'url("' + fallback.sheet + '")';
        if (member.node.dataset.role === "caster" && member.cast) void probeSheet(member.cast).then((castOk) => { member.castOk = castOk; });
        portraitRefresh?.();
      });
    }
    return member;
  });
  const caster = party[1]!;
  // 변형 시트 폴백이 그 사이 cast 를 바꿨으면 늦게 온 옛 결과는 버린다.
  const firstCast = caster.cast;
  if (firstCast) void probeSheet(firstCast).then((ok) => { if (caster.cast === firstCast) caster.castOk = ok; });
  const lineup = retroStageEnemyLineup({
    keys: source.sheets.map((sheet) => sheet.key).join(" ") + " " + (source.recipe?.fx ?? ""),
    motion: source.contract?.motion,
  });
  const lineupSheets = lineup.map((resourceId) => pixelEnemySheet(resourceId));
  const homes = enemyHomes(lineupSheets[FRONT_ENEMY] ? pixelEnemyCell(lineupSheets[FRONT_ENEMY]!) : CELL);
  const enemies: Enemy[] = lineupSheets.map((entry, index) => {
    const cell = entry ? pixelEnemyCell(entry) : CELL;
    const node = el("span", { class: "db-skill-retro-enemy", dataset: { enemy: entry?.resourceId ?? "" } });
    node.style.width = cell + "px";
    node.style.height = cell + "px";
    node.style.backgroundSize = cell * 3 + "px " + cell * 3 + "px";
    if (entry) {
      const url = pixelEnemySheetUrl(entry);
      node.style.backgroundImage = 'url("' + url + '")';
      // 없는 시트(404)는 그 적만 조용히 빼고 무대는 그대로 돈다.
      void probeSheet(url).then((ok) => { if (!ok) node.hidden = true; });
    } else node.hidden = true;
    return { node, home: homes[index]!, cell, idleMs: entry?.idleFrameMs ?? 220 };
  });
  const stageEnemyIds = lineup.join(",");
  // 발 y 순으로 쌓아 앞사람이 뒷사람을 가린다.
  [...enemies.map((entry) => ({ y: entry.home.y, node: entry.node })), ...party.map((entry) => ({ y: entry.home.y, node: entry.node }))]
    .sort((a, b) => a.y - b.y).forEach((entry, index) => { entry.node.style.zIndex = String(10 + index); cast.append(entry.node); });
  const portrait = cutin.querySelector<HTMLElement>(".db-skill-retro-cutin-portrait")!;
  portraitRefresh = () => { if (caster.sheet) portrait.style.backgroundImage = 'url("' + caster.sheet + '")'; };
  portraitRefresh();
  placeCell(portrait, EXTENDED_POSE_FRAME.skill, CELL);

  const missing = new Set<string>();
  for (const sheet of source.sheets) {
    void probeSheet(sheet.url).then((ok) => {
      if (ok) return;
      missing.add(sheet.key);
      layerChips.get(sheet.key)?.classList.add("is-missing");
      layerChips.get(sheet.key)?.setAttribute("data-missing", "true");
      draw();
    });
  }

  const stage = el("div", {
    class: "db-skill-retro-stage",
    dataset: { testid: "db-skill-retro-stage", side, running: "false", motion: source.contract?.motion ?? source.recipe?.approach ?? "", enemies: stageEnemyIds, actor: source.actorId ?? "" },
    attrs: { role: "img", "aria-label": `${source.name} 도트 전투 미리보기` },
    children: [world],
  });

  const targetsOf = (): readonly Point[] => {
    if (side === "enemies") return enemies.map((entry) => entry.home);
    if (side === "self") return [caster.home];
    return party.map((entry) => entry.home);
  };
  const singleTarget = (): Point => side === "enemies" ? enemies[FRONT_ENEMY]!.home : side === "self" ? caster.home : party[FRONT_ALLY]!.home;
  const placePoint = (place: RetroStagePlace): Point => {
    const front = side === "enemies" ? enemies[FRONT_ENEMY]!.home : singleTarget();
    // 큰 적 앞에 설 때는 그 몸 폭만큼 더 떨어져 선다(48px 적 = +38).
    const reach = side === "enemies" ? enemies[FRONT_ENEMY]!.cell / 2 + 14 : 38;
    switch (place) {
      case "home": return caster.home;
      case "front": return side === "enemies" ? { x: front.x + reach, y: front.y } : { x: front.x - 26, y: front.y };
      case "center": return { x: 70, y: 118 };
      case "above": return { x: front.x + reach + 6, y: front.y - 62 };
    }
  };

  // ---- 한 시각을 그린다 ----
  const fxNodes = new Map<number, HTMLElement>();
  let now = 0;
  let clock = 0;
  const fxNode = (id: number): HTMLElement => {
    let node = fxNodes.get(id);
    if (!node) { node = el("span", { class: "db-skill-retro-fx" }); fxLayer.append(node); fxNodes.set(id, node); }
    return node;
  };
  const sheetFor = (layer: number) => source.sheets[layer] ?? source.sheets[0]!;
  const drawFx = (id: number, layer: number, cell: number, center: Point, bottom: boolean, used: Set<number>, scale = 1): void => {
    const sheet = sheetFor(layer);
    if (missing.has(sheet.key)) return;
    const node = fxNode(id);
    used.add(id);
    // 칸 폭은 계약의 frame 값 그대로(32·64·128). 64 고정 가정 금지.
    const size = sheet.frame * scale;
    node.style.width = size + "px";
    node.style.height = size + "px";
    node.style.backgroundImage = 'url("' + sheet.url + '")';
    node.style.backgroundSize = size * sheet.frames + "px " + size + "px";
    node.style.backgroundPosition = -cell * size + "px 0";
    node.style.left = Math.round(center.x - size / 2) + "px";
    node.style.top = Math.round(bottom ? center.y - size : center.y - size / 2) + "px";
    node.dataset.key = sheet.key;
    node.dataset.cell = String(cell);
    node.dataset.anchor = sheet.anchor;
  };

  function draw(): void {
    const state = retroTimelineStateAt(timeline, now);
    const shakeX = state.shake.x, shakeY = state.shake.y;
    world.style.setProperty("--retro-shake-x", shakeX + "px");
    world.style.setProperty("--retro-shake-y", shakeY + "px");
    dimVeil.style.opacity = String(Math.round(state.dim * 72) / 100);
    flashVeil.style.opacity = String(Math.round(state.flash * 80) / 100);
    drawCutin(state);
    drawCaster(state);
    drawOthers(state);
    const used = new Set<number>();
    const targets = targetsOf();
    for (const fx of state.fx) {
      const size = sheetFor(fx.layer).frame;
      // 바닥에 닿는 시트(대상·아군)는 발 아래 6px 에 바닥을 맞춘다. 128px 대상 시트(파산장·용권 멸살 착탄)는
      // 칸 대부분을 채우므로 발 아래 24px 까지 내려 대상 몸 가운데에 폭심이 오게 한다(10px 이면 무대 위로 잘렸다).
      const footPad = size >= 128 ? (fx.anchor === "target" ? 24 : 10) : 6;
      if (fx.anchor === "screen") drawFx(fx.event * 10, fx.layer, fx.cell, { x: STAGE_W / 2, y: STAGE_H / 2 }, false, used, SCREEN_FX_SCALE);
      else if (fx.anchor === "user") drawFx(fx.event * 10, fx.layer, fx.cell, feet(casterPoint(state), footPad), true, used);
      else if (fx.anchor === "target") drawFx(fx.event * 10, fx.layer, fx.cell, feet(singleTarget(), footPad), true, used);
      else {
        const group = fx.anchor === "allAllies" ? party.map((entry) => entry.home) : targets;
        group.forEach((point, index) => drawFx(fx.event * 10 + index + 1, fx.layer, fx.cell, feet(point, footPad), true, used));
      }
    }
    for (const shot of state.projectiles) {
      const from = shot.path === "fall" ? null : { x: casterPoint(state).x - 20, y: casterPoint(state).y - 28 };
      const aimed = shot.aim < 0 ? centroid(targets) : targets[shot.aim % targets.length] ?? singleTarget();
      const to = { x: aimed.x, y: aimed.y - 22 };
      let point: Point;
      if (shot.path === "trail") point = { x: casterPoint(state).x, y: casterPoint(state).y - 24 };
      else if (shot.path === "fall") point = { x: lerp(to.x + 46, to.x, shot.progress), y: lerp(-20, to.y, shot.progress) };
      else point = { x: lerp(from!.x, to.x, shot.progress), y: lerp(from!.y, to.y, shot.progress) - 14 * 4 * shot.progress * (1 - shot.progress) };
      drawFx(shot.event * 10 + 9, shot.layer, shot.cell, point, false, used);
    }
    for (const [id, node] of fxNodes) node.hidden = !used.has(id);
    drawPops(state);
    stage.dataset.retroTime = String(Math.round(now));
    stage.dataset.retroPose = state.pose;
    counter.textContent = `${seconds(now)} / ${seconds(timeline.durationMs)}초`;
  }

  const feet = (point: Point, pad: number): Point => ({ x: point.x, y: point.y + pad });
  const centroid = (points: readonly Point[]): Point => ({ x: points.reduce((sum, p) => sum + p.x, 0) / Math.max(1, points.length), y: points.reduce((sum, p) => sum + p.y, 0) / Math.max(1, points.length) });
  const casterPoint = (state: RetroStageState): Point => {
    const from = placePoint(state.move.from), to = placePoint(state.move.to), p = state.move.progress;
    return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) + state.move.arc * 4 * p * (1 - p) };
  };
  const castStep = (pose: ExtendedBattlerPose): 1 | 2 | 3 | 0 => pose === "cast_charge" ? 1 : pose === "cast_raise" ? 2 : pose === "cast_release" ? 3 : 0;

  function drawCaster(state: RetroStageState): void {
    const point = casterPoint(state);
    const node = caster.node;
    const step = castStep(state.pose);
    if (step && caster.castOk && caster.cast) {
      node.style.backgroundImage = 'url("' + caster.cast + '")';
      node.style.backgroundSize = "144px 336px";
      placeCell(node, castFrame(timeline.castType as CastType, step), CELL);
    } else {
      node.style.backgroundImage = caster.sheet ? 'url("' + caster.sheet + '")' : "none";
      node.style.backgroundSize = "144px 384px";
      placeCell(node, EXTENDED_POSE_FRAME[state.pose], CELL);
    }
    placeSprite(node, point, CELL, 45);
    node.style.zIndex = state.move.to === "home" && state.move.progress >= 1 ? node.style.zIndex : "40";
    node.classList.toggle("is-hidden", state.hidden);
    node.classList.toggle("is-flipped", state.flip);
    const selfHit = side === "self" ? Math.max(state.hitTarget, state.hitAll) : side === "allies" ? state.hitAll : 0;
    node.style.setProperty("--retro-glow", String(Math.round(selfHit * 100) / 100));
  }

  function drawOthers(state: RetroStageState): void {
    const idleCells: readonly PixelEnemyCell[] = ["idle_a", "idle_b", "idle_c", "idle_b"];
    enemies.forEach((enemy, index) => {
      const struck = side === "enemies" ? Math.max(state.hitAll, index === FRONT_ENEMY ? state.hitTarget : 0) : 0;
      // 종마다 시트 계약의 대기 한 칸 길이로 돈다(박쥐 110ms · 골렘 300ms …).
      const idle = idleCells[Math.floor(clock / enemy.idleMs) % 4]!;
      placeCell(enemy.node, PIXEL_ENEMY_FRAME[struck > 0.3 ? "hit" : idle], enemy.cell);
      const knock = struck > 0 ? Math.round(-5 * struck) + (Math.floor(clock / 40) % 2 === 0 ? 1 : -1) : 0;
      // 시트 계약: 바닥 기준선 y = cell − 4.
      placeSprite(enemy.node, { x: enemy.home.x + knock, y: enemy.home.y }, enemy.cell, enemy.cell - 4);
      enemy.node.style.setProperty("--retro-hit", String(Math.round(struck * 100) / 100));
      enemy.node.style.setProperty("--retro-dim", String(Math.round(state.dim * 100) / 100));
    });
    party.forEach((member, index) => {
      if (member === caster) return;
      const blessed = side === "allies" ? Math.max(state.hitAll, index === FRONT_ALLY ? state.hitTarget : 0) : 0;
      placeCell(member.node, EXTENDED_POSE_FRAME[blessed > 0.2 ? "skill" : "idle"], CELL);
      placeSprite(member.node, member.home, CELL, 45);
      member.node.style.setProperty("--retro-glow", String(Math.round(blessed * 100) / 100));
      member.node.style.setProperty("--retro-dim", String(Math.round(state.dim * 100) / 100));
    });
  }

  // 피해·회복 숫자(미리보기 표시 전용 — 실제 계산은 전투 규칙 엔진이 한다). 위력 값으로 크기만 가늠하게 한다.
  const pops: HTMLElement[] = [];
  // 숫자는 피해(적 편) · 회복(아군 편) 스킬에만 띄운다. 강화·방어막 같은 지원 스킬은 빛만 난다.
  const healing = record.effect.kind === "healing";
  const showPops = side === "enemies" ? record.effect.kind === "damage" : healing;
  const popValue = (index: number): string => String(Math.max(1, Math.round(Math.max(record.power, 20) * (1 + ((index * 37) % 11) / 40))));
  function drawPops(state: RetroStageState): void {
    const points = side === "enemies" ? enemies.map((entry) => entry.home) : side === "self" ? [caster.home] : party.map((entry) => entry.home);
    const single = side === "enemies" ? FRONT_ENEMY : 0;
    points.forEach((point, index) => {
      let node = pops[index];
      if (!node) { node = el("span", { class: "db-skill-retro-pop" + (healing ? " is-heal" : "") }); popLayer.append(node); pops[index] = node; }
      const strength = Math.max(state.hitAll, index === single ? state.hitTarget : 0);
      node.hidden = !showPops || strength <= 0.02;
      if (node.hidden) return;
      node.textContent = popValue(index);
      const rise = Math.round((1 - strength) * 14);
      // 겹치지 않게 번호마다 6px 씩 엇갈리게 띄운다.
      const tall = side === "enemies" ? Math.max(0, (enemies[index]?.cell ?? CELL) - CELL) : 0;
      node.style.top = point.y - 52 - tall - rise - index * 2 + "px";
      // 무대 왼쪽 끝(뒤줄 적) 숫자가 잘리지 않게 4px 안쪽으로 붙든다.
      node.style.left = Math.max(4, point.x + (index % 2 === 0 ? -6 : 6)) + "px";
      node.style.opacity = String(Math.min(1, strength * 3));
    });
  }

  function drawCutin(state: RetroStageState): void {
    const p = state.cutin;
    cutin.hidden = p < 0;
    if (p < 0) return;
    const open = p < 0.14 ? p / 0.14 : p > 0.86 ? (1 - p) / 0.14 : 1;
    cutin.style.setProperty("--retro-cutin-open", String(Math.round(open * 100) / 100));
    cutin.style.setProperty("--retro-cutin-x", Math.round(lerp(40, -18, p)) + "px");
    cutin.style.setProperty("--retro-cutin-lines", Math.round(-p * 240) + "px");
  }

  // ---- 재생 제어 ----
  const counter = el("span", { class: "db-skill-animation-chip db-skill-retro-time", dataset: { testid: "db-skill-retro-time" } });
  const playButton = el("button", { class: "db-skill-animation-toggle db-skill-retro-play", dataset: { testid: "db-skill-retro-play" }, attrs: { type: "button", "aria-pressed": "false" }, text: "▶ 재생" });
  const repeatButton = el("button", { class: "db-skill-retro-option", dataset: { testid: "db-skill-retro-repeat" }, attrs: { type: "button", "aria-pressed": String(sessionRepeat) }, text: "반복" });
  const speedButtons = ([0.5, 1] as const).map((speed) => el("button", {
    class: "db-skill-retro-option", dataset: { testid: "db-skill-retro-speed-" + speed }, attrs: { type: "button", "aria-pressed": String(sessionSpeed === speed) }, text: speed + "×",
  }));
  const speedGroup = el("div", { class: "db-skill-retro-segment", attrs: { role: "group", "aria-label": "재생 속도" }, children: speedButtons });

  const layerChips = new Map<string, HTMLElement>();
  const chips = el("div", { class: "db-skill-retro-layers", attrs: { "aria-label": "연출 레이어" } });
  const seenKeys = new Set<string>();
  for (const sheet of source.sheets) {
    if (seenKeys.has(sheet.key)) continue;
    seenKeys.add(sheet.key);
    const chip = el("span", { class: "db-skill-retro-layer", dataset: { testid: "db-skill-retro-layer", key: sheet.key }, children: [
      el("img", { class: "db-skill-retro-layer-thumb", attrs: { src: sheet.url, alt: "", width: "16", height: "16" } }),
      el("code", { class: "db-skill-retro-layer-key", text: sheet.key }),
      el("span", { class: "db-skill-retro-layer-anchor", text: ANCHOR_LABELS[sheet.anchor] }),
      el("span", { class: "db-skill-retro-layer-size", text: `${sheet.frame}px × ${sheet.frames}칸` }),
      el("span", { class: "db-skill-retro-layer-missing", text: "그림 없음" }),
    ] });
    const thumb = chip.querySelector("img");
    thumb?.addEventListener("error", () => chip.classList.add("is-missing"), { once: true });
    layerChips.set(sheet.key, chip);
    chips.append(chip);
  }
  const motionLabel = source.contract ? MOTION_LABELS[source.contract.motion] : "속성·이름으로 고른 기본 연출";
  const caption = el("div", { class: "db-skill-retro-caption", children: [
    el("span", { class: "db-skill-retro-badge-inline", text: "도트 연출" }),
    el("span", { class: "db-skill-animation-chip", dataset: { testid: "db-skill-retro-motion" }, text: motionLabel }),
    ...(source.contract ? [el("span", { class: "db-skill-animation-chip", text: "Lv " + source.contract.level })] : []),
  ] });
  const controls = el("div", { class: "db-skill-retro-controls", children: [playButton, repeatButton, speedGroup, counter] });
  const wrap = el("div", { class: "db-skill-retro-preview", dataset: { testid: "db-skill-retro-preview" }, children: [caption, stage, controls, chips] });
  // 무대 폭에 맞춰 배율을 정한다. 기본 2배(480px), 카드가 좁으면 줄인다 — 도트는 nearest 라 흐려지지 않는다.
  if (typeof ResizeObserver === "function") {
    new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) world.style.setProperty("--retro-stage-scale", String(Math.round((width / STAGE_W) * 1000) / 1000));
    }).observe(stage);
  }

  let frame: number | null = null;
  let last = 0;
  let detachedTicks = 0;
  let withSound = false;
  let userPlay = false;
  let soundToken = 0;
  let restUntil = -1;
  const canAutoplay = autoplayAllowed();

  const setRunning = (running: boolean): void => {
    // 자동 반복(무음)은 배경 재생이다 — 버튼은 「▶ 재생」 그대로 두고, 누르면 처음부터 소리와 함께 다시 튼다.
    const userPlaying = running && userPlay;
    playButton.textContent = userPlaying ? "■ 정지" : "▶ 재생";
    playButton.setAttribute("aria-pressed", String(userPlaying));
    stage.dataset.running = String(running);
    stage.dataset.userPlay = String(userPlaying);
  };
  const stop = (): void => {
    soundToken += 1;
    userPlay = false;
    if (frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    frame = null;
    withSound = false;
    setRunning(false);
  };
  const tick = (stamp: number): void => {
    frame = null;
    if (!stage.isConnected) {
      // 탭 캐시 재부착 전 한두 틱은 봐주고, 그 뒤엔 확정적으로 끊는다(커밋 2ed96476 의 2틱 상한).
      detachedTicks += 1;
      if (detachedTicks >= 2) { stop(); return; }
    } else detachedTicks = 0;
    const dt = Math.min(64, Math.max(0, stamp - (last || stamp)));
    last = stamp;
    clock += dt;
    if (restUntil >= 0) {
      if (clock < restUntil) { draw(); schedule(); return; }
      restUntil = -1;
      now = 0;
    }
    const before = now;
    now = Math.min(timeline.durationMs, now + dt * sessionSpeed);
    if (withSound) for (const id of retroSoundsBetween(timeline, before, now)) playBattleSample(id, SOUND_VOLUME);
    draw();
    if (now >= timeline.durationMs) {
      // 소리는 사용자가 누른 회차에만 — 반복 회차는 무음이다.
      withSound = false;
      if (!sessionRepeat) { stop(); return; }
      restUntil = clock + LOOP_REST_MS;
    }
    schedule();
  };
  const schedule = (): void => {
    if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(tick);
  };
  const start = (sound: boolean): void => {
    stop();
    userPlay = sound;
    now = 0;
    restUntil = -1;
    last = 0;
    detachedTicks = 0;
    setRunning(true);
    draw();
    if (!sound) { withSound = false; schedule(); return; }
    // 효과음을 먼저 디코드한다(최대 360ms). 기다리는 동안 첫 칸에 서 있는다.
    const token = ++soundToken;
    const sounds = retroTimelineSounds(timeline);
    const ready = Promise.all(sounds.map((id) => loadBattleSample(id)));
    const wait = new Promise<void>((resolve) => { setTimeout(resolve, SOUND_WAIT_MS); });
    void Promise.race([ready, wait]).then(() => {
      if (token !== soundToken || !stage.isConnected) return;
      withSound = true;
      // 0ms 사건(시작 효과음)도 울리게 한 칸 앞에서 시작한다.
      for (const id of retroSoundsBetween(timeline, -1, 0)) playBattleSample(id, SOUND_VOLUME);
      schedule();
    });
  };

  playButton.addEventListener("click", () => {
    if (userPlay && stage.dataset.running === "true") { stop(); return; }
    start(true);
  });
  repeatButton.addEventListener("click", () => {
    sessionRepeat = !sessionRepeat;
    repeatButton.setAttribute("aria-pressed", String(sessionRepeat));
  });
  speedButtons.forEach((button, index) => button.addEventListener("click", () => {
    sessionSpeed = index === 0 ? 0.5 : 1;
    speedButtons.forEach((other, otherIndex) => other.setAttribute("aria-pressed", String(otherIndex === index)));
  }));

  controllers.set(stage, {
    stop,
    resume: () => { if (canAutoplay && frame === null) start(false); },
    canAutoplay,
  });

  if (canAutoplay) {
    draw();
    start(false);
  } else {
    // 감속 모드·타이머 없는 호스트: 대표 칸에 선다. ▶ 재생으로만 움직인다.
    now = timeline.representativeMs;
    draw();
  }
  return { element: wrap, stop };
}

function placeCell(node: HTMLElement, cell: { readonly col: number; readonly row: number }, size: number): void {
  node.style.backgroundPosition = -cell.col * size + "px " + -cell.row * size + "px";
}

/** 셀 상자를 발 위치에 맞춘다. footRow = 셀 안의 발 줄(px). */
function placeSprite(node: HTMLElement, feet: Point, size: number, footRow: number): void {
  node.style.left = Math.round(feet.x - size / 2) + "px";
  node.style.top = Math.round(feet.y - footRow) + "px";
}

function seconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

function autoplayAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

/** scope 안의 도트 스테이지 루프를 모두 멈춘다. stopSkillAnimationStagesIn 이 함께 부른다. */
export function stopRetroSkillStagesIn(scope: ParentNode): void {
  for (const stage of scope.querySelectorAll<HTMLElement>("[data-testid='db-skill-retro-stage']")) controllers.get(stage)?.stop();
  stopMonsterSkillStagesIn(scope);
}

/** 캐시에서 다시 붙은 스테이지를 자동 반복으로 되돌린다. resumeSkillAnimationStagesIn 이 함께 부른다. */
export function resumeRetroSkillStagesIn(scope: ParentNode): void {
  for (const stage of scope.querySelectorAll<HTMLElement>("[data-testid='db-skill-retro-stage']")) {
    const controller = controllers.get(stage);
    if (controller?.canAutoplay) controller.resume();
  }
  resumeMonsterSkillStagesIn(scope);
}

/** 스킬 설정이 바뀌어 스테이지를 다시 그려야 하는지 가르는 서명. */
export function retroStageSignature(record: SkillRecord): string {
  if (retroMonsterSkill(record.id)) return ["mon", record.id, record.name].join("|");
  const recipe = retroClassSkill(record.id) ? record.id : retroSkillRecipe(record);
  const key = typeof recipe === "string" ? recipe : recipe ? recipe.fx + ":" + recipe.approach : "";
  return [key, record.scope, record.name, record.effect.kind].join("|");
}

