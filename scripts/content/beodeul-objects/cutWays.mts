// 새 종류 기물이 걷는 길을 끊는가(모델 없음): 게임 열쇠를 켜고 지은 마을에서 새 기물의 3층 칸만 지운 사본을 만들어 입구에서 닿는 칸을 견준다.
//   bun scripts/content/beodeul-objects/cutWays.mts [열쇠 이름,쉼표로]   (기본 ashvale,thornkeep,saltmere — 열쇠마다 마을 아홉)
// «끊긴 칸» = 새 기물을 지우면 닿는데 지금은 안 닿는 걷는 칸(기물이 선 칸 자체는 뺀다).
const R = new URL("../../..", import.meta.url).pathname.replace(/\/$/u, "");
const { createBlankProject } = await import(`${R}/src/project/defaults`);
const { ensureBundledTilesets } = await import(`${R}/src/project/defaults/defaultAssets`);
const { runTool } = await import(`${R}/src/editor/tools`);
const { isPassable } = await import(`${R}/src/project/collision`);
const { computeReachableCells } = await import(`${R}/src/project/lint/reachability`);
const { layerTileAt } = await import(`${R}/src/project/mapLayers`);
const catalog = (await import(`${R}/tiledata/beodeul-objects/catalog.json`)).default as any;
const NEWS = catalog.items.filter((i: any) => i.waiver === "fable-objects100-beodeul-2026-11-14");
const base = createBlankProject(); ensureBundledTilesets(base); const TEMPLATE = JSON.stringify(base);
const CASES = ["river:plaza:flat:7", "river:riverbank:flat:5", "river:scatter:hillside:3", "river:street:terraces:11", "coast:plaza:flat:7", "coast:street:terraces:42:64x40", "river:street:flat:3", "river:plaza:hillside:23", "coast:scatter:flat:5"];
const KEYS = (process.argv[2] ?? "ashvale,thornkeep,saltmere").split(",");
let total = 0, builds = 0;
for (const name of KEYS) for (const c of CASES) {
  const [theme, form, terrain, sd, sz] = c.split(":"); const [w, h] = sz ? sz.split("x").map(Number) : [];
  const ctx: any = { project: JSON.parse(TEMPLATE), assistantRun: true, lookKey: JSON.stringify(["project", `variety-${name}`]) };
  const r = runTool(ctx, "author_beodeul_town", { theme, form, terrain, seed: Number(sd), id: "v", ...(w ? { width: w, height: h } : {}) });
  if (!r.ok) { console.log(name, c, "build refused:", String(r.summary).slice(0, 90)); continue; }
  builds += 1;
  const d: any = r.data, map = ctx.project.maps[d.mapId], W = map.width;
  const start = ctx.project.startMapId === map.id ? ctx.project.startPos : d.entrance ?? ctx.project.startPos;
  const own = new Set<number>(); const kinds: string[] = [];
  for (const it of NEWS) { const cells = it.rows.flatMap((row: number[], dy: number) => row.map((t, dx) => ({ dx, dy, t })).filter((q: any) => q.t >= 0));
    for (let y = 0; y + it.rows.length <= map.height; y++) for (let x = 0; x + it.rows[0].length <= W; x++) if (cells.every((q: any) => layerTileAt(map, 3, (y + q.dy) * W + x + q.dx) === q.t)) { kinds.push(it.id); for (const q of cells) own.add((y + q.dy) * W + x + q.dx); } }
  const now = computeReachableCells(ctx.project, map, start.x, start.y);
  const bare = JSON.parse(JSON.stringify(map)); for (const cell of own) bare.upperTiles[cell] = -1;
  const p2 = { ...ctx.project, maps: { ...ctx.project.maps, [map.id]: bare } };
  const was = computeReachableCells(p2, bare, start.x, start.y);
  const key = (x: number, y: number) => `${x},${y}`; const has = (s: any, x: number, y: number) => s.has(key(x, y)) || s.has(y * W + x);
  const cut: string[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < W; x++) { if (own.has(y * W + x)) continue; if (isPassable(ctx.project, map, x, y) && has(was, x, y) && !has(now, x, y)) cut.push(key(x, y)); }
  total += cut.length;
  console.log(name, c, `새 기물 ${kinds.length} · 닿는 칸 ${now.size} (기물 걷어내면 ${was.size}) · 끊긴 칸 ${cut.length}${cut.length ? " @ " + cut.slice(0, 12).join(" ") : ""} · 닿지 않는 문 ${d.doors.filter((x: any) => !x.reached).length}`);
}
console.log(`마을 ${builds} · 끊긴 칸 합계 ${total}`);
