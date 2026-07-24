/**
 * 던전 칩셋 소품 타일 카탈로그 생성기 (분석 전용 — 원격 저장 없음).
 * easyrpg_chipset_dungeon 의 전체 480타일을 렌더하고, 현재(원격) tileMeta와
 * 투명도(알파) 통계를 붙여 검토용 HTML을 만든다.
 * - 투명 픽셀이 있는데 terrain/passable 이면 '상위 후보' 의심 표시
 * - 102~104/132~134 (밴드 좌/중/우), 144/146, 265 등 사용자 지적 타일 별도 섹션
 * 실행: npx tsx scripts/gen-dungeon-prop-catalog.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const OUT = path.resolve("output/evidence/dungeon-prop-catalog");
fs.mkdirSync(OUT, { recursive: true });
const T = 16;
const COLS = 30;
const TILES = 480;

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const remote = await loadProjectFromSupabase({
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-showcase",
});
if (!remote) throw new Error("원격 로드 실패");
const ts = remote.tilesets["easyrpg_chipset_dungeon"];
if (!ts) throw new Error("tileset 없음");
const meta = ts.tileMeta as Record<number, { label?: string; role?: string; passage?: string; description?: string; confidence?: string }>;
const pass = ts.passability as Record<number, { up: boolean; down: boolean; left: boolean; right: boolean }>;

// 칩셋에서 타일별 크롭 + 알파 통계
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const Z = 4;
function tilePng(t: number): { png: PNG; alpha: number; opaque: number } {
  const sx = (t % COLS) * T, sy = Math.floor(t / COLS) * T;
  const out = new PNG({ width: T * Z, height: T * Z });
  let transparent = 0;
  for (let y = 0; y < T * Z; y += 1) for (let x = 0; x < T * Z; x += 1) {
    const si = ((sy + Math.floor(y / Z)) * chip.width + (sx + Math.floor(x / Z))) * 4;
    const di = (y * out.width + x) * 4;
    if (chip.data[si + 3] === 0) {
      transparent += 1;
      // 체커보드
      const c = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 58 : 42;
      out.data[di] = c; out.data[di + 1] = c; out.data[di + 2] = c + 8; out.data[di + 3] = 255;
    } else {
      for (let k = 0; k < 4; k += 1) out.data[di + k] = chip.data[si + k]!;
    }
  }
  return { png: out, alpha: transparent / (T * T * Z * Z), opaque: 0 };
}
const tiles: { t: number; b64: string; alpha: number }[] = [];
for (let t = 0; t < TILES; t += 1) {
  const { png, alpha } = tilePng(t);
  tiles.push({ t, b64: PNG.sync.write(png).toString("base64"), alpha });
}
// 지적 타일 확대 스트립 (8배)
function strip(ts: number[], file: string): void {
  const out = new PNG({ width: ts.length * (T * 8 + 8) + 8, height: T * 8 + 26 });
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 24; out.data[i + 1] = 22; out.data[i + 2] = 28; out.data[i + 3] = 255; }
  ts.forEach((t, n) => {
    const sx = (t % COLS) * T, sy = Math.floor(t / COLS) * T;
    for (let y = 0; y < T * 8; y += 1) for (let x = 0; x < T * 8; x += 1) {
      const si = ((sy + Math.floor(y / 8)) * chip.width + (sx + Math.floor(x / 8))) * 4;
      const di = ((y + 4) * out.width + (8 + n * (T * 8 + 8) + x)) * 4;
      if (chip.data[si + 3] === 0) { const c = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 58 : 42; out.data[di] = c; out.data[di + 1] = c; out.data[di + 2] = c + 8; out.data[di + 3] = 255; }
      else for (let k = 0; k < 4; k += 1) out.data[di + k] = chip.data[si + k]!;
    }
  });
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(out));
}
strip([102, 103, 104, 132, 133, 134], "strip-band.png");
strip([144, 145, 146, 147, 174, 175, 176, 177], "strip-statues.png");
strip([259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269], "strip-props8.png");
strip([288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299], "strip-props9.png");
const stripB64 = (f: string) => fs.readFileSync(path.join(OUT, f)).toString("base64");

// 카드 HTML
const roleColor: Record<string, string> = { terrain: "#7fb8ff", wall: "#ffb27a", water: "#6fe3c1", prop: "#d7a0ff", decor: "#d7a0ff" };
function passLabel(t: number): string {
  const p = pass[t];
  if (!p) return "?";
  const all = p.up && p.down && p.left && p.right;
  const none = !p.up && !p.down && !p.left && !p.right;
  return all ? "통행가능" : none ? "불가" : "부분";
}
function card({ t, b64, alpha }: { t: number; b64: string; alpha: number }): string {
  const m = meta[t] ?? {};
  const suspect = alpha > 0.05 && (m.role === "terrain" || passLabel(t) === "통행가능");
  const aPct = Math.round(alpha * 100);
  return `<div class="tile${suspect ? " suspect" : ""}">
  <img src="data:image/png;base64,${b64}" alt="${t}">
  <div class="id">#${t}${aPct > 0 ? ` <span class="alpha">투명 ${aPct}%</span>` : ""}</div>
  <div class="label">${m.label ?? "<i>메타 없음</i>"}</div>
  <div class="badges"><span class="role" style="background:${roleColor[m.role ?? ""] ?? "#555"}">${m.role ?? "?"}</span><span class="pass">${passLabel(t)}</span>${suspect ? '<span class="flag">상위후보?</span>' : ""}</div>
  ${m.description ? `<div class="desc">${m.description}</div>` : ""}
</div>`;
}
let sections = "";
for (let row = 0; row < TILES / COLS; row += 1) {
  const start = row * COLS;
  sections += `<h3>행 ${row} — 타일 ${start}~${start + COLS - 1}</h3><div class="grid">${tiles.slice(start, start + COLS).map(card).join("")}</div>`;
}

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>던전 칩셋 소품 타일 카탈로그 (검토용)</title>
<style>
 body{background:#141216;color:#e8e2da;font:14px/1.55 -apple-system,'Segoe UI','Malgun Gothic',sans-serif;max-width:1500px;margin:0 auto;padding:28px 18px 80px}
 h1{font-size:24px;border-bottom:2px solid #b8492b;padding-bottom:10px}
 h2{font-size:19px;margin-top:40px;color:#ffb27a;border-left:4px solid #b8492b;padding-left:10px}
 h3{font-size:14.5px;color:#c9bfa8;margin:22px 0 8px}
 .card{background:#1e1b22;border:1px solid #333;border-radius:10px;padding:14px 18px;margin:12px 0}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
 .tile{background:#1e1b22;border:1px solid #333;border-radius:8px;padding:6px;font-size:11px}
 .tile.suspect{border-color:#ff7a7a;box-shadow:0 0 0 1px #ff7a7a44}
 .tile img{image-rendering:pixelated;width:100%;border-radius:4px;background:#2a2530}
 .id{color:#ffd27a;font-weight:700;margin-top:4px}
 .alpha{color:#8fd3ff;font-weight:400;font-size:10px}
 .label{color:#e8e2da;margin:2px 0}
 .badges{display:flex;gap:4px;flex-wrap:wrap;margin:2px 0}
 .role{border-radius:8px;padding:0 6px;color:#141216;font-weight:700;font-size:10px}
 .pass{color:#a99;font-size:10px}
 .flag{color:#ff7a7a;font-weight:700;font-size:10px}
 .desc{color:#a99;font-size:10px;margin-top:2px;word-break:keep-all}
 code{background:#2a2530;padding:1px 6px;border-radius:4px;font-size:12px}
 .cap{font-size:12.5px;color:#a99}
 .big{image-rendering:pixelated;width:100%;border:1px solid #333;border-radius:6px;background:#1c1a22}
 table{border-collapse:collapse;font-size:13px}
 th,td{border:1px solid #3a3540;padding:5px 9px;text-align:left;vertical-align:top}
 th{background:#2a2530}
</style></head><body>
<h1>던전 칩셋(<code>easyrpg_chipset_dungeon</code>) 타일 카탈로그 — 검토용</h1>
<p class="cap">작성: ${new Date().toISOString()} · 데이터: Supabase <code>rpg-zzu-showcase</code> 원격 tileset 메타 그대로 · 체커보드 = 투명 픽셀 · 붉은 테두리 = <b>투명 픽셀이 있는데 terrain/통행가능으로 등록된 '상위 레이어 후보' 의심</b></p>

<h2>0. 지적하신 타일들 — 확대 검토</h2>
<div class="card">
<h3>벽 밴드 102~104 / 132~134 (좌·중·우)</h3>
<img class="big" src="data:image/png;base64,${stripB64("strip-band.png")}">
<p class="cap">레포 정본 코드(<code>dungeonThemedLayouts.ts</code> backWall)도 왼쪽 끝=102/132, 중앙=103/133, 오른쪽 끝=104/134로 배치한다 — 지적이 맞다. 현재 수리된 용암동굴이 103/133으로 통일된 것은 내 파이프라인이 변형 구분을 안 해서다. 현재 메타 라벨: ${[102, 103, 104, 132, 133, 134].map((t) => `#${t} "${meta[t]?.label ?? ""}"`).join(" · ")}</p>
</div>
<div class="card">
<h3>144·145·146·147 / 174~177 (석상·비석·레일)</h3>
<img class="big" src="data:image/png;base64,${stripB64("strip-statues.png")}">
<p class="cap">투명 배경의 오브젝트 타일 — '상위 레이어' 후보. 현재 메타: ${[144, 145, 146, 147].map((t) => `#${t} "${meta[t]?.label ?? ""}"(${meta[t]?.role ?? "?"}/${passLabel(t)})`).join(" · ")}</p>
</div>
<div class="card">
<h3>259~269 (소품 군) — 265 '석판' 포함</h3>
<img class="big" src="data:image/png;base64,${stripB64("strip-props8.png")}">
<p class="cap">#265 현재 라벨 "${meta[265]?.label ?? ""}" — 지적대로라면 벽에 매다는 석판(wall decor, 상위 레이어, 통행 불가 아님)으로 정의해야 한다. 전체: ${[259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269].map((t) => `#${t} "${meta[t]?.label ?? "?"}"`).join(" · ")}</p>
</div>
<div class="card">
<h3>288~299 (소품 군 2)</h3>
<img class="big" src="data:image/png;base64,${stripB64("strip-props9.png")}">
<p class="cap">${[288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299].map((t) => `#${t} "${meta[t]?.label ?? "?"}"`).join(" · ")}</p>
</div>

<h2>1. 전체 타일 카탈로그 (480)</h2>
${sections}
<p class="cap">수정 방법 안내: 이 카탈로그는 읽기 전용이다. 메타 수정이 확정되면 <code>src/project/defaults/tileSemanticsDungeon.ts</code>(레포 정본) 갱신 → 원격 tileset 재동기화 → 맵 재배치 순서가 안전하다.</p>
</body></html>`;
fs.writeFileSync(path.join(OUT, "catalog.html"), html);
console.log("catalog:", path.join(OUT, "catalog.html"));
