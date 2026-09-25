// 유령선(갑판·선실·선창·밑바닥 4칸)과 유령 저택(현관홀·2층 복도·서재·다락·지하실 5칸).
// Ghost ship: the ghostship repaint (cabin wall face 21~23/51~53 from the ship sheet, deck planks 14/13/12 on 187/108/109,
// holed deck as the chasm, dark bilge water) with the ghost-tinted ship parts. The open deck has no wall face (wall: []):
// the dark hold rim is the hull edge. Haunted manor: the manor repaint (faded wallpaper face, plank floor 102, patterned
// slabs 163 on q, the interior carpet on r) with the manor-tinted furniture; the cellar keeps the teal stone and wet 111.
import { grid, series, row, col, dining } from "./lib.mjs";

const ship = series({ tileset: "oprn_dungeon_ghostship", theme: "stone", series: "ghostship", seriesName: "유령선 검은 돛 호", env: "건물 내부", dress: false, groves: 0, heaps: 0 });
const manor = series({ tileset: "oprn_dungeon_manor", theme: "stone", series: "manor", seriesName: "유령 저택", env: "건물 내부", dress: false, groves: 0, heaps: 0 });

export function ghostPlans() {
  return [shipDeck(), shipCabins(), shipHold(), shipBilge(), manorHall(), manorCorridor(), manorLibrary(), manorAttic(), manorCellar()];
}

// ── 유령선 ──────────────────────────────────────────────────────────────────────────────────────────────────────
function hull(ch) {
  // a ship pointing east: stern 1..2, main deck 3..30, bow taper to 37
  return [[ch, 1, 6, 2, 15], [ch, 3, 5, 30, 16], [ch, 31, 6, 33, 15], [ch, 34, 7, 35, 14], [ch, 36, 9, 37, 12]];
}

