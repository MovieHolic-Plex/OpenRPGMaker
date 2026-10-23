import fs from 'node:fs';
fs.mkdirSync('output/va-walk', { recursive: true });
const [src, kit] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(src, 'utf8'));
const map = p.maps[p.startMapId];
const W = map.width, H = map.height, L = [map.lowerTiles, map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles];
const at = (l, x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : (L[l]?.[y * W + x] ?? -1);
const inStruct = (x, y) => (map.structurePlacements ?? []).some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
const empty = (x, y) => !inStruct(x, y) && [1, 2, 3].every((l) => at(l, x, y) < 0);
let pick = null;
if (kit === 'yard') {
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = at(0, x, y); if (t >= 29568 && t < 29824) cells.push([x, y]); }
  const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length, cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
  pick = cells.filter(([x, y]) => empty(x, y) && empty(x, y - 1)).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy + 2) - Math.hypot(b[0] - cx, b[1] - cy + 2))[0];
  fs.writeFileSync('output/va-walk/yard.route.json', JSON.stringify({ mapId: p.startMapId, x: pick[0], y: pick[1], note: `마당 칸 ${cells.length}개 한가운데 근처`, legs: [['left', 2200], ['down', 1400], ['right', 3600], ['up', 2400], ['left', 1600]] }));
} else {
  pick = [p.startPos.x, p.startPos.y];
  fs.writeFileSync('output/va-walk/wasteland.route.json', JSON.stringify({ mapId: p.startMapId, x: pick[0], y: pick[1], note: '옛 국도 서쪽 끝(시작 칸)', legs: [['right', 5200], ['up', 1600], ['right', 2400], ['down', 3200], ['left', 1800]] }));
}
fs.writeFileSync(`output/va-walk/${kit}.json`, JSON.stringify(p));
console.log(kit, p.startMapId, pick, Object.keys(map).filter((k) => /layer|tile/i.test(k)));
