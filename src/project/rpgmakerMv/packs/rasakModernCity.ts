// Rasak Modern Tileset — 도시 야외(City 폴더 17장) 프리셋. 그림은 없다(재배포 금지).
// 팩: https://rasak.itch.io/rasak-modern · 이름·좌표는 2026-09-24 판본(시트 sha256)을 보고 붙였다.
// 이름은 조수가 재료 이름으로 그대로 부른다 — 바꾸면 참고문서 예시도 함께 바꾼다.

import type { MvPackAutotile, MvPackObject, MvPackPreset, MvTownRecipe } from "../packPreset";

const A1 = "A1_Modern_Outside_Rasak.png";
const A2 = "A2_Modern_City_Rasak.png";
const A3 = "A3_Modern_Outside_Rasak.png";
const A3B = "A3_Modern_Outside_2_Rasak.png";
const A4 = "A4_Modern_Outside_Rasak.png";
const A4D = "A4_Modern_OutsideDirty_Rasak.png";
const A5 = "A5_Modern_Outside_Rasak.png";
const A5S = "A5_Street_Rasak.png";
const STREET = "Tileset_Modern_Street_Rasak.png";
const SHOP = "Tileset_Modern_CityShopping_Rasak.png";
const PARK = "Tileset_Modern_Park_Rasak.png";
const EXTRAS = "Tileset_Modern_BuildingExtras.png";
const GARBAGE = "Tileset_Modern_Garbage_Rasak.png";
const SLUMS = "Tileset_Modern_Slums_Rasak.png";

type Row = readonly [kind: number, name: string, role: MvPackAutotile["role"], description?: string];
const autos = (sheet: string, rows: readonly Row[]): MvPackAutotile[] =>
  rows.map(([kind, name, role, description]) => ({ sheet, kind, name, role, ...(description ? { description } : {}) }));

// A4 건물 부품. 짝수 줄(0-7·16-23·32-39)은 옥상 윗면(바닥형 48모양), 홀수 줄은 외벽(벽형 16모양).
const A4_PARTS: readonly Row[] = [
  [0, "검은 벽돌 옥상(은색 테두리)", "roof"], [1, "검은 벽돌 옥상(하늘색 테두리)", "roof"],
  [2, "검은 벽돌 옥상(갈색 테두리)", "roof"], [3, "검은 벽돌 옥상(짙은 갈색 테두리)", "roof"],
  [4, "밝은 타일 옥상", "roof"], [5, "아스팔트 옥상", "roof"], [6, "갈색 자갈 옥상", "roof"], [7, "유리 지붕", "roof", "천창·온실처럼 유리로 덮인 지붕"],
  [8, "회색 외벽 유리창 줄", "wall", "층마다 가로로 긴 유리창이 이어진 사무실 외벽"], [9, "밝은 회색 외벽 유리창 줄", "wall"],
  [10, "갈색 외벽 유리창 줄", "wall"], [11, "짙은 갈색 외벽 유리창 줄", "wall"],
  [12, "회색 콘크리트 외벽", "wall", "창 없는 벽. 창고·뒷면"], [13, "회색 상가 외벽(유리·셔터)", "wall", "1층 상가 — 쇼윈도와 셔터가 섞인 외벽"],
  [14, "회색 사무실 외벽(작은 창)", "wall"], [15, "회색 유리 상가 외벽", "wall", "통유리 1층 상가"],
  [16, "밝은 타일 옥상 2", "roof"], [17, "갈색 타일 옥상", "roof"], [18, "밝은 회색 평지붕", "roof"], [19, "갈색 평지붕", "roof"],
  [20, "짙은 옥상(회색 테두리)", "roof"], [21, "짙은 옥상(갈색 테두리)", "roof"], [22, "태양광 패널 옥상", "roof"], [23, "회색 옥상", "roof"],
  [24, "회색 외벽 검은 창 줄", "wall"], [25, "갈색 외벽 검은 창 줄", "wall"], [26, "밝은 판자 외벽", "wall"], [27, "갈색 판자 외벽", "wall"],
  [28, "밝은 회색 타일 외벽", "wall"], [29, "갈색 타일 외벽", "wall"], [30, "회색 외벽 큰 유리창", "wall"], [31, "회색 외벽 유리 모서리", "wall"],
  [32, "검은 벽돌 옥상", "roof"], [33, "짙은 회색 옥상", "roof"], [34, "짙은 옥상(붉은 벽돌 테두리)", "roof", "붉은 벽돌 외벽 위에 얹는 옥상"],
  [35, "붉은 벽돌 옥상", "roof"], [36, "짙은 옥상(회색 벽돌 테두리)", "roof"], [37, "회갈색 옥상", "roof"],
  [38, "짙은 옥상(주황 벽돌 테두리)", "roof"], [39, "주황 벽돌 옥상", "roof"],
  [40, "검은 벽돌 외벽 창문", "wall"], [41, "검은 벽돌 외벽", "wall"], [42, "붉은 벽돌 외벽 창문", "wall", "창문이 규칙적으로 난 붉은 벽돌 건물 외벽"],
  [43, "붉은 벽돌 외벽", "wall"], [44, "회색 벽돌 외벽 창문", "wall"], [45, "회색 벽돌 외벽", "wall"],
  [46, "주황 벽돌 외벽 창문", "wall"], [47, "주황 벽돌 외벽", "wall"],
];

