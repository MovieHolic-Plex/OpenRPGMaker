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

/** 조수가 읽는 전체 목록(id 와 두세 낱말). 늘 실리는 마을 카드에는 싣지 않는다 — 마을의 땅 그림 답과 모르는 kind 의 거절 글에만 실린다(villageKindMenu). */
const kindWords = (ks: readonly VillageKind[]): string => ks.map((k) => `${k.id} (${k.hint})`).join(" · ");
export const VILLAGE_KIND_LIST = kindWords(BEODEUL_VILLAGE_KINDS);
/** 늘 실리는 마을 카드의 예 넷 — 바닷가 · 강가 · 들 · 읍에서 하나씩. 게임 열쇠가 없는 지시문(사람 편집·시험)의 예이고, 조수 실행은 villageKindExamples 가 게임마다 고른다. */
export const VILLAGE_KIND_EXAMPLES: readonly string[] = ["fishing-cove", "mill-hamlet", "smithy-village", "harbour-town"];
/** 예 넷의 id 글자 수 상한 — 고른 예가 늘 실리는 지시문(방탈출 상한 66,700)을 늘리지 않게 위 넷과 같은 글자 수 안에서 고른다. */
const EXAMPLE_ID_CHARS = VILLAGE_KIND_EXAMPLES.reduce((n, id) => n + id.length, 0);

/**
 * 마을 카드에 싣는 종류의 예 넷(2026-11-16 감독 «조수가 짓는 게임이 매번 비슷하다»): r6·r7a·r7 세 판이 모두 카드의 첫 예 fishing-cove 를 hints.kind 로 보냈다.
 * 요청에 가까운 종류 하나가 있으면 그것이 맨 앞(nearestVillageKind — 표의 id·뜻·한글 이름으로 잰다), 나머지는 게임 열쇠로 섞은 차례 — 게임마다 다른 예가 다른 순서로 선다.
 * 같은 열쇠·같은 요청이면 늘 같은 넷이다. 열쇠도 요청도 없으면 고정 예 넷.
 */
export function villageKindExamples(key = "", request = ""): string[] {
  const near = request.trim() ? nearestVillageKind(request) : undefined;
  // 열쇠가 없으면(사람 편집·시험) 고정 예 넷의 차례 — 요청에 가까운 종류만 앞에 선다.
  const fixed = VILLAGE_KIND_EXAMPLES.map((id) => villageKindById(id)).filter((k): k is VillageKind => !!k);
  const seeded = key.trim() ? [...BEODEUL_VILLAGE_KINDS].sort((a, b) => lookHash(`kind-example|${key}|${a.id}`) - lookHash(`kind-example|${key}|${b.id}`) || a.id.localeCompare(b.id)) : fixed;
  const out: string[] = [];
  let chars = 0;
  for (const k of [...(near ? [near] : []), ...seeded]) {
    if (out.length >= VILLAGE_KIND_EXAMPLES.length) break;
    if (out.includes(k.id) || chars + k.id.length > EXAMPLE_ID_CHARS) continue;
    out.push(k.id); chars += k.id.length;
  }
  return out;
}

/** 종류를 가르지 못하는 낱말 — 가까운 이름을 찾을 때 세지 않는다. */
const COMMON_KIND_WORDS = new Set(["village", "town", "hamlet", "마을", "읍"]);
/** 모르는 낱말에 가까운 종류부터 세운 전체 목록 — id·뜻·한글 이름에 낱말이 걸리는 종류가 먼저, 그다음 id 의 오타로 읽히는 것, 나머지는 표의 차례. */
export function villageKindsNearestFirst(word: string): VillageKind[] {
  return rankKindsByWord(word, BEODEUL_VILLAGE_KINDS).map((e) => e.kind);
}

