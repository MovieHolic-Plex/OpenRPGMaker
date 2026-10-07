/**
 * 실내 지역 시트 쇼케이스·검사. bash cycle_theme.sh monster-rooms <run>
 * 방 틀은 showcase_interior.mts 의 Room2 문법을 옮겨 쓴다(import 하지 않음 — 그 파일은 실행 스크립트):
 * 뒷벽 두 줄 · 옆·아래 검은 여백에 흰 천장 끝 띠 · 벽 밑 한 톤 그늘 · 아래 벽선 가운데 매트(출구 틈).
 * 각 방은 「입구 매트 → 주요 가구 앞」 도달을 엔진 canMove 로 검사하고, 정상/오류 쌍(k.negative)으로 막힌 입구·통로를 엔진이 잡는지 증명한다.
 */
import { Kit, type Cell } from "./kitlib.mts";
const k = new Kit(process.argv[2]);

type RoomOpt = { wall: string; floor: string; mat?: boolean; lgTheme?: string };
/** 방 틀. 바닥 칸 이름은 `${floor}${(x+y)%2}`, 벽 밑 줄은 `${floor}_s`. mat=false 면 아래 벽을 닫는다(선실처럼 문이 벽에 있는 방). */
function room(name: string, W: number, H: number, o: RoomOpt, scale = 3) {
  const f = k.field(name, W, H, () => "i2_edge_v", scale);
  const fl = (x: number, y: number) => (o.lgTheme ? (y === 2 ? `rm_fl_lg_${o.lgTheme}_s` : (x === 1 || x === W - 2) ? `rm_fl_lgb_${o.lgTheme}` : `rm_fl_lg_${o.lgTheme}`) : y === 2 ? `${o.floor}_s` : `${o.floor}${(x + y) % 2}`);
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) f.lo(x, y, fl(x, y));
  wallRow(f, 1, W - 2, 0, o.wall);
  for (let y = 0; y < H - 1; y++) { f.lo(0, y, "i2_edge_r"); f.lo(W - 1, y, "i2_edge_l"); }
  for (let x = 1; x < W - 1; x++) f.lo(x, H - 1, "i2_edge_t");
  f.lo(0, H - 1, "i2_edge_rt"); f.lo(W - 1, H - 1, "i2_edge_lt");
  const mx = W >> 1;
  // 사천왕 방은 매트 없이 테마 바닥이 그대로 아래로 이어진다(원작) — 출구는 아래 벽선의 틈(i2_edge_mat)으로만 표시한다.
  if (o.mat !== false) { f.lo(mx, H - 2, o.lgTheme ? `rm_fl_lg_${o.lgTheme}` : o.floor.replace("rm_fl_", "rm_mat_")); f.lo(mx, H - 1, "i2_edge_mat"); }
  return { f, mat: [mx, H - 2] as Cell, fl };
}
/** 벽 두 줄(y0, y0+1)을 x0..x1 에 깐다 — 양 끝 칸은 외곽선이 있는 _l/_r. */
function wallRow(f: any, x0: number, x1: number, y0: number, wall: string) {
  for (let x = x0; x <= x1; x++) for (const [r, part] of [[0, "up"], [1, "dn"]] as const) f.lo(x, y0 + r, `${wall}_${part}${x === x0 ? "_l" : x === x1 ? "_r" : ""}`);
}
const at = (x: number, y: number): Cell => [x, y];

