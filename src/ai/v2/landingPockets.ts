// 착지 칸이 막힌 주머니면 옮긴다 — 다른 맵에서 이 맵으로 들어오는 이동의 도착 칸에서 걸어 나갈 곳이 돌아가는 문뿐인가(끝맺음 lanes, 맵마다).
//
// 왜(2026-10-30 회귀 ebfe-sl sl1 opus jrpg): 동굴 지하 1층 계단 → 버들 마을 (0,21). 마을 서쪽 가장자리 출구는 (0,20)인데 착지 칸 (0,21)은
// 오른쪽 (1,21)·아래 (0,22)가 벽이라, 위로 가면 출구를 밟아 다시 동굴로 들어갔다. 판정자는 마을로 못 돌아가 새 게임을 했다.
// 이전 검사들은 착지 칸이 «통행 칸인가»·«앞이 막혔나»만 봐서 한 칸짜리 주머니를 놓쳤다.
// 규칙: 착지 칸에서 걷기(같은 높이 이벤트·밟으면 옮기는 칸은 못 지난다)로 닿는 칸이 몇 칸(≤ POCKET)뿐이고, 이 맵의 큰 덩어리(시작점·다른
// 착지 칸에서 닿는 칸 중 가장 큰 것)가 따로 있으면, 도착 칸을 그 덩어리 안으로 옮긴다 — 돌아가는 문(이 맵에서 출발 맵으로 옮기는 이벤트) 곁
// 칸을 먼저, 없으면 원래 칸에서 가장 가까운 칸. 같은 칸으로 오던 이동 명령을 모두 고친다. 새 그림은 없다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { blockersOf, reachFrom } from "./eventReach";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };
type Obj = Record<string, unknown>;
const POCKET = 6;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** 다른 맵 이벤트·공통 이벤트에서 이 맵으로 오는 이동 명령(명령 객체 그대로 — 고칠 때 쓴다)과 출발 맵. */
function transfersInto(project: Project, mapId: string): { from: string; cmd: Obj }[] {
  const out: { from: string; cmd: Obj }[] = [];
  const visit = (node: unknown, from: string): void => {
    if (Array.isArray(node)) { for (const n of node) visit(n, from); return; }
    if (!node || typeof node !== "object") return;
    const r = node as Obj;
    if (r.kind === "transfer" && r.mapId === mapId && typeof r.x === "number" && typeof r.y === "number") out.push({ from, cmd: r });
    for (const v of Object.values(r)) if (v && typeof v === "object") visit(v, from);
  };
  for (const m of Object.values(project.maps)) if (m.id !== mapId) visit(m.events ?? [], m.id);
  visit((project as { commonEvents?: unknown }).commonEvents ?? [], "");
  return out;
}

const count = (a: Uint8Array) => { let n = 0; for (const v of a) n += v; return n; };

/** 이 맵의 착지 주머니를 옮긴다. project 를 그 자리에서 고친다(부르는 쪽이 사본을 넘긴다). 한 일 글. */
export function fixLandingPockets(project: Project, mapId: string): string[] {
  const map = project.maps[mapId] as GameMap | undefined;
  if (!map || (map as { worldmapSource?: unknown }).worldmapSource) return [];
  const into = transfersInto(project, mapId).filter((t) => t.cmd.x as number >= 0 && (t.cmd.y as number) >= 0 && (t.cmd.x as number) < map.width && (t.cmd.y as number) < map.height);
  if (!into.length) return [];
  const blocked = blockersOf(map);
  const reachOf = (c: Cell) => reachFrom(project, map, [c], blocked, []);
  const anchors: Cell[] = [...new Map(into.map((t) => [`${t.cmd.x},${t.cmd.y}`, { x: t.cmd.x as number, y: t.cmd.y as number }])).values()];
  if (project.startMapId === mapId && project.startPos) anchors.push({ x: project.startPos.x, y: project.startPos.y });
  const reaches = anchors.map((a) => ({ a, r: reachOf(a), n: 0 }));
  for (const x of reaches) x.n = count(x.r);
  const main = [...reaches].sort((p, q) => q.n - p.n)[0];
  if (!main || main.n <= POCKET * 3) return [];
  const notes: string[] = [];
  const w = map.width;
  const eventAt = new Set((map.events ?? []).map((e) => e.y * w + e.x));
  for (const { a, n } of reaches) {
    if (n > POCKET || main.r[a.y * w + a.x]) continue;
    const cmds = into.filter((t) => t.cmd.x === a.x && t.cmd.y === a.y);
    if (!cmds.length) continue;
    // 돌아가는 문: 이 맵에서 출발 맵으로 옮기는 이벤트(그 칸 곁의 덩어리 칸이 새 착지 후보 1순위).
    const fromMaps = new Set(cmds.map((t) => t.from));
    const gates = (map.events ?? []).filter((e) => JSON.stringify(e.pages ?? []).match(/"kind":"transfer","mapId":"([^"]+)"/g)?.some((s) => [...fromMaps].some((f) => s.includes(`"${f}"`))));
    const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < map.height && !!main.r[y * w + x] && !eventAt.has(y * w + x) && isPassable(project, map, x, y);
    const dist = (c: Cell) => Math.abs(c.x - a.x) + Math.abs(c.y - a.y);
    let spot: (Cell & { face?: string }) | undefined;
    for (const g of [...gates].sort((p, q) => dist(p) - dist(q))) {
      for (const [dx, dy] of DIRS) {
        const c = { x: g.x + dx, y: g.y + dy };
        if (ok(c.x, c.y) && (!spot || dist(c) < dist(spot))) spot = { ...c, face: dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up" };
      }
      if (spot) break;
    }
    if (!spot) {
      for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) if (ok(x, y) && (!spot || dist({ x, y }) < dist(spot))) spot = { x, y };
    }
    if (!spot) continue;
    for (const t of cmds) {
      t.cmd.x = spot.x; t.cmd.y = spot.y;
      if (spot.face) t.cmd.direction = spot.face;   // 돌아가는 문을 등지고 선다
    }
    notes.push(`착지 칸 (${a.x},${a.y})이 걸어 나갈 곳 ${n}칸뿐인 주머니(돌아가는 문만 닿음) → (${spot.x},${spot.y})로 옮김(이동 ${cmds.length}개)`);
  }
  return notes;
}

/** 끝맺음 lanes 용: 사본에서 고쳐 바뀌었으면 바꿔 넣는다. */
export function checkLandingPockets(run: BuildRun, mapId: string): string[] {
  const next = structuredClone(run.ctx.project) as Project;
  const notes = fixLandingPockets(next, mapId);
  if (notes.length) run.ctx.project = next;
  return notes;
}
