// retro2003 스킬 연출의 **순수 타임라인** — 레시피(계약 motion + layers, 또는 런타임 RETRO_SKILL_RECIPES 형식)를
// [ms, 무엇을, 어디에, 몇 번째 칸] 사건 목록으로 풀고, 임의 시각 t 의 무대 상태를 계산한다.
//
// DOM·타이머·스토어를 모른다. 편집기 스킬 탭 미리보기(databaseSkillRetroStage)가 쓰고,
// 런타임(src/player/retroSkillChoreography)도 같은 함수로 옮겨 오면 두 화면이 같은 순서로 움직인다.
//
// 레이어 배치 규칙(계약의 "재생 순서대로"를 anchor 의 뜻과 함께 읽는다):
//   user        시전자 몸 — 모션의 준비 순간(충전·질주 시작)에 시작하고 시전자를 따라간다.
//   projectile  방출 순간에 날아간다. 목록에서 투사체보다 **앞**에 있는 대상 레이어는 조준(방출 전)이다(저격의 조준경).
//   그 밖        착탄 순간부터 목록 순서대로 이어 재생한다. 다음 레이어는 앞 레이어의 55% 지점에서 겹쳐 시작한다.
import { castTypeForSkill, type CastType, type ExtendedBattlerPose } from "@/battle/battlePose";
import type { RetroFxAnchor, RetroFxLayer, RetroSkillMotion } from "@/assets/retroClassSkills";

/** 시전자가 서는 자리. 좌표는 무대가 정한다. */
export type RetroStagePlace = "home" | "front" | "center" | "above";
/** 대상 편. self 는 시전자 자신만. */
export type RetroTimelineSide = "enemies" | "allies" | "self";
export type RetroProjectilePath = "throw" | "fall" | "trail";
export type RetroScreenEffect = "dim" | "flash" | "shake" | "cutin";

export type RetroTimelineEvent =
  | { readonly kind: "pose"; readonly at: number; readonly pose: ExtendedBattlerPose; readonly flip?: boolean }
  | { readonly kind: "move"; readonly at: number; readonly durationMs: number; readonly to: RetroStagePlace; readonly arc: number }
  | { readonly kind: "hide"; readonly at: number; readonly durationMs: number }
  | {
    readonly kind: "fx"; readonly at: number; readonly layer: number; readonly key: string; readonly anchor: Exclude<RetroFxAnchor, "projectile">;
    readonly frame: number; readonly cells: readonly number[]; readonly frameMs: number;
  }
  | {
    readonly kind: "projectile"; readonly at: number; readonly durationMs: number; readonly layer: number; readonly key: string;
    readonly frame: number; readonly frames: number; readonly frameMs: number; readonly path: RetroProjectilePath;
    /** 겨누는 대상 번호(대상 편 목록 기준). -1 = 대상 편 가운데. */
    readonly aim: number;
  }
  | { readonly kind: "screen"; readonly at: number; readonly durationMs: number; readonly effect: RetroScreenEffect }
  | { readonly kind: "hit"; readonly at: number; readonly durationMs: number; readonly who: "target" | "allTargets" }
  | { readonly kind: "sound"; readonly at: number; readonly id: string };

export interface RetroSkillTimeline {
  readonly durationMs: number;
  readonly castType: CastType;
  readonly side: RetroTimelineSide;
  /** 감속 모드·정지 화면이 보여 줄 대표 시각(첫 착탄 레이어의 한가운데). */
  readonly representativeMs: number;
  readonly events: readonly RetroTimelineEvent[];
}

/** 계약 레코드에서 타임라인이 읽는 부분. */
export interface RetroTimelineSkill {
  readonly name?: string;
  readonly motion: RetroSkillMotion;
  readonly layers: readonly RetroFxLayer[];
}

/** 런타임 RETRO_SKILL_RECIPES 한 항목의 구조(런타임 모듈을 import 하지 않으려고 구조 타입으로 받는다). */
export interface RetroRecipeLike {
  readonly fx: string;
  readonly approach: "still" | "dash" | "flash";
  readonly cast: CastType;
  readonly approachMs: number;
  readonly recoverMs: number;
  readonly poses: readonly (readonly [number, ExtendedBattlerPose])[];
  readonly release: ExtendedBattlerPose;
  readonly sound: string;
  readonly screen?: "shake" | "flash" | "dim";
}

/** 칸 길이(ms). 시트 한 칸 크기별. */
export const RETRO_FX_FRAME_MS: Readonly<Record<number, number>> = { 32: 60, 64: 60, 128: 72 };
const TAIL_MS = 520;
const OVERLAP = 0.55;

const SOUND = {
  dash: "easyrpg-sound-wind8", leap: "easyrpg-sound-move", land: "easyrpg-sound-earth2", blink: "easyrpg-sound-teleport2",
  flash: "easyrpg-sound-flash1", swing: "easyrpg-sound-attack2", bash: "easyrpg-sound-blow4", shot: "easyrpg-sound-shot1",
  buff: "easyrpg-sound-buff", boom: "easyrpg-sound-explosion1",
} as const;

