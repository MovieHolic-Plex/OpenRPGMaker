// 실내 빌더의 밑받침 — 상태 형, 칩셋 고르기, 방 종류 낱말(resolveKind), 기물 이름 찾기(findPart), 크기·채움 기준 수.
import { HAND_INTERIOR_TILESET_ID, MODERN_CITY_INTERIOR_TILESET_ID, SENGOKU_INTERIOR_TILESET_ID, WIZARDING_INTERIOR_TILESET_ID, roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { roomTemplates } from "@/editor/handInterior/templates";
import { INTERIOR_BARE_FLOOR_LIMIT } from "@/editor/handInterior/bareFloor";
import type { PlaceSpec, ZoneSpec } from "../../shared/types";
import type { Project } from "@/project/types";
import { type VenueStamp } from "./interiorVenues";
import { kindServesPurpose, purposeOf } from "../roomPurpose";

export type Obj = { id: string; x: number; y: number };

export type Room = { id: string; x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string };

export interface Rebuild { rooms: Room[]; connect?: unknown[]; exit?: unknown; objects: Obj[]; tables?: { style: string; x: number; y: number; w: number; h: number }[]; goods?: Obj[]; lines?: unknown[]; daises?: unknown[] }

export interface InteriorState { readonly tilesetId: string; readonly mapId: string; readonly args: Record<string, unknown>; readonly upperMapId?: string; readonly upperArgs?: Record<string, unknown>; readonly placed: readonly { zone: string; what: string; id: string }[]; readonly stamps?: readonly VenueStamp[]; readonly venue?: string; readonly backDoor?: { readonly mapId: string; readonly args: Record<string, unknown> }; readonly adopted?: { readonly tilesetId: string; readonly args: Record<string, unknown>; readonly rooms: readonly { id: string; kind: string }[] } }

/** 화풍 낱말 → 실내 칩셋. 일본 현대 집은 jp 빌더(house)가 맡는다. */
function tilesetFor(style: string | undefined): string {
  const s = (style ?? "").toLowerCase();
  if (/wizard|마법\s*학교|hogwart/u.test(s)) return WIZARDING_INTERIOR_TILESET_ID;
  if (/sengoku|edo|전국|에도|사무라이/u.test(s)) return SENGOKU_INTERIOR_TILESET_ID;
  if (/modern|현대|city|도시/u.test(s)) return MODERN_CITY_INTERIOR_TILESET_ID;
  return HAND_INTERIOR_TILESET_ID;
}

/**
 * 이 명세를 지을 실내 칩셋 — style 낱말 → 칩셋, 단 주인공 물건이 고른 칩셋에 없고 기본 판타지 실내(v5)에는 더 많으면 v5
 * (「마법사의 천문대」를 마법 학교 칩셋으로 지어 망원경·책장이 하나도 없었다, 2026-10-23 v2 실조수).
 * make_place 의 설계 받기(designRooms.ts)도 이 함수로 «손 도트 실내로 지어지나»를 본다 — style 이 modern 이어도 v5 로 짓는 방이 있다(2026-10-29 vm8 flash 방탈출).
 */
export function interiorTilesetOf(project: Project, spec: PlaceSpec): { tilesetId: string; note?: string } {
  const tilesetId = tilesetFor(spec.style);
  if (tilesetId === HAND_INTERIOR_TILESET_ID) return { tilesetId };
  const own = roomSpecOf(project.tilesets[tilesetId]);
  const base = roomSpecOf(project.tilesets[HAND_INTERIOR_TILESET_ID]);
  const words = (spec.zones ?? []).flatMap((z) => z.anchors ?? []);
  const hits = (rs: typeof own) => (rs ? words.filter((w) => findPart(rs, w)).length : -1);
  if (base && words.length && hits(base) > hits(own)) return { tilesetId: HAND_INTERIOR_TILESET_ID, note: `주인공 물건(${words.join("·")})이 ${tilesetId} 에 ${Math.max(0, hits(own))}개, 기본 판타지 실내에 ${hits(base)}개 있어 기본 판타지 실내로 지었다` };
  return { tilesetId };
}

/** 방 낱말 → 방 종류(그 칩셋에 견본이 있는 것). 없으면 가장 가까운 쓰임. */
const KIND_WORDS: readonly [RegExp, string[]][] = [
  [/선술집|주점|술집|tavern|pub|bar\b|홀/iu, ["tavern", "dining", "great_hall"]],
  [/부엌|주방|kitchen|조리/iu, ["kitchen", "prep"]],
  // 다른 장르 실내(2026-10-29, 손으로 짠 견본): 병원(병실·진료실·간호사실·영안실), 다락, 꽃집. 「창고」·「침실」 규칙보다 먼저.
  [/영안실|시체 ?안치|안치실|morgue/iu, ["morgue", "cellar"]],
  [/병실|병동|입원실|\bward\b/iu, ["ward", "bedroom"]],
  [/진료실|진찰실|진료|exam ?room/iu, ["clinic_exam", "ward"]],
  [/간호사실|간호|nurse/iu, ["nurse_station", "clinic_exam"]],
  [/다락|attic|loft/iu, ["attic", "storeroom"]],
  [/꽃집|꽃 ?가게|flower ?shop|florist/iu, ["flower_shop", "general_store"]],
  [/옷가게|옷집|양장점|재단사의? ?가게|tailor ?shop|clothing ?store/iu, ["tailor_shop", "general_store"]],
  [/장롱/iu, ["bedroom"]],
  [/창고|저장|store ?room|pantry|식료/iu, ["storeroom", "pantry"]],
  [/지하|cellar|술 ?창고/iu, ["cellar", "storeroom"]],
  // 여관 객실은 inn_room 견본(침대·협탁·옷장·작은 탁자, 손으로 짠 5×6~7×7)이 먼저 — 침실 견본은 귀족 방 깔개로 2층 객실 아래 절반이 휑했다(2026-10-29 vm1 flash mystery).
  [/객실|여관 ?방|손님 ?방|guest/iu, ["inn_room", "bedroom"]],
  [/침실|bed ?room|잠/iu, ["bedroom", "inn_room"]],
  // 「여관」만 오면 1층 홀(술집 겸 접수) — 장소 견본(tavern)을 쓰지 않는 묶음 길에서 거실 견본이 됐다(2026-10-29).
  [/여관|inn\b|객잔|주막/iu, ["tavern", "inn_room"]],
  // 손으로 짠 견본(interiorAuthoredRoomTemplates.json): 연구실·실험실 → laboratory(「연구」가 서재로 가기 전에), 교실, 잡화점, 감옥.
  [/실험|연구실|연금술|laborator|\blab\b/iu, ["laboratory", "alchemy"]],
  [/교실|강의실|classroom|학교/iu, ["classroom"]],
  [/잡화|만물|도구점|item ?shop|general ?store/iu, ["general_store"]],
  [/감옥|감방|지하 ?뇌옥|jail|prison|dungeon cell/iu, ["jail", "cell", "guard_room"]],
  [/무기점|무기 ?상점|무기 ?가게|weapon ?shop|armou?ry ?shop/iu, ["weapon_shop", "armory"]],
  [/민가|오두막|농가|살림집|cottage|farmhouse/iu, ["living", "bedroom"]],
  [/서재|study|공부|연구/iu, ["study", "library"]],
  [/도서|서고|library|책/iu, ["library", "study"]],
  [/천문|관측|observ|별/iu, ["study", "library"]],
  [/거실|응접|living|lounge|휴게/iu, ["living", "dining"]],
  [/식당|dining/iu, ["dining", "tavern"]],
  [/대장|forge|smith/iu, ["forge", "workshop"]],
  [/작업|workshop|공방/iu, ["workshop", "forge"]],
  [/연금|alchem|약방|약제/iu, ["alchemy", "pharmacy_shop"]],
  [/예배|chapel|성당|교회/iu, ["chapel"]],
  [/보물|treasur|금고/iu, ["treasury"]],
  [/무기|armory|병기/iu, ["armory", "weapon_shop"]],
  [/알현|왕좌|throne/iu, ["throne_room", "great_hall"]],
  [/대청|대연회|great ?hall|연회/iu, ["great_hall"]],
  [/현관|입구|entrance|로비|lobby/iu, ["entrance", "corridor"]],
  [/복도|corridor|hall ?way/iu, ["corridor"]],
  [/욕실|화장실|bath/iu, ["bathroom"]],
  [/감방|cell/iu, ["cell", "guard_room"]],
  [/경비|guard/iu, ["guard_room"]],
  [/가게|상점|shop/iu, ["general_store", "weapon_shop", "bakery_shop", "tailor_shop"]],
  [/빵/iu, ["bakery_shop", "bakery_oven"]],
];

/** 쓰임 안의 방 낱말 → 방 종류 id 조각(학교의 교무실 → school-staffroom, 병원의 진료실 → cl-exam). */
const SUBKIND_WORDS: readonly [RegExp, string][] = [
  [/교무실|staff ?room/iu, "staff"], [/보건실|양호실|infirmary/iu, "infirmary"], [/음악실|밴드|band|music/iu, "band"], [/과학실|실험실|science|lab/iu, "sci"],
  [/교실|classroom/iu, "class"], [/현관|신발장|genkan/iu, "genkan"], [/계단|stair/iu, "stair"], [/복도|corridor|hall ?way/iu, "corridor"],
  [/병실|병동|ward/iu, "ward"], [/간호|nurse/iu, "nurse"], [/응급|emergency|er/iu, "er"], [/진료|진찰|exam/iu, "exam"], [/대기|waiting|lobby/iu, "wait"],
  [/제의실|vestry/iu, "vestry"], [/서재|study/iu, "study"], [/영안실|안치|morgue/iu, "morgue"],
];

/** 목적 문장이 집 방 자체를 말하는가(「주인 침실」「뒤쪽 부엌」) — 그러면 집 방 kind 를 그대로 둔다. */
const HOME_ROOM_WORDS = /침실|침대|잠자|부엌|주방|창고|광|지하실|욕실|화장실|식당|bed ?room|kitchen|storage|store ?room|cellar|bath|dining/iu;

/** 집 방 종류 중 «어느 건물에나 있는» 것 — 구역 목적 낱말이 다른 쓰임(가게·교실·예배당)을 말하면 그 쓰임이 이긴다. 침실·부엌·창고는 그대로 둔다. */
const GENERIC_KINDS = /^(entrance|living|hall|corridor|study|dining|great_hall|lobby|waiting_room|room|main|common)$/u;

export function resolveKind(tilesetId: string, zone: ZoneSpec, notes: string[], placeName = "", single = false, out?: { fallback?: boolean }): string {
  const kinds = new Set(roomTemplates(tilesetId).map((t) => t.kind));
  const raw = zone.kind.trim();
  // 쓰임 낱말이 집 방 종류보다 먼저다 — 장난감 가게 홀이 «entrance», 교실이 «study» 로 와서 그 방의 견본 가구와 거실 한 벌을 받았고,
  // 현대 학교는 방 다섯이 living·bedroom 이 됐다(2026-10-25 J31·J42·J64).
  //  · 구역 kind·id 의 낱말이 쓰임이면 언제나 그 쓰임 견본.
  //  · 구역 목적(purpose) 문장이 쓰임이면 kind 가 일반 방(현관·거실·복도·서재…)이거나 이 칩셋에 없을 때만(«가게 뒤 침실»은 침실).
  //  · 구역에 쓰임이 없으면 장소 이름의 쓰임(학교 본관의 «복도» → school-corridor) — kind 가 이 칩셋에 없을 때만.
  //  · kind 가 일반 방(study·hall…)이면 목적 문장이 kind 낱말보다 먼저다 — 「study / 교무실」이 서고가 됐다.
  //  · kind 가 집 방(bedroom·kitchen…)이어도 목적 문장이 그 집 방을 말하지 않으면(「bedroom / 보건실」) 목적 문장의 쓰임 — 학교에 더블 침대가 깔렸다(J64).
  const sentence = purposeOf(zone.purpose ?? "");
  const named = purposeOf(`${raw} ${zone.id ?? ""}`.replace(/[_-]/gu, " "));
  const homeSaid = HOME_ROOM_WORDS.test(zone.purpose ?? "");
  const sentenceWins = !!sentence && (GENERIC_KINDS.test(raw) || !kinds.has(raw) || (GENERIC_HOME.test(raw) && !homeSaid));
  const told = sentenceWins ? sentence : named ?? (sentence && !GENERIC_HOME.test(raw) ? sentence : undefined);
  const ctx = told ? undefined : purposeOf(placeName);
  const purpose = told ?? (ctx && (!kinds.has(raw) || (single && GENERIC_KINDS.test(raw))) ? ctx : undefined);
  if (purpose && !kindServesPurpose(raw, purpose, tilesetId)) {
    const list = (purpose.kinds[tilesetId] ?? []).filter((k) => kinds.has(k));
    const token = raw.toLowerCase().replace(/[^a-z]/gu, "");
    const said = `${zone.purpose ?? ""} ${zone.id ?? ""} ${raw}`;
    const sub = SUBKIND_WORDS.filter(([re]) => re.test(said)).map(([, t]) => t);
    const hit = sub.map((t) => list.find((k) => k.includes(t))).find(Boolean)
      // 「shop」「room」 같은 두루 낱말은 이름 조각으로 고르지 않는다 — kind:"shop" 이 목록 첫째 잡화점(general_store)을 두고 이름에 shop 이 든 tailor_shop 을 골라
      // 모험가 잡화점이 마네킹 옷가게가 됐다(2026-10-29 room-vig5 shop).
      ?? (token.length >= 4 && !/^(shop|store|room|hall|place|house)$/u.test(token) ? list.find((k) => k.replace(/[^a-z]/gu, "").includes(token)) : undefined) ?? list[0];
    if (hit) { if (hit !== raw) notes.push(`구역 「${zone.id ?? raw}」은 ${purpose.ko} 쓰임이라 방 종류 ${raw} 대신 ${hit} 견본으로 지었다`); return hit; }
  }
  if (kinds.has(raw)) return raw;
  const text = `${raw} ${zone.purpose ?? ""}`;
  for (const [re, options] of KIND_WORDS) if (re.test(text)) { const hit = options.find((k) => kinds.has(k)); if (hit) return hit; }
  // 쓰임을 아는데 이 칩셋에 그 견본이 없으면 거실로 떨어지지 않게 가장 덜 «집» 같은 방(현관·복도)으로 — 거실 견본은 소파·냉장고를 깐다.
  const known = told ?? ctx;
  const neutral = known ? ["entrance", "corridor", "hall", "lobby", "waiting_room", "storeroom"].find((k) => kinds.has(k)) : undefined;
  const fallback = neutral ?? (kinds.has("living") ? "living" : [...kinds][0] ?? "living");
  if (out) out.fallback = true;
  notes.push(`방 종류 「${raw}」의 견본이 없어 ${fallback} 견본으로 지었다${known ? ` — ${known.ko} 견본이 이 칩셋에 없다` : ""}`);
  return fallback;
}

/** 견본 가구만 놓인 첫 짓기의 맨바닥이 이보다 넓으면 큰 방을 줄여 다시 짓는다(빈 바닥 메우기 전에). */
export const SHRINK_BARE_PCT = 35;

/** 짓기가 쓰임 한 벌로 메우는 목표 — 끝맺음 검사(checks.ts bare-floor)가 문제 삼는 선(기준 15 + 여유 5)까지만. 그 아래로 메우면 과밀해진다. */
export const FILL_BARE_PCT = INTERIOR_BARE_FLOOR_LIMIT + 5;

/** 크기 낱말 → 견본 크기 배율. */
export const SCALE: Record<string, number> = { small: 0.85, medium: 1, large: 1.3 };

/** 사람이 흔히 쓰는 말 → 부품 사전의 말(ko 이름은 「깔개」「발깔개」처럼 쓴다). */
const SYNONYMS: readonly [RegExp, string][] = [
  [/발\s*매트|도어\s*매트|현관\s*매트/u, "발깔개"], [/러그|카펫|양탄자/u, "깔개 rug"], [/촛불|양초/u, "촛대"],
  [/테이블/u, "탁자"], [/소파/u, "안락의자"], [/책꽂이/u, "책장"],
];

/** 부품 사전에서 낱말에 맞는 가구 하나. 「큰/커다란」이면 가장 큰 것, 아니면 이름이 가장 잘 맞는 것. */
export function findPart(spec: HandInteriorSpec, word: string): { id: string; kind: string; w: number; h: number; stairs?: "up" | "down" } | undefined {
  let w = word.trim().toLowerCase();
  // 출입문은 가구가 아니다(손 도트 실내는 남쪽 틈이 문) — 「문」이 「문장 방패」에 걸려 방패가 놓였다(2026-10-23 v2 고치기).
  if (/^(뒷|앞|옆|나무 |작은 )?문$|^door$|back ?door|뒷문|출입문/u.test(w)) return undefined;
  for (const [re, to] of SYNONYMS) w = w.replace(re, to);
  const big = /큰|커다란|거대|great|large|big/iu.test(w);
  const core = w.replace(/큰|커다란|거대한?|great|large|big|작은|small/giu, "").trim();
  const tokens = core.split(/[\s,·/]+/u).filter((t) => t.length >= 1);
  const scored: { id: string; score: number; area: number }[] = [];
  for (const [id, o] of Object.entries(spec.objects)) {
    const hay = `${id} ${o.ko} ${(o.tags ?? []).join(" ")}`.toLowerCase();
    let score = 0;
    if (o.ko.toLowerCase() === core || id === core) score += 10;
    for (const t of tokens) if (hay.includes(t)) score += t.length >= 2 ? 3 : 1;
    if (o.ko.toLowerCase().startsWith(core) || id.startsWith(core)) score += 2;
    if (score > 0) scored.push({ id, score, area: o.w * Math.max(1, o.h) });
  }
  // 한 글자 낱말만 맞은 것(점수 1~2)은 우연이다 — 버린다.
  for (let i = scored.length - 1; i >= 0; i--) if (scored[i]!.score < 3) scored.splice(i, 1);
  if (!scored.length) return undefined;
  scored.sort((a, b) => (b.score - a.score) || (big ? b.area - a.area : a.area - b.area));
  // 「큰」: 낱말이 맞는 것 중 가장 큰 것(이름이 똑같은 작은 것보다 큰 판을 고른다).
  const best = big ? scored.filter((s) => s.score >= 3).sort((a, b) => b.area - a.area)[0] ?? scored[0]! : scored[0]!;
  const o = spec.objects[best.id]!;
  return { id: best.id, kind: o.kind, w: o.w, h: o.h, ...(o.stairs ? { stairs: o.stairs } : {}) };
}

/** 집 방 — 그 방 종류의 한 벌(침실은 침실 한 벌)을 쓴다. 가게 건물 안 침실이 가게 한 벌을 받지 않게. */
export const GENERIC_HOME = /^(bedroom|inn_room|master_bedroom|kitchen|pantry|storeroom|cellar|bathroom|dining)$/u;
