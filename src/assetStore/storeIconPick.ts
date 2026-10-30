// 스토어 아이콘 팩(kind "icon", 32×32 PNG 한 장씩)에서 아이템·장비·스킬·상태에 맞는 아이콘 고르기.
// 아이콘마다 meta.oprnIcon 에 고르기용 설명이 있다(판 1). 팩을 넣으면 meta 가 그대로 프로젝트에 들어온다(applyPackToProject).
//
// 계약(판 1, 2026-10-31 아이콘 팩 제작과 맞춤):
//   { version:1, category: weapon|armor|consumable|material|key|skill|state|treasure|modern|eastern,
//     itemType?: ItemType 또는 장비 칸(weapon·shield·head·body·accessory) 또는 skill·state, element?: fire|ice|thunder|water|wind|earth|light|dark|poison|arcane,
//     nameEn, nameKo, tags: string[](≤24, 영어·한국어 낱말) }
// 조수가 아이템을 만들 때 이름·종류·속성으로 순위를 매기고(rankStoreIcons), 프로젝트에 이미 들어온 아이콘을 먼저 쓴다.
import type { Project, UploadedAsset } from "@/project/types";

export const STORE_ICON_CATEGORIES = ["weapon", "armor", "consumable", "material", "key", "skill", "state", "treasure", "modern", "eastern"] as const;
export type StoreIconCategory = (typeof STORE_ICON_CATEGORIES)[number];

export interface StoreIconMeta {
  readonly category: StoreIconCategory | null;
  readonly itemType: string;
  readonly element: string;
  readonly nameEn: string;
  readonly nameKo: string;
  readonly tags: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** meta.oprnIcon 을 읽는다. 이름이 하나도 없으면 null(고르기에 쓸 수 없다). */
export function readStoreIconMeta(meta: unknown): StoreIconMeta | null {
  const raw = isRecord(meta) ? meta.oprnIcon : undefined;
  if (!isRecord(raw)) return null;
  const nameEn = text(raw.nameEn, 60);
  const nameKo = text(raw.nameKo, 40);
  if (!nameEn && !nameKo) return null;
  const category = (STORE_ICON_CATEGORIES as readonly unknown[]).includes(raw.category) ? raw.category as StoreIconCategory : null;
  const tags = Array.isArray(raw.tags) ? [...new Set(raw.tags.slice(0, 24).map((tag) => text(tag, 24).toLowerCase()).filter(Boolean))] : [];
  return { category, itemType: text(raw.itemType, 24), element: text(raw.element, 16).toLowerCase(), nameEn, nameKo, tags };
}

/** 고르기 요청: 레코드 이름·설명, 무엇의 아이콘인가(item·equipment·skill·state), 아이템 종류·장비 칸, 속성. */
export interface StoreIconWant {
  readonly name: string;
  readonly description?: string;
  readonly target: "item" | "equipment" | "skill" | "state";
  /** ItemRecord.type 또는 EquipmentRecord.slot. */
  readonly itemType?: string;
  /** 속성 id·이름(fire, 불 …). */
  readonly element?: string;
}

export interface IconCandidate {
  readonly id: string;
  readonly meta: StoreIconMeta;
}

// 속성 낱말. 한 글자 낱말(불·빙·뇌·물·독·빛·땅·돌)은 낱말 전체이거나 낱말 첫 글자일 때만 맞는다 — 「열쇠」의 열, 「돌아가는」의 돌,
// 「속성」의 성을 속성으로 잘못 읽지 않게(2026-10-31 실측: 낡은 열쇠 → 석탄, 귀환 주문서 → 대지의 결정).
const ELEMENT_WORDS: readonly (readonly [string, readonly string[], readonly string[]])[] = [
  ["fire", ["화염", "화상", "용암", "불꽃", "fire", "flame", "burn", "blaze", "inferno"], ["불"]],
  ["ice", ["얼음", "빙결", "빙하", "서리", "냉기", "눈보라", "ice", "frost", "freeze", "blizzard", "snow"], ["빙"]],
  ["thunder", ["번개", "낙뢰", "뇌전", "전기", "thunder", "lightning", "spark", "shock", "electric"], ["뇌"]],
  ["water", ["파도", "물대포", "해일", "water", "aqua", "wave", "tide"], ["물"]],
  ["wind", ["바람", "질풍", "돌풍", "회오리", "wind", "gust", "tornado"], []],
  ["earth", ["대지", "바위", "암석", "지진", "earth", "stone", "rock", "quake"], ["땅"]],
  ["light", ["신성", "성광", "성수", "홀리", "축복", "light", "holy", "bless", "sacred"], ["빛"]],
  ["dark", ["어둠", "암흑", "저주", "그림자", "dark", "shadow", "curse"], []],
  ["poison", ["맹독", "독침", "해독", "poison", "venom", "toxic"], ["독"]],
];

/** 이름·설명·속성 글에서 속성 id 를 짐작한다(낱말 단위). 속성 id 자체(fire …)도 맞는다. */
export function inferIconElement(...texts: readonly (string | undefined)[]): string {
  const words = texts.filter(Boolean).flatMap((value) => tokens(value!));
  for (const [id, long, short] of ELEMENT_WORDS) {
    if (words.some((word) => word === id || long.some((w) => word.startsWith(w)) || short.some((s) => word === s || (word.length === 2 && word[0] === s && PARTICLES.includes(word[1]!))))) return id;
  }
  return "";
}

/** 한 글자 속성 낱말 뒤에 붙어도 되는 조사(불의·물로·독을). 「물약」「불안」은 속성이 아니다. */
const PARTICLES = "의을를이가로에은는과와도";
const HANGUL = /^[\p{Script=Hangul}]+$/u;
/** 한국어 합성어 짝: 머리 낱말(호밀빵 ↔ 빵)이나 앞 두 글자(해독초 ↔ 해독제)가 같으면 부분으로 맞는다. */
function hangulPartial(word: string, tag: string): boolean {
  if (!HANGUL.test(word) || !HANGUL.test(tag)) return false;
  if (word.length > tag.length ? word.endsWith(tag) : tag.endsWith(word)) return true;
  return word.length >= 2 && tag.length >= 2 && word.slice(0, 2) === tag.slice(0, 2);
}

/** 무엇의 아이콘인가 → 맞는 분류. 장비는 weapon·armor·eastern·modern 모두 볼 수 있다. */
const TARGET_CATEGORIES: Readonly<Record<StoreIconWant["target"], readonly StoreIconCategory[]>> = {
  item: ["consumable", "material", "key", "treasure", "modern", "eastern"],
  equipment: ["weapon", "armor", "modern", "eastern"],
  skill: ["skill"],
  state: ["state"],
};

const ARMOR_SLOTS = new Set(["shield", "head", "body", "accessory"]);

const tokens = (value: string): string[] => value.toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);

