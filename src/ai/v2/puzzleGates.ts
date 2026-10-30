// 퍼즐 문(스위치로 여는 같은 맵 통로)이 실제로 열리는가 — 여는 장치에 문 바깥에서 걸어 닿고, 켜면 길이 이어지는가(끝맺음 lanes, 맵마다).
//
// 왜(2026-10-30 씬 벤치 sc-1030r2 terra gym-leader r1~r3): 「새순 체육관」 관장(14,3)은 받침(8,17)→덩굴 문(8,14)·가위→덤불(12,6)
// 두 장치 너머에 있다. 판정자는 스타터를 받고도 「아래쪽 새싹 돌 받침을 살펴보자」 안내를 따라갈 수 없었다 — 장면 입구가 관장 곁(14,4)이라
// 받침이 닫힌 덩굴 문 남쪽에 갇혀 있었다(관장은 「장치와 이전 약속을 마쳐야」만 말한다). 또 덤불 틈·덩굴 문의 「위(관장 쪽)로/아래로」
// 선택지는 고정 칸으로 옮기므로 이미 서 있는 쪽을 고르면 아무 일도 없어 「선택지와 동작이 어긋난다」로 보였다.
// 규칙:
//  - 같은 맵 안으로 옮기는 명령이 스위치 조건(페이지 조건·감싼 갈래) 아래 있으면 그 스위치가 켜져야 열리는 퍼즐 문이다.
//  - 앵커(시작점·착지점, 또는 장면 입구)에서 걷기 + 열린 문만 지나기로 닿는 장치(setSwitch 가 든 이벤트)를 켜고, 그 장치의 changeTile 을
//    맵 사본에 반영하고, 다시 걷기를 반복한다(고정점). 끝까지 안 켜지는 이 맵 스위치가 문·관장 갈래를 막으면 적는다.
//  - 두 갈래 통로 선택지(옵션마다 이벤트 칸 양옆의 다른 칸으로 옮김)는 주인공이 보는 방향으로 건너편에 옮기는 갈래로 바꾼다
//    (옆에서 누르면 원래 선택지). 새 그림은 없다.
import { canMove } from "@/project/collision";
import type { Command, Condition, GameEvent, GameMap, Project } from "@/project/types";
import { anchorsOf, blockersOf, bodyReached, reachFrom } from "./eventReach";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };
type Obj = Record<string, unknown>;
export type GatedPassage = { event: GameEvent; at: Cell; to: Cell[]; needs: string[] };

/** 조건 속 「켜져 있어야」 하는 스위치들(all 은 펼친다, 그 밖의 조건은 채울 수 있다고 본다). */
function switchNeeds(c: Condition | undefined): string[] {
  if (!c) return [];
  const r = c as unknown as Obj;
  if (r.kind === "switch" && r.value !== false && typeof r.switchId === "string") return [r.switchId];
  if (r.kind === "all" && Array.isArray(r.conditions)) return (r.conditions as Condition[]).flatMap(switchNeeds);
  return [];
}
const pageNeeds = (ev: GameEvent, page: { conditions?: Condition[] }): string[] =>
  [...(page.conditions ?? []), ...((ev as { condition?: Condition }).condition ? [(ev as { condition?: Condition }).condition!] : [])].flatMap(switchNeeds);

/** 명령 목록을 걸으며 (명령, 감싼 갈래의 스위치 요구) 를 넘긴다. else 갈래는 요구 없음으로 본다(스위치가 꺼진 처음 상태). */
function walkCommands(cmds: readonly unknown[] | undefined, needs: string[], fn: (c: Obj, needs: string[]) => void): void {
  for (const raw of cmds ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Obj;
    fn(c, needs);
    if (c.kind === "fork") {
      walkCommands(c.then as unknown[], [...needs, ...switchNeeds(c.condition as Condition)], fn);
      walkCommands(c.else as unknown[], needs, fn);
      continue;
    }
    if (c.kind === "choices") { for (const o of (c.options as Obj[] | undefined) ?? []) walkCommands(o.branch as unknown[], needs, fn); walkCommands(c.cancelBranch as unknown[], needs, fn); continue; }
    for (const v of Object.values(c)) if (Array.isArray(v) && v.length && typeof v[0] === "object" && (v[0] as Obj)?.kind) walkCommands(v, needs, fn);
  }
}