const AUTOTILES: MvPackAutotile[] = [
  ...autos(A1, [
    [0, "잔디 둘레 연못 물", "water"], [1, "잔디 둘레 깊은 연못 물", "water"],
    [2, "긴 풀 덤불", "plant", "잔디 위에 겹쳐 까는 긴 풀"], [3, "수련잎", "trim", "물 위에 겹쳐 까는 수련"],
    [4, "돌 둑 수로 물", "water", "돌 둑으로 둘러싼 강·수로. 도시 강은 이것"], [5, "흐르는 물", "water"],
    [6, "돌 둑 깊은 물", "water"], [7, "흐르는 깊은 물", "water"], [8, "잔디", "ground", "도시 공원·화단의 기본 잔디"],
    [9, "흐르는 밝은 물", "water"], [10, "흰 꽃 잔디", "ground"], [11, "흐르는 짙은 물", "water"],
    [12, "흙 공터", "ground"], [13, "갈아 놓은 밭", "ground"], [14, "돌 둑 초록 물", "water"], [15, "흐르는 초록 물", "water"],
  ]),
  ...autos(A2, [
    [0, "회색 벽돌 보도", "ground"], [1, "붉은 벽돌 섞인 보도", "ground"], [2, "베이지 광장 타일", "ground"],
    [3, "밝은 회색 보도 타일", "ground"],
    [4, "교통 콘 줄", "fence", "공사장 둘레. 바닥 위에 겹쳐 깐다"], [5, "콘과 차단 테이프", "fence"],
    [6, "철망 울타리", "fence"], [7, "철조망 울타리", "fence"],
    [8, "잔디 바닥", "ground"], [9, "흙 자갈 잔디", "ground"], [10, "콘크리트 틀 화단", "ground", "보도 안의 네모난 잔디 화단"],
    [11, "회색 콘크리트 보도", "ground", "도시 보도의 기본. 차도 양옆에 깐다"],
    [12, "가는 경계선", "mark"], [13, "회색 창틀", "trim"], [14, "유리창 격자", "trim"], [15, "어두운 창틀", "trim"],
    [16, "아스팔트 차도", "road", "도시 차도의 기본"], [17, "횡단보도 테두리 차도", "road", "가장자리에 횡단보도 줄이 그려진 아스팔트 — 교차로 한가운데"],
    [18, "긴 풀 초원", "ground"], [19, "밝은 콘크리트 바닥", "ground"],
    [20, "바닥 균열", "mark"], [21, "잡초 덤불", "plant"], [22, "콘크리트 난간", "fence"], [23, "유리 난간", "fence"],
    [24, "짙은 아스팔트", "road"], [25, "실선 테두리 차도", "road", "가장자리에 흰 실선이 그려진 차도"],
    [26, "점선 테두리 차도", "road", "가장자리에 흰 점선이 그려진 차도(주차 구역)"], [27, "연석 두른 차도", "road", "회색 연석으로 둘러싼 아스팔트(주차장)"],
    [28, "바닥 얼룩", "mark", "보도·차도에 흩뿌리는 얼룩·웅덩이 자국"], [29, "흰 주차선", "mark"],
    [30, "횡단보도 줄(겹침)", "mark"], [31, "점자 보도블록", "mark"],
  ]),
  ...autos(A3, [
    [0, "검은 기와 지붕", "roof"], [1, "붉은 기와 지붕", "roof"], [2, "갈색 기와 지붕", "roof"],
    [3, "태양광 검은 지붕", "roof"], [4, "태양광 붉은 지붕", "roof"], [5, "태양광 갈색 지붕", "roof"],
    [6, "검은 비늘 지붕", "roof"], [7, "테두리 검은 지붕", "roof"],
    [8, "흰 벽", "wall"], [9, "회갈색 벽", "wall"], [10, "짙은 회색 벽", "wall"], [11, "초록 벽", "wall"], [12, "노란 벽", "wall"],
    [13, "흰 철판 벽", "wall"], [14, "회색 환풍구 벽", "wall", "창고·공장 벽"], [15, "회색 배관 벽", "wall"],
    [16, "검은 지붕", "roof"], [17, "붉은 지붕", "roof"], [18, "짙은 갈색 지붕", "roof"],
    [19, "검은 슁글 지붕", "roof"], [20, "붉은 슁글 지붕", "roof"], [21, "갈색 슁글 지붕", "roof"],
    [22, "붉은 비늘 지붕", "roof"], [23, "테두리 검은 지붕 2", "roof"],
    [24, "낡은 흰 벽", "wall"], [25, "낡은 회갈색 벽", "wall"], [26, "낡은 짙은 벽", "wall"], [27, "낡은 초록 벽", "wall"],
    [28, "낡은 노란 벽", "wall"], [29, "붉은 목재 벽", "wall", "헛간 같은 붉은 판자"], [30, "낡은 환풍구 벽", "wall"], [31, "낡은 배관 벽", "wall"],
  ]),
  ...autos(A3B, [
    [0, "사각 옥상 검은 벽돌(은색)", "roof"], [1, "사각 옥상 검은 벽돌(하늘색)", "roof"], [2, "사각 옥상 검은 벽돌(갈색)", "roof"],
    [3, "사각 옥상 검은 벽돌(짙은 갈색)", "roof"], [4, "사각 옥상 밝은 타일", "roof"], [5, "사각 옥상 아스팔트", "roof"],
    [6, "사각 옥상 검은 기와", "roof"], [7, "사각 옥상 비늘", "roof"],
    [8, "사각 외벽 회색 유리창 줄", "wall"], [9, "사각 외벽 밝은 회색 유리창 줄", "wall"], [10, "사각 외벽 갈색 유리창 줄", "wall"],
    [11, "사각 외벽 짙은 갈색 유리창 줄", "wall"], [12, "사각 외벽 회색 세로창", "wall"], [13, "사각 외벽 회색 상가", "wall"],
    [14, "사각 외벽 회색 창고", "wall"], [15, "사각 외벽 밝은 타일", "wall"],
    [16, "사각 옥상 밝은 타일 2", "roof"], [17, "사각 옥상 갈색 타일", "roof"], [18, "사각 옥상 짙은(갈색 테두리)", "roof"],
    [19, "사각 옥상 갈색 벽돌", "roof"], [20, "사각 옥상 갈색 자갈", "roof"], [21, "사각 유리 지붕", "roof"],
    [22, "사각 옥상 검은 기와(테두리)", "roof"], [23, "사각 옥상 회색", "roof"],
    [24, "사각 외벽 회색 검은 창", "wall"], [25, "사각 외벽 갈색 검은 창", "wall"], [26, "사각 외벽 갈색 벽돌 창문", "wall"],
    [27, "사각 외벽 갈색 벽돌", "wall"], [28, "사각 외벽 회색 세로창 2", "wall"], [29, "사각 외벽 회색 유리 상가", "wall"],
    [30, "사각 외벽 회색 창고 2", "wall"], [31, "사각 외벽 회색 유리 모서리", "wall"],
  ]),
  ...autos(A4, A4_PARTS),
  ...autos(A4D, A4_PARTS.map(([kind, name, role]) => [kind, `${name}(낡음)`, role] as const)),
];

type O = readonly [id: string, sheet: string, x: number, y: number, w: number, h: number, kind: MvPackObject["kind"], name: string, extra?: Partial<MvPackObject>];
// 주차·길가 자동차 — 타일 시트(PublicTransportation 은 버스·전차뿐)에는 승용차가 없어서 캐릭터 시트 !Car1 의
// 가운데(정지) 프레임을 물체로 쓴다. 한 캐릭터 블록 = 12×12칸, 8색이 4×2 로 놓였고 방향 줄은 아래·왼쪽·오른쪽·위.
// 모든 색이 같은 자리: 가로 차 4×3 (x4~7, 왼쪽 y3~5 · 오른쪽 y6~8), 세로 차 2×3 (x5~6, 아래 y0~2 · 위 y9~11).
// 가로 차의 맨 윗줄은 지붕 끝 한 조각뿐이라 캐릭터 위에 그리고, 아래 두 줄(차체·바퀴)이 막힌다.
const CAR_SHEET = "!Car1.png";
const CARS: readonly O[] = ([
  ["red", "빨간", 1, 0], ["white", "흰", 0, 1], ["blue", "파란", 1, 1], ["black", "검은", 3, 0], ["green", "초록", 2, 1],
] as const).flatMap(([id, word, bx, by]): O[] => {
  const x = bx * 12, y = by * 12;
  const side = { onRoad: true, solid: [0, 1, 2, 3].flatMap((dx) => [[dx, 1], [dx, 2]] as [number, number][]) };
  const long = { onRoad: true };
  return [
    [`car_${id}_left`, CAR_SHEET, x + 4, y + 3, 4, 3, "tall", `${word} 승용차(왼쪽 보기)`, { ...side, description: "가로 차 4×3. 동→서로 가는 차선(오른쪽 통행: 길 북쪽 차선)·가로 주차" }],
    [`car_${id}_right`, CAR_SHEET, x + 4, y + 6, 4, 3, "tall", `${word} 승용차(오른쪽 보기)`, { ...side, description: "가로 차 4×3. 서→동으로 가는 차선(오른쪽 통행: 길 남쪽 차선)·가로 주차" }],
    [`car_${id}_down`, CAR_SHEET, x + 5, y + 0, 2, 3, "prop", `${word} 승용차(아래 보기)`, { ...long, description: "세로 차 2×3. 주차 칸(세로 줄)·남쪽으로 가는 차선(오른쪽 통행: 길 서쪽 차선)" }],
    [`car_${id}_up`, CAR_SHEET, x + 5, y + 9, 2, 3, "prop", `${word} 승용차(위 보기)`, { ...long, description: "세로 차 2×3. 주차 칸(세로 줄)·북쪽으로 가는 차선(오른쪽 통행: 길 동쪽 차선)" }],
  ];
});
const CAR_COLORS = ["red", "white", "blue", "black", "green"] as const;

