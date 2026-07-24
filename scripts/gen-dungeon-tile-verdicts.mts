/**
 * 던전 칩셋 타일 메타 판정 리포트 (분석 전용 — 원격 저장 없음).
 * 원격 tileMeta × 레포 정본(tileSemanticsDungeon.ts) × 픽셀 실측(review sheets)을
 * 대조해 480타일을 틀린 것 / 애매한 것 / 확실한 것으로 분류한다.
 * 실행: npx tsx scripts/gen-dungeon-tile-verdicts.mts
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync.ts";

const OUT = path.resolve("output/evidence/dungeon-prop-catalog");
fs.mkdirSync(OUT, { recursive: true });
const T = 16, COLS = 30, TILES = 480, Z = 4;

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
const meta = remote.tilesets["easyrpg_chipset_dungeon"]!.tileMeta as Record<number, { label?: string; role?: string; passage?: string }>;

const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
const tileB64: string[] = [];
for (let t = 0; t < TILES; t += 1) {
  const sx = (t % COLS) * T, sy = Math.floor(t / COLS) * T;
  const out = new PNG({ width: T * Z, height: T * Z });
  for (let y = 0; y < T * Z; y += 1) for (let x = 0; x < T * Z; x += 1) {
    const si = ((sy + Math.floor(y / Z)) * chip.width + (sx + Math.floor(x / Z))) * 4;
    const di = (y * out.width + x) * 4;
    if (chip.data[si + 3] === 0) { const c = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 58 : 42; out.data[di] = c; out.data[di + 1] = c; out.data[di + 2] = c + 8; out.data[di + 3] = 255; }
    else for (let k = 0; k < 4; k += 1) out.data[di + k] = chip.data[si + k]!;
  }
  tileB64.push(PNG.sync.write(out).toString("base64"));
}

// ── 판정 테이블 ─────────────────────────────────────────────────────────────
type Group = { title: string; tiles: number[]; current: string; note: string };
const WRONG: Group[] = [
  { title: "벽 밴드 상단을 통행 가능한 '자갈'로", tiles: [102, 103, 104], current: "적암 대지/자갈 · terrain · 통행가능", note: "→ 거친 바위벽 상단 (102 좌끝 / 103 중앙 / 104 우끝) · wall · solid. 용암동굴 사태의 통행성 버그 핵심." },
  { title: "벽 밴드 몸통을 '뿌리 커튼 벽'으로 오식", tiles: [132, 133, 134], current: "뿌리 커튼 벽 · wall · solid", note: "→ 거친 바위벽 몸통 (132 좌 / 133 중 / 134 우, 하단 용암 발광) · wall · solid." },
  { title: "지층 벽을 '계단'으로", tiles: [48, 49, 50], current: "청록 계단 · building · 통행가능", note: "→ 청회 지층 벽면 · wall · solid. 픽셀상 명백한 지층 절벽." },
  { title: "붉은 벽돌을 '계단'으로", tiles: [105, 106, 107], current: "적암 계단 · building · 통행가능", note: "→ 붉은 벽돌 벽 · wall · solid." },
  { title: "붉은 커튼을 '카펫 계단'으로", tiles: [228, 229, 230], current: "카펫 계단 · building · 통행가능", note: "→ 붉은 커튼(금술 장막) · decoration · solid." },
  { title: "지층 암벽을 '나무 판자'로", tiles: [252, 253, 254], current: "나무 판자 바닥/다리 · terrain · 통행가능", note: "→ 가로 지층 암벽 · wall · solid." },
  { title: "구덩이 조각이 바닥 그룹에 혼입", tiles: [130], current: "회록 석재 바닥 · terrain · 통행가능", note: "→ 동굴 구덩이(낭떠러지) · solid." },
  { title: "보석/흰 벽돌을 바닥으로", tiles: [78, 79, 108, 109], current: "석재 바닥 변형 · terrain · 통행가능", note: "→ 보석 벽돌(78) / 자수정 벽돌(79) / 흰 석벽돌(108) / 장식 각석(109) · wall · solid." },
  { title: "배수구 벽을 물 타일로", tiles: [93, 94, 95], current: "물/폭포 · water · solid", note: "→ 석조 수로 배수구 벽 · wall · solid. role 자체가 틀림." },
  { title: "얼굴 조각 바위 오분류", tiles: [20, 75], current: "청록 석벽 / 적암 대각 절벽", note: "→ 얼굴 조각 바위(석면상) · wall · solid. 유적 포인트 타일." },
  { title: "금맥 암반을 그냥 '갈색 암벽'으로", tiles: [255, 256, 257], current: "갈색 암벽 · wall · solid", note: "→ 금맥 암반(황금빛 자갈) · wall · solid. 광산 테마 핵심 타일인데 이름이 숨겨져 있음." },
  { title: "흙 단상이 암벽 그룹에 혼입", tiles: [225, 226, 227], current: "갈색 암벽 · wall · solid", note: "→ 흙 단상 · terrain · 통행가능. 통행성이 정반대." },
  { title: "푸른 광석 암반 오분류 A", tiles: [285, 315], current: "285: 얼음 벽 · solid / 315: 바위/수정 소품 · 통행가능", note: "→ 푸른 광석 암반 · wall · solid." },
  { title: "푸른 광석 암반을 '검푸른 급류'(물)로", tiles: [372, 373, 374, 402, 403, 404], current: "검푸른 급류 · water · solid", note: "→ 푸른 광석 암반 · wall · solid. 픽셀상 물이 아니라 광석 박힌 암반. decorate 스크립트의 '광석' 오용을 부추긴 타일." },
  { title: "룬 석판을 '가구/집기'로", tiles: [265], current: "가구/집기 · prop · 통행가능", note: "→ 룬 석판(문자판) — 벽에 매다는 장식 · decoration · solid · 상위 레이어. 사용자 지적 확인." },
  { title: "작은 명판 오분류", tiles: [266], current: "가구/집기 · prop · 통행가능", note: "→ 작은 액자/명판 · decoration · solid." },
  { title: "박쥐 그림자를 '벽 갈라진 틈'으로", tiles: [267], current: "벽 갈라진 틈 · prop · 통행가능", note: "→ 박쥐 그림자 · decoration · 통행가능." },
  { title: "거미줄을 '벽 갈라진 틈'으로", tiles: [268, 269], current: "벽 갈라진 틈 · prop · 통행가능", note: "→ 검은 거미줄(천장 자락) · decoration · 통행가능." },
  { title: "빗금 무늬판을 '얼음 블록'으로", tiles: [232], current: "얼음 블록 · prop · 통행가능", note: "→ 빗금 무늬 판. 용도는 판독보류(레포 정본도 보류)." },
  { title: "황금 새장을 '마법진'으로", tiles: [441, 442, 443, 471, 472, 473], current: "마법진 · prop · 통행가능", note: "→ 황금 새장(촛대 달린 대형 우리 3×2) · decoration · solid." },
  { title: "파이프 오르간을 '1×1 계단'으로", tiles: [444, 445, 474, 475], current: "1×1 계단 · building · 통행가능", note: "→ 파이프 오르간(3×2) 구성품 · decoration · solid." },
  { title: "오르간 구성품을 '석주'로 (오프바이원)", tiles: [446, 476], current: "석주 · building · solid", note: "→ 파이프 오르간 구성품. 진짜 석조 기둥은 447/477." },
  { title: "석조 기둥이 '왕좌' 그룹에", tiles: [447, 477], current: "왕좌 · building · solid", note: "→ 석조 기둥(1×2) · decoration · solid." },
  { title: "그루터기를 통행 가능 단상으로", tiles: [436], current: "녹회색 암반 단상 · terrain · 통행가능", note: "→ 나무 그루터기 · decoration · solid." },
  { title: "눈사람이 '바위/수정 소품'으로", tiles: [345], current: "바위/수정 소품 · prop · 통행가능", note: "→ 눈사람 · decoration · solid." },
  { title: "통행성 일괄 오류 — 횃불/화염", tiles: [207, 208, 209, 263, 264, 293], current: "횃불/모닥불 · prop · 통행가능", note: "→ 전원 solid. 207~209는 '화염(불길 애니메이션)'으로 개명." },
  { title: "통행성 일괄 오류 — 바위/수정 소품 25종", tiles: [259, 260, 261, 262, 288, 289, 290, 291, 292, 318, 319, 320, 321, 322, 323, 348, 349, 350, 351, 352, 353, 382, 383, 412, 413], current: "바위/수정 소품 · prop · 통행가능", note: "→ 전원 solid. 바위·수정을 뚫고 지나가는 상태." },
  { title: "통행성 일괄 오류 — 가구/집기 27종", tiles: [294, 296, 297, 298, 324, 326, 327, 328, 329, 354, 356, 357, 358, 359, 384, 385, 386, 387, 388, 389, 414, 415, 416, 417, 418, 419], current: "가구/집기 · prop · 통행가능", note: "→ 전원 solid. 이름은 대체로 맞음. 294/324/354는 '큰 나무 문(1×3)', 298은 '룬 팻말'로 세분화 권장. (355는 정체 불명이라 '애매'로)" },
  { title: "통행성 일괄 오류 — 수정 기둥", tiles: [118, 119, 149], current: "수정/덩굴 소품 · prop · 통행가능", note: "→ 푸른 수정(소형/기둥) · decoration · solid." },
  { title: "통행성 일괄 오류 — 천막", tiles: [378, 379, 380, 381, 410, 411], current: "봉우리/지붕 꼭대기 · prop · 통행가능", note: "→ 천막 지붕 · building · solid." },
];
const AMBIG: (Group & { lean: string })[] = [
  { title: "평평한 흰 바닥", tiles: [6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98], current: "눈밭 · terrain · 통행가능", note: "눈밭인지 빙판인지?", lean: "빙판 바닥 (레포 정본)" },
  { title: "얼음 덩어리 블롭", tiles: [9, 10, 11, 39, 40, 41, 69, 70, 71, 99, 100, 101], current: "얼음판 · terrain · 통행가능", note: "덩어리 형태인데 통행 가능한 판면?", lean: "얼음 결정 지대 · solid" },
  { title: "석조 아치 상단?", tiles: [24, 25, 26], current: "석조 돔/화덕 · building · solid", note: "시트 경계에 걸려 전체 형상이 안 보임", lean: "석조 아치 관문 상단(3칸)" },
  { title: "황금 장식 상단?", tiles: [27, 28, 29], current: "마법진 · prop · 통행가능", note: "마법진? 황금 아치? (레포 정본도 판독보류)", lean: "보류 — 사용자 확인 필요" },
  { title: "레일 직선·캡", tiles: [114, 144, 174, 115, 116, 117], current: "광차 철로 · prop · 통행가능", note: "role을 building으로? + 캡 구조(114 상단/144 중간/174 하단, 115 좌/116 중/117 우) 명시?", lean: "building + 캡 의미 부여 (픽셀 실측으로 확인됨)" },
  { title: "레일 루프 코너", tiles: [54, 55, 84, 85], current: "광차 철로 · prop", note: "2×2로 모으면 원형 루프가 되는 곡선 코너로 보임", lean: "루프 코너 확정 — 54 남↔동 / 55 남↔서 / 84 북↔동 / 85 북↔서" },
  { title: "판자 위 곡선·분기", tiles: [56, 57, 58, 59, 86, 87, 88, 89], current: "광차 철로 · prop", note: "각 타일의 정확한 방향이 불명확", lean: "방향 잠정 — 확대 판독 후 확정" },
  { title: "주황 셰브론 판", tiles: [172, 173, 202, 203], current: "화살표 바닥판 · terrain · 통행가능", note: "방향 지시 화살표? 위험 경고(해저드) 스트라이프?", lean: "화살표 발판" },
  { title: "푸른 블록", tiles: [125, 155, 185, 215], current: "얼음 마법 블록 · building · solid", note: "얼음? 마법 봉인 블록?", lean: "푸른 마법 블록(애니메이션)" },
  { title: "천장 어둠 / 암흑 구덩이", tiles: [246, 247, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338, 249, 250, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341], current: "천장 어둠(담색/금장 테두리) · wall · solid", note: "동굴 '천장' 전용으로 둘지, 범용 '암흑 구덩이'로 둘지", lean: "암흑 구덩이 · terrain · solid + 천장 용도 주석" },
  { title: "푸른 발광 심연", tiles: [366, 367, 368, 396, 397, 398, 426, 427, 428, 456, 457, 458], current: "심연/천장(푸른 테두리) · wall · solid", note: "이름 정리와 role", lean: "푸른 발광 심연 · terrain · solid" },
  { title: "흰/회색 테두리 구멍", tiles: [369, 370, 371, 399, 400, 401, 429, 430, 431, 459, 460, 461], current: "심연/천장(회암 테두리) · wall · solid", note: "흰 테(369 계열)와 회색 테(370 계열)가 다름", lean: "흰 바위 구멍 / 회색 바위 구멍으로 분리" },
  { title: "설원 블롭", tiles: [282, 283, 284, 312, 313, 314, 342, 343, 344], current: "부빙(빙판) · terrain · 통행가능", note: "눈밭? 빙판?", lean: "눈밭(설원 블롭)" },
  { title: "암갈/뿌리 벽 혼합", tiles: [15, 16, 17, 45, 46, 47, 76, 77], current: "적암 대각 절벽 · wall · solid", note: "15,45는 동굴 암벽, 16,17,46,47,76,77은 뿌리 얽힌 벽으로 형상이 다름", lean: "동굴 암벽 / 뿌리 얽힌 벽으로 분리" },
  { title: "청회 지층 벽면", tiles: [18, 19], current: "청록 석벽(뿌리 전이) · wall · solid", note: "뿌리가 아니라 지층으로 보임", lean: "청회 지층 벽면" },
  { title: "단상 위 작은 무늬", tiles: [166], current: "갈색 단상 · terrain · 통행가능", note: "발자국 같은 무늬가 보임", lean: "흙 단상 발자국 무늬 (판독보류)" },
  { title: "흰 반투명 더미", tiles: [355], current: "가구/집기 · prop · 통행가능", note: "거미줄 뭉치? 천 더미?", lean: "거미줄 뭉치 · solid (판독보류)" },
  { title: "크레바스/잡석 혼합", tiles: [432, 433, 434, 462, 463, 464], current: "석재 대각 절벽 · wall · solid", note: "V자 크레바스(432,433,462,463)와 검은 잡석(434,464)이 다름", lean: "분리 권장" },
  { title: "원형 석조 구조물", tiles: [438, 439, 440, 468, 469, 470], current: "석조 돔/화덕 · building · solid", note: "원형 벽(438,439,468,469)과 첨탑(440,470)의 조합", lean: "콜로세움 벽 2×2 + 석탑 첨탑 1×2로 분리" },
  { title: "덩굴 가지", tiles: [177, 178, 179], current: "수정/덩굴 소품 · prop · 통행가능", note: "덩굴을 뚫고 지나가게 할지", lean: "decoration · solid 권장 (취향)" },
  { title: "설산 봉우리", tiles: [408, 409], current: "봉우리/지붕 꼭대기 · prop · 통행가능", note: "통행성을 solid로?", lean: "building · solid" },
  { title: "해골과 뼈", tiles: [299], current: "가구/집기 · prop · 통행가능", note: "통행 가능은 적절 — 이름만 정리", lean: "해골과 뼈 · decoration · 통행가능 유지" },
];

const inGroups = new Set<number>();
for (const g of [...WRONG, ...AMBIG]) for (const t of g.tiles) inGroups.add(t);
const OK: number[] = [];
for (let t = 0; t < TILES; t += 1) if (!inGroups.has(t)) OK.push(t);
const wrongCount = WRONG.reduce((a, g) => a + g.tiles.length, 0);
const ambigCount = AMBIG.reduce((a, g) => a + g.tiles.length, 0);

const tileImg = (t: number) => `<figure><img src="data:image/png;base64,${tileB64[t]}"><figcaption>#${t}</figcaption></figure>`;
const groupHtml = (g: Group, cls: string, lean?: string) => `
<div class="group ${cls}">
  <div class="ghead"><b>${g.title}</b><span class="tiles-n">${g.tiles.length}타일</span></div>
  <div class="trow">${g.tiles.map(tileImg).join("")}</div>
  <div class="meta-line"><span class="cur">현재: ${g.current}</span></div>
  <div class="meta-line"><span class="fix">${g.note}</span></div>
  ${lean ? `<div class="meta-line"><span class="lean">내 판단: ${lean}</span></div>` : ""}
</div>`;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>던전 칩셋 타일 메타 판정 — 틀린 것 / 애매한 것 / 확실한 것</title>
<style>
 body{background:#141216;color:#e8e2da;font:14px/1.55 -apple-system,'Segoe UI','Malgun Gothic',sans-serif;max-width:1400px;margin:0 auto;padding:28px 18px 80px}
 h1{font-size:24px;border-bottom:2px solid #b8492b;padding-bottom:10px}
 h2{font-size:20px;margin-top:40px;padding-left:10px;border-left:4px solid}
 h2.wrong{color:#ff7a7a;border-color:#ff7a7a} h2.ambig{color:#ffd27a;border-color:#ffd27a} h2.ok{color:#7fd47f;border-color:#7fd47a}
 .card{background:#1e1b22;border:1px solid #333;border-radius:10px;padding:14px 18px;margin:12px 0}
 .group{background:#1e1b22;border:1px solid #333;border-radius:10px;padding:12px 16px;margin:12px 0}
 .group.wrong{border-left:4px solid #ff7a7a}.group.ambig{border-left:4px solid #ffd27a}
 .ghead{display:flex;gap:10px;align-items:baseline;margin-bottom:6px}
 .tiles-n{color:#a99;font-size:12px}
 .trow{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
 figure{margin:0;text-align:center}
 figure img{image-rendering:pixelated;width:56px;border-radius:4px;background:#2a2530;border:1px solid #3a3540}
 figcaption{font-size:10.5px;color:#ffd27a}
 .meta-line{font-size:12.5px;margin:2px 0}
 .cur{color:#a99}.fix{color:#e8e2da}.lean{color:#8fd3ff}
 .okgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}
 .okgrid figure img{width:100%}
 .cap{font-size:12.5px;color:#a99}
 code{background:#2a2530;padding:1px 6px;border-radius:4px;font-size:12px}
 .stat{font-size:15px}
</style></head><body>
<h1>던전 칩셋 타일 메타 판정 리포트</h1>
<p class="cap">판정 근거 3종 교차: ① Supabase 원격 tileMeta(현재 값) ② 레포 정본 <code>tileSemanticsDungeon.ts</code>(2026-07-13 비전 전수 감사) ③ 내 픽셀 실측(review sheets). 정본과 원격이 다륵고 픽셀이 정본 편이면 '틀림', 양쪽 다 불명확하면 '애매'.</p>
<div class="card stat">❌ 틀린 것 <b style="color:#ff7a7a">${wrongCount}타일</b> (${WRONG.length}그룹) · ⚠️ 애매한 것 <b style="color:#ffd27a">${ambigCount}타일</b> (${AMBIG.length}그룹) · ✅ 확실한 것 <b style="color:#7fd47f">${OK.length}타일</b></div>

<h2 class="wrong">❌ 틀린 것 — 수정 필요 (${wrongCount})</h2>
${WRONG.map((g) => groupHtml(g, "wrong")).join("")}

<h2 class="ambig">⚠️ 애매한 것 — 사용자 확인 요청 (${ambigCount})</h2>
${AMBIG.map((g) => groupHtml(g, "ambig", g.lean)).join("")}

<h2 class="ok">✅ 확실한 것 — 현행 유지 (${OK.length})</h2>
<div class="card"><p class="cap">라벨·role·통행성이 픽셀 및 정본과 일치. 개별 카드는 생략 없이 전부 나열한다.</p>
<div class="okgrid">${OK.map((t) => `<figure><img src="data:image/png;base64,${tileB64[t]}"><figcaption>#${t} ${meta[t]?.label ?? ""}</figcaption></figure>`).join("")}</div></div>
<p class="cap">확정되면: ① <code>tileSemanticsDungeon.ts</code> 정본 갱신 → ② 원격 tileset 재동기화 스크립트 → ③ 벽 밴드 좌/중/우 변형 적용한 용암동굴 재수리.</p>
</body></html>`;
fs.writeFileSync(path.join(OUT, "verdicts.html"), html);
console.log("verdicts:", path.join(OUT, "verdicts.html"));
console.log("counts — wrong:", wrongCount, "ambig:", ambigCount, "ok:", OK.length);
