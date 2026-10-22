// 계단 입구 계약을 번들 장소·예제 전체에 대 본다(2026-10-22).
//   A) 방 견본(roomTemplates, 칩셋마다) 중 계단이 든 것 — 방 상자 하나를 벽으로 두르고 남쪽 문을 내 조립기로 짓는다.
//      조립기 오류 stair-entrance-blocked · travel-landing-unreached 를 모은다.
//   B) 일본 집 2층 청사진(씨앗 0~7) — 평면이 있는 층은 그대로 짓는다.
//   C) 공용 장소 내려받기(public/assets/region-references/*.oprn.json) — 맵 검사(lintStairEntrances).
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/staging/lint-bundled-stairs.mts [--json]
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const { buildHandInteriorLayers, roomSpecOf, HAND_INTERIOR_SPECS } = await import("../../../src/editor/handInterior/builder");
const { roomTemplates } = await import("../../../src/editor/handInterior/templates");
const { composeJpHouse2F } = await import("../../../src/editor/handInterior/jpHouseBlueprint");
const { stairContractForSpecObject } = await import("../../../src/project/stairs/contract");
const { lintStairEntrances } = await import("../../../src/project/lint/stairEntranceLint");
const { findPlacedStairs } = await import("../../../src/project/stairs/detect");

const bundled = new Map<string, any>();
for (const f of fs.readdirSync(path.join(ROOT, "src/assets")).filter((f) => /Tileset\.json$/u.test(f))) {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, "src/assets", f), "utf8"));
  bundled.set(t.id, t);
}
const STAIR_CODES = new Set(["stair-entrance-blocked", "travel-landing-unreached", "stairs-not-at-wall", "stairs-into-partition"]);
const out: { templates: unknown[]; blueprints: unknown[]; places: unknown[]; counts: Record<string, number> } = { templates: [], blueprints: [], places: [], counts: {} };

// A) 방 견본
let tplChecked = 0;
for (const tsId of Object.keys(HAND_INTERIOR_SPECS)) {
  const ts = bundled.get(tsId);
  const S = roomSpecOf(ts) ?? HAND_INTERIOR_SPECS[tsId]!;
  for (const t of roomTemplates(tsId)) {
    const stairs = t.items.filter((it: any) => it.t === "o" && stairContractForSpecObject(tsId, it.id));
    if (!stairs.length) continue;
    tplChecked++;
    const W = t.w + 2, H = t.h + 3;
    const plan: string[] = [];
    for (let y = 0; y < H; y++) {
      let row = "";
      for (let x = 0; x < W; x++) {
        const rx = x - 1, ry = y - 1;
        const inRoom = rx >= 0 && ry >= 0 && rx < t.w && ry < t.h && (!t.mask || t.mask[ry]?.[rx] === ".");
        row += inRoom ? "." : "#";
      }
      plan.push(row);
    }
    // 남쪽 문: 맨 아랫줄 가운데 한 칸을 연다(방 마지막 줄 바로 아래).
    const mid = Math.floor(W / 2);
    for (let y = t.h + 1; y < H; y++) plan[y] = plan[y]!.slice(0, mid) + "." + plan[y]!.slice(mid + 1);
    const objects = t.items.filter((it: any) => it.t === "o").map((it: any) => ({ id: it.id, x: it.x + 1, y: it.y + 1 }));
    const tables = t.items.filter((it: any) => it.t === "t").map((it: any) => ({ style: it.id, x: it.x + 1, y: it.y + 1, w: it.w, h: it.h }));
    try {
      const built = buildHandInteriorLayers({ plan, floor: t.floor, wall: t.wall, objects, tables }, ts, S);
      const bad = built.issues.filter((i: any) => STAIR_CODES.has(i.code));
      for (const i of bad) out.templates.push({ tileset: tsId, template: t.id, kind: t.kind, stairs: stairs.map((s: any) => s.id), code: i.code, message: i.message });
    } catch (e) { out.templates.push({ tileset: tsId, template: t.id, code: "build-failed", message: String(e).slice(0, 200) }); }
  }
}
out.counts.templatesWithStairs = tplChecked;

// B) 일본 집 2층(평면 청사진)
const jpS = HAND_INTERIOR_SPECS["jp_city"]!;
for (let seed = 0; seed < 8; seed++) {
  const bp = composeJpHouse2F(jpS, seed);
  if (!bp.plan) continue;
  const built = buildHandInteriorLayers({ plan: bp.plan, floor: bp.floor, wall: bp.wall, zones: bp.zones, objects: bp.objects, tables: bp.tables, goods: bp.goods, start: bp.start }, bundled.get("jp_city"), jpS);
  for (const i of built.issues.filter((i: any) => STAIR_CODES.has(i.code))) out.blueprints.push({ blueprint: `jp-house-2f seed ${seed}`, code: i.code, message: i.message });
}
out.counts.blueprints = 8;

// C) 공용 장소 내려받기
const dir = path.join(ROOT, "public/assets/region-references");
let places = 0, placeStairs = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".oprn.json"))) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  p.tilesets = { ...(p.tilesets ?? {}) };
  for (const m of Object.values<any>(p.maps ?? {})) if (!p.tilesets[m.tilesetId] && bundled.has(m.tilesetId)) p.tilesets[m.tilesetId] = bundled.get(m.tilesetId);
  places++;
  for (const m of Object.values<any>(p.maps ?? {})) placeStairs += findPlacedStairs(p, m).length;
  for (const i of lintStairEntrances(p)) out.places.push({ file: f, map: i.mapId, code: i.code, message: i.message });
}
out.counts.places = places;
out.counts.placeStairs = placeStairs;

if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(out, null, 1));
else {
  console.log(`방 견본(계단 있는 것) ${tplChecked}개 → 경고 ${out.templates.length}`);
  for (const r of out.templates as any[]) console.log(`  [${r.code}] ${r.tileset}/${r.template} (${r.kind}) ${r.message.slice(0, 220)}`);
  console.log(`일본 집 2층 청사진 8개 → 경고 ${out.blueprints.length}`);
  for (const r of out.blueprints as any[]) console.log(`  [${r.code}] ${r.blueprint} ${r.message.slice(0, 220)}`);
  console.log(`공용 장소 ${places}곳(계단 ${placeStairs}개) → 경고 ${out.places.length}`);
  for (const r of out.places as any[]) console.log(`  [${r.code}] ${r.file} ${r.map} ${r.message.slice(0, 220)}`);
}
