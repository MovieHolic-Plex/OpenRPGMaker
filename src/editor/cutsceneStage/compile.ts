// 연출 선언 레이어 — 「배우 + 관계 + 타이밍」을 script_cutscene beat 로 컴파일한다(순수 함수).
// 조수는 픽셀 좌표를 계산하지 않는다. «트럭 앞면이 인물 몸통에 35% 파고든다», «화면 오른쪽 밖에서 들어온다» 처럼
// 다른 배우·화면 기준의 관계를 쓰면, 그림 크기를 아는 이 컴파일러가 좌표를 정한다.
// 좌표 규약: 배우의 위치는 «발 밑 가운데»(x = 가로 중심, y = 바닥) 픽셀. 모든 그림은 100% 배율(도트 크기를 섞지 않는다).
// 같은 때에 겹쳐 도는 일(withPrevious)은 시각 표를 합쳐 wait 로 이어 붙인다 — parallel beat 와 달리 걷기 프레임 교체·이징도 동시에 돈다.

export type Side = "left" | "right" | "top" | "bottom";
export type Facing = "left" | "right";

export interface PlaceSpec {
  readonly x?: number; readonly y?: number;
  /** 화면 비율(0~1) 위치 — 발 밑 가운데 기준. */
  readonly fx?: number; readonly fy?: number;
  /** 현재 위치에서의 변위(px). */
  readonly dx?: number; readonly dy?: number;
  /** 다른 배우 옆. side 는 그 배우의 어느 쪽인가("front" 는 그 배우가 바라보는 쪽). */
  readonly at?: string; readonly side?: Side | "front" | "back"; readonly gap?: number;
  /** 다른 배우와 몸이 겹치게(0~1: 상대 몸 폭 중 파고드는 비율). 움직이는 배우의 앞면이 상대 안으로 들어간다. */
  readonly touch?: string; readonly overlap?: number;
  /** 화면 밖 — 그 방향 화면 가장자리 바깥(그림이 완전히 가려지는 곳). 나머지 축은 현재 위치. */
  readonly offscreen?: Side;
}

export type StageStep =
  | { readonly do: "show"; readonly actor: string; readonly to?: PlaceSpec; readonly pose?: string }
  | { readonly do: "hide"; readonly actor: string }
  | { readonly do: "move"; readonly actor: string; readonly to: PlaceSpec; readonly ms?: number; readonly ease?: "linear" | "in" | "out" | "inout"; readonly anim?: "walk" }
  | { readonly do: "enter"; readonly actor: string; readonly from: Side; readonly to: PlaceSpec; readonly ms?: number; readonly ease?: "linear" | "in" | "out" | "inout"; readonly anim?: "walk" }
  | { readonly do: "exit"; readonly actor: string; readonly to: Side; readonly ms?: number; readonly ease?: "linear" | "in" | "out" | "inout"; readonly anim?: "walk" }
  | { readonly do: "pose"; readonly actor: string; readonly pose: string }
  | { readonly do: "fling"; readonly actor: string; readonly dir?: Side; readonly ms?: number; readonly spin?: number }
  | { readonly do: "say"; readonly speaker?: string; readonly text: string; readonly context?: string; readonly autoAdvance?: boolean }
  | { readonly do: "wait"; readonly ms: number }
  | { readonly do: "flash" | "shake"; readonly ms?: number; readonly intensity?: number }
  | { readonly do: "se" | "bgm"; readonly resourceId: string }
  | { readonly do: "whiteout"; readonly ms?: number }
  | { readonly do: "expect"; readonly touching: readonly [string, string]; readonly min?: number };

export type TimedStep = StageStep & { readonly withPrevious?: boolean };

export interface StageActor {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly facing: Facing;
  /** 포즈 이름 → picture 리소스 id. "default" 가 시작 그림. */
  readonly poses: Readonly<Record<string, string>>;
  /** 방향별 걷기 프레임 [0,1,2] picture id(캐릭터셋 배우만). */
  readonly walk?: Readonly<Partial<Record<Side | "down" | "up", readonly [string, string, string]>>>;
  readonly at?: PlaceSpec;
  readonly z?: number;
}