function shipDeck() {
  const W = 40, H = 22;
  const shrouds = (x) => [["ghost:rigging", x - 1, 5], ["ghost:rigging", x, 5], ["ghost:rigging", x + 1, 5], ["ghost:rigging", x - 1, 16], ["ghost:rigging", x, 16], ["ghost:rigging", x + 1, 16]];
  return ship({
    id: "atlas-ghost-deck", name: "유령선 검은 돛 호 · 부서진 갑판", room: "통로", purpose: "탐험", wall: [], placeKind: "vehicle", env: "실외",
    art: grid(W, H, [
      ...hull("."),
      ["q", 1, 6, 2, 15], ["q", 3, 5, 9, 16], // 뒷갑판(한 층 높은 널)
      ["q", 26, 5, 30, 16], ["q", 31, 6, 33, 15], ["q", 34, 7, 35, 14], ["q", 36, 9, 37, 12], // 앞갑판
      ["q", 10, 5, 25, 6], ["q", 10, 15, 25, 16], // 뱃전을 따라 세로 널을 댄 포갑판
      ["k", 13, 9, 22, 10], // 갑판실 앞 회색 널
      ["c", 21, 12, 23, 14, { blob: 303, wobble: 0.3 }], // 썩어 뚫린 갑판
    ]),
    props: [
      // 뒷갑판: 조타륜·깃발·선장의 짐
      ["ghost:wheel", 6, 10], ["ghost:wheel-side", 6, 11], ["ghost:flag", 1, 10], ["ghost:barrel", 3, 6], ["ghost:barrel", 4, 6], ["ghost:barrel-open", 3, 7],
      ["ghost:crate", 3, 15], ["ghost:crate", 4, 15], ["ghost:jug", 3, 14], ["ghost:skull", 7, 14], ["ghost:swords", 7, 6], ["ghost:lamp", 2, 12],
      ...[5, 7, 13, 15].map((y) => ["ghost:rail-v", 9, y]), ...[5, 7, 13, 15].map((y) => ["ghost:rail-v", 26, y]), // 두 갑판 난간(가운데 틈이 계단)
      // 가운데 갑판: 부러진 돛대 둘과 뱃전 밧줄(돛대 줄), 대포
      ["mast-stump", 11, 10], ...shrouds(11), ["ghost:rope", 10, 11], ["ghost:rope", 12, 9],
      ["mast-stump", 24, 10], ...shrouds(24), ["ghost:rope", 23, 9], ["ghost:rope", 25, 11],
      ["ghost:cabin-wall", 14, 5], ["ghost:cabin-wall", 18, 5], ["ghost:cabin-wall", 14, 7], ["ghost:cabin-wall", 18, 7], // 가운데 갑판실
      ["ghost:lamp", 15, 8], ["ghost:lamp", 20, 8],
      ["ghost:cannon-front", 14, 15], ["ghost:cannon-front", 17, 15], ["ghost:cannon-front", 20, 15],
      ["ghost:ladder", 17, 9], // 갑판실 문 앞 해치 사다리(선실로)
      ["ghost:crate", 13, 12], ["ghost:crate", 13, 13], ["ghost:barrel-open", 14, 13], ["ghost:barrel", 19, 12], ["ghost:barrel", 19, 13], ["ghost:skull", 16, 12],
      // 앞갑판: 짐과 닻 권양기
      ["ghost:barrel", 27, 6], ["ghost:barrel", 28, 6], ["ghost:barrel-open", 27, 7], ["ghost:crate", 27, 15], ["ghost:crate", 28, 15], ["ghost:jug", 28, 14],
      ["ghost:winch", 31, 9], ["ghost:anchor", 36, 10], ["ghost:rope", 35, 12], ["ghost:rope", 33, 12], ["ghost:post", 30, 8], ["ghost:post", 30, 13],
      ["fire-ghost:fire-small", 23, 8], ["fire-ghost:fire-small", 14, 14], ["fire-ghost:fire-small", 32, 13], ["fire-ghost:fire-small", 7, 8],
    ],
    entry: [2, 12], targets: [[6, 12], [33, 10], [17, 11], [11, 13]],
    exits: [{ at: [2, 12], to: "outside", note: "선미 → 조각배" }, { at: [17, 9], to: "atlas-ghost-cabins", arrive: [36, 12], note: "갑판 해치 사다리 → 선실 복도" }],
    note: "안개 속에 떠 있는 유령선의 윗갑판. 뒷갑판(조타륜·해적 깃발·선장의 통과 상자)과 앞갑판(짐·닻 권양기·계류 말뚝)이 한 층 높은 널로 난간 틈 계단을 두고 이어지고, 가운데 갑판엔 선실 벽을 두른 갑판실과 부러진 돛대 둘, 뱃전까지 내려온 돛대 줄, 양 뱃전에 대포. 썩어 뚫린 구멍 하나, 도깨비불, 갑판실 문 앞 해치 사다리가 선실로 내려간다",
  });
}