// 1) 박사 연구소 15×12 — 뒷벽에 컴퓨터 줄(랙 넷)·분석 기계·연구원 책상(현미경), 벽 도표, 책장, 왼쪽 큰 실험 기계,
//    오른쪽 시작 몬스터 탁자, 아래 바닥 책장 3+3(양쪽 벽에 붙이고 가운데 1칸 통로), 아래 구석 화분. (원작 오박사 연구소 13×14 비례)
{
  const { f, mat } = room("lab", 15, 12, { wall: "rm_wall_lab", floor: "rm_fl_lab" });
  for (let x = 1; x <= 4; x++) f.stamp("lab_server", x, 1);
  f.stamp("lab_machine", 5, 1); f.stamp("lab_chart", 7, 0); f.stamp("lab_desk", 9, 1); f.stamp("lab_chair", 10, 3);
  f.stamp("lab_shelf", 11, 1);
  f.stamp("plant2", 13, 1);
  f.stamp("lab_bigmachine", 2, 3);
  f.stamp("lab_balltable", 9, 4);
  for (const x of [1, 3, 5, 8, 10, 12]) f.stamp("lab_shelf_free", x, 7);
  f.stamp("plant2", 1, 9); f.stamp("plant2", 13, 9);
  f.save();
  k.describe(f, "박사 연구소: 뒷벽에 기계·책상을 붙이고, 아래쪽은 양쪽 벽에 붙인 바닥 책장 3+3 사이 가운데 1칸 통로로만 위쪽(실험 기계·시작 몬스터 탁자)에 간다.");
  k.expectReach(f, mat, [at(10, 6), at(3, 6), at(9, 3), at(13, 6), at(7, 7), at(6, 9)], "입구 → 몬스터 탁자·실험 기계·연구원 책상·책장 통로·책장 앞");
  k.negative(f, "aisle-blocked", "책장 사이 가운데 통로에 화분을 놓아 위쪽이 막힘", (g) => g.stamp("plant2", 7, 7), mat, [at(10, 6), at(3, 6)]);
}

// 2) 트레이너 학교 15×12 — 뒷벽 칠판(가운데)·창 둘(양 끝)·게시판·시계, 칠판 밑 주황 교단, 교단 앞 교탁(다리 보이는 밝은 탁자),
//    학생 책상 4열×3줄(가운데 통로), 아래 구석 화분. (원작 루스트보로 트레이너 학교 비례)
{
  const { f, mat } = room("school", 15, 12, { wall: "rm_wall_school", floor: "rm_fl_school" });
  f.stamp("sc_window", 1, 0); f.stamp("sc_bulletin", 3, 0); f.stamp("sc_board", 6, 0); f.stamp("sc_clock", 10, 0); f.stamp("sc_window", 12, 0);
  f.stamp("sc_dais", 5, 2);
  f.stamp("sc_lectern", 6, 4);
  for (const x of [2, 4, 10, 12]) for (const y of [5, 7, 9]) f.stamp("sc_desk", x, y);
  f.save();
  k.describe(f, "트레이너 학교: 칠판 밑 바닥 줄에 교단(막힘), 그 앞에 교탁, 책상+의자 4열×3줄을 가운데 통로로 갈라 놓는다. 선생 자리는 교단과 교탁 사이 줄.");
  k.expectReach(f, mat, [at(7, 3), at(7, 6), at(3, 6), at(11, 8), at(1, 3)], "입구 → 선생 자리(교단과 교탁 사이)·교탁 앞·책상 사이 통로");
  k.negative(f, "aisle-blocked", "선생 자리 양옆(교탁 끝과 교단 사이)을 화분으로 막아 선생 자리에 못 감", (g) => { g.stamp("plant2", 5, 3); g.stamp("plant2", 9, 3); }, mat, [at(7, 3)]);
}

