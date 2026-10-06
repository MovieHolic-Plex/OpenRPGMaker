#!/usr/bin/env node
// jp_city 예제 맵 ③ 小学校 한 곳(교사·체육관·수영장·운동장 트랙·놀이 기구·교정 시설·정문·앞 생활도로) — 생성기 + 검사기.
// 근거: tiledata/jp-city/research/03-building-types-dimensions.md(학교), README(생활도로 4칸·보도 없음·전봇대).
//
//   node scripts/content/jp-city/maps/school.mjs            # 맵 생성·검사 → maps/out/school.{map,report}.json
//   python3 scripts/content/jp-city/maps/render.py scripts/content/jp-city/maps/out/school.map.json school
//   python3 scripts/content/jp-city/gate/adversarial_gate.py run --stage school --files …   # 적대적 검증 관문
//   node scripts/content/jp-city/maps/school.mjs --publish  # 검사 + 관문 통과 시 장소로 게시
//
// 층: 1층 바닥(校庭 흙·포장·생활도로·수영장 데크/물) · 2층 트랙 선·노면 표시 · 3층 건물·기구·철망 · 4층 전봇대·전선.
import { kitMap, underTsx, T } from "./kitmap.mjs";
underTsx(import.meta.url);

const W = 58, H = 48;
const m = await kitMap(W, H, { fill: T.SW });
const { put, tryPut, stamp, fillL1, checker, KIT } = m;
const GROUND = KIT["jp-school-ground-a"].rows[0].tiles[0], GROUND_B = KIT["jp-school-ground-b"].rows[0].tiles[0], GROUND_C = KIT["jp-school-ground-c"].rows[0].tiles[0];
const ground = (x, y) => { const h = (x * 73856093 ^ y * 19349663) >>> 0; return h % 7 === 0 ? GROUND_B : h % 11 === 0 ? GROUND_C : GROUND; };
const FENCE_S = 43, LANE = [44, 47], START = [45, 45];

// ── 1. 바닥: 교정 흙 전체 → 교사 앞 포장 띠 → 정문 길 → 앞 생활도로
fillL1(1, 1, W - 2, FENCE_S - 1, ground, "schoolyard");
fillL1(2, 13, W - 3, 14, checker, "apron");                       // 교사·체육관 앞 포장(昇降口 앞)
fillL1(44, 15, 47, FENCE_S, checker, "gate-path");               // 정문 → 교사·수영장 앞 길
m.addLane(0, LANE[0], W - 1, LANE[1]);
m.shapeLanes();

// ── 2. 건물(뒷줄부터): 교사 · 체육관 · 수영장
put("jp-bldg-school", 2, 12);                                      // 昇降口 (12,12)
put("jp-bldg-school-gym", 23, 12);                                 // 문 (28,12)(31,12)
put("jp-pool", 37, 12, { tag: "pool" });                           // 입구 (46,12)(47,12)

// ── 3. 교사 앞 줄(y 15~18): 게양대·화단·나팔꽃·동상·百葉箱 — 문 앞 열(12·28·31·44~47)은 비운다
put("jp-flagpoles", 2, 18, { tag: "flagpoles" });
put("jp-asagao", 6, 16, { tag: "asagao" });
put("jp-kadan", 15, 16, { tag: "kadan-1" });
put("jp-kadan", 19, 16, { tag: "kadan-2" });
put("jp-ninomiya", 24, 16, { tag: "ninomiya" });
put("jp-hyakuyoubako", 34, 17, { tag: "hyakuyoubako" });
put("jp-kadan", 37, 16, { tag: "kadan-3" });
put("jp-prop-vending-aka", 41, 16, { tag: "vend" });

// ── 4. 운동장(서): 트랙(2층) · 조례대 · 골대 한 쌍 · 방구망
stamp("jp-school-track-l", 2, 19, { layer: 2, tag: "track" });   // 트랙 바깥 x 2~31, y 19~33
put("jp-chorei-dai", 16, 18, { tag: "chorei-dai" });             // 트랙 북쪽 가운데, 운동장을 본다
put("jp-goal-l", 5, 29, { tag: "goal-l" });
put("jp-goal-r", 26, 29, { tag: "goal-r" });
put("jp-tetsubo", 3, 37, { tag: "tetsubo-2" });
put("jp-tires", 10, 36, { tag: "tires-2" });
for (let x = 2; x + 4 <= 33; x += 4) put("jp-ball-net", x, FENCE_S - 1, { tag: `net-${x}` });

// ── 5. 놀이·체육 구역(정문 길 서쪽) · 학급원(화단 두 줄)
put("jp-souko", 33, 21, { tag: "souko" });
put("jp-tetsubo", 38, 21, { tag: "tetsubo" });
put("jp-jungle-gym", 33, 28, { tag: "jungle-gym" });
put("jp-unte", 37, 26, { tag: "unte" });
put("jp-prop-sandbox", 38, 30, { tag: "sandbox" });
for (const [x, f] of [[33, 34], [38, 34], [33, 36], [38, 36]]) put("jp-kadan", x, f, { tag: `garden-${x}-${f}` });
tryPut("jp-prop-bench", 34, 39, "bench-1");