// 2026-09-28 확장 6직업(samurai_·ninja_·monk_·bard_·druid_·witch_ 접두사)의 시전 종류. 기존 낱말 표보다 먼저 본다 —
// 없으면 "chi_burst"(burst→fire)·"금강불괴"·"불협화음"(불→fire)처럼 우연히 불로 잡혔다.
const EXTENSION_CAST: readonly [RegExp, CastType][] = [
  [/samurai_(wind|thunder)|ninja_needle|ninja_paralyze/, "thunder"], [/samurai_blood|ninja_clone|bard_(discord|requiem)|witch_(hex|cauldron|poison|drain|bat|nightmare|sabbath)/, "dark"],
  [/samurai_mind|ninja_log|monk_iron|bard_(notes|tempo)|druid_bark|witch_mirror/, "support"], [/ninja_fire|monk_dragon/, "fire"], [/ninja_(water|splash)/, "ice"],
  [/monk_meditate|bard_(hymn|finale)|druid_(regrowth|moonbeam|world_tree|tree)/, "heal"],
  [/^(samurai|ninja|monk|bard|druid|witch)_/, "arcane"],
];

const KEY_CAST: readonly [RegExp, CastType][] = [
  [/fire|flame|meteor|burst/, "fire"], [/ice|frost|blizzard|snow/, "ice"], [/lightning|bolt|storm|chain/, "thunder"],
  [/heal|holy|halo|revive|purify|sanctuary|blessing|smite|judgment|leaves|nature/, "heal"],
  [/gravity|shadow|venom|dark|assassin|smoke/, "dark"],
  [/shield|barrier|warcry|taunt|counter|afterimage|fortress|mana/, "support"],
];

/** 계약 스킬의 시전 종류. 레이어 키 낱말 → 이름 낱말(castTypeForSkill) → arcane. */
export function retroCastTypeFor(skill: RetroTimelineSkill): CastType {
  const keys = skill.layers.map((layer) => layer.key).join(" ");
  const first = skill.layers[0]?.key ?? "";
  for (const [pattern, type] of EXTENSION_CAST) if (skill.layers.some((layer) => pattern.test(layer.key)) && /^(samurai|ninja|monk|bard|druid|witch)_/.test(first)) return type;
  for (const [pattern, type] of KEY_CAST) if (pattern.test(keys)) return type;
  return castTypeForSkill({ name: skill.name });
}

