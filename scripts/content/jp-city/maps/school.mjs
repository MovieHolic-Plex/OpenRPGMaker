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
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const m = await kitMap(W, H, { fill: T.SW });
const { put, tryPut, stamp, fillL1, checker, KIT } = m;
const GROUND = KIT["jp-school-ground-a"].rows[0].tiles[0], GROUND_B = KIT["jp-school-ground-b"].rows[0].tiles[0], GROUND_C = KIT["jp-school-ground-c"].rows[0].tiles[0];
const GOMU = [KIT["jp-school-gomu-a"].rows[0].tiles[0], KIT["jp-school-gomu-b"].rows[0].tiles[0]];
const gomu = (x, y) => GOMU[((x * 31 + y * 17) >>> 0) % 5 === 0 ? 1 : 0];   // 遊具 밑 고무 칩(붉은 A·B 섞음)
const ground = (x, y) => { const h = (x * 73856093 ^ y * 19349663) >>> 0; return h % 7 === 0 ? GROUND_B : h % 11 === 0 ? GROUND_C : GROUND; };
const FENCE_S = 43, LANE = [44, 47], START = [34, 45];
const GATE_X = 31;                                                 // 정문 키트 x 31~38, 열린 칸 33~36
const PATH = [33, 36];                                             // 정문 → 교사 앞 진입로(폭 4칸 = 정문 개구부)

// ── 1. 바닥: 교정 흙 전체 → 교사·체육관 앞 포장 띠 → 진입로 → 수영장 가는 길 → 앞 생활도로
fillL1(1, 1, W - 2, FENCE_S - 1, ground, "schoolyard");
fillL1(2, 13, 36, 14, checker, "apron");                           // 교사·체육관 앞 포장(昇降口 앞)
fillL1(PATH[0], 15, PATH[1], FENCE_S, checker, "gate-path");      // 정문 → 교사 앞
fillL1(37, 19, 52, 20, checker, "pool-walk");                      // 진입로 → 수영장 탈의동 입구(51·52, 18)
fillL1(42, 21, 66, 24, gomu, "play-a");                           // 遊具 밑 ゴムチップ: 오르기 봉·운제·철봉·그네·미끄럼틀 줄
fillL1(38, 25, 48, 29, gomu, "play-b");                           //   정글짐·모래밭·타이어
fillL1(1, 34, 12, 37, gomu, "play-field");                        //   운동장 남쪽 철봉·타이어
m.addLane(0, LANE[0], W - 1, LANE[1]);
m.shapeLanes();

// ── 2. 건물(뒷줄): 교사 · 체육관 · 25m 수영장(물 25×12, 남쪽 탈의동으로 들어간다)
put("jp-bldg-school", 2, 12);                                      // 昇降口 (12,12)
put("jp-bldg-school-gym", 23, 12);                                 // 문 (28,12)(31,12)
put("jp-pool", 38, 18, { tag: "pool" });                           // x 38~66, y 1~18, 입구 (51,18)(52,18)
m.groupLine("jp-hedge", [...range(1, 22)].flatMap((x) => [[x, 1], [x, 2]]), "hedge-north");   // 교사 뒤 생울타리 두 줄
for (const [id, x] of [["jp-prop-tree-sakura", 24], ["jp-prop-tree-zelkova", 29], ["jp-prop-tree-sakura", 33]]) tryPut(id, x, 6, `tree-gym-${x}`);

// ── 3. 교사 앞 줄(y 15~18): 게양대·나팔꽃·외발자전거·화단·조례대·게시판·동상·수돗가 — 문 앞 열(12·28·31)은 비운다
put("jp-flagpoles", 2, 18, { tag: "flagpoles" });
put("jp-asagao", 6, 16, { tag: "asagao" });
put("jp-ichirinsha", 6, 18, { tag: "ichirinsha" });
m.groupLine("jp-hedge", [[13, 15], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15]], "hedge-front");   // 昇降口 옆 植え込み
put("jp-kadan", 14, 17, { tag: "kadan-front" });
put("jp-chorei-dai", 18, 18, { tag: "chorei-dai" });               // 트랙 북쪽 가운데, 운동장을 본다
put("jp-keijiban", 21, 17, { tag: "keijiban" });                   // 학교 게시판
put("jp-ninomiya", 24, 16, { tag: "ninomiya" });
put("jp-teaarai", 26, 16, { tag: "teaarai" });                     // 운동장 → 교사 들어가기 전 손 씻는 곳
put("jp-prop-bench", 27, 18, { tag: "bench-front" });

