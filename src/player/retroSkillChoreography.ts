import type { CastType, ExtendedBattlerPose } from "@/battle/battlePose";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { SkillRecord } from "@/project/types";
import type { RetroClassSkill } from "@/assets/retroClassSkills";
import { RETRO_ALL_CLASS_SKILLS, RETRO_ALL_FX_SHEETS, resolveRetroClassChoreography, resolveSkillChoreography, retroClassSkill } from "@/assets/retroSkillCatalog";
import { RETRO_MONSTER_FX_SHEETS, RETRO_MONSTER_SKILLS } from "@/assets/retroMonsterSkills";
import type { RetroMonsterSkill } from "@/assets/retroMonsterSkills";
import type { RetroFxLayer } from "@/assets/retroClassSkills";
import {
  retroClassSkillTimeline, retroMonsterCellForPose, retroMonsterSide, retroPartyPixelCellForPose, retroMonsterSkillTimeline, retroSideForScope, retroTimelineSounds, retroTimelineStateAt,
  type RetroSkillTimeline, type RetroStagePlace, type RetroTimelineEvent, type RetroTimelineSide,
} from "@/battle/retroSkillTimeline";
import { recommendRetroChoreography } from "@/assets/retroChoreographyRecommend";
import { applyChoreographyHandles } from "@/battle/retroChoreographyHandles";
import { store } from "@/project/store";
import type { BattleActionBeat } from "@/player/battleActionBeats";
import { scheduleBattleTimer } from "@/player/battleTimerScope";
import { playBattleSample, preloadBattleSamples } from "@/player/battleSeSamples";
import { partyPixelBackgroundPosition, partyPixelSheet, partyPixelSheetUrl } from "@/assets/partyPixelSheets";
import type { PartyPixelCell } from "@/assets/pixelEnemySheets";

/** Presentation only: the three sword cuts still resolve one authored damage event. */
type PoseStep = readonly [fraction: number, pose: ExtendedBattlerPose];
export interface RetroSkillRecipe {
  readonly fx: PixelFx;
  readonly approach: "still" | "dash" | "flash";
  readonly cast: CastType;
  readonly approachMs: number;
  readonly recoverMs: number;
  readonly poses: readonly PoseStep[];
  readonly release: ExtendedBattlerPose;
  readonly sound: string;
  readonly screen?: "shake" | "flash" | "dim";
}

// Static URL expressions keep these tiny original sheets in Vite's player asset graph.
const SHEETS = {
  slash: new URL("../../public/assets/generated/pixel-fx/slash.png", import.meta.url).href,
  focus: new URL("../../public/assets/generated/pixel-fx/focus.png", import.meta.url).href,
  arcane: new URL("../../public/assets/generated/pixel-fx/arcane.png", import.meta.url).href,
  heal: new URL("../../public/assets/generated/pixel-fx/heal.png", import.meta.url).href,
  sleep: new URL("../../public/assets/generated/pixel-fx/sleep.png", import.meta.url).href,
  weaken: new URL("../../public/assets/generated/pixel-fx/weaken.png", import.meta.url).href,
  poison: new URL("../../public/assets/generated/pixel-fx/poison.png", import.meta.url).href,
  fire: new URL("../../public/assets/generated/pixel-fx/fire.png", import.meta.url).href,
  ice: new URL("../../public/assets/generated/pixel-fx/ice.png", import.meta.url).href,
  thunder: new URL("../../public/assets/generated/pixel-fx/thunder.png", import.meta.url).href,
  earth: new URL("../../public/assets/generated/pixel-fx/earth.png", import.meta.url).href,
  wind: new URL("../../public/assets/generated/pixel-fx/wind.png", import.meta.url).href,
  dark: new URL("../../public/assets/generated/pixel-fx/dark.png", import.meta.url).href,
  holy: new URL("../../public/assets/generated/pixel-fx/holy.png", import.meta.url).href,
  water: new URL("../../public/assets/generated/pixel-fx/water.png", import.meta.url).href,
  leaf: new URL("../../public/assets/generated/pixel-fx/leaf.png", import.meta.url).href,
  knife: new URL("../../public/assets/generated/pixel-fx/knife.png", import.meta.url).href,
} as const;
type PixelFx = keyof typeof SHEETS;
const casting: readonly PoseStep[] = [[0, "cast_charge"], [0.45, "cast_raise"], [0.9, "cast_release"]];
function spell(fx: PixelFx, cast: CastType, sound: string, approachMs: number, screen?: RetroSkillRecipe["screen"], poses = casting): RetroSkillRecipe {
  return { fx, approach: "still", cast, sound: `easyrpg-sound-${sound}`, approachMs, recoverMs: 840, poses, release: "cast_release", screen };
}

export const RETRO_SKILL_RECIPES: Readonly<Record<string, RetroSkillRecipe>> = {
  skill_sword_slash: { ...spell("slash", "arcane", "attack2", 920, "shake"), approach: "dash", release: "attack",
    poses: [[0, "attack_windup"], [0.1, "walk_c"], [0.34, "attack_windup"], [0.4, "attack_strike"], [0.47, "attack"],
      [0.55, "attack_windup"], [0.62, "attack_strike"], [0.69, "attack"], [0.8, "attack_windup"], [0.88, "attack_strike"], [0.96, "attack"]] },
  skill_focus: { ...spell("focus", "support", "buff", 600, undefined, [[0, "defend"], [0.22, "skill"], [0.6, "skill"]]), release: "skill" },
  skill_arcane_bolt: spell("arcane", "arcane", "magic2", 760, "flash"),
  skill_heal: spell("heal", "heal", "holy2", 720, undefined, [[0, "cast_charge"], [0.3, "cast_raise"], [0.75, "skill"]]),
  skill_sleep_mist: spell("sleep", "support", "sleep", 820, "dim", [[0, "cast_raise"], [0.35, "cast_charge"], [0.78, "cast_release"]]),
  skill_weaken: spell("weaken", "dark", "darkness3", 620, "dim", [[0, "cast_raise"], [0.6, "cast_release"]]),
  skill_poison_sting: { ...spell("poison", "dark", "poison", 740), approach: "flash", release: "attack",
    poses: [[0, "attack_windup"], [0.16, "evade"], [0.38, "attack_strike"], [0.49, "attack"], [0.64, "attack_windup"], [0.8, "attack_strike"], [0.94, "attack"]] },
  skill_fire: spell("fire", "fire", "fire1", 700, "flash"),
  skill_ice: spell("ice", "ice", "ice1", 780, undefined, [[0, "cast_raise"], [0.45, "cast_charge"], [0.88, "cast_release"]]),
  skill_thunder: spell("thunder", "thunder", "flash3", 640, "flash", [[0, "cast_charge"], [0.25, "cast_raise"], [0.7, "skill"]]),
  skill_earth: spell("earth", "arcane", "earth2", 900, "shake", [[0, "defend"], [0.3, "cast_charge"], [0.67, "skill"], [0.9, "cast_release"]]),
  skill_wind: spell("wind", "thunder", "wind8", 580, undefined, [[0, "cast_raise"], [0.32, "cast_charge"], [0.72, "cast_release"]]),
  skill_dark: spell("dark", "dark", "darkness3", 940, "dim", [[0, "cast_charge"], [0.65, "cast_raise"], [0.94, "skill"]]),
  skill_holy: spell("holy", "heal", "holy3", 880, "flash", [[0, "cast_charge"], [0.25, "cast_raise"], [0.78, "skill"]]),
  skill_water: spell("water", "ice", "wave1", 740, "shake"),
  skill_leaf: spell("leaf", "support", "wind8", 620, undefined, [[0, "cast_raise"], [0.35, "skill"], [0.82, "cast_release"]]),
  skill_throwing_knife: { ...spell("knife", "arcane", "shot1", 520, undefined, [[0, "attack_windup"], [0.55, "attack_strike"], [0.9, "attack"]]), release: "attack_follow" },
};
const ELEMENTS: Readonly<Record<string, string>> = { fire: "fire", ice: "ice", thunder: "thunder", earth: "earth", wind: "wind", dark: "dark", holy: "holy", water: "water", grass: "leaf", leaf: "leaf", poison: "poison_sting" };
const WORDS: readonly [RegExp, string][] = [
  [/수면|안개|sleep|mist/i, "sleep_mist"], [/약화|저주|weaken|curse/i, "weaken"], [/집중|강화|focus|buff/i, "focus"],
  [/치유|회복|heal|cure/i, "heal"], [/독침|poison|sting/i, "poison_sting"], [/단검|투척|knife|throw/i, "throwing_knife"],
  [/검격|베기|slash|sword/i, "sword_slash"], [/마법탄|비전|arcane/i, "arcane_bolt"], [/화염|불꽃|fire|flame/i, "fire"],
  [/빙결|얼음|ice|frost/i, "ice"], [/낙뢰|번개|thunder|lightning/i, "thunder"], [/암석|대지|earth|rock/i, "earth"],
  [/질풍|바람|wind|gale/i, "wind"], [/암흑|어둠|dark|shadow/i, "dark"], [/성광|성스|holy/i, "holy"],
  [/물대포|물결|water|aqua/i, "water"], [/잎날|나뭇잎|leaf|grass/i, "leaf"],
];

