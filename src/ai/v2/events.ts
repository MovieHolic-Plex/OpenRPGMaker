// 조수 v2 — 이벤트(컷신) 빌더.
//
// 모델은 «누가 나타나고, 누가 어디로 걷고, 무슨 말을 하는가»(EventBeat)만 쓴다. 칸 번호·이벤트 id 는 이 파일이 정한다:
//  - 비트를 차례로 «실제 통행 격자 위에서» 되짚는다(무대 모의). 걷기마다 런타임과 같은 길찾기(project/staging/approach planApproach)로
//    실제 걸음 수·도착 칸을 재고, 3칸 미만이거나 목적지에 못 닿으면 다른 목적 칸을 고른다(2026-10-23 눈가림 비교: 목표 칸이 집에 막혀
//    주인공이 1~2걸음만 걸었는데 검사·비평 모두 문제 0).
//  - «길로 걸어 나온다»: 시작 칸에서 가장 가까운 길(포석) 칸으로 들어서 길을 따라 4~9칸, 마을 안쪽으로. 굽은 곳마다 경유 칸을 둬
//    런타임 길찾기가 풀밭으로 질러가지 않게 한다.
//  - «다가온다»: 다가오는 사람은 그 순간 주인공에게서 걸어서 4~8칸(가능하면 길 위·주인공 앞쪽)에서 나타나 바로 옆까지 걸어와 마주 선다.
//  - 레터박스 켜고 시작 → 끝에 걷기, 다가온 뒤 마주 보기, 등장인물은 컷신 뒤에도 말을 걸면 대답한다(appear.talk 또는 역할 기본 한 줄).
//  - 게임 시작 컷신은 맵마다 하나 — add_event 를 다시 부르면 앞 컷신(과 그 컷신이 만든 사람)을 바꾼다(겹쳐 쌓지 않는다).
//  - 결과에 무대(stage: 걷기 기록·기계 검사 cutscene-walk·장면 그림 틀)를 싣는다 — 동사가 그 틀을 1배로 그려 비평가에게 보인다.
// «나타남»은 컷신 비트에 따로 없다 — 처음에 투명(look alpha 0)으로 두었다가 그 순간 alpha 1 로 켠다(걸어 들어오는 게 아니라 «팍» 나타남).
import type { Command, Dir, GameEvent, GameMap, Project } from "@/project/types";
import { canMove } from "@/project/collision";
import { startStateOf } from "@/project/session";
import { chebyshev, planApproach, type ApproachWorld } from "@/project/staging/approach";
import { probeCutscene } from "@/editor/cutscenePreview/probe";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { MachineCheck } from "./checks";
import {
  dist, edgeExitCells, eventsOf, findMap, keepsMapConnected, objectAt, placeNpcWithGraphic, resolveWhere, roadCellSet,
  shortestPathCells, transferCells, walkReach, walkStart, eventBlockers,
} from "./people";
import type { BuildRun, ContentBuildResult, EventBeat, EventSpec } from "./types";

export const EVENT_CARD =
  "이벤트(events) 명세: {kind:'cutscene'|'talk'|'trigger', when?:'game-start'|'touch'|'talk', mapId?, where?, at?, beats:[…]}. " +
  "after:'촌장' = 그 NPC 와 대화가 끝나면 이어서(그 NPC 대화 끝에 붙고 한 번만), afterTalk:[…] = 장면 뒤 그 NPC 가 할 말(밤이 됐으면 밤 인사처럼 바뀐 상황에 맞게). " +
  "cutscene+game-start = 게임이 시작되면 한 번만 자동 재생(시작 맵, 맵마다 하나 — 다시 부르면 앞 컷신을 바꾼다). 비트 do: " +
  "walk{who,to}=걷기(to=길·광장·입구·문 앞 같은 자리 낱말, 다른 사람 이름이면 그 곁으로 걸어가 마주 선다, {x,y} 는 꼭 필요할 때만) / " +
  "say{who,text}=대사 / appear{who,where?,looks?,talk?}=그 자리에 «팍» 나타남(where 생략 가능 — 뒤에 주인공에게 걸어오면 함수가 4~8칸 떨어진 길 위를 고른다; talk=컷신 뒤 말 걸면 할 말 배열) / " +
  "face{who,toward}=바라봄 / wait{ms} / fade{dir:'in'|'out'} / " +
  "tint{tone:'night'|'dusk'|'dawn'|'sepia'|'clear'}=화면 색(밤이 되면 컷신 뒤에도 밤으로 남는다, 되돌리려면 clear) / weather{weather:'rain'|'storm'|'snow'|'fog'|'none',intensity?:0~1}=실제 날씨(비가 오기 시작한다 → weather rain; tint 로 흉내 내지 않는다, 컷신 뒤에도 남는다) / shake{strength?:'weak'|'medium'|'strong',axis?:'vertical'(지진·쿵)|'horizontal'(부딪힘),ms?}=화면 흔들림(지진은 camera 로 흉내 내지 않는다) / flash{color?:'white'|'#rrggbb',ms?}=번쩍(번개·폭발 — fade 로 흉내 내지 않는다) / music{action:'bgm'|'se'|'stop'|'fade',query}=배경 음악 바꾸기(축제·전투 음악 등)·효과음 — query 는 음원 낱말 / camera{to}=카메라를 자리 낱말·사람·'x,y' 로 옮겨 보여 줌, to:'back' 이면 주인공에게 복귀(빠뜨려도 끝에 돌아온다) / " +
  "look{who,as:'shadow'|'ghost'|'normal'}=검은 실루엣·반투명 유령·원래 모습 / vanish{who}=연기처럼 사라짐(«지나가는» 그림자는 등장한 반대쪽 자리 낱말로 걸어가 사라진다 — 다른 사람 곁으로 걸으면 «찾아온» 장면이 된다). " +
  "대사 속 마을·사람 이름은 맵 이름·기존 NPC 대사에 있는 것을 그대로 쓴다(새로 짓지 않는다). " +
  "who: 주인공·player·hero = 플레이어, 그 밖의 이름 = 컷신에 나타나는 사람(appear 로 먼저 등장시키거나 맵에 이미 있는 NPC 이름). " +
  "함수가 모든 걸음을 실제 통행 격자로 모의해 3칸 미만·못 닿는 걷기를 고치고, 레터박스·마주 보기를 넣고, 장면 그림 몇 장을 비평가가 본다.";

type Cell = { x: number; y: number };

