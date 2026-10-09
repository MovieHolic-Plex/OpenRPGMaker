// 장소 팩 「완성 배치도」 재생기 — layout.json 의 단계를 팩만 있는 빈 프로젝트에 실제 조수 도구(paint_tiles·stamp_object)로 재생하고 PNG 로 그린다.
// 배치도는 팩 안내서(「완성 배치도」 절)에 그림과 단계표로 들어가, 받은 사람의 조수가 처음부터 짜지 않고 이것을 따라 하거나 고쳐 쓴다.
//
//   bun scripts/qa/pack-layout-replay.mts <slug> <layout.json> <out.png> [--scale 2] [--project out.json]
//   layout.json = { "size": [64,48], "steps": [ {op,…}, … ] }
//   op:
//     {"op":"fill","ground":"ground-sand"}                      맵 전체 아래층을 그 바닥 표본 키트의 대표 칸으로 채운다
//     {"op":"fill","tile":13}                                   칸 번호 직접
//     {"op":"rect","ground":"ground-court-flag","x":..,"y":..,"w":..,"h":..}   바닥 사각(길·마당)
//     {"op":"blob","brush":"oasis_pond","cx":..,"cy":..,"rx":..,"ry":..,"seed":1}  오토타일 덩이(둥근 불규칙 타원) — 붓은 그룹 이름 끝(`beodeul_wave_<slug>_autotile_<brush>`)
//     {"op":"line","ground":"ground-court-flag","from":[x,y],"to":[x,y],"width":2}   길 한 줄
//     {"op":"stamp","kit":"autotile 말고 키트 이름 끝(`ground-` 제외 물건)","x":..,"y":..}
//   각 단계는 도구가 거절/오류면 즉시 멈춘다(조용한 실패 금지).
import fs from "node:fs";
import { PNG } from "pngjs";
import { applyPackToProject } from "../../src/assetStore/pack.ts";
import { createBlankProject } from "../../src/project/defaults/defaultProject.ts";
import { runTool } from "../../src/editor/tools/index.ts";
import { placePack } from "../../store-server/scripts/placePacks.ts";
import { renderMapPng } from "../qa-game/render.mts";

const [slug, layoutPath, outPng] = process.argv.slice(2);
// --kit-out <폴더>: 재생 결과 맵을 「완성 배치도 키트」로 저장한다(placePacks.ts 가 팩에 합친다). --verify: 새 맵에 그 키트를 한 번 찍어 같은 그림인지 확인한다.
if (!slug || !layoutPath || !outPng) throw new Error("사용법: bun scripts/qa/pack-layout-replay.mts <slug> <layout.json> <out.png> [--scale 2] [--project out.json]");
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8")) as { size: [number, number]; name?: string; title?: string; description?: string; steps: Record<string, unknown>[] };

// --pack-dir <폴더>: build/place-packs/<slug> 대신 다른 팩 폴더(예: 굽기 전 새 부품을 칸에 덮어 쓴 미리보기 사본)로 재생한다.
const pack = arg("pack-dir") ? placePack(slug, arg("pack-dir")) : placePack(slug);
const project = createBlankProject();
const itemSlug = `beodeul-place-${slug}`;
const result = applyPackToProject(project, pack.manifest, {
  slug: itemSlug, version: 1, author: "OPRN", storeUrl: "https://store.openrpgmaker.com", itemUrl: `https://store.openrpgmaker.com/items/${itemSlug}`,
  blob: (sha) => { const b = pack.blobs.get(sha); if (!b) throw new Error(`blob ${sha}`); return b; },
});
const tilesetId = result.tilesetIds[0]!;
for (const id of Object.keys(project.tilesets)) if (id.startsWith("beodeul_")) delete project.tilesets[id];
for (const m of Object.values(project.maps)) { if (project.tilesets[m.tilesetId]) continue; m.tilesetId = tilesetId; m.lowerTiles = m.lowerTiles.map(() => -1); m.upperTiles = m.upperTiles.map(() => -1); delete m.lowerOverlayTiles; delete m.upperOverlayTiles; }
const ts = project.tilesets[tilesetId]!;
const ctx = { project };
const [W, H] = layout.size;
const MAP = "replay";
const call = (name: string, args: Record<string, unknown>) => {
  const r = runTool(ctx, name, args);
  if (!r.ok) throw new Error(`${name} ${JSON.stringify(args).slice(0, 160)} → ${r.summary}`);
  return r;
};
call("create_map", { id: MAP, name: MAP, width: W, height: H, tilesetId });

