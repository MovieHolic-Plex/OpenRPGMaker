#!/usr/bin/env node
// jp_city 예제 맵 ⑤ 노면전차가 다니는 간선(路面電車通り) — 복선 궤도·안전지대 정류장·4칸 횡단보도·지하철 출입구 — 생성기 + 검사기.
// 근거: tiledata/jp-city/research/README.md(노면전차), blocks/transit_street.py 의 단면·키트 규칙(적대적 관문 transit).
//
//   node scripts/content/jp-city/maps/tramstreet.mjs            # → maps/out/tramstreet.{map,report}.json
//   python3 scripts/content/jp-city/maps/render.py scripts/content/jp-city/maps/out/tramstreet.map.json tramstreet
//   node scripts/content/jp-city/maps/tramstreet.mjs --publish  # 검사 + 관문(--stage tramstreet) 통과 시 장소로 게시
//
// 단면(북→남, 행): 건물 0~8 · 북 보도 9~11 · 동쪽행 차로 12~14 · 동쪽행 섬/軌道敷 15~16 · 동쪽행 궤도 17~18 · 전주 행 19 ·
//   서쪽행 궤도 20~21 · 서쪽행 섬/軌道敷 22~23 · 서쪽행 차로 24~26 · 남 보도 27~28.
// 층: 1층 보도·아스팔트·軌道敷·섬 · 2층 레일·횡단보도·정지선·경계선·路側帯 · 3층 건물·출입구·섬 난간·센터 전주·신호기·가드레일 · 4층 가선.
// 탈것은 조수 도구와 같은 planMapTransit(auto: traffic + tram + tramStops)으로 깐다 — 궤도 칸은 차도에서 빠져 양쪽 일방 차로가 된다.
import { kitMap, underTsx, T } from "./kitmap.mjs";
underTsx(import.meta.url);

const PUBLISH = process.argv.includes("--publish");
const W = 48, H = 28;
// 단면(북→남, 행) — blocks/transit_street.py 장면과 같은 행 번호
const R = { walkN: 9, laneE: 12, trackN: 15, mid: 17, trackS: 19, islandW: 21, laneW: 23, walkS: 26 };   // mid 17~18 = 가운데 띠(동쪽행 섬·전주 밑동 18행)
const ISE = 6;                     // 동쪽행 섬 x 6~17(가운데 띠 — 동쪽행 궤도 남쪽), 導流帯 3~5
const ISW = 22;                    // 서쪽행 섬 x 22~33(서쪽행 궤도 남쪽), 導流帯 34~36
const CW = [18, 21];               // 횡단보도 x 18~21(4칸) — 두 섬 사이, 지하철 출입구(x 19~22) 앞
const WIRE_UP = 2;                 // 가선 = 궤도 윗행 −2(전차 팬터그래프 높이, transit_street.py WIRE_RULE)
const POLES = [2, 25, 44];         // 센터 전주(밑동 = 가운데 띠 아랫줄 18행, 16~24칸 간격) — 섬·횡단보도 칸은 피한다
/** 이 맵의 전차를 타면 가는 곳 — 동네 한 장의 역 앞. */
const RIDE = { mapId: process.env.TRAM_RIDE_MAP ?? "jp-city-town", x: 41, y: 12 };
/** 지하철 출입구 계단 → 지하철역 콘코스 출구 계단 앞. */
const SUBWAY = { mapId: "jp-city-station-concourse", x: 12, y: 4 };

const m = await kitMap(W, H, {});
const { put, tryPut, stamp, stampL2, fillL1, KIT } = m;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const kitTile = (id) => KIT[id].rows[0].tiles[0];
const BED = Object.keys(KIT).filter((k) => k.startsWith("jp-tram-trackbed")).map(kitTile);
const bed = (x, y) => BED[((x * 31 + y * 17) >>> 0) % 11 < 8 ? 0 : (x + y) % BED.length];

