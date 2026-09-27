// REFMAP 세트 작업 도구. 세트 폴더 = ~/.local/share/oprn/refmap-downloads/_work/<세트>.
//
//   bun scripts/content/refmap/set-tool.mts check  <세트>            preset.json 검사(칸 범위·빈 칸·이름 중복) + 견본 그림 out/refs/
//   bun scripts/content/refmap/set-tool.mts render <세트> [맵id…]     maps/*.json → out/<맵>.png(48px 원본) · out/<맵>_half.png
//   bun scripts/content/refmap/set-tool.mts crop   <세트> <맵id> x y w h   맵 일부를 48px 그대로 잘라 out/<맵>_crop.png
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { tileOpacity } from "../../../src/project/rpgmakerMv/bake.ts";
import { mvSheetPart, mvAutotileShapeKind } from "../../../src/project/rpgmakerMv/layout.ts";
import { blank, convertSpec, loadSet, readMapSpecs, render, shrink, T, toPng } from "./lib.mts";

const [cmd, id, ...rest] = process.argv.slice(2);
if (!cmd || !id) { console.error("사용: set-tool.mts check|render|crop <세트> …"); process.exit(2); }
const set = loadSet(id);
const out = path.join(set.dir, "out");
fs.mkdirSync(path.join(out, "refs"), { recursive: true });

if (cmd === "check") {
  const problems: string[] = [];
  const names = new Set<string>();
  for (const a of set.presetJson.autotiles) {
    if (names.has(a.name)) problems.push(`재료 이름 중복: ${a.name}`); names.add(a.name);
    const part = mvSheetPart(set.fileOf(a.sheet));
    if (!mvAutotileShapeKind(part as never, a.kind)) problems.push(`오토타일 아님: ${a.sheet} ${a.kind}`);
    else if (tileOpacity(set.built.atlas, set.columns, set.tileOf(a.sheet, a.kind, 0)) === 0) problems.push(`빈 오토타일: ${a.name} (${a.sheet} ${a.kind})`);
  }
  for (const f of set.presetJson.flats ?? []) {
    if (names.has(f.name)) problems.push(`재료 이름 중복: ${f.name}`); names.add(f.name);
    if (tileOpacity(set.built.atlas, set.columns, set.tileOf(f.sheet, f.cell)) === 0) problems.push(`빈 평타일: ${f.name}`);
  }
  const ids = new Set<string>();
  for (const o of set.presetJson.objects) {
    if (ids.has(o.id)) problems.push(`물체 id 중복: ${o.id}`); ids.add(o.id);
    const img = set.sheetImages.get(set.fileOf(o.sheet))!;
    if ((o.x + o.w) * T > img.width || (o.y + o.h) * T > img.height) { problems.push(`시트 밖: ${o.id}`); continue; }
    let filled = 0;
    for (let dy = 0; dy < o.h; dy += 1) for (let dx = 0; dx < o.w; dx += 1) if (tileOpacity(set.built.atlas, set.columns, set.flatTile(o.sheet, o.x + dx, o.y + dy)) > 0) filled += 1;
    if (!filled) problems.push(`빈 물체: ${o.id}`);
  }
  // 물체 견본: 한 장에 id 순서대로(칸 테두리 없이) — 모양·잘림을 눈으로 본다.
  const objs = set.presetJson.objects;
  const cols = 8, cell = 5 * T;
  const sheet = blank(cols * cell, Math.max(1, Math.ceil(objs.length / cols)) * cell);
  for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 70; sheet.data[i + 1] = 70; sheet.data[i + 2] = 80; sheet.data[i + 3] = 255; }
  objs.forEach((o, n) => {
    const ox = (n % cols) * cell, oy = Math.floor(n / cols) * cell;
    const k = Math.max(o.w, o.h) > 5 ? Math.ceil(Math.max(o.w, o.h) / 5) : 1;
    const piece = blank(o.w * T, o.h * T);
    for (let dy = 0; dy < o.h; dy += 1) for (let dx = 0; dx < o.w; dx += 1) {
      const t = set.flatTile(o.sheet, o.x + dx, o.y + dy);
      const sx = (t % set.columns) * T, sy = Math.floor(t / set.columns) * T;
      for (let y = 0; y < T; y += 1) for (let x = 0; x < T; x += 1) {
        const s = ((sy + y) * set.built.atlas.width + sx + x) * 4, d = ((dy * T + y) * piece.width + dx * T + x) * 4;
        for (let c = 0; c < 4; c += 1) piece.data[d + c] = set.built.atlas.data[s + c]!;
      }
    }
    for (let y = 0; y < piece.height / k && y < cell; y += 1) for (let x = 0; x < piece.width / k && x < cell; x += 1) {
      const s = ((y * k) * piece.width + x * k) * 4, d = ((oy + y) * sheet.width + ox + x) * 4;
      const a = piece.data[s + 3]! / 255;
      for (let c = 0; c < 3; c += 1) sheet.data[d + c] = Math.round(piece.data[s + c]! * a + sheet.data[d + c]! * (1 - a));
    }
  });
  fs.writeFileSync(path.join(out, "refs", "objects.png"), toPng(sheet));
  fs.writeFileSync(path.join(out, "refs", "objects.txt"), objs.map((o, n) => `${n}\t${o.id}\t${o.name}\t${o.sheet}(${o.x},${o.y}) ${o.w}×${o.h}`).join("\n") + "\n");
  for (const c of set.built.tileset.referenceDocuments ?? []) for (const im of c.images) {
    fs.writeFileSync(path.join(out, "refs", `${im.id}.png`), Buffer.from(im.dataUrl.split(",")[1]!, "base64"));
  }
  console.log(JSON.stringify({ set: id, autotiles: set.presetJson.autotiles.length, flats: set.presetJson.flats?.length ?? 0, objects: objs.length,
    refs: fs.readdirSync(path.join(out, "refs")), problems }, null, 1));
  process.exit(problems.length ? 1 : 0);
}

if (cmd === "render") {
  const want = new Set(rest);
  for (const spec of readMapSpecs(set)) {
    if (want.size && !want.has(spec.id)) continue;
    const m = convertSpec(set, spec);
    const img = render(set, m);
    fs.writeFileSync(path.join(out, `${spec.id}.png`), toPng(img));
    fs.writeFileSync(path.join(out, `${spec.id}_half.png`), toPng(shrink(img, Math.max(img.width, img.height) / 2)));
    console.log(JSON.stringify({ map: spec.id, size: `${spec.w}×${spec.h}`, objects: m.objects.length, warnings: m.warnings }));
  }
  process.exit(0);
}

if (cmd === "crop") {
  const [mapId, xs, ys, ws, hs] = rest;
  const spec = readMapSpecs(set).find((s) => s.id === mapId);
  if (!spec) throw new Error(`맵 없음: ${mapId}`);
  const img = render(set, convertSpec(set, spec));
  const [x, y, w, h] = [xs, ys, ws, hs].map(Number) as [number, number, number, number];
  const crop = blank(w * T, h * T);
  for (let yy = 0; yy < h * T; yy += 1) {
    const from = (((y * T + yy) * img.width) + x * T) * 4;
    crop.data.set(img.data.subarray(from, from + w * T * 4), yy * w * T * 4);
  }
  fs.writeFileSync(path.join(out, `${mapId}_crop.png`), toPng(crop));
  console.log(path.join(out, `${mapId}_crop.png`));
  process.exit(0);
}
void PNG;