/** Known id wins; custom records use element → words → effect, never animation filename. */
export function retroSkillRecipe(skill: Pick<SkillRecord, "id" | "name" | "elementId" | "effect" | "retroChoreographyId"> & Partial<SkillRecord> | undefined): RetroSkillRecipe | undefined {
  if (!skill) return undefined;
  // 계약 직업 스킬은 자기 타임라인으로 재생한다(아래 driveRetroClassSkill). 속성·낱말 추정으로 옛 레시피를 붙이지 않는다.
  if (resolveSkillChoreography(skill, choreographyRecords())) return undefined;
  const exact = RETRO_SKILL_RECIPES[skill.id];
  if (exact) return exact;
  // 계약도 레시피도 없는 스킬은 기전·속성·범위로 고른 직업 연출(자동 추천)이 재생한다 — 옛 속성/낱말 추정은 그 기전이 없는 종류만.
  if (recommendRetroChoreography(skill as Parameters<typeof recommendRetroChoreography>[0])) return undefined;
  const inferred = ELEMENTS[skill.elementId ?? ""] ?? WORDS.find(([word]) => word.test(skill.name))?.[1];
  if (inferred) return RETRO_SKILL_RECIPES[`skill_${inferred}`];
  return skill.effect.kind === "healing" ? RETRO_SKILL_RECIPES.skill_heal
    : skill.effect.kind === "support" ? RETRO_SKILL_RECIPES.skill_focus
      : skill.effect.kind === "damage" ? RETRO_SKILL_RECIPES[skill.effect.statistic === "attack" ? "skill_sword_slash" : "skill_arcane_bolt"] : undefined;
}

export function retroSkillForEntry(entry: BattleTimelineEntrySnapshot | undefined): RetroSkillRecipe | undefined {
  if (!entry || entry.side !== "actor" || entry.commandKind !== "skill") return undefined;
  const record = battleEntrySkillRecord(entry);
  return record ? retroSkillRecipe(record) : undefined;
}

/** Exact identity wins; old snapshots fall back to authored ownership/name. */
export function battleEntrySkillRecord(entry: BattleTimelineEntrySnapshot | undefined): SkillRecord | undefined {
  if (entry?.skillId) return store.getCurrent().database.skills.find((skill) => skill.id === entry.skillId);
  if (!entry?.skillName) return undefined;
  const all = store.getCurrent().database.skills.filter((skill) => skill.name === entry.skillName);
  if (all.length <= 1) return all[0];
  const enemy = entry.side === "enemy";
  return skillByName(entry.skillName, enemy, entry.userRecordId) ?? skillByName(entry.skillName, !enemy, entry.userRecordId) ?? all[0];
}

const entries = new WeakMap<HTMLElement, BattleTimelineEntrySnapshot>();
const effects = new WeakMap<HTMLElement, Set<HTMLElement>>();
const activeFx = new WeakMap<HTMLElement, HTMLElement>();
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
export function currentRetroSkill(field: HTMLElement): RetroSkillRecipe | undefined { return retroSkillForEntry(entries.get(field)); }
export function clearRetroSkillFx(field: HTMLElement): void {
  for (const node of effects.get(field) ?? []) node.remove();
  effects.delete(field);
  activeFx.delete(field);
}
export function setRetroSkillEntry(field: HTMLElement, entry: BattleTimelineEntrySnapshot): void {
  clearRetroSkillFx(field);
  entries.set(field, entry);
}
export function preloadRetroSkillFx(): void {
  preloadBattleSamples([...new Set(Object.values(RETRO_SKILL_RECIPES).map((recipe) => recipe.sound))]);
  for (const url of Object.values(SHEETS)) { const img = new Image(); img.src = url; }
}
function track(field: HTMLElement, node: HTMLElement): void {
  let nodes = effects.get(field);
  if (!nodes) effects.set(field, nodes = new Set());
  nodes.add(node);
}
function targetNode(field: HTMLElement, id: string | undefined): HTMLElement | undefined {
  if (!id) return undefined;
  const nodes = [...field.querySelectorAll<HTMLElement>(".battle-actor, .battle-enemy")];
  return nodes.find((node) => node.dataset.testid === id || node.dataset.testid === `battle-actor-${id}`)
    ?? nodes.find((node) => node.dataset.recordId === id);
}
function sprite(field: HTMLElement, target: HTMLElement, recipe: RetroSkillRecipe, charge = false): HTMLElement {
  const node = document.createElement("span");
  node.className = "retro-skill-fx";
  node.dataset.retroSkillFx = recipe.fx;
  node.setAttribute("aria-hidden", "true");
  node.style.backgroundImage = `url("${SHEETS[recipe.fx]}")`;
  if (charge) node.classList.add("retro-skill-charge");
  // A sibling overlay uses the target's visual center without inheriting its hit filter/opacity.
  const image = target.querySelector<HTMLElement>(".battle-enemy-image, .battle-actor-sprite") ?? target;
  const box = image.getBoundingClientRect();
  const rect = field.getBoundingClientRect();
  const scaleX = rect.width / (field.offsetWidth || rect.width || 1);
  const scaleY = rect.height / (field.offsetHeight || rect.height || 1);
  node.style.left = `${Math.round((box.left + box.width / 2 - rect.left) / scaleX) + (charge ? -24 : 0)}px`;
  // Cell art rests at row 56/64; battler art has its own transparent foot margin.
  const footMargin = image.dataset.pixelSheet !== undefined ? box.height / scaleY * 4 / pixelCellOf(image)
    : target.dataset.battlerExtended === "true" ? box.height / scaleY * 3 / 48 : 0;
  node.style.top = `${Math.round((box.bottom - rect.top) / scaleY + (charge ? -20 : 16 - footMargin))}px`;
  field.append(node); track(field, node);
  return node;
}
function frame(node: HTMLElement, index: number): void {
  node.dataset.fxFrame = String(index);
  // 옛 17종 시트는 64px 칸이다. 칸 이동값 = 칸 한 변 × 2(직업 스킬은 classFrame 이 크기별로 같은 규칙을 쓴다).
  node.style.backgroundPosition = `${-64 * 2 * index}px 0`;
}
function sequence(node: HTMLElement, frames: readonly number[], length: number): void {
  frame(node, reduced() ? 3 : frames[0]!);
  if (!reduced()) frames.slice(1).forEach((index, i) => scheduleBattleTimer(() => {
    if (node.isConnected) frame(node, index);
  }, Math.round(length * (i + 1) / frames.length)));
  scheduleBattleTimer(() => node.remove(), Math.max(1, length));
}
function screenFx(field: HTMLElement, recipe: RetroSkillRecipe, length: number): void {
  if (!recipe.screen || reduced()) return;
  const veil = document.createElement("span");
  veil.className = `retro-skill-screen retro-skill-screen-${recipe.screen}`;
  veil.style.setProperty("--retro-fx-ms", `${Math.max(100, length)}ms`);
  field.append(veil); track(field, veil);
  // Shake scenery with individual translate; preserve battleJuice's field transform.
  if (recipe.screen === "shake") {
    const scenery = field.querySelector<HTMLElement>(".battle-scenery-camera");
    const animation = scenery?.animate?.([{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "0 0" }], { duration: Math.min(240, length), easing: "steps(1, end)" });
    scheduleBattleTimer(() => animation?.cancel(), Math.min(240, length));
  }
  scheduleBattleTimer(() => veil.remove(), length);
}

/** Called with real (speed-adjusted) beats. Recover owns the strip clock, including zero-length healing impacts. */
export function animateRetroSkillFx(field: HTMLElement, user: HTMLElement, beat: BattleActionBeat): void {
  const entry = entries.get(field), recipe = retroSkillForEntry(entry);
  if (!recipe || !user.classList.contains("battle-actor")) return;
  if (beat.kind === "approach") {
    if (recipe.fx === "arcane" && !reduced()) sequence(sprite(field, user, recipe, true), [0, 1, 2], beat.durationMs * 0.9);
    if (recipe.fx === "slash" && !reduced()) {
      for (const [fraction, cells] of [[0.4, [0, 1]], [0.62, [2, 3]]] as const) {
        scheduleBattleTimer(() => {
          if (!field.isConnected || entries.get(field) !== entry || user.dataset.retroBeat !== "approach") return;
          const target = targetNode(field, beat.targetId ?? entry?.targetId);
          if (target) sequence(sprite(field, target, recipe), cells, beat.durationMs * 0.16);
        }, beat.durationMs * fraction);
      }
    }
    return;
  }
  if (beat.kind === "impact") {
    const target = targetNode(field, beat.targetId ?? entry?.targetId) ?? user;
    const node = sprite(field, target, recipe);
    frame(node, reduced() ? 3 : recipe.fx === "slash" ? 5 : recipe.fx === "arcane" ? 3 : 0);
    activeFx.set(field, node);
    node.dataset.fxSoundPlayed = String(playBattleSample(recipe.sound, 0.36));
    // QA can distinguish one release cue from inherited animation timing SE.
    node.dataset.fxSound = recipe.sound;
    return;
  }
  const node = activeFx.get(field);
  if (!node?.isConnected) return;
  const length = Math.max(1, beat.durationMs * 0.88);
  sequence(node, recipe.fx === "slash" ? [5, 6, 7] : recipe.fx === "arcane" ? [3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7], length);
  screenFx(field, recipe, Math.min(360, length));
}