// 3) 해양 박물관 20×10 — 벽 따라 1칸 어두운 체크 테두리, 안쪽 밝은 체크 직사각 카펫(오토타일, 모서리 직각),
//    뒷벽 왼쪽 2층 계단 아치·수조 둘·유리 원통 진열장 둘·명판, 카펫 위 배 모형(줄 차단봉)·화석·진열대·원통 진열장,
//    입구 매트 양옆 ∩자 접수대 둘. (원작 해양 박물관 1F 20×9 비례)
{
  const { f, mat } = room("museum", 20, 10, { wall: "rm_wall_museum", floor: "rm_fl_museum" });
  f.paint("mu_carpet", k.rect(2, 3, 17, 8)); f.shape();
  f.lo(10, 8, "rm_mat_museum");                                               // 매트는 카펫을 칠한 뒤 다시 놓는다(카펫 모양은 그대로)
  f.stamp("mu_tank", 2, 1); f.stamp("mu_plaque", 4, 0); f.stamp("mu_stairs", 5, 0);
  f.stamp("mu_case_shell", 8, 1); f.stamp("mu_case_amber", 12, 1);
  f.stamp("mu_plaque", 15, 0); f.stamp("mu_tank", 16, 1);
  f.stamp("mu_ship", 9, 2);
  f.stamp("mu_rope_l", 8, 4); for (const x of [9, 10, 11]) f.stamp("mu_rope_m", x, 4); f.stamp("mu_rope_r", 12, 4);
  f.stamp("mu_fossil", 4, 3);
  f.stamp("mu_vitrine", 14, 3);
  f.stamp("mu_case_shell", 3, 6); f.stamp("mu_case_amber", 16, 6);
  f.stamp("mu_udesk", 7, 6); f.stamp("mu_udesk", 11, 6);
  f.stamp("plant2", 1, 7); f.stamp("plant2", 18, 7);
  f.save();
  k.describe(f, "해양 박물관: 매트 바로 위 1칸이 ∩자 접수대 둘 사이의 유일한 입구다. 안쪽 밝은 카펫은 mu_carpet 오토타일로 칠하고(벽에서 1칸 띄움), 배 모형 앞은 줄 차단봉으로 막는다. 2층 계단 아치는 뒷벽 칸이고 입구 칸 (0,1).");
  k.expectReach(f, mat, [at(10, 6), at(10, 5), at(5, 5), at(15, 5), at(5, 2), at(8, 3), at(13, 3)], "입구 → 접수대 사이·줄 앞·화석 앞·진열대 앞·계단 아치 앞·배 모형 양옆");
  k.expectNoReach(f, mat, [at(8, 7), at(12, 7), at(8, 8), at(12, 8)], "∩자 접수대 안쪽(접수원 자리)으로는 못 간다");
  k.negative(f, "entry-blocked", "매트 바로 위(두 접수대 사이) 칸에 안내판을 세워 박물관 안으로 못 들어감", (g) => g.stamp("mu_sign", 10, 7), mat, [at(10, 6), at(5, 5), at(15, 5)]);
}

// 4) 백화점 1층 17×11 — 뒷벽 엘리베이터(문턱 발판)·층 표시·에스컬레이터(천장 띠 아래에서 시작 + 빗살 발판), 층 안내판,
//    뒷벽 밑 U자 카운터(양 끝 다리가 벽 쪽으로 꺾임, 안쪽 점원 자리), 진열 선반 여러 종, 화분. (원작 무지개시티 백화점 1F 비례)
{
  const { f, mat } = room("dept", 17, 11, { wall: "rm_wall_dept", floor: "rm_fl_dept" });
  f.stamp("dp_elevator", 2, 0); f.stamp("dp_elevfoot", 2, 2); f.stamp("dp_sign1f", 4, 0);
  f.stamp("dp_escalator", 13, 0); f.stamp("dp_escfoot", 13, 2);
  f.stamp("dp_directory", 11, 2);
  f.stamp("dp_counter", 6, 2);
  f.stamp("dp_shelf", 1, 5); f.stamp("dp_shelf", 1, 7);
  f.stamp("dp_showcase", 5, 7); f.stamp("dp_showcase", 9, 7);
  f.stamp("dp_rack", 14, 5); f.stamp("dp_rack", 14, 7);
  f.stamp("plant2", 5, 1); f.stamp("plant2", 15, 1);
  f.save();
  k.describe(f, "백화점 1층: 뒷벽 왼쪽 엘리베이터·오른쪽 에스컬레이터(둘 다 아래 발판 칸이 이동 이벤트 자리), 뒷벽 밑 U자 카운터 안쪽은 점원 자리라 손님이 못 들어간다. 진열장은 벽과 바닥에 줄지어.");
  k.expectReach(f, mat, [at(2, 2), at(13, 2), at(8, 5), at(4, 6), at(13, 6), at(10, 9), at(12, 3)], "입구 → 엘리베이터 발판·에스컬레이터 발판·카운터 앞·선반 사이·안내판 옆");
  k.expectNoReach(f, mat, [at(7, 2), at(8, 3), at(9, 2)], "U자 카운터 안쪽(점원 자리)으로는 못 들어간다");
  k.negative(f, "escalator-blocked", "에스컬레이터 발판 앞을 화분으로 막음(안내판 옆 통로와 발판 아래 칸)", (g) => { g.stamp("plant2", 12, 2); g.stamp("plant2", 13, 3); g.stamp("plant2", 14, 3); }, mat, [at(13, 2), at(14, 2)]);
}

