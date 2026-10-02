import type { CharacterMotionProfile } from "@/battle/characterMotion";
/** Saved motion programs, shared by editor, runtime and authoring tools. Coordinates are stage anchors, never fixed screen pixels. */
import {
  EXTENDED_POSE_FRAME,
  type ExtendedBattlerPose,
} from "@/battle/battlePose";
export const BATTLE_MOTION_PATTERNS = [
  "stationary",
  "walk",
  "dash",
  "jump",
  "blink",
  "fire",
  "sky",
  "through",
  "clones",
  "pull",
  "freeze",
  "counter",
  "air-chase",
  "throw",
  "return-weapon",
  "bounce",
  "orbit",
  "trap",
  "mark",
  "absorb",
  "cover",
  "swap",
  "relay",
  "summon",
  "transform",
  "charge",
  "zone",
  "sacrifice",
  "sky-crush",
  "marked-spear",
  "mirror-counter",
  "blood-summon",
] as const;
export type BattleMotionPattern = (typeof BATTLE_MOTION_PATTERNS)[number];
export const BATTLE_MOTION_LABELS = [
  "제자리 검풍",
  "걸어 접근",
  "가속 돌진",
  "높이 도약",
  "배후 순간이동",
  "제자리 발사",
  "화면 밖 강하",
  "관통 일섬",
  "분신 협공",
  "끌어당김",
  "시간정지 연타",
  "받아내기 반격",
  "공중 추격",
  "잡기 던지기",
  "관통 후 귀환",
  "도탄 연쇄",
  "궤도 수렴",
  "설치 기폭",
  "표식 회수",
  "흡수 반사",
  "엄호 가로채기",
  "교대 공격",
  "협공 이어받기",
  "지속 소환",
  "변신",
  "차지",
  "장판",
  "대가 환급",
  "공중 압살",
  "표식 귀환창",
  "거울 반격",
  "혈계 소환",
] as const;
export interface BattleMotionProgram {
  pattern: BattleMotionPattern;
  anticipationMs?: number;
  travelMs?: number;
  recoveryMs?: number;
  jumpHeight?: number;
  apexMs?: number;
  acceleration?: number;
  tracks?: MotionTrack[];
}
export type MotionAnchor =
  | "home"
  | "front"
  | "target"
  | "ally"
  | "left"
  | "right"
  | "top"
  | "target2"
  | "target3"
  | "midpoint"
  | "aboveHome"
  | "behind"
  | "exit"
  | "caught"
  | "knockback"
  | "throwMidpoint";
export type MotionCurve =
  | "linear"
  | "pull"
  | "burst"
  | "walk"
  | "rise"
  | "fall"
  | "settle"
  | "flow";
export interface MotionPoint {
  at: number;
  anchor: MotionAnchor;
  x?: number;
  y?: number;
  curve?: MotionCurve;
  pose?: ExtendedBattlerPose;
  alpha?: number;
  flip?: boolean;
}
export type MotionRole =
  | "user"
  | "target"
  | "ally"
  | "cloneA"
  | "cloneB"
  | "summon";
export interface MotionTrack {
  role: MotionRole;
  points: readonly MotionPoint[];
}
export interface MotionContext {
  character?: CharacterMotionProfile;
  casting?: boolean;
  hit?: boolean;
  /** Actual contact facts, in timeline order (including mixed hit/miss actions). */
  contactHits?: readonly boolean[];
  /** The action could not start. Separate from an optional gimmick failing to trigger. */
  actionBlocked?: boolean;
  ally?: boolean;
  triggered?: boolean;
  preparing?: boolean;
  /** Collateral contacts do not postpone the primary actor landing. */
  primaryContacts?: number;
}
export interface MotionPosition {
  x: number;
  y: number;
  alpha: number;
  pose?: ExtendedBattlerPose;
  flip: boolean;
}
export type MotionAnchors = Readonly<
  Record<
    Exclude<
      MotionAnchor,
      | "midpoint"
      | "aboveHome"
      | "behind"
      | "exit"
      | "caught"
      | "knockback"
      | "throwMidpoint"
    >,
    { x: number; y: number }
  >
