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
export type StampObjectPlacement = "floor" | "wall" | "water" | "road";

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
  /** 놓이는 표면 종류(바닥·벽면·물 위 다리·차도 위 차량/횡단보도). */
  readonly placement?: StampObjectPlacement;
  /** 칩셋·장소 접두어를 뗀 핵심 물건 이름(정확도 우선 정렬용). */
  readonly coreName?: string;
  /** 실내 전용 프리셋(jp-in-*, mc-in-*)인가 — 야외 물건과 동점이면 야외를 먼저 고른다. */
  readonly indoor?: boolean;
}

/** 바로 깔기가 한 번에 놓는 물건(나무·분수·다리·차량·제단 포함)의 최대 크기(건물·집은 place_house 가 맡는다). */
const MAX_OBJECT_CELLS = 36;
const MAX_OBJECT_SIDE = 7;
const WALL_TAGS: Readonly<Record<string, true>> = { wallmount: true, door: true, overhead: true, wall: true, hang: true, window: true, decal: true };
const STRUCTURE_WORDS = /건물|집 외장|성벽|외벽|가게 앞|\b띠\b/u;
const OBJECT_GROUP_ROLES: Readonly<Record<string, true>> = { prop: true, furniture: true, decoration: true, detail: true };

/** 집·건물·지붕 부품·그림자·바닥/벽면 타일 패치는 물건 사전에서 뺀다(place_house·place_dungeon_room·fill_region 이 맡는다). */
const NON_OBJECT_KIT_ID =
  /^(?:bd-(?:house|block|facility|rv-shadow|rv-foundation|mpart-(?:roof|bay|gable|dormer|porch|wall|chimney)|out-(?:roof|log|logg|plank|gable|chimney)|ground-|pick-mining-valley-(?:d\d|e\d|s\d|w\d|boss|hall|inn|smelt|smith)|pick-desert-oasis-(?:n\d|s\d|w\d|khan|temple)|pick-snowfield-(?:e\d|n\d|s\d|w\d|shed|hall|bath)|pick-swamp-stilt-(?:e\d|n\d|s\d|w\d|pierhut|hall|loom|shrine))|jp-(?:bldg|recipe|sf|roof|foot-shadow|road-lane|door-)|mc-(?:bld|road-ew|road-ns|street-|intersection-)|jb-(?:giwa_house|thatch_house|palace_)|wz-(?:lake-boathouse|lake-bh-))|-(?:ground|floor|face|ceiling)-|(?:-ceiling|-water-sew|-water-sea|-water-tide)$/i;

/** 장소·범주 태그(「걸음 구조물(다리·계단·잔교)」「편의점」「주택」)가 물건 이름으로 둔갑하지 않게 걸러 낸다. */
const CATEGORY_TAG_RE =
  /[()]|^(?:버들항|현대 도시|일본 도시|마법 세계|조선|실내|야외|거리|공공|상점|편의점|카페|이자카야|주택|빌딩|마을|던전|광산|설원|사막|늪|성 지하|지하 수도교|바다 동굴|화산 동굴|어촌|산길|강변|신전|고원|포도원|숲길|등대|걸음 구조물|물체|소품|가구|자연|차량|도로)/u;

function norm(text: string): string {
  return text.toLowerCase().replace(/[\s·・,.()\[\]_/\\-]+/gu, " ").trim();
}

/** 이름·id 에 「벽/창/문/걸이」가 든 물건은 벽에 붙는 부착물 — 바닥에 서지 않는다(「벽 횃불」이 바닥 칸에서 무결성 거부됐다). */
const WALL_BOUND_NAME = /(?:^|[\s_:-])(?:wall|window|door|hang|벽|창|창문|문|걸이|걸개|현판)(?:$|[\s_:-])|벽걸이|벽 /iu;
const WALL_MOUNTABLE_PROP = /torch-wall|벽 횃불|횃불|arch-bars|arch-dark|arch-open|arch-water|벽 아치|철창 아치|stairs-up-face|올라가는 계단|banner|현수막|niche|벽감|chains|사슬|vines|담쟁이/iu;
const WATER_BRIDGE_KIT = /\bbridge\b|footbridge|다리|널다리|돌다리/iu;
const ROAD_VEHICLE_OR_MARKING_KIT = /^mc-veh-|^jp-prop-(?:car|ad-truck|ricksha|train)|^mc-crosswalk-|crosswalk|횡단보도/iu;