// 5a) 배 복도 20×6 — 흰 철판 벽에 선실 문 넷·현창, 남보라 카펫, 왼쪽 끝 흰 철 난간 계단(아래층으로), 아래 매트(갑판으로)
{
  const { f, mat } = room("ship_corridor", 20, 6, { wall: "rm_wall_ship", floor: "rm_fl_carpet" });
  for (const x of [5, 9, 13, 17]) f.stamp("sh_door", x, 0);
  for (const x of [7, 11, 15]) f.stamp("sh_porthole", x, 0);
  f.stamp("sh_stairs", 1, 1);
  f.stamp("plant2", 18, 1);
  f.stamp("sh_bench", 7, 2); f.stamp("sh_bench", 15, 2); f.stamp("sh_extinguisher", 11, 2);
  f.save();
  k.describe(f, "배 복도: 흰 철판 벽에 선실 문(문 칸이 입구)을 2칸 걸러 하나, 사이에 현창, 문 사이 벽 밑에 벤치·소화기(문 앞 칸은 비운다). 한쪽 끝 철 계단은 아래층 이동 이벤트 자리.");
  k.expectReach(f, mat, [at(5, 1), at(9, 1), at(13, 1), at(17, 1), at(3, 3)], "입구 → 선실 문 넷(문 칸으로 들어선다)·계단 옆");
}

// 5b) 선실 9×9 — 나무 판벽 가운데 문(복도로), 현창·구명튜브, 침대 둘(머리판을 벽에, 3/4 앞면·다리), 탁자와 의자, 휴지통. 붉은 점 카펫. 아래 벽은 닫힌다.
{
  const { f } = room("ship_cabin", 9, 9, { wall: "rm_wall_cabin", floor: "rm_fl_cabin", mat: false });
  f.stamp("sh_door", 4, 0); f.stamp("sh_porthole", 3, 0); f.stamp("sh_lifering_wall", 5, 0);
  f.stamp("sh_bed", 1, 1); f.stamp("sh_bed", 6, 1);
  f.stamp("sh_table", 3, 4); f.stamp("h_chair_r", 2, 4); f.stamp("h_chair_l", 5, 4);
  f.stamp("sh_bin", 7, 6);
  f.save();
  k.describe(f, "배 선실: 문은 뒷벽 가운데(문 칸 = 복도로 가는 이동 이벤트 자리), 침대 머리판을 뒷벽에 붙이고 탁자는 가운데, 아래 벽은 닫힌다.");
  k.expectReach(f, [4, 2], [at(4, 1), at(3, 3), at(5, 7), at(1, 7), at(7, 4)], "문 → 침대 사이·탁자 위쪽·방 구석·휴지통 옆");
}