function shipCabins() {
  const W = 40, H = 24;
  return ship({
    id: "atlas-ghost-cabins", name: "유령선 검은 돛 호 · 선실 복도", room: "통로", purpose: "탐험", placeKind: "vehicle",
    art: grid(W, H, [
      [".", 1, 10, 38, 13], // 선실 복도
      [".", 3, 1, 16, 8], [".", 9, 9, 10, 9], // 선장실과 문
      [".", 20, 1, 36, 8], [".", 28, 9, 29, 9], // 사관 식당과 문
      [".", 3, 15, 18, 22], [".", 10, 14, 11, 14], // 선원 침실과 문
      [".", 22, 15, 36, 22], [".", 28, 14, 29, 14], // 조리실과 문
      ["q", 1, 12, 38, 13], // 복도 바닥 널
    ]),
    props: [
      // 선장실
      ["ghost:picture-sea", 6, 1], ["ghost:porthole", 12, 1], ["ghost:porthole", 14, 1], ["ghost:potions", 4, 1],
      ["ghost:bookcase", 3, 3], ["ghost:wardrobe", 14, 3], ["ghost:table", 9, 5], ["ghost:stool", 8, 5], ["ghost:stool", 10, 5],
      ["ghost:bunk", 4, 7], ["chest-red", 15, 7], ["ghost:skull", 12, 7], ["ghost:jug", 3, 5],
      // 사관 식당
      ["ghost:shelf", 22, 1], ["ghost:porthole", 26, 1], ["ghost:porthole", 31, 1], ["ghost:lamp", 34, 1],
      ...dining(23, 5, 3, "manor", true), ...dining(30, 5, 3, "manor", true),
      ["ghost:barrel", 35, 3], ["ghost:barrel", 36, 3], ["ghost:crate", 36, 7], ["manor:dishes", 21, 7],
      // 선원 침실: 해먹 두 줄
      ...[4, 6, 8, 13, 15, 17].map((x) => ["ghost:hammock", x, 17]), ...[4, 6, 8, 13, 15, 17].map((x) => ["ghost:hammock", x, 20]),
      ["ghost:rope-hang", 5, 15], ["ghost:rope-hang", 15, 15], ["ghost:barrel-open", 11, 21], ["ghost:skull", 11, 17],
      // 조리실
      ["manor:stove", 23, 15], ["manor:oven", 25, 15], ["manor:counter", 32, 17], ["ghost:barrel", 35, 21], ["ghost:barrel", 36, 21], ["ghost:barrel", 36, 20],
      ["ghost:jug", 22, 21], ["ghost:crate", 23, 21], ["manor:dishes", 31, 17], ["ghost:table", 27, 19], ["ghost:stool", 26, 19], ["ghost:stool", 28, 19],
      // 복도
      ["ghost:lamp", 5, 10], ["ghost:lamp", 20, 10], ["ghost:lamp", 33, 10], ["ghost:rope-hang", 14, 10], ["ghost:vent", 25, 10],
      ["ghost:ladder", 37, 12], ["ghost:ladder", 1, 12],
      ["fire-ghost:fire-small", 17, 12], ["fire-ghost:fire-small", 30, 13],
    ],
    entry: [36, 12], targets: [[9, 6], [26, 7], [10, 18], [30, 20], [3, 12]],
    exits: [{ at: [37, 12], to: "atlas-ghost-deck", arrive: [18, 12], note: "동쪽 끝 사다리 → 갑판" }, { at: [1, 12], to: "atlas-ghost-hold", arrive: [12, 5], note: "서쪽 끝 사다리 → 선창" }],
    note: "갑판 아래 선실 층. 가운데 널 복도(벽등·늘어진 밧줄·환기창) 북쪽에 선장실(바다 그림·책장·장롱·탁자와 걸상 둘·침대·붉은 보물상자)과 사관 식당(긴 식탁 둘, 양끝과 북쪽에 의자), 남쪽에 선원 침실(침대 두 줄 열둘)과 조리실(화덕·오븐·조리대·통). 복도 양끝 사다리가 갑판과 선창으로",
  });
}

function shipHold() {
  const W = 26, H = 18;
  const stack = (x, y, k = "ghost:crate") => [[k, x, y], [k, x + 1, y], ["ghost:barrel", x, y + 1], ["ghost:barrel", x + 1, y + 1]];
  const block = (x, y, k) => [...stack(x, y, k), ...stack(x + 2, y, k)];
  return ship({
    id: "atlas-ghost-hold", name: "유령선 검은 돛 호 · 짐 실린 선창", room: "보물방", purpose: "탐험",
    art: grid(W, H, [
      [".", 2, 1, 23, 15], ["k", 2, 3, 23, 15], // 선창 바닥 회색 널
      ["c", 19, 13, 21, 15, { blob: 311, wobble: 0.3 }], // 바닥이 썩어 꺼진 구멍
    ]),
    props: [
      ["ghost:ladder", 12, 3], // 선실로 오르는 사다리
      ...[4, 7, 10].flatMap((y) => [...block(3, y), ...block(8, y), ...block(15, y), ...block(19, y, y === 10 ? "ghost:barrel-open" : "ghost:crate")]), // 짐 더미 네 줄 × 세 칸
      ["ghost:vent", 5, 1], ["ghost:vent", 19, 1], ["ghost:lamp", 10, 1], ["ghost:lamp", 15, 1], ["ghost:porthole", 3, 1], ["ghost:porthole", 22, 1], ["ghost:rope-hang", 7, 1],
      ["ghost:winch", 2, 13], ["ghost:rope", 3, 14], ["ghost:anchor", 5, 15],
      ["chest-wood", 12, 15], ["chest-iron", 8, 15], ["ghost:skull", 9, 15], ["ghost:jug", 7, 15], ["ghost:crate", 16, 15], ["ghost:crate", 17, 15], ["ghost:post", 12, 9],
      ["ghost:ladder", 22, 12], // 밑바닥으로 내려가는 사다리
      ["fire-ghost:fire-small", 13, 13], ["fire-ghost:fire-small", 18, 9],
    ],
    entry: [12, 5], targets: [[12, 14], [8, 14], [7, 9], [22, 9], [22, 12]],
    exits: [{ at: [12, 3], to: "atlas-ghost-cabins", arrive: [2, 12], note: "북쪽 사다리 → 선실 복도" }, { at: [22, 12], to: "atlas-ghost-bilge", arrive: [1, 11], note: "남동쪽 사다리 → 밑바닥" }],
    note: "배 밑의 선창. 상자 위에 통을 받친 짐 더미가 한 칸 통로를 두고 네 줄 세 칸으로 빽빽이 실렸고 가운데 두 칸 통로가 사다리에서 남쪽으로 곧게 간다. 벽엔 환기창·등·둥근 창·늘어진 밧줄, 남서 구석 권양기와 닻, 남쪽에 보물상자 둘과 해골. 남동쪽 바닥은 썩어 꺼졌고 그 곁 사다리가 밑바닥으로",
  });
}

