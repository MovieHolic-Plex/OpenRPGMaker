// ai/stampObjects.ts
// 바로 깔기의 「물건」 사전 — 화분·의자·벤치처럼 칩셋에 그림이 있어야 놓을 수 있는 것을 **이름으로 엄격하게** 찾는다.
//
// 왜(2026-10-15 적대적 리뷰, scripts/qa/stamp-place-corpus.mts): 계획기에는 물건을 찍는 도구가 없었다. 모델은 「화분」에도 지형 라벨
// (「거리 · 땅·잔디·판석·참배길」)을 place_props 에 넣었고, 퍼지 매칭이 그대로 깔아 도로 위에 갈색 자갈이 생겼다. 그림이 없는 물건은
// 그림 없는 조사 지점·NPC 이벤트로 흉내 내고 「배치 완료」라고 했다(200회 중 거짓 보고 37건).
// 여기서는 모델이 고른 **이름**(철자를 고친 일상 명사 + 동의어)을 코드가 칩셋의 킷·소품 그룹 이름과 대조한다.
//  - 이름·태그 수준에서 맞아야 한다(설명문에 낱말이 스친 것은 후보일 뿐 — 「탁상 물건 · 생선」이 벤치가 되지 않게).
//  - 못 찾으면 이벤트도 지형도 깔지 않는다. 가까운 물건 이름을 돌려 거절한다(무음 대체 금지).
// 순수 모듈 — 스토어·네트워크 없음.
import type { SectionStructureKitDef, TileGroupMetadata, TilesetDef } from "@/project/types";

export type StampObjectSource = "pack" | "authored" | "hand" | "group";

export interface StampObjectEntry {
  /** 킷 id 또는 소품 그룹 id. */
  readonly id: string;
  readonly kind: "kit" | "group";
  readonly name: string;
  readonly source: StampObjectSource;
  readonly width: number;
  readonly height: number;
  /** 이름·태그 검색용(소문자·공백 정규화). */
  readonly nameText: string;
  /** 설명 검색용 — 후보 제안에만 쓴다. */
  readonly descText: string;
  /** 그림이 놓는 방식: 바닥에 서는 물건인가. 벽·문·간판에 붙는 것은 바로 깔기가 놓지 않는다. */
  readonly floorStanding: boolean;
}

/** 바로 깔기가 한 번에 놓는 물건 한 개의 최대 칸 수(건물·큰 구조물은 다른 도구의 일). */
const MAX_OBJECT_CELLS = 9;
const MAX_OBJECT_SIDE = 3;
const WALL_TAGS = new Set(["wallmount", "door", "overhead", "wall", "hang", "window", "decal"]);
const STRUCTURE_WORDS = /건물|집 외장|지붕|성벽|외벽|가게 앞|상가|띠\b/u;
const OBJECT_GROUP_ROLES = new Set(["prop", "furniture", "decoration", "detail"]);

function norm(text: string): string {
  return text.toLowerCase().replace(/[\s·・,.()\[\]_/\\-]+/gu, " ").trim();
}

/** 이름·id 에 「벽/창/문/걸이」가 든 물건은 벽에 붙는 부착물 — 바닥에 서지 않는다(「벽 횃불」이 바닥 칸에서 무결성 거부됐다). */
const WALL_BOUND_NAME = /(?:^|[\s_:-])(?:wall|window|door|hang|벽|창|창문|문|걸이|걸개|현판)(?:$|[\s_:-])|벽걸이|벽 /iu;

function isFloorStanding(kit: SectionStructureKitDef): boolean {
  if (WALL_BOUND_NAME.test(`${kit.name ?? ""} ${kit.id}`)) return false;
  const tags = kit.ai?.tags ?? [];
  if (tags.some((tag) => WALL_TAGS.has(tag))) return false;
  const snap = (kit.ai as { snap?: string } | undefined)?.snap;
  if (snap && snap !== "floor") return false;
  return true;
}

function sourceOf(kit: SectionStructureKitDef): StampObjectSource {
  if (kit.learnedFrom === "pack-preset" || kit.learnedFrom === "workshop") return "pack";
  if (String(kit.learnedFrom).startsWith("hand-interior")) return "hand";
  return "authored";
}