// ── 직업 스킬 48개(계약 src/assets/retroClassSkills.ts) ─────────────────────────────────────────
// 편집기 스킬 탭과 같은 순수 타임라인(retroClassSkillTimeline)을 시간순으로 재생한다. 대상 편은 레코드 scope 가 정본이다.
// 전체기는 대상마다 타임라인 엔트리가 따로 온다 — 첫 엔트리의 approach 에서 한 번 재생을 시작하고, 나머지 엔트리는
// 피해 숫자만 차례로 띄운다(비트 길이를 첫 착탄·타격 간격·남은 연출 길이로 준다). 재생기는 자기 시계로 끝나며
// 엔트리 사이의 clearMotion 이 지우지 않는다. 칸 이동값은 칸 크기×2(32→64 · 64→128 · 128→256px).
type ClassSkillSheets = Readonly<Record<string, string>>;
// 동적 템플릿 URL 은 Vite 가 폴더의 PNG 전부를 player 자산 그래프에 넣는다(내보내기에도 실린다).
const classSheetUrl = (key: string): string => new URL(`../../public/assets/generated/pixel-fx/${key}.png`, import.meta.url).href;
const classSheets: ClassSkillSheets = Object.fromEntries([...RETRO_ALL_FX_SHEETS, ...RETRO_MONSTER_FX_SHEETS].map((layer) => [layer.key, classSheetUrl(layer.key)]));

const VISUAL_KINDS = new Set(["damage", "healing", "miss", "action"]);
const HITSTOP_MS = 110;
// battleActionBeats 의 무게 배율과 같다. 훅이 미리 나눠 두면 시퀀서가 곱한 뒤 계획한 길이가 된다.
const APPROACH_SCALE = { light: 0.72, normal: 1, heavy: 1.28 } as const;
const HITSTOP_SCALE = { light: 0, normal: 1, heavy: 1.9 } as const;
const RECOVER_SCALE = { light: 0.68, normal: 1, heavy: 1.45 } as const;
const HIT_STAGGER_MS = 90;

/** 재생기가 읽는 계약 모양(직업·몬스터 공통). */
interface PlayableSkill {
  readonly id: string;
  /** 직업·몬스터 스킬 계약의 이름(컷인 띠에 적는다). */
  readonly name?: string;
  readonly motion: string;
  readonly layers: readonly RetroFxLayer[];
}

interface ClassPlan {
  readonly skill: PlayableSkill;
  readonly record: SkillRecord;
  readonly timeline: RetroSkillTimeline;
  /** 시전자 기준 편(enemies = 시전자의 상대). */
  readonly side: RetroTimelineSide;
  /** 시전자가 적 노드인가. 계약 종류와 독립적으로 위치·시트·방향을 결정한다. */
  readonly monster: boolean;
  readonly sequences: readonly number[];
  /** 엔트리별 계획 착탄 시각(ms, 타임라인 시계). */
  readonly hits: readonly number[];
  /** 연출 레코드의 무게 손잡이(light/normal/heavy). 계약 연출·손잡이 없음 = undefined(기존 무게 그대로). */
  readonly weight?: keyof typeof APPROACH_SCALE;
}

const plans = new WeakMap<HTMLElement, Map<number, ClassPlan>>();

/** 지금 프로젝트의 연출 레코드(database.skillChoreographies). 연출 조회는 전부 resolveSkillChoreography 를 거친다. */
function choreographyRecords() {
  return store.getCurrent().database.skillChoreographies;
}

/** 이 레코드가 계약 직업 스킬이면 그 계약(또는 프로젝트 연출 레코드로 합성한 같은 모양). */
export function retroClassSkillRecord(skill: Pick<SkillRecord, "id" | "retroChoreographyId"> & Partial<SkillRecord> | undefined): RetroClassSkill | undefined {
  const resolved = resolveRetroClassChoreography(skill, choreographyRecords());
  if (resolved || !skill || RETRO_SKILL_RECIPES[skill.id] || !skill.effect || !skill.name || !skill.scope) return resolved;
  return recommendRetroChoreography(skill as Parameters<typeof recommendRetroChoreography>[0])?.skill;
}

export function hasRetroSkillContract(skill: Pick<SkillRecord, "id" | "retroChoreographyId"> & Partial<SkillRecord> | undefined): boolean {
  return Boolean(resolveSkillChoreography(skill, choreographyRecords()) || retroClassSkillRecord(skill));
}

/** Project records adapt to the caster; default contracts retain their own kind. */
function skillForCaster(record: SkillRecord | undefined, monster: boolean): PlayableSkill | undefined {
  const resolved = resolveSkillChoreography(record, choreographyRecords());
  if (resolved) {
    return resolved.origin === "project"
      ? resolveSkillChoreography(record, choreographyRecords(), monster ? "monster" : "class")?.skill
      : resolved.skill;
  }
  return monster ? undefined : retroClassSkillRecord(record);
}

interface SkillOwner {
  readonly id: string;
  readonly classId?: string;
  readonly skillIds?: readonly string[];
  readonly learnedSkills?: readonly { readonly skillId?: string }[];
  readonly actions?: readonly { readonly skillId?: string }[];
}

/** 스킬 ID가 없는 과거 엔트리만 시전자(배우·직업·적)의 소유 기술로 이름을 구분한다. */
function ownedSkillIds(userRecordId: string | undefined): ReadonlySet<string> {
  const ids = new Set<string>();
  if (!userRecordId) return ids;
  const database = store.getCurrent().database as unknown as Record<string, readonly SkillOwner[] | undefined>;
  const add = (owner: SkillOwner | undefined) => {
    owner?.skillIds?.forEach((id) => ids.add(id));
    owner?.learnedSkills?.forEach((row) => row.skillId && ids.add(row.skillId));
    owner?.actions?.forEach((row) => row.skillId && ids.add(row.skillId));
  };
  const actor = database.actors?.find((row) => row.id === userRecordId);
  add(actor);
  if (actor?.classId) add(database.classes?.find((row) => row.id === actor.classId));
  add(database.enemies?.find((row) => row.id === userRecordId));
  return ids;
}

/** 이름이 겹치는 후보를 편별로 가른다. 계약은 자기 편만, 프로젝트 연출 레코드를 빌린 스킬은 양쪽 다, 연출이 없으면 직업 쪽. */
function inPartition(skill: SkillRecord, monster: boolean): boolean {
  const resolved = resolveSkillChoreography(skill, choreographyRecords());
  if (!resolved) return !monster;
  return resolved.origin === "project" || (resolved.kind === "monster") === monster;
}

function skillByName(name: string | undefined, monster = false, userRecordId?: string): SkillRecord | undefined {
  // 이름이 겹치는 몬스터 스킬(독침·연막탄)이 있어 편별로 후보를 나눈다.
  const matches = store.getCurrent().database.skills.filter((skill) => skill.name === name && inPartition(skill, monster));
  if (matches.length <= 1) return matches[0];
  // 같은 편 안에서도 이름이 겹친다(2차 로스터: 정찰병·도적의 「연막탄」, 레인저·총사의 「저격」 등 31쌍).
  // 시전자가 가진 쪽, 없으면 계약 배우가 시전자인 쪽.
  const owned = ownedSkillIds(userRecordId);
  const mine = matches.filter((skill) => owned.has(skill.id));
  if (mine.length === 1) return mine[0];
  const contracted = matches.filter((skill) => retroClassSkill(skill.id)?.actorId === userRecordId);
  return contracted.length === 1 ? contracted[0] : undefined;
}

function classEntry(entry: BattleTimelineEntrySnapshot | undefined): { skill: PlayableSkill; record: SkillRecord } | undefined {
  if (!entry || entry.side !== "actor" || entry.commandKind !== "skill" || !VISUAL_KINDS.has(entry.kind)) return undefined;
  const record = battleEntrySkillRecord(entry);
  const skill = skillForCaster(record, false);
  return skill && record ? { skill, record } : undefined;
}

/** 적의 몬스터 스킬 엔트리. */
function monsterEntry(entry: BattleTimelineEntrySnapshot | undefined): { skill: PlayableSkill; record: SkillRecord } | undefined {
  if (!entry || entry.side !== "enemy" || entry.commandKind !== "enemySkill" || !VISUAL_KINDS.has(entry.kind)) return undefined;
  const record = battleEntrySkillRecord(entry);
  const skill = skillForCaster(record, true);
  return skill && record ? { skill, record } : undefined;
}

/** 이 엔트리가 retro2003 몬스터 스킬 연출을 쓰는가(battleDom·battleRetroMotion 분기용). */
export function isRetroMonsterSkillEntry(entry: BattleTimelineEntrySnapshot | undefined): boolean {
  return Boolean(monsterEntry(entry));
}

function sameAction(a: BattleTimelineEntrySnapshot, b: BattleTimelineEntrySnapshot): boolean {
  return b.side === a.side && b.commandKind === a.commandKind && b.userRecordId === a.userRecordId
    && (a.skillId || b.skillId ? a.skillId === b.skillId : b.skillName === a.skillName) && VISUAL_KINDS.has(b.kind);
}

/**
 * 엔트리 묶음의 착탄 시각. 엔트리 순서는 대상별로 타수를 몰아 적는다(대상1 1·2·3타, 대상2 1·2·3타…).
 * n 번째 타는 연출의 n 번째 hit 이벤트에 맞추고(없으면 첫 타 + n × 간격), 대상마다 간격만큼 늦춘다.
 * 시퀀서는 엔트리를 순서대로 치므로 시각이 엔트리 순서대로 늘어나게 최소 간격을 지킨다.
 */