>;
export function normalizeBattleMotionProgram(
  raw: unknown,
): BattleMotionProgram | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  if (!(BATTLE_MOTION_PATTERNS as readonly unknown[]).includes(v.pattern))
    return undefined;
  const out: BattleMotionProgram = {
    pattern: v.pattern as BattleMotionPattern,
  };
  const bounds = {
    anticipationMs: [40, 800],
    travelMs: [80, 1200],
    recoveryMs: [100, 1000],
    jumpHeight: [24, 360],
    apexMs: [0, 400],
    acceleration: [0.2, 3],
  } as const;
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const n = v[key];
    if (typeof n === "number" && Number.isFinite(n))
      out[key] = Math.max(bounds[key][0], Math.min(bounds[key][1], n));
  }
  if (Array.isArray(v.tracks)) {
    const roles = ["user", "target", "ally", "cloneA", "cloneB", "summon"],
      anchors = [
        "home",
        "front",
        "target",
        "ally",
        "left",
        "right",
        "top",
        "target2",
        "target3",
        "midpoint",
        "aboveHome",
        "behind",
        "exit",
        "caught",
        "knockback",
        "throwMidpoint",
      ],
      curves = [
        "linear",
        "pull",
        "burst",
        "walk",
        "rise",
        "fall",
        "settle",
        "flow",
      ];
    const seen = new Set<string>();
    out.tracks = v.tracks.slice(0, 6).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const t = raw as Record<string, unknown>;
      if (
        typeof t.role !== "string" ||
        !roles.includes(t.role) ||
        seen.has(t.role) ||
        !Array.isArray(t.points)
      )
        return [];
      const points = t.points
        .slice(0, 48)
        .flatMap((raw) => {
          if (!raw || typeof raw !== "object") return [];
          const p = raw as Record<string, unknown>;
          if (
            typeof p.at !== "number" ||
            !Number.isFinite(p.at) ||
            typeof p.anchor !== "string" ||
            !anchors.includes(p.anchor)
          )
            return [];
          const point: MotionPoint = {
            at: Math.round(Math.max(0, Math.min(10000, p.at))),
            anchor: p.anchor as MotionAnchor,
          };
          for (const axis of ["x", "y"] as const)
            if (typeof p[axis] === "number" && Number.isFinite(p[axis]))
              point[axis] = Math.max(-1000, Math.min(1000, p[axis]));
          if (typeof p.curve === "string" && curves.includes(p.curve))
            point.curve = p.curve as MotionCurve;
          if (
            typeof p.pose === "string" &&
            Object.hasOwn(EXTENDED_POSE_FRAME, p.pose)
          )
            point.pose = p.pose as ExtendedBattlerPose;
          if (typeof p.alpha === "number" && Number.isFinite(p.alpha))
            point.alpha = Math.max(0, Math.min(1, p.alpha));
          if (typeof p.flip === "boolean") point.flip = p.flip;
          return [point];
        })
        .sort((a, b) => a.at - b.at);
      if (points.length < 2) return [];
      seen.add(t.role);
      return [{ role: t.role as MotionRole, points }];
    });
    if (!out.tracks.length) delete out.tracks;
  }
  return out;
}
export function motionProgress(
  curve: MotionCurve | undefined,
  u: number,
  acceleration = 1,
): number {
  u = Math.max(0, Math.min(1, u));
  switch (curve) {
    case "pull":
      return u ** 3;
    case "rise":
      return 1 - (1 - u) ** 2;
    case "fall":
      return u ** 2;
    case "settle":
      return u * u * (3 - 2 * u);
    case "flow":
      return u;
    case "burst": {
      const ramp = Math.max(0.1, Math.min(0.65, 0.24 / acceleration));
      return u < ramp
        ? (u * u) / (2 * ramp * (1 - ramp / 2))
        : (u - ramp / 2) / (1 - ramp / 2);
    }
    case "walk": {
      const r = 0.18;
      return u < r
        ? (u * u) / (2 * r * (1 - r))
        : u > 1 - r
          ? 1 - (1 - u) ** 2 / (2 * r * (1 - r))
          : (u - r / 2) / (1 - r);
    }
    default:
      return u;
  }
}
export function motionPositionAt(
  track: MotionTrack,
  t: number,
  anchors: MotionAnchors,
  acceleration = 1,
): MotionPosition {
  const points = track.points;
  let i = 0;
  while (i + 1 < points.length && points[i + 1]!.at <= t) i++;
  const a = points[i]!,
    b = points[Math.min(i + 1, points.length - 1)]!;
  const u =
    b.at === a.at
      ? 1
      : motionProgress(b.curve, (t - a.at) / (b.at - a.at), acceleration);
  const coordinate = (axis: "x" | "y"): number => {
    const anchor = (name: MotionAnchor): { x: number; y: number } => {
      const direction = Math.sign(anchors.target.x - anchors.home.x) || -1;
      switch (name) {
        case "midpoint":
          return {
            x: (anchors.home.x + anchors.front.x) / 2,
            y: (anchors.home.y + anchors.front.y) / 2,
          };
        case "aboveHome":
          return { x: anchors.home.x, y: anchors.top.y };
        case "behind":
          return {
            x: 2 * anchors.target.x - anchors.front.x,
            y: anchors.target.y,
          };
        case "exit":
          return direction < 0 ? anchors.left : anchors.right;
        case "caught":
          return {
            x: anchors.home.x + (anchors.target.x - anchors.home.x) * 0.28,
            y: anchors.home.y,
          };
        case "throwMidpoint":
          return { x: anchors.target.x + direction * 28, y: anchors.target.y };
        case "knockback":
          return { x: anchors.target.x + direction * 56, y: anchors.target.y };
        default:
          return anchors[name];
      }
    };
    const value = (p: MotionPoint) => anchor(p.anchor)[axis] + (p[axis] ?? 0);
    const av = value(a),
      bv = value(b);
    // Gravity affects height, not horizontal velocity. The apex must not stop forward travel.
    const progress =
      axis === "x" && (b.curve === "rise" || b.curve === "fall")
        ? Math.max(0, Math.min(1, (t - a.at) / Math.max(1, b.at - a.at)))
        : u;
    if (b.curve !== "flow" || a === b) return av + (bv - av) * progress;
    const prev = points[Math.max(0, i - 1)]!,
      next = points[Math.min(points.length - 1, i + 2)]!,
      span = b.at - a.at;
    const slope = (left: MotionPoint, right: MotionPoint) =>
      (value(right) - value(left)) / Math.max(1, right.at - left.at);
    const tangent = (l: number, r: number) =>
      l * r <= 0 ? 0 : (2 * l * r) / (l + r);
    const current = slope(a, b),
      m0 = prev === a ? current : tangent(slope(prev, a), current),
      m1 = next === b ? current : tangent(current, slope(b, next));
    return (
      (2 * u ** 3 - 3 * u * u + 1) * av +
      (u ** 3 - 2 * u * u + u) * span * m0 +
      (-2 * u ** 3 + 3 * u * u) * bv +
      (u ** 3 - u * u) * span * m1
    );
  };
  return {
    x: coordinate("x"),
    y: coordinate("y"),
    alpha: a.alpha ?? 1,
    pose:
      a.pose === "walk_a" && a !== b
        ? (["walk_a", "walk_b", "walk_c", "walk_b"] as const)[
            Math.floor(Math.max(0, t - a.at) / 85) % 4
          ]
        : a.pose,
    flip: a.flip === true,
  };
}
/** Each contact is authored once. Motion reaches that contact at the same millisecond as the hit fact. */
export function buildBattleMotionTracks(
  program: BattleMotionProgram,
  contacts: readonly number[],
  context: MotionContext = {},
): readonly MotionTrack[] {
  if (context.actionBlocked)
    return [
      {
        role: "user",
        points: [
          { at: 0, anchor: "home", pose: "idle" },
          { at: 500, anchor: "home", pose: "idle" },
        ],
      },
    ];
  if (program.tracks?.length)
    return normalizeBattleMotionProgram(program)?.tracks ?? program.tracks;
  const primary = contacts.slice(0, context.primaryContacts ?? contacts.length);
  const beats = primary.length ? primary : [600];
  const h = beats[0]!,
    last = beats.at(-1)!,
    wind = program.anticipationMs ?? 140,
    travel = program.travelMs ?? 180,
    recover = program.recoveryMs ?? 300,
    height = program.jumpHeight ?? 100;
  const start = Math.max(0, h - travel - wind),
    go = Math.max(start + 40, h - travel);
  const end = last + recover + 180;
  const tracks: MotionTrack[] = [];
  const pt = (
    at: number,
    anchor: MotionAnchor,
    pose: ExtendedBattlerPose = "idle",
    extra: Partial<MotionPoint> = {},
  ): MotionPoint => ({
    at: Math.max(0, Math.round(at)),
    anchor,
    pose,
    ...extra,
  });
  const add = (role: MotionRole, points: MotionPoint[]) => {
    // Last authored pose wins at a shared timestamp (zero-duration anticipation etc.).
    const sorted = [...new Map(points.map((p) => [p.at, p])).values()].sort(
      (a, b) => a.at - b.at,
    );
    tracks.push({ role, points: sorted });
  };
  const idle = pt(0, "home"),
    ready = pt(start, "home", "attack_windup");
  const strikes = (
    anchor: MotionAnchor,
    times: readonly number[] = beats,
    y = 0,
  ) =>
    times.flatMap((at, i) => [
      ...(i ? [pt(at - 65, anchor, "attack_windup", { y })] : []),
      pt(at, anchor, "attack_strike", { y }),
      ...(i === times.length - 1
        ? [
            pt(
              at + 55,
              anchor,
              context.hit === false ? "evade" : "attack_follow",
              { y },
            ),
          ]
        : []),
    ]);
  // A readable landing, then a short backward hop: never slide home holding the strike cell.
  const recoverFromFront = (after = last): MotionPoint[] => [
    pt(after + 100, "front", "evade"),
    pt(after + 100 + (end - after - 145) / 2, "midpoint", "evade", {
      y: -18,
      curve: "rise",
    }),
    pt(end - 45, "home", "defend", { curve: "fall" }),
    pt(end, "home"),
  ];
  const approach = [
    idle,
    ready,
    pt(go, "home", "walk_b"),
    pt(h - 45, "front", "attack_windup", { curve: "burst" }),
  ];
  const dash = [...approach, ...strikes("front"), ...recoverFromFront()];
  const stationary = [
    idle,
    pt(start, "home", "cast_charge"),
    pt(go, "home", "cast_raise"),
    pt(h, "home", "cast_release"),
    pt(last + 120, "home"),
    pt(end, "home"),
  ];
  const p = program.pattern,
    hit = context.hit !== false,
    ally = context.ally !== false,
    trigger = context.triggered !== false;
  switch (p) {
    case "stationary":
    case "mark":
    case "marked-spear":
      add("user", [
        idle,
        ready,
        ...strikes("home"),
        pt(last + 120, "home"),
        pt(end, "home"),
      ]);
      break;
    case "walk": {
      const arrival = h - 90,
        points = [idle, pt(go, "home", "walk_a")];
      // Explicit footsteps are shared by player, previews and exported custom paths.
      points.push(
        pt(arrival, "front", "attack_windup", { curve: "walk" }),
        ...strikes("front"),
        pt(last + 120, "front", "walk_a", { flip: true }),
        pt(end - 40, "home", "idle", { curve: "walk" }),
        pt(end, "home"),
      );
      add("user", points);
      break;
    }
    case "jump": {
      const hold = Math.min(program.apexMs ?? 0, (h - go) * 0.25),
        apexAt = go + (h - go - hold) * 0.5;
      add("user", [
        idle,
        pt(start, "home", "defend"),
        pt(go, "home", "evade"),
        pt(apexAt, "midpoint", "attack_windup", { y: -height, curve: "rise" }),
        ...(hold
          ? [pt(apexAt + hold, "midpoint", "attack_windup", { y: -height })]
          : []),
        pt(h, "front", "attack_strike", { curve: "fall" }),
        ...strikes("front").slice(1),
        ...recoverFromFront(),
      ]);
      break;
    }
    case "sky":
      add("user", [
        idle,
        pt(start, "home", "defend"),
        pt(go, "home", "evade"),
        pt(go + (h - go) * 0.35, "aboveHome", "evade", {
          alpha: 0,
          curve: "rise",
        }),
        pt(h - Math.min(180, (h - go) * 0.4), "top", "attack_windup", {
          alpha: 1,
        }),
        ...strikes("front").map((q, i) =>
          i === 0 ? { ...q, curve: "fall" as const } : q,
        ),
        ...recoverFromFront(),
      ]);
      break;
    case "blink":
      add("user", [
        idle,
        ready,
        pt(go, "home", "evade", { alpha: 0 }),
        pt(h - 70, "behind", "attack_windup", { flip: true }),
        ...strikes("behind").map((q) => ({ ...q, flip: true })),
        pt(last + 130, "behind", "evade", { alpha: 0, flip: true }),
        pt(end, "home"),
      ]);
      break;
    case "through":
      add("user", [
        idle,
        ready,
        pt(go, "home", "walk_b"),
        pt(h, "front", "attack_strike", { curve: "burst" }),
        pt(h + 180, "exit", "attack_follow", { alpha: 0 }),
        pt(end - 90, "home", "evade", { alpha: 0 }),
        pt(end, "home"),
      ]);
      break;
    case "clones":
      add("user", stationary);
      for (const [n, role] of (["cloneA", "cloneB"] as const).entries()) {
        const own = beats.filter((_, i) => i % 2 === n),
          anchor = n ? "behind" : "front";
        if (!own.length) continue;
        const first = own[0]!,
          final = own.at(-1)!;
        add(role, [
          pt(0, "home", "idle", { alpha: 0 }),
          pt(first - 170, "home", "walk_b", { alpha: 0.7 }),
          pt(first - 40, anchor, "attack_windup", {
            curve: "burst",
            flip: !!n,
          }),
          ...strikes(anchor, own).map((q) => ({ ...q, alpha: 0.7, flip: !!n })),
          pt(final + 110, anchor, "evade", { alpha: 0, flip: !!n }),
          pt(end, anchor, "idle", { alpha: 0 }),
        ]);
      }
      break;
    case "air-chase":
    case "sky-crush": {
      if (!hit || beats.length < 2) {
        add("user", dash);
        break;
      }
      const second = beats[1]!,
        land = p === "sky-crush" && beats.length > 2 ? last : last + 180;
      const airHits = beats.slice(1).filter((at) => at < land);
      const lift = second - h;
      add("user", [
        ...approach,
        ...strikes("front", [h]),
        pt(h + Math.min(80, lift * 0.25), "front", "evade"),
        pt(second - 60, "front", "attack_windup", {
          y: -height,
          curve: "rise",
        }),
        ...strikes("front", airHits, -height),
        pt(land - 80, "front", "attack_windup", { y: -height }),
        pt(land, "front", land === last ? "attack_strike" : "defend", {
          curve: "fall",
        }),
        ...recoverFromFront(land),
      ]);
      add("target", [
        pt(0, "target"),
        pt(h, "target", "hit"),
        pt(second - 60, "target", "hit", { y: -height, curve: "rise" }),
        pt(land - 80, "target", "hit", { y: -height }),
        pt(land, "target", "hit", { curve: "fall" }),
        pt(land + 120, "target", "idle"),
        pt(end, "target"),
      ]);
      break;
    }
    case "counter":
    case "mirror-counter":
      add(
        "user",
        context.preparing
          ? [idle, pt(start, "home", "defend"), pt(end, "home", "defend")]
          : trigger
            ? [
                idle,
                pt(start, "home", "defend"),
                ...approach.slice(2),
                ...strikes("front"),
                ...recoverFromFront(),
              ]
            : [
                idle,
                pt(h, "home", "hit"),
                pt(h + 120, "home"),
                pt(end, "home"),
              ],
      );
      break;
    case "cover":
      add(
        "user",
        context.preparing
          ? [idle, pt(start, "home", "defend"), pt(end, "home")]
          : trigger
            ? [
                idle,
                pt(go, "home", "walk_b"),
                pt(h, "ally", "defend", { curve: "burst" }),
                pt(last + 120, "ally", "walk_a", { flip: true }),
                pt(end, "home", "idle", { curve: "walk" }),
              ]
            : stationary,
      );
      break;
    case "swap":
    case "relay":
      add("user", [
        ...approach,
        ...strikes("front", [h]),
        ...recoverFromFront(h),
      ]);
      if (ally && hit && beats.length > 1)
        add("ally", [
          pt(0, "ally"),
          pt(h + 60, "ally", "walk_b"),
          pt(beats[1]! - 50, "front", "attack_windup", { curve: "burst" }),
          ...strikes("front", beats.slice(1)),
          pt(last + 120, "front", "walk_a", { flip: true }),
          pt(end, "ally", "idle", { curve: "walk" }),
        ]);
      break;
    case "summon":
    case "blood-summon":
      add("user", stationary);
      if (trigger)
        add("summon", [
          pt(0, "home", "idle", { alpha: 0 }),
          pt(go, "home", "walk_b"),
          pt(h - 50, "front", "attack_windup", { curve: "burst" }),
          ...strikes("front"),
          pt(last + 120, "front", "evade", { alpha: 0 }),
          pt(end, "home", "idle", { alpha: 0 }),
        ]);
      break;
    case "transform":
      add("user", [
        idle,
        pt(start, "home", "cast_charge"),
        pt(h, "home", "victory"),
        pt(end, "home"),
      ]);
      break;
    case "trap":
      add("user", [
        idle,
        pt(go, "home", "item"),
        pt(h, "home", "defend"),
        pt(end, "home"),
      ]);
      break;
    case "dash":
    case "sacrifice":
    case "throw":
    case "freeze":
      add("user", dash);
      break;
    default:
      add("user", stationary);
  }
  if (hit) {
    if (p === "pull")
      add("target", [
        pt(0, "target"),
        pt(go, "target", "hit"),
        pt(h, "caught", "hit", { curve: "pull" }),
        pt(last + 100, "caught", "evade"),
        pt(end, "target", "idle", { curve: "walk" }),
      ]);
    if (p === "throw") {
      const land = beats[1] ?? h + 260;
      add("target", [
        pt(0, "target"),
        pt(h, "target", "hit"),
        pt(h + (land - h) * 0.5, "throwMidpoint", "hit", {
          y: -height * 0.6,
          curve: "rise",
        }),
        pt(land, "knockback", "hit", { curve: "fall" }),
        pt(land + 110, "knockback", "evade"),
        pt(end, "target", "idle", { curve: "walk" }),
      ]);
    }
    if (p === "freeze")
      add("target", [
        pt(0, "target"),
        pt(h, "target", "hit"),
        pt(last + 100, "target", "hit"),
        pt(end, "target"),
      ]);
  }
  return tracks;
}
/** Basic attacks retain their key poses and contacts while sharing skill acceleration/gravity curves. */
export function sampleBasicMotion(
  keys: readonly { offset: number; translate: string }[],
  progress: number,
  style: "dash" | "flash" | "leap",
): { x: number; y: number } {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1]!.offset <= progress) i++;
  const a = keys[i]!,
    b = keys[Math.min(i + 1, keys.length - 1)]!;
  const parse = (s: string) =>
      s.split(" ").map((v) => Number.parseFloat(v) || 0),
    [x, y] = parse(a.translate),
    [bx, by] = parse(b.translate);
  const u =
    b.offset === a.offset
      ? 1
      : Math.max(0, Math.min(1, (progress - a.offset) / (b.offset - a.offset)));
  const travel = Math.abs(bx! - x!) > 20;
  const curve: MotionCurve =
    style === "leap"
      ? by! < y! - 8
        ? "rise"
        : by! > y! + 8
          ? "fall"
          : "settle"
      : travel
        ? "burst"
        : "settle";
  const p = motionProgress(curve, u);
  return { x: x! + (bx! - x!) * p, y: y! + (by! - y!) * p };
}