// ── 4. 운동장(서): 트랙(2층) · 골대 한 쌍 · 남쪽 띠(철봉·타이어·등나무·수돗가·창고) · 방구망
stamp("jp-school-track-l", 2, 19, { layer: 2, tag: "track" });   // 트랙 바깥 x 2~31, y 19~33
put("jp-goal-l", 5, 29, { tag: "goal-l" });
put("jp-goal-r", 26, 29, { tag: "goal-r" });
put("jp-tetsubo", 2, 36, { tag: "tetsubo-2" });
put("jp-tires", 8, 36, { tag: "tires" });
put("jp-fujidana", 13, 37, { tag: "fujidana-field" });             // 운동장 가 등나무 그늘(응원석)
put("jp-teaarai", 19, 36, { tag: "teaarai-field" });
put("jp-souko", 24, 37, { tag: "souko-field" });                   // 운동장 쪽 체육 창고(라인카·공)
put("jp-prop-bench", 29, 36, { tag: "bench-field" });
for (let x = 2; x + 4 <= 30; x += 4) put("jp-ball-net", x, FENCE_S - 1, { tag: `net-${x}` });

// ── 5. 동쪽 놀이·관찰 구역(진입로 동쪽, 수영장 남쪽) — 네 줄, 줄 사이 1칸
put("jp-teaarai", 54, 20, { tag: "teaarai-pool" });                // 수영장 나온 곳 손·발 씻기
put("jp-prop-bench", 59, 20, { tag: "bench-pool" });
put("jp-kadan", 62, 20, { tag: "kadan-pool" });
put("jp-souko", 38, 23, { tag: "souko" });                         // ① 창고·오르기 봉·운제·철봉·백엽상·그네·미끄럼틀
put("jp-noboribou", 43, 23, { tag: "noboribou" });
put("jp-unte", 47, 23, { tag: "unte" });
put("jp-tetsubo", 53, 23, { tag: "tetsubo" });
put("jp-hyakuyoubako", 59, 23, { tag: "hyakuyoubako" });
put("jp-prop-swing", 61, 23, { tag: "swing" });
put("jp-prop-slide", 64, 23, { tag: "slide" });
put("jp-jungle-gym", 38, 28, { tag: "jungle-gym" });              // ② 정글짐·모래밭·타이어·등나무 그늘·비오톱
put("jp-prop-sandbox", 42, 28, { tag: "sandbox" });
put("jp-tires", 45, 28, { tag: "tires-2" });
put("jp-fujidana", 50, 29, { tag: "fujidana" });
put("jp-biotope", 56, 29, { tag: "biotope" });
put("jp-gakkyuen", 38, 33, { tag: "gakkyuen-1" });                 // ③ 학급 밭 둘·사육장·화단·나팔꽃
put("jp-gakkyuen", 44, 33, { tag: "gakkyuen-2" });
put("jp-shiiku-goya", 50, 33, { tag: "shiiku-goya" });
put("jp-kadan", 55, 32, { tag: "kadan-shiiku" });
put("jp-asagao", 55, 33, { tag: "asagao-2" });
put("jp-bike-shelter", 60, 42, { tag: "bike-shelter" });           // 교직원 자전거
const SOUTH_TREES = [["jp-prop-tree-sakura", 38, 40], ["jp-prop-tree-sakura", 43, 40], ["jp-prop-tree-zelkova", 48, 40], ["jp-prop-tree-sakura", 53, 40]];
for (const [id, x, f] of [["jp-prop-tree-sakura", 63, 30], ["jp-prop-tree-ginkgo", 61, 36], ...SOUTH_TREES]) tryPut(id, x, f, `tree-${x}-${f}`);   // ④ 담 따라 벚나무 줄
// ── 6. 植え込み: 진입로 양옆 ツツジ 줄(틈 = 구역 출입구) · 놀이 구역 사이 덤불 덩이
for (let y = 21; y <= 37; y++) if (![24, 30, 34].includes(y)) put("jp-tsutsuji", 37, y, { tag: `azalea-e-${y}` });
for (let y = 19; y <= 33; y++) if (![24, 28].includes(y)) put("jp-tsutsuji", 32, y, { tag: `azalea-w-${y}` });
for (const [x, f] of [[49, 25], [53, 25], [57, 25], [59, 34], [63, 38]]) tryPut("jp-tsutsuji-3", x, f, `azalea3-${x}-${f}`);
for (let x = 39; x <= 58; x++) tryPut("jp-tsutsuji", x, 42, `azalea-s-${x}`);          // 남쪽 담 밑 벚나무 아래 植え込み
put("jp-school-gate-l", GATE_X, FENCE_S, { tag: "school-gate" }); // 열린 칸 x 33~36

// ── 7. 담: 둘레 철망(정문 자리 비움)
const fence = [];
for (let x = 0; x < W; x++) { fence.push([x, 0]); if (x < GATE_X || x > GATE_X + 7) fence.push([x, FENCE_S]); }
for (let y = 1; y < FENCE_S; y++) { fence.push([0, y]); fence.push([W - 1, y]); }
m.fenceLine(fence.filter(([x, y]) => !m.own3[m.idx(x, y)]), "fence");