function plannedHitTimes(timeline: RetroSkillTimeline, firstHit: number, group: readonly BattleTimelineEntrySnapshot[]): number[] {
  const hitEvents = [...new Set(timeline.events.filter((event) => event.kind === "hit").map((event) => event.at))].sort((a, b) => a - b);
  const targetOrder: string[] = [];
  const hitsSoFar = new Map<string, number>();
  let previous = -Infinity;
  return group.map((row) => {
    const target = row.targetId ?? "";
    if (!targetOrder.includes(target)) targetOrder.push(target);
    const hit = hitsSoFar.get(target) ?? 0;
    hitsSoFar.set(target, hit + 1);
    const base = hitEvents[hit] ?? firstHit + hit * HIT_STAGGER_MS;
    const at = Math.max(base + targetOrder.indexOf(target) * HIT_STAGGER_MS, previous + HIT_STAGGER_MS / 2);
    previous = at;
    return Math.max(1, Math.round(at));
  });
}

function buildPlan(skill: PlayableSkill, record: SkillRecord, group: readonly BattleTimelineEntrySnapshot[], monster = false): ClassPlan {
  const resolved = resolveSkillChoreography(record, choreographyRecords());
  const kind = resolved?.origin === "project" ? (monster ? "monster" : "class") : resolved?.kind;
  const contract = kind === "monster" ? skill as RetroMonsterSkill : undefined;
  const side = retroSideForScope(record.scope) ?? (contract ? retroMonsterSide(contract) : "enemies");
  // 타수 = 한 대상이 맞은 횟수(hitSequence 중 실제로 친 수). onHit:"each" 층이 이만큼 다시 깔린다 — 대상 수가 아니다.
  // 층 옵션이 없는 계약은 이 값이 타임라인에 영향을 주지 않는다.
  const perTarget = new Map<string, number>();
  for (const row of group) perTarget.set(row.targetId ?? "", (perTarget.get(row.targetId ?? "") ?? 0) + 1);
  const hits = Math.max(1, ...perTarget.values());
  const base = contract ? retroMonsterSkillTimeline(contract, { hits, side }) : retroClassSkillTimeline(skill as RetroClassSkill, { side, hits });
  // 프로젝트 연출 레코드의 손잡이(speed·tint·screen·weight). 계약 연출이나 손잡이 없는 레코드는 같은 객체를 돌려받는다.
  const handles = resolved?.record;
  const timeline = applyChoreographyHandles(base, handles);
  const firstHit = timeline.events.find((event) => event.kind === "hit")?.at
    ?? timeline.events.find((event) => event.kind === "fx" && event.anchor !== "user")?.at
    ?? timeline.representativeMs;
  const sequences = group.map((row) => row.sequence);
  return { skill, record, timeline, side, monster, sequences, hits: plannedHitTimes(timeline, firstHit, group), ...(handles?.weight ? { weight: handles.weight } : {}) };
}

/** 대가·흡수 엔트리(aside)는 시전자 자신에게 붙는 부수 숫자다 — 연출의 대상·타수가 아니다. */
function isAside(entry: BattleTimelineEntrySnapshot): boolean {
  return entry.aside !== undefined;
}

/** 옛 스냅숏(actionId 없음): 같은 사용자·같은 스킬의 연속 엔트리를 대상이 겹치기 전까지 묶는다. */
function legacyActionGroup(entry: BattleTimelineEntrySnapshot, timeline: readonly BattleTimelineEntrySnapshot[], at: number): BattleTimelineEntrySnapshot[] {
  let start = at;
  const targets = new Set<string>([entry.targetId ?? ""]);
  for (let i = at - 1; i >= 0; i -= 1) {
    const row = timeline[i]!;
    if (!VISUAL_KINDS.has(row.kind) || isAside(row)) continue;
    if (!sameAction(entry, row) || targets.has(row.targetId ?? "")) break;
    targets.add(row.targetId ?? "");
    start = i;
  }
  const group: BattleTimelineEntrySnapshot[] = [];
  const seen = new Set<string>();
  for (let i = Math.max(0, start); i < timeline.length; i += 1) {
    const row = timeline[i]!;
    if (!VISUAL_KINDS.has(row.kind) || isAside(row)) continue;
    if (!sameAction(entry, row) || seen.has(row.targetId ?? "")) break;
    seen.add(row.targetId ?? "");
    group.push(row);
  }
  return group;
}

/** 엔트리가 속한 행동(같은 명령 번호·같은 사용자·같은 스킬)의 계획. 대가·흡수 엔트리는 계획에 딸리지만 타로 세지 않는다. */
function planFor(field: HTMLElement, entry: BattleTimelineEntrySnapshot, timeline: readonly BattleTimelineEntrySnapshot[]): ClassPlan | undefined {
  let cache = plans.get(field);
  if (!cache) plans.set(field, cache = new Map());
  const cached = cache.get(entry.sequence);
  if (cached) return cached;
  const monster = entry.side === "enemy";
  const found = monster ? monsterEntry(entry) : classEntry(entry);
  if (!found) return undefined;
  const at = timeline.findIndex((row) => row.sequence === entry.sequence);
  const members = at < 0 ? [entry]
    : entry.actionId !== undefined
      ? timeline.filter((row) => row.actionId === entry.actionId && VISUAL_KINDS.has(row.kind) && sameAction(entry, row))
      : legacyActionGroup(entry, timeline, at);
  const hitsOnly = members.filter((row) => !isAside(row));
  // 대가만 있고 친 엔트리가 없으면(빗나감 없이 대상 0) 그 엔트리로라도 연출을 튼다.
  const group = hitsOnly.length ? hitsOnly : [entry];
  const plan = buildPlan(found.skill, found.record, group, monster);
  for (const row of members) cache.set(row.sequence, plan);
  cache.set(entry.sequence, plan);
  return plan;
}

function entryWeight(entry: BattleTimelineEntrySnapshot, plan?: ClassPlan): keyof typeof APPROACH_SCALE {
  if (entry.kind === "miss" || entry.hit === false || entry.kind === "healing" || (entry.amount ?? 0) <= 0) return "light";
  return plan?.weight ?? (entry.critical ? "heavy" : "normal");
}

/**
 * 시퀀서 훅(battleDom actionWeight). 연출 레코드가 무게를 정했으면 그것이 기본 무게(급소·막타 포함)를 덮는다.
 * 빗나감·0 피해·회복(light)은 손잡이와 무관하게 가볍게 유지한다 — 헛방에 길게 눌러 잡으면 어색하다.
 */
export function retroClassSkillWeight(
  field: HTMLElement, entry: BattleTimelineEntrySnapshot, base: keyof typeof APPROACH_SCALE, timeline: readonly BattleTimelineEntrySnapshot[],
): keyof typeof APPROACH_SCALE | undefined {
  if (base === "light") return undefined;
  const plan = planFor(field, entry, timeline);
  // 대가·흡수 숫자는 시전자 몸에 뜨는 부수 숫자 — 히트스톱으로 잡지 않는다.
  if (plan && !plan.sequences.includes(entry.sequence)) return "light";
  return plan?.weight && plan.weight !== base ? plan.weight : undefined;
}

/**
 * 시퀀서 훅(battleDom actorApproachMs/actorRecoverMs). 첫 엔트리의 approach = 첫 착탄까지, 이어지는 엔트리의 approach = 0,
 * recover = 다음 착탄까지(마지막은 연출 끝까지). 시퀀서가 무게 배율을 곱하므로 미리 나눠 둔다.
 */
export function retroClassSkillBeatMs(field: HTMLElement, entry: BattleTimelineEntrySnapshot, kind: "approach" | "recover", timeline: readonly BattleTimelineEntrySnapshot[]): number | undefined {
  const plan = planFor(field, entry, timeline);
  if (!plan) return undefined;
  // 대가(행동 앞)·흡수(타격 뒤) 엔트리: 연출 시계를 쓰지 않고 곧바로 숫자만 띄운다.
  if (!plan.sequences.includes(entry.sequence)) return 0;
  const index = plan.sequences.indexOf(entry.sequence);
  const weight = entryWeight(entry, plan);
  if (kind === "approach") return index === 0 ? Math.round(plan.hits[0]! / APPROACH_SCALE[weight]) : 0;
  const hitstop = weight === "light" ? 0 : HITSTOP_MS * HITSTOP_SCALE[weight];
  const next = index < plan.hits.length - 1 ? plan.hits[index + 1]! : plan.timeline.durationMs;
  return Math.max(0, Math.round((next - plan.hits[index]! - hitstop) / RECOVER_SCALE[weight]));
}

interface Point { readonly x: number; readonly y: number }
interface ClassPlayer {
  readonly plan: ClassPlan;
  readonly user: HTMLElement;
  readonly primaryId: string | undefined;
  readonly clock: number;
  readonly paint: (node: HTMLElement) => void;
  readonly nodes: Set<HTMLElement>;
  readonly animations: Animation[];
  readonly places: Readonly<Record<RetroStagePlace, Point>>;
  last: Point;
  /** blink-strike: 대상 등 뒤(적의 왼쪽)에 나타나 오른쪽을 보고 친다. */
  behind: boolean;
  move?: Animation;
  done: boolean;
}
const players = new WeakMap<HTMLElement, ClassPlayer>();