function shipBilge() {
  const W = 28, H = 19;
  return ship({
    id: "atlas-ghost-bilge", name: "유령선 검은 돛 호 · 밑바닥 선장의 오르간", room: "보스방", purpose: "보스",
    art: grid(W, H, [
      [".", 0, 9, 3, 12], [".", 3, 1, 24, 17],
      ["c", 4, 13, 8, 16, { blob: 321, wobble: 0.3 }], ["c", 19, 13, 23, 16, { blob: 323, wobble: 0.3 }], // 썩어 꺼진 바닥(바닷물이 보인다)
      ["D", 9, 3, 18, 6], // 오르간 단
      ["k", 3, 3, 24, 17], ["q", 11, 7, 16, 17], // 밑바닥 회색 널과 단 앞 세로 널길
    ]),
    props: [
      ["ghost:organ", 13, 3], ["ghost:banner", 10, 1], ["ghost:banner", 17, 1], ["ghost:picture-sea", 5, 1], ["ghost:picture-sea", 20, 1],
      ["ghost:stool", 13, 4], ["chest-red", 10, 4], ["chest-red", 17, 4], ["ghost:skull", 11, 5], ["ghost:swords", 16, 5], ["ghost:lamp", 12, 1], ["ghost:lamp", 15, 1],
      ["fire-ghost:brazier", 9, 8], ["fire-ghost:brazier", 18, 8], ["fire-ghost:brazier", 9, 14], ["fire-ghost:brazier", 18, 14],
      ...col("ghost:post", 6, 4, 10, 3), ...col("ghost:post", 21, 4, 10, 3),
      ["ghost:barrel-open", 4, 3], ["ghost:barrel", 3, 4], ["ghost:crate", 23, 3], ["ghost:crate", 23, 4], ["ghost:rope", 22, 11], ["ghost:skull", 4, 11], ["ghost:jug", 24, 7],
      ["ghost:anchor", 13, 16], ["ghost:skull", 16, 16],
    ],
    keeper: [13, 10], entry: [1, 11], targets: [[13, 9], [10, 6], [17, 6], [22, 9]],
    exits: [{ at: [0, 11], to: "atlas-ghost-hold", arrive: [21, 12], note: "서쪽 사다리 발치 → 선창" }],
    note: "배의 가장 밑바닥, 유령 선장이 파이프오르간을 치는 방(보스방). 북쪽 단 위 오르간과 걸상, 양옆 선장의 붉은 보물상자, 뒤 벽에 금장 깃발·바다 그림·등. 단 앞 널길 양옆으로 도깨비불 화로 넷과 선체 기둥, 남쪽 두 곳은 바닥이 썩어 꺼졌다. 보스는 널길 위 (13,10)",
  });
}