/** 같은 맵 안으로 옮기는 이벤트와 그 통로가 열리는 데 필요한 스위치(페이지마다 따로). */
export function gatedPassages(map: GameMap): GatedPassage[] {
  const out: GatedPassage[] = [];
  for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    const byNeeds = new Map<string, GatedPassage>();
    walkCommands(page.commands as unknown[], pageNeeds(ev, page), (c, needs) => {
      if (c.kind !== "transfer" || c.mapId !== map.id || typeof c.x !== "number" || typeof c.y !== "number") return;
      const key = [...new Set(needs)].sort().join("|");
      const p = byNeeds.get(key) ?? { event: ev, at: { x: ev.x, y: ev.y }, to: [], needs: [...new Set(needs)] };
      p.to.push({ x: c.x as number, y: c.y as number });
      byNeeds.set(key, p);
    });
    out.push(...byNeeds.values());
  }
  return out;
}

/** 이벤트가 켜는 스위치·바꾸는 타일(페이지마다; 감싼 갈래의 스위치 요구를 함께 — 「둘 다 켜졌으면 퍼즐 완료」 같은 갈래). */
type Act = { sets?: string; tile?: Obj; needs: string[] };
function settersOf(map: GameMap): { event: GameEvent; needs: string[]; sets: string[]; acts: Act[]; auto: boolean }[] {
  const out: { event: GameEvent; needs: string[]; sets: string[]; acts: Act[]; auto: boolean }[] = [];
  for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    const acts: Act[] = [];
    walkCommands(page.commands as unknown[], [], (c, needs) => {
      if (c.kind === "setSwitch" && typeof c.switchId === "string" && c.value !== false && c.value !== "off" && c.value !== "OFF") acts.push({ sets: c.switchId, needs });
      else if (c.kind === "changeTile" && c.mapId === map.id) acts.push({ tile: c, needs });
    });
    const sets = [...new Set(acts.flatMap((a) => (a.sets ? [a.sets] : [])))];
    if (!sets.length) continue;
    const trig = ((page.trigger ?? (ev as { trigger?: unknown }).trigger) as { kind?: string } | undefined)?.kind ?? "action";
    out.push({ event: ev, needs: pageNeeds(ev, page), sets, acts, auto: trig === "auto" || trig === "parallel" });
  }
  return out;
}

const LAYER_FIELD: Record<string, string> = { lower: "lowerTiles", upper: "upperTiles", lower2: "lowerOverlayTiles", upper2: "upperOverlayTiles" };

/** 이 맵 밖(다른 맵·공통 이벤트)에서도 켜는 스위치 — 이 맵만 보고는 못 판단하므로 빼고 본다. */
function setElsewhere(project: Project, mapId: string): Set<string> {
  const out = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (!node || typeof node !== "object") return;
    const r = node as Obj;
    if (r.kind === "setSwitch" && typeof r.switchId === "string") out.add(r.switchId);
    for (const v of Object.values(r)) if (v && typeof v === "object") visit(v);
  };
  for (const m of Object.values(project.maps)) if (m.id !== mapId) visit(m.events ?? []);
  visit((project as { commonEvents?: unknown }).commonEvents ?? []);
  return out;
}

export type PuzzleFlow = { on: Set<string>; reach: Uint8Array; map: GameMap; passages: GatedPassage[]; local: Set<string>; elsewhere: Set<string> };

/**
 * 앵커에서 걸어 장치를 켜 가며 닿는 곳(고정점). anchors 를 주면 그 칸(장면 입구)에서, 아니면 시작점·착지점에서.
 * switches 는 처음부터 켜진 스위치, skip 은 장치로 세지 않을 이벤트(장면 대상 자신 — 관장 승리 스위치를 미리 켜지 않게).
 */
