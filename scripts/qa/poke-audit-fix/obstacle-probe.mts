// place_field_obstacle: 한 칸 장애물의 우회 경고, fullWidth/span 으로 도로 폭 전체 닫기. bun scripts/qa/poke-audit-fix/obstacle-probe.mts <fixture.json>
import { readFileSync } from 'node:fs';
import { deserialize } from '@/project/io';
import { getTool } from '@/editor/tools';
import { isPassable } from '@/project/collision';

const project = deserialize(readFileSync(process.argv[2]!, 'utf8'));
const tool = getTool('place_field_obstacle')!;
const maps = Object.values(project.maps);
const route = maps.find((m) => /길/u.test(m.name) && m.width >= 20) ?? maps[1]!;
console.log('map', route.id, route.name, route.width + 'x' + route.height, route.tilesetId);
const ascii = (m = route) => { const rows: string[] = []; for (let y = 0; y < m.height; y++) { let r = ''; for (let x = 0; x < m.width; x++) { const ev = m.events.some((e) => e.x === x && e.y === y); r += ev ? 'E' : isPassable(project, m, x, y) ? '.' : '#'; } rows.push(r); } return rows.join('\n'); };
// 걸을 수 있는 칸 중 가로 폭 2~6칸인 위치를 찾는다.
function widthAt(x: number, y: number, horizontal: boolean) { let n = 1; const d = horizontal ? [1, 0] : [0, 1]; for (const s of [1, -1]) { let cx = x + s * d[0]!, cy = y + s * d[1]!; while (cx >= 0 && cy >= 0 && cx < route.width && cy < route.height && isPassable(project, route, cx, cy)) { n++; cx += s * d[0]!; cy += s * d[1]!; } } return n; }
let pick: { x: number; y: number; w: number; h: number } | undefined;
for (let y = 3; y < route.height - 3 && !pick; y++) for (let x = 3; x < route.width - 3 && !pick; x++) {
  if (!isPassable(project, route, x, y) || route.events.some((e) => e.x === x && e.y === y)) continue;
  const w = widthAt(x, y, true), h = widthAt(x, y, false);
  if (w >= 3 && w <= 8 && h >= 12) pick = { x, y, w, h };
}
if (!pick) { console.log(ascii()); throw Error('no suitable road cell'); }
console.log('pick', pick);
const run = (label: string, args: Record<string, unknown>) => {
  const draft = structuredClone(project);
  try {
    const out = tool.run(draft, { mapId: route.id, x: pick!.x, y: pick!.y, kind: 'tree', ...args } as never) as { summary: string; data?: Record<string, unknown>; warnings?: string[] };
    console.log(`\n[${label}] ${out.summary}\n  bypass=${out.data?.bypass} roadWidth=${out.data?.roadWidth} cells=${JSON.stringify(out.data?.cells)} events=${JSON.stringify(out.data?.eventIds)}`);
    for (const w of out.warnings ?? []) console.log('  warn:', w.slice(0, 260));
    return { draft, out };
  } catch (e) { console.log(`\n[${label}] ERROR ${(e as Error).message.slice(0, 300)}`); return undefined; }
};
run('single cell (default)', {});
const full = run('fullWidth', { fullWidth: true });
run('span=2', { span: 2 });
run(`span=${pick.w}`, { span: pick.w });
run('span+fullWidth', { span: 2, fullWidth: true });
run('span on water', { kind: 'water', span: 2 });
if (full) {
  const m = full.draft.maps[route.id]!;
  const rows = ascii(m).split('\n').slice(Math.max(0, pick.y - 4), pick.y + 5);
  console.log('\nafter fullWidth (E=event):\n' + rows.join('\n'));
  // 같은 id 로 다시 부르면 보조 이벤트가 정리되는가
  const again = tool.run(full.draft, { mapId: route.id, x: pick.x, y: pick.y, kind: 'tree', id: (full.out.data!.eventId as string) } as never) as { data?: Record<string, unknown> };
  console.log('re-place same id single cell: events in map near=', full.draft.maps[route.id]!.events.filter((e) => String(e.id).startsWith(String(full.out.data!.eventId))).length);
}