// ── 유령 저택 ───────────────────────────────────────────────────────────────────────────────────────────────────
function manorHall() {
  const W = 34, H = 24;
  return manor({
    id: "atlas-manor-hall", name: "유령 저택 · 현관홀", room: "통로", purpose: "탐험", placeKind: "building",
    art: grid(W, H, [
      [".", 3, 1, 30, 20], [".", 15, 20, 18, 23], // 홀과 현관
      [".", 0, 9, 3, 12], [".", 30, 9, 33, 12], // 서재·지하실로 가는 문
      ["r", 15, 3, 18, 23], ["r", 1, 11, 32, 12], // 십자 카펫
      ["q", 11, 13, 22, 18], // 현관 앞 무늬 석판
      ["q", 4, 14, 10, 19], ["q", 23, 14, 29, 19], ["q", 5, 4, 10, 9], ["q", 23, 4, 29, 9], // 응접 자리마다 무늬 석판
    ]),
    props: [
      ["^", 15, 1], ["manor:armor", 13, 3], ["manor:armor", 20, 3], // 2층으로 오르는 계단과 갑옷
      ["manor:clock", 4, 1], ["manor:window-curtain", 7, 1], ["manor:painting-big", 9, 1], ["manor:painting-big", 23, 1], ["manor:window-curtain", 26, 1], ["manor:mirror", 29, 1],
      // 서쪽 응접: 둥근 탁자 둘과 마주 앉는 의자
      ["manor:table-round", 7, 5], ["manor:seat-r", 6, 5], ["manor:seat-l", 8, 5], ["manor:table-round", 7, 8], ["manor:seat-r", 6, 8], ["manor:chair-fallen", 8, 8],
      ["manor:cupboard", 4, 4], ["manor:pot", 11, 4],
      // 동쪽: 피아노와 걸상, 흉상
      ["manor:piano", 24, 5], ["manor:stool", 24, 6], ["manor:table-round", 27, 8], ["manor:seat-r", 26, 8], ["manor:seat-l", 28, 8], ["manor:candle", 21, 8], ["manor:pot", 29, 9], ["manor:bust", 28, 4], ["manor:pot", 22, 4], ["manor:shelf-books", 29, 5],
      // 남쪽 두 곁: 긴 탁자와 촛대, 흉상
      ["manor:cloth-table", 5, 15], ["manor:chair-s", 5, 14], ["manor:chair-s2", 6, 14], ["manor:chair-s", 7, 14], ["manor:candle", 9, 15],
      ["manor:cloth-table", 25, 15], ["manor:chair-s", 25, 14], ["manor:chair-s2", 26, 14], ["manor:chair-s", 27, 14], ["manor:candle", 24, 15],
      ["manor:bust", 13, 14], ["manor:bust", 20, 14], ["manor:cupboard", 4, 16], ["manor:shelf-books", 29, 16], ["manor:table-round", 7, 18], ["manor:seat-r", 6, 18], ["manor:seat-l", 8, 18], ["manor:glass", 10, 18], ["manor:plank-pile", 4, 19], ["manor:crate", 29, 19], ["manor:box", 28, 19],
      ["fire-ghost:fire-small", 12, 9], ["fire-ghost:fire-small", 21, 16], ["web-l", 3, 2], ["web-r", 30, 2],
    ],
    entry: [16, 23], targets: [[16, 4], [1, 11], [32, 11], [7, 6], [25, 7]],
    exits: [{ at: [16, 23], to: "outside", note: "남쪽 현관 → 저택 앞뜰" }, { at: [16, 3], to: "atlas-manor-corridor", arrive: [2, 12], note: "북쪽 계단 → 2층 복도" },
      { at: [0, 11], to: "atlas-manor-library", arrive: [30, 13], note: "서쪽 문 → 서재" }, { at: [33, 11], to: "atlas-manor-cellar", arrive: [2, 12], note: "동쪽 문 → 지하실 계단" }],
    note: "버려진 저택의 현관홀. 현관에서 빛바랜 붉은 카펫이 십자로 뻗어 북쪽 2층 계단(양옆 갑옷)과 서쪽 서재·동쪽 지하실 문으로 간다. 서쪽은 둥근 탁자 둘의 응접(의자 하나는 쓰러짐), 동쪽은 피아노와 흉상, 현관 앞 무늬 석판 양옆엔 흉상과 천 덮인 긴 탁자. 벽엔 괘종시계·커튼 창·큰 초상화·거울, 도깨비불",
  });
}