/** 점수: 이름 낱말이 아이콘 이름·태그와 겹칠수록, 분류·종류·속성이 맞을수록 높다. 맞는 분류가 아니면 0. */
export function scoreStoreIcon(icon: StoreIconMeta, want: StoreIconWant): number {
  const allowed = TARGET_CATEGORIES[want.target];
  if (icon.category && !allowed.includes(icon.category)) return 0;
  // 상태·스킬 아이콘은 itemType 으로도 거른다 — 아이템 자리에 「독 상태」 배지가 들어가지 않게.
  if (want.target !== "skill" && icon.itemType === "skill") return 0;
  if (want.target !== "state" && icon.itemType === "state") return 0;
  if ((want.target === "skill" || want.target === "state") && icon.itemType && icon.itemType !== want.target) return 0;
  let score = 1;
  const haystack = new Set([...tokens(icon.nameEn), ...tokens(icon.nameKo), ...icon.tags.flatMap(tokens)]);
  const words = [...new Set([...tokens(want.name), ...tokens(want.description ?? "").slice(0, 24)])];
  for (const word of words) {
    if (haystack.has(word)) score += tokens(want.name).includes(word) ? 6 : 2;
    else if ([...haystack].some((tag) => (word.length >= 2 && tag.length >= 2 && (tag.includes(word) || word.includes(tag))) || hangulPartial(word, tag))) score += tokens(want.name).includes(word) ? 3 : 1;
  }
  const kind = want.itemType ?? "";
  if (kind && icon.itemType === kind) score += 4;
  else if (want.target === "equipment" && kind && ARMOR_SLOTS.has(kind) && icon.category === "armor") score += 2;
  else if (want.target === "equipment" && kind === "weapon" && icon.category === "weapon") score += 2;
  else if (want.target === "equipment" && kind && icon.itemType && icon.itemType !== kind && (icon.itemType === "weapon" || ARMOR_SLOTS.has(icon.itemType))) score -= 3;
  const element = (want.element ?? "").toLowerCase() || inferIconElement(want.name, want.description);
  // 마법 기술은 속성이 곧 모양이다(「암석 파쇄」 = 땅 마법 아이콘) — 기술은 속성만 맞아도 자신 있는 짝이 된다.
  if (element) score += icon.element === element ? (want.target === "skill" ? 5 : 3) : icon.element ? -1 : 0;
  return Math.max(0, score);
}

