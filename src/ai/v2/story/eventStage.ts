// 컷신 무대 흉내 — 비트를 옮기는 동안 사람들의 자리·방향·보임을 따라가고(StageSim) 걷기 기록·장면 사진 틀을 남긴다. 비평가에게 보일 틀 고르기(stageFrameProject · pickStageFrames)도 여기. 짓기는 events.ts.
import type { Dir, GameEvent, GameMap, Project } from "@/project/types";
import { canMove } from "@/project/collision";
import { chebyshev, planApproach, type ApproachWorld } from "@/project/staging/approach";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { MachineCheck } from "../judge/machineChecks";
import { eventsOf, findMap } from "../place/cells";

export type Cell = { x: number; y: number };

export const PLAYER = "player";

// ───────────────────────── 무대 모의 ─────────────────────────

interface StageActorPos {
  readonly key: string; // "player" 또는 이벤트 id
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly dir: Dir;
  readonly visible: boolean;
}

interface StageFrame {
  readonly label: string;
  readonly actors: readonly StageActorPos[];
}

export interface WalkRecord {
  readonly who: string;
  readonly from: Cell;
  readonly goal: Cell;
  /** 원래 가려던 곳(칸·사람 이름·낱말). */
  readonly intent: string;
  readonly steps: number;
  readonly reached: boolean;
  /** 지나간 칸 중 길(포석) 칸 수. */
  readonly onRoad: number;
  readonly path: readonly Cell[];
}

export interface CutsceneStage {
  readonly mapId: string;
  readonly hostEventId: string;
  readonly frames: readonly StageFrame[];
  readonly walks: readonly WalkRecord[];
  readonly checks: readonly MachineCheck[];
  /** 주인공 칩(그림 틀에 그린다). */
  readonly hero?: { readonly textureKey: string; readonly characterIndex: number };
  readonly letterbox: boolean;
  /** 장면 그림 틀에는 그려지지 않는 연출(화면 색·실루엣·카메라·사라짐) — 비평가에게 글로 알린다. */
  readonly effects?: readonly string[];
}

interface SimActor { cell: Cell; dir: Dir; visible: boolean; name: string }

export const DIR_STEP: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** 이 이벤트가 그 칸을 막는가(런타임: 켜진 페이지 priority same + overlapForbidden). 조건 없는 첫 페이지로 본다. */
function eventBlocks(e: GameEvent): boolean {
  const pages = e.pages ?? [];
  if (!pages.length) return true;
  const page = pages.find((p) => !(p.conditions ?? []).some((c) => (c as { kind?: string; value?: unknown }).kind !== "selfSwitch" || (c as { value?: unknown }).value !== false)) ?? pages[0]!;
  return (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);
}

export class StageSim {
  readonly actors = new Map<string, SimActor>();
  readonly frames: StageFrame[] = [];
  readonly walks: WalkRecord[] = [];
  constructor(readonly project: Project, public map: GameMap, private readonly staticBlock: Set<number>, readonly roads: Set<number>) {}

  refreshMap(map: GameMap, actorIds: ReadonlySet<string>, hostId?: string): void {
    this.map = map;
    this.staticBlock.clear();
    for (const e of eventsOf(map)) if (!actorIds.has(e.id) && e.id !== hostId && eventBlocks(e)) this.staticBlock.add(e.y * map.width + e.x);
  }
  world(mover: string): ApproachWorld {
    const { map, project } = this;
    return {
      width: map.width,
      height: map.height,
      canStep: (a, b) => canMove(project, map, a.x, a.y, b.x, b.y),
      canStand: (c) => {
        if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) return false;
        if (this.staticBlock.has(c.y * map.width + c.x)) return false;
        for (const [key, a] of this.actors) if (key !== mover && a.cell.x === c.x && a.cell.y === c.y) return false;
        return true;
      },
    };
  }
  /** 걸어 닿는 칸까지 걸음 수(BFS, 지금 서 있는 사람들은 못 지난다). */
  distances(from: Cell, mover: string): Map<number, number> {
    const world = this.world(mover);
    const w = this.map.width;
    const out = new Map<number, number>([[from.y * w + from.x, 0]]);
    const q: Cell[] = [from];
    for (let k = 0; k < q.length; k++) {
      const c = q[k]!;
      const d = out.get(c.y * w + c.x)!;
      for (const s of Object.values(DIR_STEP)) {
        const n = { x: c.x + s.x, y: c.y + s.y };
        if (!world.canStand(n) || !world.canStep(c, n)) continue;
        const i = n.y * w + n.x;
        if (out.has(i)) continue;
        out.set(i, d + 1);
        q.push(n);
      }
    }
    return out;
  }
  /** 런타임과 같은 다가가기 계획으로 한 번 걷는다(distance 0 = 그 칸으로). */
  walk(key: string, target: Cell, distance: number): { steps: number; path: Cell[]; goal: Cell; face: Dir | null; reached: boolean } {
    const actor = this.actors.get(key)!;
    const plan = planApproach(this.world(key), actor.cell, target, distance);
    if (!plan) return { steps: 0, path: [actor.cell], goal: actor.cell, face: null, reached: false };
    const path: Cell[] = [actor.cell];
    let cur = actor.cell;
    for (const d of plan.steps) { cur = { x: cur.x + DIR_STEP[d].x, y: cur.y + DIR_STEP[d].y }; path.push(cur); }
    const last = plan.steps.at(-1);
    actor.cell = plan.goal;
    actor.dir = plan.face ?? last ?? actor.dir;
    const reached = distance === 0 ? plan.goal.x === target.x && plan.goal.y === target.y : chebyshev(plan.goal, target) <= Math.max(1, distance) && !plan.fallback;
    return { steps: plan.steps.length, path, goal: plan.goal, face: plan.face, reached };
  }
  snapshot(label: string): void {
    this.frames.push({ label, actors: [...this.actors].map(([key, a]) => ({ key, name: a.name, x: a.cell.x, y: a.cell.y, dir: a.dir, visible: a.visible })) });
  }
  onRoadCount(path: readonly Cell[]): number {
    return path.filter((c) => this.roads.has(c.y * this.map.width + c.x)).length;
  }
}

