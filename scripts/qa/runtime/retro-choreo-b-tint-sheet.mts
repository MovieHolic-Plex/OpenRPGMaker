// 색 프리셋 비교 시트 — 실제 이펙트 시트 여러 장에 프리셋 filter 를 걸어 한 장으로 본다.
// 사용: npx tsx scripts/qa/runtime/retro-choreo-b-tint-sheet.mts [out.png]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { RETRO_TINT_PRESETS, retroTintFilter } from "../../../src/assets/retroChoreographyTints";

const OUT = path.resolve(process.argv[2] ?? "verify-shots/retro-choreo-b/tint-sheet.png");
const ROOT = path.resolve("public/assets/generated/pixel-fx");
const ROWS: Array<[string, number]> = [
  ["airship_flame", 4], ["yeti_frost_roar", 4], ["cleric_blessing", 4], ["ranger_fire_hit", 3],
  ["miner_rockfall", 4], ["vampire_fang", 3], ["lion_swipe", 3], ["dark_knight_doom_hit", 4],
];
const cols = [{ id: "original", label: "원본", filter: "none" }, ...RETRO_TINT_PRESETS.map((p) => ({ id: p.id, label: p.label, filter: retroTintFilter(p.id) ?? "none" }))];
const cell = (key: string, frame: number, filter: string) =>
  `<span class="c"><i style="background-image:url(file://${ROOT}/${key}.png);background-position:-${frame * 64 * 1.5}px 0;filter:${filter}"></i></span>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#26303e;color:#dde;font:12px sans-serif}
.g{display:grid;grid-template-columns:130px repeat(${cols.length},96px);gap:2px;padding:6px}
.c{display:block;width:96px;height:96px;background:#3a4658}.c i{display:block;width:96px;height:96px;background-size:auto 96px;background-repeat:no-repeat;image-rendering:pixelated}
.h{text-align:center;padding:4px 0}.k{align-self:center;font-size:11px}
</style><div class="g"><span></span>${cols.map((c) => `<span class="h">${c.label}</span>`).join("")}
${ROWS.map(([key, frame]) => `<span class="k">${key}</span>${cols.map((c) => cell(key, frame, c.filter)).join("")}`).join("")}</div>`;
const tmp = path.resolve("/tmp/retro-tint-sheet.html");
fs.writeFileSync(tmp, html);
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`file://${tmp}`);
await page.waitForTimeout(500);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
console.log("wrote", OUT);