export interface StageInput {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly backdrop?: { readonly id: string; readonly width: number; readonly height: number };
  readonly actors: readonly StageActor[];
  readonly steps: readonly TimedStep[];
  readonly whiteResourceId: string;
}

export interface StageResult {
  readonly beats: Record<string, unknown>[];
  /** 접촉·기대 검사 결과(겹침 비율). */
  readonly contacts: readonly { readonly step: number; readonly pair: string; readonly overlap: number }[];
  readonly durationMs: number;
  readonly layout: Readonly<Record<string, { readonly x: number; readonly y: number; readonly width: number; readonly height: number }>>;
}

export class StageError extends Error {
  constructor(message: string, readonly stepIndex?: number) {
    super(stepIndex === undefined ? message : `steps[${stepIndex}]: ${message}`);
    this.name = "StageError";
  }
}

interface ActorState {
  readonly spec: StageActor;
  readonly pictureId: string;
  x: number; y: number;
  shown: boolean;
  pose: string;
  walkPhase: number;
}

interface TimedEvent { readonly t: number; readonly order: number; readonly beat: Record<string, unknown> }

const WALK_STEP_MS = 230;
const WALK_CYCLE = [1, 0, 1, 2] as const;
const EASE: Record<NonNullable<Extract<StageStep, { do: "move" }>["ease"]>, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inout: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
};
const round = (n: number): number => Math.round(n);