/** 지금 이 필드에서 전용 도트 연출(기존 레시피 또는 직업 스킬)이 재생 중인가 — 기존 전투 애니메이션 층을 건너뛸지 정한다. */
export function hasRetroChoreography(field: HTMLElement): boolean {
  const entry = entries.get(field);
  return Boolean(retroSkillForEntry(entry) || classEntry(entry) || monsterEntry(entry));
}

/** 이 배우를 직업 스킬 재생기가 움직이는 중인가. */
export function isRetroClassSkillActor(node: HTMLElement): boolean {
  return node.dataset.retroClassSkill !== undefined;
}

function scaleOf(node: HTMLElement): number {
  const rect = node.getBoundingClientRect();
  return node.offsetWidth > 0 && rect.width > 0 ? rect.width / node.offsetWidth : 1;
}
function currentTranslate(node: HTMLElement): Point {
  const [x, y] = getComputedStyle(node).translate.split(" ");
  return { x: Number.parseFloat(x ?? "0") || 0, y: Number.parseFloat(y ?? "0") || 0 };
}
function battlerImage(node: HTMLElement): HTMLElement {
  return node.querySelector<HTMLElement>(".battle-enemy-image, .battle-actor-sprite, .battle-actor-image") ?? node;
}
/** 도트 적 시트의 셀 한 변(48·64·96). 몸 비율(앞 cell−12 · 뒤 12 · 발 cell−4)은 셀 크기로 나눈다 — 48 고정이면 큰 적에서 어긋났다. */
function pixelCellOf(image: HTMLElement): number {
  return Number(image.closest<HTMLElement>("[data-pixel-enemy-cell]")?.dataset.pixelEnemyCell) || 48;
}
function livingEnemies(field: HTMLElement): HTMLElement[] {
  return [...field.querySelectorAll<HTMLElement>(".battle-enemy:not(.defeated)")];
}
function sideNodes(field: HTMLElement, side: RetroTimelineSide, user: HTMLElement): HTMLElement[] {
  if (side === "self") return [user];
  if (side === "allies") return [...field.querySelectorAll<HTMLElement>(".battle-actor:not(.retro-afterimage)")];
  return livingEnemies(field);
}
/** 시전자 기준 편 → 화면 노드. 몬스터가 시전하면 상대(enemies)는 아군 파티, 자기 편(allies)은 살아 있는 적이다. */
function casterSideNodes(field: HTMLElement, player: ClassPlayer, side: RetroTimelineSide): HTMLElement[] {
  if (!player.plan.monster || side === "self") return sideNodes(field, side, player.user);
  return side === "allies" ? livingEnemies(field) : [...field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated):not(.retro-afterimage)")];
}

/**
 * 몬스터 시전자가 서는 자리(적 노드 translate 단위). front = 대상 아군 바로 앞(왼쪽), battleRetroMotion 의
 * measureEnemyReach 와 같은 몸 비율(적 앞 cell−6·발 cell−4, 아군 앞 14/48·발 44/48)이다. 뿌리 박힌 적은 제자리.
 */
function measureMonsterPlaces(field: HTMLElement, user: HTMLElement, primary: HTMLElement | undefined): Record<RetroStagePlace, Point> {
  const image = battlerImage(user);
  const imageRect = image.getBoundingClientRect();
  const scale = image.offsetWidth > 0 && imageRect.width > 0 ? imageRect.width / image.offsetWidth : 1;
  const now = currentTranslate(user);
  const pixel = image.dataset.pixelSheet !== undefined;
  const cell = pixelCellOf(image);
  const hovering = user.dataset.pixelEnemy === "swoop" || user.dataset.pixelEnemy === "float";
  const front0 = (pixel ? imageRect.left + imageRect.width * ((cell - 6) / cell) : imageRect.right - imageRect.width * 0.15) - now.x * scale;
  const feet0 = (pixel ? imageRect.top + imageRect.height * ((hovering ? cell / 2 - 4 : cell - 4) / cell) : imageRect.bottom) - now.y * scale;
  const actors = [...field.querySelectorAll<HTMLElement>(".battle-actor:not(.defeated):not(.retro-afterimage)")];
  const foe = primary?.classList.contains("battle-actor") ? primary : actors[0];
  const spot = (node: HTMLElement) => {
    const image = battlerImage(node);
    const box = image.getBoundingClientRect();
    // 파티원 몬스터 시트(셀 48·64)는 몸 앞이 12/cell, 발이 (cell−4)/cell 이다.
    const cell = node.dataset.pixelParty ? pixelCellOf(image) : 0;
    return { front: box.left + box.width * (cell ? 12 / cell : 14 / 48), center: box.left + box.width / 2, feet: box.top + box.height * (cell ? (hovering ? cell / 2 - 4 : cell - 4) / cell : (hovering ? 20 : 44) / 48) };
  };
  const rooted = image.dataset.pixelSheet === "generated-enemy-plant-carnivore";
  let front: Point = { x: rooted ? 0 : 72, y: 0 };
  if (foe && !rooted) {
    const s = spot(foe);
    front = { x: Math.round((s.front - front0) / scale - 2), y: Math.round((s.feet - feet0) / scale) };
  }
  let center: Point = { x: front.x - 20, y: front.y };
  if (actors.length > 0 && !rooted) {
    const all = actors.map(spot);
    center = {
      x: Math.round((all.reduce((sum, s) => sum + s.center, 0) / all.length - front0) / scale - 40),
      y: Math.round((all.reduce((sum, s) => sum + s.feet, 0) / all.length - feet0) / scale),
    };
  }
  return { home: { x: 0, y: 0 }, front, center, above: { x: front.x - 10, y: front.y - 62 } };
}

/** 시전자가 서는 자리(노드 translate 단위). 제자리 = 0,0. 재생 시작 때 한 번 잰다. */
function measurePlaces(field: HTMLElement, user: HTMLElement, primary: HTMLElement | undefined, behind = false): Record<RetroStagePlace, Point> {
  const scale = scaleOf(user);
  const rect = user.getBoundingClientRect();
  const now = currentTranslate(user);
  const baseX = rect.left + rect.width / 2 - now.x * scale;
  // 파티원 몬스터 시트는 발 기준선이 y=cell−4 다(사람 전투 시트는 45/48).
  const userCell = user.dataset.pixelParty ? pixelCellOf(battlerImage(user)) : 0;
  const baseFeet = rect.top + rect.height * (userCell ? (userCell - 4) / userCell : 45 / 48) - now.y * scale;
  const enemies = livingEnemies(field);
  const foe = primary?.classList.contains("battle-enemy") ? primary : enemies[0];
  const edge = (node: HTMLElement) => {
    const image = battlerImage(node);
    const box = image.getBoundingClientRect();
    const pixel = image.dataset.pixelSheet !== undefined;
    const cell = pixelCellOf(image);
    return {
      front: pixel ? box.left + box.width * ((cell - 12) / cell) : box.right - box.width * 0.15,
      back: pixel ? box.left + box.width * (12 / cell) : box.left + box.width * 0.15,
      center: box.left + box.width / 2,
      feet: pixel ? box.top + box.height * ((cell - 4) / cell) : box.bottom,
    };
  };
  let front: Point = { x: -72, y: 0 };
  if (foe) {
    const e = edge(foe);
    // 등 뒤: 적 그림 왼쪽 가장자리보다 26px 더 왼쪽(아군은 왼쪽을 보므로 이때 좌우를 뒤집는다).
    front = behind
      ? { x: Math.round((e.back - 26 * scale - baseX) / scale), y: Math.round((e.feet - baseFeet) / scale + 2) }
      : { x: Math.round((e.front + 26 * scale - baseX) / scale), y: Math.round((e.feet - baseFeet) / scale + 2) };
  }
  let center: Point = { x: front.x - 20, y: front.y };
  if (enemies.length > 0) {
    const all = enemies.map(edge);
    const cx = all.reduce((sum, e) => sum + e.center, 0) / all.length;
    const feet = all.reduce((sum, e) => sum + e.feet, 0) / all.length;
    center = { x: Math.round((cx - baseX) / scale), y: Math.round((feet - baseFeet) / scale + 6) };
  }
  return { home: { x: 0, y: 0 }, front, center, above: { x: front.x + 10, y: front.y - 62 } };
}

function fieldScale(field: HTMLElement): { readonly rect: DOMRect; readonly x: number; readonly y: number } {
  const rect = field.getBoundingClientRect();
  return { rect, x: rect.width / (field.offsetWidth || rect.width || 1), y: rect.height / (field.offsetHeight || rect.height || 1) };
}

/**
 * 몸 위 레이어: 발 기준(칸 바닥 8행 = 화면 16px 아래가 발). 128px 대상 상자는 칸 대부분을 채우므로
 * 편집기 스킬 탭(databaseSkillRetroStage footPad)과 같게 발 아래 24px 에 바닥을 둬 폭심이 몸 가운데에 온다.
 */
