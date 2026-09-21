// Generate with current defaults, save to a dedicated remote project, then render the reloaded document.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const output = 'output/evidence/restored-river-village';
mkdirSync(output, { recursive: true });
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(line => line.includes('=') && !line.startsWith('#')).map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const projectId = `river-groves-restored-20260921-76a3-${Date.now()}`;
async function remote(method, body) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?${method === 'GET' ? `project_id=eq.${projectId}&select=current_json,current_sha256` : 'on_conflict=project_id'}`, {
    method, headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json', 'Accept-Profile': 'rpg_zzu', 'Content-Profile': 'rpg_zzu', Prefer: 'resolution=merge-duplicates,return=representation' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) { const failure = await response.json(); throw Error(`Remote project ${method}: HTTP ${response.status} ${failure.code ?? ""} ${failure.message ?? ""}`); }
  return response.json();
}
const stable = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(stable)
  : Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;
await remote('GET'); // Connection required before content creation.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1150 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:9816'}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 });
  if (await guest.isVisible()) await guest.click();
  await page.getByTestId('ai-input').waitFor({ timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { createEmptyToolProject } = await import('/src/editor/tools/emptyProject.ts');
    const { runAuthorVillage } = await import('/src/editor/tools/authorVillageTool.ts');
    const ctx = { project: createEmptyToolProject('복원된 강변 숲마을') };
    const args = { target: { kind: 'new', mapId: 'restored_river', name: '강변 숲마을 · 복원 확인' },
      houseCount: 8, npcCount: 4, countPolicy: 'exact', interior: true, seed: 17 };
    const built = runAuthorVillage(ctx, args);
    if (!built.ok) return { ok: false, summary: built.summary, issues: built.issues, data: built.data };
    return { ok: true, project: ctx.project, args, summary: built.summary, village: built.data.village };
  });
  if (!result.ok) { writeFileSync(`${output}/failure.json`, JSON.stringify(result, null, 2)); throw Error(result.summary); }
  const p = result.project;
  const sha = createHash('sha256').update(JSON.stringify(p)).digest('hex');
  await remote('POST', { project_id: projectId, title: p.title ?? "복원된 강변 숲마을", schema_version: p.schemaVersion ?? p.version ?? 1,
    current_json: p, current_sha256: sha, map_count: Object.keys(p.maps).length, tileset_count: Object.keys(p.tilesets).length, terrain_template_count: 0 });
  const [row] = await remote('GET');
  if (row.current_sha256 !== sha || JSON.stringify(stable(row.current_json)) !== JSON.stringify(stable(p))) throw Error('Remote reload mismatch');
  writeFileSync(`${output}/reloaded.json`, JSON.stringify(row.current_json));
  const proof = await page.evaluate(async project => {
    const { drawMapTileLayers } = await import('/src/editor/mapTileDraw.ts');
    const { awaitGraftedTilesetImageUrl } = await import('/src/assets/tileGraftImageCache.ts');
    const { tilesetBaseImageUrl } = await import('/src/editor/tilesetImage.ts');
    const { computeReachableCells } = await import('/src/project/lint/reachability.ts');
    const map = project.maps.restored_river, ts = project.tilesets[map.tilesetId];
    const baked = await awaitGraftedTilesetImageUrl(ts, tilesetBaseImageUrl(ts));
    if (!baked) throw Error('Missing graft bake');
    const atlas = new Image(); atlas.src = baked; await atlas.decode();
    const canvas = document.createElement('canvas'); canvas.width = map.width * 16; canvas.height = map.height * 16;
    drawMapTileLayers(canvas.getContext('2d'), atlas, map, ts, 1);
    canvas.id = 'restored-village-canvas';
    const host = document.createElement('div');host.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#182624;padding:20px;overflow:auto';
    host.append(canvas); document.body.append(host);
    const houses = map.layoutPlan.regions.filter(r => r.role === 'house');
    const start = project.startMapId === map.id ? project.startPos : map.layoutPlan.roadAnchors[0];
    const reachable = computeReachableCells(project, map, start.x, start.y);
    const canopy = new Set(ts.autotileGroups.find(g => g.id === 'forest_harmony_grove_47').memberTileIds);
    const water = new Set(ts.autotileGroups.find(g => g.id === 'forest_harmony_lake_47').memberTileIds);
    const fences = new Set([378,379,380,408,409,410,438,439]);
    return { width: map.width, height: map.height, tilesetId: map.tilesetId,
      houses: houses.length, reachableDoors: houses.filter(h => reachable.has(`${h.front.x},${h.front.y}`)).length,
      waterCells: map.lowerTiles.filter(t => water.has(t)).length, bridgeCells: map.upperTiles.filter((t,i) => t === 199 && water.has(map.lowerTiles[i])).length,
      canopyCells: map.upperTiles.filter(t => canopy.has(t)).length, fenceCells: map.upperTiles.filter(t => fences.has(t)).length,
      marketRegions: map.layoutPlan.regions.filter(r => r.role === 'market' || r.tags?.includes('market-display')).length,
      riverRegions: map.layoutPlan.regions.filter(r => r.role === 'river').length };
  }, row.current_json);
  await page.locator('#restored-village-canvas').screenshot({ path: `${output}/village.png` });
  const report = { projectId, sha, remoteReloadVerified: true, args: result.args, summary: result.summary, village: result.village, ...proof, errors };
  writeFileSync(`${output}/observations.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