// 확장 6직업 레이어 → 착탄음(EasyRPG RTP 실파일, public/assets/easyrpg/sound). 정확한 키로 먼저 찾는다.
const EXTENSION_SOUND: Readonly<Record<string, string>> = {
  samurai_iai_flash: "easyrpg-sound-attack2", samurai_sheath: "easyrpg-sound-evade1", samurai_moon: "easyrpg-sound-attack2",
  samurai_wind_wave: "easyrpg-sound-wind8", samurai_wind_hit: "easyrpg-sound-wind8", samurai_mind_eye: "easyrpg-sound-chime2",
  samurai_cherry: "easyrpg-sound-attack2", samurai_petals: "easyrpg-sound-wind8", samurai_thunder_line: "easyrpg-sound-flash3",
  samurai_thunder_hit: "easyrpg-sound-flash3", samurai_blood_moon: "easyrpg-sound-darkness4", samurai_blood_hit: "easyrpg-sound-darkness3",
  samurai_final_sky: "easyrpg-sound-flash1", samurai_final_slash: "easyrpg-sound-attack2",
  ninja_shuriken: "easyrpg-sound-shot1", ninja_shuriken_hit: "easyrpg-sound-blow2", ninja_kunai: "easyrpg-sound-shot1", ninja_kunai_hit: "easyrpg-sound-blow2",
  ninja_fire_breath: "easyrpg-sound-fire2", ninja_log_puff: "easyrpg-sound-fog1", ninja_clone_smoke: "easyrpg-sound-fog1", ninja_clone_hit: "easyrpg-sound-attack2",
  ninja_water_dragon: "easyrpg-sound-wave2", ninja_splash: "easyrpg-sound-wave1", ninja_needle: "easyrpg-sound-shot1", ninja_paralyze: "easyrpg-sound-debuff",
  ninja_thousand_sky: "easyrpg-sound-wind8", ninja_thousand_hit: "easyrpg-sound-attack2",
  monk_fist_flurry: "easyrpg-sound-blow4", monk_rising_kick: "easyrpg-sound-blow4", monk_chi_orb: "easyrpg-sound-magic1", monk_chi_burst: "easyrpg-sound-flash1",
  monk_iron_body: "easyrpg-sound-barrier", monk_whirl_kick: "easyrpg-sound-wind8", monk_meditate: "easyrpg-sound-recovery5",
  monk_earth_palm: "easyrpg-sound-earth6", monk_dragon_aura: "easyrpg-sound-fire2", monk_dragon_hit: "easyrpg-sound-explosion1",
  bard_notes_red: "easyrpg-sound-song", bard_notes_blue: "easyrpg-sound-sleep", bard_sonic_wave: "easyrpg-sound-magic1", bard_sonic_hit: "easyrpg-sound-blow2",
  bard_hymn: "easyrpg-sound-recovery7", bard_discord: "easyrpg-sound-confusion", bard_tempo: "easyrpg-sound-buff",
  bard_requiem_sky: "easyrpg-sound-darkness5", bard_requiem_hit: "easyrpg-sound-darkness3", bard_finale_stage: "easyrpg-sound-bell", bard_finale_hit: "easyrpg-sound-holy3",
  druid_thorn: "easyrpg-sound-earth6", druid_regrowth: "easyrpg-sound-recovery8", druid_swarm: "easyrpg-sound-pollen", druid_bark: "easyrpg-sound-barrier",
  druid_roots: "easyrpg-sound-earth2", druid_moonbeam: "easyrpg-sound-holy5", druid_bear_spirit: "easyrpg-sound-monster1", druid_claw: "easyrpg-sound-blow4",
  druid_world_tree: "easyrpg-sound-earth7", druid_tree_hit: "easyrpg-sound-earth8",
  witch_hex: "easyrpg-sound-darkness3", witch_frog_puff: "easyrpg-sound-fog1", witch_cauldron: "easyrpg-sound-poison", witch_poison_hit: "easyrpg-sound-poison",
  witch_drain_beam: "easyrpg-sound-absorb1", witch_drain_orb: "easyrpg-sound-absorb2", witch_bat_swarm: "easyrpg-sound-wind8", witch_mirror: "easyrpg-sound-barrier2",
  witch_nightmare_sky: "easyrpg-sound-darkness5", witch_nightmare_hit: "easyrpg-sound-sleep", witch_sabbath_sky: "easyrpg-sound-darkness4", witch_sabbath_hit: "easyrpg-sound-darkness3",
};

const KEY_SOUND: readonly [RegExp, string][] = [
  [/meteor_impact|meteor_blast|quake|fortress|brave_burst/, SOUND.boom],
  [/fire|flame/, "easyrpg-sound-fire1"], [/ice|frost|blizzard|snow/, "easyrpg-sound-ice1"],
  [/lightning|bolt|storm|chain/, "easyrpg-sound-flash3"],
  [/revive|holy_shield|sanctuary|halo/, "easyrpg-sound-holy3"], [/heal|purify|blessing/, "easyrpg-sound-holy2"],
  [/smite|judgment|star/, "easyrpg-sound-holy3"], [/gravity|shadow|assassin/, "easyrpg-sound-darkness3"],
  [/venom/, "easyrpg-sound-poison"], [/smoke/, "easyrpg-sound-fog1"], [/leaves|whirl|nature/, SOUND.dash],
  [/bash|charge|guard_/, SOUND.bash], [/barrier|mana_shield|counter|taunt|warcry|afterimage/, SOUND.buff],
  [/arrow|power_hit|scope/, SOUND.swing], [/missile|magic/, "easyrpg-sound-magic2"],
  [/cross|pierce|rising|slash|flurry|backstab|steal|knife|cut/, SOUND.swing],
];

/** 레이어 키 → 착탄 효과음(EasyRPG RTP 리소스 id). */
export function retroSoundForLayer(key: string): string {
  return EXTENSION_SOUND[key] ?? KEY_SOUND.find(([pattern]) => pattern.test(key))?.[1] ?? "easyrpg-sound-magic2";
}

const CAST_SOUND: Readonly<Record<CastType, string>> = {
  fire: "easyrpg-sound-fire1", ice: "easyrpg-sound-ice1", thunder: "easyrpg-sound-flash3", heal: "easyrpg-sound-holy2",
  dark: "easyrpg-sound-darkness3", arcane: "easyrpg-sound-magic2", support: SOUND.buff,
};

const ALLY_KEYS = /heal|purify|revive|holy_shield|blessing|sanctuary|leaves|barrier|regrowth|hymn/;

/**
 * 계약 스킬의 기본 대상 편. 호출자가 레코드 scope 로 덮어쓸 수 있다.
 * 계약에는 편이 없으므로 anchor(allAllies) → 모션(buff) → 대상 레이어 낱말(치유·부활·정화·성스러운 방패) 순으로 고른다.
 */
