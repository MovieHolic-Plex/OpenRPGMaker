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

const W = 68, H = 48;
const m = await kitMap(W, H, { fill: T.SW });
const { put, tryPut, stamp, fillL1, checker, KIT } = m;
const GROUND = KIT["jp-school-ground-a"].rows[0].tiles[0], GROUND_B = KIT["jp-school-ground-b"].rows[0].tiles[0], GROUND_C = KIT["jp-school-ground-c"].rows[0].tiles[0];
const ground = (x, y) => { const h = (x * 73856093 ^ y * 19349663) >>> 0; return h % 7 === 0 ? GROUND_B : h % 11 === 0 ? GROUND_C : GROUND; };
const FENCE_S = 43, LANE = [44, 47], START = [34, 45];
const GATE_X = 31;                                                 // 정문 키트 x 31~38, 열린 칸 33~36
const PATH = [33, 36];                                             // 정문 → 교사 앞 진입로(폭 4칸 = 정문 개구부)

// ── 1. 바닥: 교정 흙 전체 → 교사·체육관 앞 포장 띠 → 진입로 → 수영장 가는 길 → 앞 생활도로
fillL1(1, 1, W - 2, FENCE_S - 1, ground, "schoolyard");
fillL1(2, 13, 36, 14, checker, "apron");                           // 교사·체육관 앞 포장(昇降口 앞)
fillL1(PATH[0], 15, PATH[1], FENCE_S, checker, "gate-path");      // 정문 → 교사 앞
fillL1(37, 18, 54, 19, checker, "pool-walk");                      // 진입로 → 수영장 입구(52·53, 17)
m.addLane(0, LANE[0], W - 1, LANE[1]);
m.shapeLanes();

// ── 2. 건물(뒷줄): 교사 · 체육관 · 25m 수영장(물 25×12)
put("jp-bldg-school", 2, 12);                                      // 昇降口 (12,12)
put("jp-bldg-school-gym", 23, 12);                                 // 문 (28,12)(31,12)
put("jp-pool", 38, 17, { tag: "pool" });                           // x 38~66, y 1~17, 입구 (52,17)(53,17)

// ── 3. 교사 앞 줄(y 15~18): 게양대·나팔꽃·화단·조례대·동상·수돗가 — 문 앞 열(12·28·31)은 비운다
put("jp-flagpoles", 2, 18, { tag: "flagpoles" });
put("jp-asagao", 6, 16, { tag: "asagao" });
put("jp-kadan", 15, 16, { tag: "kadan-front" });
put("jp-chorei-dai", 16, 18, { tag: "chorei-dai" });               // 트랙 북쪽 가운데, 운동장을 본다
put("jp-ninomiya", 24, 16, { tag: "ninomiya" });
put("jp-teaarai", 26, 16, { tag: "teaarai" });                     // 운동장 → 교사 들어가기 전 손 씻는 곳

// ── 4. 운동장(서): 트랙(2층) · 골대 한 쌍 · 남쪽 철봉·타이어 · 방구망
stamp("jp-school-track-l", 2, 19, { layer: 2, tag: "track" });   // 트랙 바깥 x 2~31, y 19~33
put("jp-goal-l", 5, 29, { tag: "goal-l" });
put("jp-goal-r", 26, 29, { tag: "goal-r" });
put("jp-tetsubo", 3, 36, { tag: "tetsubo-2" });
put("jp-tires", 10, 36, { tag: "tires" });
for (let x = 2; x + 4 <= 30; x += 4) put("jp-ball-net", x, FENCE_S - 1, { tag: `net-${x}` });

// ── 5. 동쪽 놀이·관찰 구역(진입로 동쪽, 수영장 남쪽)
put("jp-souko", 38, 23, { tag: "souko" });                         // 체육 창고는 운동장 쪽 끝
put("jp-tetsubo", 43, 23, { tag: "tetsubo" });
put("jp-unte", 49, 23, { tag: "unte" });
put("jp-hyakuyoubako", 56, 22, { tag: "hyakuyoubako" });           // 백엽상은 트인 잔디 쪽
put("jp-prop-swing", 59, 23, { tag: "swing" });
put("jp-prop-slide", 63, 23, { tag: "slide" });
put("jp-jungle-gym", 38, 31, { tag: "jungle-gym" });
put("jp-prop-sandbox", 42, 31, { tag: "sandbox" });
put("jp-gakkyuen", 47, 31, { tag: "gakkyuen-1" });                 // 학급 밭 둘
put("jp-gakkyuen", 53, 31, { tag: "gakkyuen-2" });
put("jp-shiiku-goya", 38, 38, { tag: "shiiku-goya" });             // 사육장은 밭 곁
put("jp-kadan", 43, 37, { tag: "kadan-shiiku" });
tryPut("jp-prop-bench", 48, 37, "bench-1");
put("jp-bike-shelter", 60, 42, { tag: "bike-shelter" });           // 교직원 자전거
for (const [id, x, f] of [["jp-prop-tree-ginkgo", 59, 32], ["jp-prop-tree-sakura", 63, 32], ["jp-prop-tree-sakura", 52, 40],
  ["jp-prop-tree-zelkova", 56, 40], ["jp-prop-tree-sakura", 24, 6], ["jp-prop-tree-zelkova", 30, 6],
  ]) tryPut(id, x, f, `tree-${x}-${f}`);