function placeOnBody(field: HTMLElement, node: HTMLElement, host: HTMLElement): void {
  const image = battlerImage(host);
  const box = image.getBoundingClientRect();
  const f = fieldScale(field);
  const footMargin = image.dataset.pixelSheet !== undefined ? box.height / f.y * 4 / pixelCellOf(image)
    : host.dataset.battlerExtended === "true" ? box.height / f.y * 3 / 48 : 0;
  node.style.left = `${Math.round((box.left + box.width / 2 - f.rect.left) / f.x)}px`;
  const pad = Number(node.dataset.fxSize) >= 128 && Number(node.dataset.fxBox) <= 128 ? 24 : 16;
  node.style.top = `${Math.round((box.bottom - f.rect.top) / f.y + pad - footMargin)}px`;
}
function stageCenter(field: HTMLElement): Point {
  const f = fieldScale(field);
  const stage = field.querySelector<HTMLElement>(".battle-backdrop")?.getBoundingClientRect();
  const box = stage && stage.width > 0 ? stage : f.rect;
  return { x: Math.round((box.left + box.width / 2 - f.rect.left) / f.x), y: Math.round((box.top + box.height / 2 - f.rect.top) / f.y) };
}
function bodyCenter(field: HTMLElement, host: HTMLElement): Point {
  const box = battlerImage(host).getBoundingClientRect();
  const f = fieldScale(field);
  return { x: Math.round((box.left + box.width / 2 - f.rect.left) / f.x), y: Math.round((box.top + box.height * 0.6 - f.rect.top) / f.y) };
}
function handPoint(field: HTMLElement, user: HTMLElement): Point {
  const box = battlerImage(user).getBoundingClientRect();
  const f = fieldScale(field);
  // 아군은 왼쪽을 본다 — 손은 몸 가운데보다 왼쪽, 가슴 높이.
  return { x: Math.round((box.left + box.width * 0.3 - f.rect.left) / f.x), y: Math.round((box.top + box.height * 0.55 - f.rect.top) / f.y) };
}
/** 도트 적의 입·손(오른쪽을 본다): 셀 앞쪽 75%, 몸 절반 높이. 발 여백(cell−4)을 빼고 잰다. */
function monsterMouth(field: HTMLElement, user: HTMLElement): Point {
  const image = battlerImage(user);
  const box = image.getBoundingClientRect();
  const f = fieldScale(field);
  const bottom = image.dataset.pixelSheet !== undefined ? (pixelCellOf(image) - 4) / pixelCellOf(image) : 1;
  return { x: Math.round((box.left + box.width * 0.75 - f.rect.left) / f.x), y: Math.round((box.top + box.height * bottom * 0.55 - f.rect.top) / f.y) };
}

/**
 * 화면 상자 한 변. 기본은 칸 × 2(도트 2배). 단 대상 몸 위에 얹는 128px 칸(낙하참·브레이브 블레이드·파산장·용권 멸살의 착탄)은
 * 2배면 256px 로 적보다 2.7배 컸다(qa 실측) — 칸 × 1(128px)로 그린다. 계약 frame 은 시트 칸 크기라 그대로 둔다.
 * screen 128 은 무대 배경 연출이라 2배를 유지한다.
 */
export function retroClassFxBox(size: number, anchor: string): number {
  return size >= 128 && (anchor === "target" || anchor === "allTargets") ? size : size * 2;
}

/**
 * 몬스터 몸 위 레이어(user·allAllies) 상자: 셀 96 거구는 칸 × 4, 그 밖은 칸 × 2(정수 배율 유지).
 * 64px 오라를 128px 로 96셀(192px 상자) 마왕·트롤 위에 얹으면 몸의 3분의 2 밖에 안 덮였다.
 */
function monsterBodyBox(size: number, host: HTMLElement | undefined): number | undefined {
  if (!host?.classList.contains("battle-enemy") || size >= 128) return undefined;
  return pixelCellOf(battlerImage(host)) >= 96 ? size * 4 : undefined;
}

function fxNode(player: ClassPlayer, field: HTMLElement, key: string, size: number, frames: number, anchor: string, host?: HTMLElement, scale = 1, filter?: string): HTMLElement {
  const node = document.createElement("span");
  node.className = "retro-skill-fx retro-class-fx";
  node.dataset.retroSkillFx = key;
  node.dataset.retroFxAnchor = anchor;
  node.dataset.fxSize = String(size);
  node.setAttribute("aria-hidden", "true");
  // 연출 레코드의 층 배율은 상자 한 변에 곱한다(칸 위치 계산이 dataset.fxBox 를 읽으므로 그림이 함께 커진다). 배율 없음 = 기존 상자.
  const base = monsterBodyBox(size, host) ?? retroClassFxBox(size, anchor);
  const box = scale === 1 ? base : Math.max(1, Math.round(base * scale));
  node.dataset.fxBox = String(box);
  node.style.width = `${box}px`;
  node.style.height = `${box}px`;
  node.style.backgroundImage = `url("${classSheets[key] ?? classSheetUrl(key)}")`;
  node.style.backgroundSize = `${box * frames}px ${box}px`;
  // 색 손잡이: "none" 은 원색(전체 색이 있어도 이 층만 원색), 값이 있으면 CSS filter 조합. 없으면 스타일을 건드리지 않는다.
  if (filter !== undefined) node.style.filter = filter;
  field.append(node);
  player.nodes.add(node);
  return node;
}
/** 칸 이동: 화면 상자 한 변 × index(보통 칸 × 2: 32px → 64, 64px → 128, 128px → 256 · 128px 대상 층은 128). */
function classFrame(node: HTMLElement, index: number): void {
  const box = Number(node.dataset.fxBox) || Number(node.dataset.fxSize || 64) * 2;
  node.dataset.fxFrame = String(index);
  node.style.backgroundPosition = index === 0 ? "0px 0px" : `-${box * index}px 0px`;
}

function alive(field: HTMLElement, player: ClassPlayer): boolean {
  return !player.done && field.isConnected && players.get(field) === player;
}

function playFx(field: HTMLElement, player: ClassPlayer, event: Extract<RetroTimelineEvent, { kind: "fx" }>, still?: number): void {
  const hosts = event.anchor === "screen" ? [undefined]
    : event.anchor === "user" ? [player.user]
      : event.anchor === "allAllies" ? casterSideNodes(field, player, "allies")
        : event.anchor === "allTargets" ? casterSideNodes(field, player, player.plan.side)
          : [targetNode(field, player.primaryId) ?? player.user];
  const frameMs = Math.max(16, event.frameMs * player.clock);
  const layer = player.plan.skill.layers[event.layer];
  for (const host of hosts) {
    const node = fxNode(player, field, event.key, event.frame, layer?.frames ?? event.cells.length, event.anchor, player.plan.monster ? host : undefined, event.scale ?? 1, event.filter);
    const place = () => {
      if (!host) {
        const center = stageCenter(field);
        node.classList.add("retro-class-fx-screen");
        node.style.left = `${center.x}px`;
        node.style.top = `${center.y}px`;
      } else placeOnBody(field, node, host);
    };
    place();
    if (still !== undefined) { classFrame(node, still); continue; }
    classFrame(node, event.cells[0] ?? 0);
    event.cells.slice(1).forEach((cell, i) => scheduleBattleTimer(() => {
      if (!node.isConnected) return;
      // 시전자 몸 레이어는 시전자를 따라간다(질주 중 오라).
      if (event.anchor === "user") place();
      classFrame(node, cell);
    }, Math.round(frameMs * (i + 1))));
    scheduleBattleTimer(() => { node.remove(); player.nodes.delete(node); }, Math.round(frameMs * event.cells.length));
  }
}

function playProjectile(field: HTMLElement, player: ClassPlayer, event: Extract<RetroTimelineEvent, { kind: "projectile" }>): void {
  const targets = casterSideNodes(field, player, player.plan.side);
  const primary = targetNode(field, player.primaryId);
  const aimed = event.aim >= 0 && targets.length > 1 ? targets[event.aim % targets.length] : primary ?? targets[0];
  let end: Point;
  if (event.aim < 0 && targets.length > 0) {
    const points = targets.map((node) => bodyCenter(field, node));
    end = { x: Math.round(points.reduce((s, p) => s + p.x, 0) / points.length), y: Math.round(points.reduce((s, p) => s + p.y, 0) / points.length) };
  } else end = aimed ? bodyCenter(field, aimed) : stageCenter(field);
  // 몬스터는 오른쪽을 본다 — 입·손은 몸 가운데보다 오른쪽이고, 낙하는 왼쪽 위에서 비스듬히 온다.
  const start = event.path === "fall" ? { x: end.x + (player.plan.monster ? -34 : 34), y: end.y - 170 }
    : event.path === "trail" ? bodyCenter(field, player.user)
      : player.plan.monster ? monsterMouth(field, player.user) : handPoint(field, player.user);
  const node = fxNode(player, field, event.key, event.frame, event.frames, "projectile", undefined, 1, event.filter);
  node.classList.add("retro-class-fx-projectile");
  node.style.left = `${end.x}px`;
  node.style.top = `${end.y}px`;
  const duration = Math.max(40, event.durationMs * player.clock);
  const dx = start.x - end.x, dy = start.y - end.y;
  // 던지기는 살짝 포물선, 낙하·궤적은 곧게.
  const lift = event.path === "throw" ? -Math.min(24, Math.abs(dx) * 0.12) : 0;
  const at = (u: number) => `calc(-50% + ${Math.round(dx * (1 - u))}px) calc(-50% + ${Math.round(dy * (1 - u) + lift * 4 * u * (1 - u))}px)`;
  if (typeof node.animate === "function") {
    player.animations.push(node.animate([0, 0.25, 0.5, 0.75, 1].map((u) => ({ translate: at(u) })), { duration, fill: "forwards" }));
  }
  classFrame(node, 0);
  const frameMs = Math.max(16, event.frameMs * player.clock);
  for (let i = 1; i * frameMs < duration; i += 1) scheduleBattleTimer(() => { if (node.isConnected) classFrame(node, i % event.frames); }, Math.round(i * frameMs));
  scheduleBattleTimer(() => { node.remove(); player.nodes.delete(node); }, Math.round(duration));
}