// ── 8. 앞 생활도로: 가장자리 표시 · 「30」 · 전봇대·전선(남쪽 가장자리, 정문 앞은 비운다)
m.edgeMarks({ ew: [LANE] });
m.stampL2("jp-mark-30-e", 8, LANE[0]);                            // 동쪽행 차선(위 두 줄)
m.stampL2("jp-mark-30-w", 52, LANE[0] + 2);                      // 서쪽행 차선(아래 두 줄)
const trunkCols = SOUTH_TREES.flatMap(([, x]) => [x, x + 1, x + 2, x + 3]);                  // 나무 줄기 앞에 기둥을 세우지 않는다
m.poleRow(LANE[1], { forbid: (x) => (x >= GATE_X - 1 && x <= GATE_X + 8) || trunkCols.includes(x), prefer: 15 });

const { report, MAP } = await m.finish({ id: "jp-city-school", name: "일본 도시 · 小学校", start: START, file: "school",
  emptyIgnore: [{ x: 2, y: 19, w: 30, h: 15 }], emptinessMax: 0.4,   // 트랙(운동장) 사각만 비어 있어야 한다 — 그 밖은 마을 기준 0.4
  bare: [GROUND, GROUND_B, GROUND_C, T.LAWN] });   // 빈칸 = 바탕 흙만(길·포장·고무 칩은 목적 있는 바닥 — map-emptiness-gate 규칙)
console.log(JSON.stringify({ ok: report.ok, doors: report.doors.n, anchors: report.anchors, failing: report.doors.failing, solidOpen: report.solid.open, issues: report.layers.issues, autotiles: Object.fromEntries(Object.entries(report.autotiles).map(([k, v]) => [k, v.mismatch])), emptiness: report.emptiness, poles: report.poles, deco: report.deco }, null, 1));
if (!report.ok) process.exitCode = 2;

if (process.argv.includes("--publish")) {
  m.publish({ MAP, report, start: START, placeId: "jp-city-school-68x48", file: "school", placeKind: "settlement",
    name: "일본 도시 · 小学校 (교사·체육관·수영장·운동장·정문)",
    rules: [
      `${W}×${H}칸 일본 小学校 한 곳. 북쪽 뒷줄에 교사(3층, 昇降口 문 (12,12), 뒤 생울타리)·체육관(문 (28,12)(31,12))·25m 수영장(물 25×12칸). 수영장은 남쪽 탈의동 입구 (51,18)(52,18) → 탈의실(지붕 밑) → 샤워 아치 → 데크 순서로 들어간다.`,
      "교사·체육관 앞 포장 띠 y 13~14, 그 앞 줄(y 15~18): 국기 게양대 셋·1학년 나팔꽃 화분·외발자전거 걸이·植え込み·화단·조례대(운동장을 본다)·게시판·二宮金次郎像·手洗い場·벤치.",
      "서쪽 운동장(校庭 흙, 1층 jp:school-ground): 트랙 흰 선(jp-school-track-l 30×15, 2층 투명 덧그림)·골대 한 쌍, 남쪽 띠에 철봉·타이어(고무 칩 바닥)·등나무 그늘·수돗가·체육 창고·벤치, 남쪽 담 안쪽 방구망.",
      "동쪽 구역(진입로 동쪽, 수영장 남쪽): ① 고무 칩 바닥 위 창고·오르기 봉·운제·철봉·백엽상·그네·미끄럼틀 ② 정글짐·모래밭·타이어(고무 칩)·등나무 그늘·비오톱 ③ 학급 밭 둘·사육장·화단·나팔꽃 ④ 남쪽 담 따라 벚나무 줄과 ツツジ 植え込み, 교직원 자전거 보관대.",
      "정문(jp-school-gate-l, 개구부 4칸)은 남쪽 담 x 31~38, 진입로(포장) x 33~36 양옆 ツツジ 줄(틈 = 구역 출입구) → 교사 앞 포장 띠, 수영장 가는 길 y 19~20. 둘레는 철망 오토타일.",
      "앞 생활도로(폭 4칸, 보도 없음)에 側溝·흰 선·차선마다 「30」(동쪽행 jp-mark-30-e, 서쪽행 jp-mark-30-w), 남쪽 가장자리 전봇대·전선(4층, 정문 앞·나무 줄기 앞은 비움).",
      `문 ${report.doors.n}개 접근칸과 수영장 입구 ${report.anchors.n}칸 전부 정문 앞 (34,45) 에서 도달, 막힘 칸 ${report.solid.cells}개 전부 엔진이 막는다.`,
      "빈칸: 바탕 흙(교정 흙 A·B·C)만 빈칸으로 센다(길·포장·고무 칩·물은 목적 있는 바닥). 트랙 사각(운동장)은 빼고, 나머지 17×13 창 빈칸 상한 0.4(마을 기준).",
      "축척: 교사·트랙은 압축 축척(교사 20칸·트랙 한 바퀴 약 75칸)이고 수영장만 실제 크기(25m)다 — 게임 화면에 학교 전체가 들어오게 하려는 선택.",
    ],
    limitations: "교사·체육관 실내 없음(문 칸에 전이 이벤트를 두면 다른 맵으로). 아이들·선생님 없음. 밤 조명 없음. 수영장 물은 막힘(헤엄 없음)." });
}
