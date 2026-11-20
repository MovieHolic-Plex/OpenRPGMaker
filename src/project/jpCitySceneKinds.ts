// project/jpCitySceneKinds.ts
// 일본 도시(jp_city) 거리 종류 — 자료(src/assets/jpCityStreetKinds.json)를 읽어 «요청에 맞는 종류 가운데 게임 열쇠와 씨앗으로 하나»를 고른다.
// 왜(오너 2026-11-14 «일본 도시 … 퀄리티가 좀 떨어지는거같은데 .. 오브젝트 수랑 도로 뭐 이것저것»): 거리 꼴이 넷뿐이라 게임마다 같은 거리였다.
// 종류는 도로 짜임(연석 큰길 · 보도 없는 생활도로 · 보행자 시장 길, 하천)·건물 섞임·구획 조각·장면 벌·바닥 톤을 한 벌로 묶는다. 요청 낱말 목록은 없다 — style·shops·region 만 본다.
import catalogJson from "@/assets/jpCityStreetCatalog.json" with { type: "json" };
import kindsJson from "@/assets/jpCityStreetKinds.json" with { type: "json" };
import { lookHash } from "@/project/kitLook";

export type SceneStyle = "shopping" | "residential" | "shitamachi" | "shotengai";

export interface SceneTone {
  readonly ko: string; readonly en: string;
  readonly pavingShade: "grey" | "warm" | "pale";
  readonly lot: readonly string[]; readonly sidewalk: string; readonly road: string;
  readonly plaza: string; readonly alley: string;
  /** 주택 필지 바닥(필지마다 돌린다) */ readonly yard: readonly string[];
  readonly green: string;
}

export interface SceneKind {
  readonly id: string; readonly ko: string; readonly en: string; readonly styles: readonly string[];
  /** 큰길: kerb 연석·보도 있는 차도 · lane 보도 없는 생활도로 · mall 보행자 시장 길 */
  readonly main: "kerb" | "lane" | "mall"; readonly mainW: readonly number[];
  /** 세로 길: kerb · lane · arcade(비 가림 지붕 시장 길) */
  readonly cross: "kerb" | "lane" | "arcade"; readonly crossLane: readonly number[];
  readonly river: number; readonly tall: boolean; readonly houseShare: number; readonly maxShops: number; readonly noGreen?: boolean;
  readonly mix: Readonly<Record<string, number>>; /** 맨 위 띠 앞줄(가게가 연달아 서는 줄)의 섞임 — 없으면 mix */ readonly mainMix?: Readonly<Record<string, number>>; readonly pieces: readonly string[]; readonly scenes: readonly string[]; readonly tones: readonly string[];
  readonly density: { readonly spill: number; readonly kerb: number; readonly south: number };
}

export interface CatBuilding { readonly id: string; readonly w: number; readonly h: number; readonly doors: readonly number[]; readonly ml: number; readonly mr: number; readonly cat: string; readonly role: string; readonly tier: string; readonly ko: string; readonly look?: string; /** 차가 드나드는 입(차고·구급차 자리): [첫 열, 폭] */ readonly bay?: readonly [number, number]; /** 키트 이름표의 말(한글·영어·간판 글자) */ readonly words?: readonly string[]; /** 실내 예제 이름(jp_ 뺀 것) */ readonly prog?: string }

const DATA = kindsJson as unknown as { tones: Record<string, SceneTone>; kinds: SceneKind[]; scenes: Record<string, Record<string, string | string[]>>; roofs: Record<string, number[]> };
const CATALOG = catalogJson as unknown as { buildings: CatBuilding[]; sizes: Record<string, [number, number]>; lower: string[] };

export const SCENE_KINDS: readonly SceneKind[] = DATA.kinds;
export const SCENE_TONES: Readonly<Record<string, SceneTone>> = DATA.tones;
export const SCENE_BUILDINGS: readonly CatBuilding[] = CATALOG.buildings;
export const SCENE_SIZES: Readonly<Record<string, readonly [number, number]>> = CATALOG.sizes;
/** 제 바닥 칸을 가져오는 키트 — 4층 덧그림으로 찍을 수 없다 */
export const SCENE_LOWER: ReadonlySet<string> = new Set(CATALOG.lower);
export const SCENE_ROOFS: Readonly<Record<string, readonly number[]>> = DATA.roofs;