const OBJECTS: MvPackObject[] = ([
  // ── 거리 (Tileset_Modern_Street) ──
  ["street_lamp_left", STREET, 8, 2, 1, 3, "tall", "가로등(팔이 오른쪽)"],
  ["street_lamp_right", STREET, 9, 2, 1, 3, "tall", "가로등(팔이 왼쪽)"],
  ["street_lamp_lit_left", STREET, 10, 2, 2, 3, "tall", "불 켜진 가로등(기둥 왼쪽)", { solid: [[0, 2]], description: "밤거리. 오른쪽 칸에 불빛이 떨어진다" }],
  ["street_lamp_lit_right", STREET, 12, 2, 2, 3, "tall", "불 켜진 가로등(기둥 오른쪽)", { solid: [[1, 2]] }],
  ["tall_lamp", STREET, 12, 9, 1, 3, "tall", "높은 보도 가로등"],
  ["tall_lamp_lit", STREET, 13, 9, 1, 3, "tall", "불 켜진 높은 보도 가로등"],
  ["traffic_light_off", STREET, 9, 14, 1, 2, "tall", "신호등(꺼짐)"],
  ["traffic_light_green", STREET, 10, 14, 1, 2, "tall", "신호등(초록)"],
  ["traffic_light_yellow", STREET, 11, 14, 1, 2, "tall", "신호등(노랑)"],
  ["fire_hydrant", STREET, 7, 13, 1, 1, "prop", "소화전"],
  ["trash_can", STREET, 3, 11, 1, 1, "prop", "쇠 쓰레기통"],
  ["trash_can_full", STREET, 4, 11, 1, 1, "prop", "가득 찬 쓰레기통"],
  ["recycle_bin_green", STREET, 0, 9, 1, 2, "tall", "초록 분리수거함"],
  ["recycle_bin_yellow", STREET, 1, 9, 1, 2, "tall", "노랑 분리수거함"],
  ["recycle_bin_red", STREET, 2, 9, 1, 2, "tall", "빨강 분리수거함"],
  ["power_box", STREET, 0, 11, 1, 2, "tall", "전기 배전함"],
  ["ad_column", STREET, 8, 6, 1, 2, "tall", "원통 광고탑"],
  ["stop_sign", STREET, 8, 11, 1, 2, "tall", "정지 표지판"],
  ["traffic_cone", STREET, 14, 4, 1, 1, "prop", "교통 콘", { onRoad: true }],
  ["traffic_cones_pair", STREET, 12, 1, 1, 1, "prop", "교통 콘 두 개", { onRoad: true }],
  ["manhole", STREET, 0, 13, 1, 1, "decal", "맨홀 뚜껑"],
  ["manhole_2", STREET, 1, 13, 1, 1, "decal", "맨홀 뚜껑 2"],
  ["drain_vertical", STREET, 3, 12, 1, 1, "decal", "세로 배수구"],
  ["drain_horizontal", STREET, 4, 12, 1, 1, "decal", "가로 배수구"],
  ["crosswalk_for_horizontal_road", STREET, 4, 0, 1, 1, "decal", "횡단보도(가로 차도용)", { growth: "both", description: "가로로 뻗은 차도를 건너는 횡단보도. 가로 줄무늬라 세로로 차도 폭만큼 이어 찍는다" }],
  ["crosswalk_for_vertical_road", STREET, 6, 1, 1, 1, "decal", "횡단보도(세로 차도용)", { growth: "both", description: "세로로 뻗은 차도를 건너는 횡단보도. 세로 줄무늬라 가로로 차도 폭만큼 이어 찍는다" }],
  ["lane_line_vertical", STREET, 2, 0, 1, 1, "decal", "세로 차선", { growth: "vertical" }],
  ["lane_line_horizontal", STREET, 2, 1, 1, 1, "decal", "가로 차선", { growth: "horizontal" }],
  ["arrow_down", STREET, 0, 1, 1, 1, "decal", "차선 화살표 아래"],
  ["arrow_left", STREET, 1, 1, 1, 1, "decal", "차선 화살표 왼쪽"],
  ["arrow_up", STREET, 0, 2, 1, 1, "decal", "차선 화살표 위"],
  ["arrow_right", STREET, 1, 2, 1, 1, "decal", "차선 화살표 오른쪽"],
  ["guardrail", STREET, 2, 7, 2, 1, "prop", "가드레일", { growth: "horizontal" }],
  ["cardboard_box", STREET, 7, 8, 1, 1, "prop", "골판지 상자"],
  // ── 상가 (Tileset_Modern_CityShopping) ──
  // 시트 첫 줄은 1칸 차양(1,0)과 3칸 차양(2,0)이 붙어 있다 — 한 물체로 묶으면 가운데 이음매가 보인다.
  ["awning_red", SHOP, 2, 0, 3, 2, "overhead", "빨간 줄무늬 차양(3칸)", { description: "가게 입구 위 외벽에 겹쳐 단다. 아래 줄은 그늘 — 외벽이 3줄이면 맨 위 두 줄에 단다" }],
  ["awning_red_small", SHOP, 1, 0, 1, 2, "overhead", "빨간 줄무늬 차양(1칸)", { description: "문 하나 위에 다는 작은 차양" }],
  ["shop_window_large", SHOP, 5, 0, 3, 2, "wallmount", "큰 유리 쇼윈도"],
  ["glass_door_dark", SHOP, 0, 3, 1, 2, "door", "유리문(어두운)"],
  ["glass_door_bright", SHOP, 1, 3, 1, 2, "door", "유리문(밝은)"],
  ["food_cart", SHOP, 8, 0, 2, 2, "tall", "회색 노점 카트"],
  ["hotdog_cart", SHOP, 14, 0, 2, 2, "tall", "핫도그 노점"],
  ["popcorn_cart", SHOP, 12, 2, 2, 2, "tall", "팝콘 노점"],
  ["icecream_cart", SHOP, 8, 4, 2, 2, "tall", "아이스크림 노점"],
  ["parasol_hotdog_cart", SHOP, 10, 4, 2, 3, "tall", "파라솔 핫도그 노점"],
  ["round_table_red_chairs", SHOP, 14, 2, 2, 2, "tall", "원탁과 빨간 의자"],
  ["white_round_table", SHOP, 14, 4, 2, 2, "tall", "흰 원탁"],
  ["wood_table", SHOP, 12, 4, 2, 2, "tall", "나무 탁자"],
  ["long_bench_wood", SHOP, 8, 7, 3, 1, "prop", "긴 나무 벤치", { growth: "horizontal" }],
  ["round_kiosk", SHOP, 13, 8, 3, 3, "tall", "원형 키오스크", { solid: [[0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]] }],
  ["atm", SHOP, 1, 11, 1, 2, "tall", "현금인출기(ATM)"],
  ["vending_snacks", SHOP, 2, 12, 1, 2, "tall", "과자 자판기"],
  ["vending_coffee", SHOP, 6, 12, 1, 2, "tall", "커피 자판기"],
  ["vending_soda", SHOP, 0, 14, 1, 2, "tall", "음료 자판기"],
  ["cone_tree_pot", SHOP, 5, 5, 1, 2, "tall", "원뿔 나무 화분"],
  ["flower_bed_yellow", SHOP, 5, 8, 1, 1, "prop", "노란 꽃 화단"],
  ["flower_bed_blue", SHOP, 5, 9, 1, 1, "prop", "파란 꽃 화단"],
  ["flower_bed_red", SHOP, 5, 10, 1, 1, "prop", "빨간 꽃 화단"],
  ["flower_bed_pink", SHOP, 5, 11, 1, 1, "prop", "분홍 튤립 화단"],
  // ── 공원 (Tileset_Modern_Park) ──
  ["fountain_large", PARK, 10, 6, 2, 2, "prop", "큰 분수대"],
  ["park_bench_long", PARK, 10, 9, 3, 1, "prop", "공원 벤치(3칸)", { growth: "horizontal" }],
  ["park_bench", PARK, 13, 9, 1, 1, "prop", "공원 벤치(1칸)"],
  ["wood_bench_long", PARK, 11, 11, 3, 1, "prop", "등받이 없는 긴 벤치", { growth: "horizontal" }],
  ["bush_large", PARK, 14, 9, 2, 2, "prop", "큰 덤불"],
  ["bush_small", PARK, 7, 15, 1, 1, "prop", "작은 덤불"],
  ["cone_tree", PARK, 15, 5, 1, 2, "tall", "원뿔 나무"],
  ["cone_tree_planter", PARK, 15, 7, 1, 2, "tall", "원뿔 나무 화분"],
  ["hedge_horizontal", PARK, 13, 2, 3, 2, "prop", "가로 생울타리", { growth: "horizontal" }],
  ["soccer_goal", PARK, 2, 0, 3, 2, "prop", "축구 골대"],
  ["basketball_hoop", PARK, 7, 0, 1, 2, "tall", "농구 골대"],
  ["seesaw", PARK, 0, 13, 2, 1, "prop", "시소"],
  // ── 건물 부속 (Tileset_Modern_BuildingExtras) ──
  ["satellite_dish", EXTRAS, 2, 0, 2, 2, "wallmount", "옥상 위성 안테나", { description: "옥상 윗면 위에 얹는다" }],
  ["helipad", EXTRAS, 4, 0, 4, 4, "wallmount", "옥상 헬기장", { description: "병원·고층 건물 옥상 윗면 위에 얹는다" }],
  ["metal_door", EXTRAS, 12, 4, 1, 2, "door", "검은 철문", { description: "외벽 맨 아래 줄에 붙인다" }],
  ["window_dark_tall", EXTRAS, 0, 8, 1, 3, "wallmount", "세로로 긴 어두운 창"],
  ["window_dark_wide", EXTRAS, 1, 9, 3, 2, "wallmount", "넓은 어두운 창"],
  ["window_lit_tall", EXTRAS, 0, 12, 1, 3, "wallmount", "세로로 긴 불 켜진 창"],
  ["window_lit_wide", EXTRAS, 1, 13, 3, 2, "wallmount", "넓은 불 켜진 창"],
  ["sign_police", EXTRAS, 8, 14, 2, 1, "wallmount", "경찰서 간판"],
  ["sign_fire", EXTRAS, 10, 14, 2, 1, "wallmount", "소방서 간판"],
  ["sign_hospital", EXTRAS, 12, 14, 2, 1, "wallmount", "병원 간판"],
  ["fire_escape", EXTRAS, 13, 7, 3, 5, "wallmount", "비상계단", { description: "외벽에 겹쳐 단다" }],
  // ── 작가 예시 건물에 쓰인 층 부품 (2026-09-25 사용 예 조사) ──
  ["window_tall", STREET, 8, 0, 1, 2, "wallmount", "세로창", { description: "창 없는 외벽(주택·2층 가게 위층)에 1~2칸 띄워 단다. 벽 2줄 = 한 층" }],
  ["window_tall_small", STREET, 9, 0, 1, 2, "wallmount", "세로창과 작은 창", { description: "주택 벽에 다는 세로창 + 아래 작은 창" }],
  // 주택 현관문 없음: 예전 house_door_a/b/d 는 Street 시트 10~13열 0~1줄을 가리켰는데 그 칸은 전부 교통 콘이다(2026-09-27 그림 확인).
  // 주택·중층 주거는 작가 p4·p6 처럼 유리문(glass_door_dark/bright)을 쓴다.
  ["shopfront_glass", A5, 7, 12, 1, 2, "wallmount", "1층 통유리(1칸)", { growth: "horizontal", description: "1층 띠 2줄에 문 옆으로 이어 붙이는 쇼윈도(작가 2층 벽돌 가게)" }],
  ["shopfront_glass_lit", A5, 5, 12, 1, 2, "wallmount", "1층 불 켜진 통유리(1칸)", { growth: "horizontal", description: "밤·가게 안 불빛이 비치는 쇼윈도" }],
  // ── 1줄짜리 1층 띠 부품 (작가 city-intersection 회색 상가 y6: 1줄 쇼윈도 ×2 + 1줄 문, 위에 차양) ──
  ["door_row_dark", SHOP, 0, 8, 1, 1, "door", "1줄 유리문(어두운)", { description: "1층 띠가 1줄일 때 쓰는 한 칸짜리 문. 차양은 바로 윗줄에" }],
  ["door_row_bright", SHOP, 1, 8, 1, 1, "door", "1줄 유리문(밝은)", { description: "1층 띠가 1줄일 때 쓰는 한 칸짜리 문" }],
  ["shopfront_row_left", SHOP, 2, 8, 1, 1, "wallmount", "1줄 쇼윈도 왼끝"],
  ["shopfront_row", SHOP, 3, 8, 1, 1, "wallmount", "1줄 쇼윈도(가운데)", { growth: "horizontal", description: "1줄 1층 띠에 문 옆으로 이어 붙이는 통유리. 양끝은 _left·_right" }],
  ["shopfront_row_right", SHOP, 4, 8, 1, 1, "wallmount", "1줄 쇼윈도 오른끝"],
  // ── 옥상 설비 (Tileset_Modern_BuildingExtras 오른쪽 위) ──
  ["roof_vent", EXTRAS, 13, 0, 1, 1, "wallmount", "옥상 환기구", { description: "옥상 윗면 위에 얹는다. 한 건물에 1~3개" }],
  ["roof_fan", EXTRAS, 14, 0, 1, 1, "wallmount", "옥상 실외기(팬)", { description: "옥상 윗면 위에 얹는다" }],
  ["roof_vent_slat", EXTRAS, 13, 1, 1, 1, "wallmount", "옥상 환기구(살창)", { description: "옥상 윗면 위에 얹는다" }],
  ["roof_ac_large", EXTRAS, 13, 2, 2, 1, "wallmount", "옥상 큰 공조기(2칸)", { description: "폭 5칸 이상 옥상에 얹는다" }],
  ["wall_ladder", EXTRAS, 12, 7, 1, 3, "wallmount", "벽 사다리", { description: "건물 뒷면·옆면 외벽에 옥상까지 단다" }],
  // ── 나무 종류 (Tileset_Modern_Park) — 원뿔 나무만 쓰면 한 수종 숲이 된다 ──
  ["poplar_tree", PARK, 10, 0, 1, 4, "tall", "키 큰 미루나무", { description: "가로수·뒷마당. 1칸 폭이라 좁은 잔디 띠에 맞는다" }],
  ["round_tree", PARK, 11, 2, 2, 4, "tall", "큰 둥근 나무", { description: "공원·넓은 앞마당. 밑동 줄 2칸이 막힌다" }],
  ["round_tree_small", PARK, 14, 0, 2, 2, "tall", "작은 둥근 나무", { description: "앞마당·공원 가장자리" }],
  ["bush_wide", PARK, 11, 0, 3, 2, "prop", "넓은 덤불(3칸)", { description: "공원 가장자리·마당 울타리 안쪽" }],
  // ── 3라운드 꾸밈 부품 (2026-09-26 시트 해독 + 칸 불투명도 확인) ──
  // 가게 간판(1×1·2×1): 1층 띠 바로 위 위층 벽 맨 아랫줄에 단다 — 문 위 또는 쇼윈도 위, 가게마다 하나.
  ["sign_mode", SHOP, 12, 8, 1, 1, "wallmount", "옷가게 간판(MODE)"],
  ["sign_fashion", SHOP, 11, 9, 2, 1, "wallmount", "패션 간판(2칸)"],
  ["sign_tailor", SHOP, 10, 10, 1, 1, "wallmount", "양복점 간판"],
  ["sign_barber", SHOP, 10, 11, 1, 1, "wallmount", "이발소 간판"],
  ["sign_salon", SHOP, 11, 11, 1, 1, "wallmount", "미용실 간판"],
  ["sign_pharmacy", SHOP, 12, 11, 1, 1, "wallmount", "약국 간판"],
  ["sign_hardware", SHOP, 13, 11, 1, 1, "wallmount", "철물점 간판"],
  ["sign_pizza", SHOP, 8, 12, 1, 1, "wallmount", "피자 가게 간판"],
  ["sign_food", SHOP, 9, 13, 1, 1, "wallmount", "식당 간판"],
  ["sign_store247", SHOP, 14, 14, 1, 1, "wallmount", "24시 편의점 간판"],
  ["sign_burger", SHOP, 8, 8, 1, 1, "wallmount", "버거 가게 간판"],
  ["sign_mall", SHOP, 5, 4, 1, 1, "wallmount", "몰 간판"],
  ["sign_24hrs", SHOP, 0, 11, 1, 1, "wallmount", "24시간 네온 간판"],
  ["banner_store", SHOP, 15, 13, 1, 1, "wallmount", "세로 가게 깃발(STORE)"],
  ["banner_shop_red", SHOP, 14, 15, 1, 1, "wallmount", "세로 가게 깃발(빨강)"],
  // 옥상 설비 더: 태양광 판(2×2)·물탱크·안테나 — 옥상 윗면 위에 얹는다.
  ["roof_solar", EXTRAS, 0, 6, 2, 2, "wallmount", "옥상 태양광 판", { description: "평지붕 옥상 2×2. 주거·사무실 옥상" }],
  ["roof_water_tank", EXTRAS, 5, 4, 1, 1, "wallmount", "옥상 물탱크"],
  ["roof_antenna", EXTRAS, 6, 4, 1, 1, "wallmount", "옥상 안테나 무리"],
  // 공원 놀이·쉼터
  ["swing", PARK, 6, 9, 1, 2, "tall", "그네"],
  ["picnic_table", PARK, 8, 14, 2, 2, "tall", "피크닉 탁자"],
  ["traffic_light_red", STREET, 12, 14, 1, 2, "tall", "신호등(빨강)"],
  ["bollard", STREET, 4, 7, 1, 1, "prop", "흰 볼라드"],
  // ── 4라운드 뒷골목 설비 (2026-09-26 칸 알파 경계 실측: 부품 픽셀이 모두 적힌 칸 안에 든다) ──
  // 대형 쓰레기통(Slums 2×2, 위 줄은 뚜껑) · 바퀴 쓰레기통·봉투·드럼통·설비함·타이어·상자(Garbage 1×1) · 벽걸이 실외기.
  ["dumpster_green", SLUMS, 0, 12, 2, 2, "tall", "초록 대형 쓰레기통", { description: "뒷문 옆 뒷길·뒷골목. 아래 줄이 막힌다" }],
  ["dumpster_green_2", SLUMS, 2, 12, 2, 2, "tall", "초록 대형 쓰레기통 2"],
  ["dumpster_open", SLUMS, 0, 8, 2, 2, "tall", "뚜껑 열린 대형 쓰레기통"],
  ["crate_large", SLUMS, 6, 14, 2, 2, "tall", "큰 나무 상자"],
  ["wheelie_bin_green", GARBAGE, 9, 3, 1, 1, "prop", "초록 바퀴 쓰레기통"],
  ["wheelie_bin_black", GARBAGE, 12, 3, 1, 1, "prop", "검정 바퀴 쓰레기통"],
  ["wheelie_bins_green_black", GARBAGE, 13, 3, 1, 1, "prop", "초록·검정 바퀴 쓰레기통 한 쌍"],
  ["wheelie_bins_yellow_red", GARBAGE, 14, 3, 1, 1, "prop", "노랑·빨강 바퀴 쓰레기통 한 쌍"],
  ["trash_bags", GARBAGE, 5, 11, 1, 1, "prop", "쓰레기 봉투 두 개"],
  ["trash_bags_2", GARBAGE, 7, 11, 1, 1, "prop", "쓰레기 봉투 더미"],
  ["barrels_gray", GARBAGE, 6, 3, 1, 1, "prop", "회색 드럼통 무리"],
  ["utility_meter", GARBAGE, 8, 3, 1, 1, "prop", "회색 설비함(계량기)", { description: "뒷벽에 붙여 세운다" }],
  ["tire_stack", GARBAGE, 4, 14, 1, 1, "prop", "타이어 더미"],
  ["box_stack", GARBAGE, 6, 15, 1, 1, "prop", "쌓인 상자"],
  ["ac_unit_wall", "Tileset_Modern_PublicTransportation_Slums_Rasak.png.png", 7, 0, 1, 1, "wallmount", "벽걸이 실외기", { description: "뒷벽·옆벽 외벽에 붙인다" }],
  // ── 거리 소품 (Tileset_Modern_PublicTransportation_Clean) ──
  ["bus_shelter", "Tileset_Modern_PublicTransportation_Clean_Rasak.png", 0, 6, 3, 3, "tall", "버스 정류장 쉼터", { description: "큰길 보도 바깥쪽(3×3). 위 두 줄은 캐릭터 위, 맨 아래 줄이 막힌다" }],
  ...CARS,
] as readonly O[]).map(([id, sheet, x, y, w, h, kind, name, extra]) => ({ id, sheet, x, y, w, h, kind, name, ...(extra ?? {}) }));

