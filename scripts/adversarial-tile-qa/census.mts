import { createSampleAdventureProject } from "../../src/project/defaults/defaultProject";
const p = createSampleAdventureProject();
const m = p.maps[p.startMapId];
const hist: Record<number, number> = {};
for (const t of m.lowerTiles) hist[t] = (hist[t] ?? 0) + 1;
const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(p.startMapId, m.width, m.height, "startPos", JSON.stringify(p.startPos));
console.log("lower hist top:", top.map(([k, v]) => `${k}×${v}`).join(" "));
console.log("water-ish ids present:", [0,1,2,30,31,32,60,61,62,120,121,122].filter((id) => hist[id]).map((id) => `${id}×${hist[id]}`).join(" "));
// find a lake cell (tile 0..2)
let lake: string | null = null;
for (let i = 0; i < m.lowerTiles.length; i++) if ([0,1,2].includes(m.lowerTiles[i])) { lake = `${i % m.width},${Math.floor(i / m.width)}`; break; }
console.log("first lake cell:", lake);
const ts = p.tilesets[m.tilesetId];
const groups = (ts as any).tileGroups ?? [];
console.log("tileset groups:", groups.length, groups.filter((g: any) => /물|water|호수/i.test(g.name + g.id)).map((g: any) => `${g.id}|${g.name}|kind=${g.patternGrammar?.kind}|tiles=${g.tileIds.slice(0,6)}`).join("\n  "));
{
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let i = 0; i < m.lowerTiles.length; i++) if (m.lowerTiles[i] === 120) { const x = i % m.width, y = Math.floor(i / m.width); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  console.log("tile120 bbox:", minX, minY, maxX, maxY);
  const ev = m.events.slice(0, 40).map((e: any) => `${e.name ?? e.id}@(${e.x},${e.y})`);
  console.log("events:", ev.join(" "));
}