/** 장면 벌의 한 칸(예: sceneList("spill","low")) — 칩셋에 있는 키트만. */
export function sceneList(scene: string, slot: string): string[] {
  const v = DATA.scenes[scene]?.[slot];
  return Array.isArray(v) ? v.filter((id) => SCENE_SIZES[id]) : [];
}
export function sceneKo(scene: string): string { const v = DATA.scenes[scene]?.ko; return typeof v === "string" ? v : scene; }
/** 장면 벌의 영어 이름 — 조수 모델이 읽는 요약에 쓴다. */
export function sceneEn(scene: string): string { const v = DATA.scenes[scene]?.en; return typeof v === "string" ? v : scene; }

export function sceneKindById(id: string | undefined): SceneKind | undefined { return id ? SCENE_KINDS.find((k) => k.id === id) : undefined; }

/**
 * 거리 종류 고르기: 부르는 쪽이 이름을 줬으면 그것. 아니면 style 에 맞고 요청한 가게 수를 담을 수 있는 종류 가운데 (게임 열쇠 해시 + 씨앗) 번째.
 * 같은 게임·같은 씨앗은 늘 같은 종류이고, 한 게임 안에서도 씨앗(맵)이 바뀌면 다음 종류로 돈다.
 */
export function pickSceneKind(req: { style: SceneStyle; shops?: readonly string[]; key: string; seed: number; kind?: string }): SceneKind {
  const named = sceneKindById(req.kind);
  if (named) return named;
  const fits = SCENE_KINDS.filter((k) => k.styles.includes(req.style));
  const roomy = fits.filter((k) => (req.shops?.length ?? 0) <= k.maxShops);
  const pool = roomy.length ? roomy : fits.length ? fits : SCENE_KINDS;
  return pool[(lookHash(req.key) + req.seed) % pool.length]!;
}

export function sceneTone(kind: SceneKind, key: string): SceneTone {
  return SCENE_TONES[kind.tones[(lookHash(`${key}|tone`) >>> 4) % kind.tones.length]!] ?? Object.values(SCENE_TONES)[0]!;
}

/** 주택 필지·공사장·빈터 바닥: 톤 벌의 필지 재료를 번호로 돌린다. 초록 띠를 쓰지 않는 종류(시타마치·쇼텐가이)는 잔디를 뺀다. */
export function yardGround(kind: SceneKind, tone: SceneTone, n: number): string {
  const list = tone.yard.filter((m) => !(kind.noGreen && m === tone.green));
  return (list.length ? list : ["산길 흙"])[((n % Math.max(1, list.length)) + Math.max(1, list.length)) % Math.max(1, list.length)]!;
}

/** 새 건물 가족(jp-bldg-f-*)이 사전에 있는가 — 있으면 조수가 짓는 일본 거리는 그것만 세운다. */
export const NEW_BUILDING_KITS: readonly CatBuilding[] = SCENE_BUILDINGS.filter((b) => b.id.startsWith("jp-bldg-f-"));
/** 낱말로 불러 줄에 세울 수 있는 것 — 제 자리 규칙이 따로 있는 것(신사 본전·역사 정면·초대형)은 뺀다. */
const ASKABLE_KITS: readonly CatBuilding[] = NEW_BUILDING_KITS.filter((b) => b.cat !== "sacred" && b.cat !== "landmark" && b.cat !== "xlarge");

/**
 * 지역(compose_jp_region 의 지역 id) 가운데 «건물이 줄지어 선 동네»는 거리 장면 구성기의 종류로 짓는다 — 지역 문법은 옛 손 도트 건물로만 지어서
 * 새 건물 가족과 한 맵·한 게임에 섞인다(2026-11-16 r6 실모델: 「역 앞 상점가」가 station_plaza 로 가서 새 건물이 하나도 안 섰다).
 */
