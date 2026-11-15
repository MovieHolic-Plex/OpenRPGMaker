// 버들항 집 안 — 크기 단(중형·대형·초대형 공간)의 방 견본과 건물 구성 표. rooms.mts 가 읽어 굽는다(src/assets/beodeulInteriorTiers.json · 방 견본 json).
// 오너 2026-11-15: 「방1칸짜리를 '소형공간' 이라 치고, '중형공간', '대형공간', '초대형공간' 이렇게도 만들긴해야함.」
//   소형 = rooms.mts 의 한 방 견본 그대로. 그 위 단은 그 견본들을 «어느 방의 어느 쪽에 붙는가»(at)로 적은 평면이다 — 방 크기는 게임 열쇠가 고른 벌이 정하므로
//   좌표를 적지 않는다(src/editor/handInterior/tierPlan.ts 가 사각형으로 푼다). 단은 문이 달린 집 킷의 tier 태그가 정한다(요청 낱말이 아니다).
//   at = "<쪽 N·E·S·W>:<기준 방>:<맞춤 start·center·end>[:<밀기>]". 바깥문 방(exit)은 맨 아래까지 닿아야 한다 — 옆방은 end 로 맞추고 나머지는 위(N)로 붙인다.
//   한 단 안에서 평면 꼴이 서로 다르게: 한 줄(옆채) · 앞뒤로 겹친 채 · ㄱ자 · ㅜ자(뒤에 두 방) · 복도에 꿴 방 · 안뜰 둘레 · 위층/지하/탑(다른 맵).
// 이 단에만 쓰는 방 견본의 종류는 `t_` 로 시작한다 — 방 종류 표(rooms.kinds)·예제 표에 넣지 않아 한 방짜리 고르기와 모델이 읽는 방 목록이 그대로다.
import type { TierMapPlan, TierProgram, TierRoom } from "../../../src/editor/handInterior/tierPlan.ts";

export interface TierRoomSpec {
  id: string; kind: string; building: string; floor: string; wall: string;
  legend: Record<string, string>; hang: string; plan: string[];
  goods?: [number, number, string][];
  /** 크기 자동 깔것(돌 단·양탄자): [id, x, 바닥 줄, w, h] */
  daises?: [string, number, number, number, number][];
  tier: true;
}
const T = (r: Omit<TierRoomSpec, "tier" | "building">): TierRoomSpec => ({ ...r, building: "bd_tier", tier: true });