// ───────────────────────── 장면 그림 틀 ─────────────────────────

/** 장면 그림 틀 하나를 그릴 프로젝트(사람을 모의 자리로 옮기고, 안 보이는 사람·연출 이벤트는 빼고, 주인공을 칩으로 세움)와 잘라 볼 구역. */
export function stageFrameProject(project: Project, stage: CutsceneStage, frame: StageFrame): { project: Project; crop: { x: number; y: number; w: number; h: number } } {
  const map = findMap(project, stage.mapId)!;
  const pos = new Map(frame.actors.map((a) => [a.key, a] as const));
  const cast = new Set(stage.frames.flatMap((f) => f.actors.map((a) => a.key)));
  const events: GameEvent[] = [];
  for (const e of eventsOf(map)) {
    if (e.id === stage.hostEventId) continue;
    const a = pos.get(e.id);
    if (!a && cast.has(e.id)) continue; // 이 순간엔 아직 세우지 않은(나타나기 전) 사람
    if (!a) { events.push(e); continue; }
    if (!a.visible) continue;
    const pages = (e.pages ?? []).map((p, i) => {
      if (i !== 0) return p;
      const g = p.graphic as { sprite?: unknown; pattern?: number } | undefined;
      if (!g?.sprite) return p;
      const characterIndex = typeof g.pattern === "number" && g.pattern >= 3 ? decodeCharsetFrameIndex(g.pattern).characterIndex : 0;
      return { ...p, graphic: { ...g, direction: a.dir, pattern: charsetFrameIndex({ characterIndex, direction: a.dir, pattern: 1 }) } } as typeof p;
    });
    events.push({ ...e, x: a.x, y: a.y, pages });
  }
  const hero = pos.get(PLAYER);
  if (hero && stage.hero) {
    events.push({
      id: "__stage_hero", x: hero.x, y: hero.y, name: "주인공", trigger: { kind: "action" }, commands: [],
      pages: [{ id: "__stage_hero_p", name: "주인공", conditions: [], trigger: { kind: "action" }, commands: [],
        graphic: { sprite: { type: "bundled", id: stage.hero.textureKey }, direction: hero.dir, pattern: charsetFrameIndex({ characterIndex: stage.hero.characterIndex, direction: hero.dir, pattern: 1 }) } }],
    } as unknown as GameEvent);
  }
  const frameMap = { ...map, events } as GameMap;
  const maps = project.maps as unknown as Record<string, GameMap>;
  const framed = { ...project, maps: { ...maps, [map.id]: frameMap }, startMapId: "" } as unknown as Project;
  // 모든 틀에 같은 구역 — 등장인물·걸음이 다 들어가게(여백 4칸, 최소 20×15).
  const xs = stage.frames.flatMap((f) => f.actors.filter((a) => a.visible).map((a) => a.x)).concat(stage.walks.flatMap((w) => w.path.map((c) => c.x)));
  const ys = stage.frames.flatMap((f) => f.actors.filter((a) => a.visible).map((a) => a.y)).concat(stage.walks.flatMap((w) => w.path.map((c) => c.y)));
  const fit = (lo: number, hi: number, min: number, size: number): [number, number] => {
    let a = Math.max(0, lo - 4), b = Math.min(size - 1, hi + 4);
    while (b - a + 1 < Math.min(min, size)) { if (a > 0) a--; if (b - a + 1 < min && b < size - 1) b++; }
    return [a, b - a + 1];
  };
  const [x, w] = fit(Math.min(...xs), Math.max(...xs), 20, map.width);
  const [y, h] = fit(Math.min(...ys), Math.max(...ys), 15, map.height);
  return { project: framed, crop: { x, y, w, h } };
}

/** 비평가에게 보일 틀 고르기(최대 n): 시작, 걷기 중간·도착, 끝. */
export function pickStageFrames(stage: CutsceneStage, n = 5): StageFrame[] {
  const f = stage.frames;
  if (f.length <= n) return [...f];
  const keep = new Set<number>([0, f.length - 1]);
  for (let i = 1; i < f.length - 1 && keep.size < n; i++) if (/걷는 중|다가오는 중/.test(f[i]!.label)) keep.add(i);
  for (let i = 1; i < f.length - 1 && keep.size < n; i++) keep.add(i);
  return [...keep].sort((a, b) => a - b).map((i) => f[i]!);
}