export const SCENE_KIND_FOR_REGION: Readonly<Record<string, string>> = {
  station_plaza: "ekimae", business_district: "zakkyo", yokocho_alley: "roji", machiya_quarter: "monzen", quiet_residential: "jutaku", danchi_complex: "jutaku",
  canal_promenade: "kawazoi", torii_shrine_precinct: "tera-machi", buddhist_temple_pagoda: "tera-machi",
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/**
 * 요청 낱말 하나 → 새 건물 키트. 키트 id(전체·꼬리) · 종류(role) · 이름 · 키트 이름표의 말 · 실내 예제 이름과 온전히 같은 말만 받는다(별칭 표·부분 일치 없음).
 */
export function sceneKitForWord(word: string): CatBuilding | undefined {
  const w = norm(word);
  if (!w || w === "shop" || w === "house") return undefined;
  const names = (b: CatBuilding) => [b.id, b.id.slice("jp-bldg-f-".length), b.role, b.ko, ...(b.words ?? [])].map(norm);
  // 제 이름으로 먼저, 그다음 실내 예제 이름(여러 건물이 같은 예제를 쓴다 — 사전의 앞 건물)
  return ASKABLE_KITS.find((b) => names(b).includes(w)) ?? ASKABLE_KITS.find((b) => b.prog === w);
}

/** 낱말을 마디로(띄어쓰기·붙임표·밑줄·빗금). */
const tokens = (s: string): string[] => norm(s).split(/[\s\-_/]+/u).filter((t) => t.length >= 2);
const kitTokens = (b: CatBuilding): string[] => [...new Set([b.id.slice("jp-bldg-f-".length), b.role, b.ko, ...(b.words ?? []), b.prog ?? ""].flatMap(tokens))];
/** 여러 건물에 두루 붙는 마디(shop·house·가게 …)는 가리는 힘이 없다 — 사전에서 센다(손으로 적은 목록이 아니다). */
const COMMON_TOKENS: ReadonlySet<string> = (() => {
  const n = new Map<string, number>();
  for (const b of ASKABLE_KITS) for (const t of kitTokens(b)) n.set(t, (n.get(t) ?? 0) + 1);
  return new Set([...n].filter(([, c]) => c >= 4).map(([t]) => t));
})();
const ascii = (t: string) => /^[\x20-\x7e]+$/.test(t);
/** 글자 하나 다름(바꿈·빠짐·더함)까지 같은 말로 본다 — 라틴 글자 5자 이상에서만(conbini ≈ konbini). */
function oneOff(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5 || !ascii(a) || !ascii(b)) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
}

export interface SceneKitMatch { readonly kit: CatBuilding; /** exact 이름이 온전히 같다 · nearest 가장 가까운 키트로 대신했다 */ readonly how: "exact" | "nearest" }
/**
 * 요청한 건물 하나 → 세울 키트. 사전에 있는 키트 id(옛 가족 · 신사 본전 · 초대형 포함 — 모델이 id 로 직접 청한 것은 실제로 있으면 세운다) → 이름이 온전히 같은 새 건물 →
 * 가장 가까운 새 건물(마디가 같거나, 한쪽이 다른 쪽을 품거나, 글자 하나 차이 — 두루 붙는 마디는 세지 않는다). 가까운 것도 없으면 undefined.
 */
export function sceneKitNear(word: string): SceneKitMatch | undefined {
  const w = norm(word).replace(/^kit:jp_city\//, "");
  const byId = SCENE_BUILDINGS.find((b) => b.id === w);
  if (byId) return { kit: byId, how: "exact" };
  const exact = sceneKitForWord(w);
  if (exact) return { kit: exact, how: "exact" };
  const wt = tokens(w).filter((t) => !COMMON_TOKENS.has(t));
  let best: CatBuilding | undefined, top = 0;
  for (const b of ASKABLE_KITS) {
    let score = 0;
    const own = new Set([b.id.slice("jp-bldg-f-".length), b.role, b.ko, ...(b.words ?? [])].flatMap(tokens));
    for (const t of kitTokens(b)) {
      if (COMMON_TOKENS.has(t)) continue;
      const k = own.has(t) ? 2 : 1;                                       // 제 이름의 마디가 실내 예제 이름의 마디보다 앞선다
      const min = ascii(t) ? 4 : 2;
      for (const q of wt) {
        if (q === t) score = Math.max(score, t.length * 6 * k);
        else if (oneOff(q, t)) score = Math.max(score, t.length * 4 * k);
        else if (Math.min(q.length, t.length) >= min && (q.includes(t) || t.includes(q))) score = Math.max(score, Math.min(q.length, t.length) * k);
      }
    }
    if (score > top) { top = score; best = b; }
  }
  return best ? { kit: best, how: "nearest" } : undefined;
}