// 5c) 갑판 20×13 — 원작 상트안느호 갑판 문법: 북쪽 가로 난간(밖은 바다) · 왼쪽 뾰족한 뱃머리(난간이 1:2 사선으로 대칭으로 모인다) ·
//     갑판 안 오른쪽에 선실(지붕 윗면 2줄 + 앞벽 2줄, 서쪽 끝 지붕 모서리) · 앞 난간 밑 선체 옆면 3줄 · 배는 오른쪽 맵 끝 밖으로 이어진다(선미 없음).
//     접이 의자·둥근 탁자·환기통·계류 기둥·나무 통·구명튜브.
{
  const W = 20, H = 13;
  const f = k.field("ship_deck", W, H, () => "rm_sea_f0");
  for (let x = 7; x < W; x++) {
    f.lo(x, 2, "rm_rail_t_f0");
    for (let y = 3; y <= 8; y++) f.lo(x, y, `rm_fl_deck${(x + y) % 2}`);
    f.lo(x, 9, "rm_rail_b"); f.lo(x, 10, "rm_hull_t"); f.lo(x, 11, "rm_hull_m"); f.lo(x, 12, "rm_hull_b_f0");
  }
  for (let x = 12; x < W; x++) { f.lo(x, 3, x === 12 ? "rm_dh_roof_tl" : "rm_dh_roof_t"); f.lo(x, 4, x === 12 ? "rm_dh_roof_l" : "rm_dh_roof_c"); }
  wallRow(f, 12, W, 5, "rm_wall_deckhouse");                                   // 오른쪽 끝은 맵 밖으로 이어진다(_r 없음)
  f.stamp("sh_bow", 0, 0); f.stamp("rmw_bow", 0, 0);
  f.stamp("sh_door", 14, 5); for (const x of [16, 18]) f.stamp("sh_porthole", x, 5);
  for (const x of [9, 16]) f.stamp("sh_lifering", x, 9);
  f.stamp("sh_deckchair", 8, 3); f.stamp("sh_roundtable", 9, 4); f.stamp("sh_deckchair", 10, 3);
  f.stamp("sh_deckchair", 5, 4, { overlap: true }); f.stamp("sh_roundtable", 4, 5, { overlap: true });   // 뱃머리 널(rmw_bow, 하위층 바닥) 위 가구 — 의도적 겹침
  f.stamp("sh_vent", 11, 3);
  f.stamp("sh_bollard", 10, 8);
  f.stamp("sh_barrel", 18, 7); f.stamp("sh_barrel", 19, 7); f.stamp("sh_barrel", 19, 8);
  f.save();
  k.describe(f, "배 갑판: 바다 rm_sea_f0(해안 시트와 같은 물, 4프레임) 바탕에 북쪽 난간 rm_rail_t_f0 · 갑판 널 · 앞 난간 rm_rail_b · 선체 rm_hull_t/m/b_f0 를 맵 오른쪽 끝까지 깔고(선미 없이 이어짐), 갑판 안에 선실 지붕 rm_dh_roof_* 2줄 + 앞벽 2줄(문 칸 = 선실 입구)을 세운 뒤, 왼쪽 끝에 뱃머리 물체(sh_bow + rmw_bow, 원점 (0,0))를 찍는다. 갑판 끝까지 걸어도 난간 밖 바다·선체로는 못 나간다.");
  k.expectReach(f, [14, 6], [at(14, 7), at(3, 6), at(7, 3), at(11, 8), at(18, 8), at(6, 4)], "선실 문 → 갑판 북쪽·뱃머리 끝·앞 난간 앞·오른쪽 끝");
  k.expectNoReach(f, [14, 6], [at(14, 9), at(0, 6), at(10, 2), at(5, 11), at(13, 4)], "난간 밖(선체·바다·뱃머리 끝)과 선실 지붕으로 못 나간다");
  k.negative(f, "door-blocked", "선실 문 앞 칸에 나무 통을 놓아 문에서 갑판으로 못 나감", (g) => { g.stamp("sh_barrel", 14, 7); }, [14, 6], [at(14, 8), at(3, 6)]);
}