// ── 1. 바닥: 건물 뒤(자갈 뒷마당·틈) · 차로 둘(생활도로 오토타일) · 軌道敷(섬 사이 띠 전체)
fillL1(0, 0, W - 1, R.walkN - 1, T.GRAVEL, "backlot");
fillL1(14, 5, 22, R.walkN - 1, m.checker, "plaza");                   // 오피스 공개공지(판석)
m.addLane(0, R.laneE, W - 1, R.laneE + 2);
m.addLane(0, R.laneW, W - 1, R.laneW + 2);
m.shapeLanes();
fillL1(0, R.trackN, W - 1, R.islandW + 1, bed, "trackbed");
// 섬은 둘 다 각 궤도의 남쪽 — 전차 그림은 문이 보이는 남쪽 면에 있고(양 끝 운전대·양쪽 문), 3/4 에서 전차는 궤도 북쪽 칸을 가린다.
put("jp-tram-stop", ISE, R.mid + 1, { tag: "tram-island-e" });          // 윗줄 = 궤도 쪽 점자 띠, 아랫줄 = 난간
put("jp-tram-stop-zebra-e", ISE - 3, R.mid + 1, { tag: "tram-zebra-e" });
put("jp-tram-stop", ISW, R.islandW + 1, { tag: "tram-island-w" });       // 윗줄 = 궤도 쪽 점자 띠, 아랫줄 = 난간
put("jp-tram-stop-zebra", ISW + 12, R.islandW + 1, { tag: "tram-zebra-w" });

// ── 2. 북쪽 건물 줄(발 행 8). 오피스 빌딩은 공개공지(セットバック)로 발을 4행에 두고 그 앞 보도에 지하철 출입구
put("jp-bldg-zakkyo5", 0, 8);
put("jp-bldg-shop-ramen", 7, 8);
put("jp-bldg-office6", 14, 4);
put("jp-subway-entrance", 19, 9, { tag: "subway-entrance" });      // 계단 입구(anchor) = 아랫줄 가운데 (20,9)(21,9). 오피스 문(18,4) 앞 x 18 은 비운다
put("jp-bldg-mansion4", 23, 8);
put("jp-bldg-shop-izakaya", 34, 8);
put("jp-bldg-shop-sushi", 41, 8);
tryPut("jp-prop-planter", 14, 8, "plaza-planter-w");
tryPut("jp-prop-planter", 17, 8, "plaza-planter-e");

// ── 3. 2층: 레일(횡단보도 칸은 줄무늬 합성 레일) · 횡단보도 · 정지선 · 차로|軌道敷 경계선 · 路側帯
for (const x of range(0, W - 1)) for (const ty of [R.trackN, R.trackS]) stampL2(x >= CW[0] && x <= CW[1] ? "jp-tram-rail-h-xwalk" : "jp-tram-rail-h", x, ty);
const cwRows = [...range(R.laneE, R.trackN - 1), R.mid, R.mid + 1, ...range(R.islandW, R.laneW + 2)];   // 궤도 행은 줄무늬 합성 레일이 맡는다
m.groupLineL2("jp-crosswalk-ns", cwRows.flatMap((y) => range(CW[0], CW[1]).map((x) => [x, y])));
for (const y of range(R.laneE, R.laneE + 2)) stampL2("jp-mark-stopline-v", CW[0] - 1, y);       // 동쪽행: 횡단보도 서쪽(상류)
for (const y of range(R.laneW, R.laneW + 2)) stampL2("jp-mark-stopline-v", CW[1] + 1, y);       // 서쪽행: 동쪽(상류)
for (const x of range(0, W - 1)) if (x < CW[0] - 1 || x > CW[1]) stampL2("jp-tram-lane-line-s", x, R.laneE + 2);
for (const x of range(0, W - 1)) if (x < CW[0] || x > CW[1] + 1) stampL2("jp-tram-lane-line-n", x, R.laneW);
m.edgeMarks({ ew: [[R.laneE, R.laneW + 2]], skip: (x, y) => (x >= CW[0] && x <= CW[1]) || (y > R.laneE && y < R.laneW + 2) });
put("jp-tram-ped-signal", CW[0] - 1, R.walkN + 2, { tag: "ped-signal-n" });   // 양 끝 대각 한 쌍
put("jp-tram-ped-signal", CW[1] + 1, R.walkS + 1, { tag: "ped-signal-s" });

