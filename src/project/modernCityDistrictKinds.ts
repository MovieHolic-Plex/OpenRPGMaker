// project/modernCityDistrictKinds.ts
// 한국 도시 지구 종류(상가 골목·빌라촌·아파트 단지·대로변 업무 지구·재래시장·대학가·천변 산책로·역 앞) — 자료는 modernCityDistrictKinds.json.
// 종류마다 길 줄(위→아래), 건물 섞기, 빈 필지 쓰임, 같이 놓는 기물 장면, 밀도 목표를 갖는다. 구성기 modernCityKoreanDistrict.ts 가 읽는다.
// 고르기: 게임 열쇠와 맵 씨앗으로, 요청 사실(맵 크기·바란 가게 수)에 맞는 종류 가운데, 그 게임이 이미 쓴 종류는 빼고. 요청 낱말 목록은 없다.
import { labelNames } from "./labelWords";
import data from "./modernCityDistrictKinds.json" with { type: "json" };
import type { KRGroundNames } from "./modernCityKoreanGround";

export type KRTier = "small" | "medium" | "large" | "xlarge" | "landmark";
export type KRStripType = "B" | "blvd" | "side" | "sidep" | "alley" | "plaza" | "river";
export interface KRStrip { readonly t: KRStripType; readonly min?: number; readonly max?: number; readonly mix?: string; readonly h?: number; readonly anchor?: readonly string[]; readonly stalls?: boolean; /** 시장 통로(벽돌 바닥, 차 없음) */ readonly arcade?: boolean }
export interface KRMix { readonly tiers: Readonly<Partial<Record<KRTier, number>>>; readonly prefer?: readonly string[]; readonly avoid?: readonly string[]; readonly only?: readonly string[]; readonly limit?: number; /** 한 줄에 같은 유형이 몇 채까지(기본 2 — 이웃하지는 않는다) */ readonly rowLimit?: number; readonly space?: number; /** 한 줄에 같은 유형이 또 서도 된다(아파트 동) */ readonly repeat?: boolean }
export interface KRScene { readonly on: string; readonly n: number; readonly kits: readonly { readonly k: string; readonly dx: number; readonly opt?: boolean }[] }
export interface KRDistrictKind {
  readonly id: string; readonly ko: string; readonly en: string;
  readonly strips: readonly KRStrip[];
  /** 세로 길 꼴 후보(through·t-up·t-down·stagger·lane·none — 씨앗이 고른다) · 건물 줄마다 골목 틈 수 [최소, 최대] · 빈 필지 쓰임 · 지하철 출구 수 · 길가·뒷마당 주차 정도(0~1) */
  readonly ns: readonly string[];
  /** 골목 하나를 울타리로 막아 막다른 골목을 만든다. */
  readonly deadEnd?: boolean; readonly gaps: readonly [number, number]; readonly lots: readonly string[]; readonly subway: number; readonly parked: number;
  readonly scenes: readonly string[];
  readonly trim?: "bottom";
  /** 미리 잡는 빈 필지 수(기본 3). */
  readonly lotN?: number;
  /** 대로 차선 수를 넷으로 묶는다(길가 주차 띠가 있는 지구 — 차도 몫이 넘치지 않게). */
  readonly blvdLanes?: 4;
  /** 문 없는 랜드마크(시계탑·주탑) 후보 — 시트에 있으면 빈 필지 하나가 그 기념물의 작은 광장이 된다. */
  readonly monument?: readonly string[];
  /** 이 지구가 쓰는 한국 거리 기물 묶음(set:<이름> — 공용은 늘 쓴다) · 바닥 그림 이름 · 가게 앞 타일 · 어린이 보호구역 노면 · 소방차 전용 표시 · 지하보도 입구. 그림이 시트에 없으면 모두 건너뛴다. */
  readonly sets?: readonly string[]; readonly ground?: KRGroundNames; readonly frontTile?: boolean; readonly schoolZone?: boolean; readonly fireLane?: boolean; readonly underpass?: boolean;
  readonly fits: { readonly minW: number; readonly minH: number; readonly shopsMax?: number };
  readonly targets: { readonly buildings: number; readonly objects: number };
}
interface KRData {
  readonly oldTier: Readonly<Record<string, readonly string[]>>; readonly oldProgram: Readonly<Record<string, string>>;
  readonly onePerMap: readonly string[]; readonly wish: Readonly<Record<string, readonly string[]>>;
  readonly mixes: Readonly<Record<string, KRMix>>; readonly scenes: Readonly<Record<string, KRScene>>; readonly slots: Readonly<Record<string, readonly string[]>>;
  readonly kinds: readonly KRDistrictKind[];
}
export const KR_DISTRICT_DATA = data as unknown as KRData;
export const KR_DISTRICT_KINDS: readonly KRDistrictKind[] = KR_DISTRICT_DATA.kinds;

const hash = (text: string): number => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 17);

/** 이름으로 찾기 — 종류 id(sangga-alley) · 한국어 이름(상가 골목) · 영어 이름. 못 찾으면 undefined. */
export function districtKindByName(name: string | undefined): KRDistrictKind | undefined {
  const n = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!n) return undefined;
  return KR_DISTRICT_KINDS.find((k) => k.id === n || k.ko === n || k.ko.replace(/\s+/g, "") === n.replace(/\s+/g, "") || k.en === n);
}

/** A named place can end with the catalog label, for example "해솔 아파트 단지". */
export function districtKindFromTitle(title: string): KRDistrictKind | undefined {
  return districtKindByName(title) ?? KR_DISTRICT_KINDS.find(kind =>
    labelNames(title, kind.ko) || labelNames(title, kind.ko.replace(/\s+/g, "")) || labelNames(title, kind.en));
}

export interface KRDistrictFacts { readonly width: number; readonly height: number; readonly shops: number }
/**
 * 지구 종류 고르기. hint 가 있고 아는 이름이면 그 종류(크기가 안 맞아도 — 구성기가 줄을 줄여 짓는다).
 * 아니면 요청 사실에 맞는 종류를 게임 열쇠(없으면 씨앗) 순서로 세우고, 그 게임이 이미 쓴 종류(used)를 건너뛴 첫 종류 — 한 게임의 거리 세 장은 세 종류다.
 */
export function pickDistrictKind(key: string | undefined, seed: number, facts: KRDistrictFacts, hint?: string, used: readonly string[] = []): KRDistrictKind {
  const named = districtKindByName(hint);
  if (named) return named;
  const fits = KR_DISTRICT_KINDS.filter((k) => facts.width >= k.fits.minW && facts.height >= k.fits.minH && (k.fits.shopsMax === undefined || facts.shops <= k.fits.shopsMax));
  const pool = fits.length ? fits : KR_DISTRICT_KINDS;
  const salt = key?.trim() ? key : `seed:${seed}`;
  const order = [...pool].sort((a, b) => hash(`${salt}|${a.id}`) - hash(`${salt}|${b.id}`));
  const fresh = order.filter((k) => !used.includes(k.id));
  const list = fresh.length ? fresh : order;
  // 열쇠가 있으면 그 게임의 첫 순서, 없으면 씨앗이 순서를 돌린다(같은 열쇠·다른 씨앗 = 같은 종류의 다른 배치).
  return list[key?.trim() ? 0 : Math.abs(seed) % list.length]!;
}