// 마을 짜임 도구 재료 — 작가 참고 맵의 건물 짝(옥상·창 난 위층·창 없는 1층)과 사용자 맵의 거리 짜임에서 골랐다.
const TOWN: MvTownRecipe = {
  road: "아스팔트 차도",
  intersection: "횡단보도 테두리 차도",
  sidewalk: "회색 콘크리트 보도",
  lawn: "잔디",
  alley: "짙은 아스팔트",
  driveway: "밝은 콘크리트 바닥",
  path: "회색 판석 산책로",
  parkLawn: "긴 풀 초원",
  meadow: "흰 꽃 잔디",
  worn: "흙 자갈 잔디",
  tallGrass: "긴 풀 덤불",
  plaza: "베이지 광장 타일",
  fence: "철망 울타리",
  parkingLine: "흰 주차선",
  garden: "갈아 놓은 밭",
  shops: [
    { roof: "짙은 옥상(붉은 벽돌 테두리)", upper: "붉은 벽돌 외벽 창문", ground: "붉은 벽돌 외벽", door: "glass_door_bright", awning: "awning_red", shopfront: "shopfront_glass" },
    { roof: "짙은 옥상(주황 벽돌 테두리)", upper: "주황 벽돌 외벽 창문", ground: "주황 벽돌 외벽", door: "glass_door_bright", awning: "awning_red", shopfront: "shopfront_glass" },
    { roof: "짙은 옥상(회색 벽돌 테두리)", upper: "회색 벽돌 외벽 창문", ground: "회색 벽돌 외벽", door: "glass_door_dark", awning: "awning_red", shopfront: "shopfront_glass_lit" },
    { roof: "검은 벽돌 옥상", upper: "검은 벽돌 외벽 창문", ground: "검은 벽돌 외벽", door: "glass_door_dark", awning: "awning_red", shopfront: "shopfront_glass" },
    { roof: "사각 옥상 회색", upper: "사각 외벽 회색 세로창", ground: "사각 외벽 회색 유리 상가", door: "glass_door_bright", awning: "awning_red" },
    // 작가 city-intersection x14~18: 유리 지붕 → 회색 상가 벽 → 1층 1줄 쇼윈도 줄 + 1줄 문.
    { roof: "사각 유리 지붕", upper: "사각 외벽 회색 상가", ground: "사각 외벽 회색 유리 상가", door: "door_row_bright", awning: "awning_red", shopfront: "shopfront_row", shopfrontEnds: ["shopfront_row_left", "shopfront_row_right"] },
    { roof: "사각 옥상 짙은(갈색 테두리)", upper: "사각 외벽 갈색 벽돌 창문", ground: "사각 외벽 갈색 벽돌", door: "door_row_dark", awning: "awning_red", shopfront: "shopfront_row", shopfrontEnds: ["shopfront_row_left", "shopfront_row_right"] },
  ],
  offices: [
    { roof: "사각 옥상 검은 벽돌(짙은 갈색)", upper: "사각 외벽 짙은 갈색 유리창 줄", ground: "사각 외벽 회색 유리 상가", door: "glass_door_dark" },
    // 작가 river-bridge: 회색 유리 상가 외벽 + glass_door_bright — 민 콘크리트 1층(창고처럼 보인다) 대신.
    { roof: "밝은 회색 평지붕", upper: "밝은 회색 외벽 유리창 줄", ground: "회색 유리 상가 외벽", door: "glass_door_bright" },
    { roof: "갈색 평지붕", upper: "갈색 외벽 유리창 줄", ground: "갈색 타일 외벽", door: "glass_door_dark" },
  ],
  // 주택가 중층 주거 줄(1층 문 + 세로창, 쇼윈도·차양 없음).
  apartments: [
    { roof: "붉은 벽돌 옥상", upper: "붉은 벽돌 외벽 창문", ground: "붉은 벽돌 외벽", door: "glass_door_dark" },
    { roof: "사각 옥상 검은 기와", upper: "사각 외벽 갈색 벽돌 창문", ground: "사각 외벽 갈색 벽돌", door: "glass_door_bright" },
    { roof: "사각 옥상 비늘", upper: "밝은 판자 외벽", ground: "밝은 판자 외벽", door: "glass_door_dark" },
    { roof: "짙은 옥상(주황 벽돌 테두리)", upper: "주황 벽돌 외벽 창문", ground: "주황 벽돌 외벽", door: "glass_door_bright" },
    { roof: "사각 옥상 갈색 타일", upper: "갈색 판자 외벽", ground: "갈색 판자 외벽", door: "glass_door_dark" },
  ],
  houses: [
    { roof: "붉은 기와 지붕", wall: "흰 벽" }, { roof: "검은 기와 지붕", wall: "노란 벽" },
    { roof: "갈색 기와 지붕", wall: "회갈색 벽" }, { roof: "검은 슁글 지붕", wall: "초록 벽" },
    { roof: "붉은 슁글 지붕", wall: "노란 벽" }, { roof: "갈색 슁글 지붕", wall: "흰 벽" },
    { roof: "검은 비늘 지붕", wall: "흰 철판 벽" }, { roof: "태양광 붉은 지붕", wall: "초록 벽" },
  ],
  objects: {
    lamp: "street_lamp_left", lampAlt: "street_lamp_right", planterTree: "cone_tree_pot", streetTree: "cone_tree",
    // 잔디 띠 가로수는 맨 나무만 — 화분 나무는 포장된 보도에만(DEFECTS r2-14).
    streetTrees: ["cone_tree", "poplar_tree"],
    yardTrees: ["cone_tree", "round_tree_small", "poplar_tree"],
    parkTrees: ["round_tree", "round_tree_small", "cone_tree", "poplar_tree"],
    hydrant: "fire_hydrant", trash: "trash_can", bench: "park_bench", benchLong: "park_bench_long",
    fountain: "fountain_large", bushes: ["bush_small", "bush_large", "bush_wide"],
    flowerBeds: ["flower_bed_red", "flower_bed_yellow", "flower_bed_blue", "flower_bed_pink"],
    vending: ["vending_soda", "vending_coffee", "vending_snacks", "atm"],
    backProps: ["recycle_bin_green", "recycle_bin_yellow", "recycle_bin_red", "power_box", "cardboard_box", "trash_can_full"],
    houseDoor: "glass_door_dark", houseDoors: ["glass_door_dark", "glass_door_bright"], houseWindows: ["window_tall", "window_tall_small"], roofProps: ["satellite_dish"],
    roofGear: ["roof_vent", "roof_fan", "roof_vent_slat", "roof_ac_large"],
    streetProps: ["ad_column", "hotdog_cart", "popcorn_cart", "icecream_cart"],
    busStop: "bus_shelter",
    hedge: "hedge_horizontal",
    doorRow: "door_row_bright", doorTall: "glass_door_bright", shopfrontRow: "shopfront_row",
    shopfrontRowEnds: ["shopfront_row_left", "shopfront_row_right"], shopfrontTall: "shopfront_glass", awningSmall: "awning_red_small",
    carsHorizontal: CAR_COLORS.map((c) => [`car_${c}_left`, `car_${c}_right`] as const),
    carsVertical: CAR_COLORS.map((c) => [`car_${c}_down`, `car_${c}_up`] as const),
    laneHorizontal: "lane_line_horizontal", crosswalkVertical: "crosswalk_for_vertical_road", arrowLeft: "arrow_left", arrowRight: "arrow_right",
    arrowUp: "arrow_up", arrowDown: "arrow_down",
  },
  // 3라운드 꾸밈 — 파사드·보도·교차로·옥상·마당·공원에 규칙대로 둔다(townLayout 「꾸밈」 절).
  decor: {
    signs: ["sign_mode", "sign_fashion", "sign_tailor", "sign_barber", "sign_salon", "sign_pharmacy", "sign_hardware", "sign_pizza", "sign_food", "sign_store247", "sign_burger", "sign_mall", "sign_24hrs"],
    banners: ["banner_store", "banner_shop_red"],
    civicSigns: ["sign_police", "sign_fire", "sign_hospital"],
    shopWindowLarge: "shop_window_large",
    shutter: "셔터 벽",
    upperWindows: ["window_lit_wide", "window_dark_wide"],
    upperWindowsTall: ["window_lit_tall", "window_dark_tall"],
    fireEscape: "fire_escape", wallLadder: "wall_ladder", backDoor: "metal_door",
    service: ["dumpster_green", "dumpster_green_2", "dumpster_open", "crate_large", "wheelie_bin_green", "wheelie_bin_black", "wheelie_bins_green_black", "wheelie_bins_yellow_red", "trash_bags", "trash_bags_2", "barrels_gray", "utility_meter", "tire_stack", "box_stack", "power_box"],
    acWall: "ac_unit_wall",
    roofTop: ["roof_solar", "roof_water_tank", "roof_antenna", "satellite_dish", "roof_ac_large", "roof_vent", "roof_vent_slat"],
    helipad: "helipad", roofRailing: "유리 난간",
    cafeTables: ["round_table_red_chairs", "white_round_table", "wood_table"],
    vending: ["vending_soda", "vending_coffee", "vending_snacks"], atm: "atm",
    carts: ["parasol_hotdog_cart", "food_cart", "hotdog_cart", "popcorn_cart", "icecream_cart"], kiosk: "round_kiosk",
    trafficLights: ["traffic_light_green", "traffic_light_red", "traffic_light_yellow", "traffic_light_off"],
    stopSign: "stop_sign", manholes: ["manhole", "manhole_2"], drainVertical: "drain_vertical",
    tactile: "점자 보도블록", cones: ["traffic_cone", "traffic_cones_pair"], bollard: "bollard", guardrail: "guardrail",
    tallLamps: ["tall_lamp", "tall_lamp_lit"],
    walkways: ["붉은 벽돌 섞인 보도", "밝은 회색 보도 타일", "회색 벽돌 보도"], cobbles: ["회색 조약돌 포장", "주황 조약돌 포장", "회색 블록 포장"],
    terraces: ["붉은 타일 바닥", "베이지 타일 바닥", "파란 타일 바닥"], litLamps: ["street_lamp_lit_left", "street_lamp_lit_right"], laneVertical: "lane_line_vertical",
    stains: ["바닥 얼룩", "바닥 균열"],
    planterBed: "콘크리트 틀 화단", planterTrees: ["cone_tree_pot", "cone_tree_planter"],
    yardShrubs: ["bush_wide", "bush_large", "bush_small"], plowed: "갈아 놓은 밭", dirt: "흙 공터",
    pond: "잔디 둘레 연못 물", lily: "수련잎",
    flowingWater: ["흐르는 물", "흐르는 깊은 물", "흐르는 밝은 물", "흐르는 짙은 물", "흐르는 초록 물"],
    bridgeRailing: "콘크리트 난간",
    plazaCore: ["회색 조약돌 포장", "주황 조약돌 포장", "회색 블록 포장"],
    // 특수 건물: 간판 짝은 작가 예시의 공공 건물 재료(회색 사무실·붉은 벽돌·흰 타일).
    civic: [
      { sign: "sign_police", facade: { roof: "짙은 옥상(회색 테두리)", upper: "회색 외벽 검은 창 줄", ground: "회색 콘크리트 외벽", door: "glass_door_dark" } },
      { sign: "sign_fire", facade: { roof: "짙은 옥상(붉은 벽돌 테두리)", upper: "붉은 벽돌 외벽 창문", ground: "붉은 벽돌 외벽", door: "metal_door" } },
      { sign: "sign_hospital", facade: { roof: "밝은 타일 옥상", upper: "밝은 회색 외벽 유리창 줄", ground: "밝은 회색 타일 외벽", door: "glass_door_bright" } },
    ],
    play: ["seesaw", "basketball_hoop", "soccer_goal", "swing"],
    longBenches: ["park_bench_long", "wood_bench_long", "long_bench_wood"], picnic: "picnic_table",
  },
};