// ── 4. 센터 전주(3층, 칸 태그 foot-dy 로 밑동 줄 y 정렬) · 가선(4층)
for (const x of POLES) put("jp-tram-pole-c", x, R.mid + 1, { tag: `tram-pole-${x}` });
for (let x = 0; x < W; x += 2) for (const ty of [R.trackN, R.trackS]) stamp("jp-tram-wire-h", x, ty - WIRE_UP, { layer: 4, tag: `wire-${ty}-${x}` });

// ── 5. 보도 시설: 북 보도 건물 앞(자판기·자전거·우체통) · 남 보도 가드레일 + 가로수·가로등(4층, 차로 위로 겹쳐 서는 키 큰 것)
tryPut("jp-prop-vend-pair", 9, R.walkN, "vend-n");
tryPut("jp-prop-bike-rack", 26, R.walkN, "bike-n");
tryPut("jp-prop-bike-rack", 29, R.walkN, "bike-n2");
tryPut("jp-prop-post-box", 40, R.walkN, "post-n");
const TREES = [6, 36], LAMPS = [15, 43];
const underTall = (x) => TREES.some((t) => x >= t && x < t + 4) || LAMPS.includes(x);
m.groupLine("jp-guardrail", range(0, W - 1).filter((x) => (x < CW[0] - 1 || x > CW[1] + 2) && !underTall(x)).map((x) => [x, R.walkS]), "guardrail-s");
for (const x of TREES) tryPut("jp-prop-tree-zelkova", x, R.walkS + 1, `tree-s-${x}`, { layer: 4, onLane: true });
for (const x of LAMPS) tryPut("jp-prop-lamp-post", x, R.walkS + 1, `lamp-s-${x}`, { layer: 4, onLane: true });
tryPut("jp-prop-bike-rack", 1, R.walkS + 1, "bike-rack-s");
tryPut("jp-prop-bike-rack", 30, R.walkS + 1, "bike-rack-s2");

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
    { x: ISW + 6, y: R.trackS, at: "center", name: "さくら町電停", waitSec: 8, board: RIDE },
    { x: ISE + 6, y: R.trackN, at: "center", name: "さくら町電停", waitSec: 8, board: RIDE },
  ] },
});

