// 실제 조수 판(던전 설계 시험, suite dungeon-live.sh)의 저장본을 게임 검사(자동 플레이 포함)에 통과시킨다. 모델 없음.
//   bun scripts/qa/assistant-v2/dungeonLiveCheck.mts <run-dir>... > report.json
// 판마다: 막힘(blocker) 코드, 자동 플레이 결과(엔딩·목표 실패), 던전 맵마다 열린 바닥 한가운데 홀로 선 막힌 칸 수(8방이 모두 지나갈 수 있는 칸).
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { runGameCheck } from "../../../src/qa/gameCheck/index.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";

const out: unknown[] = [];
for (const dir of process.argv.slice(2)) {
  let project: ReturnType<typeof readProjectSqlite>;
  try { project = readProjectSqlite(path.join(dir, "project")); } catch (e) { out.push({ dir, error: String(e).slice(0, 160) }); continue; }
  const r = runGameCheck(project, { autoPlayBudgetMs: 30_000, skipAutoPlay: process.env.DLC_NOPLAY === "1" });
  const runs = (r.autoPlay?.runs ?? []).map((x) => ({ label: x.label, ok: x.ok, ending: x.endingReached ?? null, fail: x.failure ? `${x.failure.goal}: ${x.failure.detail.slice(0, 200)}` : null }));
  const maps = Object.values(project.maps).filter((m) => (m.locations ?? []).some((l) => (l.tags ?? []).includes("dungeon-room"))).map((m) => {
    const P = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && isPassable(project, m, x, y);
    const lone: [number, number][] = [];
    for (let y = 1; y < m.height - 1; y += 1) for (let x = 1; x < m.width - 1; x += 1) {
      if (P(x, y)) continue;
      let open = 0; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && P(x + dx, y + dy)) open += 1;
      if (open === 8) lone.push([x, y]);
    }
    // 도달: 시작 자리(이 맵이면) 또는 이동 칸 이벤트 둘레에서 지나갈 수 있는 칸으로 번진다. 이벤트는 그 칸이나 4방 이웃이 닿으면 닿음.
    const seeds: [number, number][] = project.startMapId === m.id && project.startPos ? [[project.startPos.x, project.startPos.y]] : [];
    for (const ev of m.events) if (/transfer/u.test(JSON.stringify(ev.pages ?? []))) for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) if (P(ev.x + dx, ev.y + dy)) seeds.push([ev.x + dx, ev.y + dy]);
    const seen = new Set<number>(); const q = [...seeds];
    for (const [x, y] of q) { const k = y * m.width + x; if (seen.has(k)) continue; seen.add(k); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (P(x + dx, y + dy) && canMove(project, m, x, y, x + dx, y + dy) && !seen.has((y + dy) * m.width + x + dx)) q.push([x + dx, y + dy]); }
    const hit = (x: number, y: number) => [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has((y + dy) * m.width + x + dx));
    const unreached = m.events.filter((ev) => !hit(ev.x, ev.y)).map((ev) => `${ev.name ?? ev.id}(${ev.x},${ev.y})`);
    const floor = (() => { let n = 0; for (let y = 0; y < m.height; y += 1) for (let x = 0; x < m.width; x += 1) if (P(x, y)) n += 1; return n; })();
    return { id: m.id, name: m.name, w: m.width, h: m.height, loneBlocked: lone.length, lone: lone.slice(0, 12), events: m.events.length,
      seeds: seeds.length, floorReached: `${seen.size}/${floor}`, unreachedEvents: unreached };
  });
  out.push({ dir, blockers: r.findings.filter((f) => f.severity === "blocker").map((f) => `[${f.code}] ${f.message.slice(0, 160)}`), autoPlay: runs.length ? runs : (r.autoPlay?.skipped ?? "없음"), maps });
}
console.log(JSON.stringify(out, null, 1));
