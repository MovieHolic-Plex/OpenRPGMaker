#!/usr/bin/env node
// jp_city 예제 맵 ⑤ 노면전차가 다니는 간선(路面電車通り) — 복선 궤도·안전지대 정류장·4칸 횡단보도·지하철 출입구 — 생성기 + 검사기.
// 근거: tiledata/jp-city/research/README.md(노면전차), blocks/transit_street.py 의 단면·키트 규칙(적대적 관문 transit).
//
//   node scripts/content/jp-city/maps/tramstreet.mjs            # → maps/out/tramstreet.{map,report}.json
//   python3 scripts/content/jp-city/maps/render.py scripts/content/jp-city/maps/out/tramstreet.map.json tramstreet
//   node scripts/content/jp-city/maps/tramstreet.mjs --publish  # 검사 + 관문(--stage tramstreet) 통과 시 장소로 게시
//
// 단면(북→남, 행): 건물 0~8 · 북 보도 9~11 · 동쪽행 차로 12~14 · 동쪽행 궤도 15~16 · 기둥 행 17 · 서쪽행 궤도 18~19 ·
//   서쪽행 안전지대 섬 20~21 · 서쪽행 차로 22~24 · 남 보도 25~26.
// 층: 1층 보도·아스팔트·섬 · 2층 레일·횡단보도·승강 점자 띠·路側帯 · 3층 건물·출입구·섬 난간·센터 전주·신호기 · 4층 가선.
// 탈것은 조수 도구와 같은 planMapTransit(auto: traffic + tram + tramStops)으로 깐다 — 궤도 칸은 차도에서 빠져 양쪽 일방 차로가 된다.
import { kitMap, underTsx } from "./kitmap.mjs";
underTsx(import.meta.url);

const PUBLISH = process.argv.includes("--publish");
const W = 48, H = 27;
const R = { walkN: 9, laneE: 12, trackN: 15, gap: 17, trackS: 18, island: 20, laneW: 22, walkS: 25 };
const ISX = 22;                    // 섬 x 22~33, 導流帯 34~36
const CW = [18, 21];               // 횡단보도 x 18~21(4칸) — 지하철 출입구(x 19~22) 앞, 섬 서쪽 끝 바로 옆
const WIRE_UP = 2;                 // 가선 = 궤도 윗행 −2(전차 팬터그래프 높이, transit_street.py WIRE_RULE)
const POLES = [3, 24, 44];         // 센터 전주(기둥 행, 16~24칸 간격)
/** 이 맵의 전차를 타면 가는 곳 — 동네 한 장의 역 앞. */
const RIDE = { mapId: process.env.TRAM_RIDE_MAP ?? "jp-city-town", x: 41, y: 12 };
/** 지하철 출입구 계단 → 지하철역 콘코스 출구 계단 앞. */
const SUBWAY = { mapId: "jp-city-station-concourse", x: 12, y: 4 };

const m = await kitMap(W, H, {});
const { put, tryPut, stamp, stampL2, KIT } = m;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ── 1. 바닥: 차도(동쪽행 차로 ~ 서쪽행 차로 한 덩이) → 섬은 나중에 1층을 덮는다
m.addLane(0, R.laneE, W - 1, R.laneW + 2);
put("jp-tram-stop", ISX, R.island + 1, { tag: "tram-island" });       // 서쪽행 안전지대(윗줄 = 궤도 쪽 점자 띠, 아랫줄 난간) — 1층이 섬 바닥
put("jp-tram-stop-zebra", ISX + 12, R.island + 1, { tag: "tram-zebra" });
const onIsland = (x, y) => y >= R.island && y <= R.island + 1 && x >= ISX && x <= ISX + 14;
m.shapeLanes(onIsland);                                             // 섬 칸을 뺀 차도 모양(섬 둘레는 도로 끝 모양이 아니다)

// ── 2. 북쪽 건물 줄(발 행 8, 틈 없이). 오피스 빌딩은 공개공지(セットバック)로 발을 4행에 두고 그 앞 보도에 지하철 출입구
put("jp-bldg-zakkyo5", 0, 8);
put("jp-bldg-shop-ramen", 7, 8);
put("jp-bldg-office6", 14, 4);
put("jp-subway-entrance", 19, 9, { tag: "subway-entrance" });      // 계단 입구(anchor) = 아랫줄 가운데 (20,9)(21,9). 오피스 문(18,4) 앞 x 18 은 비운다
put("jp-bldg-mansion4", 23, 8);
put("jp-bldg-shop-izakaya", 34, 8);
put("jp-bldg-shop-sushi", 41, 8);
tryPut("jp-prop-planter", 14, 8, "plaza-planter-w");
tryPut("jp-prop-bench", 15, 6, "plaza-bench");

// ── 3. 궤도·섬·횡단보도(2층) — 레일은 아스팔트 위 투명 덧그림
for (const x of range(0, W - 1)) { stampL2("jp-tram-rail-h", x, R.trackN); stampL2("jp-tram-rail-h", x, R.trackS); }
// 횡단보도: 북 보도 ↔ 동쪽행 차로 ↔ (궤도는 레일 그대로) ↔ 기둥 행 ↔ 서쪽행 차로 ↔ 남 보도. 궤도 칸 2층은 레일이 차지한다.
const cwRows = [...range(R.laneE, R.trackN - 1), R.gap, ...range(R.island, R.laneW + 2)];
m.groupLineL2("jp-crosswalk-ns", cwRows.flatMap((y) => range(CW[0], CW[1]).map((x) => [x, y])).filter(([x, y]) => !(y >= R.island && y <= R.island + 1 && x >= ISX)));
put("jp-tram-ped-signal", CW[0] - 1, R.walkN + 2, { tag: "ped-signal-n" });   // 북쪽 끝 보도(출입구 앞에서 건너온다)
put("jp-tram-ped-signal", CW[1] + 1, R.walkS + 1, { tag: "ped-signal-s" });
for (const x of range(ISX, ISX + 11)) stampL2("jp-tram-curb-stop", x, R.walkN + 2);   // 동쪽행 승강 자리(섬 맞은편 북 보도 끝)

