// 버들항 마을 종류(2026-11-14) — 미리 지어 둔 마을 서른여덟 종류의 표와, 지금 아는 사실로 그 가운데 하나를 고르는 일.
//
// 왜(오너 2026-11-14 «마을들을 잘 어울리게 수십 종류를 미리미리 만들어놔서 나중에 조수가 참고하는 방향으로»): 게임마다 기물 한 벌을 해시로 고르면
// 물건은 달라져도 마을의 «생업» 이 없다. 종류 하나는 급(외딴 마을·마을·읍) · 어울리는 터(물·단·숲·성벽) · 모이는 곳 · 장면 몇(서너 ~ 여덟 가지가
// 한 자리에 모인 무더기) · 집 곁·물 위·들 물건이다. 표는 src/assets/beodeulVillageKinds.json(고치는 곳: scripts/content/beodeul-village-kinds/).
// 요청 낱말은 보지 않는다 — 고르는 데 쓰는 것은 빌더가 이미 가진 사실(물·단·숲·집 수·성벽·항구·광장을 청했는가)과 게임 열쇠·마을 씨앗뿐이다.
import table from "@/assets/beodeulVillageKinds.json";
import { lookHash } from "@/project/kitLook";
import type { SettlementRank } from "./beodeulSettlementRank";
import { SCENE_ANCHORS, type SceneAnchor, type ScenePiece, type VillageScene } from "./beodeulVillageScenes";

/** 급은 바닥 규칙의 급(beodeulSettlementRank.ts settlementRank)과 같은 것이다 — 따로 셈하지 않는다. */
export type VillageRank = SettlementRank;
export type VillageWater = "sea" | "river" | "lake" | "none";
export interface VillageKind {
  readonly id: string; readonly ko: string; readonly en: string;
  /** 조수가 읽는 두세 낱말(영어). */
  readonly hint: string;
  /** 외딴 마을 · 마을 · 읍 — 바닥의 급과 같은 낱말이다(흙 마당 · 흙길 마을 · 포장 중심부). */
  readonly rank: VillageRank;
  readonly fit: { readonly water: readonly VillageWater[]; readonly tiers?: "hill" | "flat"; readonly woods?: "dense"; readonly walls?: boolean; readonly harbour?: boolean;
    /** 장터·읍 종류 — 광장을 청한 요청에서만 판석 광장 위에 장면을 놓는다. */ readonly square?: boolean };
  readonly gather: { readonly ko: string; readonly en: string };
  /** 일터 건물 킷 후보(문이 아래에 있는 것) — 없으면 그 테마의 헛간·곳간. */
  readonly work: readonly string[];
  readonly scenes: readonly VillageScene[];
  readonly home: readonly string[]; readonly water: readonly string[]; readonly wild: readonly string[];
  /** 공통 기물의 자리 규칙: 간판은 일터·집 문 옆 벽 앞에, 등은 길이 꺾이는 모퉁이에. */
  readonly signs: readonly string[]; readonly lamps: readonly string[];
}

const kit = (id: string) => `bd-${id}`;
/** 조각 글 «[?][~]킷|대안@dx,dy» 를 읽는다. */
function piece(text: string): ScenePiece {
  const m = /^([?~]*)([^@]+)@(-?\d+),(-?\d+)$/u.exec(text);
  if (!m) throw new Error(`마을 종류 표의 조각을 읽지 못했다: ${text}`);
  return { ids: m[2]!.split("|").map(kit), dx: Number(m[3]), dy: Number(m[4]), optional: m[1]!.includes("?"), water: m[1]!.includes("~") };
}
type RawKind = Omit<VillageKind, "scenes" | "fit" | "rank"> & { rank: string; fit: VillageKind["fit"] & { water: readonly string[] }; scenes: { id: string; ko: string; en: string; at: string; min: number; pieces: string[] }[] };
export const BEODEUL_VILLAGE_KINDS: readonly VillageKind[] = (table.kinds as unknown as RawKind[]).map((k) => ({
  ...k, rank: k.rank as VillageRank, fit: k.fit as VillageKind["fit"], work: k.work.map(kit), home: k.home.map(kit), water: k.water.map(kit), wild: k.wild.map(kit), signs: (k.signs ?? []).map(kit), lamps: (k.lamps ?? []).map(kit),
  scenes: k.scenes.map((s) => {
    if (!(SCENE_ANCHORS as readonly string[]).includes(s.at)) throw new Error(`마을 종류 ${k.id} 장면 ${s.id} 의 닻을 모른다: ${s.at}`);
    return { id: s.id, ko: s.ko, en: s.en, at: s.at as SceneAnchor, min: s.min, pieces: s.pieces.map(piece) };
  }),
}));
const BY_ID = new Map(BEODEUL_VILLAGE_KINDS.map((k) => [k.id, k] as const));
export const villageKindById = (id: string): VillageKind | undefined => BY_ID.get(id);