put("jp-school-gate-l", GATE_X, FENCE_S, { tag: "school-gate" }); // 열린 칸 x 33~36

// ── 7. 담: 둘레 철망(정문 자리 비움)
const fence = [];
for (let x = 0; x < W; x++) { fence.push([x, 0]); if (x < GATE_X || x > GATE_X + 7) fence.push([x, FENCE_S]); }
for (let y = 1; y < FENCE_S; y++) { fence.push([0, y]); fence.push([W - 1, y]); }
m.fenceLine(fence.filter(([x, y]) => !m.own3[m.idx(x, y)]), "fence");

// ── 8. 앞 생활도로: 가장자리 표시 · 「30」 · 전봇대·전선(남쪽 가장자리, 정문 앞은 비운다)
m.edgeMarks({ ew: [LANE] });
m.mark30(10, LANE[0]);
m.poleRow(LANE[1], { forbid: (x) => x >= GATE_X - 1 && x <= GATE_X + 8, prefer: 16 });

const { report, MAP } = await m.finish({ id: "jp-city-school", name: "일본 도시 · 小学校", start: START, file: "school",
  bare: [T.SW, T.PAVE_A, T.PAVE_B, GROUND, GROUND_B, GROUND_C] });
console.log(JSON.stringify({ ok: report.ok, doors: report.doors.n, failing: report.doors.failing, solidOpen: report.solid.open, issues: report.layers.issues, autotiles: Object.fromEntries(Object.entries(report.autotiles).map(([k, v]) => [k, v.mismatch])), emptiness: report.emptiness, poles: report.poles, deco: report.deco }, null, 1));
if (!report.ok) process.exitCode = 2;

if (process.argv.includes("--publish")) {
  m.publish({ MAP, report, start: START, placeId: "jp-city-school-68x48", file: "school", placeKind: "settlement",
    name: "일본 도시 · 小学校 (교사·체육관·수영장·운동장·정문)",
    rules: [
      `${W}×${H}칸 일본 小学校 한 곳. 북쪽 뒷줄에 교사(3층, 昇降口 문 (12,12))·체육관(문 (28,12)(31,12))·25m 수영장(물 25×12칸, 입구 (52,17)(53,17)), 교사·체육관 앞 포장 띠 y 13~14.`,
      "교사 앞 줄(y 15~18): 국기 게양대 셋·1학년 나팔꽃 화분·화단·조례대(운동장을 본다)·二宮金次郎像·手洗い場.",
      "서쪽 운동장(校庭 흙, 1층 jp:school-ground): 트랙 흰 선(jp-school-track-l 30×15, 2층 투명 덧그림)·골대 한 쌍, 남쪽에 철봉·타이어, 남쪽 담 안쪽 방구망.",
      "동쪽 구역: 체육 창고·철봉·운제·百葉箱·그네·미끄럼틀(윗줄), 정글짐·모래밭·학급 밭 둘(가운데), 사육장·화단·벤치·교직원 자전거 보관대(아랫줄), 나무는 가장자리.",
      "정문(jp-school-gate-l, 개구부 4칸)은 남쪽 담 x 31~38, 진입로(포장) x 33~36 → 교사 앞 포장 띠, 수영장 가는 길 y 18~19. 둘레는 철망 오토타일.",
      "앞 생활도로(폭 4칸, 보도 없음)에 側溝·흰 선·「30」, 남쪽 가장자리 전봇대·전선(4층, 정문 앞은 비움).",
      `문 ${report.doors.n}개(+수영장 입구) 접근칸 전부 정문 앞 (34,45) 에서 도달, 막힘 칸 ${report.solid.cells}개 전부 엔진이 막는다.`,
      "축척: 교사·트랙은 압축 축척(교사 20칸·트랙 한 바퀴 약 75칸)이고 수영장만 실제 크기(25m)다 — 게임 화면에 학교 전체가 들어오게 하려는 선택.",
    ],
    limitations: "교사·체육관 실내 없음(문 칸에 전이 이벤트를 두면 다른 맵으로). 아이들·선생님 없음. 밤 조명 없음. 수영장 물은 막힘(헤엄 없음)." });
}