function playScreen(field: HTMLElement, player: ClassPlayer, event: Extract<RetroTimelineEvent, { kind: "screen" }>): void {
  const duration = Math.max(40, event.durationMs * player.clock);
  if (event.effect === "shake") {
    const steps = Math.max(2, Math.round(duration / 40));
    // intensity 는 연출 레코드 손잡이(화면 흔들림 세기 px). 없으면 기존 6px/2px 그대로.
    const ampX = event.intensity ?? 6;
    const ampY = event.intensity === undefined ? 2 : Math.max(1, ampX / 3);
    const keys = Array.from({ length: steps + 1 }, (_, i) => {
      const decay = 1 - i / steps;
      return { translate: i === steps ? "0px 0px" : `${Math.round((i % 2 ? -ampX : ampX) * decay)}px ${Math.round((i % 3 ? -ampY : ampY) * decay)}px` };
    });
    if (typeof field.animate === "function") player.animations.push(field.animate(keys, { duration, easing: "steps(1, end)" }));
    return;
  }
  const veil = document.createElement("span");
  veil.setAttribute("aria-hidden", "true");
  veil.dataset.retroScreen = event.effect;
  if (event.effect === "cutin") {
    veil.className = "retro-class-cutin";
    const sprite = player.user.querySelector<HTMLElement>(".battle-actor-sprite,.battle-enemy-image");
    if (sprite) {
      const copy = sprite.cloneNode(false) as HTMLElement;
      copy.removeAttribute("data-testid");
      copy.className = "retro-class-cutin-face";
      // 원래 클래스(.battle-actor-sprite)가 주던 상자 크기·시트를 인라인으로 옮긴다 — 빠지면 컷인 띠가 빈 띠로 보였다(녹화 실측).
      const computed = getComputedStyle(sprite);
      copy.style.width = `${sprite.offsetWidth || 96}px`;
      copy.style.height = `${sprite.offsetHeight || 96}px`;
      copy.style.backgroundImage = computed.backgroundImage;
      copy.style.backgroundSize = computed.backgroundSize;
      // 2026-09-29: 그 순간 칸(시전 준비·도약 등)을 그대로 떠 오면 2배로 부풀어 다른 캐릭터처럼 보였다(사용자 지적).
      // 컷인은 늘 **전신 대기 칸**(시트 맨 왼쪽 위)을 쓰고 잘라내지 않는다. 시전 시트로 바뀌어 있으면 전투 시트로 되돌린다.
      const battleSheet = sprite.dataset.battlerSheetUrl;
      if (battleSheet && sprite.dataset.battlerSheetSize) {
        copy.style.backgroundImage = `url("${battleSheet}")`;
        copy.style.backgroundSize = sprite.dataset.battlerSheetSize;
      }
      copy.style.backgroundPosition = "0% 0%";
      copy.style.backgroundRepeat = "no-repeat";
      veil.append(copy);
    }
    const name = player.user.querySelector<HTMLElement>(".battle-actor-sprite,.battle-enemy-image")?.getAttribute("aria-label")?.replace(/ 전투 캐릭터$/, "");
    if (name) {
      const label = document.createElement("span");
      label.className = "retro-class-cutin-name";
      const skillLabel = player.plan.record.name || player.plan.skill.name;
      label.textContent = skillLabel ? `${name} · ${skillLabel}` : name;
      veil.append(label);
    }
    if (typeof veil.animate === "function") player.animations.push(veil.animate([
      { translate: "100% 0", offset: 0 }, { translate: "0 0", offset: 0.14 }, { translate: "-3% 0", offset: 0.84 }, { translate: "-100% 0", offset: 1 },
    ], { duration, fill: "forwards", easing: "steps(12, end)" }));
  } else {
    veil.className = `retro-class-veil retro-class-veil-${event.effect}`;
    if (event.color && event.effect === "flash") veil.style.background = event.color;
    const keys = event.effect === "dim"
      ? [{ opacity: 0 }, { opacity: 0.62, offset: Math.min(0.2, 180 / duration) }, { opacity: 0.62, offset: Math.max(0.8, 1 - 180 / duration) }, { opacity: 0 }]
      : [{ opacity: 0.85 }, { opacity: 0 }];
    if (typeof veil.animate === "function") player.animations.push(veil.animate(keys, { duration, fill: "forwards" }));
  }
  field.append(veil);
  player.nodes.add(veil);
  scheduleBattleTimer(() => { veil.remove(); player.nodes.delete(veil); }, Math.round(duration));
}

function playHit(field: HTMLElement, player: ClassPlayer, event: Extract<RetroTimelineEvent, { kind: "hit" }>): void {
  const hosts = event.who === "target" ? [targetNode(field, player.primaryId)].filter((n): n is HTMLElement => Boolean(n)) : casterSideNodes(field, player, player.plan.side);
  const className = player.plan.side === "enemies" ? "retro-skill-struck" : "retro-skill-blessed";
  const duration = Math.round(Math.min(event.durationMs, player.plan.side === "enemies" ? 90 : 260) * player.clock);
  for (const host of hosts) {
    host.classList.add(className);
    scheduleBattleTimer(() => host.classList.remove(className), Math.max(30, duration));
  }
}

function moveUser(player: ClassPlayer, event: Extract<RetroTimelineEvent, { kind: "move" }>): void {
  const to = player.places[event.to];
  const from = player.last;
  player.behind = player.plan.skill.motion === "blink-strike" && event.to === "front";
  player.user.classList.toggle("retro-skill-flip", player.behind);
  const duration = Math.max(1, event.durationMs * player.clock);
  const mid = { x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2 + event.arc) };
  player.move?.cancel();
  if (typeof player.user.animate === "function") {
    player.move = player.user.animate([
      { translate: `${from.x}px ${from.y}px` },
      { translate: `${mid.x}px ${mid.y}px`, offset: 0.5 },
      { translate: `${to.x}px ${to.y}px` },
    ], { duration, fill: "forwards", easing: "cubic-bezier(.3,.7,.4,1)" });
  }
  player.last = to;
}

function finishPlayer(field: HTMLElement, player: ClassPlayer): void {
  if (player.done) return;
  player.done = true;
  for (const node of player.nodes) node.remove();
  player.nodes.clear();
  for (const animation of player.animations) animation.cancel();
  player.move?.cancel();
  const user = player.user;
  delete user.dataset.retroClassSkill;
  delete user.dataset.retroBeat;
  delete user.dataset.retroAction;
  delete user.dataset.retroFrame;
  delete user.dataset.retroCast;
  if (player.plan.monster || user.dataset.pixelParty) delete user.dataset.retroPixelCell;
  user.classList.remove("retro-skill-flip");
  if (field.dataset.retroClassSkill === player.plan.skill.id) delete field.dataset.retroClassSkill;
  if (players.get(field) === player) players.delete(field);
  if (user.isConnected) player.paint(user);
}

/** 이 필드에서 재생 중인 직업 스킬을 멈춘다(새 재생이 시작될 때). */
export function stopRetroClassSkill(field: HTMLElement): void {
  const player = players.get(field);
  if (player) finishPlayer(field, player);
}

/** 포즈 사건을 시전자에 그린다. 몬스터는 도트 시트 9칸(windup·move·attack·recover)으로 옮긴다. */
function drawPose(player: ClassPlayer, pose: ExtendedBattlerPose, flip: boolean): void {
  const user = player.user;
  if (player.plan.monster) {
    const cell = retroMonsterCellForPose(pose);
    if (cell) user.dataset.retroPixelCell = cell;
    else delete user.dataset.retroPixelCell;
    user.dataset.retroFrame = pose;
    player.paint(user);
    return;
  }
  if (user.dataset.pixelParty) {
    // 파티원 몬스터 시트: 사람 24포즈 이름을 9칸으로 옮긴다. 좌우 반전은 그대로(등 뒤 순간이동은 오른쪽을 본다).
    const cell = retroPartyPixelCellForPose(pose);
    if (cell) user.dataset.retroPixelCell = cell;
    else delete user.dataset.retroPixelCell;
  }
  user.dataset.retroFrame = pose;
  user.classList.toggle("retro-skill-flip", flip || player.behind);
  player.paint(user);
}

/** 발 위치(필드 좌표). 도트 시트는 칸 아래 4행이 여백이라 그만큼 올린다(placeOnBody 와 같은 규격). */
function footPoint(field: HTMLElement, host: HTMLElement): Point & { readonly width: number } {
  const image = battlerImage(host);
  const box = image.getBoundingClientRect();
  const f = fieldScale(field);
  const margin = image.dataset.pixelSheet !== undefined ? box.height * 4 / pixelCellOf(image) : 0;
  return { x: Math.round((box.left + box.width / 2 - f.rect.left) / f.x), y: Math.round((box.bottom - margin - f.rect.top) / f.y), width: box.width / f.x };
}