// ── 6. 정문 길 동쪽: 그네·미끄럼틀·사육장·자전거 보관대·나무
put("jp-prop-swing", 48, 21, { tag: "swing" });
put("jp-prop-slide", 52, 21, { tag: "slide" });
put("jp-shiiku-goya", 48, 35, { tag: "shiiku-goya" });
put("jp-bike-shelter", 50, 41, { tag: "bike-shelter" });
for (const [id, x, f] of [["jp-prop-tree-ginkgo", 49, 29], ["jp-prop-tree-sakura", 53, 30], ["jp-prop-tree-sakura", 53, 36],
  ["jp-prop-tree-sakura", 17, 37], ["jp-prop-tree-zelkova", 24, 37], ["jp-prop-tree-sakura", 24, 6], ["jp-prop-tree-zelkova", 30, 6],
  ]) tryPut(id, x, f, `tree-${x}-${f}`);
put("jp-school-gate-l", 43, FENCE_S, { tag: "school-gate" });      // 열린 칸 (45,43)(46,43)
put("jp-school-namestone", 39, FENCE_S - 2, { tag: "namestone" });

// ── 7. 담: 둘레 철망(정문 자리 비움)
const fence = [];
for (let x = 0; x < W; x++) { fence.push([x, 0]); if (x < 43 || x > 48) fence.push([x, FENCE_S]); }
for (let y = 1; y < FENCE_S; y++) { fence.push([0, y]); fence.push([W - 1, y]); }
m.fenceLine(fence.filter(([x, y]) => !m.own3[m.idx(x, y)]), "fence");

// ── 8. 앞 생활도로: 가장자리 표시 · 「30」 · 전봇대·전선(남쪽 가장자리)
m.edgeMarks({ ew: [LANE] });
m.mark30(20, LANE[0]);
m.poleRow(LANE[1], { forbid: (x) => x >= 41 && x <= 50 });          // 정문 앞은 비운다

const { report, MAP } = await m.finish({ id: "jp-city-school", name: "일본 도시 · 小学校", start: START, file: "school",
  bare: [T.SW, T.PAVE_A, T.PAVE_B, GROUND, GROUND_B, GROUND_C] });
console.log(JSON.stringify({ ok: report.ok, doors: report.doors.n, failing: report.doors.failing, solidOpen: report.solid.open, issues: report.layers.issues, autotiles: Object.fromEntries(Object.entries(report.autotiles).map(([k, v]) => [k, v.mismatch])), emptiness: report.emptiness, poles: report.poles, deco: report.deco }, null, 1));
if (!report.ok) process.exitCode = 2;

if (process.argv.includes("--publish")) {
  m.publish({ MAP, report, start: START, placeId: "jp-city-school-58x48", file: "school", placeKind: "settlement",
    name: "일본 도시 · 小学校 (교사·체육관·수영장·운동장·정문)",
    rules: [
      `${W}×${H}칸 일본 小学校 한 곳. 북쪽에 교사(3층, 昇降口 문 (12,12))·체육관·수영장, 그 앞 포장 띠 y 13~14, 교사 앞 줄에 게양대·화단·나팔꽃 화분·二宮金次郎像·百葉箱.`,
      "운동장(校庭 흙, 1층 jp:school-ground) 가운데 트랙 흰 선(jp-school-track-l 30×15, 2층 투명 덧그림), 트랙 북쪽에 조례대, 트랙 안 양 끝에 골대 한 쌍. 정문 길 서쪽에 체육 창고·철봉·정글짐·운제·타이어·모래밭·학급 화단, 동쪽에 그네·미끄럼틀·사육장·자전거 보관대.",
      "정문(jp-school-gate)은 남쪽 담 동쪽, 정문 → 교사·수영장 앞 길은 포장 x 44~47. 정문 곁 자전거 보관대·사육장. 운동장 남쪽 담 안쪽에 방구망을 이어 세웠다. 둘레는 철망 오토타일.",
      "앞 생활도로(폭 4칸, 보도 없음)에 側溝·흰 선·「30」, 남쪽 가장자리 전봇대·전선(4층).",
      `문 ${report.doors.n}개 접근칸 전부 정문 앞 (45,45) 에서 도달, 막힘 칸 ${report.solid.cells}개 전부 엔진이 막는다.`,
    ],
    limitations: "교사·체육관 실내 없음(문 칸에 전이 이벤트를 두면 다른 맵으로). 아이들·선생님 없음. 밤 조명 없음. 수영장 물은 막힘(헤엄 없음)." });
}