export function retroDefaultSide(skill: RetroTimelineSkill): RetroTimelineSide {
  if (skill.layers.some((layer) => layer.anchor === "allAllies")) return "allies";
  if (skill.motion === "buff") return skill.layers.every((layer) => layer.anchor === "user") ? "self" : "allies";
  const hits = skill.layers.filter((layer) => layer.anchor === "target" || layer.anchor === "allTargets");
  if (hits.length > 0 && hits.every((layer) => ALLY_KEYS.test(layer.key))) return "allies";
  return "enemies";
}

/** 레코드 scope → 대상 편. scope 가 없으면 undefined(계약 기본값을 쓴다). */
export function retroSideForScope(scope: string | undefined): RetroTimelineSide | undefined {
  if (scope === "self") return "self";
  if (scope === "ally" || scope === "allAllies") return "allies";
  if (scope === "enemy" || scope === "allEnemies") return "enemies";
  return undefined;
}

class TimelineBuilder {
  readonly events: RetroTimelineEvent[] = [];
  end = 0;
  firstImpactMid = -1;
  private touch(at: number): void { this.end = Math.max(this.end, at); }
  pose(at: number, pose: ExtendedBattlerPose, flip?: boolean): void { this.events.push(flip === undefined ? { kind: "pose", at, pose } : { kind: "pose", at, pose, flip }); this.touch(at); }
  move(at: number, durationMs: number, to: RetroStagePlace, arc = 0): void { this.events.push({ kind: "move", at, durationMs, to, arc }); this.touch(at + durationMs); }
  hide(at: number, durationMs: number): void { this.events.push({ kind: "hide", at, durationMs }); this.touch(at + durationMs); }
  sound(at: number, id: string): void { this.events.push({ kind: "sound", at, id }); }
  screen(at: number, durationMs: number, effect: RetroScreenEffect): void { this.events.push({ kind: "screen", at, durationMs, effect }); this.touch(at + durationMs); }
  hit(at: number, who: "target" | "allTargets", durationMs = 280): void { this.events.push({ kind: "hit", at, durationMs, who }); this.touch(at + durationMs); }
  fx(at: number, index: number, layer: RetroFxLayer, cells?: readonly number[], frameMs?: number): number {
    const anchor = layer.anchor === "projectile" ? "target" : layer.anchor;
    const list = cells ?? Array.from({ length: Math.max(1, layer.frames) }, (_, cell) => cell);
    const ms = frameMs ?? RETRO_FX_FRAME_MS[layer.frame] ?? 60;
    this.events.push({ kind: "fx", at, layer: index, key: layer.key, anchor, frame: layer.frame, cells: list, frameMs: ms });
    const end = at + list.length * ms;
    this.touch(end);
    return end;
  }
  projectile(at: number, durationMs: number, index: number, layer: RetroFxLayer, path: RetroProjectilePath, aim: number): void {
    this.events.push({ kind: "projectile", at, durationMs, layer: index, key: layer.key, frame: layer.frame, frames: Math.max(1, layer.frames), frameMs: RETRO_FX_FRAME_MS[layer.frame] ?? 60, path, aim });
    this.touch(at + durationMs);
  }
  build(castType: CastType, side: RetroTimelineSide): RetroSkillTimeline {
    const events = [...this.events].sort((a, b) => a.at - b.at);
    const durationMs = Math.round(this.end + TAIL_MS);
    return { durationMs, castType, side, representativeMs: this.firstImpactMid >= 0 ? this.firstImpactMid : Math.round(this.end / 2), events };
  }
}

type IndexedLayer = { readonly index: number; readonly layer: RetroFxLayer };

/**
 * 착탄 레이어를 목록 순서대로 이어 재생한다. 반환값은 마지막 레이어가 끝나는 시각.
 * 대상 편이 적이면 레이어마다 피격을, 아군이면 축복(같은 hit 사건, 무대가 빛으로 그린다)을 건다.
 */
function playImpact(b: TimelineBuilder, start: number, layers: readonly IndexedLayer[], hitsPerLayer = 1): number {
  let at = start;
  let end = start;
  for (const { index, layer } of layers) {
    const layerEnd = b.fx(at, index, layer);
    const length = layerEnd - at;
    if (b.firstImpactMid < 0) b.firstImpactMid = Math.round(at + length * 0.45);
    const who = layer.anchor === "target" ? "target" : "allTargets";
    for (let i = 0; i < hitsPerLayer; i += 1) b.hit(Math.round(at + length * (0.25 + (0.5 * i) / Math.max(1, hitsPerLayer))), who);
    b.sound(at, retroSoundForLayer(layer.key));
    end = Math.max(end, layerEnd);
    at = Math.round(at + length * OVERLAP);
  }
  return end;
}