const GUIDE = `# Rasak Modern 도시 — 까는 순서

이 타일셋은 RPG Maker MV 팩을 펼친 것이다. 오토타일은 **몸통 칸 하나로 칠하면 가장자리가 저절로 맞는다.**
재료 이름을 \`fill_region\`·\`paint_tiles\` 에 그대로 쓰고, 물체는 \`stamp_tileset_object\` 로 id 를 찍는다.
키 큰 물체(가로등 1×3·자판기 1×2)는 \`base:{x,y}\` = **땅에 닿는 맨 아래 칸**으로 주면 헷갈리지 않는다(\`at\` 은 왼쪽 위 칸).

## 0. 마을·동네 한 장은 \`build_pack_town\` 부터
빈 맵(40×30 이상, 50×40 권장)에 **먼저 \`build_pack_town\`** 을 부른다 — 뒷골목·뒷주차, 벽을 맞댄 가게 줄, 큰길·교차로,
잔디 띠, 앞마당·진입로가 있는 주택, 분수 공원, 가로등·가로수를 자연스러운 치수로 한 번에 깐다.
손으로 칸마다 깔면 같은 간격 네모 건물이 빈 보도 바다에 뜬다. 뼈대를 깐 뒤에 할 일:
- 결과 \`lots[].door\` 에 이동 이벤트·NPC. 가게마다 노점·자판기·화분·벤치를 1~3개씩 **모아서** 더한다(고르게 흩뿌리지 않는다).
- 마음에 안 들면 \`seed\` 를 바꿔 \`replace:true\` 로 다시. 부분만 고칠 땐 아래 규칙대로 손으로.
- 끝나면 \`check_town_map\` — issues 가 빌 때까지 고친다.

### 손으로 깔거나 고칠 때 — 자연스러운 마을 규칙 (미국 소도시 실측 → 칸)
- 길은 위계가 있다: 큰길 7칸(중앙선) · 골목길 5칸 · 뒷골목 2~3칸. **교차로가 하나 이상** — 곧은 길 하나만 긋지 않는다. 길은 맵 밖으로 이어진다.
- 횡단보도는 **교차로에만**(\`"횡단보도 테두리 차도"\`). 교차로 아닌 곳에 긋지 않는다.
- 가게 줄: 건물끼리 **벽을 맞댄다(틈 0)**, 보도에 바로 붙는다. 폭 4~6칸(가끔 7~10), 이웃과 폭·층·재료가 겹치지 않게, 모퉁이가 가장 높게.
  차양은 가게의 절반~2/3 에만. 통로(2~3칸)는 한 줄에 한 곳만.
- 가게 뒤는 뒷골목과 **뒷주차**(주차 칸 선). 주차장을 가게와 큰길 사이에 두지 않는다.
- 주택: 필지 8~12칸, 집 5~8칸, 앞마당 3~5칸, 이웃과 틈 1~4칸(쌍마다 다르게). 문 → 보도 현관길 1칸, 집 옆 진입로 2칸.
  앞마당엔 화단·덤불·나무 중 2가지 이상, 뒷마당엔 울타리·나무·텃밭. 빈 잔디 네모로 두지 않는다.
- 차도 옆은 **연석 → 잔디 띠 1칸 → 보도**(주택가). 가로수는 잔디 띠에 3~7칸 불규칙 간격, 가로등 6~10칸 간격(길 건너와 엇갈리게).
- 같은 바닥이 물체 없이 **6×6(36칸)을 넘지 않게**. 보도는 맵의 25% 이하. **맵 끝 2줄 이상을 빈 띠로 두지 않는다**(맨 윗줄도).
- 좌우 대칭·같은 간격 격자를 피한다. 랜드마크(분수 공원 등) 하나를 큰길에서 보이게, 한가운데를 조금 비켜.

## 1. 바닥 (아래층)
- 차도 = \`fill_region material:"아스팔트 차도"\`. **폭은 홀수(5·7칸)** — 중앙선 물체는 칸 한가운데에 선이 있어서 짝수 폭이면 반 칸 치우친다.
  중앙선은 가운데 줄에 \`lane_line_horizontal\`(가로 차도)·\`lane_line_vertical\`(세로 차도)을 \`repeat\` 로 이어 찍는다. 횡단보도 칸은 비운다.
- 차선 화살표는 **우측통행**: 가로 차도의 \`arrow_right\` 는 중앙선 **아래** 차로, \`arrow_left\` 는 **위** 차로.
  세로 차도의 \`arrow_up\` 은 중앙선 **오른쪽**, \`arrow_down\` 은 **왼쪽**. 교차로 쪽으로 향하게 횡단보도 바로 앞에 둔다.
- 보도 = 차도 양옆 2~4칸 \`"회색 콘크리트 보도"\`. 광장은 \`"베이지 광장 타일"\`·\`"회색 벽돌 보도"\`.
- 공원·화단 = \`"잔디"\`(A1) 또는 \`"콘크리트 틀 화단"\`. 강 = \`"돌 둑 수로 물"\`.
- 교차로 한가운데 = \`"횡단보도 테두리 차도"\` 사각형(가장자리에 횡단보도 줄이 저절로 생긴다). 두 차도가 겹치는 칸만큼(5칸 차도끼리면 5×5).
  이 사각형 둘레에는 횡단보도 물체를 더 찍지 않는다 — 줄무늬가 두 겹이 된다(도구가 거부한다).
- 교차로가 아닌 곳의 횡단보도는 물체를 **차도 줄에만** 이어 찍는다 — 가로 차도가 11~15행이면 \`at:{x, y:11}, repeat:{x:2, y:5}\`. 보도에 걸치면 거부된다.

## 2. 건물 — 층으로 쌓는다 (작가 예시 건물에서 뽑은 규칙)
**창이 그려진 외벽(\`…창문\`·\`…유리창 줄\`·\`…검은 창 줄\`)은 한 줄이 한 층이다.** 외벽 사각형 하나를 전부 창 난 벽으로 칠하고
문·차양을 얹으면 문이 2층을 뚫고 차양이 3층에 달린다. 건물은 위에서 아래로 띠를 쌓는다:
1. **옥상 1~3줄.** 높은 건물일수록 얕게. 옥상 줄 수가 외벽 줄 수보다 많으면 안 된다.
2. **위층 = 창 난 외벽 N줄 = N개 층.** 아파트·사무실·모텔은 2~5줄.
3. **1층 띠 = 맨 아래 1~2줄, 창 없는 다른 외벽.** 문·쇼윈도·간판은 이 띠에만 찍는다.
   - 벽돌 건물: 위층 \`"붉은 벽돌 외벽 창문"\` + 1층 \`"붉은 벽돌 외벽"\`(주황·회색·검은 벽돌도 같은 짝).
   - 사무실·상가: 위층 \`"회색 외벽 유리창 줄"\`·\`"회색 상가 외벽(유리·셔터)"\` + 1층 \`"회색 유리 상가 외벽"\`.
4. **(2층 가게·호텔) 층 사이 처마 1줄** — 위층 벽과 1층 띠 사이에 지붕 재료 한 줄(\`"검은 비늘 지붕"\`·\`"짙은 옥상(회색 테두리)"\`).
   이때 위층은 창 없는 벽 2줄 + \`window_tall\`(세로창)을 1~2칸 띄워 단다.

문·차양 자리:
- 문(1×2)은 \`base\` = 외벽 **맨 아래 줄**. 쇼윈도는 \`shopfront_glass\`(1×2)를 문 옆에 \`repeat\` 로.
- **1줄 1층 띠**(작가 회색 상가·갈색 벽돌 가게): 맨 아래 줄에 \`door_row_bright\`·\`door_row_dark\`(1×1 문) 하나와
  \`shopfront_row_left\` → \`shopfront_row\` ×N → \`shopfront_row_right\`(1×1 쇼윈도 줄)를 잇는다. 그 윗줄에 차양의 그늘 줄이 온다.
  문 옆에 쇼윈도를 붙이면 쇼윈도 한 덩어리마다 양끝 조각을 다시 쓴다(끝이 끊긴 유리창이 되지 않게).
- 위층 세로창은 \`window_tall\`(1×2, 벽 2줄 = 한 층). 벽돌·판자 벽에 1~2칸씩 띄운다.
- 차양은 **문 윗칸 줄**에 단다 — \`awning_red_small\` 은 at=(문 x, 맨 아래 줄-1), 3칸 \`awning_red\` 는 at=(문 x-1, 맨 아래 줄-1).
  차양 줄무늬가 문 윗칸을 덮고 문 아랫칸은 차양 그늘 위에 그려진다(찍는 순서는 상관없다). 위층 줄에 차양을 달지 않는다.

예시 (위→아래, 폭 7):
- 모텔 4층: 옥상 \`"짙은 옥상(주황 벽돌 테두리)"\` 2줄 → \`"주황 벽돌 외벽 창문"\` 3줄 → \`"주황 벽돌 외벽"\` 1줄(문·차양·자판기).
- 2층 벽돌 가게: 지붕 \`"검은 비늘 지붕"\` 3줄 → \`"붉은 벽돌 외벽"\` 2줄 + 세로창 → 처마 \`"검은 비늘 지붕"\` 1줄 → \`"붉은 벽돌 외벽"\` 2줄(문 + 통유리).
- 유리 상가 3층: \`"유리 지붕"\` 2줄 → \`"회색 상가 외벽(유리·셔터)"\` 2줄 → \`"회색 유리 상가 외벽"\` 1줄(차양 + 문).
- 회색 상가(작가 교차로, 폭 5): \`"사각 유리 지붕"\` 3줄 → \`"사각 외벽 회색 상가"\` 3줄 → 1층 \`"사각 외벽 회색 유리 상가"\` 1줄에
  \`shopfront_row_left\`·\`shopfront_row\`·\`shopfront_row_right\` + \`door_row_bright\`, 그 윗줄에 \`awning_red\`.

주택(A3 기와·벽): 지붕 2~3줄 + 벽 2줄. 벽 2줄이 한 층이다. 문 옆에 \`window_tall\`·\`window_lit_wide\` 를 1~2개 달고,
집마다 지붕·벽 색을 바꾼다. 마당은 문 앞으로 둔다.
- 외벽 맨 아래 줄 문 칸만 걸을 수 있다 — 이동 이벤트는 문 칸에.
- 옥상에는 설비를 건물마다 0~2개: \`roof_vent\`·\`roof_vent_slat\`(환기구), \`roof_fan\`(실외기), \`roof_ac_large\`(2칸, 폭 5칸 이상),
  \`satellite_dish\`(2×2). 모든 옥상에 같은 것을 같은 자리에 두지 않는다. 뒷면·옆면 외벽에 \`wall_ladder\`(1×3)·\`fire_escape\`.

## 3. 물체 (위층)
- 가로등은 보도 바깥쪽(차도 쪽) 줄을 따라 6~8칸 간격. 신호등은 교차로 네 모서리.
- 쓰레기통·소화전·자판기는 보도 안쪽(건물 쪽). 벤치·분수·덤불은 공원.
- 가게 앞 보도에는 가게마다 다른 것을 가끔: \`ad_column\`(원통 광고탑), \`hotdog_cart\`·\`popcorn_cart\`·\`icecream_cart\`, \`round_kiosk\`.
- 큰길 보도에 \`bus_shelter\`(버스 정류장 3×2) 한 곳 — 교차로에서 2칸 이상 떼어.
- 자동차 \`car_<색>_left/_right\`(가로 4×3, 아래 두 줄이 막힘)·\`car_<색>_down/_up\`(세로 2×3). 색: red·white·blue·black·green. 차도·주차장 위에만 둔다 — 보도·횡단보도·교차로 위 금지. 오른쪽 통행: 가로 길 북쪽 차선은 _left, 남쪽 차선은 _right. 캐릭터 시트 \`!Car1.png\`(Animations/Vehicles/ModernCars)를 같이 올려야 보인다.
- 나무는 수종을 섞는다(한 수종이 나무의 45%를 넘지 않게). 가로수(잔디 띠 1칸)는 \`cone_tree\`·\`poplar_tree\`(키 큰 미루나무 1×4)·\`round_tree_small\` —
  간격은 3~7칸으로 흔들고 모통이·진입로·공원 입구 앞에서 끊는다. 화분 나무(\`cone_tree_pot\`·\`cone_tree_planter\`)는 포장된 보도·광장에만.
  공원·넓은 마당은 \`round_tree\`(2×4)·\`round_tree_small\`(2×2)를 섞고, 가장자리에 \`bush_wide\`·\`hedge_horizontal\`.
- 물체 밑칸은 막힌다. 길을 막지 않게 보도 폭의 절반 이상을 비워 둔다.

## 4. 겹침 오토타일 (위층)
울타리·난간·주차선·균열은 바닥 위에 겹쳐 깐다 — \`fill_region\` 이 알아서 위층에 깐다(바닥을 지우지 않는다).
- 울타리·난간은 **1칸 두께 선**이다. 면으로 채우면 격자판이 된다 — 둘레 네 변을 \`fill_region\` 1칸 폭 사각형 네 번으로 깐다.
- 울타리 선은 칸 **한가운데**에 그려진다. 마당을 두르려면 잔디 사각형의 **바깥 테두리 칸 위**(잔디 안쪽 끝 줄)에 깐다 — 잔디 밖 보도 줄에 깔면 반 칸 떠 보인다.
  네 변은 모서리 칸을 함께 써서 닫고, 드나드는 곳은 **길·보도 쪽 변**에서 2칸만 비운다(\`tile_erase layer:"upper"\` 로 지우면 끝 모양이 저절로 맞는다).
  집 문 → 마당 → 울타리 틈 → 보도가 한 줄로 이어져야 한다. 집 벽에 붙은 변은 벽이 막으니 울타리를 치지 않는다.
- 얼룩·균열은 넓게 깔지 말고 2×2~3×3 조각 몇 개만.

## 5. 확인
다 깔았으면 \`show_map_region\` 으로 그림을 보고, 예시 블록 그림과 짜임(건물-보도-차도 순서, 문 위치, 가로등 간격)을 비교한다.
`;