/**
 * 소환(SkillRecord.summonResourceId): 파티원 도트 시트의 몬스터가 시전자 앞에 번쩍 나타나(windup) 대상 앞까지 달려가(move)
 * 첫 계획 착탄에 맞춰 친다(attack). 맞힌 뒤 recover 칸으로 물러나며 사라진다. 그림만 — 숫자·타수는 전투 결과 그대로다.
 * 시트는 왼쪽을 보고 그려져 있다: 아군이 부르면 그대로(적은 왼쪽), 적이 부르면 좌우를 뒤집는다.
 * 대상이 자기 편(버프·회복)이면 달리지 않고 시전자 곁에서 한 번 기운을 뿜고 사라진다.
 */
function playSummon(field: HTMLElement, player: ClassPlayer, still: boolean): void {
  const sheet = partyPixelSheet(player.plan.record.summonResourceId);
  if (!sheet) return;
  const sign = player.plan.monster ? 1 : -1; // 시전자가 바라보는 쪽(화면 x 부호).
  const caster = footPoint(field, player.user);
  const target = player.plan.side === "enemies" ? targetNode(field, player.primaryId) : undefined;
  const start = { x: Math.round(caster.x + sign * (caster.width * 0.45 + sheet.box * 0.35)), y: caster.y };
  const end = target ? (() => {
    const at = footPoint(field, target);
    return { x: Math.round(at.x - sign * (at.width * 0.3 + sheet.box * 0.3)), y: at.y };
  })() : start;
  const node = document.createElement("span");
  node.className = "retro-summon";
  node.dataset.retroSummon = sheet.resourceId;
  node.setAttribute("aria-hidden", "true");
  node.style.width = `${sheet.box}px`;
  node.style.height = `${sheet.box}px`;
  node.style.left = `${start.x}px`;
  node.style.top = `${Math.round(start.y + sheet.box * 4 / sheet.cell)}px`;
  node.style.backgroundImage = `url("${partyPixelSheetUrl(sheet)}")`;
  node.style.backgroundSize = `300% ${sheet.rows * 100}%`;
  const flip = player.plan.monster ? " scaleX(-1)" : "";
  const cell = (name: PartyPixelCell) => {
    node.dataset.retroSummonCell = name;
    node.style.backgroundPosition = partyPixelBackgroundPosition(sheet, name);
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const at = (x: number, y: number) => `translate(${Math.round(x)}px, ${Math.round(y)}px)${flip}`;
  node.style.transform = at(still ? dx : 0, still ? dy : 0);
  field.append(node);
  player.nodes.add(node);
  if (still) { cell("attack"); return; }
  cell("windup");
  const hit = Math.max(240, (player.plan.hits[0] ?? player.plan.timeline.representativeMs) * player.clock);
  const animate = (frames: Keyframe[], options: KeyframeAnimationOptions) => {
    if (typeof node.animate === "function") player.animations.push(node.animate(frames, options));
  };
  animate([{ opacity: 0, filter: "brightness(4)" }, { opacity: 1, filter: "brightness(2.2)", offset: 0.35 }, { opacity: 1, filter: "none" }], { duration: Math.min(320, hit * 0.3) });
  const later = (ms: number, run: () => void) => scheduleBattleTimer(() => { if (alive(field, player)) run(); }, Math.round(ms));
  const travel = target ? hit * 0.5 : 0;
  const departAt = hit * 0.32;
  if (target) {
    later(departAt, () => {
      cell("move");
      animate([{ transform: at(0, 0) }, { transform: at(dx * 0.5, dy * 0.5 - 10), offset: 0.5 }, { transform: at(dx, dy) }], { duration: Math.max(1, travel), fill: "forwards", easing: "cubic-bezier(.45,.05,.55,1)" });
    });
  }
  later(departAt + travel, () => cell("attack"));
  later(hit + 150, () => cell("recover"));
  later(hit + 260, () => animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: "forwards" }));
  later(hit + 520, () => { node.remove(); player.nodes.delete(node); });
}

function startPlayer(field: HTMLElement, user: HTMLElement, plan: ClassPlan, primaryId: string | undefined, clock: number, paint: (node: HTMLElement) => void): void {
  stopRetroClassSkill(field);
  const primary = targetNode(field, primaryId);
  const player: ClassPlayer = {
    plan, user, primaryId, clock: Math.max(0.1, clock), paint, nodes: new Set(), animations: [],
    places: plan.monster ? measureMonsterPlaces(field, user, primary) : measurePlaces(field, user, primary, plan.skill.motion === "blink-strike"),
    last: currentTranslate(user), behind: false, done: false,
  };
  players.set(field, player);
  user.dataset.retroClassSkill = plan.skill.id;
  // 몬스터 시트에는 시전 칸이 없다 — retroCast 는 아군 시전 시트 전용이다.
  if (!plan.monster) user.dataset.retroCast = plan.timeline.castType;
  else user.dataset.retroBeat ??= "approach";
  field.dataset.retroClassSkill = plan.skill.id;
  if (reduced()) {
    // 감속 모드: 대표 순간 한 장만 보인다. 이동·흔들림·컷인 없음.
    playSummon(field, player, true);
    const state = retroTimelineStateAt(plan.timeline, plan.timeline.representativeMs);
    drawPose(player, state.pose, false);
    for (const fx of state.fx) {
      const event = plan.timeline.events[fx.event];
      if (event?.kind === "fx") playFx(field, player, event, fx.cell);
    }
    scheduleBattleTimer(() => finishPlayer(field, player), Math.round(plan.timeline.durationMs * player.clock));
    return;
  }
  playSummon(field, player, false);
  for (const event of plan.timeline.events) {
    const run = () => {
      if (!alive(field, player)) return;
      switch (event.kind) {
        case "pose":
          drawPose(player, event.pose, event.flip === true);
          break;
        case "move": moveUser(player, event); break;
        case "hide":
          if (typeof user.animate === "function") player.animations.push(user.animate([{ opacity: 0 }, { opacity: 0 }], { duration: Math.max(1, event.durationMs * player.clock), easing: "steps(1, end)" }));
          break;
        case "fx": playFx(field, player, event); break;
        case "projectile": playProjectile(field, player, event); break;
        case "screen": playScreen(field, player, event); break;
        case "hit": playHit(field, player, event); break;
        case "sound":
          // 한 사건 한 소리: 타임라인의 sound 사건만 울린다(기존 전투 애니메이션 층과 휘두름음은 battleDom 이 끈다).
          playBattleSample(event.id, 0.34);
          field.dataset.retroClassSkillSounds = String(Number(field.dataset.retroClassSkillSounds ?? 0) + 1);
          break;
      }
    };
    const delay = Math.round(event.at * player.clock);
    if (delay <= 0) run();
    else scheduleBattleTimer(run, delay);
  }
  scheduleBattleTimer(() => finishPlayer(field, player), Math.round(plan.timeline.durationMs * player.clock));
}

/**
 * battleRetroMotion 의 아군 비트 분기. 이 배우의 행동이 직업 스킬이면 true(다른 연출을 건너뛴다).
 * 첫 엔트리의 approach 비트에서 재생을 시작한다. 시계 = 실제 approach 길이 ÷ 계획 착탄 시각(배속·무게 반영).
 */
export function driveRetroClassSkill(
  field: HTMLElement, user: HTMLElement, beat: BattleActionBeat, entry: BattleTimelineEntrySnapshot | undefined,
  timeline: readonly BattleTimelineEntrySnapshot[], paint: (node: HTMLElement) => void,
): boolean {
  const plan = entry ? planFor(field, entry, timeline) : undefined;
  if (!plan || !entry) return false;
  if (beat.kind === "approach" && plan.sequences[0] === entry.sequence) {
    const clock = beat.durationMs > 0 ? beat.durationMs / plan.hits[0]! : 1;
    startPlayer(field, user, plan, entry.targetId, clock, paint);
  }
  return true;
}

/** 훔치기처럼 결과가 특수 메시지 한 줄(special)만 남는 직업 스킬. battleDom 이 명령의 skillId 를 알려 준다. */
export function startRetroSpecialSkill(field: HTMLElement, entry: BattleTimelineEntrySnapshot, skillId: string, speed: number, paint: (node: HTMLElement) => void): boolean {
  const record = store.getCurrent().database.skills.find((skill) => skill.id === skillId);
  const skill = skillForCaster(record, entry.side === "enemy");
  const user = [...field.querySelectorAll<HTMLElement>(entry.side === "enemy" ? ".battle-enemy" : ".battle-actor")].find((node) => node.dataset.recordId === entry.userRecordId);
  if (!skill || !record || !user) return false;
  startPlayer(field, user, buildPlan(skill, record, [entry], entry.side === "enemy"), entry.targetId, 1 / Math.max(0.2, speed), paint);
  return true;
}

export function preloadRetroClassSkillFx(): void {
  const sounds = new Set<string>();
  for (const skill of RETRO_ALL_CLASS_SKILLS) for (const id of retroTimelineSounds(retroClassSkillTimeline(skill))) sounds.add(id);
  for (const skill of RETRO_MONSTER_SKILLS) for (const id of retroTimelineSounds(retroMonsterSkillTimeline(skill))) sounds.add(id);
  preloadBattleSamples([...sounds]);
  for (const url of Object.values(classSheets)) { const img = new Image(); img.src = url; }
}