function partition(layers: readonly RetroFxLayer[]): { user: IndexedLayer[]; projectile: IndexedLayer[]; aim: IndexedLayer[]; impact: IndexedLayer[] } {
  const indexed = layers.map((layer, index) => ({ index, layer }));
  const firstProjectile = indexed.find((entry) => entry.layer.anchor === "projectile")?.index ?? -1;
  const user = indexed.filter((entry) => entry.layer.anchor === "user");
  const projectile = indexed.filter((entry) => entry.layer.anchor === "projectile");
  const rest = indexed.filter((entry) => entry.layer.anchor !== "user" && entry.layer.anchor !== "projectile");
  const aim = firstProjectile >= 0 ? rest.filter((entry) => entry.index < firstProjectile && entry.layer.anchor === "target") : [];
  const impact = rest.filter((entry) => !aim.includes(entry));
  return { user, projectile, aim, impact };
}

function projectileShape(key: string): { path: RetroProjectilePath; count: number; stagger: number; durationMs: number } {
  if (/meteor_rock|star/.test(key)) return { path: "fall", count: 3, stagger: 110, durationMs: 420 };
  if (/knife/.test(key)) return { path: "throw", count: 6, stagger: 60, durationMs: 260 };
  // 수리검 세 장 연달아 · 쿠나이는 위에서 쏟아진다 · 침은 짧고 빠르게.
  if (/shuriken/.test(key)) return { path: "throw", count: 3, stagger: 90, durationMs: 260 };
  if (/kunai/.test(key)) return { path: "fall", count: 3, stagger: 90, durationMs: 360 };
  if (/needle/.test(key)) return { path: "throw", count: 1, stagger: 0, durationMs: 220 };
  if (/missile/.test(key)) return { path: "throw", count: 3, stagger: 100, durationMs: 340 };
  if (/bomb/.test(key)) return { path: "throw", count: 1, stagger: 0, durationMs: 420 };
  return { path: "throw", count: 1, stagger: 0, durationMs: 300 };
}

/** 투사체 레이어들을 방출한다. 반환값은 마지막 착탄 시각. */
function launch(b: TimelineBuilder, at: number, layers: readonly IndexedLayer[], impact: readonly IndexedLayer[], multiShot: boolean): number {
  let arrive = at;
  const spread = impact.some((entry) => entry.layer.anchor === "allTargets");
  for (const { index, layer } of layers) {
    const shape = projectileShape(layer.key);
    const count = multiShot ? 3 : shape.count;
    const stagger = multiShot ? 120 : shape.stagger;
    for (let i = 0; i < count; i += 1) {
      const start = at + i * stagger;
      b.projectile(start, shape.durationMs, index, layer, shape.path, spread ? i % 3 : shape.path === "fall" && count > 1 ? i % 3 : 0);
      arrive = Math.max(arrive, start + shape.durationMs);
    }
    b.sound(at, /arrow|knife|shuriken|kunai|needle/.test(layer.key) ? SOUND.shot : EXTENSION_SOUND[layer.key] ?? "easyrpg-sound-magic1");
  }
  // 첫 발이 닿는 순간부터 착탄 레이어가 시작된다(여러 발이면 첫 발 기준으로 겹쳐 보이게).
  const first = layers.length > 0 ? at + projectileShape(layers[0]!.layer.key).durationMs : at;
  return layers.length > 0 ? Math.min(arrive, first + 40) : at;
}

/** 근접 모션 공통 복귀. */
function returnHome(b: TimelineBuilder, at: number, blink = false): void {
  if (blink) {
    b.sound(at, SOUND.blink);
    b.hide(at, 180);
    b.move(at + 90, 0, "home");
    b.pose(at + 180, "idle");
    return;
  }
  b.pose(at, "walk_a");
  b.move(at, 260, "home", -18);
  b.pose(at + 130, "walk_c");
  b.pose(at + 260, "idle");
}