const HERO = /^(주인공|플레이어|용사|player|hero|protagonist)$/i;
const ROAD = /^(길|도로|큰길|길가|길 ?위|마을 ?길|골목|거리|road|street|path|way)$/i;
const PLAYER = "player";
/** 게임 시작 컷신 자리(맵마다 하나)와 그 컷신이 만든 사람의 id 머리 — 다시 부르면 이것들을 바꾼다. */
const START_HOST_ID = "ev_v2cut_start";
const START_ACTOR_PREFIX = "ev_v2cut_a_";
const MIN_WALK = 3;
/** 장면에만 나오는 사람이 한 장면에서 걷는 걸음 상한(한 걸음 약 ¼초 — 24걸음이면 6초 남짓). */
const SCENE_WALK_BUDGET = 24;
/** 그중 한 번 걷기 상한 — 첫 걷기가 예산을 다 먹지 않게. */
const SCENE_WALK_LEG = 14;
/** tint 비트의 화면 색 — 'r,g,b,알파' 덮개(밤은 푸른 어둠), sepia 는 회상 필터, clear 는 원래대로. */
const TINT_TONES: Record<string, string> = { night: "20,30,80,0.5", dusk: "170,80,40,0.28", dawn: "255,190,150,0.18", sepia: "sepia", clear: "" };

function isHero(who: string): boolean {
  return HERO.test(who.trim());
}

// ───────────────────────── 무대 모의 ─────────────────────────