function kitPlacementOf(kit: SectionStructureKitDef): StampObjectPlacement | null {
  const label = `${kit.id} ${kit.name ?? ""}`;
  if (WATER_BRIDGE_KIT.test(label) && !/말뚝|기둥|post|pier-hut/iu.test(label)) return "water";
  if (ROAD_VEHICLE_OR_MARKING_KIT.test(label)) return "road";
  if (isFloorStanding(kit)) return "floor";
  if (WALL_MOUNTABLE_PROP.test(label)) return "wall";
  return null;
}

function isFloorStanding(kit: SectionStructureKitDef): boolean {
  if (WALL_BOUND_NAME.test(`${kit.name ?? ""} ${kit.id}`)) return false;
  const tags = kit.ai?.tags ?? [];
  if (tags.some((tag) => WALL_TAGS[tag] === true)) return false;
  const ai = kit.ai;
  const snap = ai && typeof ai === "object" && "snap" in ai && typeof ai.snap === "string" ? ai.snap : undefined;
  if (snap && snap !== "floor") return false;
  return true;
}

function sourceOf(kit: SectionStructureKitDef): StampObjectSource {
  if (kit.learnedFrom === "pack-preset" || kit.learnedFrom === "workshop") return "pack";
  if (String(kit.learnedFrom).startsWith("hand-interior")) return "hand";
  return "authored";
}

const LOCATION_PREFIX_RE =
  /^(?:버들항(?:\s.*)?|현대\s*도시|일본\s*도시|마법\s*세계|조선|건물(?:\s*띠)?|거리|공공|소품|차량|부착물|실내(?:\s*바닥|\s*벽면|\s*천장\s*띠|\s*가구)?)$/u;

/** 「버들항 지하 수도교·하수도 · 통 1×1」「승용차 · 검정 · 오른쪽 향함」 → 핵심 물건 이름 「통」「승용차」. */
export function extractCoreObjectName(name: string): string {
  const base = baseName(name);
  const parts = base.split(/\s+·\s+/u).map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && LOCATION_PREFIX_RE.test(parts[0]!)) {
    parts.shift();
  }
  const head = parts[0] ?? base;
  return head
    .replace(/\([^)]*\)/gu, " ")
    .replace(/^(?:버들항\s*소품|버들항|조선|마법\s*세계|현대\s*도시|일본\s*도시)\s+/u, "")
    .replace(/\s+/gu, " ")
    .trim() || base;
}

/** 킷이 「물건 하나」인가 — 적당한 크기이고, 이름이 있고, 건물 외장/바닥 패치가 아니다. */
function isObjectKit(kit: SectionStructureKitDef): boolean {
  const name = (kit.name ?? "").trim();
  if (!name) return false;
  if (kit.width < 1 || kit.height < 1 || kit.width > MAX_OBJECT_SIDE || kit.height > MAX_OBJECT_SIDE) return false;
  if (kit.width * kit.height > MAX_OBJECT_CELLS) return false;
  if (!kit.rows?.length) return false;
  if (NON_OBJECT_KIT_ID.test(kit.id)) return false;
  if (STRUCTURE_WORDS.test(name)) return false;
  return kitPlacementOf(kit) !== null;
}

