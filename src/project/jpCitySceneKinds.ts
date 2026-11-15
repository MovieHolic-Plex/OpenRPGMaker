// project/jpCitySceneKinds.ts
// 일본 도시(jp_city) 거리 종류 — 자료(src/assets/jpCityStreetKinds.json)를 읽어 «요청에 맞는 종류 가운데 게임 열쇠와 씨앗으로 하나»를 고른다.
// 왜(오너 2026-11-14 «일본 도시 … 퀄리티가 좀 떨어지는거같은데 .. 오브젝트 수랑 도로 뭐 이것저것»): 거리 꼴이 넷뿐이라 게임마다 같은 거리였다.
// 종류는 도로 짜임(연석 큰길 · 보도 없는 생활도로 · 보행자 시장 길, 하천)·건물 섞임·구획 조각·장면 벌·바닥 톤을 한 벌로 묶는다. 요청 낱말 목록은 없다 — style·shops·region 만 본다.
import catalogJson from "@/assets/jpCityStreetCatalog.json";
import kindsJson from "@/assets/jpCityStreetKinds.json";
import { lookHash } from "@/project/kitLook";

export type SceneStyle = "shopping" | "residential" | "shitamachi" | "shotengai";

export interface SceneTone { readonly ko: string; readonly en: string; readonly lot: readonly string[]; readonly sidewalk: string; readonly road: string; readonly plaza: string; readonly alley: string; /** 주택 필지 바닥(필지마다 돌린다) */ readonly yard: readonly string[]; readonly green: string }

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

export interface CatBuilding { readonly id: string; readonly w: number; readonly h: number; readonly doors: readonly number[]; readonly ml: number; readonly mr: number; readonly cat: string; readonly role: string; readonly tier: string; readonly ko: string; readonly look?: string; /** 차가 드나드는 입(차고·구급차 자리): [첫 열, 폭] */ readonly bay?: readonly [number, number] }

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