/** 킷이 「물건 하나」인가 — 작고, 이름이 있고, 건물 부품이 아니다. */
function isObjectKit(kit: SectionStructureKitDef): boolean {
  const name = (kit.name ?? "").trim();
  if (!name) return false;
  if (kit.width < 1 || kit.height < 1 || kit.width > MAX_OBJECT_SIDE || kit.height > MAX_OBJECT_SIDE) return false;
  if (kit.width * kit.height > MAX_OBJECT_CELLS) return false;
  if (!kit.rows?.length) return false;
  if (STRUCTURE_WORDS.test(name)) return false;
  return true;
}

function isObjectGroup(group: TileGroupMetadata): boolean {
  if (!group.name?.trim() || group.tileIds.length === 0) return false;
  if (!OBJECT_GROUP_ROLES.has(String(group.role))) return false;
  // 한 칸짜리이거나 패턴 문법이 있는 그룹만 — 문법 없는 여러 칸 그룹은 낱장으로 흩어져 조각만 놓인다.
  return group.tileIds.length === 1 || Boolean(group.patternGrammar);
}

/** 타일셋에서 놓을 수 있는 물건 사전을 만든다. 같은 타일셋이면 한 번만 계산해 캐시한다. */
const indexCache = new WeakMap<TilesetDef, readonly StampObjectEntry[]>();

export function buildStampObjectIndex(tileset: TilesetDef | undefined): readonly StampObjectEntry[] {
  if (!tileset) return [];
  const cached = indexCache.get(tileset);
  if (cached) return cached;
  const entries: StampObjectEntry[] = [];
  const seenKitIds = new Set<string>();
  for (const kit of tileset.structureKits ?? []) {
    if (!isObjectKit(kit) || seenKitIds.has(kit.id)) continue;
    seenKitIds.add(kit.id);
    const tags = kit.ai?.tags ?? [];
    entries.push({
      id: kit.id,
      kind: "kit",
      name: (kit.name ?? kit.id).trim(),
      source: sourceOf(kit),
      width: kit.width,
      height: kit.height,
      nameText: norm(`${kit.name ?? ""} ${tags.join(" ")} ${kit.id.replace(/^[a-z]+(?:-[a-z]+)?[:-]/iu, "")}`),
      descText: norm(kit.ai?.description ?? ""),
      floorStanding: isFloorStanding(kit),
    });
  }
  for (const group of tileset.tileGroups ?? []) {
    if (!isObjectGroup(group)) continue;
    entries.push({
      id: group.id,
      kind: "group",
      name: group.name.trim(),
      source: "group",
      width: 1,
      height: 1,
      nameText: norm(`${group.name} ${((group as { tags?: string[] }).tags ?? []).join(" ")}`),
      descText: norm(group.description ?? ""),
      floorStanding: true,
    });
  }
  indexCache.set(tileset, entries);
  return entries;
}

// ── 이름 대조 ────────────────────────────────────────────────────────────────

const HANGUL_BASE = 0xac00;
const CHOSEONG = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const JUNGSEONG = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const JONGSEONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

/** 한글을 자모로 푼다(철자 오타를 자모 한 칸 차이로 세려고). */
export function toJamo(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= HANGUL_BASE && code <= 0xd7a3) {
      const offset = code - HANGUL_BASE;
      out += CHOSEONG[Math.floor(offset / 588)]! + JUNGSEONG[Math.floor((offset % 588) / 28)]! + JONGSEONG[offset % 28]!;
    } else out += ch;
  }
  return out;
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      cur.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** 이름 문자열을 낱말로 — 「화분 고사리 (0,0)」→ [화분, 고사리]. 칸 번호·크기 꼬리는 버린다. */
function tokens(text: string): string[] {
  return norm(text.replace(/\(\s*-?\d+\s*,\s*-?\d+\s*\)/gu, " ").replace(/\d+\s*[×x]\s*\d+/giu, " ")).split(" ").filter(Boolean);
}

/** 이름 수준 일치 점수: 3 = 낱말이 그 이름, 2 = 낱말이 그 이름으로 시작하거나(2자 이상) 포함, 0 = 불일치. */
function nameScore(query: string, entry: StampObjectEntry): number {
  const q = norm(query);
  if (!q) return 0;
  const words = entry.nameText.split(" ").filter(Boolean);
  if (words.includes(q)) return 3;
  // 한 글자 낱말(통·문)은 낱말이 정확히 같을 때만 — 「통로」「소통」에 걸리지 않게.
  if ([...q].length < 2) return 0;
  if (words.some((word) => word.startsWith(q))) return 2;
  if (entry.nameText.includes(q)) return 2;
  return 0;
}