function isObjectGroup(group: TileGroupMetadata): boolean {
  if (!group.name?.trim() || group.tileIds.length === 0) return false;
  if (OBJECT_GROUP_ROLES[String(group.role)] !== true) return false;
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
    const placement = kitPlacementOf(kit);
    if (!placement) continue;
    seenKitIds.add(kit.id);
    const rawTags = (kit.ai?.tags ?? []).filter((tag) => !CATEGORY_TAG_RE.test(tag.trim()));
    const rawName = (kit.name ?? kit.id).trim();
    const core = extractCoreObjectName(rawName);
    const slug = kit.id
      .replace(/^(?:bd-pick-[a-z-]+-|bd-(?:prop|mpart|out|tree|farm|bridge)-|jp-(?:prop|in-[a-z]+|tram|road)-|mc-(?:prop|veh|in-[a-z]+)-|jb-|wz-)/iu, "");
    const kitAliases = kit.id === "bd-pick-desert-oasis-well" ? "분수 분수대 수반 fountain" : "";
    entries.push({
      id: kit.id,
      kind: "kit",
      name: rawName,
      source: sourceOf(kit),
      width: kit.width,
      height: kit.height,
      nameText: norm(`${core} ${rawName} ${rawTags.join(" ")} ${slug} ${kitAliases}`),
      descText: norm(kit.ai?.description ?? ""),
      floorStanding: placement !== "wall",
      placement,
      coreName: norm(core),
      indoor: /^(?:jp-in-|mc-in-)/i.test(kit.id),
    });
  }
  for (const group of tileset.tileGroups ?? []) {
    if (!isObjectGroup(group)) continue;
    const rawName = group.name.trim();
    const core = extractCoreObjectName(rawName);
    const groupTags = "tags" in group && Array.isArray(group.tags) ? group.tags.filter((t): t is string => typeof t === "string" && !CATEGORY_TAG_RE.test(t)) : [];
    entries.push({
      id: group.id,
      kind: "group",
      name: rawName,
      source: "group",
      width: 1,
      height: 1,
      nameText: norm(`${core} ${groupTags.join(" ")}`),
      descText: norm(group.description ?? ""),
      floorStanding: true,
      placement: "floor",
      coreName: norm(core),
      indoor: false,
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

const TREE_QUERY_RE = /^(?:나무|가로수|활엽수|침엽수|벚나무|은행나무|느티나무|소나무|전나무|버드나무|올리브\s*나무|tree|street\s*tree)$/iu;
const WOODEN_NON_TREE_RE =
  /상자|의자|벤치|탁자|식탁|테이블|침대|책장|선반|카운터|문|울타리|펜스|널다리|다리|판자|수레|마차|통|관목|사이프러스|화분|걸이|걸개|계단|난간|기둥|보트|배|팻말|테두리|전봇대|장롱|발판|신발장|접수대|시렁|밭|이랑/u;
const TRUE_TREE_RE = /나무|가로수|활엽수|침엽수|벚나무|은행나무|느티나무|소나무|전나무|버드나무|올리브|tree|sakura|ginkgo|zelkova|pine|willow|fir|conifer/iu;

const BARREL_QUERY_RE = /^(?:통|나무통|술통|오크통|배럴|barrel|keg)$/iu;
const NON_BARREL_TONG_RE = /통\s*속|우체통|쓰레기통|물통|분유통|플라스틱\s*통|광석\s*통|사료통|연통|몸통|통나무|가스통/u;

const VEHICLE_QUERY_RE = /^(?:차|자동차|승용차|세단|차량|오토차|택시|경찰차|순찰차|트럭|버스|car|sedan|vehicle|taxi|truck|bus)$/iu;
const NON_VEHICLE_RE = /차\s*세트|차단봉|차양|차고|주차|정류장|표지판|자판기|개찰기|자동문|광차|수레|유모차|장난감/u;

function hasCompoundConflict(q: string, entry: StampObjectEntry): boolean {
  const core = entry.coreName ?? norm(extractCoreObjectName(entry.name));
  if (TREE_QUERY_RE.test(q)) {
    if (WOODEN_NON_TREE_RE.test(core)) return true;
    if (!TRUE_TREE_RE.test(`${core} ${entry.id}`)) return true;
  }
  if (BARREL_QUERY_RE.test(q) && NON_BARREL_TONG_RE.test(core)) return true;
  if (VEHICLE_QUERY_RE.test(q) && NON_VEHICLE_RE.test(core)) return true;
  if ((q === "다리" || q === "돌다리" || q === "bridge") && /말뚝|울타리|식탁|탁자|의자|사다리/u.test(core)) return true;
  if ((q === "계단" || q === "올라가는 계단" || q === "내려가는 계단") && /말뚝|사다리/u.test(core)) return true;
  if (/내려가는|아래로/u.test(q) && /올라가는|위로/u.test(entry.name)) return true;
  if (/올라가는|위로/u.test(q) && /내려가는|아래로/u.test(entry.name)) return true;
  if ((q === "기둥" || q === "돌기둥" || q === "석주") && /이정표|가로등|등불|전주|전봇대|신호|정문|문|통|우물/u.test(core)) return true;
  return false;
}

/** 이름 수준 일치 점수: 4 = 핵심 이름 전체 일치, 3 = 핵심 이름 낱말 일치, 2 = 시작/포함/태그 일치, 0 = 불일치. */
function nameScore(query: string, entry: StampObjectEntry): number {
  const q = norm(query);
  if (!q) return 0;
  if (hasCompoundConflict(q, entry)) return 0;
  const core = entry.coreName ?? norm(extractCoreObjectName(entry.name));
  if (core === q) return 4;
  const coreWords = core.split(" ").filter(Boolean);
  if (coreWords.includes(q)) return 3;
  const words = entry.nameText.split(" ").filter(Boolean);
  if (words.includes(q)) return 3;
  // 한 글자 낱말(통·문)은 낱말이 정확히 같을 때만 — 「통로」「소통」에 걸리지 않게.
  if ([...q].length < 2) return 0;
  if (core.startsWith(q) || coreWords.some((word) => word.startsWith(q))) return 3;
  if (words.some((word) => word.startsWith(q))) return 2;
  // 영어 동의어는 낱말 앞부분만(「door」가 「trapdoor」·「outdoor」에 걸려 뚜껑문이 문으로 깔리던 것).
  if (/[a-z]/u.test(q)) return 0;
  if (core.includes(q)) return 3;
  if (entry.nameText.includes(q)) return 2;
  return 0;
}

/** 오타 한 칸(자모 편집거리 1) 일치. 두 글자 이상 낱말에서만. 철자 보정으로 표시한다. */
function fuzzyNameScore(query: string, entry: StampObjectEntry): number {
  const q = norm(query);
  if ([...q].length < 2) return 0;
  if (hasCompoundConflict(q, entry)) return 0;
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
  ["화분", "꽃 화분", "둥근 돌 화분", "네모 돌 화분", "화초", "planter", "pot", "flowerpot"],
  ["의자", "스툴", "걸상", "chair", "stool"],
  ["탁자", "테이블", "식탁", "책상", "table", "desk"],
  ["침대", "bed"],
  ["벤치", "나무 벤치", "소품 나무 벤치", "긴 의자", "bench"],
  ["책장", "서가", "책꽂이", "bookshelf", "bookcase"],
  ["통", "나무통", "술통", "오크통", "배럴", "barrel", "keg"],
  ["상자", "나무 상자", "궤", "박스", "크레이트", "crate", "box"],
  ["항아리", "단지", "독", "jar", "urn"],
  ["우물", "돌 우물", "우물가", "well"],
  ["분수", "분수대", "수반", "fountain"],
  ["연못", "pond"],
  ["가로등", "주오도리식 가로등", "공원 가로등", "정원 가로등", "등불", "랜턴", "가로 등", "street lamp", "lamp", "lantern", "lamppost"],
  ["횃불", "벽 횃불", "등불 기둥", "토치", "torch"],
  ["모닥불", "화톳불", "캠프파이어", "campfire", "bonfire"],
  ["화로", "돌 화로", "화덕", "불판", "brazier"],
  ["바위", "돌", "큰 바위", "암석", "boulder", "rock", "stone"],
  ["덤불", "관목", "수풀", "bush", "shrub"],
  ["꽃", "꽃밭", "화단", "꽃무더기", "flower", "flowerbed"],
  ["울타리", "나무 울타리", "밭 울타리 윗줄", "외곽 나무 울타리", "가로 울타리", "세로 울타리", "펜스", "담장", "산울타리", "fence", "hedge"],
  ["표지판", "푯말", "이정표", "안내판", "sign", "signpost"],
  ["간판", "입간판", "메뉴판", "signboard"],
  ["동상", "조각상", "석상", "statue"],
  ["우체통", "빨간 우체통", "mailbox", "postbox"],
  ["자판기", "음료 자판기", "자동판매기", "vending machine", "vending"],
  ["신호등", "신호기", "보행 신호기", "보행자 신호기", "traffic light", "signal"],
  ["횡단보도", "crosswalk"],
  ["자동차", "승용차", "세단", "차량", "오토차", "car", "sedan", "vehicle"],
  ["택시", "taxi"],
  ["경찰차", "순찰차", "police car", "police"],
  ["트럭", "화물차", "광고 트럭", "truck"],
  ["버스", "bus"],
  ["자전거", "자전거 무리", "bicycle", "bike"],
  ["카펫", "러그", "양탄자", "깔개", "carpet", "rug"],
  ["나무", "가로수", "활엽수", "침엽수", "벚나무", "은행나무", "느티나무", "소나무", "전나무", "tree", "street tree"],
  ["다리", "아치 다리", "강 위 아치 다리", "아치 돌다리", "돌다리", "능선 개울 돌다리", "나무 다리", "나무 널다리", "널다리", "바위 다리", "bridge", "footbridge"],
  ["계단", "돌 계단", "나선 계단", "stair", "stairs"],
  ["올라가는 계단", "벽 앞면에서 올라가는 계단", "계단"],
  ["내려가는 계단", "바닥에서 아래로 내려가는 계단 한 칸", "계단"],
  ["기둥", "돌기둥", "카타콤 기둥", "신전 기둥", "사각 기둥", "원주", "석주", "바위 기둥", "pillar", "column"],
  ["제단", "돌 제단", "교단 제단", "흑요석 제단", "altar"],
  ["해골", "해골 무더기", "뼈", "뼈 더미", "skull", "skulls", "bones"],
  ["아치", "벽 아치", "벽 아치 문", "아치 문", "철창 아치", "던전 문", "arch", "archway"],
  ["밭", "경작지", "밀밭", "배추밭", "토마토밭", "모둠 밭", "farm plot"],
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

function pickVariants(hits: readonly { entry: StampObjectEntry; score: number }[], primaryQuery = ""): StampObjectEntry[] {
  const best = Math.max(...hits.map((hit) => hit.score));
  const wantColdOrDesert = /설원|눈|사막|오아시스|바다|화산/u.test(primaryQuery);
  const treeRank = (e: StampObjectEntry): number => {
    if (!e.id.startsWith("bd-tree-")) return 0;
    if (e.width >= 3 && e.height >= 3) return 0;
    if (e.width >= 2) return 1;
    return 2;
  };
  const vehicleOrientationRank = (e: StampObjectEntry): number => {
    if (!e.id.startsWith("mc-veh-")) return 0;
    return e.width > e.height ? 0 : 1;
  };
  const bridgeRank = (e: StampObjectEntry): number => {
    if (e.id === "bd-bridge-arch") return 1;
    return 0;
  };
  const streetPropRank = (e: StampObjectEntry): number => {
    if (/가로등/u.test(primaryQuery) && e.id === "jp-prop-stone-lantern") return 1;
    if (/신호등|신호기|보행/u.test(primaryQuery) && e.id.startsWith("jp-") && e.id !== "jp-tram-ped-signal") return 1;
    if (/화분/u.test(primaryQuery) && e.id === "bd-prop-flowerbed") return 1;
    if (/벤치/u.test(primaryQuery) && e.id === "bd-pick-mining-valley-bench") return 1;
    return 0;
  };
  const biomeRank = (e: StampObjectEntry): number => {
    if (wantColdOrDesert) return 0;
    return /snowfield|desert-oasis|sea-cave|volcano-cave/i.test(e.id) ? 1 : 0;
  };
  return hits
    .filter((hit) => hit.score === best)
    .map((hit) => hit.entry)
    .sort((a, b) =>
      Number(Boolean(a.indoor)) - Number(Boolean(b.indoor))
      || biomeRank(a) - biomeRank(b)
      || streetPropRank(a) - streetPropRank(b)
      || bridgeRank(a) - bridgeRank(b)
      || treeRank(a) - treeRank(b)
      || vehicleOrientationRank(a) - vehicleOrientationRank(b)
      || SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
      || (a.coreName?.length ?? a.name.length) - (b.coreName?.length ?? b.name.length)
      || a.width * a.height - b.width * b.height
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * 이름으로 물건을 찾는다. `names[0]` 이 사용자 말(철자 오타 보정은 이 이름에만), 나머지는 같은 묶음의 동의어다.
 * 바닥·도로·물 위·던전 벽 부착물(횃불·아치)을 찾고, 이름 수준에서 맞는 것이 없으면 null.
 */
export function resolveStampObject(
  index: readonly StampObjectEntry[],
  names: readonly string[],
  maxSize?: { readonly w: number; readonly h: number },
): StampObjectHit | null {
  const allFloor = index.filter((entry) => entry.floorStanding || entry.placement === "wall");
  const sized = maxSize ? allFloor.filter((entry) => entry.width <= maxSize.w && entry.height <= maxSize.h) : allFloor;
  const floor = sized.length > 0 ? sized : allFloor;
  const primary = names[0] ?? "";
  const pooled: { entry: StampObjectEntry; score: number; matchedBy: string }[] = [];
  for (const entry of floor) {
    let bestScore = 0;
    let bestName = primary;
    for (const name of names) {
      const s = nameScore(name, entry);
      if (s > bestScore) {
        bestScore = s;
        bestName = name;
      }
    }
    if (bestScore > 0) pooled.push({ entry, score: bestScore, matchedBy: bestName });
  }
  if (pooled.length > 0) {
    const variants = pickVariants(pooled, primary);
    const winner = variants[0]!;
    const matchedBy = pooled.find((p) => p.entry.id === winner.id)?.matchedBy ?? primary;
    return { entry: winner, matchedBy, corrected: false, variants };
  }
  if (primary) {
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
  return maxSize && sized.length > 0 && sized.length < allFloor.length ? resolveStampObject(index, names) : null;
}

/** 못 찾았을 때 보여 줄 가까운 물건 이름(중복 이름 제거) — 이름 일치 → 설명 일치 → 자모 거리 순. */
export function nearestStampObjects(index: readonly StampObjectEntry[], names: readonly string[], limit = 5): string[] {
  const floor = index.filter((entry) => entry.floorStanding || entry.placement === "wall");
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
  const floor = index.filter((entry) => entry.floorStanding || entry.placement === "wall");
  // 출처별로 번갈아 뽑아 한 출처에 쏠리지 않게.
  const bySource = (source: StampObjectSource): StampObjectEntry[] => floor.filter((entry) => entry.source === source);
  const lanes = (["pack", "hand", "authored", "group"] as const).map(bySource).filter((lane) => lane.length > 0);
  let round = 0;
  while (out.length < limit && lanes.some((lane) => round < lane.length)) {
    for (const lane of lanes) {
      const entry = lane[round];
      if (!entry) continue;
      const label = baseName(entry.name);
      const core = extractCoreObjectName(entry.name);
      const key = norm(core).split(" ")[0] ?? label;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
      if (out.length >= limit) break;
    }
    round += 1;
  }
  return out;
}
