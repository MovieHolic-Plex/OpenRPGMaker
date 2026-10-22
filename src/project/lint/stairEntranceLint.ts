// project/lint/stairEntranceLint.ts
// 계단 입구 검사(2026-10-22) — 맵에 깔린 계단을 입구 계약(project/stairs/contract.ts)으로 읽어 본다. 전부 warning.
//
//  - stair-entrance-blocked  들어서는 앞 칸이 하나도 걸을 수 있는 바닥이 아니거나, 이 맵의 도착 칸·시작 칸에서 닿지 못한다
//                            (벽에 등을 대고 놓였거나, 가구가 앞을 막았거나, 방 밖에 놓였다).
//  - stair-misfacing         오르는 계단으로 아래층(지하)에, 내려가는 계단으로 위층(옥상)에 간다 · 같은 쪽 계단끼리 이었다 ·
//                            이 계단으로 도착한 사람이 계단 위에 서거나 계단 쪽을 보고 선다.
//  - stair-trigger-off       이 계단의 층 이동 이벤트가 계단 그림 칸(trigger)이 아니라 앞 바닥 등에 있다 — 지나가기만 해도 층이 바뀐다.
import type { Command, GameEvent, GameMap, Project } from "../types";
import { stairApproachCells, stairArrivalFacing, stairTriggerCells } from "../stairs/contract";
import { findPlacedStairs, walkableCell, type FoundStair } from "../stairs/detect";
import type { LintIssue } from "./projectLint";

type Transfer = Extract<Command, { kind: "transfer" }>;
type Cell = { x: number; y: number };

function transfersOf(event: GameEvent): Transfer[] {
  const lists = [event.commands ?? [], ...(event.pages ?? []).map((p) => p.commands ?? [])];
  return lists.flatMap((l) => l.filter((c): c is Transfer => c?.kind === "transfer"));
}

/** 이름으로 보는 층(옥상 높음, 지하 낮음). 모르면 null. */
export function mapLevelHint(map: GameMap | undefined): number | null {
  const name = `${map?.name ?? ""} ${map?.id ?? ""}`;
  if (/옥상|rooftop|\broof\b|屋上/iu.test(name)) return 1000;
  const under = name.match(/지하\s*(\d+)?|\bB(\d)\b|basement|cellar|地下|지하실|하수도|sewer/iu);
  if (under) return -Number(under[1] ?? under[2] ?? 1);
  const floor = name.match(/(\d+)\s*(?:층|F\b|f\b|階)/u);
  return floor ? Number(floor[1]) : null;
}

const key = (c: Cell) => `${c.x},${c.y}`;
const LEAD_KO = { up: "오르는", down: "내려가는", same: "같은 맵" } as const;

function footprint(s: FoundStair): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < s.contract.h; dy++) for (let dx = 0; dx < s.contract.w; dx++) out.push({ x: s.x + dx, y: s.y + dy });
  return out;
}

/** 이 맵에 사람이 들어오는 칸: 다른 맵에서 오는 이동의 도착 칸 + 시작 칸. 거기서 걸어서 닿는 칸 집합. */
function reachableFromArrivals(project: Project, map: GameMap): Set<string> | null {
  const seeds: Cell[] = [];
  for (const other of Object.values(project.maps)) {
    if (other.id === map.id) continue;
    for (const e of other.events ?? []) for (const t of transfersOf(e)) if (t.mapId === map.id) seeds.push({ x: t.x, y: t.y });
  }
  if (project.startMapId === map.id && project.startPos) seeds.push({ x: project.startPos.x, y: project.startPos.y });
  if (!seeds.length) return null;
  const seen = new Set<string>();
  const q: Cell[] = [];
  for (const s of seeds) if (walkableCell(project, map, s.x, s.y) && !seen.has(key(s))) { seen.add(key(s)); q.push(s); }
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (!seen.has(key(n)) && walkableCell(project, map, n.x, n.y)) { seen.add(key(n)); q.push(n); }
    }
  }
  return seen;
}