/** 오타 한 칸(자모 편집거리 1) 일치. 두 글자 이상 낱말에서만. 철자 보정으로 표시한다. */
function fuzzyNameScore(query: string, entry: StampObjectEntry): number {
  const q = norm(query);
  if ([...q].length < 2) return 0;
  const qj = toJamo(q);
  for (const word of tokens(entry.nameText)) {
    if ([...word].length < 2) continue;
    if (editDistance(toJamo(word), qj, 1) <= 1) return 1;
  }
  return 0;
}

/**
 * 같은 물건을 가리키는 낱말 묶음. 모델이 준 「비슷한 말」은 **이 묶음 안에서만** 받는다 —
 * 「황금 왕좌」에 「의자」, 「공룡 알」에 「바위」, 「대포」에 「화로」를 붙여 엉뚱한 그림을 깔던 길을 막는다(2026-10-15 코퍼스).
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["화분", "꽃 화분", "화초", "planter", "pot", "flowerpot"],
  ["의자", "스툴", "걸상", "chair", "stool"],
  ["탁자", "테이블", "식탁", "책상", "table", "desk"],
  ["침대", "bed"],
  ["벤치", "긴 의자", "bench"],
  ["책장", "서가", "책꽂이", "bookshelf", "bookcase"],
  ["통", "나무통", "술통", "배럴", "barrel", "keg"],
  ["상자", "나무 상자", "궤", "박스", "크레이트", "crate", "box"],
  ["항아리", "단지", "독", "jar", "urn"],
  ["우물", "well"],
  ["가로등", "등불", "랜턴", "가로 등", "street lamp", "lamp", "lantern", "lamppost"],
  ["횃불", "토치", "torch"],
  ["모닥불", "화톳불", "캠프파이어", "campfire", "bonfire"],
  ["바위", "돌", "큰 바위", "암석", "boulder", "rock", "stone"],
  ["덤불", "관목", "수풀", "bush", "shrub"],
  ["꽃", "꽃밭", "화단", "꽃무더기", "flower", "flowerbed"],
  ["울타리", "펜스", "담장", "fence", "hedge"],
  ["표지판", "푯말", "이정표", "안내판", "sign", "signpost"],
  ["간판", "signboard"],
  ["동상", "조각상", "statue"],
  ["우체통", "mailbox", "postbox"],
  ["자판기", "vending machine", "vending"],
  ["카펫", "러그", "양탄자", "깔개", "carpet", "rug"],
  ["나무", "tree"],
  ["연못", "분수", "pond", "fountain"],
  ["계단", "stair", "stairs"],
  ["문", "door"],
];

function synonymGroupOf(name: string): readonly string[] | null {
  const q = norm(name);
  for (const group of SYNONYM_GROUPS) if (group.some((word) => norm(word) === q)) return group;
  return null;
}

/** 모델이 제안한 이름 중 코드가 인정하는 것 — 첫 이름(사용자 말)과 같은 묶음에 든 말만. */
export function acceptedObjectNames(primary: string, alternatives: readonly string[]): { readonly names: string[]; readonly rejected: string[] } {
  const group = synonymGroupOf(primary);
  const names = [primary];
  const rejected: string[] = [];
  for (const alt of alternatives) {
    if (norm(alt) === norm(primary)) continue;
    if (group && group.some((word) => norm(word) === norm(alt))) names.push(alt);
    else rejected.push(alt);
  }
  // 묶음의 다른 낱말도 시도한다(칩셋이 「테이블」로만 이름을 붙였을 수 있다).
  if (group) for (const word of group) if (!names.some((existing) => norm(existing) === norm(word))) names.push(word);
  return { names, rejected };
}

export interface StampObjectHit {
  readonly entry: StampObjectEntry;
  /** 어느 이름(요청 이름 또는 동의어)으로 찾았나. */
  readonly matchedBy: string;
  /** 오타 보정으로 찾았으면 true. */
  readonly corrected: boolean;
  /** 같은 이름으로 맞은 변형(방향·색 등) — 첫 번째가 대표다. */
  readonly variants: readonly StampObjectEntry[];
}

const SOURCE_RANK: Readonly<Record<StampObjectSource, number>> = { pack: 0, hand: 1, authored: 2, group: 3 };

