/**
 * 구운 타일셋(<run>/bake)을 엔진의 실제 통행·오토타일 코드로 시험한다 — 그림이 아니라 **움직임**이 맞는지.
 * 실행: npx tsx src/harnesses/tileset-authoring/node/verify.mts <bake 폴더>
 * 시나리오는 맵 하나에 집·나무·턱·고원·물·길·울타리를 찍고, 칸 사이 이동 가능 여부를 단언한다.
 * 한 건이라도 어긋나면 종료 코드 1.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canMove, ledgeDirectionAt } from "../../../project/collision";
import { shapeAllAutotileGroupsAround } from "../../../project/defaults/autotileEngine";
import { terrainTagAt } from "../../../project/terrainAt";

const dir = resolve(process.argv[2] ?? "");
const tileset = JSON.parse(readFileSync(`${dir}/tileset.json`, "utf8"));
const objects = JSON.parse(readFileSync(`${dir}/objects.json`, "utf8")) as any[];
const tiles = JSON.parse(readFileSync(`${dir}/../tiles.json`, "utf8"));
const id = (name: string): number => { const v = tiles.ids[name]; if (v === undefined) throw new Error(`칸 이름 없음: ${name}`); return v; };

const W = 48, H = 130;
const Y0 = 64;                                   // 건물 구역(0~63) 아래에 지형 시험 구역
const map: any = {
  id: "m", name: "m", width: W, height: H, tilesetId: tileset.id, tileSize: 16,
  lowerTiles: new Array(W * H).fill(id("grass0")), upperTiles: new Array(W * H).fill(-1), events: [],
};
const project: any = { tilesets: { [tileset.id]: tileset }, maps: { m: map }, database: { terrains: [] } };
const obj = (n: string) => objects.find((o) => o.name === n);

function stamp(o: any, x: number, y: number): void {
  for (let r = 0; r < o.height; r++) for (let c = 0; c < o.width; c++) {
    const i = (y + r) * W + x + c;
    if (o.rowsLower[r][c] >= 0) map.lowerTiles[i] = o.rowsLower[r][c];
    if (o.rowsUpper[r][c] >= 0) map.upperTiles[i] = o.rowsUpper[r][c];
  }
}
const groups = tileset.autotileGroups as any[];
const fails: string[] = [];
let checks = 0;
function expect(label: string, got: boolean, want: boolean): void {
  checks++;
  if (got !== want) fails.push(`${label}: 이동 ${got ? "가능" : "불가"} (기대 ${want ? "가능" : "불가"})`);
}
const mv = (x: number, y: number, tx: number, ty: number) => canMove(project, map, x, y, tx, ty);

// 건물: 모든 건물 종류를 한 줄씩 찍고 입구·벽·지붕을 시험한다
let bx = 1;
const buildings = objects.filter((o) => o.kind === "building");
let by = 1;
for (const b of buildings) {
  if (bx + b.width + 1 > W) { bx = 1; by += 8; }
  stamp(b, bx, by);
  const label = b.name;
  if (!b.entrance) { fails.push(`${label}: 입구(entrance) 정보가 없다`); bx += b.width + 1; continue; }
  const dx = bx + b.entrance.dx, dy = by + b.entrance.dy;
  expect(`${label} 입구 앞→입구`, mv(dx, dy + 1, dx, dy), true);
  const dw = b.entrance.w ?? 1;
  for (let c = 1; c < dw; c++) expect(`${label} 이중문 ${c}번째 문짝 칸 진입`, mv(dx + c, dy + 1, dx + c, dy), true);
  // 문짝 칸끼리 옆으로 건너지 못한다 — 한쪽 앞 칸을 막으면 그 문짝은 닫힌 것과 같다(지역 시트 door-blocked 오류 쌍)
  if (dw > 1) expect(`${label} 이중문 문짝 칸끼리 옆 이동`, mv(dx + 1, dy, dx, dy), false);
  expect(`${label} 입구→벽(위)`, dy - 1 >= by && mv(dx, dy, dx, dy - 1), false);
  // 입구가 아닌 맨 아랫줄 칸으로는 들어갈 수 없어야 한다(벽 아래쪽에서 올려 밀기)
  for (let c = 0; c < b.width; c++) {
    if (c >= b.entrance.dx && c < b.entrance.dx + (b.entrance.w ?? 1)) continue;
    const cell = (by + b.height - 1) * W + bx + c;
    if (map.upperTiles[cell] < 0 && tileset.passability[map.lowerTiles[cell]].up) continue;  // 비어 있는 칸(받침 땅)
    expect(`${label} 아랫줄 벽 ${c}번 칸 진입`, mv(bx + c, by + b.height, bx + c, by + b.height - 1), false);
  }
  // 지붕 위(북쪽)에서 내려오기
  expect(`${label} 지붕 윗면 진입`, mv(bx + 1, by - 1 < 0 ? 0 : by - 1, bx + 1, by), by === 0);
  bx += b.width + 1;
}

// 나무
const tree = obj("tree_a");
if (tree) {
  stamp(tree, 30, Y0 + 2);
  expect("나무 줄기 진입(아래→위)", mv(31, Y0 + 2 + tree.height, 31, Y0 + 2 + tree.height - 1), false);
  expect("나무 옆 풀밭 통행", mv(29, Y0 + 4, 29, Y0 + 3), true);
}

// 턱: 남쪽으로만
const ls = id("ledge_s_mid");
for (let x = 8; x < 14; x++) map.lowerTiles[(Y0 + 20) * W + x] = ls;
expect("턱 위→아래(뛰어내림)", mv(10, Y0 + 19, 10, Y0 + 20), true);
expect("턱 아래→위(막힘)", mv(10, Y0 + 21, 10, Y0 + 20), false);
expect("턱 옆으로(막힘)", mv(7, Y0 + 20, 8, Y0 + 20), false);
checks++; if (ledgeDirectionAt(tileset, map, 10, Y0 + 20) !== "down") fails.push("턱 방향이 down 이 아니다");

// 동·서 턱, 계단, 다리, 바위·덤불
for (const [nm, dir_, from, to] of [["ledge_e", "right", [5, 0], [6, 0]], ["ledge_w", "left", [6, 0], [5, 0]]] as const) {
  const x = 20, yy = Y0 + 10;
  map.lowerTiles[yy * W + x] = id(nm);
  expect(`${nm} 뛰어내리는 쪽`, dir_ === "right" ? mv(x - 1, yy, x, yy) : mv(x + 1, yy, x, yy), true);
  expect(`${nm} 반대쪽`, dir_ === "right" ? mv(x + 1, yy, x, yy) : mv(x - 1, yy, x, yy), false);
}
map.lowerTiles[(Y0 + 12) * W + 22] = id("stairs_v");
expect("계단 오르기", mv(22, Y0 + 13, 22, Y0 + 12), true);
map.lowerTiles[(Y0 + 14) * W + 24] = id("bridge_h");
expect("다리 건너기", mv(23, Y0 + 14, 24, Y0 + 14), true);
map.upperTiles[(Y0 + 16) * W + 24] = id("boulder0");
expect("바위 진입(막힘)", mv(23, Y0 + 16, 24, Y0 + 16), false);
map.upperTiles[(Y0 + 18) * W + 24] = id("bush0");
expect("덤불 진입(막힘)", mv(23, Y0 + 18, 24, Y0 + 18), false);
map.lowerTiles[(Y0 + 20) * W + 24] = id("flower_pink");
expect("꽃밭 통행", mv(23, Y0 + 20, 24, Y0 + 20), true);
map.upperTiles[(Y0 + 22) * W + 24] = id("mailbox");
expect("우편함 진입(막힘)", mv(23, Y0 + 22, 24, Y0 + 22), false);
// 숲 벽: 9조각 모든 칸은 막힘(솟은 수관 줄·줄기 줄 포함)
for (const o of objects.filter((q: any) => q.name.startsWith("forest_"))) {
  for (let r = 0; r < o.height; r++) for (let c = 0; c < o.width; c++) {
    const t = o.rowsLower[r][c] >= 0 ? o.rowsLower[r][c] : o.rowsUpper[r][c];
    checks++; if (t < 0 || Object.values(tileset.passability[t]).some(Boolean)) fails.push(`${o.name} ${c},${r} 칸이 막히지 않았다`);
  }
}

// 동굴: 벽 오토타일은 전부 막힘, 바닥·사다리·구멍은 통행, 부술 바위는 막힘
const cwall = groups.find((q) => q.id === "cave_wall");
if (!cwall) fails.push("cave_wall 오토타일 그룹이 없다");
else {
  const cp: { x: number; y: number }[] = [];
  const cy0 = Y0 + 40;
  for (let y = cy0; y < cy0 + 8; y++) for (let x = 2; x < 14; x++) { map.lowerTiles[y * W + x] = cwall.variantMap["255"]; cp.push({ x, y }); }
  for (let y = cy0 + 2; y < cy0 + 6; y++) for (let x = 4; x < 12; x++) { map.lowerTiles[y * W + x] = id("cave_floor0"); }
  shapeAllAutotileGroupsAround(map, groups, cp);
  expect("동굴 바닥 이동", mv(5, cy0 + 3, 6, cy0 + 3), true);
  expect("동굴 벽 진입(위)", mv(5, cy0 + 2, 5, cy0 + 1), false);
  expect("동굴 벽 진입(왼)", mv(4, cy0 + 3, 3, cy0 + 3), false);
  expect("동굴 벽 진입(아래)", mv(5, cy0 + 5, 5, cy0 + 6), false);
  const ce = tileset.tileMeta[map.lowerTiles[(cy0 + 1) * W + 5]];
  checks++; if (ce.terrainTag !== 4) fails.push("동굴 벽 지형 태그가 4(돌)가 아니다");
  // 벽 아랫줄(남쪽이 열린 변)은 앞면 그림이어야 한다: 같은 칸이 완전한 속 칸(255)과 달라야 한다
  checks++; if (map.lowerTiles[(cy0 + 1) * W + 5] === cwall.variantMap["255"]) fails.push("남쪽이 열린 벽 칸이 앞면 변형으로 바뀌지 않았다");
  map.lowerTiles[(cy0 + 3) * W + 6] = id("hole_down");
  map.lowerTiles[(cy0 + 3) * W + 8] = id("ladder_up");
  map.lowerTiles[(cy0 + 4) * W + 6] = id("cracked_rock");
  expect("구멍 칸 진입", mv(5, cy0 + 3, 6, cy0 + 3), true);
  expect("사다리 칸 진입", mv(7, cy0 + 3, 8, cy0 + 3), true);
  expect("부술 바위 진입", mv(5, cy0 + 4, 6, cy0 + 4), false);
}
const mouth = obj("cave_mouth");
if (!mouth || !mouth.entrance) fails.push("cave_mouth 입구 정보가 없다");
else {
  stamp(mouth, 40, Y0 + 30);
  const dx = 40 + mouth.entrance.dx, dy = Y0 + 30 + mouth.entrance.dy;
  expect("동굴 입구 앞→입구", mv(dx, dy + 1, dx, dy), true);
  expect("동굴 언덕 옆 진입 막힘", mv(40, dy + 1, 40, dy), false);
}

// 고원(바위 고리): 오토타일 엔진으로 모양을 맞춘다
const plateau = groups.find((g) => g.id === "plateau"), water = groups.find((g) => g.id === "water");
const pFull = plateau.variantMap["255"], wFull = water.variantMap["255"];
const pts: { x: number; y: number }[] = [];
for (let y = Y0 + 22; y < Y0 + 27; y++) for (let x = 2; x < 9; x++) { map.lowerTiles[y * W + x] = pFull; pts.push({ x, y }); }
shapeAllAutotileGroupsAround(map, groups, pts);
expect("고원 밖→왼쪽 고리", mv(1, Y0 + 24, 2, Y0 + 24), false);
expect("고원 안쪽 이동", mv(5, Y0 + 24, 6, Y0 + 24), true);
expect("고원 가장자리 밖으로 나가기(왼쪽)", mv(2, Y0 + 24, 1, Y0 + 24), false);
expect("고원 위쪽 고리 넘기", mv(5, Y0 + 21, 5, Y0 + 22), false);
expect("고원 안→왼쪽 고리 칸(안쪽에서 닿기)", mv(3, Y0 + 24, 2, Y0 + 24), true);
// 고원 앞면(gface): 사방 막힘 — 사람이 바위 앞면 그림 위에 서지 않는다(L9 N80)
map.lowerTiles[(Y0 + 28) * W + 2] = groups.find((g) => g.id === "gface").variantMap["255"];
expect("고원 앞면 진입(옆에서)", mv(1, Y0 + 28, 2, Y0 + 28), false);
expect("고원 앞면 진입(아래서)", mv(2, Y0 + 29, 2, Y0 + 28), false);
map.lowerTiles[(Y0 + 28) * W + 2] = id("grass0");

// 물
const wpts: { x: number; y: number }[] = [];
for (let y = Y0 + 22; y < Y0 + 27; y++) for (let x = 20; x < 27; x++) { map.lowerTiles[y * W + x] = wFull; wpts.push({ x, y }); }
shapeAllAutotileGroupsAround(map, groups, wpts);
expect("물가→물", mv(19, Y0 + 24, 20, Y0 + 24), false);
expect("물 속 이동", mv(23, Y0 + 24, 24, Y0 + 24), false);
checks++; if (terrainTagAt(project, { mapId: "m", x: 23, y: Y0 + 24 }) !== 1) fails.push("물 칸 지형 태그가 1(물)이 아니다");

// 길: 막히지 않는다
const path = groups.find((g) => g.id === "path");
const sFull = path.variantMap["255"];
const ppts: { x: number; y: number }[] = [];
for (let y = Y0 + 22; y < Y0 + 24; y++) for (let x = 12; x < 18; x++) { map.lowerTiles[y * W + x] = sFull; ppts.push({ x, y }); }
shapeAllAutotileGroupsAround(map, groups, ppts);
for (let x = 12; x < 17; x++) expect(`길 ${x}→${x + 1}`, mv(x, Y0 + 22, x + 1, Y0 + 22), true);
expect("길→풀밭", mv(12, Y0 + 22, 11, Y0 + 22), true);

// 키 큰 풀: 걷되 지형 태그 5
map.lowerTiles[(Y0 + 28) * W + 5] = id("tall0");
expect("키 큰 풀 진입", mv(4, Y0 + 28, 5, Y0 + 28), true);
checks++; if (terrainTagAt(project, { mapId: "m", x: 5, y: Y0 + 28 }) !== 5) fails.push("키 큰 풀 지형 태그가 5가 아니다");

// 울타리(위층에 두고 풀이 받친다)
const fm = tileset.tileMeta[id("fence_at0")];
checks++; if (fm.layerBacking !== id("grass0") || fm.defaultLayer !== "upper") fails.push("울타리 메타에 받침 풀/위층 지정이 없다");
map.upperTiles[(Y0 + 28) * W + 10] = id("fence_at0");
expect("울타리 진입", mv(9, Y0 + 28, 10, Y0 + 28), false);


// 실내: 바닥은 걷고, 벽·가구·전기 문·칸막이는 막고, 매트·회전/정지/워프/스위치/구멍 칸은 밟을 수 있다(이벤트를 올릴 자리)
{
  const Z = Y0 + 36;
  const row = (x: number, n: string) => { map.lowerTiles[Z * W + x] = id(n); };
  const walk = ["i2_fl_center0", "i2_fl_mart0", "i2_fl_house0", "i2_fl_center_s", "i2_mat_center", "g2_fl_teal0", "g2_fl_yel0", "g2_fl_dirt0", "g2_fl_plank0", "g2_mat_teal", "g2_spin_u", "g2_spin_stop", "g2_spin_u_s", "g2_pit", "g2_switch", "g2_fl_teal_e", "g2_fl_yel_se"];
  const shut = ["i2_edge_v", "i2_edge_t", "i2_wall_center_up", "i2_wall_house_dn_l", "g2_wall_teal_up", "g2_wall_rock_dn", "g2_plank_edge"];
  walk.forEach((n, i) => { row(2 * i + 1, n); row(2 * i, "i2_fl_house0"); });
  walk.forEach((n, i) => expect(`실내 ${n} 진입`, mv(2 * i, Z, 2 * i + 1, Z), true));
  shut.forEach((n, i) => { map.lowerTiles[(Z + 2) * W + 2 * i + 1] = id(n); map.lowerTiles[(Z + 2) * W + 2 * i] = id("i2_fl_house0"); });
  shut.forEach((n, i) => expect(`실내 ${n} 막힘`, mv(2 * i, Z + 2, 2 * i + 1, Z + 2), false));
  for (const grp of ["pb_teal", "pb_elec", "pb_rock"]) {
    const full = groups.find((g) => g.id === grp).variantMap["255"];
    map.lowerTiles[(Z + 4) * W + 3] = full; map.lowerTiles[(Z + 4) * W + 2] = id("g2_fl_teal0");
    expect(`${grp} 칸막이 막힘`, mv(2, Z + 4, 3, Z + 4), false);
  }
  for (const [n, want] of [["g2_arc0", false], ["g2_boulder0", false], ["cuttree", false], ["bush0", false]] as [string, boolean][]) {
    map.lowerTiles[(Z + 4) * W + 5] = id("g2_fl_teal0"); map.upperTiles[(Z + 4) * W + 5] = id(n);
    map.lowerTiles[(Z + 4) * W + 4] = id("g2_fl_teal0"); map.upperTiles[(Z + 4) * W + 4] = -1;
    expect(`${n} ${want ? "밟음" : "막힘"}`, mv(4, Z + 4, 5, Z + 4), want);
    map.upperTiles[(Z + 4) * W + 5] = -1;
  }
  for (const o of ["c_counter", "c_healer", "c_pc", "c_table", "m_gondola", "m_counter", "m_freezer", "h_kitchen", "h_table", "h_tv", "h_stairs", "g_statue", "g_pylon", "g_pylon_off", "g_bigrock"]) {
    const ob = obj(o); stamp(ob, 6, Z + 6 - 0);
    const ox = 6, oy = Z + 6;
    // 가구 한 칸 가운데(투명 아닌 칸) 막힘: 위층/아래층 중 하나가 막혀 있어야 한다
    let blocked = false;
    for (let r = 0; r < ob.height; r++) for (let c = 0; c < ob.width; c++) { if (!mv(ox + c - 1, oy + r, ox + c, oy + r)) blocked = true; }
    checks++; if (!blocked) fails.push(`가구 ${o}: 어느 칸으로도 막히지 않는다`);
    for (let r = 0; r < ob.height; r++) for (let c = 0; c < ob.width; c++) { const i = (oy + r) * W + ox + c; map.lowerTiles[i] = id("grass0"); map.upperTiles[i] = -1; }
  }
  const rg = obj("h_rug"); stamp(rg, 6, Z + 6);
  expect("깔개 위를 걷는다", mv(5, Z + 6, 6, Z + 6), true);
  for (let i = 0; i < 8 * 8; i++) { const yy = Z + 6 + (i >> 3), xx = 6 + (i & 7); map.lowerTiles[yy * W + xx] = id("grass0"); map.upperTiles[yy * W + xx] = -1; }
  const em = obj("c_emblem"); stamp(em, 6, Z + 6);
  for (const d of ["g_leader_mat", "g_dais", "g_edais"]) { const o = obj(d); stamp(o, 6, Z + 10); map.lowerTiles[(Z + 11) * W + 5] = id("g2_fl_teal0"); map.upperTiles[(Z + 11) * W + 5] = -1; expect(`${d} 위를 걷는다`, mv(5, Z + 11, 6, Z + 11), true); }
  expect("바닥 문양 위를 걷는다", mv(5, Z + 7, 6, Z + 7), true);
}

writeFileSync(`${dir}/verify-map.json`, JSON.stringify({ width: W, height: H, lower: map.lowerTiles, upper: map.upperTiles }));
console.log(`통행 시험 ${checks}건 — 실패 ${fails.length}건`);
for (const f of fails) console.log("X", f);
process.exit(fails.length ? 1 : 0);
