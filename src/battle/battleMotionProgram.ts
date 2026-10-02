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
  | "target3";
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
  hit?: boolean;
  ally?: boolean;
  triggered?: boolean;
  preparing?: boolean;
}
export interface MotionPosition {
  x: number;
  y: number;
  alpha: number;
  pose?: ExtendedBattlerPose;
  flip: boolean;
}
export type MotionAnchors = Readonly<
  Record<MotionAnchor, { x: number; y: number }>
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
    const value = (p: MotionPoint) => anchors[p.anchor][axis] + (p[axis] ?? 0);
    const av = value(a),
      bv = value(b);
    if (b.curve !== "flow" || a === b) return av + (bv - av) * u;
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
    pose: a.pose,
    flip: a.flip === true,
  };
}
/** Each contact is authored once. Motion reaches that contact at the same millisecond as the hit fact. */
export function buildBattleMotionTracks(
  program: BattleMotionProgram,
  contacts: readonly number[],
  context: MotionContext = {},
): readonly MotionTrack[] {
  if (program.tracks?.length)
    return normalizeBattleMotionProgram(program)?.tracks ?? program.tracks;
  const h = contacts[0] ?? 600,
    last = contacts.at(-1) ?? h,
    wind = program.anticipationMs ?? 140,
    travel = program.travelMs ?? 180,
    recover = program.recoveryMs ?? 300,
    height = program.jumpHeight ?? 100,
    apex = program.apexMs ?? 80;
  const start = Math.max(0, h - travel - wind),
    go = Math.max(start + 40, h - travel),
    end = last + recover + 180;
  const tracks: MotionTrack[] = [];
  const pt = (
    at: number,
    anchor: MotionAnchor,
    pose: ExtendedBattlerPose = "idle",
    extra: Partial<MotionPoint> = {},
  ): MotionPoint => ({ at: Math.max(0, at), anchor, pose, ...extra });
  const add = (role: MotionRole, points: MotionPoint[]) => {
    points.sort((a, b) => a.at - b.at);
    tracks.push({ role, points });
  };
  const idle = pt(0, "home"),
    ready = pt(start, "home", "attack_windup"),
    back = pt(end, "home", "idle", { curve: "settle" });
  const dash = [
    idle,
    ready,
    pt(go, "home", "front", { x: 8, curve: "pull" }),
    pt(h, "front", "attack", { curve: "burst" }),
    pt(last + 70, "front", "attack", { x: -10 }),
    back,
  ];
  const leap = [
    idle,
    ready,
    pt(go, "home", "front", { y: 3 }),
    pt(Math.max(go, h - travel * 0.48 - apex), "front", "front", {
      y: -height,
      curve: "rise",
    }),
    pt(Math.max(go, h - travel * 0.48), "front", "front", { y: -height }),
    pt(h, "front", "attack", { curve: "fall" }),
    pt(h + 100, "front", "attack"),
    back,
  ];
  const stationary = [
    idle,
    pt(start, "home", "cast_charge"),
    pt(go, "home", "cast_raise"),
    pt(h, "home", "cast_release"),
    pt(last + 160, "home"),
    back,
  ];
  const p = program.pattern,
    hit = context.hit !== false,
    ally = context.ally !== false,
    trigger = context.triggered !== false;
  switch (p) {
    case "stationary":
      add("user", [
        idle,
        ready,
        pt(h, "home", "attack_strike"),
        pt(h + 65, "home", "attack"),
        back,
      ]);
      break;
    case "mark":
    case "marked-spear":
      add("user", [
        idle,
        ready,
        ...contacts.map((at) => pt(at, "home", "attack")),
        back,
      ]);
      break;
    case "walk":
      add("user", [
        idle,
        ready,
        pt(go, "home", "front"),
        pt(h, "front", "attack", { curve: "walk" }),
        back,
      ]);
      break;
    case "dash":
    case "sacrifice":
      add("user", dash);
      break;
    case "jump":
      add("user", leap);
      break;
    case "sky-crush":
      add(
        "user",
        hit && contacts.length > 1
          ? [
              ...dash.slice(0, 4),
              pt(h + 140, "front", "front"),
              pt(last - 140 - apex, "top", "front", {
                alpha: 0,
                curve: "rise",
              }),
              pt(last - 140, "top", "attack", { alpha: 1 }),
              pt(last, "front", "attack", { curve: "fall" }),
              back,
            ]
          : dash,
      );
      break;
    case "sky":
      add("user", [
        idle,
        ready,
        pt(go, "home", "front"),
        pt(Math.max(go + 20, h - 160 - apex), "top", "front", {
          alpha: 0,
          curve: "rise",
        }),
        pt(h - 160, "top", "attack", { alpha: 1 }),
        pt(h, "front", "attack", { curve: "fall" }),
        back,
      ]);
      break;
    case "blink":
      add("user", [
        idle,
        ready,
        pt(go, "home", "front", { alpha: 0 }),
        pt(h - 60, "target", "attack_windup", { x: -32, alpha: 1, flip: true }),
        pt(h, "target", "attack", { x: -32, flip: true }),
        pt(last + 120, "target", "attack", { x: -32, alpha: 0 }),
        pt(end, "home"),
      ]);
      break;
    case "through":
      add("user", [
        idle,
        ready,
        pt(go, "home", "front", { x: 8 }),
        pt(h, "front", "attack", { curve: "burst" }),
        pt(h + 220, "left", "attack", { alpha: 0, curve: "linear" }),
        pt(end, "home"),
      ]);
      break;
    case "clones":
      add("user", stationary);
      for (const [n, role] of (["cloneA", "cloneB"] as const).entries())
        add(role, [
          pt(0, "home", "idle", { alpha: 0 }),
          pt(go, "home", "front", { y: (n ? 1 : -1) * 24, alpha: 0.55 }),
          pt(h + n * 70, "target", "attack", {
            x: n ? -30 : 30,
            y: 0,
            curve: "burst",
            flip: !!n,
          }),
          pt(last + 120, "target", "idle", { alpha: 0 }),
          pt(end, "home", "idle", { alpha: 0 }),
        ]);
      break;
    case "air-chase":
      add(
        "user",
        hit
          ? [
              ...dash.slice(0, 4),
              pt(h + 160, "front", "attack", { y: -height, curve: "rise" }),
              pt(Math.max(last, h + 320), "front", "attack", { curve: "fall" }),
              back,
            ]
          : dash,
      );
      break;
    case "throw":
      add("user", dash);
      break;
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
                pt(go, "home", "attack_windup"),
                pt(h, "front", "attack", { curve: "burst" }),
                back,
              ]
            : [idle, pt(h, "home", "hit"), back],
      );
      break;
    case "cover":
      add(
        "user",
        context.preparing
          ? [idle, pt(start, "home", "defend"), back]
          : trigger
            ? [
                idle,
                pt(go, "home", "defend"),
                pt(h, "ally", "defend", { x: -24, curve: "burst" }),
                back,
              ]
            : stationary,
      );
      break;
    case "swap":
    case "relay":
      add("user", dash);
      if (ally && hit)
        add("ally", [
          pt(0, "ally"),
          pt(h, "ally", "front"),
          pt(last, "front", "attack", { curve: "burst" }),
          pt(end, "ally"),
        ]);
      break;
    case "summon":
    case "blood-summon":
      add("user", p === "blood-summon" ? dash : stationary);
      if (trigger)
        add("summon", [
          pt(0, "home", "idle", { alpha: 0 }),
          pt(go, "home", "front", { x: -36, alpha: 1 }),
          pt(h, "front", "attack", { curve: "burst" }),
          pt(end, "home", "idle", { x: -36 }),
        ]);
      break;
    case "freeze":
      add("user", [
        idle,
        ready,
        ...contacts.map((at, i) =>
          pt(at, "front", i % 2 ? "attack_strike" : "attack"),
        ),
        back,
      ]);
      break;
    case "transform":
      add("user", [
        idle,
        pt(start, "home", "cast_charge"),
        pt(h, "home", "victory"),
        back,
      ]);
      break;
    case "trap":
      add("user", [
        idle,
        pt(go, "home", "item"),
        pt(h, "home", "defend"),
        back,
      ]);
      break;
    default:
      add("user", stationary);
  }
  if (hit) {
    let target: MotionPoint[] | undefined;
    if (p === "pull")
      target = [
        pt(0, "target"),
        pt(go, "target"),
        pt(h, "front", "hit", { x: -24, curve: "pull" }),
        pt(end, "target", "idle", { curve: "settle" }),
      ];
    if (["air-chase", "sky-crush"].includes(p))
      target = [
        pt(0, "target"),
        pt(h, "target", "hit"),
        pt(h + 160, "target", "hit", { y: -height, curve: "rise" }),
        pt(Math.max(last, h + 320), "target", "hit", { curve: "fall" }),
        pt(end, "target"),
      ];
    if (p === "throw")
      target = [
        pt(0, "target"),
        pt(h, "front", "hit", { x: -24 }),
        pt(Math.max(last, h + 220), "target", "hit", { x: -90, y: -12, curve: "burst" }),
        pt(end, "target", "idle", { curve: "settle" }),
      ];
    if (p === "freeze")
      target = [
        pt(0, "target"),
        pt(h, "target", "hit"),
        pt(last + 100, "target", "hit"),
        pt(end, "target"),
      ];
    if (target) add("target", target);
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