export function checkStairEntrances(project: Project, issues: LintIssue[]): void {
  const stairsByMap = new Map<string, FoundStair[]>();
  const stairsOf = (map: GameMap) => {
    let s = stairsByMap.get(map.id);
    if (!s) { s = findPlacedStairs(project, map); stairsByMap.set(map.id, s); }
    return s;
  };
  for (const map of Object.values(project.maps)) {
    const stairs = stairsOf(map);
    if (!stairs.length) continue;
    const reach = reachableFromArrivals(project, map);
    for (const s of stairs) {
      const c = s.contract;
      const at = `맵 ${map.name || map.id} 의 ${LEAD_KO[c.leads]} 계단 ${s.kitId} @(${s.x},${s.y})`;
      const approach = stairApproachCells(s).filter((p) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height);
      const trig = stairTriggerCells(s);
      const foot = footprint(s);
      const zone = new Set([...foot, ...approach].map(key));
      const links = (map.events ?? []).filter((e) => zone.has(key(e)) && transfersOf(e).some((t) => t.mapId !== map.id));
      const walkable = approach.filter((p) => walkableCell(project, map, p.x, p.y));
      // 같은 맵 단은 이동이 없으니 앞 칸만 본다. 층 이동 계단은 이 맵에 이어진 것(이벤트가 있는 것)만 연결까지 본다.
      if (!walkable.length) {
        issues.push({ severity: "warning", code: "stair-entrance-blocked", mapId: map.id, x: s.x, y: s.y,
          message: `${at} — 들어서는 앞 칸 ${approach.map((p) => `(${p.x},${p.y})`).join(" ") || "(맵 밖)"} 이 모두 막혔다(벽·가구·맵 밖). ${c.note}` });
      } else if (reach && (links.length || c.leads === "same") && !walkable.some((p) => reach.has(key(p)))) {
        issues.push({ severity: "warning", code: "stair-entrance-blocked", mapId: map.id, x: walkable[0]!.x, y: walkable[0]!.y,
          message: `${at} — 앞 칸 ${walkable.map((p) => `(${p.x},${p.y})`).join(" ")} 에 이 맵 도착 칸에서 걸어서 닿지 못한다(방 밖이거나 길이 막혔다).` });
      }
      if (c.leads === "same") continue;
      const trigSet = new Set(trig.map(key));
      for (const e of links) {
        if (!trigSet.has(key(e))) {
          issues.push({ severity: "warning", code: "stair-trigger-off", mapId: map.id, eventId: e.id, x: e.x, y: e.y,
            message: `${at} 의 층 이동 ${e.id}(${e.x},${e.y}) 가 계단 그림 칸이 아니다 — 이동 칸 ${trig.map((p) => `(${p.x},${p.y})`).join(" ")} 중 하나로 옮긴다${c.mode === "bump" ? "(막힌 그림이라 priority same)" : ""}. 앞 바닥에 두면 지나가기만 해도 층이 바뀐다.` });
        }
        for (const t of transfersOf(e)) {
          const dest = project.maps[t.mapId];
          if (!dest || dest.id === map.id) continue;
          // ① 도착한 쪽 계단과 방향이 짝인가(오르는 계단 ↔ 내려가는 계단).
          // 도착 칸에 가장 가까운 계단(그림·앞 칸 1칸 안). 계단 둘이 나란하면 첫 계단이 아니라 바로 앞에 내린 쪽이다.
          const gap = (d: FoundStair) => Math.min(...[...footprint(d), ...stairApproachCells(d)].map((p) => Math.abs(p.x - t.x) + Math.abs(p.y - t.y)));
          const there = stairsOf(dest).filter((d) => d.contract.leads !== "same" && gap(d) <= 1).sort((a, b) => gap(a) - gap(b))[0];
          if (there && there.contract.leads === c.leads) {
            issues.push({ severity: "warning", code: "stair-misfacing", mapId: map.id, eventId: e.id, x: e.x, y: e.y,
              message: `${at} 로 ${dest.name || dest.id} 의 ${LEAD_KO[there.contract.leads]} 계단 ${there.kitId} 에 도착한다 — 같은 쪽 계단끼리 이었다. 위층에는 내려가는 계단, 아래층에는 오르는 계단이 짝이다.` });
          } else {
            // ② 이름으로 아는 층과 방향.
            const here = mapLevelHint(map), go = mapLevelHint(dest);
            const wrong = (here !== null && go !== null && here !== go && (go > here) !== (c.leads === "up"))
              || (go === 1000 && c.leads === "down") || (go !== null && go < 0 && here === null && c.leads === "up");
            if (wrong) issues.push({ severity: "warning", code: "stair-misfacing", mapId: map.id, eventId: e.id, x: e.x, y: e.y,
              message: `${at} 로 ${dest.name || dest.id} 에 간다 — ${go === 1000 ? "옥상(위)" : go !== null && go < 0 ? "지하(아래)" : `${go}층`} 인데 ${LEAD_KO[c.leads]} 계단이다. 가는 쪽에 맞는 계단(${c.leads === "up" ? "내려가는" : "오르는"} 그림)을 쓴다.` });
          }
        }
      }
      // ③ 이 계단으로 도착하는 사람: 앞 칸에 내려 계단을 등진다.
      for (const other of Object.values(project.maps)) {
        if (other.id === map.id) continue;
        for (const e of other.events ?? []) for (const t of transfersOf(e)) {
          if (t.mapId !== map.id) continue;
          const onStair = foot.some((p) => p.x === t.x && p.y === t.y);
          const onApproach = approach.find((p) => p.x === t.x && p.y === t.y);
          if (!onStair && !onApproach) continue;
          // 이 도착이 이 계단을 쓰는 이동(돌아오는 계단)일 때만 — 다른 문으로 들어오는 사람이 계단 앞에 서는 것은 따로 본다.
          const facing = stairArrivalFacing(c, onApproach, trig[0]);
          if (onStair && trigSet.has(key(t))) {
            issues.push({ severity: "warning", code: "stair-misfacing", mapId: other.id, eventId: e.id, x: e.x, y: e.y,
              message: `${other.name || other.id} 의 ${e.id} 가 ${at} 의 계단 칸(${t.x},${t.y}) 위에 내린다 — 앞 칸 ${approach.map((p) => `(${p.x},${p.y})`).join(" ")} 에 내리고 direction "${facing}"(계단을 등짐).` });
          } else if (onApproach && t.direction !== facing) {
            issues.push({ severity: "warning", code: "stair-misfacing", mapId: other.id, eventId: e.id, x: e.x, y: e.y,
              message: `${other.name || other.id} 의 ${e.id} 가 ${at} 앞 (${t.x},${t.y}) 에 ${t.direction ? `"${t.direction}"` : "방향 없이"} 내린다 — 계단을 등지는 direction "${facing}" 로.` });
          }
        }
      }
    }
  }
}

export function lintStairEntrances(project: Project): LintIssue[] {
  const out: LintIssue[] = [];
  checkStairEntrances(project, out);
  return out;
}