/** 점수 순 후보(점수 0 은 뺀다). 같으면 id 순. */
export function rankStoreIcons<T extends IconCandidate>(icons: readonly T[], want: StoreIconWant, limit = 5): (T & { readonly score: number })[] {
  return icons
    .map((icon) => ({ ...icon, score: scoreStoreIcon(icon.meta, want) }))
    .filter((icon) => icon.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** 프로젝트에 이미 들어온 스토어 아이콘(kind icon + meta.oprnIcon). */
export function projectStoreIcons(project: Project): IconCandidate[] {
  const out: IconCandidate[] = [];
  for (const [id, asset] of Object.entries(project.assets.uploaded) as [string, UploadedAsset][]) {
    if (asset.kind !== "icon") continue;
    const meta = readStoreIconMeta(asset.meta);
    if (meta) out.push({ id, meta });
  }
  return out;
}

/** 이 점수 이상이면 「이름이 맞았다」로 본다(분류만 맞은 1점·종류만 맞은 5점은 아니다). 자동 배정은 이 위만 쓴다. */
export const STORE_ICON_CONFIDENT_SCORE = 6;

export interface IconAssignment {
  readonly collection: "items" | "equipment" | "skills" | "states";
  readonly id: string;
  readonly name: string;
  readonly iconResourceId: string;
  readonly score: number;
}

export interface IconWantRow {
  readonly collection: IconAssignment["collection"];
  readonly id: string;
  readonly name: string;
  readonly want: StoreIconWant;
}

/** 아이콘을 붙일 레코드와 그 고르기 요청. overwrite 가 아니면 이미 아이콘이 있는 레코드는 뺀다. */
export function iconWantRows(project: Project, options: { readonly collections?: readonly IconAssignment["collection"][]; readonly overwrite?: boolean; readonly ids?: readonly string[] } = {}): IconWantRow[] {
  const collections = options.collections?.length ? options.collections : (["items", "equipment", "skills", "states"] as const);
  const only = options.ids?.length ? new Set(options.ids) : null;
  const db = project.database;
  const elementName = (id: string | undefined): string => (id ? db.elements?.find((element) => element.id === id)?.name ?? id : "");
  const rows: (IconWantRow & { readonly has: boolean })[] = [];
  if (collections.includes("items")) for (const r of db.items) rows.push({ collection: "items", id: r.id, name: r.name, has: Boolean(r.iconResourceId), want: { target: "item", name: r.name, description: r.description, itemType: r.type } });
  if (collections.includes("equipment")) for (const r of db.equipment) rows.push({ collection: "equipment", id: r.id, name: r.name, has: Boolean(r.iconResourceId), want: { target: "equipment", name: r.name, description: r.description, itemType: r.slot, element: elementName(r.attackElementIds[0]) } });
  if (collections.includes("skills")) for (const r of db.skills) rows.push({ collection: "skills", id: r.id, name: r.name, has: Boolean(r.iconResourceId), want: { target: "skill", name: r.name, description: r.description, element: elementName(r.elementId) } });
  if (collections.includes("states")) for (const r of db.states) rows.push({ collection: "states", id: r.id, name: r.name, has: Boolean(r.iconResourceId), want: stateIconWant(r) });
  return rows.filter((row) => (!only || only.has(row.id)) && (!row.has || options.overwrite)).map(({ has: _has, ...row }) => row);
}

/** 상태 고르기 요청 — id 의 낱말(state_poison → poison)도 이름으로 쓴다(한국어 이름만 있는 상태도 영어 태그와 맞게). */
export function stateIconWant(state: { readonly id: string; readonly name: string }): StoreIconWant {
  return { target: "state", name: `${state.name} ${state.id.replace(/^state_/u, "").replace(/_/gu, " ")}` };
}

/**
 * 프로젝트에 있는 스토어 아이콘으로 레코드에 아이콘을 붙일 계획.
 * 자신 없는(STORE_ICON_CONFIDENT_SCORE 아래) 짝은 붙이지 않고 skipped 로 돌려준다.
 */
export function planIconAssignments(project: Project, options: Parameters<typeof iconWantRows>[1] = {}, icons: readonly IconCandidate[] = projectStoreIcons(project)):
  { readonly assign: IconAssignment[]; readonly skipped: { collection: IconAssignment["collection"]; id: string; name: string; best?: string }[] } {
  const assign: IconAssignment[] = []; const skipped: { collection: IconAssignment["collection"]; id: string; name: string; best?: string }[] = [];
  for (const row of iconWantRows(project, options)) {
    const [best] = rankStoreIcons(icons, row.want, 1);
    if (best && best.score >= STORE_ICON_CONFIDENT_SCORE) assign.push({ collection: row.collection, id: row.id, name: row.name, iconResourceId: best.id, score: best.score });
    else skipped.push({ collection: row.collection, id: row.id, name: row.name, ...(best ? { best: best.id } : {}) });
  }
  return { assign, skipped };
}