const kits = ts.structureKits ?? [];
const kitByTail = (tail: string) => {
  const k = kits.find((kk) => kk.id.endsWith(`-${tail}`) || kk.id === tail);
  if (!k) throw new Error(`키트 없음: ${tail} (예: ${kits.slice(0, 5).map((x) => x.id).join(", ")})`);
  return k;
};
const groundTile = (tail: string) => { const k = kitByTail(tail); const row = k.rows[Math.floor(k.height / 2)]; const t = row.tiles[Math.floor(k.width / 2)]; if (t < 0) throw new Error(`${tail}: 가운데 칸이 비었다`); return t; };
const groupBy = (brush: string) => { const g = (ts.autotileGroups ?? []).find((gg) => gg.id.endsWith(`_autotile_${brush}`)); if (!g) throw new Error(`오토타일 그룹 없음: ${brush}`); return g; };
const rnd = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
// 울퉁불퉁한 덩이(blob 의 "rough": 0~1 세기). 옛 덩이는 sin 3·5배음 둘의 위상이 seed 로만 움직여 작은 타원(반지름 4~5칸)에서
// 칸으로 깎으면 곧은 변 + 직각 모서리 상자가 됐다(적대 검수 desert-castle 1번). 여기서는
//   ① 반지름을 2~7배음(무작위 위상·1/k 감쇠) + 낮은 주파수 혹 하나로 흔들고 ② 칸마다 작은 흔들림을 더한 뒤
//   ③ 외톨이 칸·1칸 폭 띠·1칸 홈을 지워(오토타일 16변형이 깨끗이 성형되도록) ④ 같은 행/열 곧은 변이 4칸 넘게 이어지면 한 칸 깎거나 붙인다.
// rough 를 주지 않은 단계는 옛 그림 그대로다(다른 장소 배치도 불변).
function organicBlob(cx: number, cy: number, rx: number, ry: number, seed: number, rough: number) {
  const r = rnd(seed * 7919 + 17);
  const harm = Array.from({ length: 6 }, (_, i) => ({ k: i + 2, amp: rough * 0.34 / Math.pow(i + 2, 0.75) * (0.6 + 0.8 * r()), ph: r() * Math.PI * 2 }));
  const lump = { ph: r() * Math.PI * 2, amp: rough * 0.22 };
  const radius = (a: number) => 1 + lump.amp * Math.cos(a - lump.ph) + harm.reduce((s, h) => s + h.amp * Math.sin(h.k * a + h.ph), 0);
  const x0 = Math.max(0, Math.floor(cx - rx * 1.6 - 1)), x1 = Math.min(W - 1, Math.ceil(cx + rx * 1.6 + 1));
  const y0 = Math.max(0, Math.floor(cy - ry * 1.6 - 1)), y1 = Math.min(H - 1, Math.ceil(cy + ry * 1.6 + 1));
  const on = new Set<string>(); const key = (x: number, y: number) => `${x},${y}`;
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const u = (x - cx) / rx, v = (y - cy) / ry;
    const jit = (r() - 0.5) * 0.16 * rough;
    if (Math.hypot(u, v) <= radius(Math.atan2(v, u)) + jit) on.add(key(x, y));
  }
  const has = (x: number, y: number) => on.has(key(x, y));
  const tidy = () => {
    for (let it = 0, changed = true; changed && it < 12; it += 1) {
      changed = false;
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
        const n = +has(x, y - 1) + +has(x + 1, y) + +has(x, y + 1) + +has(x - 1, y);
        const thin = (!has(x - 1, y) && !has(x + 1, y)) || (!has(x, y - 1) && !has(x, y + 1));
        if (has(x, y) && (n <= 1 || thin)) { on.delete(key(x, y)); changed = true; }
        else if (!has(x, y) && n >= 3) { on.add(key(x, y)); changed = true; }
      }
    }
  };
  tidy();
  // 곧은 변 끊기: 위/아래 변(그 칸 위가 비었다)이 같은 행에서 5칸 이상 이어지면 가운데 쯤 한 칸을 바깥으로 붙이거나(혹) 안으로 깎는다(만).
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const horiz = dy !== 0;
      const outer = horiz ? [y0, y1] : [x0, x1], inner = horiz ? [x0, x1] : [y0, y1];
      for (let a = outer[0]; a <= outer[1]; a += 1) {
        let run: number[] = [];
        const flush = () => {
          if (run.length >= 5) {
            const b = run[1 + Math.floor(r() * (run.length - 3))]!;
            const [x, y] = horiz ? [b, a] : [a, b];
            // 혹만 낸다(안으로 깎은 만은 1칸 폭 정리 규칙이 이웃을 연쇄로 지워 다시 곧아진다 — 실측)
            const len = seg.length >= 5 && r() < 0.5 ? 3 : 2;
            for (let k = 0; k < len; k += 1) on.add(key(x + dx + (horiz ? k : 0), y + dy + (horiz ? 0 : k)));
          }
          run = [];
        };
        for (let b = inner[0]; b <= inner[1]; b += 1) {
          const [x, y] = horiz ? [b, a] : [a, b];
          if (has(x, y) && !has(x + dx, y + dy)) run.push(b); else flush();
        }
        flush();
      }
    }
    tidy();
  }
  return [...on].map((s) => { const [x, y] = s.split(",").map(Number); return { x: x!, y: y! }; }).filter((c) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H);
}

