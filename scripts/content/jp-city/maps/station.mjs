#!/usr/bin/env node
// jp_city 예제 맵 ④ 지하철역 さくら町 — 콘코스(개찰구·매표기·역무실·출구 계단) + 승강장(선로·지하철 노선·타기). 생성기 + 검사기.
// 근거: tiledata/jp-city/research/README.md(역), blocks/transit_station.py 의 키트 규칙.
//
//   node scripts/content/jp-city/maps/station.mjs     # → maps/out/station-concourse.{map,report}.json · station-platform.{map,report}.json
//   python3 scripts/content/jp-city/maps/render.py scripts/content/jp-city/maps/out/station-platform.map.json station-platform
//
// 이동: 콘코스 내려가는 계단(입구 칸) → 승강장 올라가는 계단 앞 / 승강장 올라가는 계단 → 콘코스 내려가는 계단 앞.
// 콘코스 출구 계단(지상) 은 EXIT_TARGET 으로 간다(지상 지하철 출입구 jp-subway-entrance 의 입구 칸에 맞춘다).
// 승강장 지하철(jp-subway, 30칸)은 맵 밖 서쪽에서 들어와 승강장에 서서 문을 연다 — 「조사」로 타면 RIDE_TARGET 으로 간다.
import { kitMap, underTsx } from "./kitmap.mjs";
underTsx(import.meta.url);

export const CONCOURSE_ID = "jp-city-station-concourse", PLATFORM_ID = "jp-city-station-platform";
/** 지상 출구(지하철 출입구가 있는 거리 맵) — 예제는 상점가 맵의 길. 실제 게임에서는 출입구 키트 입구 칸으로 바꾼다. */
const EXIT_TARGET = { mapId: process.env.STATION_EXIT_MAP ?? "jp-city-shopstreet", x: Number(process.env.STATION_EXIT_X ?? 20), y: Number(process.env.STATION_EXIT_Y ?? 30) };
/** 지하철을 타면 내리는 곳 — 예제는 小学校 앞 길(다음 역 「学校前」 지상). */
const RIDE_TARGET = { mapId: process.env.STATION_RIDE_MAP ?? "jp-city-school", x: 35, y: 41 };