// 레일·횡단보도 이음 검사: 두 궤도 모두 x 0~W-1 모든 칸에 레일 키트, 횡단보도 4칸 열은 북 보도~남 보도 사이 끊김 없음(레일 칸은 줄무늬 레일)
const railTiles = new Set(["jp-tram-rail-h", "jp-tram-rail-h-xwalk"].flatMap((id) => KIT[id].rows.flatMap((r) => r.upperTiles)).filter((t) => t >= 0));
const xwalkRail = new Set(KIT["jp-tram-rail-h-xwalk"].rows.flatMap((r) => r.upperTiles).filter((t) => t >= 0));
const cwG = new Set(m.GRP["jp-crosswalk-ns"].memberTileIds);
const extraLayersCheck = () => {
  const railGaps = [], cwGaps = [];
  for (const ty of [R.trackN, R.trackS]) for (const y of [ty, ty + 1]) for (let x = 0; x < W; x++) if (!railTiles.has(m.L2[m.idx(x, y)])) railGaps.push([x, y]);
  for (let x = CW[0]; x <= CW[1]; x++) for (let y = R.laneE; y <= R.laneW + 2; y++) { const t = m.L2[m.idx(x, y)]; if (!cwG.has(t) && !xwalkRail.has(t)) cwGaps.push([x, y]); }
  return { ok: railGaps.length === 0 && cwGaps.length === 0, railGaps: railGaps.slice(0, 6), crosswalkGaps: cwGaps.slice(0, 6), railCells: 4 * W - railGaps.length };
};
const { report, MAP } = await m.finish({ id: "jp-city-tram-street", name: "일본 도시 · 노면전차 거리", start: [20, 11], file: "tramstreet", events, transit: plan.next, emptinessMax: 0.4, extraLayersCheck });
const skippedDeco = report.deco?.skipped ?? 0;
if (skippedDeco > 0) { report.ok = false; console.error(`꾸밈 소품 ${skippedDeco}개를 못 놓았다 — 자리를 고친다`); }
report.transit = { routes: plan.routes.map((r) => r.id), notes: plan.notes, warnings: plan.warnings };
console.log(JSON.stringify({ extra: report.extra, ok: report.ok, doors: report.doors.n, doorsOk: report.doors.allReached, anchors: report.anchors, issues: report.layers.issues, solidOpen: report.solid.open, emptiness: report.emptiness, autotiles: Object.fromEntries(Object.entries(report.autotiles).map(([k, v]) => [k, v.mismatch])), transit: report.transit }, null, 1));
if (!report.ok) process.exitCode = 2;
if (PUBLISH) m.publish({ MAP, report, placeId: `jp-city-tram-street-${W}x${H}`, name: "일본 도시 · 노면전차 거리 (복선·안전지대·지하철 출입구)", file: "tramstreet", start: [20, 11],
  rules: [
    `${W}×${H}칸 노면전차 간선. 단면(북→남): 건물 · 보도 3 · 동쪽행 차로 3 · 동쪽행 섬/軌道敷 2 · 동쪽행 궤도 2 · 센터 전주 행 1 · 서쪽행 궤도 2 · 서쪽행 섬/軌道敷 2 · 서쪽행 차로 3 · 보도 2.`,
    "좌측통행이고 전차 문은 차의 왼쪽 면이라 동쪽행 섬(jp-tram-stop-e)은 동쪽행 궤도 북쪽, 서쪽행 섬(jp-tram-stop)은 서쪽행 궤도 남쪽. 두 섬은 횡단보도 양쪽에 엇갈려 붙고, 섬 상류 끝에 導流帯. 섬 밖 칸·궤도·전주 행은 1층 軌道敷(jp-tram-trackbed) — 차도(생활도로 오토타일)와 띠를 나눈다.",
    "2층: 레일(jp-tram-rail-h, 횡단보도 칸은 jp-tram-rail-h-xwalk)·횡단보도(jp-crosswalk-ns)·정지선(jp-mark-stopline-v, 횡단보도 상류 바로 앞 열)·차로|軌道敷 경계선(jp-tram-lane-line-s/-n)·路側帯. 3층: 건물·섬·센터 전주(jp-tram-pole-c, 칸 태그 foot-dy 로 밑동 줄 y 정렬)·보행 신호기 대각 한 쌍·가드레일. 4층: 가선(jp-tram-wire-h) 두 궤도 각각 윗행 −2.",
    "탈것은 set_map_transit auto { traffic:true, tram:true, tramStops:[{x: 섬 가운데, y: 그 궤도 윗행, at:\"center\", board}] } — 차도 띠는 북 차로 동쪽행·남 차로 서쪽행 일방 둘, 복선 전차 두 방향, 각 전차가 자기 섬 옆에 서서 「조사」로 탄다. 지하철 출입구 계단 두 칸 → 콘코스.",
  ],
  limitations: "건물은 북쪽 한 줄(남쪽은 보도 끝에서 맵이 끝난다, 건물 사이 틈·뒤는 자갈 뒷마당). 교차로·신호 주기·우회전 차 없음 — 보행 신호는 빨강 고정 그림이고 차·전차는 주인공 앞에서만 선다. 자동 생성 프리셋이 아니다." });
