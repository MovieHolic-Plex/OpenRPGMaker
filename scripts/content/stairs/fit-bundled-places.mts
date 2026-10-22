// 공용 장소 내려받기(public/assets/region-references/*.oprn.json)의 계단 층 이동을 입구 계약대로 맞춘다(2026-10-22).
// 이동 이벤트 → 계단 그림 칸, 도착 → 짝 계단 앞 칸·계단을 등진 방향. 그림·지형은 건드리지 않는다(막힌 계단통은 검사 결과로만 남는다).
// 실행: npx --no-install tsx scripts/content/stairs/fit-bundled-places.mts [--write]
import fs from "node:fs";
import path from "node:path";
const { fitStairTransfers } = await import("../../../src/project/stairs/fit");
const dir = path.join(process.cwd(), "public/assets/region-references");
const bundled = new Map<string, unknown>();
for (const f of fs.readdirSync("src/assets").filter((f) => /Tileset\.json$/u.test(f))) {
  const t = JSON.parse(fs.readFileSync(path.join("src/assets", f), "utf8"));
  bundled.set(t.id, t);
}
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".oprn.json"))) {
  const file = path.join(dir, f);
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const own = raw.tilesets ?? {};
  const p = { ...raw, tilesets: { ...own } };
  for (const m of Object.values<any>(p.maps ?? {})) if (!p.tilesets[m.tilesetId] && bundled.has(m.tilesetId)) p.tilesets[m.tilesetId] = bundled.get(m.tilesetId);
  const notes = fitStairTransfers(p, Object.keys(p.maps ?? {}));
  if (!notes.length) continue;
  console.log(`${f}\n  ${notes.join("\n  ")}`);
  if (process.argv.includes("--write")) fs.writeFileSync(file, JSON.stringify({ ...raw, maps: p.maps }));
}