export function puzzleFlow(project: Project, mapId: string, opts: { anchors?: Cell[]; switches?: Record<string, boolean>; skip?: readonly string[] } = {}): PuzzleFlow | null {
  const base = project.maps[mapId];
  if (!base) return null;
  const anchors = opts.anchors ?? anchorsOf(project, base);
  if (!anchors.length) return null;
  const map: GameMap = { ...base };
  for (const f of Object.values(LAYER_FIELD)) { const a = (base as unknown as Obj)[f]; if (Array.isArray(a)) (map as unknown as Obj)[f] = [...a]; }
  const on = new Set(Object.entries(opts.switches ?? {}).filter(([, v]) => v).map(([k]) => k));
  const passages = gatedPassages(base);
  const setters = settersOf(base).filter((s) => !opts.skip?.includes(s.event.id));
  const local = new Set(setters.flatMap((s) => s.sets));
  const elsewhere = setElsewhere(project, mapId);
  const blocked = blockersOf(base);
  const fired = new Set<string>();
  const ok = (needs: readonly string[]) => needs.every((sw) => on.has(sw) || elsewhere.has(sw));
  let reach = new Uint8Array(base.width * base.height);
  for (let round = 0; round < 64; round++) {
    reach = reachFrom(project, map, anchors, blocked, passages.filter((p) => ok(p.needs)));
    let grew = false;
    setters.forEach((s, n) => {
      if (!ok(s.needs) || (!s.auto && !bodyReached(base, reach, s.event))) return;
      // 같은 장치를 다시 눌러 갈래 조건이 새로 맞은 일(둘째 장치 뒤 「퍼즐 완료」)도 센다 — 행동마다 한 번.
      s.acts.forEach((a, k) => {
        const key = `${n}:${k}`;
        if (fired.has(key) || !ok(a.needs)) return;
        fired.add(key);
        grew = true;
        if (a.sets) on.add(a.sets);
        const t = a.tile;
        const arr = t ? (map as unknown as Obj)[LAYER_FIELD[String(t.layer)] ?? ""] as number[] | undefined : undefined;
        if (t && arr && typeof t.x === "number" && typeof t.y === "number") arr[t.y * base.width + t.x] = t.tile as number;
      });
    });
    if (!grew) break;
  }
  return { on, reach, map, passages, local, elsewhere };
}

/** 닫힌 문 페이지의 안내 글(「아래쪽 새싹 돌 받침을 살펴보자」). */
function hintOf(ev: GameEvent): string {
  for (const page of ev.pages ?? []) {
    let hint = "";
    walkCommands(page.commands as unknown[], [], (c) => { if (!hint && c.kind === "text" && typeof c.body === "string") hint = c.body; });
    if (hint && !(page.commands ?? []).some((c) => (c as Obj).kind === "choices")) return hint.slice(0, 40);
  }
  return "";
}

/** 이 맵에서 안 열리는 퍼즐 문·안 켜지는 스위치에 묶인 갈래. 바꾸지 않는다. */
export function puzzleGateGaps(project: Project, mapId: string, opts: { anchors?: Cell[]; switches?: Record<string, boolean>; skip?: readonly string[] } = {}): string[] {
  const flow = puzzleFlow(project, mapId, opts);
  if (!flow) return [];
  const notes: string[] = [];
  const dead = (s: string) => !flow.on.has(s) && !flow.elsewhere.has(s);
  const named = (ev: GameEvent) => `「${ev.name ?? ev.id}」(${ev.x},${ev.y})`;
  for (const p of flow.passages) {
    const miss = p.needs.filter(dead);
    if (!miss.length) continue;
    const setterNames = settersOf(project.maps[mapId]!).filter((s) => s.sets.some((sw) => miss.includes(sw))).map((s) => named(s.event));
    const hint = hintOf(p.event);
    notes.push(`퍼즐 문 ${named(p.event)}${hint ? ` 「${hint}」` : ""} — 여는 스위치 ${miss.join(", ")} 를 켜는 ${setterNames.join("·") || "장치 없음"}에 문 바깥에서 걸어 닿지 못한다`);
  }
  for (const ev of flow.map.events ?? []) for (const page of ev.pages ?? []) {
    walkCommands(page.commands as unknown[], [], (c) => {
      if (c.kind !== "fork") return;
      const miss = switchNeeds(c.condition as Condition).filter((s) => flow.local.has(s) && dead(s));
      if (!miss.length || !JSON.stringify(c.then ?? []).includes("battleProcessing")) return;
      notes.push(`${named(ev)} 전투 갈래가 ${miss.join(", ")} 를 기다리는데, 이 스위치를 켜는 장치에 걸어 닿지 못한다`);
    });
  }
  return [...new Set(notes)];
}

/** 장면 입구 보정용: 맵 입구에서 퍼즐을 풀며 대상 앞까지 왔을 때 켜져 있을 이 맵 스위치(대상 자신이 켜는 것은 뺀다). */
export function progressSwitchesBefore(project: Project, mapId: string, targetEventId: string, switches: Record<string, boolean> = {}): Record<string, boolean> {
  const flow = puzzleFlow(project, mapId, { switches, skip: [targetEventId] });
  if (!flow) return {};
  const out: Record<string, boolean> = {};
  for (const s of flow.on) if (flow.local.has(s) && !switches[s]) out[s] = true;
  return out;
}