for (const [i, st] of layout.steps.entries()) {
  const op = st.op as string;
  try {
    if (op === "fill" || op === "rect") {
      const tile = (st.tile as number | undefined) ?? groundTile(st.ground as string);
      const x = (st.x as number) ?? 0, y = (st.y as number) ?? 0, w = (st.w as number) ?? W - x, h = (st.h as number) ?? H - y;
      call("paint_tiles", { mapId: MAP, layer: "1", mode: "rect", tile, from: { x, y }, to: { x: x + w - 1, y: y + h - 1 } });
    } else if (op === "line") {
      const tile = (st.tile as number | undefined) ?? groundTile(st.ground as string);
      const [x0, y0] = st.from as number[]; const [x1, y1] = st.to as number[]; const wd = (st.width as number) ?? 1;
      const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
      for (let k = 0; k < wd; k += 1) call("paint_tiles", { mapId: MAP, layer: "1", mode: "line", tile, from: { x: x0 + (horiz ? 0 : k), y: y0 + (horiz ? k : 0) }, to: { x: x1 + (horiz ? 0 : k), y: y1 + (horiz ? k : 0) } });
    } else if (op === "blob") {
      const g = groupBy(st.brush as string);
      const brushTile = g.variantMap["15"]!;
      const layer = g.layer === "upper" ? "3" : "2";
      const cx = st.cx as number, cy = st.cy as number, rx = st.rx as number, ry = st.ry as number;
      const r = rnd((st.seed as number) ?? 1);
      const rough = st.rough as number | undefined;
      const cells = rough ? organicBlob(cx, cy, rx, ry, (st.seed as number) ?? 1, rough) : [] as { x: number; y: number }[];
      if (!rough) for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
        const wob = 1 + 0.22 * Math.sin(a * 3 + (st.seed as number ?? 1)) + 0.12 * Math.sin(a * 5 + 1.7 * ((st.seed as number) ?? 1)) + (r() - 0.5) * 0.12;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= wob * wob) cells.push({ x, y });
      }
      call("paint_tiles", { mapId: MAP, layer, mode: "cells", tile: brushTile, cells });
    } else if (op === "stamp") {
      const k = kitByTail(st.kit as string);
      call("stamp_object", { mapId: MAP, objectId: `kit:${tilesetId}/${k.id}`, x: st.x, y: st.y });
    } else throw new Error(`알 수 없는 op ${op}`);
  } catch (e) {
    throw new Error(`단계 ${i + 1} (${JSON.stringify(st)}): ${(e as Error).message}`);
  }
}