function manorCorridor() {
  const W = 40, H = 25;
  const bedroom = (x0, y0, flip) => [
    ["manor:bed-v", x0 + 1, y0 + 3], ["manor:bed-v", x0 + 3, y0 + 3], ["manor:wardrobe", x0 + 6, y0 + 2], ["manor:mirror", x0 + 8, y0 + 2],
    ["manor:window-dark", x0 + 2, y0], ["manor:painting-land", x0 + 5, y0],
    ["manor:table-round", x0 + 7, y0 + 5], ["manor:seat-l", x0 + 8, y0 + 5], ["manor:candle", x0 + 5, y0 + 3],
  ];
  return manor({
    id: "atlas-manor-corridor", name: "유령 저택 · 2층 복도와 손님방", room: "통로", purpose: "탐험", placeKind: "building",
    art: grid(W, H, [
      [".", 0, 10, 39, 14], ["r", 0, 12, 39, 14], // 복도(걷는 줄 셋)와 카펫
      [".", 3, 1, 12, 8], [".", 7, 9, 8, 9], [".", 26, 1, 35, 8], [".", 30, 9, 31, 9], // 북쪽 손님방 둘
      [".", 3, 16, 12, 23], [".", 7, 15, 8, 15], [".", 26, 16, 35, 23], [".", 30, 15, 31, 15], // 남쪽 손님방 둘
      [".", 15, 1, 23, 8], ["q", 16, 3, 22, 8], [".", 18, 9, 20, 9], // 가운데 작은 거실
    ]),
    props: [
      ...bedroom(3, 1), ...bedroom(26, 1), ...bedroom(3, 16), ...bedroom(26, 16),
      ["manor:table-round", 19, 5], ["manor:seat-r", 18, 5], ["manor:seat-l", 20, 5], ["manor:clock", 16, 1], ["manor:drape", 21, 1], ["manor:shelf-books", 22, 3], ["manor:bust", 16, 6],
      ["manor:painting-land", 4, 10], ["manor:painting-fire", 13, 10], ["manor:window-curtain", 24, 10], ["manor:painting-big", 33, 10], ["manor:window-dark", 37, 10],
      ["manor:armor", 11, 10], ["manor:armor", 23, 10], ["manor:bust", 15, 10], ["manor:bust", 34, 10],
      ["manor:chair-fallen", 11, 22], ["manor:skeleton", 33, 22], ["manor:glass", 5, 7], ["web-l", 26, 17], ["web-r", 35, 3],
      ["int:ladder", 38, 12], ["fire-ghost:fire-small", 27, 12], ["fire-ghost:fire-small", 10, 13],
    ],
    entry: [1, 12], targets: [[7, 6], [30, 6], [7, 21], [30, 21], [19, 7], [38, 13]],
    exits: [{ at: [0, 12], to: "atlas-manor-hall", arrive: [16, 4], note: "서쪽 계단참 → 현관홀" }, { at: [38, 12], to: "atlas-manor-attic", arrive: [16, 12], note: "동쪽 끝 사다리 → 다락" }],
    note: "2층 긴 복도. 카펫 복도를 따라 초상화·풍경화·커튼 창이 걸리고 벽 앞 문 사이에 갑옷과 흉상. 북남으로 손님방 넷이 마주 보는데 방마다 침대 둘·장롱·거울·둥근 탁자와 의자·촛대, 북쪽 가운데엔 괘종시계와 책꽂이가 있는 작은 거실. 남동 손님방엔 해골, 동쪽 끝 사다리가 다락으로",
  });
}

