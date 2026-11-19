// 크기 단 통행 증명 — 엔진의 충돌 판정(project/collision.ts 의 canMove · isPassable: 플레이어가 걷을 때 쓰는 것)으로 걸어 본다. 편집기·빌더의 검사 함수는 쓰지 않는다.
//   bun scripts/content/beodeul-interiors/tiers-walk.mts <outDir> [medium|large|xlarge|<구성 id>] [열쇠 수=3]
// 구성 × 평면 × 게임 열쇠마다 실제 빌더로 짓고:
//   ① 바깥문에서 모든 방 · 모든 걷는 칸 · 모든 문목 · 모든 계단(딸린 맵 왕복)까지 걸어 닿는가
//   ② 문목마다 양쪽에서 건너가지는가(옆문: 좌→우 · 우→좌, 가로 칸막이 문: 위→아래 · 아래→위)
//   ③ 문목 앞 한 칸(양쪽)을 가구가 막았는가
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { createBeodeulCityTileset } from "../../../src/project/defaults/beodeulCity.ts";
import { BEODEUL_INTERIOR_SPEC as S } from "../../../src/editor/handInterior/builder.ts";
import { tierTableOf } from "../../../src/editor/handInterior/tierPlan.ts";
import { buildTier } from "../../../src/ai/v2/place/builders/interiorTier.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const out = process.argv[2] ?? "qa-runs/v2scratch/tier-walk", want = process.argv[3] ?? "", keys = Number(process.argv[4] ?? 3);
fs.mkdirSync(out, { recursive: true });
const table = tierTableOf("beodeul_city")!;
const styles = ["halftimber", "log", "harbourstone", "violetslate"];
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

interface Sum { builds: number; failed: number; maps: number; rooms: number; roomsUnreached: number; floor: number; floorUnreached: number; side: number; sideOk: number; vert: number; vertOk: number; wide: number; wideOk: number; approachBlocked: number; doorUnreached: number; stairs: number; stairsOk: number }
const zero = (): Sum => ({ builds: 0, failed: 0, maps: 0, rooms: 0, roomsUnreached: 0, floor: 0, floorUnreached: 0, side: 0, sideOk: 0, vert: 0, vertOk: 0, wide: 0, wideOk: 0, approachBlocked: 0, doorUnreached: 0, stairs: 0, stairsOk: 0 });
const sums: Record<string, Sum> = {}; const problems: string[] = []; const sideDoors: { tag: string; map: string; x: number; y: number }[] = [];

function reach(project: Project, map: GameMap, starts: readonly { x: number; y: number }[]): Set<number> {
  const seen = new Set<number>(); const q: number[] = [];
  for (const s of starts) { const i = s.y * map.width + s.x; if (!seen.has(i)) { seen.add(i); q.push(i); } }
  while (q.length) {
    const c = q.pop()!; const x = c % map.width, y = Math.floor(c / map.width);
    for (const [dx, dy] of STEPS) { const nx = x + dx, ny = y + dy, n = ny * map.width + nx; if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(n)) continue; if (canMove(project, map, x, y, nx, ny)) { seen.add(n); q.push(n); } }
  }
  return seen;
}
const transfers = (m: GameMap) => (m.events ?? []).flatMap((e) => (e.pages ?? []).flatMap((p) => (p.commands ?? []).filter((c) => (c as { kind?: string }).kind === "transfer").map((c) => ({ ev: e, to: c as unknown as { mapId: string; x: number; y: number } }))));

