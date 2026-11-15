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
    legend: { l: "wall lantern", t: "tapestry", c: "crate", h: "hat stand" },
    hang: "..l....t..l..",
    plan: [".............", "c...........h"], daises: [["dais red", 1, 0, 11, 1]] }),
  T({ id: "corr-b", kind: "t_corridor", floor: "dplank", wall: "plaster",
    legend: { l: "wall lantern", p: "portrait", b: "barrel", u: "umbrella jar", n: "cushion bench" },
    hang: "..l.....p.....l....",
    plan: ["...................", "b.n.............u.."], daises: [["dais blue", 1, 0, 17, 1]] }),
  T({ id: "corr-c", kind: "t_corridor", floor: "dplank", wall: "plaster",
    legend: { l: "wall lantern", p: "portrait pair", t: "tapestry", h: "hat stand", k: "chest", n: "cushion bench" },
    hang: "..l......t.....p....t.....l..",
    plan: [".............................", "h..n....................k...."], daises: [["dais red", 1, 0, 27, 1]] }),
  // ── 계단참: 나선 계단 하나(탑·위층으로) ──
  T({ id: "stair-a", kind: "t_stair", floor: "flag", wall: "rubble",
    legend: { S: "spiral stairs", l: "wall lantern", b: "barrel", c: "crate" },
    hang: "...l.",
    plan: ["S....", ".....", "b...c", "....."] }),
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
};

/** 집 킷의 interior 태그가 구성 이름일 때 그 이름이 가리키는 방 종류. */
export const KIT_PROGRAMS: Record<string, string> = { tavern: "tavern", manor_1f: "living", tower: "lighthouse", stable: "stable" };
/** 방 사이 문 — 나무 벽 방과 돌 벽 방. */
export const TIER_DOORS = { door: { wood: "door oak", stone: "door arch" }, sidedoor: { wood: "sidedoor oak", stone: "sidedoor iron" } };