function manorLibrary() {
  const W = 32, H = 24;
  return manor({
    id: "atlas-manor-library", name: "유령 저택 · 서재", room: "퍼즐방", purpose: "퍼즐", placeKind: "building",
    art: grid(W, H, [
      [".", 2, 1, 28, 21], [".", 28, 11, 31, 14], ["r", 26, 13, 31, 14],
      ["q", 11, 13, 19, 19], // 가운데 무늬 석판(숨은 마법진)
      ["r", 13, 5, 19, 9], ["r", 20, 9, 26, 13], // 읽는 탁자 밑 깔개
      ["q", 2, 5, 10, 19], // 서가 칸의 석판 바닥
    ]),
    props: [
      ["manor:bookcase", 3, 1], ["manor:bookcase", 6, 1], ["manor:bookcase", 9, 1], ["manor:window-curtain", 13, 1], ["manor:clock", 15, 1], ["manor:window-curtain", 17, 1], ["manor:bookcase", 19, 1], ["manor:bookcase", 22, 1], ["manor:bookcase", 25, 1],
      // 서가 두 줄(가운데 통로)
      ["manor:bookcase", 3, 6], ["manor:bookcase", 7, 6], ["manor:bookcase", 3, 10], ["manor:bookcase", 7, 10], ["manor:bookcase", 3, 15], ["manor:bookcase", 7, 15],
      // 읽는 탁자 둘
      ...dining(15, 7, 3, "manor", true), ...dining(22, 11, 3, "manor", true), ["manor:bookcase", 20, 4], ["manor:bookcase", 21, 15], ["manor:armor", 27, 8], ["manor:book-open", 24, 7], ["manor:letters", 25, 8], ["manor:candle", 19, 9],
      ["int:circle", 14, 15], ["int:crystal-ball", 12, 14], ["manor:candle", 18, 14], ["manor:candle", 12, 18], ["manor:candle", 18, 18], // 숨은 마법진과 수정구
      ["manor:shelf-books", 26, 5], ["manor:shelf-books", 27, 5], ["manor:bust", 26, 16], ["manor:armor", 27, 18], ["manor:chair-fallen", 23, 19], ["manor:book-open", 22, 20], ["manor:letters", 21, 20],
      ["manor:stove", 13, 20], ["web-l", 2, 5], ["fire-ghost:fire-small", 10, 20], ["lever-off", 25, 20],
    ],
    entry: [30, 13], targets: [[16, 9], [15, 18], [6, 14], [24, 20], [4, 20]],
    exits: [{ at: [31, 13], to: "atlas-manor-hall", arrive: [1, 11], note: "동쪽 문 → 현관홀" }],
    note: "저택 주인의 서재(퍼즐방). 북쪽 벽을 책장 여섯이 채우고 괘종시계와 커튼 창, 서쪽엔 책장 여섯이 두 줄 서가를 이룬다. 가운데와 동쪽엔 의자 둘러싼 긴 읽는 탁자 둘과 펼친 책·편지·촛대, 남쪽 무늬 석판 위엔 촛대 넷이 둘러싼 숨은 마법진과 수정구, 남동쪽 구석 바닥 레버(서가를 여는 장치 자리)와 쓰러진 의자·흩어진 편지",
  });
}

function manorAttic() {
  const W = 28, H = 16;
  return manor({
    id: "atlas-manor-attic", name: "유령 저택 · 먼지 쌓인 다락", room: "보물방", purpose: "보물", placeKind: "building", theme: "hall",
    art: grid(W, H, [[".", 2, 1, 25, 13], ["r", 10, 7, 16, 11], ["q", 3, 5, 8, 9], ["q", 19, 4, 24, 12]]),
    props: [
      ["manor:window-dark", 7, 1], ["manor:window-dark", 19, 1], ["manor:crack", 13, 1], ["web-big", 2, 3], ["web-big", 24, 3],
      ["manor:crate", 4, 3], ["manor:crate", 5, 3], ["manor:crate", 4, 4], ["manor:box", 5, 4], ["manor:sack", 6, 4], ["manor:plank-stand", 7, 3], // 북서 짐
      ["manor:wardrobe", 10, 3], ["manor:mirror", 12, 3], ["manor:clock", 15, 3], ["manor:plank-pile", 16, 4], ["manor:bed-h", 18, 3], // 버려진 가구
      ["manor:crate", 22, 5], ["manor:crate", 23, 5], ["manor:box", 22, 6], ["manor:chair-fallen", 20, 6],
      ["manor:armor", 3, 7], ["manor:bust", 5, 7], ["manor:pot", 3, 10], ["manor:painting-big", 6, 10], // 서쪽: 내려 둔 그림과 흉상·갑옷
      ["manor:candle", 10, 7], ["manor:candle", 16, 7], ["chest-red", 12, 8], ["chest-wood", 14, 8], ["manor:skeleton", 13, 10], // 가운데: 숨겨 둔 상자
      ["manor:barrel", 21, 8], ["manor:barrel", 22, 8], ["manor:barrel", 21, 9], ["manor:crate", 23, 9], ["manor:sack", 23, 11], ["manor:jars", 20, 11], ["manor:piano", 18, 12],
      ["manor:table-square", 6, 12], ["manor:seat-l", 7, 12], ["manor:letters", 5, 12], ["manor:glass", 8, 11],
      ["int:ladder", 13, 13], ["fire-ghost:fire-small", 8, 8], ["fire-ghost:fire-small", 18, 9],
    ],
    entry: [13, 12], targets: [[13, 9], [5, 6], [21, 7], [9, 13]],
    exits: [{ at: [13, 13], to: "atlas-manor-corridor", arrive: [37, 13], note: "남쪽 사다리 → 2층 복도" }],
    note: "지붕 밑 다락(보물방). 먼지 낀 창 둘과 구석마다 큰 거미줄, 쌓인 상자·자루·널판, 버려진 장롱·거울·괘종시계·침대, 서쪽엔 내려 둔 큰 그림과 흉상·갑옷. 가운데 낡은 카펫 위에 촛대 둘 사이로 숨겨 둔 붉은 상자와 나무 상자, 그 앞에 해골. 남쪽 사다리가 2층 복도로",
  });
}