/** 이름표(id · ko · en · hint)를 가진 종류 목록을 모르는 낱말에 가까운 차례로 — 마을 종류와 깎아지른 지형 종류가 같은 잣대를 쓴다. score 0 · typo 99 면 아무 데도 안 걸린 것. */
export function rankKindsByWord<K extends { readonly id: string; readonly ko: string; readonly en: string; readonly hint: string }>(word: string, kinds: readonly K[]): { kind: K; score: number; typo: number }[] {
  const w = word.trim().toLowerCase();
  const tokens = w.split(/[^a-z0-9가-힣]+/u).filter((t) => t.length >= 2 && !COMMON_KIND_WORDS.has(t));
  const distance = (a: string, b: string): number => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) { const next = [i]; for (let j = 1; j <= b.length; j += 1) next.push(Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))); row = next; }
    return row[b.length]!;
  };
  const score = (k: K): number => {
    const rest = `${k.hint} ${k.en} ${k.ko}`.toLowerCase();
    let n = 0;
    for (const t of tokens) n += k.id.includes(t) ? 4 : rest.includes(t) ? 2 : 0;
    for (const part of [...k.id.split("-"), ...k.ko.split(/\s+/u)]) if (part.length >= 2 && !COMMON_KIND_WORDS.has(part) && w.includes(part.toLowerCase())) n += 3;
    return n;
  };
  // 글자 거리는 오타(id 길이의 삼분의 일 안)일 때만 센다 — 아무 데도 안 걸리는 낱말에 짧은 id 가 «가까운 것» 으로 앞서지 않게, 그때는 표의 차례 그대로다.
  const typo = (k: K): number => { const d = distance(w, k.id); return d <= Math.max(2, Math.floor(k.id.length / 3)) ? d : 99; };
  return kinds.map((k, i) => ({ k, i, s: score(k), d: typo(k) })).sort((a, b) => b.s - a.s || a.d - b.d || a.i - b.i).map((e) => ({ kind: e.k, score: e.s, typo: e.d }));
}

/**
 * 모르는 이름에 가장 가까운 종류 하나 — 낱말이 id·뜻·한글 이름에 걸리거나 id 의 오타일 때만(아무 데도 안 걸리면 undefined: 게임이 터에 맞는 종류를 고른다).
 * 모르는 kind 를 거절하지 않고 가까운 종류로 짓고 알린다(2026-11-16 오너 «거절은 게임이 깨질 때만»).
 */
export function nearestVillageKind(word: string): VillageKind | undefined {
  const first = villageKindsNearestFirst(word)[0];
  if (!first) return undefined;
  // 표의 첫 종류가 그대로 맨 앞이면 걸린 것이 없다는 뜻일 수 있다 — 그 종류를 빼고 세워도 맨 앞이 같은지로 가린다
  const w = word.trim().toLowerCase();
  const touches = (k: VillageKind) => { const hay = `${k.id} ${k.hint} ${k.en} ${k.ko}`.toLowerCase(); return w.split(/[^a-z0-9가-힣]+/u).some((t) => t.length >= 2 && !COMMON_KIND_WORDS.has(t) && hay.includes(t)) || [...k.id.split("-"), ...k.ko.split(/\s+/u)].some((p) => p.length >= 2 && !COMMON_KIND_WORDS.has(p) && w.includes(p.toLowerCase())); };
  const close = (k: VillageKind) => { let row = Array.from({ length: k.id.length + 1 }, (_, i) => i); for (let i = 1; i <= w.length; i += 1) { const next = [i]; for (let j = 1; j <= k.id.length; j += 1) next.push(Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (w[i - 1] === k.id[j - 1] ? 0 : 1))); row = next; } return row[k.id.length]! <= Math.max(2, Math.floor(k.id.length / 3)); };
  return touches(first) || close(first) ? first : undefined;
}

/**
 * 조수가 마을을 짓기 전에 읽는 종류 목록 한 줄. water 를 주면 그 물에 맞는 종류를 앞에(땅 그림 답), near 를 주면 그 낱말에 가까운 종류를 앞에(모르는 kind 의 거절 글).
 */
export function villageKindMenu(by: { water?: VillageWater; near?: string; key?: string } = {}): string {
  if (by.near !== undefined) return `Village kinds, nearest first: ${kindWords(villageKindsNearestFirst(by.near))}.`;
  if (by.water === undefined) return `Village kinds: ${VILLAGE_KIND_LIST}.`;
  // 그 물에 맞는 무리 안은 게임 열쇠로 섞는다 — 표의 차례 그대로면 바닷가 마을마다 fishing-cove 가 맨 앞에 섰다. 열쇠가 없으면 표의 차례.
  const order = (ks: VillageKind[]) => (by.key?.trim() ? ks.sort((a, b) => lookHash(`kind-menu|${by.key}|${a.id}`) - lookHash(`kind-menu|${by.key}|${b.id}`) || a.id.localeCompare(b.id)) : ks);
  const fit = order(BEODEUL_VILLAGE_KINDS.filter((k) => k.fit.water.includes(by.water!))), other = BEODEUL_VILLAGE_KINDS.filter((k) => !k.fit.water.includes(by.water!));
  return `Village kinds for this water: ${kindWords(fit)}. For other water (built anyway if named; scenes with no room are left out): ${kindWords(other)}.`;
}

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