export const TIER_ROOMS: TierRoomSpec[] = [
  // ── 복도(가로): 바닥 두 줄 — 위아래 방으로 문이 난다. 벽에는 등과 걸개, 바닥에는 긴 양탄자 ──
  T({ id: "corr-a", kind: "t_corridor", floor: "dplank", wall: "plaster",
    legend: { l: "wall lantern", c: "wall clock", t: "tapestry", A: "armor stand", g: "geranium", x: "crate", n: "cushion bench", h: "hat stand" },
    hang: "..l..c.t..l..",
    plan: ["A...........g", "x...n.......h"], daises: [["dais red", 1, 0, 4, 1], ["dais red", 8, 0, 4, 1]] }),
  T({ id: "corr-b", kind: "t_corridor", floor: "dplank", wall: "plaster",
    legend: { l: "wall lantern", m: "mirror", p: "portrait", c: "wall clock", B: "bookcase", k: "knight statue", b: "barrel", n: "cushion bench", g: "geranium", u: "umbrella jar" },
    hang: "..l..m..p..c..l....",
    plan: ["B................k.", "b.n.....g...n...u.."], daises: [["dais blue", 2, 0, 6, 1], ["dais blue", 11, 0, 6, 1]] }),
  T({ id: "corr-c", kind: "t_corridor", floor: "dplank", wall: "plaster",
    legend: { l: "wall lantern", p: "portrait pair", t: "tapestry", c: "wall clock", A: "armor stand", h: "hat stand", n: "cushion bench", g: "geranium", k: "chest" },
    hang: "..l...p..t.....c....t..p..l..",
    plan: ["A...........................A", "h..n....g...........g..n..k.."], daises: [["dais red", 2, 0, 8, 1], ["dais red", 11, 0, 7, 1], ["dais red", 19, 0, 8, 1]] }),
  // ── 계단참: 나선 계단 하나(탑·위층으로) ──
  T({ id: "stair-a", kind: "t_stair", floor: "flag", wall: "rubble",
    legend: { S: "spiral stairs", l: "wall lantern", b: "barrel", c: "crate" },
    hang: "...l.",
    plan: ["S....", ".....", "b...c", "....."] }),
  T({ id: "corr-d", kind: "t_corridor", floor: "dplank", wall: "plaster",
    legend: { l: "wall lantern", p: "portrait pair", t: "tapestry", b: "banner", c: "wall clock", A: "armor stand", h: "hat stand", n: "cushion bench", g: "geranium", s: "knight statue", k: "chest" },
    hang: "..l...p..t...b...c...b...t..p..l...",
    plan: [`A${".".repeat(33)}A`, "h..n....g......s...s......g...n..k."], daises: [["dais red", 2, 0, 9, 1], ["dais red", 13, 0, 9, 1], ["dais red", 24, 0, 9, 1]] }),
  // ── 위층 복도(내려가는 계단이 끝에) · 큰 계단 현관 · 지하로 내려가는 계단참 ──
  T({ id: "upcorr-a", kind: "t_upcorr", floor: "dplank", wall: "plaster",
    legend: { D: "stairs down", l: "wall lantern", h: "hat stand" },
    hang: "....l......l.......",
    plan: ["D..................", "................h.."], daises: [["dais blue", 3, 0, 15, 1]] }),
  T({ id: "stairhall-a", kind: "t_stairhall", floor: "dplank", wall: "plaster",
    legend: { G: "grand stairs", p: "portrait", h: "hat stand", u: "umbrella jar" },
    hang: "p.......p",
    plan: ["...G.....", ".........", "h.......u", ".........", "........."], daises: [["dais red", 3, 1, 3, 4]] }),
  T({ id: "downstair-a", kind: "t_downstair", floor: "flag", wall: "rubble",
    legend: { D: "stairs down", l: "wall lantern", b: "barrel", c: "crate" },
    hang: "...l.",
    plan: ["D....", ".....", "b...c", "....."] }),
  T({ id: "belfry-a", kind: "t_belfry", floor: "flag", wall: "rubble",
    legend: { S: "spiral stairs", W: "window", w: "window light", r: "rope coil", c: "crate", b: "barrel", B: "tower bell" },
    hang: "W.....W",
    plan: ["wS....w", ".......", "r..B..c", ".......", "b......"] }),
  // ══ 큰 홀 — 홀마다 «다른 것 하나»(기둥·식탁의 같은 간격 되풀이로만 채우지 않는다) ══
  // 큰 주점: 무대 — 뒤 벽 가운데 무대, 왼쪽에 바, 오른쪽에 큰 벽난로와 긴 식탁
  T({ id: "tavhall-a", kind: "t_tavern_hall", floor: "dplank", wall: "plaster",
    legend: { K: "ale kegs rack", U: "ale tun", G: "stage", F: "great fireplace", g: "hearth glow", W: "window", w: "window light", s: "bottle shelf", a: "antlers", B: "bar counter", o: "stool", n: "bench", T: "long table", C: "chandelier", R: "round table", h: "chair", b: "barrel", k: "keg" },
    hang: "....s......W.....a.",
    plan: [
      "K.U...G....w..F....",
      "..............g....",
      "B...........n......",
      ".......C....T......",
      "o.o.o..............",
      "............n......",
      ".hR...........hR...",
      "b.................k",
    ] }),
  // 큰 주점: 긴 판매대 — 바 둘을 이은 여덟 칸 판매대와 걸상 줄, 왼쪽 벽에 큰 화덕
  T({ id: "tavhall-b", kind: "t_tavern_hall", floor: "dplank", wall: "plaster",
    legend: { H: "great hearth", g: "hearth glow", K: "ale kegs rack", U: "ale tun", W: "window", w: "window light", s: "bottle shelf", t: "target board", B: "bar counter", o: "stool", n: "bench", T: "long table", b: "barrel", k: "keg" },
    hang: "......s......W.t.",
    plan: [
      "H.......K.U..w...",
      ".g...............",
      ".......B...B.....",
      ".................",
      ".n.....o.o.o.o...",
      ".T...............",
      ".................",
      ".n.........b...kb",
    ] }),
  // 조합 회관: 게시판 벽 — 뒤 벽이 의뢰 게시판 둘, 그 앞에 평의 단상
  T({ id: "ghall-b", kind: "t_guild_hall", floor: "dplank", wall: "plaster",
    legend: { b: "banner", Q: "guild board", W: "window", w: "window light", J: "council bench", n: "bench", L: "long table", C: "chandelier", k: "strongbox", c: "floor candle" },
    hang: ".b.Q.....Q...b.W.",
    plan: [
      "...............w.",
      "......J..........",
      ".n...........n...",
      ".L...........L...",
      ".......C.........",
      ".n...........n...",
      ".................",
      "k...............c",
    ] }),
  // 읍사무소 평의실: 돌 단 위 재판 단상과 방청석
  T({ id: "council-a", kind: "t_council", floor: "parquet", wall: "plaster",
    legend: { W: "window", w: "window light", b: "banner", Y: "wide tapestry", J: "council bench", p: "pew", r: "record stand", k: "strongbox" },
    hang: "W.b...Y...b...W",
    plan: [
      "w.............w",
      "......J........",
      "...............",
      "..p.......p....",
      "..p.......p....",
      "...............",
      "r............k.",
    ], daises: [["dais stone", 5, 0, 5, 2]] }),
  // 본당: 설교단과 오르간 — 돌 단 위 제단, 가운데 긴 양탄자, 장의자 두 줄, 고해소, 세례반
  T({ id: "nave-a", kind: "t_nave", floor: "grey", wall: "grey",
    legend: { G: "stained window", w: "window light", O: "rose window", X: "confessional", f: "floor candle", a: "altar", R: "organ", P: "pulpit", p: "pew", F: "font", c: "candelabrum" },
    hang: "...G...O...G....",
    plan: [
      "X..w.fa..f.w.R..",
      "................",
      "..........P.....",
      "................",
      "..p.p.....p.p...",
      "................",
      "..p.p.....p.p...",
      "................",
      "..p.p.....p.p...",
      "................",
      "....F.........c.",
    ], daises: [["dais stone", 5, 0, 5, 2], ["dais red", 7, 2, 2, 9]] }),
  // 대성당 본당(성소와 벽 없이 트인다 — 뒤 벽에 거는 것이 없다): 돌기둥 두 줄, 장의자, 설교단, 가운데 긴 양탄자
  T({ id: "nave-b", kind: "t_nave_open", floor: "grey", wall: "grey",
    legend: { s: "stone column", P: "pulpit", p: "pew", k: "knight statue", F: "font", c: "candelabrum" },
    hang: "................",
    plan: [
      ".s..........P.s.",
      "..p.p.....p.p...",
      "..p.p.....p.p...",
      ".s............s.",
      "..p.p.....p.p...",
      "..p.p.....p.p...",
      ".s............s.",
      "..p.p.....p.p...",
      "................",
      "k...F.........c.",
    ], daises: [["dais red", 7, 0, 2, 10]] }),
  // 성소(대성당 안쪽): 큰 단 위 주 제단, 오르간, 성가대석
  T({ id: "sanct-a", kind: "t_sanctuary", floor: "grey", wall: "grey",
    legend: { G: "stained window", w: "window light", O: "rose window", R: "organ", a: "altar", X: "confessional", f: "floor candle", p: "pew" },
    hang: "....G..O..G.....",
    plan: [
      "R...w.a...w..X..",
      "................",
      ".....f....f.....",
      "p.p.........p.p.",
      "................",
      "p.p.........p.p.",
      "................",
    ], daises: [["dais stone", 4, 0, 8, 2], ["dais red", 7, 2, 2, 5]] }),
  // 안뜰(수도원·성): 우물과 화단 넷
  T({ id: "court-a", kind: "t_court", floor: "flag", wall: "stone",
    legend: { l: "wall lantern", g: "garden bed", O: "cloister well" },
    hang: "..l.......l..",
    plan: [
      ".............",
      ".g.......g...",
      ".............",
      ".............",
      ".....O.......",
      ".............",
      ".............",
      ".g.......g...",
      ".............",
    ] }),
  // 알현실: 돌 단 위 왕좌 — 양옆 벽이 서로 다르다(왼쪽은 큰 벽걸이와 작전 탁자, 오른쪽은 무기 벽과 기사 석상)
  T({ id: "throne-a", kind: "t_throne", floor: "grey", wall: "grey",
    legend: { Y: "wide tapestry", b: "banner", G: "stained window", w: "window light", V: "weapon wall", W: "window", A: "armor stand", T: "throne", c: "floor candle", s: "stone column", M: "war table", C: "chandelier", k: "knight statue", z: "brazier" },
    hang: ".Y...b..G...G..V...W.",
    plan: [
      "A.......w...w......w.",
      ".........T...........",
      ".......c.....c.......",
      ".....................",
      ".....s.........s.....",
      ".M...................",
      "......C......C....k..",
      ".....s.........s.....",
      ".....................",
      ".z.................z.",
      ".....s.........s.....",
      ".....................",
    ], daises: [["dais stone", 6, 0, 9, 3], ["dais red", 9, 3, 3, 9]] }),
  // 금고
  T({ id: "vault-a", kind: "t_vault", floor: "grey", wall: "grey",
    legend: { l: "wall lantern", D: "vault door", t: "treasure", S: "standing scale", k: "strongbox" },
    hang: "l........",
    plan: ["...D..k..", "t......t.", ".........", "t...S..t.", "........."] }),
  // 지하 묘: 석관 줄(올라가는 나선 계단)
  T({ id: "crypt-a", kind: "t_crypt", floor: "grey", wall: "grey",
    legend: { S: "spiral stairs", l: "wall lantern", q: "sarcophagus", c: "floor candle", k: "knight statue" },
    hang: "...l...l...",
    plan: ["S.........k", "...........", ".q..q..q...", "...........", ".q..q..q...", "c.........c"] }),
  // 성 부엌: 큰 화덕
  T({ id: "kitchen-l", kind: "t_castle_kitchen", floor: "flag", wall: "rubble",
    legend: { H: "great hearth", g: "hearth glow", p: "pot rail", W: "window", w: "window light", D: "dresser", T: "work table", S: "stone sink", c: "cauldron", b: "barrel", f: "firewood" },
    hang: "......p...W..",
    plan: ["H.........wD.", ".g...........", ".......T..T..", ".............", "S......c.....", "b.b.......f.b"] }),
  // 수도원·성 식당: 긴 식탁 세 줄과 낭독 설교단
  T({ id: "refectory-a", kind: "t_refectory", floor: "flag", wall: "stone",
    legend: { W: "window", w: "window light", Y: "wide tapestry", P: "pulpit", n: "bench", F: "feast table", b: "barrel", c: "floor candle" },
    hang: "W...Y.......W....",
    plan: ["w...........w....", "..............P..", ".n...n...n.......", ".F...F...F.......", ".n...n...n.......", ".................", "b...............c"] }),
  // 큰 서고: 긴 책장 벽과 사다리, 긴 열람 탁자
  T({ id: "library-l", kind: "t_library_hall", floor: "parquet", wall: "plaster",
    legend: { K: "book wall", W: "window", w: "window light", h: "chair", H: "chair back", E: "reading table", M: "map table", G: "globe", k: "book chest", c: "floor candle" },
    hang: "......W.......W..",
    plan: ["K..K..w.K..K..w..", ".................", "..h..........h...", ".E..........E....", "..H..........H...", ".................", ".....M....G......", "k...............c"] }),
  // 세관 큰 홀: 세관 책상 줄 — 대저울, 봉인 찍힌 짐 더미, 끌어올리는 틀, 뒤에 단상
  T({ id: "customs-a", kind: "t_customs_hall", floor: "flag", wall: "stone",
    legend: { M: "wall map", n: "notice board", W: "window", w: "window light", t: "tally slate", J: "council bench", G: "cargo stack", D: "customs desk", B: "weigh beam", X: "hoist", b: "barrel", k: "keg" },
    hang: ".M....n....W......t",
    plan: ["...........w.......", "...J...............", "..............G....", ".D..D..D......B....", "...................", "...................", "G..............X...", "b.................k"] }),
  // 무기고: 무기 벽 둘과 작전 탁자
  T({ id: "armoury-l", kind: "t_armoury", floor: "flag", wall: "grey",
    legend: { V: "weapon wall", l: "wall lantern", A: "armor stand", M: "war table", s: "shield rack", a: "arrow barrel", b: "bow rack" },
    hang: "V...l..V...",
    plan: ["...A..A....", "...........", ".M.....s...", "...........", "a.........b"] }),
  // 공동 침실(병영·수도원): 침상 줄
  T({ id: "dorm-a", kind: "t_dorm", floor: "dplank", wall: "plaster",
    legend: { W: "window", w: "window light", l: "wall lantern", c: "cot", a: "armour chest" },
    hang: "W....l....W..",
    plan: ["w.........w..", "c..c..c..c...", ".............", "c..c.....c...", "...........a."] }),
  // 필사실: 기운 책상 줄
  T({ id: "scriptorium-a", kind: "t_scriptorium", floor: "dplank", wall: "plaster",
    legend: { W: "window", w: "window light", K: "book wall", S: "scroll shelf", D: "slant desk", o: "stool", k: "book chest", c: "floor candle" },
    hang: "W.....W.....W",
    plan: ["w.K...w..S..w", ".............", ".D..D...D..D.", ".o..o...o..o.", "k...........c"] }),
  // 창고 큰 칸: 짐 더미와 대저울, 끌어올리는 틀
  T({ id: "whall-a", kind: "t_warehouse_hall", floor: "flag", wall: "rubble",
    legend: { l: "wall lantern", t: "tally slate", G: "cargo stack", B: "weigh beam", X: "hoist", c: "crate", b: "barrel", k: "keg" },
    hang: ".l.....t....l..",
    plan: ["...............", "...............", "G..........G...", "......B........", "...............", "c.c.........X..", "b.............k"] }),
];