const map = ctx.project.maps[MAP]!;
const { png } = renderMapPng(ctx.project, map, Number(arg("scale") ?? 2));
fs.writeFileSync(outPng, png);
const kitOut = arg("kit-out");
if (kitOut) {
  const name = layout.name ?? "main";
  // 구조 키트에는 2층(덧그림)이 없다. 불투명한 덧그림 칸(풀 섬 속 같은 가득 칸)은 1층에 넣고(그 칸 1층은 어차피 가려진다), 투명 가장자리 칸만 3층 빈 칸에 합친다(소품이 있는 칸은 소품이 이긴다).
  const ov = (map as unknown as { lowerOverlayTiles?: number[] }).lowerOverlayTiles;
  const sheetAsset = Object.values(pack.manifest.content.assets).find((a) => a.kind === "chipset")!;
  const sheetPng = PNG.sync.read(Buffer.from(pack.blobs.get(sheetAsset.blob)!));
  const perRow = ts.tilesPerRow ?? 32;
  const opaque = (t: number) => { const cx = (t % perRow) * 16, cy = Math.floor(t / perRow) * 16; for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (sheetPng.data[((cy + y) * sheetPng.width + cx + x) * 4 + 3] !== 255) return false; return true; };
  const lowerAt = (i: number) => { const o = ov?.[i] ?? -1; return o >= 0 && opaque(o) ? o : map.lowerTiles[i] ?? -1; };
  const upperAt = (i: number) => { const u = map.upperTiles[i] ?? -1; if (u >= 0) return u; const o = ov?.[i] ?? -1; return o >= 0 && !opaque(o) ? o : -1; };
  const rows = Array.from({ length: H }, (_, y) => ({ tiles: Array.from({ length: W }, (_, x) => lowerAt(y * W + x)), upperTiles: Array.from({ length: W }, (_, x) => upperAt(y * W + x)) }));
  const kit = {
    id: `bd-layout-${slug}-${name}`, kind: "section", name: `완성 배치도 · ${layout.title ?? name} ${W}×${H}`, width: W, height: H, tileSize: 16, rows, learnedFrom: "db-authored",
    ai: {
      description: `${layout.description ?? layout.title ?? name} — 이 팩의 칸으로 이미 짠 ${W}×${H} 완성 배치. 바닥·물·길·건물·소품이 모두 들어 있다.`,
      placementRules: `먼저 이 키트를 맵 (0,0)에 한 번 찍는다(맵 크기 ${W}×${H} 이상). 그 뒤 바꾸고 싶은 곳만 고친다 — 건물 키트를 지우고 다른 것을 찍거나, 소품을 옮긴다. 처음부터 낱 키트로 짜지 않는다.`,
      tags: ["버들항", "버들항 장소", "완성 배치도", "완성 구도"], role: "terrain", repeatability: "fixed", layerHome: "perCell", themes: ["layout", "완성 배치도"],
    },
  };
  fs.mkdirSync(kitOut, { recursive: true });
  fs.writeFileSync(`${kitOut}/${name}.kit.json`, JSON.stringify(kit));
  fs.writeFileSync(`${kitOut}/${name}.png`, png);
  fs.writeFileSync(`${kitOut}/${name}.steps.json`, JSON.stringify({ title: layout.title ?? name, description: layout.description ?? "", size: layout.size, steps: layout.steps }));
  if (process.argv.includes("--verify")) {
    // 팩에 이미 합쳐진 같은 id 의 옛 배치도 키트가 있으면 그것이 먼저 찍혀 옛 그림과 비교하게 된다(build_pack_layouts.sh 를 두 번 돌릴 때) — 빼고 넣는다.
    ts.structureKits = [...(ts.structureKits ?? []).filter((k) => k.id !== kit.id), kit as never];
    call("create_map", { id: "verify", name: "verify", width: W, height: H, tilesetId });
    call("stamp_object", { mapId: "verify", objectId: `kit:${tilesetId}/${kit.id}`, x: 0, y: 0 });
    const v = ctx.project.maps["verify"]!;
    const pa = renderMapPng(ctx.project, v, 1).png, pb = renderMapPng(ctx.project, map, 1).png;
    // 걷는 덧그림(2층)은 키트에서 3층 빈 칸으로 옮겨 가므로, 소품 밑에 깔렸던 덧그림 칸만 다를 수 있다 — 그 칸 수를 센다.
    const A = PNG.sync.read(pa), B = PNG.sync.read(pb);
    let diffTiles = 0; const diffCells: string[] = [];
    for (let ty = 0; ty < H; ty += 1) for (let tx = 0; tx < W; tx += 1) {
      let d = false;
      for (let y = 0; y < 16 && !d; y += 1) for (let x = 0; x < 16; x += 1) { const o = ((ty * 16 + y) * A.width + tx * 16 + x) * 4; if (A.data[o] !== B.data[o] || A.data[o + 1] !== B.data[o + 1] || A.data[o + 2] !== B.data[o + 2] || A.data[o + 3] !== B.data[o + 3]) { d = true; break; } }
      if (d) { diffTiles += 1; if (diffCells.length < 40) diffCells.push(`${tx},${ty}`); }
    }
    const same = diffTiles <= Math.ceil(W * H * 0.01);
    console.log(`verify: 한 번 찍기와 단계 재생의 다른 칸 ${diffTiles}/${W * H} ${same ? "(허용)" : "(너무 많음!)"}${diffTiles ? ` — ${diffCells.join(" ")}` : ""}`);
    if (!same) process.exit(2);
  }
}
const proj = arg("project");
if (proj) fs.writeFileSync(proj, JSON.stringify(ctx.project));
console.log(`ok ${slug} ${layout.steps.length}단계 → ${outPng} (${map.width}×${map.height})`);