/** 계약 스킬(RETRO_CLASS_SKILLS 한 항목) → 타임라인. */
export function retroClassSkillTimeline(skill: RetroTimelineSkill, options: { readonly side?: RetroTimelineSide } = {}): RetroSkillTimeline {
  const b = new TimelineBuilder();
  const castType = retroCastTypeFor(skill);
  const side = options.side ?? retroDefaultSide(skill);
  const { user, projectile, aim, impact } = partition(skill.layers);
  const playUser = (at: number): void => { for (const { index, layer } of user) b.fx(at, index, layer); };
  const multiShot = /multi/.test(skill.layers.map((layer) => layer.key).join(" ")) || /연사/.test(skill.name ?? "");

  switch (skill.motion) {
    case "dash-strike": {
      b.pose(0, "idle"); b.pose(80, "attack_windup"); playUser(80);
      b.sound(140, SOUND.dash); b.pose(160, "walk_b"); b.move(160, 240, "front", -10);
      b.pose(400, "attack_windup"); b.pose(450, "attack_strike"); b.pose(510, "attack");
      const end = playImpact(b, 470, impact);
      // 칸이 10장 이상인 베기(십자베기 등)는 두 번째 휘두름이 보이게 한다.
      const second = impact[0] && impact[0].layer.frames >= 10 ? 470 + Math.round(impact[0].layer.frames * 60 * 0.45) : -1;
      if (second > 0) { b.pose(second - 60, "attack_windup"); b.pose(second, "attack_strike"); b.pose(second + 60, "attack_follow"); b.sound(second, SOUND.swing); }
      returnHome(b, Math.max(end - 120, 760));
      break;
    }
    case "leap-strike": {
      b.pose(0, "idle"); b.pose(60, "defend"); playUser(60);
      b.sound(200, SOUND.leap); b.pose(200, "evade"); b.move(200, 320, "above", -40);
      b.pose(520, "attack_windup"); b.move(560, 150, "front");
      for (const { index, layer } of projectile) b.projectile(520, 190, index, layer, "trail", 0);
      b.pose(600, "attack_strike"); b.pose(710, "attack");
      b.sound(710, SOUND.land); b.screen(710, 300, "shake");
      const end = playImpact(b, 710, impact);
      returnHome(b, Math.max(end - 100, 1020));
      break;
    }
    case "blink-strike": {
      b.pose(0, "idle"); b.pose(60, "evade"); playUser(60);
      b.sound(160, SOUND.blink); b.hide(200, 200); b.move(300, 0, "front");
      b.pose(400, "attack_strike"); b.pose(470, "attack"); b.pose(560, "attack_follow");
      b.screen(420, 100, "flash");
      const end = playImpact(b, 420, impact);
      returnHome(b, Math.max(end - 80, 820), true);
      break;
    }
    case "flurry": {
      b.pose(0, "idle"); b.pose(60, "attack_windup"); playUser(60);
      b.sound(100, SOUND.dash); b.pose(120, "walk_b"); b.move(120, 200, "front", -8);
      const swings = 4;
      for (let i = 0; i < swings; i += 1) {
        const at = 340 + i * 120;
        b.pose(at, "attack_windup", i % 2 === 1); b.pose(at + 40, "attack_strike", i % 2 === 1); b.pose(at + 80, "attack", i % 2 === 1);
        b.sound(at + 40, SOUND.swing);
      }
      const end = playImpact(b, 360, impact, swings);
      b.pose(340 + swings * 120, "attack_follow", false);
      returnHome(b, Math.max(end - 80, 340 + swings * 120 + 120));
      break;
    }
    case "spin": {
      b.pose(0, "idle"); b.pose(60, "attack_windup"); playUser(60);
      b.sound(100, SOUND.dash); b.pose(120, "walk_b"); b.move(120, 300, "center", -24);
      const cycle: readonly ExtendedBattlerPose[] = ["attack_strike", "attack_follow", "attack", "attack_windup"];
      for (let i = 0; i < 12; i += 1) b.pose(440 + i * 70, cycle[i % 4]!, Math.floor(i / 2) % 2 === 1);
      b.sound(440, SOUND.dash);
      const end = playImpact(b, 460, impact, 3);
      b.pose(440 + 12 * 70, "attack", false);
      returnHome(b, Math.max(end - 60, 440 + 12 * 70 + 100));
      break;
    }
    case "cast": {
      b.pose(0, "idle"); b.pose(60, "cast_charge"); playUser(60);
      b.pose(360, "cast_raise");
      let release = 680;
      if (aim.length > 0) { for (const entry of aim) release = Math.max(release, b.fx(200, entry.index, entry.layer) + 40); }
      b.pose(release, "cast_release"); b.sound(release, CAST_SOUND[castType]);
      const land = projectile.length > 0 ? launch(b, release + 40, projectile, impact, multiShot) : release + 60;
      if (projectile.some((entry) => /meteor/.test(entry.layer.key))) b.screen(land, 320, "shake");
      if (castType === "thunder") b.screen(land, 120, "flash");
      const end = playImpact(b, land, impact);
      b.pose(Math.max(land + 120, end - 160), "idle");
      break;
    }
    case "shoot": {
      b.pose(0, "idle"); b.pose(60, "attack_windup"); playUser(60);
      let release = 560;
      if (aim.length > 0) { for (const entry of aim) release = Math.max(release, b.fx(160, entry.index, entry.layer) + 20); }
      b.pose(release - 160, "attack_strike"); b.pose(release, "attack"); b.pose(release + 90, "attack_follow");
      const land = projectile.length > 0 ? launch(b, release, projectile, impact, multiShot) : release + 60;
      if (projectile.length === 0) b.sound(release, SOUND.shot);
      const end = playImpact(b, land, impact);
      b.pose(Math.max(release + 260, end - 160), "idle");
      break;
    }
    case "buff": {
      b.pose(0, "idle"); b.pose(60, "defend"); b.pose(260, "skill");
      playUser(260);
      b.sound(260, retroSoundForLayer(skill.layers[0]?.key ?? "buff"));
      const end = playImpact(b, 300, impact);
      if (b.firstImpactMid < 0 && user[0]) b.firstImpactMid = 260 + Math.round(user[0].layer.frames * (RETRO_FX_FRAME_MS[user[0].layer.frame] ?? 60) * 0.45);
      b.pose(Math.max(620, end - 120), "idle");
      break;
    }
    case "finisher": {
      b.pose(0, "idle"); b.pose(40, "cast_charge");
      b.sound(160, SOUND.flash); b.screen(200, 820, "cutin");
      playUser(220);
      b.pose(640, "cast_raise");
      const release = 1060;
      b.pose(release, "skill"); b.sound(release, CAST_SOUND[castType]);
      const land = projectile.length > 0 ? launch(b, release, projectile, impact, false) : release;
      // 화면 레이어를 먼저, 대상 레이어를 뒤에 — 계약 목록 순서를 그대로 쓴다.
      const end = playImpact(b, land, impact);
      const firstLength = impact[0] ? impact[0].layer.frames * (RETRO_FX_FRAME_MS[impact[0].layer.frame] ?? 60) : 400;
      const blow = Math.round(land + firstLength * 0.5);
      b.screen(blow, 140, "flash"); b.screen(blow, 420, "shake"); b.sound(blow, SOUND.boom);
      b.pose(Math.max(release + 400, end - 120), "idle");
      b.screen(0, Math.max(end + 120, release + 600), "dim");
      break;
    }
  }
  return b.build(castType, side);
}