export function compileStage(input: StageInput): StageResult {
  const { viewport: { width: W, height: H } } = input;
  const states = new Map<string, ActorState>();
  input.actors.forEach((spec, index) => {
    if (states.has(spec.name)) throw new StageError(`배우 이름 '${spec.name}' 이 중복됩니다.`);
    states.set(spec.name, { spec, pictureId: `pic${spec.z ?? 2 + index}`, x: W / 2, y: H / 2, shown: false, pose: "default", walkPhase: 0 });
  });
  const actorOf = (name: unknown, stepIndex: number): ActorState => {
    const found = typeof name === "string" ? states.get(name) : undefined;
    if (!found) throw new StageError(`배우 '${String(name)}' 가 actors 에 없습니다(있는 배우: ${[...states.keys()].join(", ") || "없음"}).`, stepIndex);
    return found;
  };
  const box = (a: ActorState): { x0: number; y0: number; x1: number; y1: number } => ({ x0: a.x - a.spec.width / 2, y0: a.y - a.spec.height, x1: a.x + a.spec.width / 2, y1: a.y });
  const resourceOf = (a: ActorState): string => a.spec.poses[a.pose] ?? a.spec.poses.default!;

  const place = (a: ActorState, spec: PlaceSpec, stepIndex: number): { x: number; y: number } => {
    if (spec.offscreen) {
      const halfW = a.spec.width / 2 + 8;
      if (spec.offscreen === "left") return { x: -halfW, y: a.y };
      if (spec.offscreen === "right") return { x: W + halfW, y: a.y };
      if (spec.offscreen === "top") return { x: a.x, y: -8 };
      return { x: a.x, y: H + a.spec.height + 8 };
    }
    if (spec.touch !== undefined) {
      const other = actorOf(spec.touch, stepIndex);
      const ob = box(other);
      const overlap = Math.max(0.05, Math.min(0.95, spec.overlap ?? 0.35));
      const dive = overlap * other.spec.width;
      // 움직이는 배우의 앞면(바라보는 쪽 가장자리)이 상대 몸 안으로 dive 만큼 들어간다. 세로는 상대 발 높이 + dy.
      const cx = a.spec.facing === "left" ? ob.x1 - dive + a.spec.width / 2 : ob.x0 + dive - a.spec.width / 2;
      return { x: round(cx), y: round(other.y + (spec.dy ?? 0)) };
    }
    if (spec.at !== undefined) {
      const other = actorOf(spec.at, stepIndex);
      const ob = box(other);
      const gap = spec.gap ?? 2;
      let side = spec.side ?? "right";
      if (side === "front") side = other.spec.facing;
      if (side === "back") side = other.spec.facing === "left" ? "right" : "left";
      if (side === "left") return { x: round(ob.x0 - gap - a.spec.width / 2), y: round(other.y) };
      if (side === "right") return { x: round(ob.x1 + gap + a.spec.width / 2), y: round(other.y) };
      if (side === "top") return { x: round(other.x), y: round(ob.y0 - gap) };
      return { x: round(other.x), y: round(other.y + gap + a.spec.height) };
    }
    let x = a.x, y = a.y;
    if (spec.x !== undefined) x = spec.x;
    if (spec.fx !== undefined) x = spec.fx * W;
    if (spec.y !== undefined) y = spec.y;
    if (spec.fy !== undefined) y = spec.fy * H;
    if (spec.dx !== undefined) x += spec.dx;
    if (spec.dy !== undefined) y += spec.dy;
    return { x: round(x), y: round(y) };
  };

  const topLeft = (a: ActorState, x = a.x, y = a.y): { x: number; y: number } => ({ x: round(x - a.spec.width / 2), y: round(y - a.spec.height) });
  const showBeats = (a: ActorState): Record<string, unknown>[] => {
    const p = topLeft(a);
    return [
      ...(a.shown ? [{ kind: "picture", action: "erase", pictureId: a.pictureId }] : []),
      { kind: "picture", action: "show", pictureId: a.pictureId, resourceId: resourceOf(a), x: p.x, y: p.y },
    ];
  };

  const directionOf = (dx: number, dy: number): "up" | "down" | "left" | "right" => (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down");

  /** 한 걸음 시퀀스 → 시각 표. 시작 시각 t0. */
  const moveEvents = (a: ActorState, to: { x: number; y: number }, ms: number, ease: keyof typeof EASE, anim: "walk" | undefined, t0: number, order: { n: number }): TimedEvent[] => {
    const events: TimedEvent[] = [];
    const walkFrames = anim === "walk" ? a.spec.walk?.[directionOf(to.x - a.x, to.y - a.y)] : undefined;
    const segments = walkFrames ? Math.max(1, round(ms / WALK_STEP_MS)) : ease === "linear" ? 1 : 6;
    const from = { x: a.x, y: a.y };
    for (let i = 1; i <= segments; i += 1) {
      const t = t0 + ((i - 1) * ms) / segments;
      const k = EASE[ease](i / segments);
      const px = from.x + (to.x - from.x) * k, py = from.y + (to.y - from.y) * k;
      if (walkFrames) {
        const frame = walkFrames[WALK_CYCLE[(a.walkPhase + i - 1) % WALK_CYCLE.length]!];
        const cur = topLeft(a, from.x + (to.x - from.x) * EASE[ease]((i - 1) / segments), from.y + (to.y - from.y) * EASE[ease]((i - 1) / segments));
        events.push({ t, order: order.n++, beat: { kind: "picture", action: "erase", pictureId: a.pictureId } });
        events.push({ t, order: order.n++, beat: { kind: "picture", action: "show", pictureId: a.pictureId, resourceId: frame, x: cur.x, y: cur.y } });
      }
      const dest = topLeft(a, px, py);
      events.push({ t, order: order.n++, beat: { kind: "picture", action: "move", pictureId: a.pictureId, x: dest.x, y: dest.y, durationMs: round(ms / segments) } });
    }
    if (walkFrames) {
      a.walkPhase += segments;
      a.pose = "default";
    }
    a.x = to.x; a.y = to.y;
    return events;
  };

  const out: Record<string, unknown>[] = [];
  const contacts: { step: number; pair: string; overlap: number }[] = [];
  let clock = 0;

  // 시작 상태: 배경, at 이 있는 배우는 처음부터 보인다.
  if (input.backdrop) {
    const scale = round((W / input.backdrop.width) * 100);
    out.push({ kind: "fade", direction: "out", durationMs: 0 });
    out.push({ kind: "picture", action: "show", pictureId: "pic1", resourceId: input.backdrop.id, x: 0, y: 0, scale });
  }
  for (const a of states.values()) {
    if (!a.spec.at) continue;
    const p = place(a, a.spec.at, -1);
    a.x = p.x; a.y = p.y;
    out.push(...showBeats(a));
    a.shown = true;
  }
  if (input.backdrop) out.push({ kind: "fade", direction: "in", durationMs: 700, wait: true });

  // 단계를 «같은 때» 묶음으로 나눈다.
  const groups: { index: number; step: TimedStep }[][] = [];
  input.steps.forEach((step, index) => {
    if (step.withPrevious && groups.length > 0) groups.at(-1)!.push({ index, step });
    else groups.push([{ index, step }]);
  });

  const flush = (events: TimedEvent[], duration: number): void => {
    const sorted = [...events].sort((x, y) => x.t - y.t || x.order - y.order);
    let at = 0;
    for (const event of sorted) {
      if (event.t > at) { out.push({ kind: "wait", ms: round(event.t - at) }); at = event.t; }
      out.push(event.beat);
    }
    if (duration > at) out.push({ kind: "wait", ms: round(duration - at) });
    clock += duration;
  };

  for (const group of groups) {
    const events: TimedEvent[] = [];
    const order = { n: 0 };
    let duration = 0;
    for (const { index, step } of group) {
      const end = (ms: number): void => { duration = Math.max(duration, ms); };
      switch (step.do) {
        case "say": {
          if (group.length > 1) throw new StageError("say 는 다른 단계와 동시에(withPrevious) 할 수 없습니다 — 대사는 플레이어가 읽을 때까지 멈춥니다.", index);
          out.push({ kind: "say", ...(step.speaker ? { speaker: step.speaker } : {}), text: step.text, context: step.context ?? "speech", ...(step.autoAdvance ? { autoAdvance: true } : {}) });
          break;
        }
        case "wait": end(Math.max(0, step.ms)); break;
        case "show": {
          const a = actorOf(step.actor, index);
          if (step.pose) { if (!a.spec.poses[step.pose]) throw new StageError(`배우 '${a.spec.name}' 에 포즈 '${step.pose}' 가 없습니다(있는 포즈: ${Object.keys(a.spec.poses).join(", ")}).`, index); a.pose = step.pose; }
          if (step.to) { const p = place(a, step.to, index); a.x = p.x; a.y = p.y; }
          for (const beat of showBeats(a)) events.push({ t: 0, order: order.n++, beat });
          a.shown = true;
          break;
        }
        case "hide": {
          const a = actorOf(step.actor, index);
          events.push({ t: 0, order: order.n++, beat: { kind: "picture", action: "erase", pictureId: a.pictureId } });
          a.shown = false;
          break;
        }
        case "pose": {
          const a = actorOf(step.actor, index);
          if (!a.spec.poses[step.pose]) throw new StageError(`배우 '${a.spec.name}' 에 포즈 '${step.pose}' 가 없습니다(있는 포즈: ${Object.keys(a.spec.poses).join(", ")}).`, index);
          a.pose = step.pose;
          for (const beat of showBeats(a)) events.push({ t: 0, order: order.n++, beat });
          a.shown = true;
          break;
        }
        case "move": {
          const a = actorOf(step.actor, index);
          if (!a.shown) throw new StageError(`배우 '${a.spec.name}' 가 아직 화면에 없습니다 — 먼저 show/enter 하세요.`, index);
          const ms = Math.max(0, step.ms ?? 500);
          events.push(...moveEvents(a, place(a, step.to, index), ms, step.ease ?? "linear", step.anim, 0, order));
          end(ms);
          break;
        }
        case "enter": {
          const a = actorOf(step.actor, index);
          const start = place(a, { offscreen: step.from }, index);
          // 들어오는 쪽 가장자리 바깥에서 목표의 높이로 시작한다(세로 진입이 아니면 y 는 목표 y).
          const target = place(a, step.to, index);
          a.x = step.from === "left" || step.from === "right" ? start.x : target.x;
          a.y = step.from === "left" || step.from === "right" ? target.y : start.y;
          if (step.from === "top" || step.from === "bottom") a.x = target.x;
          for (const beat of showBeats(a)) events.push({ t: 0, order: order.n++, beat });
          a.shown = true;
          const ms = Math.max(0, step.ms ?? 600);
          events.push(...moveEvents(a, target, ms, step.ease ?? "linear", step.anim, 0, order));
          end(ms);
          break;
        }
        case "exit": {
          const a = actorOf(step.actor, index);
          const ms = Math.max(0, step.ms ?? 600);
          events.push(...moveEvents(a, place(a, { offscreen: step.to }, index), ms, step.ease ?? "linear", step.anim, 0, order));
          events.push({ t: ms, order: order.n++, beat: { kind: "picture", action: "erase", pictureId: a.pictureId } });
          a.shown = false;
          end(ms);
          break;
        }
        case "fling": {
          const a = actorOf(step.actor, index);
          const ms = Math.max(0, step.ms ?? 800);
          const dir = step.dir ?? (a.spec.facing === "left" ? "left" : "right");
          const p = topLeft(a);
          const far = dir === "left" ? { x: p.x - W * 0.35, y: -a.spec.height * 2 } : dir === "right" ? { x: p.x + W * 0.35, y: -a.spec.height * 2 } : dir === "top" ? { x: p.x, y: -a.spec.height * 3 } : { x: p.x, y: H + a.spec.height };
          events.push({ t: 0, order: order.n++, beat: { kind: "picture", action: "move", pictureId: a.pictureId, x: round(far.x), y: round(far.y), scale: 200, rotation: step.spin ?? 720, opacity: 0, durationMs: ms } });
          a.shown = false;
          end(ms);
          break;
        }
        case "flash": events.push({ t: 0, order: order.n++, beat: { kind: "flash", color: "white", durationMs: step.ms ?? 600 } }); break;
        case "shake": events.push({ t: 0, order: order.n++, beat: { kind: "shake", intensity: step.intensity ?? 9, durationMs: step.ms ?? 900 } }); break;
        case "se": events.push({ t: 0, order: order.n++, beat: { kind: "music", action: "se", resourceId: step.resourceId } }); break;
        case "bgm": events.push({ t: 0, order: order.n++, beat: { kind: "music", action: "bgm", resourceId: step.resourceId } }); break;
        case "whiteout": {
          const ms = step.ms ?? 900;
          const scale = Math.max(W, H) * 50;
          events.push({ t: 0, order: order.n++, beat: { kind: "picture", action: "show", pictureId: "pic90", resourceId: input.whiteResourceId, x: 0, y: 0, scale, opacity: 0 } });
          events.push({ t: 0, order: order.n++, beat: { kind: "picture", action: "move", pictureId: "pic90", x: 0, y: 0, scale, opacity: 255, durationMs: ms } });
          end(ms);
          break;
        }
        case "expect": {
          const [na, nb] = step.touching;
          const a = actorOf(na, index), b = actorOf(nb, index);
          if (!a.shown || !b.shown) throw new StageError(`expect: '${na}' 와 '${nb}' 가 모두 화면에 있어야 합니다(지금 '${!a.shown ? na : nb}' 는 숨겨져 있음).`, index);
          const ba = box(a), bb = box(b);
          const w = Math.max(0, Math.min(ba.x1, bb.x1) - Math.max(ba.x0, bb.x0)), h = Math.max(0, Math.min(ba.y1, bb.y1) - Math.max(ba.y0, bb.y0));
          const ratio = Math.max(w * h / (a.spec.width * a.spec.height), w * h / (b.spec.width * b.spec.height));
          const min = step.min ?? 0.1;
          contacts.push({ step: index, pair: `${na}↔${nb}`, overlap: Math.round(ratio * 100) / 100 });
          if (ratio < min) {
            throw new StageError(`'${na}' 와 '${nb}' 가 이 시점에 닿지 않습니다(겹침 ${Math.round(ratio * 100)}% < ${Math.round(min * 100)}%). 닿게 하려면 앞 단계의 to 를 {touch:'${nb}', overlap:0.35} 로 쓰세요.`, index);
          }
          break;
        }
      }
    }
    flush(events, duration);
  }

  const layout: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const [name, a] of states) layout[name] = { x: round(a.x), y: round(a.y), width: a.spec.width, height: a.spec.height };
  return { beats: out, contacts, durationMs: clock, layout };
}