const transferEvent = (id, name, x, y, to) => ({
  id, name, x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}_p`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: to.mapId, x: to.x, y: to.y, fade: "black", ...(to.dir ? { direction: to.dir } : {}) }] }],
});

// ── 콘코스 26×14 ───────────────────────────────────────────────
{
  const W = 26, H = 14;
  const m0 = await kitMap(W, H, {});
  const FLOOR = m0.KIT["jp-subway-floor"].rows[0].tiles[0];
  const m = await kitMap(W, H, { fill: FLOOR });
  const { put, stamp, own3, idx } = m;
  const row = (id, y, xs, tag) => { for (const x of xs) if (!own3[idx(x, y)]) stamp(id, x, y, { tag: `${tag}-${x}` }); };
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  put("jp-subway-ticket", 2, 3, { tag: "ticket" });                    // 매표기 x 2~7 (벽에 붙음)
  put("jp-subway-stairs-up", 11, 3, { tag: "exit-stairs" });           // 출구 계단 x 11~14, 입구 칸 (12,3)(13,3)
  put("jp-subway-office", 19, 3, { tag: "office" });                   // 역무실 창구 x 19~22
  for (const x of range(0, W - 1)) if (!own3[idx(x, 0)]) stamp("jp-subway-ceiling", x, 0, { tag: `ceil-${x}` });
  for (const x of range(0, W - 1)) if (!own3[idx(x, 1)] && !own3[idx(x, 2)]) stamp("jp-subway-wall", x, 1, { tag: `wall-${x}` });
  put("jp-subway-pillar-plain", 4, 7, { tag: "pillar-nw" });
  put("jp-subway-pillar-plain", 21, 7, { tag: "pillar-ne" });
  put("jp-subway-sign-exit", 16, 6, { tag: "sign-exit" });              // 천장에 매단 「出口」(출구 계단 쪽)
  put("jp-subway-gates", 8, 9, { tag: "gates" });                      // 개찰구 x 8~16, 통로 x 9·11·13·15
  row("jp-subway-fence", 9, [...range(0, 7), ...range(17, W - 1)], "fence");   // 개찰구 양옆 ラチ — 벽까지 막는다
  put("jp-subway-pillar-plain", 4, 12, { tag: "pillar-sw" });
  put("jp-subway-pillar-plain", 21, 12, { tag: "pillar-se" });
  put("jp-subway-sign-line", 6, 11, { tag: "sign-line" });              // 「のりば」
  put("jp-subway-stairs-down", 11, 13, { tag: "platform-stairs" });     // 승강장 계단 x 11~14, 입구 칸 (12,13)(13,13)
  // 점자 유도 블록(2층): 매표기 앞 ― 출구 계단 앞 ― 역무실 앞(4줄), 출구 계단 앞에서 개찰 통로(x 13)를 지나 승강장 계단 앞(10줄)까지
  const line = (x0, y0, x1, y1) => { const out = []; for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]); return out; };
  m.groupLineL2("jp-tactile", [...line(2, 4, 22, 4), ...line(13, 5, 13, 10), [12, 10]]);   // 4줄 = 매표기(x 2~7) 앞부터 역무실(x 19~22) 앞까지·출구 계단·역무실 앞(끝·꺾임 = 점형), 13열 = 개찰 통로 → 승강장 계단 앞
  const events = [
    ...[12, 13].map((x) => transferEvent(`ev_exit_${x}`, "출구 계단(지상)", x, 3, EXIT_TARGET)),
    ...[12, 13].map((x) => transferEvent(`ev_down_${x}`, "승강장으로", x, 13, { mapId: PLATFORM_ID, x: x + 9, y: 11, dir: "down" })),
  ];
  const { report } = await m.finish({ id: CONCOURSE_ID, name: "さくら町駅 · 콘코스", start: [12, 5], file: "station-concourse", bare: [], events });
  console.log(JSON.stringify({ map: CONCOURSE_ID, ok: report.ok, anchors: report.anchors, issues: report.layers?.issues, solidOpen: report.solid.open }));
  if (!report.ok) process.exitCode = 2;
}

// ── 승강장 44×13 ───────────────────────────────────────────────
{
  const W = 44, H = 13;
  const m0 = await kitMap(W, H, {});
  const FLOOR = m0.KIT["jp-subway-platform"].rows[0].tiles[0];
  const m = await kitMap(W, H, { fill: FLOOR });
  const { put, stamp, own3, idx } = m;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const line = (x0, y0, x1, y1) => { const out = []; for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]); return out; };
  for (const x of range(0, W - 1)) stamp("jp-subway-ceiling", x, 0, { tag: `ceil-${x}` });
  put("jp-subway-backwall-ad", 4, 3, { tag: "ad-w" });
  put("jp-subway-backwall-ad", 20, 3, { tag: "ad-m" });                // 뒷벽 역명판(8×3)은 열차 지붕에 아랫단이 가려 쓰지 않는다 — 역명판은 승강장 쪽에 매단다
  put("jp-subway-backwall-ad", 36, 3, { tag: "ad-e" });
  for (const x of range(0, W - 1)) if (!own3[idx(x, 1)]) stamp("jp-subway-backwall", x, 1, { tag: `back-${x}` });
  for (const x of range(0, W - 1)) stamp("jp-subway-track", x, 4, { tag: `track-${x}` });   // 선로 2줄(1층, 막힘)
  for (const x of range(0, W - 1)) stamp("jp-subway-edge", x, 6, { tag: `edge-${x}` });     // 승강장 끝(점자 블록)
  for (const x of [8, 32]) put("jp-subway-pillar", x, 8, { tag: `pillar-${x}` });
  put("jp-subway-station-sign-hang", 12, 8, { tag: "sign-hang" });
  put("jp-subway-station-sign-hang", 34, 8, { tag: "sign-hang-e" });
  put("jp-subway-led", 26, 8, { tag: "led" });
  put("jp-subway-stairs-up", 20, 10, { tag: "stairs-up" });             // 콘코스로 올라가는 계단 x 20~23, 입구 칸 (21,10)(22,10)
  put("jp-subway-bench", 3, 11, { tag: "bench-w" });
  put("jp-subway-bench", 13, 11, { tag: "bench-m" });
  put("jp-subway-bench", 30, 11, { tag: "bench-e" });
  put("jp-subway-bench", 38, 11, { tag: "bench-ee" });
  m.groupLineL2("jp-tactile", [...line(24, 7, 24, 11), ...line(21, 11, 23, 11)]);   // 승강장 끝 점자 띠(6줄, 바닥 그림) → 계단 입구(21·22, 10) 앞 11줄
  const events = [21, 22].map((x) => transferEvent(`ev_up_${x}`, "콘코스로", x, 10, { mapId: CONCOURSE_ID, x: x - 9, y: 11, dir: "up" }));
  // 지하철: 서쪽 맵 밖에서 동쪽으로, 머리 x 38 에 서면 몸 x 9~38 이 승강장 앞에 선다. 경로 칸 번호 = 38 − (−36) = 74.
  const transit = { routes: [{ id: "subway-sakura-east", name: "地下鉄 さくら線", kind: "subway", path: [{ x: -36, y: 4 }, { x: W - 1 + 36, y: 4 }], vehicles: ["jp-subway"], headwaySec: 40, speed: 6,
    stops: [{ index: 74, name: "さくら町", waitSec: 12, board: { ...RIDE_TARGET } }] }] };
  const { report } = await m.finish({ id: PLATFORM_ID, name: "さくら町駅 · 승강장", start: [21, 11], file: "station-platform", bare: [], events, transit });
  console.log(JSON.stringify({ map: PLATFORM_ID, ok: report.ok, anchors: report.anchors, issues: report.layers?.issues, solidOpen: report.solid.open }));
  if (!report.ok) process.exitCode = 2;
}