/** 조수가 읽는 한 줄 — 마을 카드의 kind 힌트 뒤에 붙는다(id 와 두세 낱말). */
export const VILLAGE_KIND_LIST = BEODEUL_VILLAGE_KINDS.map((k) => `${k.id} (${k.hint})`).join(" · ");

/** 빌더가 짓기 전에 이미 아는 사실. */
export interface VillageFacts {
  readonly water: VillageWater;
  /** 마을 단 위에 높은 단이 있는가. */
  readonly tiers: boolean;
  /** 숲속 빈터·깊은 숲·둘레 숲 벽인가. */
  readonly deepWoods: boolean;
  /** 정착지의 급 — settlementRank(성벽·청한 광장 = 읍, 흩어진 농가·집 셋까지 = 외딴 마을, 그 밖 = 마을)이 정한 것. */
  readonly rank: VillageRank;
  readonly walls: boolean; readonly harbour: boolean;
  /** 판석 광장을 청했는가. */
  readonly plaza: boolean;
}

/** 그 종류가 이 터에 어울리는가 — 바다 마을은 나무꾼 터가 아니고, 성벽 없는 마을은 수비대 성읍이 아니다. */
export function villageKindFits(kind: VillageKind, f: VillageFacts, anyRank = false): boolean {
  if (!kind.fit.water.includes(f.water)) return false;
  if (kind.fit.tiers === "hill" && !f.tiers) return false;
  if (!!kind.fit.walls !== f.walls) return false;
  if (kind.fit.harbour && !f.harbour) return false;
  if (f.harbour && kind.rank === "hamlet") return false;
  if (kind.fit.woods === "dense" && !f.deepWoods) return false;
  // 급: 바닥이 정한 급과 같은 종류만(흙 마당 마을에 읍의 장면이 서지 않게). 항구를 청했으면 항구 종류는 급과 상관없이 맞는다.
  return anyRank || kind.rank === f.rank || (!!kind.fit.harbour && f.harbour);
}

/**
 * 종류를 고른다. named = 요청이 이름으로 정한 종류(표에 있으면 그대로 — 터가 안 맞아도 짓는다, 놓을 수 없는 장면은 빠진다).
 * 이름이 없으면 게임 열쇠가 있을 때만: 터에 맞는 종류를 그 게임의 차례(열쇠 해시)로 세우고, 마을 씨앗으로 차례의 시작을 돌린 뒤,
 * 이 게임의 다른 마을이 이미 쓴 종류(taken)를 건너뛴 첫 번째. 깊은 숲이면 숲 종류가 먼저다.
 * 열쇠도 이름도 없으면 고르지 않는다(사람 편집·스크립트는 전과 같다).
 */
export function chooseVillageKind(facts: VillageFacts, key: string | undefined, seed: number, named?: string, taken: ReadonlySet<string> = new Set()): VillageKind | undefined {
  if (named) return BY_ID.get(named);
  if (!key) return undefined;
  // 그 급의 종류가 이 터에 하나도 없으면(광장을 청한 포구 — 바다의 읍 종류는 항구뿐이다) 급을 풀어 터에 맞는 것 가운데서 고른다.
  const ranked = BEODEUL_VILLAGE_KINDS.filter((k) => villageKindFits(k, facts));
  const fits = ranked.length ? ranked : BEODEUL_VILLAGE_KINDS.filter((k) => villageKindFits(k, facts, true));
  if (!fits.length) return undefined;
  // 깊은 숲이면 숲 종류가 먼저다. 광장을 청한 마을은 급이 읍이다 — 읍 종류 가운데서 고른다(장터만이 아니라 길드 거리·운하 읍도 광장을 둔다).
  const first = facts.deepWoods ? fits.filter((k) => k.fit.woods === "dense") : [];
  const narrowed = first.length ? first : fits;
  const order = [...narrowed].sort((a, b) => lookHash(`village-kind|${key}|${a.id}`) - lookHash(`village-kind|${key}|${b.id}`) || a.id.localeCompare(b.id));
  const start = lookHash(`village-kind|${key}|seed|${seed}`) % order.length;
  const turned = [...order.slice(start), ...order.slice(0, start)];
  return turned.find((k) => !taken.has(k.id)) ?? turned[0];
}
