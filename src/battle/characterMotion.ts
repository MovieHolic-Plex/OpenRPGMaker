import type {
  BattleMotionProgram,
  MotionTrack,
  MotionPoint,
} from "@/battle/battleMotionProgram";

export const CHARACTER_MOTION_STYLES = [
  "balanced",
  "heavy",
  "agile",
  "lancer",
  "martial",
  "ranged",
  "caster",
  "beast",
  "floating",
  "vehicle",
  "soft",
] as const;
export type CharacterMotionStyle = (typeof CHARACTER_MOTION_STYLES)[number];
export const CHARACTER_MOTION_LABELS: Record<CharacterMotionStyle, string> = {
  balanced: "검술 · 균형",
  heavy: "중량 · 버티기",
  agile: "민첩 · 파고들기",
  lancer: "창술 · 긴 간격",
  martial: "체술 · 근접",
  ranged: "사격 · 반동",
  caster: "영창 · 절제",
  beast: "야수 · 도약",
  floating: "부유 · 활공",
  vehicle: "탈것 · 관성",
  soft: "연체 · 탄성",
};
/** Authored actor overrides. Undefined fields inherit the common class/body preset. */
export interface CharacterMotionSettings {
  style?: CharacterMotionStyle;
  anticipation?: number;
  travel?: number;
  recovery?: number;
  reach?: number;
  jump?: number;
  recoil?: number;
}
export interface CharacterMotionProfile {
  contactOffset?: number;
  style: CharacterMotionStyle;
  source: string;
  anticipation: number;
  travel: number;
  recovery: number;
  reach: number;
  jump: number;
  recoil: number;
  acceleration: number;
  returnMode: "step" | "hop" | "glide" | "roll";
}
// Coherent authored families; never pseudo-random variation by actor id.
const PRESETS: Record<
  CharacterMotionStyle,
  Omit<CharacterMotionProfile, "style" | "source">