function manorCellar() {
  const W = 32, H = 24;
  return manor({
    id: "atlas-manor-cellar", name: "유령 저택 · 지하실 의식의 방", room: "보스방", purpose: "보스", theme: "cellar",
    art: grid(W, H, [
      [".", 0, 10, 4, 13], [".", 4, 1, 27, 21],
      ["q", 10, 5, 21, 16], ["r", 5, 11, 21, 12], // 의식의 석판과 끌린 카펫
    ]),
    props: [
      ["^", 1, 8], // (벽면 없음 → 아래에서 제거)
      ["int:circle", 14, 9], ["fire-violet:brazier", 11, 6], ["fire-violet:brazier", 20, 6], ["fire-violet:brazier", 11, 15], ["fire-violet:brazier", 20, 15], // 의식 마법진과 보랏빛 화로
      ["coffin-stone-open", 15, 5], ["manor:throne-red", 16, 5], ["manor:candle", 13, 6], ["manor:candle", 18, 6], // 저택 주인의 관과 붉은 의자
      // 서쪽 포도주 저장고
      ...col("manor:barrel", 5, 3, 8), ...col("manor:barrel", 6, 3, 8), ["int:jar-shelf", 8, 1], ["manor:sack", 8, 3], ["manor:crate", 5, 15], ["manor:crate", 6, 15], ["manor:barrel", 5, 16], ["manor:bottles", 7, 17],
      // 동쪽: 쇠사슬과 해골, 부서진 가구
      ["shackles", 24, 1], ["shackles", 26, 1], ["manor:skeleton", 24, 3], ["manor:skeleton", 26, 5], ["manor:chair-fallen", 25, 8], ["manor:plank-pile", 26, 10],
      ...col("manor:barrel", 25, 11, 15), ...col("manor:barrel", 26, 11, 15), ["manor:table-long", 9, 19], ["manor:book-open", 12, 19], ["manor:candle", 8, 19], ["manor:plank-pile", 22, 14], ["manor:crate", 23, 20], ["chest-iron", 25, 18], ["manor:box", 26, 18], ["bones", 23, 19], ["manor:jars", 26, 19], ["web-r", 27, 2], ["web-l", 4, 2],
    ].filter(([k]) => k !== "^"),
    keeper: [16, 13], entry: [0, 12], targets: [[16, 13], [15, 7], [7, 10], [24, 17], [25, 6]],
    exits: [{ at: [0, 12], to: "atlas-manor-hall", arrive: [32, 11], note: "서쪽 계단 → 현관홀" }],
    note: "저택 밑 젖은 돌 지하실, 저택 주인이 되살아난 의식의 방(보스방). 서쪽 계단에서 끌린 카펫이 무늬 석판 한가운데 마법진까지 가고, 네 귀퉁이 보랏빛 화로, 북쪽엔 뚜껑 열린 주인의 석관과 붉은 의자·촛대. 서쪽과 동쪽 벽 아래 포도주 통 줄과 단지 선반, 남쪽엔 의식서를 펼친 긴 탁자, 동쪽 벽엔 쇠사슬과 해골, 남동 구석에 쇠 보물상자. 보스는 마법진 앞 (16,13)",
  });
}
