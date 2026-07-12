/**
 * Visual review HTML for villager-room-v1 five variants (chipset sprites).
 */
import fs from "node:fs";
import path from "node:path";
import {
  createVillagerRoomMap,
  VILLAGER_ROOM_KIT_ID,
  VILLAGER_ROOM_VARIANTS,
  VR,
} from "../src/editor/villagerRoomKit.ts";

const TILE = 16;
const COLS = 30;

function chipPos(tile: number) {
  return { col: tile % COLS, row: Math.floor(tile / COLS) };
}

function spr(tile: number, scale: number): string {
  if (tile < 0) {
    return `<span class="spr empty" style="width:${TILE * scale}px;height:${TILE * scale}px"></span>`;
  }
  const { col, row } = chipPos(tile);
  const size = TILE * scale;
  return `<span class="spr" style="width:${size}px;height:${size}px;background-position:${-col * size}px ${-row * size}px;background-size:${COLS * size}px auto"></span>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const outDir = path.resolve("output/docs");
fs.mkdirSync(outDir, { recursive: true });
const chipLocal = path.join(outDir, "Interior-chipset.png");
if (!fs.existsSync(chipLocal)) {
  fs.copyFileSync(
    path.resolve("public/assets/easyrpg-chipset-interior-transparent.png"),
    chipLocal,
  );
}

const sections = VILLAGER_ROOM_VARIANTS.map((v) => {
  const map = createVillagerRoomMap(v.id);
  const cells: string[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const L = map.lowerTiles[i]!;
      const U = map.upperTiles[i]!;
      cells.push(`<div class="c" title="(${x},${y}) L${L}${U >= 0 ? " U" + U : ""}">
        <div class="s">${spr(L, 3)}${U >= 0 ? `<div class="u">${spr(U, 3)}</div>` : ""}</div>
        <div class="t">${L}${U >= 0 ? "/" + U : ""}</div>
      </div>`);
    }
  }
  return `<section>
    <h2>${esc(v.name)}</h2>
    <p class="blurb"><code>${esc(v.mapId)}</code> · ${map.width}×${map.height} · ${esc(v.blurb)}</p>
    <div class="grid" style="grid-template-columns:repeat(${map.width},48px)">${cells.join("")}</div>
  </section>`;
}).join("\n");

const legend = Object.entries(VR)
  .map(
    ([k, id]) =>
      `<div class="leg">${spr(id as number, 3)}<span>${esc(k)} <code>${id}</code></span></div>`,
  )
  .join("");

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${VILLAGER_ROOM_KIT_ID} 실내 5종 리뷰</title>
<style>
  :root { --chip: url("Interior-chipset.png"); }
  body { margin: 0; padding: 16px 18px 48px; font: 14px/1.4 "Malgun Gothic", sans-serif; background: #111; color: #eee; }
  h1 { font-size: 1.2rem; color: #8cf; }
  h2 { font-size: 1.05rem; margin: 24px 0 6px; color: #fc8; }
  .blurb { color: #aaa; margin: 0 0 10px; font-size: 13px; }
  .spr { display: block; image-rendering: pixelated; background-image: var(--chip); background-repeat: no-repeat; border: 1px solid #000; }
  .spr.empty { background: #222; }
  .grid { display: grid; gap: 1px; width: max-content; background: #000; padding: 4px; border-radius: 8px; }
  .c { background: #1a1a1a; padding: 1px; }
  .s { position: relative; width: 48px; height: 48px; margin: 0 auto; }
  .s .spr { width: 48px !important; height: 48px !important; }
  .u { position: absolute; inset: 0; }
  .t { font: 9px Consolas, monospace; color: #888; text-align: center; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 20px; }
  .leg { display: flex; align-items: center; gap: 6px; background: #1a1a1a; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
  code { color: #8cf; }
  .note { background: #1a2030; border-left: 3px solid #8cf; padding: 10px 12px; margin-bottom: 16px; max-width: 48rem; color: #ccd; }
</style>
</head>
<body>
  <h1>${VILLAGER_ROOM_KIT_ID} — 주민 집 실내 키트 5종</h1>
  <div class="note">
    확인용 스탬프입니다. 에디터 갤러리 프로젝트 맵 트리에도 동일 id로 저장했습니다.
    이상하면 맵 id·좌표·타일 번호를 알려 주세요.
  </div>
  <h2>타일 키 (VR)</h2>
  <div class="legend">${legend}</div>
  ${sections}
</body>
</html>
`;

const outPath = path.join(outDir, "villager-room-v1-review.html");
fs.writeFileSync(outPath, html, "utf8");
console.log("wrote", outPath);