for (const [pid, p] of Object.entries(table.programs)) {
  if (want && want !== p.tier && want !== pid) continue;
  const sum = (sums[p.tier] ??= zero());
  for (let s = 0; s < p.shapes.length; s++) for (let k = 0; k < keys; k++) {
    const tag = `${pid}/${p.shapes[s]!.id}#${k}`;
    const project = createBlankProject(); const ts = createBeodeulCityTileset(); project.tilesets[ts.id] = ts;
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const run = createBuildRun(ctx); const notes: string[] = [];
    const r = buildTier(run, { type: "interior", name: p.ko } as never, { tilesetId: ts.id, roomSpec: S, outside: { tileset: ts.id, tier: p.tier, style: styles[(s + k) % styles.length]! }, mainKind: p.serves[k % p.serves.length]!, named: true,
      varietyKey: `열쇠${k}|${p.ko}`, mapId: undefined, force: { program: pid, shape: s } }, notes);
    sum.builds++;
    if (!r?.ok || !r.entrance) { sum.failed++; problems.push(`${tag}: 못 지음 — ${notes.join(" / ").slice(0, 200)}`); continue; }
    const P = run.ctx.project; const maps = r.mapIds.map((id) => P.maps[id]!);
    // 맵마다 걸어 닿은 칸: 본채는 바깥문 칸에서, 딸린 맵은 이미 닿은 계단이 내려 주는 칸에서(닿은 계단만 따라간다 — 왕복이 실제로 되는지 보려는 것).
    const reached = new Map<string, Set<number>>(); const arrivals = new Map<string, { x: number; y: number }[]>([[r.entrance.mapId, [{ x: r.entrance.x, y: r.entrance.y }]]]);
    const touch = (m: GameMap, set: Set<number>, e: { x: number; y: number }) => set.has(e.y * m.width + e.x) || STEPS.some(([dx, dy]) => set.has((e.y + dy) * m.width + e.x + dx));
    for (let round = 0; round < maps.length + 1; round++) for (const m of maps) {
      const st = arrivals.get(m.id); if (!st) continue;
      const set = reach(P, m, st); reached.set(m.id, set);
      for (const t of transfers(m)) if (touch(m, set, t.ev)) { const a = arrivals.get(t.to.mapId) ?? []; if (!a.some((c) => c.x === t.to.x && c.y === t.to.y)) { a.push({ x: t.to.x, y: t.to.y }); arrivals.set(t.to.mapId, a); } }
    }
    for (const m of maps) {
      sum.maps++;
      const set = reached.get(m.id) ?? new Set<number>();
      const rooms = (m.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")) as unknown as { name: string; x: number; y: number; w: number; h: number }[];
      const inRoom = (x: number, y: number) => rooms.some((q) => x >= q.x && y >= q.y && x < q.x + q.w && y < q.y + q.h);
      const open = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && isPassable(P, m, x, y);
      for (const q of rooms) {
        sum.rooms++; let any = false;
        for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) { if (!open(x, y)) continue; sum.floor++; if (set.has(y * m.width + x)) any = true; else { sum.floorUnreached++; if (problems.length < 400) problems.push(`${tag} ${m.name}: 걷는 칸 (${x},${y}) 에 못 닿음 — 방 ${q.name}`); } }
        if (!any) { sum.roomsUnreached++; problems.push(`${tag} ${m.name}: 방 ${q.name} 에 못 닿음`); }
      }
      // 문목 = 방 사각형 밖의 걷는 칸(칸막이의 틈). 본채의 바깥문 칸(맨 아래 줄)은 뺀다.
      for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
        if (inRoom(x, y) || !open(x, y) || (m.id === r.entrance.mapId && x === r.entrance.x && y >= r.entrance.y - 1)) continue;
        const side = inRoom(x - 1, y) && inRoom(x + 1, y), vert = inRoom(x, y - 1) && inRoom(x, y + 1);
        if (!side && !vert) continue;
        if (!set.has(y * m.width + x)) { sum.doorUnreached++; problems.push(`${tag} ${m.name}: 문목 (${x},${y}) 에 못 닿음`); }
        // 건너기: 문목 앞 칸 → 문목 → 건너편 앞 칸, 두 방향 모두. 가로 칸막이 문은 아래로 벽면 높이 두 줄을 더 지나 바닥까지.
        // 칸막이 없이 트인 자리(본당과 제단처럼 옆 칸도 틈인 넓은 트임)는 벽면 줄이 없다 — 위·아래 한 칸씩만 본다(그 아래 줄의 기둥·의자는 문목 앞이 아니다).
        const wide = !side && ((!inRoom(x - 1, y) && open(x - 1, y)) || (!inRoom(x + 1, y) && open(x + 1, y)));
        const chain = side ? [[x - 1, y], [x, y], [x + 1, y]] : wide ? [[x, y - 1], [x, y], [x, y + 1]] : [[x, y - 1], [x, y], [x, y + 1], [x, y + 2], [x, y + 3]].filter(([cx, cy]) => cy! < m.height && (cy! <= y + 1 || inRoom(cx!, cy!)));
        const walk = (cs: number[][]) => cs.every((c, i) => i === 0 || canMove(P, m, cs[i - 1]![0]!, cs[i - 1]![1]!, c[0]!, c[1]!));
        const fwd = walk(chain), back = walk([...chain].reverse());
        const ends = [chain[0]!, chain.at(-1)!]; const blocked = ends.filter(([cx, cy]) => !open(cx!, cy!)).length;
        sum.approachBlocked += blocked;
        if (side) { sum.side++; if (fwd && back) sum.sideOk++; if (sideDoors.length < 4000) sideDoors.push({ tag, map: m.name ?? m.id, x, y }); } else if (wide) { sum.wide++; if (fwd && back) sum.wideOk++; } else { sum.vert++; if (fwd && back) sum.vertOk++; }
        if (!fwd || !back || blocked) problems.push(`${tag} ${m.name}: ${side ? "옆문" : "가로 칸막이 문"} (${x},${y}) — ${side ? `좌→우 ${fwd ? "됨" : "막힘"} · 우→좌 ${back ? "됨" : "막힘"}` : `위→아래 ${fwd ? "됨" : "막힘"} · 아래→위 ${back ? "됨" : "막힘"}`}${blocked ? ` · 문목 앞 칸 ${blocked}곳 막힘` : ""}`);
      }
      // 계단: 이 맵의 이동 이벤트마다 — 닿는가, 내려 준 칸에서 걸을 수 있는가, 그 맵에 돌아오는 계단이 있고 거기 닿는가.
      for (const t of transfers(m)) {
        sum.stairs++;
        const there = P.maps[t.to.mapId]; const tset = there ? reached.get(there.id) : undefined;
        const okHere = touch(m, set, t.ev);
        const okLand = !!there && !!tset && tset.has(t.to.y * there.width + t.to.x) && STEPS.some(([dx, dy]) => canMove(P, there, t.to.x, t.to.y, t.to.x + dx, t.to.y + dy));
        const okBack = !!there && !!tset && transfers(there).some((b) => b.to.mapId === m.id && touch(there, tset, b.ev) && set.has(b.to.y * m.width + b.to.x));
        if (okHere && okLand && okBack) sum.stairsOk++; else problems.push(`${tag} ${m.name}: 계단 (${t.ev.x},${t.ev.y}) — 닿음 ${okHere} · 내린 칸 ${okLand} · 돌아옴 ${okBack}`);
      }
    }
    console.log(`${tag}: 맵 ${maps.length}`);
  }
}
const KO: Record<string, string> = { medium: "중형", large: "대형", xlarge: "초대형" };
const md = ["# 크기 단 통행 — 엔진 충돌 판정(canMove · isPassable)", "",
  "| 단 | 지은 것(못 지음) | 맵 | 방(못 닿은 방) | 걷는 칸(못 닿은 칸) | 문목에 못 닿음 | 옆문: 좌↔우 건넘/전체 | 가로 칸막이 문: 위↔아래 건넘/전체 | 칸막이 없이 트인 칸: 위↔아래 건넘/전체 | 문목 앞 칸 막힘 | 계단: 왕복 됨/전체 |", "|---|---|---|---|---|---|---|---|---|---|---|",
  ...Object.entries(sums).map(([t, s]) => `| ${KO[t] ?? t} | ${s.builds}(${s.failed}) | ${s.maps} | ${s.rooms}(${s.roomsUnreached}) | ${s.floor}(${s.floorUnreached}) | ${s.doorUnreached} | ${s.sideOk}/${s.side} | ${s.vertOk}/${s.vert} | ${s.wideOk}/${s.wide} | ${s.approachBlocked} | ${s.stairsOk}/${s.stairs} |`),
  "", `문제 ${problems.length}건`, ...problems.slice(0, 200).map((q) => `- ${q}`)].join("\n");
fs.writeFileSync(path.join(out, "tier-walk.md"), md); fs.writeFileSync(path.join(out, "tier-walk.json"), JSON.stringify({ sums, problems, sideDoors: sideDoors.slice(0, 60) }, null, 1));
console.log(md.split("\n").slice(0, 12).join("\n"));
