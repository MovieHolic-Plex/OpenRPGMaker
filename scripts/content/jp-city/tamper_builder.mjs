#!/usr/bin/env node
// jp_city 건물 조립기·도구 변조 시험 — 일부러 틀린 입력이 정확한 오류 코드·좌표로 거부되는지, 그리고 정상 입력이 통과하는지 확인한다.
//
//   node scripts/content/jp-city/tamper_builder.mjs
//
// 1부 조립기(순수 함수): 변조 입력 → 기대 코드·좌표(맵 좌표, 발 = (x,y)). 2부 도구(build_jp_city_building): 실제 jp_city 맵에서
// 정상 건물이 지어지고, 오류 입력은 맵을 한 칸도 바꾸지 않고 거부되며, 지은 뒤 엔진 통행(isPassable)으로 문 앞이 이어지는지.
// 종료 코드: 기대와 다른 결과가 하나라도 있으면 1.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
if (!process.env.JP_TAMPER_UNDER_TSX) {
  const r = spawnSync("npx", ["--no-install", "tsx", fileURLToPath(import.meta.url)], { stdio: "inherit", cwd: ROOT, env: { ...process.env, JP_TAMPER_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const B = await imp("src/editor/jpCity/builder.ts");
const { buildJpCityBuilding, checkJpCityStructure, jpCityBandMeta, JP_CITY_BUILDING_SPEC: SPEC } = B;

let fail = 0;
const rows = [];
const base = { x: 6, y: 14, w: 6, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.konbini.0", roof: "roof.ac.tank", door: { type: "auto", col: 2 } };
const open = { width: 30, height: 20, passable: () => true };
const first = (res) => res.issues.filter((i) => i.severity === "error");
function expectErr(name, res, want) {
  const errs = first(res); const got = errs.map((e) => `${e.code}@(${e.x},${e.y})`);
  const ok = want.length === got.length && want.every((w) => got.includes(w));
  rows.push({ 변조: name, 기대: want.join(" ") || "(오류 없음)", 실제: got.join(" ") || "(오류 없음)", 결과: ok ? "OK" : "FAIL" });
  if (!ok) fail++;
}

// ───────── 0. 정상 입력은 오류가 없어야 한다(변조 시험의 대조군)
expectErr("대조군: 정상 6×(윗층3) 편의점", buildJpCityBuilding(base, { world: open }), []);
const ctl = buildJpCityBuilding(base, { world: open });
console.log(`대조군: 사각형 ${JSON.stringify(ctl.rect)}, 문 ${JSON.stringify(ctl.doors)}, 접근칸 ${JSON.stringify(ctl.access)}, 칸 ${ctl.placements.length}개`);

// ───────── 1. 조립기 변조
expectErr("문 없음(door.type none)", buildJpCityBuilding({ ...base, door: { type: "none" } }), ["NO_DOOR@(6,14)"]);
expectErr("문 null", buildJpCityBuilding({ ...base, door: null }), ["NO_DOOR@(6,14)"]);
expectErr("너무 좁음 w=2", buildJpCityBuilding({ ...base, w: 2, door: undefined }), ["TOO_NARROW@(6,14)"]);
expectErr("셋백이 너무 커서 윗층 폭이 3칸 미만(w=6, ins=2)", buildJpCityBuilding({ ...base, w: 6, setback: { upper: 1, ins: 2 } }), ["TOO_NARROW@(6,14)"]);
expectErr("문 열이 건물 밖(col 5, 폭2)", buildJpCityBuilding({ ...base, door: { type: "auto", col: 5 } }), ["DOOR_OUT_OF_RANGE@(6,14)"]);
expectErr("층 쌍 깨짐: 층 자리에 1줄 띠(terrace)", buildJpCityBuilding({ ...base, floors: [{ band: "terrace" }] }), ["FLOOR_PAIR@(6,14)"]);
expectErr("층 쌍 깨짐: 층 자리에 지붕 띠", buildJpCityBuilding({ ...base, floors: [{ band: "roof.plain.plain" }] }), ["FLOOR_PAIR@(6,14)"]);
expectErr("지붕 자리에 1층 띠", buildJpCityBuilding({ ...base, roof: "gr.izakaya" }), ["ROOF_ORDER@(6,14)"]);
expectErr("지붕 없음", buildJpCityBuilding({ ...base, roof: undefined }), ["ROOF_ORDER@(6,14)"]);
expectErr("처마 자리에 지붕 띠", buildJpCityBuilding({ ...base, eave: "roof.tile" }), ["ROOF_ORDER@(6,14)"]);
expectErr("옥상 간판 자리에 일반 지붕", buildJpCityBuilding({ ...base, head: "roof.plain.plain" }), ["ROOF_ORDER@(6,14)"]);
expectErr("모르는 1층 종류", buildJpCityBuilding({ ...base, ground: "gr.nope" }), ["UNKNOWN_PART@(6,14)"]);
expectErr("모르는 벽 재질(pairs 에 wall 'pink')", buildJpCityBuilding({ ...base, floors: [{ kind: "pairs", wall: "pink" }] }), ["UNKNOWN_PART@(6,14)"]);
expectErr("모르는 몸통 변형(pairs 변형 9)", buildJpCityBuilding({ ...base, floors: [{ kind: "pairs", variants: [9] }] }), ["UNKNOWN_PART@(6,14)"]);
expectErr("모르는 부착물", buildJpCityBuilding({ ...base, decos: [{ deco: "sign_h.nope", col: 1, floor: 0 }] }), ["UNKNOWN_PART@(7,14)"]);
expectErr("모르는 문 종류", buildJpCityBuilding({ ...base, door: { type: "gate" } }), ["UNKNOWN_PART@(6,14)"]);
expectErr("부착물이 없는 층을 가리킴(층 5)", buildJpCityBuilding({ ...base, decos: [{ deco: "pipe", col: 5, floor: 5 }] }), ["DECO_OUT_OF_RANGE@(11,14)"]);
// 데코 충돌: 첫 줄 1열 sign_h.aka(2×2) 를 쌍창(pairs) 층 창 위에 얹는다. 건물 높이는 R 줄이라 발 y=14 → 사각형 맨 위 행 = 14-R+1
const rect = ctl.rect;
const win = buildJpCityBuilding({ ...base, decos: [{ deco: "sign_h.aka", col: 1, floor: 0 }] }, { world: open });
expectErr("부착물이 창을 가림(sign_h 를 쌍창 층에; 좌표 = 부착물 첫 칸)", win, [`DECO_CLASH@(7,${rect.y0 + 2})`]);
// 부착물끼리 겹침: 같은 자리에 fe 와 pipe(둘 다 첫 윗층)
const ov = buildJpCityBuilding({ ...base, floors: 3, floorKind: "blank", decos: [{ deco: "pipe", col: 3, floor: 0 }, { deco: "ac.0", col: 3, floor: 0 }] }, { world: open });
expectErr("부착물끼리 같은 칸(pipe + ac.0)", ov, ov.issues.filter((i) => i.severity === "error").map((i) => `${i.code}@(${i.x},${i.y})`).length ? ov.issues.filter((i) => i.severity === "error").map((i) => `${i.code}@(${i.x},${i.y})`) : ["DECO_CLASH@(?,?)"]);
// 문 막힘
expectErr("문 앞 접근칸이 막힘(걸을 수 없는 바닥)", buildJpCityBuilding(base, { world: { ...open, passable: (x, y) => !(x === 8 && y === 15) } }), ["DOOR_BLOCKED@(8,15)", "DOOR_BLOCKED@(9,15)"].slice(0, 1));
expectErr("문 앞이 맵 밖(건물 발이 맵 맨 아래 줄)", buildJpCityBuilding({ ...base, y: 19 }, { world: open }), ["DOOR_BLOCKED@(8,20)", "DOOR_BLOCKED@(9,20)"]);
expectErr("문 앞이 막힌 우물(접근칸은 열렸으나 이어진 칸 < 6)", buildJpCityBuilding(base, { world: { ...open, passable: (x, y) => (x === 8 && y === 15) || (x === 9 && y === 15) } }), ["DOOR_BLOCKED@(8,15)", "DOOR_BLOCKED@(9,15)"]);
expectErr("맵 밖으로 나가는 건물(x=27, 폭6 → 열 32)", buildJpCityBuilding({ ...base, x: 27 }, { world: open }), ["OUT_OF_MAP@(27,14)", "DOOR_BLOCKED@(30,15)"]);
// L자
const L = { ...base, w: 7, door: undefined, ground: "gr.shutter.sora", wing: { w: 4, ground: "gr.glass.kii", roof: "roof.plain.plain", door: { type: "cafe", col: 1 }, side: "L", depth: 2 } };
expectErr("L자 정상(별채 폭4, 본채 7, 본채 문 기본 위치 열 5)", buildJpCityBuilding({ ...L, y: 15 }, { world: open }), []);
expectErr("L자 본채 문(열 3)이 별채(열 0~3)에 가려짐", buildJpCityBuilding({ ...L, y: 15, door: { type: "steel", col: 3 } }, { world: open }), ["DOOR_BLOCKED@(9,13)", "DOOR_BLOCKED@(9,14)"]);
expectErr("L자 별채가 본채 문을 덮음(별채 폭 6 > 7-2)", buildJpCityBuilding({ ...L, y: 15, wing: { ...L.wing, w: 6 } }), ["TOO_NARROW@(6,15)"]);
expectErr("L자 별채 문 없음", buildJpCityBuilding({ ...L, y: 15, wing: { ...L.wing, door: null } }), ["NO_DOOR@(6,15)"]);

// ───────── 2. 구조 검사(조립 결과를 직접 손상) — 입력으로는 못 만드는 DOOR_NOT_BOTTOM·깨진 층 쌍
const okRes = buildJpCityBuilding(base, { world: open });
const meta = jpCityBandMeta(base);
const clone = () => structuredClone(okRes.assembled);
{ const a = clone(); const fl = meta.find((m) => m.bid.startsWith("fl.")); a.cells[fl.r0 + 1][a.n - 1] = null;
  const got = checkJpCityStructure(a, meta).map((i) => `${i.code}@(${i.x},${i.y})`);
  const want = [`FLOOR_PAIR@(${a.n - 1},${fl.r0 + 1})`];
  rows.push({ 변조: "조립 결과 손상: 층 띠 아랫줄 오른쪽 끝 칸을 비움", 기대: want.join(" "), 실제: got.join(" ") || "(없음)", 결과: got.join() === want.join() ? "OK" : "FAIL" }); if (got.join() !== want.join()) fail++; }
{ const a = clone(); a.doors = [[2, 3]];
  const got = checkJpCityStructure(a, meta).map((i) => `${i.code}@(${i.x},${i.y})`); const want = ["DOOR_NOT_BOTTOM@(3,2)"];
  rows.push({ 변조: "조립 결과 손상: 문 칸을 윗층(행 2)으로", 기대: want.join(" "), 실제: got.join(" ") || "(없음)", 결과: got.join() === want.join() ? "OK" : "FAIL" }); if (got.join() !== want.join()) fail++; }
{ const a = clone(); a.doors = [];
  const got = checkJpCityStructure(a, meta).map((i) => `${i.code}@(${i.x},${i.y})`); const want = ["NO_DOOR@(0,0)"];
  rows.push({ 변조: "조립 결과 손상: 문 칸 목록 비움", 기대: want.join(" "), 실제: got.join(" ") || "(없음)", 결과: got.join() === want.join() ? "OK" : "FAIL" }); if (got.join() !== want.join()) fail++; }
{ const bad = [...meta]; const t = bad[0]; bad[0] = bad[1]; bad[1] = t;   // 지붕 띠와 첫 층 띠 자리를 바꿈
  const got = checkJpCityStructure(okRes.assembled, bad).map((i) => `${i.code}@(${i.x},${i.y})`);
  const ok = got.includes("ROOF_ORDER@(0,0)");
  rows.push({ 변조: "조립 결과 손상: 지붕 띠와 첫 층 띠 순서를 바꿈", 기대: "ROOF_ORDER@(0,0) 포함", 실제: got.join(" ") || "(없음)", 결과: ok ? "OK" : "FAIL" }); if (!ok) fail++; }

console.log("\n[1·2부] 조립기 변조 시험");
console.table(rows);

// ───────── 3. 도구(build_jp_city_building) — 실제 jp_city 맵
const tools = await imp("src/editor/tools/jpCityTools.ts");
const { createEmptyToolProject } = await imp("src/editor/tools/emptyProject.ts");
const { createJpCityTileset } = await imp("src/project/defaults/jpCity.ts");
const { isPassable } = await imp("src/project/collision.ts");
const T = tools.BUILD_JP_CITY_BUILDING_TOOL;
const toolRows = [];
function mkProject() {
  const p = createEmptyToolProject("jp-tamper");
  p.tilesets.jp_city = createJpCityTileset();
  const W = 30, H = 24, sw = SPEC.street.sw, road = SPEC.street.road_c, water = SPEC.street.water;
  const mk = (id, ts) => ({ id, name: id, width: W, height: H, tilesetId: ts, tileSize: 16, lowerTiles: new Array(W * H).fill(ts === "jp_city" ? sw : 0), upperTiles: new Array(W * H).fill(-1), events: [] });
  p.maps.m1 = mk("m1", "jp_city");
  for (let x = 0; x < W; x++) for (let y = 18; y < H; y++) p.maps.m1.lowerTiles[y * W + x] = road;      // 아래쪽은 도로
  p.maps.other = mk("other", Object.keys(p.tilesets).find((k) => k !== "jp_city"));
  p.maps.other.tilesetId = Object.keys(p.tilesets).find((k) => k !== "jp_city");
  p.maps.m1.lowerTiles[16 * W + 8] = water; p.maps.m1.lowerTiles[16 * W + 9] = water;                  // 문 앞 접근칸 아래를 물로 막을 자리(시험 4 에서 사용)
  return p;
}
const snap = (m) => JSON.stringify([m.lowerTiles, m.upperTiles, m.lowerOverlayTiles, m.upperOverlayTiles]);
function runTool(name, args, mutate) {
  const p = mkProject(); if (mutate) mutate(p);
  const mm = () => p.maps[args.mapId ?? "m1"];
  const before = mm() ? snap(mm()) : "";
  let status = "OK", msg = "", code = "";
  try { const r = T.run(p, args); msg = r.summary; } catch (e) { status = "거부"; msg = e.message; code = e.code ?? ""; }
  const changed = (mm() ? snap(mm()) : "") !== before;
  return { p, status, msg, code, changed };
}
const good = { mapId: "m1", x: 4, y: 12, w: 6, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.konbini.0", roof: "roof.ac.tank", door: { type: "auto", col: 2 } };
function record(name, r, expectStatus, expectCode, expectChanged) {
  const ok = r.status === expectStatus && (expectCode === "" || r.code === expectCode) && r.changed === expectChanged;
  toolRows.push({ 시험: name, 기대: `${expectStatus}${expectCode ? " " + expectCode : ""}${expectChanged ? " 맵변경" : " 맵불변"}`, 실제: `${r.status}${r.code ? " " + r.code : ""}${r.changed ? " 맵변경" : " 맵불변"}`, 결과: ok ? "OK" : "FAIL", 메시지: r.msg.slice(0, 110) });
  if (!ok) fail++;
}
const g = runTool("good", good);
record("정상: 보도 위 편의점 6칸×윗층3", g, "OK", "", true);
{ // 지은 뒤: 다시 읽어 문 앞 접근칸이 엔진 통행으로 이어지고 막힘 칸이 막혀 있는가
  const m = g.p.maps.m1; const W = m.width; const res = buildJpCityBuilding(good, { world: { width: m.width, height: m.height, passable: () => true } });
  const acc = res.access.every((a) => isPassable(g.p, m, a.x, a.y));
  const solidOk = res.solid.every((row, r) => row.every((s, c) => !s || !isPassable(g.p, m, res.rect.x0 + c, res.rect.y0 + r)));
  const upper = m.upperTiles.filter((t) => t >= 0).length;
  toolRows.push({ 시험: "정상 건물 저장 후 다시 읽기", 기대: "접근칸 통행·막힘 칸 막힘", 실제: `접근칸 통행 ${acc} · 막힘 칸 막힘 ${solidOk} · 위층 칸 ${upper}`, 결과: acc && solidOk && upper > 0 ? "OK" : "FAIL", 메시지: `사각형 ${JSON.stringify(res.rect)} W=${W}` });
  if (!(acc && solidOk && upper > 0)) fail++;
}
record("다른 칩셋 맵(jp_city 아님)", runTool("other", { ...good, mapId: "other" }), "거부", "tileset-family-mismatch", false);
record("없는 맵", runTool("nomap", { ...good, mapId: "zzz" }), "거부", "map-not-found", false);
record("문 없음(door.type none)", runTool("nodoor", { ...good, door: { type: "none" } }), "거부", "NO_DOOR", false);
record("너무 좁음 w=2", runTool("narrow", { ...good, w: 2 }), "거부", "TOO_NARROW", false);
record("문 앞이 물(접근칸 (6,13) 아래 아님 — 접근칸 자체를 물로)", runTool("water", { ...good, x: 8, y: 15 }, (p) => { p.maps.m1.lowerTiles[16 * 30 + 10] = SPEC.street.water; p.maps.m1.lowerTiles[16 * 30 + 11] = SPEC.street.water; p.maps.m1.lowerTiles[16 * 30 + 9] = SPEC.street.water; }), "거부", "DOOR_BLOCKED", false);
record("건물이 맵 위로 나감(y=3, 높이>4)", runTool("top", { ...good, y: 3 }), "거부", "OUT_OF_MAP", false);
record("부착물이 창을 가림", runTool("clash", { ...good, decos: [{ deco: "sign_h.aka", col: 1, floor: "0" }] }), "거부", "DECO_CLASH", false);
record("모르는 부품", runTool("unk", { ...good, ground: "gr.nope" }), "거부", "UNKNOWN_PART", false);
console.log("\n[3부] 도구 시험(실제 jp_city 맵, 오류면 맵 불변)");
console.table(toolRows);
console.log(fail ? `\n실패 ${fail}건` : `\n변조 시험 전부 통과: 조립기 ${rows.length}건 + 도구 ${toolRows.length}건`);
process.exit(fail ? 1 : 0);