const DIR_OF = (dx: number, dy: number): "up" | "down" | "left" | "right" | null =>
  dx === 0 && dy < 0 ? "up" : dx === 0 && dy > 0 ? "down" : dy === 0 && dx < 0 ? "left" : dy === 0 && dx > 0 ? "right" : null;

/**
 * 두 갈래 통로 선택지 → 주인공이 보는 쪽 건너편으로 옮기는 갈래. 바꾼 이벤트 수.
 * 옵션이 둘, 각 옵션이 이 맵 안 한 칸으로 옮기기만 하고, 두 칸이 이벤트를 사이에 두고 마주 볼 때만 바꾼다.
 * 위에서 누르면(아래를 봄) 아래 칸으로, 아래에서 누르면 위 칸으로. 옆에서 누르면 원래 선택지를 그대로 보인다.
 * project 를 그 자리에서 고친다(부르는 쪽이 사본을 넘긴다).
 */
export function directPassageChoices(project: Project, mapId: string): string[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const done: string[] = [];
  for (const ev of map.events ?? []) for (const page of ev.pages ?? []) {
    const rewrite = (cmds: Command[] | undefined): boolean => {
      let changed = false;
      for (let i = 0; i < (cmds?.length ?? 0); i++) {
        const c = cmds![i] as unknown as Obj;
        if (c.kind === "choices") {
          const opts = (c.options as Obj[] | undefined) ?? [];
          const dests = opts.map((o) => { const b = (o.branch as Obj[] | undefined) ?? []; const t = b.length === 1 ? b[0]! : null; return t && t.kind === "transfer" && t.mapId === map.id ? t : null; });
          if (opts.length === 2 && dests.every(Boolean)) {
            const d = dests.map((t) => DIR_OF(Math.sign((t!.x as number) - ev.x), Math.sign((t!.y as number) - ev.y)));
            const opposite = d[0] && d[1] && ({ up: "down", down: "up", left: "right", right: "left" } as const)[d[0]] === d[1];
            const near = dests.every((t) => Math.abs((t!.x as number) - ev.x) + Math.abs((t!.y as number) - ev.y) <= 3);
            if (opposite && near && dests.every((t) => canStand(project, map, t!.x as number, t!.y as number))) {
              const go = (k: number) => [{ ...dests[k]!, direction: d[k] }] as unknown as Command[];
              const fork = (k: number, rest: Command[]): Command => ({ kind: "fork", condition: { kind: "facing", subject: "player", dir: d[k]! } as Condition, then: go(k), else: rest } as Command);
              cmds![i] = fork(0, [fork(1, [c as unknown as Command])]);
              const prev = cmds![i - 1] as unknown as Obj | undefined;
              if (prev?.kind === "text" && typeof prev.body === "string") prev.body = prev.body.replace(/\s*어느 쪽으로[^.?!]*[?？]\s*$/u, "").trim() || prev.body;
              changed = true;
              continue;
            }
          }
          for (const o of opts) if (rewrite(o.branch as Command[])) changed = true;
          continue;
        }
        if (c.kind === "fork") { if (rewrite(c.then as Command[])) changed = true; if (rewrite(c.else as Command[])) changed = true; }
      }
      return changed;
    };
    if (rewrite(page.commands as Command[])) done.push(`「${ev.name ?? ev.id}」(${ev.x},${ev.y}) 통로 선택지 → 보는 쪽 건너편으로 옮김`);
  }
  return [...new Set(done)];
}

const canStand = (project: Project, map: GameMap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < map.width && y < map.height && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => canMove(project, map, x + dx!, y + dy!, x, y) || canMove(project, map, x, y, x + dx!, y + dy!));

/** 끝맺음 lanes 용: 통로 선택지를 바로잡고, 안 열리는 퍼즐 문을 적는다. */
export function checkPuzzleGates(run: BuildRun, mapId: string): string[] {
  const next = structuredClone(run.ctx.project) as Project;
  const notes = directPassageChoices(next, mapId);
  if (notes.length) run.ctx.project = next;
  notes.push(...puzzleGateGaps(run.ctx.project, mapId));
  return notes;
}