export interface StageActorPos {
  readonly key: string; // "player" 또는 이벤트 id
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly dir: Dir;
  readonly visible: boolean;
}
export interface StageFrame {
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
export type EventBuildResult = ContentBuildResult & { readonly stage?: CutsceneStage };

interface SimActor { cell: Cell; dir: Dir; visible: boolean; name: string }

const DIR_STEP: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** 이 이벤트가 그 칸을 막는가(런타임: 켜진 페이지 priority same + overlapForbidden). 조건 없는 첫 페이지로 본다. */
function eventBlocks(e: GameEvent): boolean {
  const pages = e.pages ?? [];
  if (!pages.length) return true;
  const page = pages.find((p) => !(p.conditions ?? []).some((c) => (c as { kind?: string; value?: unknown }).kind !== "selfSwitch" || (c as { value?: unknown }).value !== false)) ?? pages[0]!;
  return (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);
}

class StageSim {
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

/** 길(포석) 칸 — 칩셋에 길 이름표가 없으면 시작에서 맵 밖으로 나가는 최단 길. */
function roadsFor(project: Project, map: GameMap): Set<number> {
  const roads = roadCellSet(project, map);
  if (roads.size >= 6) return roads;
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  const reach = walkReach(project, map, start, blockers);
  const exit = edgeExitCells(map, reach).filter((c) => dist(c, start) > 1).sort((a, b) => dist(a, start) - dist(b, start))[0];
  return exit ? shortestPathCells(project, map, start, exit, blockers) : roads;
}

/**
 * «길로 걸어 나온다»: 가장 가까운 길 칸으로 들어서(이미 길이면 그 칸), 길만 밟아 4~9칸 — 마을 안쪽(맵 가운데) 쪽으로.
 * 굽은 곳마다 경유 칸을 돌려준다(런타임 길찾기가 풀밭으로 질러가지 않게).
 */
function planRoadWalk(sim: StageSim, key: string): Cell[] | undefined {
  const { map } = sim;
  const w = map.width;
  const from = sim.actors.get(key)!.cell;
  const reach = sim.distances(from, key);
  const roads = sim.roads;
  let entry: Cell | undefined;
  let best = Infinity;
  for (const i of roads) {
    const d = reach.get(i);
    if (d === undefined || d >= best) continue;
    best = d;
    entry = { x: i % w, y: Math.floor(i / w) };
  }
  if (!entry || best > 12) return undefined;
  // 길만 밟는 BFS.
  const world = sim.world(key);
  const rdist = new Map<number, number>([[entry.y * w + entry.x, 0]]);
  const prev = new Map<number, number>();
  const q: Cell[] = [entry];
  for (let k = 0; k < q.length; k++) {
    const c = q[k]!;
    const d = rdist.get(c.y * w + c.x)!;
    if (d >= 12) continue;
    for (const s of Object.values(DIR_STEP)) {
      const n = { x: c.x + s.x, y: c.y + s.y };
      const i = n.y * w + n.x;
      if (!roads.has(i) || rdist.has(i) || !world.canStand(n) || !world.canStep(c, n)) continue;
      rdist.set(i, d + 1);
      prev.set(i, c.y * w + c.x);
      q.push(n);
    }
  }
  const centre = { x: (w - 1) / 2, y: (map.height - 1) / 2 };
  const edgeGap = (c: Cell) => Math.min(c.x, c.y, w - 1 - c.x, map.height - 1 - c.y);
  const freeSide = (c: Cell) => [{ x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y }].some((n) => world.canStand(n) && world.canStep(c, n));
  let target: Cell | undefined;
  let score = Infinity;
  for (const [i, rd] of rdist) {
    if (rd < 4 || rd > 10) continue;
    const t = { x: i % w, y: Math.floor(i / w) };
    if (best + rd < 4) continue;
    const gain = dist(entry, centre) - dist(t, centre);
    let open = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (reach.has((t.y + dy) * w + t.x + dx) && t.x + dx >= 0 && t.x + dx < w) open++;
    const s = Math.abs(rd - 6) * 0.6 - gain * 0.5 + (edgeGap(t) < 3 ? 6 : 0) + (objectAt(map, t) ? 4 : 0) + (freeSide(t) ? 0 : 3) - open * 0.5;
    if (s < score) { score = s; target = t; }
  }
  if (!target) return undefined;
  // 길 위 경로 → 굽는 칸마다 경유.
  const cells: Cell[] = [];
  for (let i: number | undefined = target.y * w + target.x; i !== undefined; i = prev.get(i)) cells.unshift({ x: i % w, y: Math.floor(i / w) });
  const waypoints: Cell[] = [];
  if (best > 0) waypoints.push(entry);
  for (let k = 1; k < cells.length - 1; k++) {
    const a = cells[k - 1]!, b = cells[k]!, c = cells[k + 1]!;
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) waypoints.push(b);
  }
  waypoints.push(target);
  return waypoints;
}

/** 다가오는 사람이 나타날 자리: 지금 주인공에게서 걸어서 4~8칸, 길 위·주인공 앞쪽 먼저, 지붕·가구 밑 아님, 길을 막지 않음. */
function approachSpot(sim: StageSim, hero: Cell, heroDir: Dir, avoid: readonly Cell[]): Cell | undefined {
  const { map, project } = sim;
  const w = map.width;
  const reach = sim.distances(hero, PLAYER);
  const transfers = new Set(transferCells(map).map((c) => c.y * w + c.x));
  const avoidSet = new Set(avoid.map((c) => c.y * w + c.x));
  const ahead = DIR_STEP[heroDir];
  const ranked: { c: Cell; s: number }[] = [];
  for (const [i, d] of reach) {
    if (d < 4 || d > 8) continue;
    const c = { x: i % w, y: Math.floor(i / w) };
    if (transfers.has(i) || avoidSet.has(i) || objectAt(map, c)) continue;
    const dx = c.x - hero.x, dy = c.y - hero.y;
    const front = dx * ahead.x + dy * ahead.y > 0;
    const edge = c.x === 0 || c.y === 0 || c.x === w - 1 || c.y === map.height - 1;
    const sameRowish = Math.abs(dy) <= 2 ? 0 : 0.5; // 옆으로 걸어와 나란히 서는 그림이 3/4 시점에서 잘 읽힌다
    ranked.push({ c, s: Math.abs(d - 5.5) + (sim.roads.has(i) ? 0 : 1.5) + (front ? 0 : 1.5) + (edge ? 3 : 0) + sameRowish });
  }
  ranked.sort((a, b) => a.s - b.s);
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  // 다가오는 길을 미리 걸어 본다 — 실제 걸음(주인공 곁 칸까지, 런타임과 같은 계획)이 4~9 이어야 한다.
  let best: { c: Cell; s: number } | undefined;
  for (const { c, s } of ranked.slice(0, 80)) {
    const steps = approachSteps(sim, c, hero);
    if (steps === undefined || steps < MIN_WALK + 1 || steps > 9) continue;
    const total = s + Math.abs(steps - 5.5) * 0.8;
    if (best && total >= best.s) continue;
    if (!keepsMapConnected(project, map, start, c, blockers)) continue;
    best = { c, s: total };
  }
  return best?.c;
}

/** c 에 선 사람이 주인공 곁(1칸)까지 걷는 걸음 수(런타임 계획). 못 닿으면 undefined. */
function approachSteps(sim: StageSim, c: Cell, hero: Cell): number | undefined {
  const key = "__probe";
  sim.actors.set(key, { cell: c, dir: "down", visible: true, name: key });
  const plan = planApproach(sim.world(key), c, hero, 1);
  sim.actors.delete(key);
  return plan && !plan.fallback ? plan.steps.length : undefined;
}

/** 걷기 목적지를 못 쓸 때(막힘·3칸 미만): 목적지 쪽으로 걸어서 4~7칸인 칸. */
function towardSpot(sim: StageSim, key: string, aim: Cell): Cell | undefined {
  const from = sim.actors.get(key)!.cell;
  const reach = sim.distances(from, key);
  const w = sim.map.width;
  const vx = aim.x - from.x, vy = aim.y - from.y;
  const len = Math.hypot(vx, vy) || 1;
  let best: Cell | undefined;
  let score = Infinity;
  for (const [i, d] of reach) {
    if (d < 4 || d > 7) continue;
    const c = { x: i % w, y: Math.floor(i / w) };
    const along = ((c.x - from.x) * vx + (c.y - from.y) * vy) / len;
    const s = dist(c, aim) * 0.5 - along * 0.5 + Math.abs(d - 5) * 0.3 + (objectAt(sim.map, c) ? 3 : 0) + (sim.roads.has(i) ? 0 : 0.5);
    if (s < score) { score = s; best = c; }
  }
  return best;
}

/** 주인공(파티 맨 앞) 칩 — 그림 틀에 주인공을 그린다. */
function leaderCharset(project: Project): { textureKey: string; characterIndex: number } | undefined {
  const sys = project.system as unknown as { startActorIds?: string[] };
  const actors = ((project.database as unknown as { actors?: { id: string; characterResourceId?: string; characterIndex?: number }[] }).actors) ?? [];
  const leader = actors.find((a) => a.id === sys.startActorIds?.[0]) ?? actors[0];
  const id = leader?.characterResourceId;
  const textureKey = id ? findCharsetAsset(id)?.textureKey : undefined;
  return textureKey ? { textureKey, characterIndex: leader?.characterIndex ?? 0 } : undefined;
}

function npcFace(map: GameMap, eventId: string): string | undefined {
  const ev = (map.events ?? []).find((e) => e.id === eventId);
  for (const c of ev?.pages?.[0]?.commands ?? []) if ((c as { kind?: string }).kind === "changeFace") return (c as { resourceId?: string }).resourceId || undefined;
  return undefined;
}
function heroFace(project: Project): string | undefined {
  const lead = startStateOf(project).partyActorIds[0];
  const actor = lead ? project.database.actors.find((a) => a.id === lead) : undefined;
  return actor?.faceResourceId || undefined;
}

/** 역할로 정한 «컷신 뒤 말 걸면» 한 줄(appear.talk 이 없을 때). */
function defaultFollowUp(name: string, looks: string | undefined): string[] {
  const t = `${name} ${looks ?? ""}`;
  if (/촌장|이장|장로|원로|elder|chief|mayor/i.test(t)) return ["마을을 천천히 둘러보게나. 궁금한 게 있으면 언제든 날 찾아오고."];
  if (/경비|문지기|병사|guard|soldier/i.test(t)) return ["수상한 자가 보이면 바로 알려 주게."];
  if (/상인|점원|주인|merchant|shop/i.test(t)) return ["필요한 게 있으면 들르게나."];
  return ["또 보세."];
}

function findNpcByName(map: GameMap, name: string): GameEvent | undefined {
  const want = name.trim().toLowerCase();
  return eventsOf(map).find((e) => (e.name ?? "").trim().toLowerCase() === want);
}

// ───────────────────────── 빌더 ─────────────────────────

export function buildEvent(run: BuildRun, spec: EventSpec): EventBuildResult {
  const firstCall = run.calls.length;
  const warnings: string[] = [];
  const fail = (summary: string, mapIds: string[] = []): EventBuildResult => ({
    ok: false, mapIds, summary, warnings, missingArt: [], calls: run.calls.slice(firstCall),
  });

  // after(NPC 대화 뒤)는 언제나 말 걸기 장면이다 — kind:'cutscene' 이어도 게임 시작 컷신으로 만들지 않는다.
  const when = spec.after ? "talk" : spec.when ?? (spec.kind === "talk" ? "talk" : spec.kind === "trigger" ? "touch" : "game-start");
  const mapId = spec.mapId ?? run.ctx.project.startMapId;
  let map = findMap(run.ctx.project, mapId);
  if (!map) return fail(`맵 '${mapId}' 이 없다.`);
  if (spec.beats.length === 0) return fail("비트가 비었다.");
  if (when === "game-start" && mapId !== run.ctx.project.startMapId) {
    warnings.push(`game-start 는 시작 맵(${run.ctx.project.startMapId}) 에서만 게임이 열 때 돈다 — '${mapId}' 의 자동 컷신은 그 맵에 들어갈 때 돈다.`);
  }

  // 0) 게임 시작 컷신은 맵마다 하나 — 다시 부르면 앞 컷신이 만든 사람을 지우고 같은 자리 이벤트의 컷신 페이지를 바꾼다.
  const hostId = when === "game-start" ? START_HOST_ID : undefined;
  if (hostId && eventsOf(map).some((e) => e.id === hostId)) {
    const old = eventsOf(map).filter((e) => e.id.startsWith(START_ACTOR_PREFIX));
    for (const e of old) run.call("remove_event", { mapId, eventId: e.id });
    warnings.push(`이 맵의 게임 시작 컷신을 새 비트로 바꿨다(앞 컷신이 세운 사람 ${old.length}명은 지우고 다시 세웠다).`);
    map = findMap(run.ctx.project, mapId) ?? map;
  }

  // 1) 등장 인물 이름 모으기.
  const appearBeat = new Map<string, Extract<EventBeat, { do: "appear" }>>();
  const names: string[] = [];
  const noteName = (n: string): void => { if (!isHero(n) && !names.includes(n)) names.push(n); };
  for (const b of spec.beats) {
    if (b.do === "appear") { noteName(b.who); if (!appearBeat.has(b.who)) appearBeat.set(b.who, b); }
    else if (b.do === "say" || b.do === "walk" || b.do === "face" || b.do === "look" || b.do === "vanish") noteName(b.who);
  }
  const knownName = (s: string): boolean => names.includes(s) || !!findNpcByName(map!, s);
  for (const b of spec.beats) {
    if (b.do === "walk" && typeof b.to === "string" && !isHero(b.to) && !ROAD.test(b.to.trim()) && knownName(b.to)) noteName(b.to);
    if (b.do === "face" && !isHero(b.toward) && knownName(b.toward)) noteName(b.toward);
  }

  // 2) 무대 모의 준비 — 주인공은 시작 칸, 맵에 이미 있는 사람은 그 자리.
  const project = (): Project => run.ctx.project;
  const roads = roadsFor(project(), map);
  const sim = new StageSim(project(), map, new Set(), roads);
  const actorIds = new Map<string, string>(); // 이름 → 이벤트 id
  const hiddenFromStart: string[] = [];
  const used: Cell[] = [];
  let start = walkStart(project(), map);
  // 「누구와 대화가 끝나면」 장면은 주인공이 그 NPC 바로 앞에서 시작한다(말을 건 자리).
  const afterNpc = spec.after ? findNpcByName(map, spec.after) : undefined;
  if (afterNpc) start = resolveWhere(project(), map, undefined, { at: { x: afterNpc.x, y: afterNpc.y + 1 }, avoid: [{ x: afterNpc.x, y: afterNpc.y }] }).cell;
  sim.actors.set(PLAYER, { cell: start, dir: "down", visible: true, name: "주인공" });
  used.push(start);
  for (const name of names) {
    const existing = findNpcByName(map, name);
    if (!existing) continue;
    const ab = appearBeat.get(name);
    if (ab) warnings.push(`${name}: 맵에 같은 이름 NPC 가 이미 있어 그 사람을 나타나게 한다(새로 만들지 않는다).`);
    actorIds.set(name, existing.id);
    sim.actors.set(existing.id, { cell: { x: existing.x, y: existing.y }, dir: "down", visible: !ab, name });
    if (ab) hiddenFromStart.push(existing.id);
    used.push({ x: existing.x, y: existing.y });
  }
  const refresh = (): void => {
    map = findMap(run.ctx.project, mapId) ?? map;
    sim.refreshMap(map!, new Set(actorIds.values()), hostId);
  };
  refresh();

  let actorSeq = 0;
  const createdActors = new Set<string>();
  const effects: string[] = [];
  const vanished = new Set<string>();
  const followUps = new Map<string, string[]>();
  const sceneSteps = new Map<string, number>();
  const lookedEarly = new Set<number>();
  const lookCommand = (target: string, as: unknown): Record<string, unknown> => (as === "shadow" ? { kind: "look", target, tint: "black", tintFill: true }
    : as === "ghost" ? { kind: "look", target, pose: "float", alpha: 0.6 }
    : { kind: "look", target, reset: true });
  /** 아직 맵에 없는 사람을 지금(비트 i 시점) 세운다. */
  const ensureActor = (name: string, beatIndex: number): string | undefined => {
    const have = actorIds.get(name);
    if (have) return have;
    const ab = appearBeat.get(name);
    const approachesHero = spec.beats.slice(beatIndex).some((b) => b.do === "walk" && b.who === name && typeof b.to === "string" && isHero(b.to));
    const hero = sim.actors.get(PLAYER)!;
    let cell: Cell | undefined;
    const whereWord = ab && typeof ab.where === "string" ? ab.where : undefined;
    const whereAt = ab && ab.where && typeof ab.where !== "string" ? ab.where : undefined;
    if (approachesHero) {
      // 다가오는 사람: 낱말 자리가 주인공에게서 걸어서 3~10칸이면 그대로, 아니면 4~8칸 앞 길 위.
      if (whereWord || whereAt) {
        const r = resolveWhere(project(), map!, whereWord, { ...(whereAt ? { at: whereAt } : {}), avoid: used });
        const d = approachSteps(sim, r.cell, hero.cell);
        if (d !== undefined && d >= MIN_WALK && d <= 10) cell = r.cell;
        else warnings.push(`${name}: '${whereWord ?? `${whereAt?.x},${whereAt?.y}`}' 자리(${r.cell.x},${r.cell.y})에서 주인공 곁까지 ${d === undefined ? "걸어 닿지 못해" : `${d}걸음이라`} 다가오는 장면이 한 화면에 안 읽혀, 4~9걸음 떨어진 자리로 옮겼다.`);
      }
      cell ??= approachSpot(sim, hero.cell, hero.dir, used);
      if (!cell) warnings.push(`${name}: 주인공에게서 4~8칸 떨어져 걸어올 수 있는 자리를 못 찾았다.`);
    }
    if (!cell) {
      const r = whereWord && ROAD.test(whereWord.trim())
        ? (() => { const wp = planRoadWalk(sim, PLAYER); return wp ? { cell: wp.at(-1)!, note: undefined as string | undefined } : resolveWhere(project(), map!, undefined, { avoid: used }); })()
        : resolveWhere(project(), map!, whereWord, { ...(whereAt ? { at: whereAt } : {}), avoid: used });
      if (r.note) warnings.push(`${name}: ${r.note}`);
      cell = r.cell;
    }
    if (!ab) warnings.push(`${name}: appear 비트가 없고 맵에도 없어 새로 세우고 처음부터 보이게 둔다.`);
    const talk = (ab as { talk?: unknown } | undefined)?.talk;
    // 장면 끝에 사라지는 사람(지나가는 그림자 등)은 다시 말 걸 일이 없다 — 기본 «또 보세» 를 달지 않는다(2026-10-24 눈가림: 그림자가 «또 보세» 라 말한다).
    const leaves = spec.beats.some((b) => b.do === "vanish" && b.who === name);
    const lines = Array.isArray(talk) ? talk.map((t) => String(t).trim()).filter(Boolean) : typeof talk === "string" && talk.trim() ? [talk.trim()] : leaves ? [] : defaultFollowUp(name, ab?.looks);
    if (lines.length) followUps.set(name, lines);
    const base: Record<string, unknown> = { mapId, name, x: cell.x, y: cell.y, movement: "fixed", pages: [{ name, lines }] };
    if (hostId) base.id = `${START_ACTOR_PREFIX}${++actorSeq}`;
    const placed = placeNpcWithGraphic(run, map!, base, name, ab?.looks, name, warnings);
    if (!placed.result.ok) { warnings.push(`${name} 을(를) 놓지 못했다 — ${String(placed.result.summary).slice(0, 160)}`); return undefined; }
    const d = (placed.result.data ?? {}) as { eventId?: string; x?: number; y?: number };
    if (!d.eventId) return undefined;
    const at = { x: d.x ?? cell.x, y: d.y ?? cell.y };
    actorIds.set(name, d.eventId);
    createdActors.add(d.eventId);
    // 다가오는 사람은 처음부터 보이게 둔다 — 숨겼다가 «팍» 나타나면 어색하고 끝 정리에서 깜빡였다(2026-10-23 6차 눈가림 컷신 v1 8 · v2 6.5).
    const hide = !!ab && !approachesHero;
    sim.actors.set(d.eventId, { cell: at, dir: "down", visible: !hide, name });
    if (hide) hiddenFromStart.push(d.eventId);
    used.push(at);
    refresh();
    return d.eventId;
  };

  // 3) 비트를 차례로 모의하며 script_cutscene 비트로 옮긴다.
  const out: Record<string, unknown>[] = [];
  const letterbox = spec.kind === "cutscene";
  const keyOf = (who: string): string | undefined => (isHero(who) ? PLAYER : actorIds.get(who));
  const idFor = (key: string): string => key; // "player" 또는 이벤트 id 그대로
  sim.snapshot("시작");
  const recordWalk = (who: string, intent: string, legs: { steps: number; path: Cell[]; goal: Cell; reached: boolean }[]): WalkRecord => {
    const path = legs.flatMap((l, i) => (i === 0 ? l.path : l.path.slice(1)));
    const rec: WalkRecord = { who, from: path[0]!, goal: legs.at(-1)!.goal, intent, steps: legs.reduce((n, l) => n + l.steps, 0), reached: legs.every((l) => l.reached), onRoad: sim.onRoadCount(path), path };
    sim.walks.push(rec);
    return rec;
  };
  const midFrame = (key: string, rec: WalkRecord, label: string): void => {
    if (rec.steps < 4) return;
    const a = sim.actors.get(key)!;
    const keep = { ...a, cell: { ...a.cell } };
    const mid = rec.path[Math.floor(rec.path.length / 2)]!;
    a.cell = mid;
    sim.snapshot(label);
    a.cell = keep.cell;
  };

  spec.beats.forEach((b, i) => {
    switch (b.do) {
      case "appear": {
        if (isHero(b.who)) { warnings.push("appear: 주인공은 처음부터 있다."); break; }
        const id = ensureActor(b.who, i);
        if (!id) break;
        const a = sim.actors.get(id)!;
        if (!a.visible) {
          a.visible = true;
          const hero = sim.actors.get(PLAYER)!;
          a.dir = dirTo(a.cell, hero.cell);
          // 바로 뒤 look(그림자·유령)은 보이기 전에 건다 — 맨 모습이 잠깐 보였다가 검게 바뀌었다(2026-10-24 밤 컷신 눈가림).
          const nb = spec.beats[i + 1];
          if (nb && nb.do === "look" && nb.who === b.who && nb.as !== "normal") { out.push(lookCommand(id, nb.as)); lookedEarly.add(i + 1); }
          out.push({ kind: "look", target: id, alpha: 1 });
          out.push({ kind: "faceToward", actor: id, target: PLAYER });
          out.push({ kind: "wait", ms: 300 });
          sim.snapshot(`${b.who} 나타남`);
        }
        break;
      }
      case "walk": {
        const key = isHero(b.who) ? PLAYER : ensureActor(b.who, i);
        if (!key) { warnings.push(`walk: 누군지 모르는 '${b.who}'.`); break; }
        const toName = typeof b.to === "string" ? b.to.trim() : "";
        // 사람에게 걸어가기: 곁(1칸)까지, 그다음 서로 마주 본다.
        const targetKey = typeof b.to === "string" && !ROAD.test(toName) ? (isHero(toName) ? PLAYER : (knownName(toName) ? ensureActor(toName, i) : undefined)) : undefined;
        if (targetKey && targetKey !== key) {
          const target = sim.actors.get(targetKey)!;
          const leg = sim.walk(key, target.cell, 1);
          const rec = recordWalk(b.who, toName, [leg]);
          out.push({ kind: "approach", actor: idFor(key), target: idFor(targetKey), distance: 1, wait: true });
          out.push({ kind: "faceEachOther", a: idFor(key), b: idFor(targetKey) });
          target.dir = dirTo(target.cell, sim.actors.get(key)!.cell);
          sim.actors.get(key)!.dir = dirTo(sim.actors.get(key)!.cell, target.cell);
          midFrame(key, rec, `${b.who} 다가오는 중`);
          sim.snapshot(`${b.who} → ${toName} 곁`);
          break;
        }
        // 길로: 길에 들어서 길을 따라 4~9칸.
        let waypoints: Cell[] | undefined;
        if (ROAD.test(toName)) {
          waypoints = planRoadWalk(sim, key);
          if (!waypoints) warnings.push(`${b.who}: '${toName}' 로 걸을 길(포석) 칸을 못 찾아 다른 곳으로 걸었다.`);
        }
        let intent = typeof b.to === "string" ? toName : `(${b.to.x},${b.to.y})`;
        if (!waypoints) {
          const r = typeof b.to === "string" ? resolveWhere(project(), map!, ROAD.test(toName) ? undefined : toName, { avoid: used }) : resolveWhere(project(), map!, undefined, { at: b.to, avoid: used });
          if (r.note) warnings.push(`${b.who}: ${r.note}`);
          waypoints = [r.cell];
        }
        // 미리 걸어 보고, 3칸 미만이거나 못 닿으면 목적지 쪽 4~7칸 칸으로 바꾼다.
        const keep = { ...sim.actors.get(key)!, cell: { ...sim.actors.get(key)!.cell } };
        let legs = waypoints.map((wp) => sim.walk(key, wp, 0));
        const total = legs.reduce((n, l) => n + l.steps, 0);
        if (total < MIN_WALK || !legs.every((l) => l.reached)) {
          const aim = waypoints.at(-1)!;
          Object.assign(sim.actors.get(key)!, keep);
          const alt = towardSpot(sim, key, aim);
          if (alt) {
            warnings.push(`${b.who}: '${intent}' 목적 칸 (${aim.x},${aim.y}) 은 ${legs.every((l) => l.reached) ? `${total}걸음뿐이라` : "막혀 닿지 못해"} 그쪽으로 걸어서 4~7칸인 (${alt.x},${alt.y}) 로 바꿨다.`);
            intent = `${intent}→(${alt.x},${alt.y})`;
            waypoints = [alt];
            legs = [sim.walk(key, alt, 0)];
          } else {
            Object.assign(sim.actors.get(key)!, keep);
            legs = waypoints.map((wp) => sim.walk(key, wp, 0));
          }
        }
        // 장면에만 나오는 사람은 장면 전체 24걸음까지만 걷는다 — 넘으면 같은 길 위 그 걸음째 칸에서 멈춘다
        // (2026-10-24 밤 컷신: 그림자가 52~62걸음을 걸어 한 번 말 걸기 안에 장면이 안 끝나 보였다).
        if (createdActors.has(key)) {
          const room = Math.min(SCENE_WALK_LEG, SCENE_WALK_BUDGET - (sceneSteps.get(key) ?? 0));
          const total2 = legs.reduce((n, l) => n + l.steps, 0);
          if (room < MIN_WALK) {
            // 걸음 예산을 다 썼다 — 이 걷기는 빼고 그 자리에 둔다.
            Object.assign(sim.actors.get(key)!, { ...keep, cell: { ...keep.cell } });
            warnings.push(`${b.who}: 장면 걸음 상한(${SCENE_WALK_BUDGET})을 다 써서 '${intent}' 걷기는 뺐다.`);
            break;
          }
          if (total2 > room) {
            const flat = legs.flatMap((l, li) => (li === 0 ? l.path : l.path.slice(1)));
            const cut = flat[room]!;
            Object.assign(sim.actors.get(key)!, { ...keep, cell: { ...keep.cell } });
            warnings.push(`${b.who}: 장면에서 ${(sceneSteps.get(key) ?? 0) + total2}걸음은 길어 '${intent}' 쪽으로 ${room}걸음째 (${cut.x},${cut.y}) 에서 멈추게 했다.`);
            intent = `${intent}→(${cut.x},${cut.y})`;
            waypoints = [cut];
            legs = [sim.walk(key, cut, 0)];
          }
          sceneSteps.set(key, (sceneSteps.get(key) ?? 0) + legs.reduce((n, l) => n + l.steps, 0));
        }
        for (const wp of waypoints) out.push({ kind: "approach", actor: idFor(key), x: wp.x, y: wp.y, distance: 0, wait: true });
        const rec = recordWalk(b.who, intent, legs);
        midFrame(key, rec, `${b.who} 걷는 중`);
        sim.snapshot(`${b.who} 도착`);
        break;
      }
      case "say": {
        const key = keyOf(b.who) ?? ensureActor(b.who, i);
        if (!key) { warnings.push(`say: 누군지 모르는 '${b.who}'.`); break; }
        const beat: Record<string, unknown> = { kind: "say", text: b.text, actor: idFor(key) };
        if (key !== PLAYER) beat.speaker = b.who;
        // 말하는 사람 얼굴 — NPC 는 그 이벤트 첫 쪽의 얼굴(place_npc 가 그림에 맞춰 넣은 것), 주인공은 파티 맨 앞 배우의 얼굴.
        const faceId = key === PLAYER ? heroFace(project()) : npcFace(map!, idFor(key));
        if (faceId) beat.face = { resourceId: faceId, position: "left" };
        out.push(beat);
        break;
      }
      case "face": {
        const key = keyOf(b.who) ?? ensureActor(b.who, i);
        if (!key) { warnings.push(`face: 누군지 모르는 '${b.who}'.`); break; }
        const t = isHero(b.toward) ? PLAYER : actorIds.get(b.toward);
        if (t) { out.push({ kind: "faceToward", actor: idFor(key), target: idFor(t) }); sim.actors.get(key)!.dir = dirTo(sim.actors.get(key)!.cell, sim.actors.get(t)!.cell); }
        else {
          const r = resolveWhere(project(), map!, b.toward, { avoid: used });
          out.push({ kind: "faceToward", actor: idFor(key), x: r.cell.x, y: r.cell.y });
        }
        break;
      }
      case "wait":
        out.push({ kind: "wait", ms: Math.max(0, Math.round(b.ms)) });
        break;
      case "fade":
        out.push({ kind: "fade", direction: b.dir, durationMs: 600, wait: true });
        break;
      case "tint": {
        const value = TINT_TONES[b.tone];
        if (value === undefined) { warnings.push(`tint: 모르는 색 '${b.tone}' — night·dusk·dawn·sepia·clear.`); break; }
        out.push({ kind: "tint", value, durationMs: 900, wait: true });
        effects.push(b.tone === "clear" ? "the screen tint is cleared back to normal" : `the whole screen is tinted ${b.tone === "night" ? "dark night blue" : b.tone} from here on (stays after the scene)`);
        break;
      }
      case "weather": {
        const kinds = ["rain", "storm", "snow", "fog", "none"];
        if (!kinds.includes(b.weather)) { warnings.push(`weather: 모르는 날씨 '${String(b.weather)}' — rain·storm·snow·fog·none.`); break; }
        const intensity = Math.min(1, Math.max(0.1, Number.isFinite(b.intensity) ? Number(b.intensity) : 0.6));
        out.push({ kind: "weather", weather: b.weather, intensity, durationMs: 1200 });
        effects.push(b.weather === "none" ? "the weather clears" : `real ${b.weather} weather starts (particles over the whole map, stays after the scene)`);
        break;
      }
      case "shake": {
        const intensity = b.strength === "weak" ? 3 : b.strength === "strong" ? 10 : 6;
        const durationMs = Math.min(4000, Math.max(200, Number.isFinite(b.ms) ? Math.round(Number(b.ms)) : 900));
        out.push({ kind: "shake", intensity, durationMs, axis: b.axis ?? "both" });
        effects.push(`the screen shakes (${b.axis ?? "both"}, ${durationMs} ms)`);
        break;
      }
      case "flash": {
        const color = typeof b.color === "string" && /^#[0-9a-f]{6}$/iu.test(b.color) ? b.color : /red|빨/iu.test(String(b.color ?? "")) ? "#ff4040" : "#ffffff";
        const durationMs = Math.min(2000, Math.max(100, Number.isFinite(b.ms) ? Math.round(Number(b.ms)) : 400));
        out.push({ kind: "flash", color, durationMs });
        effects.push(`the screen flashes ${color}`);
        break;
      }
      case "music": {
        const action = b.action ?? "bgm";
        if ((action === "bgm" || action === "se") && !b.query?.trim()) { warnings.push("music: bgm·se 는 query(음원 낱말)가 필요하다."); break; }
        out.push(action === "stop" || action === "fade" ? { kind: "music", action } : { kind: "music", action, resourceId: b.query!.trim() });
        effects.push(action === "bgm" ? `the background music changes to a '${b.query}' track (stays after the scene)` : action === "se" ? `a '${b.query}' sound effect plays` : "the music stops");
        break;
      }
      case "camera": {
        const to = b.to;
        if (typeof to === "string" && /^(back|return|복귀|돌아옴|주인공)$/iu.test(to.trim())) { out.push({ kind: "camera", mode: "return", durationMs: 600, wait: true }); break; }
        let cell: Cell | undefined;
        if (typeof to === "string") {
          const key = keyOf(to) ?? (knownName(to.trim()) ? ensureActor(to.trim(), i) : undefined);
          if (key) cell = sim.actors.get(key)?.cell;
          else {
            const r = resolveWhere(project(), map!, to.trim(), { avoid: [] });
            if (r.note) warnings.push(`camera: ${r.note}`);
            cell = r.cell;
          }
        } else cell = to;
        if (!cell) { warnings.push(`camera: '${String(to)}' 자리를 못 찾았다.`); break; }
        out.push({ kind: "camera", mode: "pan", x: cell.x, y: cell.y, durationMs: 900, wait: true });
        effects.push(`the camera pans to (${cell.x},${cell.y}) and holds, then returns to the hero`);
        out.push({ kind: "wait", ms: 700 });
        break;
      }
      case "look": {
        const key = keyOf(b.who) ?? ensureActor(b.who, i);
        if (!key) { warnings.push(`look: 누군지 모르는 '${b.who}'.`); break; }
        if (!lookedEarly.has(i)) out.push(lookCommand(idFor(key), b.as));
        if (b.as !== "normal") effects.push(`${b.who} is drawn as ${b.as === "shadow" ? "a solid black silhouette" : "a floating translucent ghost"} in the game (the frames show the plain sprite)`);
        break;
      }
      case "vanish": {
        const key = keyOf(b.who) ?? actorIds.get(b.who);
        if (!key || key === PLAYER) { warnings.push(`vanish: 사라지게 할 사람 '${b.who}' 이 없다(주인공은 못 사라진다).`); break; }
        out.push({ kind: "particles", preset: "smoke", target: idFor(key), durationMs: 700 });
        out.push({ kind: "look", target: idFor(key), alpha: 0 });
        out.push({ kind: "wait", ms: 400 });
        const a = sim.actors.get(key); if (a) a.visible = false;
        vanished.add(key);
        effects.push(`${b.who} vanishes in a puff of smoke and is removed from the map`);
        sim.snapshot(`${b.who} 사라짐`);
        break;
      }
    }
  });
  if (out.length === 0) return fail("옮길 수 있는 비트가 하나도 없다.", [mapId]);
  sim.snapshot("끝");
  // 말 걸기·밟기로 도는 장면이 새로 세운 «나타나는» 사람은 장면 전까지 맵에 서 있으면 안 된다(밤 그림자가 낮부터 보였다).
  // 그 사람의 페이지에 「장면 시작」 스위치 조건을 걸고, 장면 첫 명령으로 그 스위치를 켠다.
  const gated = when === "game-start" ? [] : hiddenFromStart.filter((id) => createdActors.has(id));
  let gateSwitch: string | undefined;
  if (gated.length > 0) {
    const key = `v2scene_${(run.calls.length * 7919 + gated.length * 104729 + Date.now()) % 1_000_000}`;
    // 스위치 하나만 선언한다 — create_quest_flags 는 안 쓰는 _done·_progress 까지 만들어 「선언만 하고 안 쓰는 깃발」이 됐다(2026-10-24 스위트).
    const fl = run.call("declare_story_flag", { action: "declare", id: key.replace(/_/gu, "-"), kind: "switch", targetId: `sw_${key}_shown`, description: "장면 전에는 숨겨 둔 사람(장면이 켠다)" });
    gateSwitch = fl.ok ? ((fl.data ?? {}) as { flag?: { targetId?: string } }).flag?.targetId : undefined;
    if (gateSwitch) {
      const cur = findMap(run.ctx.project, mapId);
      for (const id of gated) {
        const e = cur ? eventsOf(cur).find((x) => x.id === id) : undefined;
        if (!e?.pages?.length) continue;
        run.call("upsert_event", { mapId, replacePages: true, event: { id, pages: e.pages.map((pg) => ({ ...structuredClone(pg), conditions: [...(pg.conditions ?? []), { kind: "switch", switchId: gateSwitch, value: true }] })) } });
      }
    } else warnings.push("장면 전 숨김 스위치를 못 만들어 나타나는 사람이 장면 전에도 보인다.");
  }
  const beats: Record<string, unknown>[] = [
    ...(gateSwitch ? [{ kind: "switch", switchId: gateSwitch, value: true }] : []),
    ...hiddenFromStart.map((id) => ({ kind: "look", target: id, alpha: 0 })),
    ...(letterbox ? [{ kind: "letterbox", show: true, size: 12, durationMs: 500, wait: true }] : []),
    ...out,
    ...(letterbox ? [{ kind: "letterbox", show: false, durationMs: 400 }] : []),
    // 장면 전용 사람이 모두 사라졌으면 스위치를 다시 꺼서 맵에서 아주 없앤다(다시 들어와도 안 보이게).
    ...(gateSwitch && gated.every((id) => vanished.has(id)) ? [{ kind: "switch", switchId: gateSwitch, value: false }] : []),
  ];

  // 4) 기계 검사 — 걷기마다 3칸 이상·목적지 도착, 대사는 듣는 사람 곁(2칸)에서.
  const checks: MachineCheck[] = [];
  for (const w of sim.walks) {
    const ok = w.steps >= MIN_WALK && w.reached;
    checks.push({ id: "cutscene-walk", mapId, ok, at: w.goal,
      detail: `${w.who} (${w.from.x},${w.from.y})→(${w.goal.x},${w.goal.y}) ${w.steps}걸음${w.onRoad ? `(길 위 ${w.onRoad}칸)` : ""} — ${ok ? "통과" : w.reached ? `${MIN_WALK}걸음 미만이라 걷는 장면으로 안 읽힌다` : `목적지 '${w.intent}' 에 닿지 못한다`}` });
  }
  {
    // 장면 길이: 한 사람이 장면 안에서 30걸음 넘게 걸으면(한 걸음 약 ¼초 + 정지) 플레이어가 15초 넘게 서서 본다 —
    // 2026-10-24 밤 컷신: 그림자 62걸음, 한 번 말 걸기 안에 안 끝나 보였다. 지나가는 사람은 짧은 한 구간으로.
    const per = new Map<string, number>();
    for (const w of sim.walks) per.set(w.who, (per.get(w.who) ?? 0) + w.steps);
    for (const [who, n] of per) if (!isHero(who) && n > 30) {
      checks.push({ id: "cutscene-length", mapId, ok: false, detail: `${who} 이(가) 장면 안에서 ${n}걸음 걷는다 — 너무 길다(30걸음 이하로: 걷기 비트를 줄이거나 가까운 자리 낱말로)` });
    }
  }
  {
    // 대사 순간 위치: 모의 마지막 프레임 기준(대사는 걷기 뒤에 온다).
    const last = sim.frames.at(-1)!;
    const hero = last.actors.find((a) => a.key === PLAYER)!;
    for (const b of spec.beats) {
      if (b.do !== "say" || isHero(b.who)) continue;
      const a = last.actors.find((x) => x.name === b.who);
      if (!a) continue;
      const d = chebyshev(a, hero);
      checks.push({ id: "cutscene-talk", mapId, ok: d <= 2 && a.visible, at: { x: a.x, y: a.y }, detail: `${b.who} 의 대사 «${b.text.slice(0, 20)}» — 주인공과 ${d}칸${a.visible ? "" : "(안 보임)"}${d <= 2 ? "" : ", 멀리서 말한다"}` });
    }
  }

  // 5) 컷신 이벤트 자리(보이지 않는 연출 이벤트) — 사람·주인공 칸을 피한 빈 칸.
  const trigger = when === "game-start" ? "auto" : when === "talk" ? "action" : "playerTouch";
  const existingHost = hostId ? eventsOf(map!).find((e) => e.id === hostId) : undefined;
  const hostCell = existingHost ? { cell: { x: existingHost.x, y: existingHost.y }, note: undefined as string | undefined }
    : resolveWhere(project(), map!, when === "game-start" ? undefined : spec.where, { ...(spec.at ? { at: spec.at } : {}), avoid: [...used, ...sim.walks.flatMap((w) => w.path)] });
  if (hostCell.note && when !== "game-start") warnings.push(`컷신 자리: ${hostCell.note}`);
  const args: Record<string, unknown> = {
    mapId, x: hostCell.cell.x, y: hostCell.cell.y, trigger, beats, skippable: true, mode: "replace",
    once: when === "game-start" || when === "touch", ...(hostId ? { eventId: hostId } : {}),
  };
  const cut = run.call("script_cutscene", args);
  for (const w of cut.warnings ?? []) warnings.push(`컷신: ${w}`);
  if (!cut.ok) return fail(`컷신을 만들지 못했다 — ${String(cut.summary).slice(0, 200)}`, [mapId]);
  const cd = (cut.data ?? {}) as { eventId?: string; pageId?: string; unsupportedCommands?: unknown };
  const cutId = cd.eventId ?? hostId;
  if (!cutId) return fail("script_cutscene 가 이벤트 id 를 안 돌려줬다.", [mapId]);
  if (Array.isArray(cd.unsupportedCommands) && cd.unsupportedCommands.length > 0) warnings.push(`지원 안 되는 명령: ${JSON.stringify(cd.unsupportedCommands).slice(0, 160)}`);

  // 6) 컷신 검사(probe).
  const after = findMap(run.ctx.project, mapId);
  const ev = after ? eventsOf(after).find((e) => e.id === cutId) : undefined;
  const page = ev?.pages?.find((p) => (cd.pageId ? p.id === cd.pageId : p.name === "컷신")) ?? ev?.pages?.[0];
  const commands = ((page?.commands ?? ev?.commands ?? []) as Command[]);
  let probeNote = "";
  if (commands.length > 0) {
    try {
      const p = probeCutscene(run.ctx.project, commands, { width: 640, height: 360 });
      for (const issue of p.issues) warnings.push(`probe: ${issue}`);
      probeNote = ` · probe ${Math.round(p.durationMs / 100) / 10}초, 대사 ${p.sayCount}줄, 문제 ${p.issues.length}`;
    } catch (e) {
      warnings.push(`probe 실행 실패: ${String((e as Error).message ?? e).slice(0, 120)}`);
    }
  } else {
    warnings.push("만든 페이지에서 명령을 못 읽어 probe 를 돌리지 못했다.");
  }

  // 7) 「누구와 대화가 끝나면」 — 만든 장면 명령을 그 NPC 의 말 걸기 페이지 끝에 붙이고(셀프 스위치 D 로 한 번만),
  //    D 가 켜진 뒤엔 원래 대사만 하는 페이지를 덧붙인다. 장면을 담았던 투명 이벤트는 지운다.
  let hostEventId = cutId;
  if (spec.after) {
    const cur = findMap(run.ctx.project, mapId);
    const npc = cur ? findNpcByName(cur, spec.after) : undefined;
    if (!npc || !npc.pages?.length) warnings.push(`after: '${spec.after}' NPC 를 이 맵에서 못 찾아 따로 선 장면 이벤트로 남겼다.`);
    else if (commands.length === 0) warnings.push("after: 장면 명령을 못 읽어 NPC 에 잇지 못했다.");
    else {
      const p0 = npc.pages[0]!;
      const talked = { ...structuredClone(p0), id: undefined, name: `${p0.name ?? "대화"} (장면 뒤)`, conditions: [...(p0.conditions ?? []), { kind: "selfSwitch", key: "D", value: true }] };
      const afterLines = (spec.afterTalk ?? []).map((t) => String(t).trim()).filter(Boolean);
      if (afterLines.length) {
        const face = (p0.commands ?? []).find((c) => (c as { kind?: string }).kind === "changeFace");
        talked.commands = [...(face ? [structuredClone(face)] : []), ...afterLines.map((body) => ({ kind: "text", speaker: npc.name, body }))] as typeof talked.commands;
      }
      delete (talked as { id?: string }).id;
      const first = { ...structuredClone(p0), commands: [...(p0.commands ?? []), ...structuredClone(commands), { kind: "setSelfSwitch", key: "D", value: true }] };
      const up = run.call("upsert_event", { mapId, replacePages: true, event: { id: npc.id, pages: [first, ...npc.pages.slice(1).map((pg) => structuredClone(pg)), talked] } });
      if (!up.ok) warnings.push(`after: NPC 에 잇지 못했다 — ${String(up.summary).slice(0, 160)}`);
      else {
        run.call("remove_event", { mapId, eventId: cutId });
        hostEventId = npc.id;
        warnings.push(`장면을 '${spec.after}' 대화 끝에 이었다(한 번만 — 그 뒤엔 원래 대사).`);
      }
    }
  }

  const walkLine = sim.walks.map((w) => `${w.who} ${w.steps}걸음${w.onRoad ? `(길 ${w.onRoad})` : ""}→(${w.goal.x},${w.goal.y})`).join(", ");
  const bad = checks.filter((c) => !c.ok);
  const eventIds = [{ mapId, eventId: hostEventId }, ...[...actorIds.values()].map((eventId) => ({ mapId, eventId }))];
  const hero = leaderCharset(run.ctx.project);
  return {
    ok: true,
    mapIds: [mapId],
    summary: `컷신 '${cutId}' (${trigger}, 비트 ${beats.length}, ${when === "game-start" ? "한 번만" : when}${letterbox ? ", 레터박스" : ""}) 을 ${mapId} 에 만듦 — 걷기 ${walkLine || "없음"}` +
      `${[...followUps].length ? ` · 컷신 뒤 대화: ${[...followUps].map(([n, l]) => `${n} «${l[0]?.slice(0, 24)}»`).join(", ")}` : ""}${probeNote}${bad.length ? ` · 무대 검사 문제 ${bad.length}` : ""}`,
    warnings,
    missingArt: [],
    calls: run.calls.slice(firstCall),
    eventIds,
    stage: { mapId, hostEventId: cutId, frames: sim.frames, walks: sim.walks, checks, letterbox, effects, ...(hero ? { hero } : {}) },
  };
}

function dirTo(from: Cell, to: Cell): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? "right" : "left";
  return dy < 0 ? "up" : "down";
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