const R = (id: string, kind: string, at?: string, more: Partial<TierRoom> = {}): TierRoom => ({ id, kind, ...(at ? { at } : {}), ...more });
const M = (id: string, ko: string, exit: string | undefined, rooms: TierRoom[], connect?: [string, string][]): TierMapPlan => ({ id, ko, rooms, ...(exit ? { exit } : {}), ...(connect ? { connect } : {}) });

export const TIER_PROGRAMS: Record<string, TierProgram> = {
  // ════ 중형 — 방 2~4개가 붙은 건물(한 장, 탑만 두 장) ════
  "m-inn": { tier: "medium", ko: "여관", serves: ["tavern", "inn_room"], shapes: [
    M("m-inn-t", "ㅜ자 — 홀 뒤에 객실 둘, 옆에 부엌", "hall", [R("hall", "tavern"), R("kitchen", "kitchen", "E:hall:end"), R("room1", "inn_room", "N:hall:start"), R("room2", "inn_room", "N:hall:end")]),
    M("m-inn-wing", "옆채 — 홀 왼쪽에 부엌, 오른쪽에 객실 두 층", "hall", [R("hall", "tavern"), R("kitchen", "kitchen", "W:hall:end"), R("room1", "inn_room", "E:hall:end"), R("room2", "inn_room", "N:room1:start")]),
  ] },
  "m-shop": { tier: "medium", ko: "가게 딸린 집", serves: ["general_store", "weapon_shop", "pharmacy_shop", "bakery_shop", "cobbler", "printer"], shapes: [
    M("m-shop-deep", "앞뒤로 겹친 채 — 가게 뒤에 살림방, 그 옆에 창고", "shop", [R("shop", "$main"), R("home", "living", "N:shop:start"), R("store", "storeroom", "E:home:end")]),
    M("m-shop-row", "한 줄 — 창고 · 가게 · 살림방", "shop", [R("shop", "$main"), R("store", "storeroom", "W:shop:end"), R("home", "living", "E:shop:end")]),
  ] },
  "m-farm": { tier: "medium", ko: "농가", serves: ["living", "bedroom", "kitchen"], shapes: [
    M("m-farm-l", "ㄱ자 — 방 옆에 부엌, 부엌 뒤에 침실", "main", [R("main", "living"), R("kitchen", "kitchen", "E:main:end"), R("bed", "bedroom", "N:kitchen:end")]),
    M("m-farm-long", "뒤로 긴 채 — 방 · 부엌 · 침실이 한 줄로 깊다", "main", [R("main", "living"), R("kitchen", "kitchen", "N:main:start"), R("bed", "bedroom", "N:kitchen:start")]),
  ] },
  "m-chapel": { tier: "medium", ko: "예배당과 사제관", serves: ["chapel"], shapes: [
    M("m-chapel-apse", "제단 뒤 성구실 — 그 옆에 사제 방", "nave", [R("nave", "chapel"), R("vestry", "study", "N:nave:center"), R("cell", "bedroom", "E:vestry:end")]),
    M("m-chapel-side", "곁채 — 예배당 옆에 성구실, 그 뒤에 사제 방", "nave", [R("nave", "chapel"), R("vestry", "study", "E:nave:end"), R("cell", "bedroom", "N:vestry:start")]),
  ] },
  "m-work": { tier: "medium", ko: "일터 딸린 집", serves: ["workshop", "pottery", "carpentry", "forge", "brewery", "mill"], shapes: [
    M("m-work-corr", "복도형 — 일터 뒤 복도에 창고와 살림방이 꿰였다", "work", [R("work", "$main"), R("corr", "t_corridor", "N:work:center", { template: "corr-b" }), R("store", "storeroom", "N:corr:start"), R("home", "living", "N:corr:end")]),
    M("m-work-l", "ㄱ자 — 일터 옆에 창고, 뒤에 살림방", "work", [R("work", "$main"), R("store", "storeroom", "E:work:end"), R("home", "living", "N:work:start")]),
  ] },
  "m-office": { tier: "medium", ko: "관리소", serves: ["study", "waiting_room"], shapes: [
    M("m-office-deep", "앞뒤 — 대기실 뒤에 사무실, 그 옆에 문서 창고", "wait", [R("wait", "waiting_room"), R("office", "study", "N:wait:center"), R("archive", "storeroom", "E:office:end")]),
    M("m-office-corr", "현관 복도 — 복도에서 대기실과 사무실로", "corr", [R("corr", "t_corridor", undefined, { template: "corr-b" }), R("wait", "waiting_room", "N:corr:start"), R("office", "study", "N:corr:end")]),
  ] },
  "m-lockup": { tier: "medium", ko: "경비소와 감옥", serves: ["guard_room", "jail"], shapes: [
    M("m-lockup-l", "ㄱ자 — 경비실 옆에 감옥, 뒤에 무기 창고", "guard", [R("guard", "guard_room"), R("jail", "jail", "E:guard:end"), R("store", "storeroom", "N:guard:start")]),
    M("m-lockup-deep", "안쪽 감옥 — 경비실을 지나야 감옥, 옆에 창고", "guard", [R("guard", "guard_room"), R("jail", "jail", "N:guard:center"), R("store", "storeroom", "W:guard:end")]),
  ] },
  "m-warehouse": { tier: "medium", ko: "부두 창고", serves: ["storeroom", "cellar"], shapes: [
    M("m-warehouse-row", "한 줄 — 셈 방 · 곳간 · 곳간", "s1", [R("s1", "storeroom"), R("tally", "study", "W:s1:end"), R("s2", "storeroom", "E:s1:end")]),
    M("m-warehouse-l", "ㄱ자 — 셈 방 뒤에 곳간 둘", "tally", [R("tally", "study"), R("s1", "storeroom", "N:tally:start"), R("s2", "storeroom", "E:s1:start")]),
  ] },
  "m-fisher": { tier: "medium", ko: "어부 집", serves: ["fisher"], shapes: [
    M("m-fisher-l", "ㄱ자 — 오두막 왼쪽에 그물 곳간, 뒤에 침실", "hut", [R("hut", "fisher"), R("shed", "storeroom", "W:hut:end"), R("bed", "bedroom", "N:hut:end")]),
    M("m-fisher-step", "층층이 — 오두막 옆 침실, 그 뒤 곳간", "hut", [R("hut", "fisher"), R("bed", "bedroom", "E:hut:end"), R("shed", "storeroom", "N:bed:end")]),
  ] },
  "m-stable": { tier: "medium", ko: "마구간과 마부 집", serves: ["stable"], shapes: [
    M("m-stable-row", "한 줄 — 마구간 둘과 마구 창고", "stable", [R("stable", "stable"), R("stable2", "stable", "W:stable:end"), R("tack", "storeroom", "E:stable:end")]),
    M("m-stable-l", "ㄱ자 — 마구간 옆 마구 창고, 그 뒤 마부 방", "stable", [R("stable", "stable"), R("tack", "storeroom", "E:stable:end"), R("groom", "living", "N:tack:start")]),
  ] },
  "m-tower": { tier: "medium", ko: "망루", serves: ["lighthouse"], shapes: [
    M("m-tower-e", "계단참 오른쪽에 경비실", "stair", [R("stair", "t_stair"), R("guard", "guard_room", "E:stair:end")]),
    M("m-tower-n", "계단참 왼쪽에 경비실, 뒤에 창고", "stair", [R("stair", "t_stair"), R("guard", "guard_room", "W:stair:end"), R("store", "storeroom", "N:stair:end")]),
  ], maps: [M("top", "꼭대기 방", undefined, [R("lamp", "lighthouse")])], links: [{ from: "main/stair/spiral stairs", to: "top/lamp/spiral stairs" }] },
  "m-school": { tier: "medium", ko: "학당", serves: ["classroom"], shapes: [
    M("m-school-corr", "긴 복도 — 교실 · 훈장 방 · 서고가 복도에 나란히", "corr", [R("corr", "t_corridor", undefined, { template: "corr-c" }), R("class", "classroom", "N:corr:start"), R("office", "study", "N:corr:center"), R("lib", "library", "N:corr:end")]),
    M("m-school-l", "ㄱ자 — 교실 옆에 훈장 방, 뒤에 서고", "class", [R("class", "classroom"), R("office", "study", "E:class:end"), R("lib", "library", "N:class:start")]),
  ] },
  "m-library": { tier: "medium", ko: "서고와 사서 집", serves: ["library"], shapes: [
    M("m-library-deep", "앞뒤 — 서고 뒤에 필사 방, 그 옆에 침실", "lib", [R("lib", "library"), R("study", "study", "N:lib:center"), R("bed", "bedroom", "W:study:end")]),
    M("m-library-row", "동쪽으로 긴 줄 — 서고 · 필사 방 · 침실", "lib", [R("lib", "library"), R("study", "study", "E:lib:end"), R("bed", "bedroom", "E:study:end")]),
  ] },
  "m-hall": { tier: "medium", ko: "모임 회관", serves: ["great_hall", "dining"], shapes: [
    M("m-hall-wings", "양 날개 — 큰 방 왼쪽에 부엌, 오른쪽에 서기 방", "hall", [R("hall", "$main"), R("kitchen", "kitchen", "W:hall:end"), R("office", "study", "E:hall:end")]),
    M("m-hall-back", "뒤채 — 큰 방 뒤에 부엌, 부엌 옆에 서기 방", "hall", [R("hall", "$main"), R("kitchen", "kitchen", "N:hall:start"), R("office", "study", "E:kitchen:end")]),
  ] },
  // ════ 대형 — 홀과 복도에 방 여럿, 위층·지하가 딸린 건물(맵 1~2장). 홀마다 다른 것 하나, 구성마다 평면 꼴이 다르다 ════
  "l-manor": { tier: "large", ko: "저택", serves: ["living", "dining", "bedroom"], shapes: [
    M("l-manor-spine", "복도 등뼈 — 계단 현관 뒤 긴 복도에 식당·거실·서재, 현관 양옆에 부엌과 창고", "entry", [R("entry", "t_stairhall"), R("corr", "t_corridor", "N:entry:center", { template: "corr-d" }),
      R("dining", "dining", "N:corr:start"), R("living", "living", "N:corr:center"), R("study", "study", "N:corr:end"), R("kitchen", "kitchen", "W:entry:end"), R("store", "storeroom", "E:entry:end")]),
    M("l-manor-court", "안뜰 둘레 — 현관 뒤 안뜰을 거실·서재·식당이 둘러싸고, 식당 양옆에 부엌과 창고", "entry", [R("entry", "t_stairhall"), R("court", "t_court", "N:entry:center"),
      R("living", "living", "W:court:end"), R("study", "study", "E:court:end"), R("dining", "dining", "N:court:center"), R("kitchen", "kitchen", "W:dining:end"), R("store", "storeroom", "E:dining:end")]),
  ], maps: [M("up", "위층", undefined, [R("landing", "t_upcorr"), R("bed1", "bedroom", "N:landing:start"), R("bed2", "bedroom", "N:landing:end"), R("lib", "library", "S:landing:center")])],
    links: [{ from: "main/entry/grand stairs", to: "up/landing/stairs down" }] },
  "l-guild": { tier: "large", ko: "조합 회관", serves: ["great_hall"], shapes: [
    M("l-guild-stairs", "큰 계단 홀 — 홀 양옆에 서기 방과 대기실, 뒤 복도에 서고·식당·창고", "hall", [R("hall", "great_hall", undefined, { template: "hall-l" }), R("office", "study", "W:hall:end"), R("wait", "waiting_room", "E:hall:end"),
      R("corr", "t_corridor", "N:hall:center", { template: "corr-d" }), R("lib", "library", "N:corr:start"), R("dining", "dining", "N:corr:center"), R("store", "storeroom", "N:corr:end")]),
    M("l-guild-board", "게시판 홀 — 게시판 벽 홀 옆으로 계단 현관·서기 방이 한 줄, 왼쪽에 대기실, 뒤에 서고", "hall", [R("hall", "t_guild_hall"), R("stair", "t_stairhall", "E:hall:end"), R("office", "study", "E:stair:end"),
      R("wait", "waiting_room", "W:hall:end"), R("lib", "library", "N:hall:start")]),
  ], maps: [M("up", "위층", undefined, [R("landing", "t_upcorr"), R("master", "study", "N:landing:start"), R("guest", "inn_room", "N:landing:end")])],
    links: [{ from: "main/*/grand stairs", to: "up/landing/stairs down" }] },
  "l-townhall": { tier: "large", ko: "읍사무소", serves: ["waiting_room", "study"], shapes: [
    M("l-townhall-deep", "앞뒤 — 대기실 뒤 평의실, 평의실 양옆에 사무실, 대기실 양옆에 문서 창고와 금고", "wait", [R("wait", "waiting_room"), R("council", "t_council", "N:wait:center"), R("office1", "study", "W:council:end"), R("office2", "study", "E:council:end"),
      R("archive", "storeroom", "W:wait:end"), R("vault", "t_vault", "E:wait:end")]),
    M("l-townhall-corr", "현관 복도 — 긴 복도에 대기실·평의실·사무실이 나란히, 평의실 뒤에 문서 창고, 복도 끝에 금고", "corr", [R("corr", "t_corridor", undefined, { template: "corr-d" }), R("wait", "waiting_room", "N:corr:start"), R("council", "t_council", "N:corr:center"),
      R("office", "study", "N:corr:end"), R("archive", "storeroom", "N:council:center"), R("vault", "t_vault", "E:corr:end")]),
  ] },
  "l-inn": { tier: "large", ko: "큰 여관", serves: ["tavern", "inn_room"], shapes: [
    M("l-inn-stage", "무대 홀 — 홀 왼쪽에 부엌, 오른쪽에 계단 현관, 뒤 복도에 객실 둘", "hall", [R("hall", "t_tavern_hall", undefined, { template: "tavhall-a" }), R("kitchen", "kitchen", "W:hall:end"), R("stair", "t_stairhall", "E:hall:end"),
      R("corr", "t_corridor", "N:hall:end", { template: "corr-a" }), R("room1", "inn_room", "N:corr:start"), R("room2", "inn_room", "N:corr:end")]),
    M("l-inn-counter", "긴 판매대 홀 — 홀 왼쪽에 계단 현관, 오른쪽에 부엌과 그 뒤 창고, 홀 뒤에 객실 둘", "hall", [R("hall", "t_tavern_hall", undefined, { template: "tavhall-b" }), R("stair", "t_stairhall", "W:hall:end"), R("kitchen", "kitchen", "E:hall:end"),
      R("store", "storeroom", "N:kitchen:end"), R("room1", "inn_room", "N:hall:start"), R("room2", "inn_room", "N:hall:end")]),
  ], maps: [M("up", "위층 객실", undefined, [R("landing", "t_upcorr"), R("room3", "inn_room", "N:landing:start"), R("room4", "inn_room", "N:landing:end"), R("room5", "inn_room", "S:landing:start"), R("room6", "bedroom", "S:landing:end")])],
    links: [{ from: "main/stair/grand stairs", to: "up/landing/stairs down" }] },
  "l-church": { tier: "large", ko: "본당 있는 교회", serves: ["chapel"], shapes: [
    M("l-church-cross", "십자 — 본당 왼쪽에 곁 예배실과 지하 계단, 오른쪽에 성구실", "nave", [R("nave", "t_nave"), R("vestry", "study", "E:nave:start"), R("side", "chapel", "W:nave:end"), R("down", "t_downstair", "W:nave:start")]),
    M("l-church-axis", "긴 축 — 현관 복도 · 본당 · 제단 뒤 성구실이 한 줄, 성구실 양옆에 사제 방과 지하 계단", "porch", [R("porch", "t_corridor", undefined, { template: "corr-a" }), R("nave", "t_nave", "N:porch:center"), R("vestry", "study", "N:nave:center"),
      R("cell", "bedroom", "W:vestry:end"), R("down", "t_downstair", "E:vestry:end")]),
  ], maps: [M("crypt", "지하 묘", undefined, [R("crypt", "t_crypt")])], links: [{ from: "main/down/stairs down", to: "crypt/crypt/spiral stairs" }] },
  "l-barracks": { tier: "large", ko: "병영", serves: ["guard_room", "jail"], shapes: [
    M("l-barracks-corr", "긴 복도 — 복도에 경비실·무기고·식당이 나란히, 복도 양 끝에 감옥과 공동 침실", "corr", [R("corr", "t_corridor", undefined, { template: "corr-d" }), R("guard", "guard_room", "N:corr:start"), R("armoury", "t_armoury", "N:corr:center"),
      R("mess", "dining", "N:corr:end"), R("jail", "jail", "W:corr:end"), R("dorm", "t_dorm", "E:corr:end")]),
    M("l-barracks-yard", "안마당 — 경비실 뒤 마당을 무기고·공동 침실·식당이 둘러싸고, 경비실 옆에 감옥", "guard", [R("guard", "guard_room"), R("yard", "t_court", "N:guard:center"), R("armoury", "t_armoury", "W:yard:end"), R("dorm", "t_dorm", "E:yard:end"),
      R("mess", "dining", "N:yard:center"), R("jail", "jail", "W:guard:end", { template: "jail-b" })]),
  ] },
  "l-warehouse": { tier: "large", ko: "창고 단지", serves: ["storeroom", "cellar"], shapes: [
    M("l-warehouse-t", "ㅜ자 — 짐 다루는 큰 칸 양옆에 셈 방과 곳간, 뒤에 곳간 둘", "floor", [R("floor", "t_warehouse_hall"), R("tally", "study", "W:floor:end"), R("s1", "storeroom", "E:floor:end"), R("s2", "storeroom", "N:floor:start"), R("s3", "cellar", "N:floor:end")]),
    M("l-warehouse-cross", "십자 — 셈 방을 지나 큰 칸, 큰 칸 양옆과 뒤에 곳간", "tally", [R("tally", "study"), R("floor", "t_warehouse_hall", "N:tally:center"), R("s1", "storeroom", "W:floor:end"), R("s2", "storeroom", "E:floor:end"), R("s3", "cellar", "N:floor:center")]),
  ] },
  "l-school": { tier: "large", ko: "학교", serves: ["classroom", "library"], shapes: [
    M("l-school-corr", "긴 복도 — 복도에 교실 · 서고 · 교실, 복도 양 끝에 교실과 훈장 방", "corr", [R("corr", "t_corridor", undefined, { template: "corr-d" }), R("class1", "classroom", "N:corr:start"), R("lib", "library", "N:corr:center"), R("class2", "classroom", "N:corr:end"),
      R("class3", "classroom", "W:corr:end"), R("office", "study", "E:corr:end")]),
    M("l-school-hall", "열람실 가운데 — 큰 서고 양옆에 교실, 뒤에 훈장 방과 필사실", "hall", [R("hall", "t_library_hall"), R("class1", "classroom", "W:hall:end"), R("class2", "classroom", "E:hall:end"), R("office", "study", "N:hall:start"), R("scribe", "t_scriptorium", "E:office:end")]),
  ] },
  // ════ 초대형 — 돌아다니는 장소(본채 44×32칸 넘게, 맵 3~4장: 탑·지하·위층이 계단으로 이어진다) ════
  "x-castle": { tier: "xlarge", ko: "성 본채", serves: ["great_hall", "guard_room", "jail", "dining"], cats: ["castle"], shapes: [
    M("x-castle-main", "문간 · 안뜰 · 알현실이 한 축 — 안뜰 서쪽에 부엌과 식당, 동쪽에 무기고와 경비실, 알현실 양옆에 예배실과 서기 방", "gate", [R("gate", "t_stairhall"), R("court", "t_court", "N:gate:center"), R("throne", "t_throne", "N:court:center"),
      R("kitchen", "t_castle_kitchen", "W:court:end"), R("mess", "t_refectory", "W:kitchen:end"), R("armoury", "t_armoury", "E:court:end"), R("guard", "guard_room", "E:armoury:end"),
      R("chapel", "chapel", "W:throne:end"), R("clerk", "study", "E:throne:end"), R("down", "t_downstair", "E:gate:end"), R("tower", "t_stair", "W:gate:end")]),
  ], maps: [
    M("dungeon", "지하 감옥과 금고", undefined, [R("st", "t_stair"), R("jail1", "jail", "E:st:end"), R("jail2", "jail", "W:st:end"), R("vault", "t_vault", "N:jail1:start")]),
    M("keep", "탑 꼭대기", undefined, [R("lamp", "lighthouse")]),
    M("up", "위층 처소", undefined, [R("landing", "t_upcorr"), R("royal", "bedroom", "N:landing:start"), R("solar", "study", "N:landing:end"), R("dorm", "t_dorm", "S:landing:center")]),
  ], links: [{ from: "main/down/stairs down", to: "dungeon/st/spiral stairs" }, { from: "main/tower/spiral stairs", to: "keep/lamp/spiral stairs" }, { from: "main/gate/grand stairs", to: "up/landing/stairs down" }] },
  "x-cathedral": { tier: "xlarge", ko: "대성당", serves: ["chapel"], shapes: [
    M("x-cathedral-main", "긴 축 — 현관 복도 · 본당과 성소(벽 없이 트인 한 공간) · 뒤 회랑 · 성모 예배실, 본당 양옆에 곁 예배실, 성소 양옆에 성구실과 보물 방, 곁 예배실 바깥에 종탑과 지하 계단", "porch", [R("porch", "t_corridor", undefined, { template: "corr-d" }),
      R("nave", "t_nave_open", "N:porch:center"), R("north", "chapel", "W:nave:end"), R("south", "chapel", "E:nave:end"), R("sanct", "t_sanctuary", "N:nave:center", { open: true }), R("vestry", "study", "W:sanct:end"), R("treasury", "t_vault", "E:sanct:end"),
      R("amb", "t_corridor", "N:sanct:center", { template: "corr-b" }), R("lady", "chapel", "N:amb:center"), R("belfry", "t_stair", "W:north:end"), R("down", "t_downstair", "E:south:end")]),
  ], maps: [
    M("crypt", "지하 묘", undefined, [R("crypt", "t_crypt"), R("ossuary", "cellar", "E:crypt:end")]),
    M("bells", "종탑", undefined, [R("ringers", "t_belfry")]),
  ], links: [{ from: "main/down/stairs down", to: "crypt/crypt/spiral stairs" }, { from: "main/belfry/spiral stairs", to: "bells/ringers/spiral stairs" }] },
  "x-monastery": { tier: "xlarge", ko: "수도원과 큰 서고", serves: ["library"], shapes: [
    M("x-monastery-main", "안뜰 둘레 — 문간 뒤 회랑 뜰을 식당·필사실·큰 서고가 둘러싸고, 식당 뒤에 부엌, 필사실 뒤에 공동 침실과 옆에 예배실, 서고 양옆에 참사 회의실과 탑 계단, 뒤에 원장 방", "gate", [R("gate", "t_corridor", undefined, { template: "corr-a" }),
      R("court", "t_court", "N:gate:center"), R("lib", "t_library_hall", "N:court:center"), R("refectory", "t_refectory", "W:court:end"), R("kitchen", "t_castle_kitchen", "N:refectory:start"),
      R("scribe", "t_scriptorium", "E:court:end"), R("chapel", "chapel", "E:scribe:end"), R("dorm", "t_dorm", "N:chapel:start"), R("chapter", "t_council", "W:lib:start"), R("stair", "t_stair", "E:lib:start"),
      R("abbot", "study", "N:lib:center"), R("down", "t_downstair", "W:refectory:end")]),
  ], maps: [
    M("stacks", "위층 서고", undefined, [R("st", "t_stair"), R("east", "library", "E:st:end"), R("west", "library", "W:st:end"), R("rare", "study", "N:east:start")]),
    M("cellar", "지하 저장고", undefined, [R("st", "t_stair"), R("wine", "cellar", "E:st:end"), R("brew", "brewery", "W:st:end"), R("store", "storeroom", "N:wine:start")]),
  ], links: [{ from: "main/stair/spiral stairs", to: "stacks/st/spiral stairs" }, { from: "main/down/stairs down", to: "cellar/st/spiral stairs" }] },
  "x-customs": { tier: "xlarge", ko: "세관", serves: ["waiting_room", "storeroom"], cats: ["harbour"], shapes: [
    M("x-customs-main", "긴 복도형 — 세관 큰 홀 뒤 긴 복도에 사무실 셋과 그 뒤 문서고, 홀 서쪽에 짐 다루는 큰 칸과 곳간, 동쪽에 금고·대기실·등탑 계단", "hall", [R("hall", "t_customs_hall"), R("corr", "t_corridor", "N:hall:center", { template: "corr-d" }),
      R("office1", "study", "N:corr:start"), R("office2", "study", "N:corr:center"), R("office3", "study", "N:corr:end"), R("archive", "library", "N:office2:center"),
      R("floor", "t_warehouse_hall", "W:hall:end"), R("bond", "storeroom", "W:floor:end"), R("down", "t_downstair", "W:bond:end"), R("vault", "t_vault", "E:hall:end"), R("wait", "waiting_room", "E:vault:end"), R("stair", "t_stair", "E:wait:end")]),
  ], maps: [
    M("light", "등탑", undefined, [R("lamp", "lighthouse")]),
    M("cellar", "보세 지하 창고", undefined, [R("st", "t_stair"), R("c1", "cellar", "E:st:end"), R("c2", "storeroom", "W:st:end")]),
  ], links: [{ from: "main/stair/spiral stairs", to: "light/lamp/spiral stairs" }, { from: "main/down/stairs down", to: "cellar/st/spiral stairs" }] },
};

/** 집 킷의 interior 태그가 구성 이름일 때 그 이름이 가리키는 방 종류. */
export const KIT_PROGRAMS: Record<string, string> = { tavern: "tavern", manor_1f: "living", tower: "lighthouse", stable: "stable" };
/** 방 사이 문 — 나무 벽 방과 돌 벽 방. */
export const TIER_DOORS = { door: { wood: "door oak", stone: "door arch" }, sidedoor: { wood: "sidedoor oak", stone: "sidedoor iron" } };