// ── 4. 센터 전주(3층) · 가선(4층)
for (const x of POLES) put("jp-tram-pole-c", x, R.gap, { tag: `tram-pole-${x}` });
for (let x = 0; x < W; x += 2) for (const ty of [R.trackN, R.trackS]) stamp("jp-tram-wire-h", x, ty - WIRE_UP, { layer: 4, tag: `wire-${ty}-${x}` });

// ── 5. 남 보도: 가로수·자전거 거치대·자판기(보도 안쪽 줄, 길을 등지지 않게 띄엄띄엄)
for (const x of [2, 12, 30, 42]) tryPut("jp-prop-tree-zelkova", x, R.walkS + 1, `street-tree-${x}`);
tryPut("jp-prop-bike-rack", 7, R.walkS + 1, "bike-rack-s");
tryPut("jp-prop-bike-rack", 36, R.walkS + 1, "bike-rack-s2");

// ── 6. 이동: 지하철 출입구 계단 → 콘코스. 탈것: 차 흐름(양쪽 일방 차로) + 노면전차 복선 + 정류장 두 곳
const transfer = (id, name, x, y, to) => ({
  id, name, x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}_p`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: to.mapId, x: to.x, y: to.y, fade: "black", direction: "down" }] }],
});
const events = [20, 21].map((x) => transfer(`ev_subway_${x}`, "지하철 さくら町駅", x, R.walkN, SUBWAY));
const { planMapTransit } = await import(new URL("../../../../src/editor/tools/transitTools.ts", import.meta.url).href);
const draftMap = { id: "jp-city-tram-street", name: "노면전차 거리", width: W, height: H, tilesetId: "jp_city", tileSize: 16, lowerTiles: m.L1, lowerOverlayTiles: m.L2, upperTiles: m.L3, upperOverlayTiles: m.L4, events: [] };
const plan = planMapTransit({ tilesets: { jp_city: m.TS }, maps: { [RIDE.mapId]: { id: RIDE.mapId, name: RIDE.mapId, width: 96, height: 80 } } }, draftMap, {
  auto: { traffic: true, headwaySec: 8, tram: true, tramStops: [
    { x: ISX + 6, y: R.trackS, at: "center", name: "さくら町電停", waitSec: 8, board: RIDE },
    { x: ISX + 6, y: R.trackN, at: "center", name: "さくら町電停", waitSec: 8, board: RIDE },
  ] },
});

const { report, MAP } = await m.finish({ id: "jp-city-tram-street", name: "일본 도시 · 노면전차 거리", start: [20, 11], file: "tramstreet", events, transit: plan.next, emptinessMax: 0.4 });
report.transit = { routes: plan.routes.map((r) => r.id), notes: plan.notes, warnings: plan.warnings };
console.log(JSON.stringify({ ok: report.ok, doors: report.doors.n, doorsOk: report.doors.allReached, anchors: report.anchors, issues: report.layers.issues, solidOpen: report.solid.open, emptiness: report.emptiness, autotiles: Object.fromEntries(Object.entries(report.autotiles).map(([k, v]) => [k, v.mismatch])), transit: report.transit }, null, 1));
if (!report.ok) process.exitCode = 2;
if (PUBLISH) m.publish({ MAP, report, placeId: `jp-city-tram-street-${W}x${H}`, name: "일본 도시 · 노면전차 거리 (복선·안전지대·지하철 출입구)", file: "tramstreet", start: [20, 11],
  rules: [
    `${W}×${H}칸 노면전차 간선. 단면(북→남): 건물 · 보도 3 · 동쪽행 차로 3 · 동쪽행 궤도 2 · 센터 전주 행 1 · 서쪽행 궤도 2 · 서쪽행 안전지대 섬 2 · 서쪽행 차로 3 · 보도 2.`,
    "레일(jp-tram-rail-h)·횡단보도(jp-crosswalk-ns)·동쪽행 승강 점자 띠(jp-tram-curb-stop)는 2층, 섬(jp-tram-stop)·센터 전주(jp-tram-pole-c)·보행 신호기(jp-tram-ped-signal)·건물은 3층, 가선(jp-tram-wire-h)은 4층 궤도 윗행 −2.",
    "횡단보도는 보도→차로→섬→두 궤도→차로→보도 끝까지 4칸(궤도 칸은 레일이 2층을 차지). 지하철 출입구(jp-subway-entrance)는 오피스 공개공지 보도에, 계단 입구 두 칸에 콘코스로 가는 이동 이벤트.",
    "탈것은 set_map_transit auto { tram:true, tramStops:[{x, y: 궤도 윗행, at:\"center\", board}] } — 궤도 칸은 차도에서 빠져 북쪽 차로 동쪽행·남쪽 차로 서쪽행 일방 차 흐름, 복선 노면전차 두 방향, 전차는 섬 옆(서쪽행)·승강 띠 앞(동쪽행)에 서서 「조사」로 탄다.",
  ],
  limitations: "건물은 북쪽 한 줄(남쪽은 보도 끝에서 맵이 끝난다). 교차로·신호 주기·우회전 차 없음(신호기는 그림). 전차·차가 횡단보도에서 주인공 앞에서만 선다. 자동 생성 프리셋이 아니다." });
