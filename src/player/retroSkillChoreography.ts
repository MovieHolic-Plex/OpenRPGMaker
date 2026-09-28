import type { CastType, ExtendedBattlerPose } from "@/battle/battlePose";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { SkillRecord } from "@/project/types";
import { store } from "@/project/store";
import type { BattleActionBeat } from "@/player/battleActionBeats";
import { scheduleBattleTimer } from "@/player/battleTimerScope";
import { playBattleSample, preloadBattleSamples } from "@/player/battleSeSamples";

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
export function retroSkillRecipe(skill: Pick<SkillRecord, "id" | "name" | "elementId" | "effect"> | undefined): RetroSkillRecipe | undefined {
  if (!skill) return undefined;
  const exact = RETRO_SKILL_RECIPES[skill.id];
  if (exact) return exact;
  const inferred = ELEMENTS[skill.elementId ?? ""] ?? WORDS.find(([word]) => word.test(skill.name))?.[1];
  if (inferred) return RETRO_SKILL_RECIPES[`skill_${inferred}`];
  return skill.effect.kind === "healing" ? RETRO_SKILL_RECIPES.skill_heal
    : skill.effect.kind === "support" ? RETRO_SKILL_RECIPES.skill_focus
      : skill.effect.kind === "damage" ? RETRO_SKILL_RECIPES[skill.effect.statistic === "attack" ? "skill_sword_slash" : "skill_arcane_bolt"] : undefined;
}

export function retroSkillForEntry(entry: BattleTimelineEntrySnapshot | undefined): RetroSkillRecipe | undefined {
  if (!entry || entry.side !== "actor" || entry.commandKind !== "skill") return undefined;
  // Timeline currently carries skillName, not skillId. Don't guess between duplicate authored names.
  const matches = store.getCurrent().database.skills.filter((skill) => skill.name === entry.skillName);
  return matches.length === 1 ? retroSkillRecipe(matches[0]) : undefined;
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
  const footMargin = image.dataset.pixelSheet !== undefined ? box.height / scaleY * 4 / 48
    : target.dataset.battlerExtended === "true" ? box.height / scaleY * 3 / 48 : 0;
  node.style.top = `${Math.round((box.bottom - rect.top) / scaleY + (charge ? -20 : 16 - footMargin))}px`;
  field.append(node); track(field, node);
  return node;
}
function frame(node: HTMLElement, index: number): void {
  node.dataset.fxFrame = String(index);
  node.style.backgroundPosition = `${-128 * index}px 0`;
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