/**
 * 런타임 RETRO_SKILL_RECIPES 형식(기존 17종 스킬) → 타임라인. retroSkillChoreography 의
 * approach/impact/recover 세 비트와 같은 칸 규칙(slash: 접근 중 0·1 / 2·3, 착탄 5·6·7 · arcane: 충전 0·1·2, 착탄 3~7)을 쓴다.
 */
export function retroRecipeTimeline(recipe: RetroRecipeLike, options: { readonly side?: RetroTimelineSide } = {}): RetroSkillTimeline {
  const b = new TimelineBuilder();
  const side = options.side ?? "enemies";
  const approach = recipe.approachMs;
  const sheet: RetroFxLayer = { key: recipe.fx, anchor: "target", frame: 64, frames: 8 };
  b.pose(0, "idle");
  for (const [fraction, pose] of recipe.poses) b.pose(Math.round(approach * fraction), pose);
  if (recipe.approach === "dash") { b.sound(Math.round(approach * 0.1), SOUND.dash); b.move(Math.round(approach * 0.1), Math.round(approach * 0.24), "front", -10); }
  if (recipe.approach === "flash") { b.sound(Math.round(approach * 0.12), SOUND.flash); b.hide(Math.round(approach * 0.16), Math.round(approach * 0.14)); b.move(Math.round(approach * 0.22), 0, "front"); }
  if (recipe.fx === "arcane") b.fx(0, 0, { ...sheet, anchor: "user" }, [0, 1, 2], Math.round((approach * 0.9) / 3));
  if (recipe.fx === "slash") {
    b.fx(Math.round(approach * 0.4), 0, sheet, [0, 1], Math.round((approach * 0.16) / 2));
    b.fx(Math.round(approach * 0.62), 0, sheet, [2, 3], Math.round((approach * 0.16) / 2));
    b.hit(Math.round(approach * 0.45), "target", 160); b.hit(Math.round(approach * 0.67), "target", 160);
  }
  b.pose(approach, recipe.release);
  b.sound(approach, recipe.sound);
  const length = Math.max(1, recipe.recoverMs * 0.88);
  const cells = recipe.fx === "slash" ? [5, 6, 7] : recipe.fx === "arcane" ? [3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  const end = b.fx(approach, 0, sheet, cells, Math.round(length / cells.length));
  b.firstImpactMid = Math.round(approach + length * 0.4);
  b.hit(approach, "target");
  if (recipe.screen) b.screen(approach, Math.min(360, length), recipe.screen);
  if (recipe.approach !== "still") returnHome(b, Math.round(approach + recipe.recoverMs * 0.7), recipe.approach === "flash");
  else b.pose(Math.round(approach + recipe.recoverMs), "idle");
  b.pose(Math.max(end, approach + recipe.recoverMs), "idle");
  return b.build(recipe.cast, side);
}

// ---- 시각 t 의 무대 상태 ----

export interface RetroFxState { readonly event: number; readonly layer: number; readonly key: string; readonly anchor: Exclude<RetroFxAnchor, "projectile">; readonly frame: number; readonly cell: number }
export interface RetroProjectileState { readonly event: number; readonly layer: number; readonly key: string; readonly frame: number; readonly cell: number; readonly progress: number; readonly path: RetroProjectilePath; readonly aim: number }
export interface RetroStageState {
  readonly pose: ExtendedBattlerPose;
  readonly flip: boolean;
  /** 시전자 이동: from → to 를 progress(0~1)만큼, arc 는 포물선 높이(px, 음수 = 위). */
  readonly move: { readonly from: RetroStagePlace; readonly to: RetroStagePlace; readonly progress: number; readonly arc: number };
  readonly hidden: boolean;
  readonly fx: readonly RetroFxState[];
  readonly projectiles: readonly RetroProjectileState[];
  /** 0~1 세기. */
  readonly dim: number;
  readonly flash: number;
  readonly shake: { readonly x: number; readonly y: number };
  /** 컷인 진행 0~1, 없으면 -1. */
  readonly cutin: number;
  /** 대상 하나 / 대상 편 전원 피격(또는 축복) 세기 0~1. */
  readonly hitTarget: number;
  readonly hitAll: number;
}

function envelope(t: number, at: number, durationMs: number, fade = 90): number {
  if (t < at || t >= at + durationMs) return 0;
  const inside = Math.min(t - at, at + durationMs - t);
  return Math.min(1, inside / Math.max(1, Math.min(fade, durationMs / 2)));
}

/** 타임라인의 시각 t(ms) 무대 상태. 순수 함수 — 같은 t 는 늘 같은 그림이다. */
export function retroTimelineStateAt(timeline: RetroSkillTimeline, t: number): RetroStageState {
  let pose: ExtendedBattlerPose = "idle";
  let flip = false;
  let place: RetroStagePlace = "home";
  let move: RetroStageState["move"] = { from: "home", to: "home", progress: 1, arc: 0 };
  let hidden = false;
  let dim = 0, flash = 0, cutin = -1, hitTarget = 0, hitAll = 0;
  let shake = { x: 0, y: 0 };
  const fx: RetroFxState[] = [];
  const projectiles: RetroProjectileState[] = [];
  timeline.events.forEach((event, index) => {
    if (event.at > t) return;
    switch (event.kind) {
      case "pose": pose = event.pose; flip = event.flip === true; break;
      case "move": {
        const progress = event.durationMs <= 0 ? 1 : Math.min(1, (t - event.at) / event.durationMs);
        move = { from: place, to: event.to, progress, arc: event.arc };
        if (progress >= 1) place = event.to;
        break;
      }
      case "hide": if (t < event.at + event.durationMs) hidden = true; break;
      case "fx": {
        const step = Math.floor((t - event.at) / Math.max(1, event.frameMs));
        if (step < event.cells.length) fx.push({ event: index, layer: event.layer, key: event.key, anchor: event.anchor, frame: event.frame, cell: event.cells[step]! });
        break;
      }
      case "projectile": {
        const elapsed = t - event.at;
        if (elapsed < event.durationMs) projectiles.push({
          event: index, layer: event.layer, key: event.key, frame: event.frame,
          cell: Math.floor(elapsed / Math.max(1, event.frameMs)) % event.frames, progress: elapsed / event.durationMs, path: event.path, aim: event.aim,
        });
        break;
      }
      case "screen": {
        const strength = envelope(t, event.at, event.durationMs, event.effect === "dim" ? 180 : 40);
        if (event.effect === "dim") dim = Math.max(dim, strength);
        if (event.effect === "flash") flash = Math.max(flash, t < event.at + event.durationMs ? 1 - (t - event.at) / event.durationMs : 0);
        if (event.effect === "cutin" && t < event.at + event.durationMs) cutin = (t - event.at) / event.durationMs;
        if (event.effect === "shake" && t < event.at + event.durationMs) {
          const decay = 1 - (t - event.at) / event.durationMs;
          const phase = Math.floor((t - event.at) / 40);
          shake = { x: Math.round((phase % 2 === 0 ? 6 : -6) * decay), y: Math.round((phase % 3 === 0 ? 2 : -2) * decay) };
        }
        break;
      }
      case "hit": {
        if (t >= event.at + event.durationMs) break;
        const strength = 1 - (t - event.at) / event.durationMs;
        if (event.who === "target") hitTarget = Math.max(hitTarget, strength); else hitAll = Math.max(hitAll, strength);
        break;
      }
      case "sound": break;
    }
  });
  return { pose, flip, move, hidden, fx, projectiles, dim, flash, shake, cutin, hitTarget, hitAll };
}

/** (from, to] 구간에 울릴 효과음. 재생기가 프레임마다 부른다. */
export function retroSoundsBetween(timeline: RetroSkillTimeline, from: number, to: number): readonly string[] {
  return timeline.events.flatMap((event) => (event.kind === "sound" && event.at > from && event.at <= to ? [event.id] : []));
}

/** 타임라인이 쓰는 모든 효과음 id(미리 적재용). */
export function retroTimelineSounds(timeline: RetroSkillTimeline): readonly string[] {
  return [...new Set(timeline.events.flatMap((event) => (event.kind === "sound" ? [event.id] : [])))];
}

