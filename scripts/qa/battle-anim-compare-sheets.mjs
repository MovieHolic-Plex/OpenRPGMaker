// 전투 이펙트 개편 증거 시트 — before/after 프레임 캡처를 위아래로 붙이고, 34종 시트 카탈로그를
// 게임 배경색 위에 실제 무대 크기(192 논리 px/프레임)로 합성한다. 사람이 볼 PNG 만 만든다.
//
//   node scripts/qa/battle-anim-compare-sheets.mjs [--root=verify-shots/battle-anim-overhaul]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const arg = (name, fallback) => {
  const hit = process.argv.find((v) => v.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ROOT = join(REPO_ROOT, arg("root", "verify-shots/battle-anim-overhaul"));
const BACKDROP = [22, 48, 122];
const GAP = 6;

const read = (path) => PNG.sync.read(readFileSync(path));

function blank(width, height, fill = [0, 0, 0, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i += 1) png.data.set(fill, i * 4);
  return png;
}

function paste(dst, src, x0, y0) {
  for (let y = 0; y < src.height; y += 1) {
    if (y0 + y >= dst.height) break;
    const w = Math.min(src.width, dst.width - x0);
    src.data.copy(dst.data, ((y0 + y) * dst.width + x0) * 4, y * src.width * 4, y * src.width * 4 + w * 4);
  }
}

function stackVertical(images) {
  const width = Math.max(...images.map((i) => i.width));
  const height = images.reduce((s, i) => s + i.height, 0) + GAP * (images.length - 1);
  const out = blank(width, height);
  let y = 0;
  for (const img of images) {
    paste(out, img, 0, y);
    y += img.height + GAP;
  }
  return out;
}

/** 스트립을 절반으로 줄여(2×2 평균) 배경색 위에 합성한다 = 무대 배율 1 에서 보이는 크기. */
function halfOverBackdrop(strip) {
  const w = strip.width >> 1;
  const h = strip.height >> 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((y * 2 + dy) * strip.width + x * 2 + dx) * 4;
        const al = strip.data[i + 3] / 255;
        r += strip.data[i] * al;
        g += strip.data[i + 1] * al;
        b += strip.data[i + 2] * al;
        a += al;
      }
      a /= 4;
      const o = (y * w + x) * 4;
      out.data[o] = Math.round(r / 4 + BACKDROP[0] * (1 - a));
      out.data[o + 1] = Math.round(g / 4 + BACKDROP[1] * (1 - a));
      out.data[o + 2] = Math.round(b / 4 + BACKDROP[2] * (1 - a));
      out.data[o + 3] = 255;
    }
  }
  return out;
}

// 0) 임의 프레임 세로 스택 — 연출 라운드 증거(--stack=<out.png>:<file1>,<file2>,...). 각 장은 절반 크기.
const stackArg = process.argv.find((v) => v.startsWith("--stack="));
if (stackArg) {
  const [out, list] = stackArg.slice("--stack=".length).split(":");
  const files = list.split(",").map((f) => f.trim()).filter(Boolean);
  const halves = files.map((file) => {
    const img = read(join(REPO_ROOT, file));
    const w = img.width >> 1;
    const h = img.height >> 1;
    const half = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const o = (y * w + x) * 4;
        for (let c = 0; c < 4; c += 1) {
          let sum = 0;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sum += img.data[((y * 2 + dy) * img.width + x * 2 + dx) * 4 + c];
          half.data[o + c] = Math.round(sum / 4);
        }
      }
    }
    return half;
  });
  mkdirSync(dirname(join(REPO_ROOT, out)), { recursive: true });
  writeFileSync(join(REPO_ROOT, out), PNG.sync.write(stackVertical(halves)));
  console.log(`stacked ${files.length} → ${out}`);
  process.exit(0);
}

// 1) before/after 프레임 비교
const beforeDir = join(ROOT, "before");
const afterDir = join(ROOT, "after");
const compareDir = join(ROOT, "compare");
mkdirSync(compareDir, { recursive: true });
let compared = 0;
if (existsSync(beforeDir) && existsSync(afterDir)) {
  for (const anim of readdirSync(afterDir)) {
    const before = join(beforeDir, anim, "frames.png");
    const after = join(afterDir, anim, "frames.png");
    if (!existsSync(before) || !existsSync(after)) continue;
    writeFileSync(join(compareDir, `${anim}-frames.png`), PNG.sync.write(stackVertical([read(before), read(after)])));
    const sceneBefore = readdirSync(join(beforeDir, anim)).filter((f) => f.startsWith("scene-")).sort()[0];
    const sceneAfter = readdirSync(join(afterDir, anim)).filter((f) => f.startsWith("scene-")).sort()[0];
    if (sceneBefore && sceneAfter) {
      const a = read(join(beforeDir, anim, sceneBefore));
      const b = read(join(afterDir, anim, sceneAfter));
      const out = blank(a.width + GAP + b.width, Math.max(a.height, b.height));
      paste(out, a, 0, 0);
      paste(out, b, a.width + GAP, 0);
      writeFileSync(join(compareDir, `${anim}-scene.png`), PNG.sync.write(out));
    }
    compared += 1;
  }
}
console.log(`compare sheets: ${compared}`);

// 1b) 영웅 배틀러 before/after — sideview 스킨에서 찍은 party-zoom.png(3배)을 위아래로.
for (const [beforeLabel, afterLabel, out] of [["hero-before", "hero-after", "hero-party-zoom.png"]]) {
  const findZoom = (label) => {
    const dir = join(ROOT, label);
    if (!existsSync(dir)) return null;
    for (const anim of readdirSync(dir)) {
      const file = join(dir, anim, "party-zoom.png");
      if (existsSync(file)) return file;
    }
    return null;
  };
  const before = findZoom(beforeLabel);
  const after = findZoom(afterLabel);
  if (before && after) {
    writeFileSync(join(compareDir, out), PNG.sync.write(stackVertical([read(before), read(after)])));
    console.log(`hero compare: ${out}`);
  }
}

// 2) 34종 카탈로그 시트(12종씩 3장)
const catalog = JSON.parse(readFileSync(join(REPO_ROOT, "src/assets/generatedEffectSheets.json"), "utf8"));
const rows = catalog.effects.map((effect) => halfOverBackdrop(read(join(REPO_ROOT, "public/assets/generated/effects", `effect-${effect.slug}.png`))));
const catalogDir = join(ROOT, "catalog");
mkdirSync(catalogDir, { recursive: true });
const PER_SHEET = 12;
for (let start = 0, index = 1; start < rows.length; start += PER_SHEET, index += 1) {
  const slice = rows.slice(start, start + PER_SHEET);
  writeFileSync(join(catalogDir, `catalog-${index}.png`), PNG.sync.write(stackVertical(slice)));
  console.log(`catalog-${index}.png: ${catalog.effects.slice(start, start + PER_SHEET).map((e) => e.slug).join(", ")}`);
}