> = {
  balanced: {
    anticipation: 1,
    travel: 1,
    recovery: 1,
    reach: 0,
    jump: 1,
    recoil: 1,
    acceleration: 1,
    returnMode: "step",
  },
  heavy: {
    anticipation: 1.5,
    travel: 1.3,
    recovery: 1.45,
    reach: 2,
    jump: 0.6,
    recoil: 0.35,
    acceleration: 1.4,
    returnMode: "step",
  },
  agile: {
    anticipation: 0.65,
    travel: 0.7,
    recovery: 0.75,
    reach: -4,
    jump: 1.1,
    recoil: 1.25,
    acceleration: 1.5,
    returnMode: "hop",
  },
  lancer: {
    anticipation: 1.15,
    travel: 0.95,
    recovery: 1.05,
    reach: 14,
    jump: 1.2,
    recoil: 0.85,
    acceleration: 1.2,
    returnMode: "step",
  },
  martial: {
    anticipation: 0.8,
    travel: 0.85,
    recovery: 0.8,
    reach: -8,
    jump: 0.8,
    recoil: 0.8,
    acceleration: 1.25,
    returnMode: "step",
  },
  ranged: {
    anticipation: 1.1,
    travel: 1,
    recovery: 1.1,
    reach: 0,
    jump: 0.7,
    recoil: 0.9,
    acceleration: 1,
    returnMode: "step",
  },
  caster: {
    anticipation: 1.35,
    travel: 1.1,
    recovery: 1.15,
    reach: 0,
    jump: 0.65,
    recoil: 1.1,
    acceleration: 0.8,
    returnMode: "step",
  },
  beast: {
    anticipation: 0.85,
    travel: 0.75,
    recovery: 0.9,
    reach: -10,
    jump: 0.85,
    recoil: 0.85,
    acceleration: 1.4,
    returnMode: "hop",
  },
  floating: {
    anticipation: 1.15,
    travel: 1.2,
    recovery: 1.25,
    reach: 0,
    jump: 0.8,
    recoil: 0.6,
    acceleration: 0.65,
    returnMode: "glide",
  },
  vehicle: {
    anticipation: 1.25,
    travel: 1.4,
    recovery: 1.6,
    reach: -3,
    jump: 0.3,
    recoil: 0.25,
    acceleration: 0.75,
    returnMode: "roll",
  },
  soft: {
    anticipation: 1.3,
    travel: 0.9,
    recovery: 1.25,
    reach: -7,
    jump: 0.65,
    recoil: 1.5,
    acceleration: 1.3,
    returnMode: "hop",
  },
};
const KEYS = [
  "anticipation",
  "travel",
  "recovery",
  "reach",
  "jump",
  "recoil",
] as const;
export function normalizeCharacterMotion(
  value: unknown,
): CharacterMotionSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const v = value as Record<string, unknown>,
    out: CharacterMotionSettings = {};
  if (CHARACTER_MOTION_STYLES.includes(v.style as CharacterMotionStyle))
    out.style = v.style as CharacterMotionStyle;
  for (const key of KEYS) {
    const n = v[key];
    if (typeof n === "number" && Number.isFinite(n))
      out[key] = Math.max(
        key === "reach" ? -20 : key === "recoil" ? 0 : 0.4,
        Math.min(key === "reach" ? 24 : 2, n),
      );
  }
  return Object.keys(out).length ? out : undefined;
}
export function characterMotionProfile(
  style: CharacterMotionStyle,
  source: string,
  overrides?: CharacterMotionSettings,
): CharacterMotionProfile {
  const settings = normalizeCharacterMotion(overrides),
    chosen = settings?.style ?? style;
  return { ...PRESETS[chosen], style: chosen, source, ...settings };
}
/** Timings are applied before contact scheduling so pose, sound and impact retain one clock. */
export function characterMotionProgram(
  program: BattleMotionProgram,
  profile: CharacterMotionProfile,
): BattleMotionProgram {
  if (program.tracks?.length) return program; // authored absolute paths have explicit timing/poses
  return {
    ...program,
    anticipationMs: Math.round(
      (program.anticipationMs ?? 140) * profile.anticipation,
    ),
    travelMs: Math.round((program.travelMs ?? 180) * profile.travel),
    recoveryMs: Math.round((program.recoveryMs ?? 300) * profile.recovery),
    jumpHeight: (program.jumpHeight ?? 100) * profile.jump,
    acceleration: (program.acceleration ?? 1) * profile.acceleration,
  };
}
/** Distinct recovery mechanics and preparation, without stretching sprite pixels. */
export function characterMotionTracks(
  tracks: readonly MotionTrack[],
  profile: CharacterMotionProfile,
  contacts: readonly number[],
  custom = false,
  casting = false,
): readonly MotionTrack[] {
  if (custom) return tracks;
  const last = contacts.at(-1) ?? 600;
  return tracks.map((track) => {
    if (!["user", "cloneA", "cloneB"].includes(track.role)) return track;
    let points = track.points.map((p) => ({ ...p }));
    const recovered = points.findIndex(
      (p) => p.at > last && p.anchor === "front" && p.pose === "evade",
    );
    if (recovered >= 0 && profile.returnMode !== "hop") {
      const first = points[recovered]!,
        end = points.at(-1)!;
      const pose = profile.returnMode === "step" ? "walk_a" : "evade";
      const recovery: MotionPoint[] = [
        { ...first, pose, flip: profile.returnMode === "step" },
        {
          at: end.at - 40,
          anchor: "home",
          pose: "idle",
          curve: profile.returnMode === "step" ? "walk" : "flow",
        },
        { ...end },
      ];
      points = [...points.slice(0, recovered), ...recovery];
    }
    if (profile.returnMode === "glide" || profile.returnMode === "roll") {
      points = points.map((p) => ({
        ...p,
        pose: p.pose?.startsWith("walk_") ? "evade" : p.pose,
        curve: p.curve === "walk" || p.curve === "burst" ? "flow" : p.curve,
      }));
    }
    if (profile.style === "lancer")
      points = points.map((p) => ({
        ...p,
        pose: p.pose === "attack_strike" ? "attack" : p.pose,
      }));
    if (casting) {
      points = points.map((p) => ({
        ...p,
        pose:
          p.pose === "attack_windup"
            ? "cast_charge"
            : p.pose === "attack_strike" ||
                p.pose === "attack" ||
                p.pose === "attack_follow"
              ? "cast_release"
              : p.pose,
      }));
      const first = contacts[0];
      if (first !== undefined)
        points.push({
          at: Math.max(0, first - 85),
          anchor: "home",
          pose: "cast_raise",
        });
      points.sort((a, b) => a.at - b.at);
    }
    // Preserve the drawn body; style differences come from timing and poses.
    return { ...track, points };
  });
}

/** Legacy skill motion remains the semantic choice; a profile supplies execution style. */
export function defaultCharacterProgram(
  motion: string,
  style: CharacterMotionStyle,
): BattleMotionProgram {
  const pattern: BattleMotionProgram["pattern"] =
    motion === "leap-strike"
      ? "jump"
      : motion === "blink-strike"
        ? "blink"
        : motion === "shoot"
          ? "fire"
          : ["cast", "buff", "breath"].includes(motion)
            ? "stationary"
            : style === "ranged"
              ? "fire"
              : style === "caster" && motion === "finisher"
                ? "stationary"
                : "dash";
  return { pattern };
}
