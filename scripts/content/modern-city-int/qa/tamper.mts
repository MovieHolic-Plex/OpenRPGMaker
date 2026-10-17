// modern_city 실내 — 사무실 예제 평면을 실제로 변조해 엔진 조립기(buildHandInteriorLayers, modern_city 사양)가 이름 붙은 오류 코드와 좌표로 잡는지 본다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/tamper.mts OUT.json
import { readFileSync, writeFileSync } from "node:fs";
import { buildHandInteriorLayers, MODERN_CITY_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { createModernCityTileset } from "@/project/defaults/modernCity";
type O = { id: string; x: number; y: number };
const ex = JSON.parse(readFileSync("tiledata/modern-city/interior/examples/office-floor.json", "utf8"));
const ts = createModernCityTileset();
const move = (objs: O[], id: string, x: number, y: number, nx: number, ny: number) => objs.map((o) => (o.id === id && o.x === x && o.y === y ? { ...o, x: nx, y: ny } : o));
const TAMPERS: { id: string; why: string; edit: (e: typeof ex) => typeof ex; expect: string }[] = [
  { id: "door-moved", why: "회의실 문 mci-door-wood 를 칸막이 틈 (13,7) 에서 한 칸 오른쪽 (14,7) 막힌 칸으로", expect: "door-not-in-gap", edit: (e) => ({ ...e, objects: move(e.objects, "mci-door-wood", 13, 7, 14, 7) }) },
  { id: "overlap", why: "책상 (1,6) 위에 화분 mci-plant-tall 을 하나 더", expect: "overlap", edit: (e) => ({ ...e, objects: [...e.objects, { id: "mci-plant-tall", x: 1, y: 6 }] }) },
  { id: "hang-on-floor", why: "벽시계 mci-wall-clock 을 벽면 윗줄 (8,1) 에서 바닥 (8,4) 으로", expect: "hang-not-on-face", edit: (e) => ({ ...e, objects: move(e.objects, "mci-wall-clock", 8, 1, 8, 4) }) },
  { id: "wall-piece-mid", why: "벽 책장 mci-shelf-office 를 북쪽 벽 앞 (1,3) 에서 방 가운데 (13,11) 로", expect: "wall-piece-needs-face", edit: (e) => ({ ...e, objects: move(e.objects, "mci-shelf-office", 1, 3, 13, 11) }) },
  { id: "goods-floor", why: "커피잔 mci-g-coffee 를 회의 탁자 윗면 (16,5) 에서 맨바닥 (9,11) 으로", expect: "goods-needs-surface", edit: (e) => ({ ...e, goods: e.goods.map((g: O) => (g.id === "mci-g-coffee" ? { ...g, x: 9, y: 11 } : g)) }) },
  { id: "exit-blocked", why: "출구 바로 위 (8,12)~(9,12) 에 서류장 mci-filing(2칸)", expect: "no-entrance|unreached-floor", edit: (e) => ({ ...e, objects: [...e.objects, { id: "mci-filing", x: 8, y: 12 }] }) },
];
const run = (e: typeof ex) => {
  const r = buildHandInteriorLayers({ plan: e.plan, floor: e.floor, wall: e.wall, zones: e.zones, objects: e.objects, tables: e.tables, goods: e.goods, exitWidth: e.exitWidth, start: [{ x: e.start[0], y: e.start[1] }] }, ts, MODERN_CITY_INTERIOR_SPEC);
  return { width: r.width, height: r.height, lower: r.lowerTiles, lower2: r.lowerOverlayTiles, upper: r.upperTiles, upper2: r.upperOverlayTiles, issues: r.issues.map((i) => ({ severity: i.severity, code: i.code, x: i.x, y: i.y, message: i.message })) };
};
const normal = run(ex);
const out = { normal: { ...normal }, tampers: TAMPERS.map((t) => { const e = t.edit(structuredClone(ex)); const r = run(e); const hit = r.issues.filter((i) => new RegExp(`^(${t.expect})$`).test(i.code)); return { id: t.id, why: t.why, expect: t.expect, detected: hit.length > 0, hits: hit, all: r.issues.map((i) => i.code), input: { objects: e.objects, goods: e.goods }, map: { width: r.width, height: r.height, lower: r.lower, lower2: r.lower2, upper: r.upper, upper2: r.upper2 } }; }) };
writeFileSync(process.argv[2]!, JSON.stringify(out));
console.log(`정상: 문제 ${normal.issues.length}`);
for (const t of out.tampers) console.log(`${t.detected ? "잡음" : "놓침"} ${t.id}: ${t.hits.map((h) => `${h.code}@(${h.x ?? "-"},${h.y ?? "-"})`).join(" ") || t.all.join(",")}`);
process.exitCode = out.tampers.filter((t) => !t.detected).length + normal.issues.filter((i) => i.severity === "error").length;