export const RASAK_MODERN_CITY: MvPackPreset = {
  id: "rasak-modern-city",
  version: 1,
  name: "Rasak Modern · 도시 야외",
  pack: "Rasak Modern Tileset",
  author: "Rasak",
  url: "https://rasak.itch.io/rasak-modern",
  credit: "Tileset: Rasak Modern Tileset by Rasak (https://rasak.itch.io/rasak-modern)",
  license: "사용·수정 가능(크레딧 필수). 원본·수정본 그림의 재배포 금지, 링크는 허용.",
  sheets: [
    { file: A1, folder: "Tilesets/City", sha256: "1767ea2197396b3eba6e61ee25dd53230ccfb06430835b692c993df4fa6e524e" },
    { file: A2, folder: "Tilesets/City", sha256: "8f7db25a09ec2b4badcad4b27bef3d76f0e4971c0ed0adaa69678d31730be85b" },
    { file: A3, folder: "Tilesets/City", sha256: "2952d853455dd3c072212cfe0f333d77aac59a1f430afd7e3c46affdc047836f" },
    { file: A3B, folder: "Tilesets/City", sha256: "2f9e900bbd9243361f35f978a3e095d43a8b07d2e536161cfc53db0d233b42a5" },
    { file: A4, folder: "Tilesets/City", sha256: "0a5395bbc8f1e25e2234e66815e9f260b6e51be604b6a2009e59fcd4df65f942" },
    { file: A4D, folder: "Tilesets/City", sha256: "eaec61494a63d1420f96dd90e23e1f6a55ae642bf74006591ce4c7769c4a7639" },
    { file: A5, folder: "Tilesets/City", sha256: "33d384be065c0024e206f7994bd95fc88f2f82615fd7beb0593c8a38ceff0f6e" },
    { file: A5S, folder: "Tilesets/City", sha256: "db4b601ed126dea96e8ad504fa1c1aebebb595d481cd66b9152495f551979d64" },
    { file: STREET, folder: "Tilesets/City", sha256: "afa13ba0627ac3a5a73464de93234dd90c98fef22f0368e5e05bbf2f6d0125aa" },
    { file: SHOP, folder: "Tilesets/City", sha256: "0adc90d5e9da7b9d266575216862eb3c698ced7460e58ba8488dd8e6cd1cbbf2" },
    { file: GARBAGE, folder: "Tilesets/City", sha256: "ce499b8544c99bbf93c85d617be0cbcd14a8521ea8876b3ffaf892c3a038ecea" },
    { file: EXTRAS, folder: "Tilesets/City", sha256: "e327ac6819478a86ac688239cd161a6fa4b26b9ef543bfa72aa29232cbb8962c" },
    { file: PARK, folder: "Tilesets/City", sha256: "98485957a640b182d7f25bb41f755c70e909fd8e87a2042b008571382b842a02" },
    { file: SLUMS, folder: "Tilesets/City", sha256: "33b5162f00a34c0469bc7007ce5a0dc17c682f508657f61f495e8c4f57d98fe9" },
    { file: "Tileset_Modern_PublicTransportation_Clean_Rasak.png", folder: "Tilesets/City", sha256: "5719e05429835bcb6175a3bcf009a0b19eb4668d542c94d2ed83d32099990e92" },
    { file: "Tileset_Modern_PublicTransportation_Dirty_Rasak.png.png", folder: "Tilesets/City", sha256: "9b442ce9ba7624f921b898d70ba6272cb23f847a28601bbf0f06db1750dcd4da" },
    { file: "Tileset_Modern_PublicTransportation_Slums_Rasak.png.png", folder: "Tilesets/City", sha256: "e92c3b4609ad56ed9e60b9d63e8ab46a684bfe95c8322d233e905923cc41e4ca" },
    // 맨 끝에 붙인다 — 앞 시트들의 아틀라스 칸 번호가 그대로 남는다(layout.ts 는 앞에서부터 쌓는다).
    { file: CAR_SHEET, folder: "Animations/Vehicles/ModernCars", sha256: "98905fbac219f4fa57e5251c1d2e3cbc129599c40ec0d7c64566f7bbad5dd9d1" },
  ],
  autotiles: AUTOTILES,
  flats: [
    { sheet: A5, cell: 16, name: "보도 연석", role: "ground", description: "보도와 차도 사이 한 줄. 아래 가장자리에 턱이 있다" },
    { sheet: A5, cell: 24, name: "아스팔트 평면", role: "road" },
    { sheet: A5, cell: 26, name: "중앙선 차도(가로)", role: "road" },
    { sheet: A5, cell: 25, name: "중앙선 차도(세로)", role: "road" },
    { sheet: A5, cell: 35, name: "횡단보도 차도(가로 줄)", role: "road" },
    { sheet: A5, cell: 27, name: "횡단보도 차도(세로 줄)", role: "road" },
    { sheet: A5, cell: 30, name: "회색 조약돌 포장", role: "ground" },
    { sheet: A5, cell: 31, name: "회색 판석 산책로", role: "ground", description: "강변·공원 산책로" },
    { sheet: A5, cell: 38, name: "주황 조약돌 포장", role: "ground" },
    { sheet: A5, cell: 39, name: "회색 블록 포장", role: "ground" },
    { sheet: A5, cell: 21, name: "붉은 타일 바닥", role: "ground" },
    { sheet: A5, cell: 22, name: "파란 타일 바닥", role: "ground" },
    { sheet: A5, cell: 23, name: "베이지 타일 바닥", role: "ground" },
    { sheet: A5, cell: 92, name: "잔디 평면", role: "ground" },
    { sheet: A5, cell: 93, name: "꽃 잔디 평면", role: "ground" },
    { sheet: A5, cell: 72, name: "셔터 벽", role: "wall", description: "창고·차고 셔터" },
  ],
  objects: OBJECTS,
  // 벽돌 외벽은 창 난 종류와 민짜가 짝이다(A4 40·42·44·46 → 41·43·45·47, A3 둘째 장 26 → 27).
  plainWalls: [
    ...[A4, A4D].flatMap((sheet) => [40, 42, 44, 46].map((kind) => ({ sheet, kind, plainKind: kind + 1 }))),
    { sheet: A3B, kind: 26, plainKind: 27 },
  ],
  town: TOWN,
  guide: GUIDE,
};