function pickVariants(hits: readonly { entry: StampObjectEntry; score: number }[]): StampObjectEntry[] {
  const best = Math.max(...hits.map((hit) => hit.score));
  return hits
    .filter((hit) => hit.score === best)
    .map((hit) => hit.entry)
    .sort((a, b) =>
      SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
      || a.name.length - b.name.length
      || a.width * a.height - b.width * b.height
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * 이름으로 물건을 찾는다. `names[0]` 이 사용자 말(철자 오타 보정은 이 이름에만), 나머지는 같은 묶음의 동의어다.
 * 바닥에 서는 물건만(벽·문·간판 부착물은 제외). 이름 수준에서 맞는 것이 없으면 null.
 */
export function resolveStampObject(
  index: readonly StampObjectEntry[],
  names: readonly string[],
): StampObjectHit | null {
  const floor = index.filter((entry) => entry.floorStanding);
  for (const name of names) {
    const scored: { entry: StampObjectEntry; score: number }[] = [];
    for (const entry of floor) {
      const score = nameScore(name, entry);
      if (score > 0) scored.push({ entry, score });
    }
    if (scored.length === 0) continue;
    const variants = pickVariants(scored);
    return { entry: variants[0]!, matchedBy: name, corrected: false, variants };
  }
  // 오타 한 칸 — 사용자 말(첫 이름)과 그 묶음 낱말에만.
  const primary = names[0];
  if (primary !== undefined) {
    const scored: { entry: StampObjectEntry; score: number }[] = [];
    for (const entry of floor) {
      const score = fuzzyNameScore(primary, entry);
      if (score > 0) scored.push({ entry, score });
    }
    if (scored.length > 0) {
      const variants = pickVariants(scored);
      return { entry: variants[0]!, matchedBy: primary, corrected: true, variants };
    }
  }
  return null;
}

/** 못 찾았을 때 보여 줄 가까운 물건 이름(중복 이름 제거) — 이름 일치 → 설명 일치 → 자모 거리 순. */
export function nearestStampObjects(index: readonly StampObjectEntry[], names: readonly string[], limit = 5): string[] {
  const floor = index.filter((entry) => entry.floorStanding);
  const scored = new Map<string, number>();
  const bump = (entry: StampObjectEntry, score: number): void => {
    const label = baseName(entry.name);
    if ((scored.get(label) ?? 0) < score) scored.set(label, score);
  };
  for (const name of names) {
    const q = norm(name);
    if (!q) continue;
    const qj = toJamo(q);
    for (const entry of floor) {
      const direct = nameScore(name, entry);
      if (direct > 0) { bump(entry, 30 + direct); continue; }
      if ([...q].length >= 2 && entry.descText.includes(q)) { bump(entry, 20); continue; }
      let best = 99;
      for (const word of tokens(entry.nameText)) {
        if ([...word].length < 2) continue;
        best = Math.min(best, editDistance(toJamo(word), qj, 3));
      }
      if (best <= 3) bump(entry, 10 - best);
    }
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, limit).map(([label]) => label);
}

/** 「화분 고사리 (0,0)」「버들항 소품 둥근 돌 화분 1×1」 → 사람이 읽는 짧은 이름. */
export function baseName(name: string): string {
  return name.replace(/\(\s*-?\d+\s*,\s*-?\d+\s*\)/gu, "").replace(/\s*\d+\s*[×x]\s*\d+\s*$/iu, "").replace(/\s+/gu, " ").trim() || name;
}

/** 모델에게 보여 줄 「이 칩셋에 있는 물건」 견본 — 이름 어휘를 맞추게 하는 데만 쓴다(최대 limit 개, 이름 중복 제거). */
export function sampleStampObjectNames(index: readonly StampObjectEntry[], limit = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const floor = index.filter((entry) => entry.floorStanding);
  // 출처별로 번갈아 뽑아 한 출처에 쏠리지 않게.
  const bySource = (source: StampObjectSource): StampObjectEntry[] => floor.filter((entry) => entry.source === source);
  const lanes = (["pack", "hand", "authored", "group"] as const).map(bySource).filter((lane) => lane.length > 0);
  let round = 0;
  while (out.length < limit && lanes.some((lane) => round < lane.length)) {
    for (const lane of lanes) {
      const entry = lane[round];
      if (!entry) continue;
      const label = baseName(entry.name);
      const key = norm(label).split(" ")[0] ?? label;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
      if (out.length >= limit) break;
    }
    round += 1;
  }
  return out;
}