// 6) 사천왕 방 15×14 네 장 — 뒷벽 가운데 봉인 문 · 뒷벽 밑 매달린 등(칸마다) · 문 앞은 바닥 · 가운데 5×5 경기장 선(반원 두 테마 색) ·
//    좌우 옆벽에 붙은 3×5 테마 블록 · 맨 위 줄과 양 옆 줄은 한 톤 진한 테두리 바닥 · 아래 벽 두 줄 가운데 3칸이 트여 테마 복도가 다음 방으로.
for (const th of ["ghost", "ice", "dragon", "dark"]) {
  const W = 15, H = 14;
  const { f, mat } = room(`league_${th}`, W, H, { wall: `rm_wall_lg_${th}`, floor: "", lgTheme: th });
  f.stamp("lg_door", 6, 0);
  for (let x = 1; x <= 13; x++) if (x < 6 || x > 8) f.stamp("lg_lamp", x, 1);
  f.stamp(`lgf_${th}`, 5, 4);
  f.stamp(`lg_side_${th}_l`, 1, 4); f.stamp(`lg_side_${th}_r`, 11, 4);
  wallRow(f, 1, 5, 11, `rm_wall_lg_${th}`); wallRow(f, 9, 13, 11, `rm_wall_lg_${th}`);
  for (let y = 11; y <= 12; y++) for (let x = 6; x <= 8; x++) f.lo(x, y, `rm_fl_lg_${th}`);
  f.save();
  k.describe(f, `사천왕 방(${th}): 봉인 문(입구 칸 = 다음 방 이동 이벤트)·뒷벽 밑 등·5×5 경기장 선·좌우 옆벽 3×5 테마 블록. 아래 벽 두 줄 가운데 3칸 복도로 들어온다. 관장은 경기장 선 위쪽 끝(7,3)에 선다.`);
  k.expectReach(f, mat, [at(7, 3), at(7, 1), at(7, 6), at(4, 9), at(13, 3), at(1, 10)], "아래 복도 → 경기장 선 위·봉인 문·블록 옆 테두리");
  if (th === "ghost") k.negative(f, "corridor-blocked", "아래 복도 3칸을 벽으로 막아 방에 못 들어옴", (g) => { for (const x of [6, 8]) g.lo(x, 11, `rm_wall_lg_${th}_up`); g.lo(7, 11, `rm_wall_lg_${th}_up`); }, mat, [at(7, 3), at(7, 1)]);
}

// 7) 챔피언 방 15×14 — 사천왕 틀을 쓰지 않는다: 유리 벽(남색 창살)이 두르고, 방 전체를 팔각으로 높인 단이 차지,
//    아래 가운데 3칸 계단으로 올라오고 뒷벽 문 앞 3단 계단. 경기장 선·기둥 없음. (원작 에버그란데 챔피언 방 비례)
{
  const W = 15, H = 14;
  const f = k.field("league_champ", W, H, () => "i2_edge_v");
  wallRow(f, 1, 13, 0, "rm_wall_lg_champ");
  for (let y = 2; y <= 12; y++) for (let x = 1; x <= 13; x++) f.lo(x, y, "rm_fl_ch_top0");
  f.stamp("ch_stage", 1, 2); f.stamp("rmw_ch", 1, 2);
  for (let y = 0; y < H - 1; y++) { f.lo(0, y, "i2_edge_r"); f.lo(W - 1, y, "i2_edge_l"); }
  for (let x = 1; x < W - 1; x++) f.lo(x, H - 1, "i2_edge_t");
  f.lo(0, H - 1, "i2_edge_rt"); f.lo(W - 1, H - 1, "i2_edge_lt"); f.lo(7, H - 1, "i2_edge_mat");
  f.stamp("lg_door", 6, 0);
  f.save();
  k.describe(f, "챔피언 방: 단 범위(x1..13, y2..12)를 rm_fl_ch_top0 으로 칠한 뒤 ch_stage·rmw_ch 를 원점 (1,2)에 찍는다. 아래 계단(6..8, 11..12) → 팔각 단 윗면 → 문 앞 3단(6..8, 2..3) → 봉인 문(7,1).");
  const bottom: Cell = [7, 12];
  k.expectReach(f, bottom, [at(7, 7), at(2, 7), at(12, 7), at(4, 4), at(7, 2), at(7, 1)], "아래 계단 → 단 윗면 양 끝·문 앞 계단·봉인 문");
  k.expectNoReach(f, bottom, [at(1, 4), at(13, 4), at(2, 11), at(1, 11), at(3, 4)], "단 밖(유리 벽·깎인 모서리·앞면 아래 어둠)으로 못 나간다");
  k.negative(f, "stairs-cut", "아래 계단 윗단 세 칸을 유리 벽으로 막아 단에 못 올라감", (g) => { for (const x of [6, 7, 8]) { g.lo(x, 11, "rm_wall_lg_champ_dn"); g.map.upperTiles[11 * W + x] = -1; } }, bottom, [at(7, 7), at(7, 1)]);
}
k.done();
