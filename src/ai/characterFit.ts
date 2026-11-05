// src/ai/characterFit.ts
/**
 * 이름 붙은 인물의 걷기 칩이 그 역할에 맞는가 — 기계 판정(2026-11-05 오너: 「AI 조수는 왜 있는 거로만 쓸라고 하는 걸까?」).
 * 모델은 list_npc_graphics 가 무엇이든 돌려주면 그것을 「맞는 것」으로 쳤다: 「무기점 주인」 → 여관 주인·흰 앞치마, 「방어구점 주인」 → 0건이라
 * 가장 가까운 상인. 역할 낱말(무기점·꽃집·음유시인·어부·은퇴한 기사…)이 요구하는 생김새 낱말이 칩 설명(라벨·꼬리표·외형 글)에 하나도 없으면
 * 맞지 않는다. 역할 낱말이 없는 이름(「미라」, 「주민 1」)은 판정하지 않는다(맞는 것으로 친다) — 막연한 사람은 번들 칩으로 둔다.
 * 업로드·생성 칩(카탈로그에 없는 칩)은 판정하지 않는다.
 */
import { CHARSET_SEMANTICS, type CharsetSemanticEntry } from "@/assets/charsetSemantics";
import { sharedCharacterSemantics } from "@/project/sharedCharacters";

interface RoleRule {
  readonly role: RegExp;
  readonly label: string;
  readonly looks: readonly string[];
  readonly brief: string;
}

// 순서가 뜻이 있다: 더 구체적인 가게(무기점·방어구점)가 일반 「상인」보다 먼저다.
const ROLE_RULES: readonly RoleRule[] = [
  { role: /무기 ?(점|상|가게|상점)|무기상|weapon ?(shop|smith|seller|merchant)/iu, label: "무기점", looks: ["무기", "검", "칼", "도끼", "창", "대장장이", "weapon", "sword", "axe"], brief: "weapon-shop owner with a sword on the back or belt, sturdy leather apron, rolled-up sleeves" },
  { role: /대장장이|대장간|blacksmith|smith\b/iu, label: "대장장이", looks: ["대장장이", "망치", "모루", "가죽 앞치마", "blacksmith", "hammer"], brief: "blacksmith with a heavy hammer, soot-stained leather apron, bare muscular arms" },
  { role: /방어구|갑옷 ?(점|가게|상)|armou?r ?(shop|smith|seller)/iu, label: "방어구점", looks: ["갑옷", "방패", "투구", "armor", "armour", "shield"], brief: "armor-shop owner wearing a breastplate, a round shield on the back" },
  { role: /도구 ?(점|가게|상점)|잡화|만물|item ?shop|general ?store|tool ?shop/iu, label: "도구점", looks: ["잡화", "행상", "가방", "배낭", "상인", "앞치마", "merchant", "peddler", "bag"], brief: "general-goods shopkeeper with a big satchel and a green apron, pouches on the belt" },
  { role: /약 ?(초|방|국|사|점|상)|약초|포션|물약|herb|apothecar|potion|alchemist|연금술/iu, label: "약초상", looks: ["약초", "약사", "드루이드", "연금술", "포션", "herb", "druid", "alchemist"], brief: "herbalist in a green robe with dried herbs hanging from the belt and a potion bottle" },
  { role: /꽃 ?(집|가게|장수|파는)|플로리스트|florist|flower ?(girl|shop|seller)/iu, label: "꽃집", looks: ["꽃", "flower"], brief: "flower seller holding a basket of colorful flowers, flower in the hair, light dress and apron" },
  { role: /음유 ?시인|악사|가수|bard|minstrel|musician|troubadour/iu, label: "음유시인", looks: ["음유시인", "악사", "류트", "하프", "bard", "minstrel", "lute"], brief: "wandering bard with a feathered hat, a lute on the back, colorful traveling tunic" },
  { role: /어부|낚시|뱃사람|선원|fisher|sailor/iu, label: "어부", looks: ["어부", "낚시", "선원", "뱃사람", "fisher", "sailor"], brief: "fisherman in a straw hat and rolled trousers holding a fishing rod" },
  { role: /기사|knight|paladin/iu, label: "기사", looks: ["기사", "갑옷", "knight", "armor"], brief: "knight in plate armor with a sword at the hip and a cape" },
  { role: /수상한|정체 ?불명|밀수|암상인|도둑|shady|suspicious|smuggler|thief|rogue/iu, label: "수상한 인물", looks: ["후드", "두건", "망토", "복면", "가면", "도적", "hood", "cloak", "mask", "thief"], brief: "shady figure in a dark hooded cloak with the face half hidden, pouches of goods" },
  { role: /여관|주점|술집|바텐더|inn ?keeper|innkeeper|tavern|bartender/iu, label: "여관 주인", looks: ["여관", "주점", "앞치마", "요리사", "innkeeper", "apron"], brief: "innkeeper with a white apron and a towel over the shoulder" },
  { role: /사제|신부|수녀|성직자|priest|cleric|nun/iu, label: "사제", looks: ["사제", "신부", "수녀", "성직자", "priest", "nun"], brief: "priest in white and gold robes with a holy symbol" },
  { role: /마법사|마녀|마도사|wizard|mage|witch/iu, label: "마법사", looks: ["마법사", "마녀", "로브", "wizard", "witch", "mage"], brief: "wizard in a long robe and pointed hat holding a staff" },
  { role: /경비|문지기|병사|위병|guard|soldier/iu, label: "경비병", looks: ["병사", "경비", "갑옷", "창", "guard", "soldier"], brief: "town guard in a helmet and chain mail holding a spear" },
  { role: /상인|장사꾼|행상|가게 ?주인|상점 ?주인|merchant|shopkeeper|peddler|vendor/iu, label: "상인", looks: ["상인", "행상", "장사", "점원", "가게", "merchant", "peddler", "shop"], brief: "merchant with a coin purse and a vest, friendly shopkeeper look" },
];

const ELDER = /할아버지|할머니|노인|노파|영감|은퇴|늙은|백발|old man|old woman|elder|retired|grandpa|grandma/iu;
const CHILD = /소녀|소년|아이|꼬마|girl|boy|kid|child/iu;
const FEMALE = /소녀|할머니|노파|아주머니|아줌마|여자|여성|아가씨|부인|마녀|수녀|girl|woman|lady|witch|nun/iu;
const MALE = /소년|할아버지|영감|아저씨|남자|남성|신부|boy|old man|grandpa|\bman\b/iu;

export interface CharacterRole {
  readonly rule: RoleRule;
  readonly elder: boolean;
  readonly child: boolean;
  readonly gender?: "male" | "female";
}

/**
 * 역할은 이름(과 role 인자)에서만 읽는다 — 대사에서 읽으면 「여관에 가 봐」 하는 미라가 여관 주인이 된다.
 * 나이·성별은 이름에 없을 때만 대사까지 본다. 역할 낱말이 없으면 undefined(판정하지 않는다).
 */
export function characterRoleOf(text: string, name = text): CharacterRole | undefined {
  const rule = ROLE_RULES.find((entry) => entry.role.test(name));
  if (!rule) return undefined;
  const look = (re: RegExp) => re.test(name) || re.test(text);
  const gender = FEMALE.test(name) ? "female" : MALE.test(name) ? "male" : FEMALE.test(text) ? "female" : MALE.test(text) ? "male" : undefined;
  return { rule, elder: look(ELDER), child: look(CHILD), ...(gender ? { gender } : {}) };
}

function entryText(entry: CharsetSemanticEntry): string {
  return `${entry.label} ${entry.tags.join(" ")} ${entry.appearance ?? ""}`.toLowerCase();
}

export interface ChipFit {
  readonly fits: boolean;
  readonly why?: string;
  readonly role?: CharacterRole;
}

/** 칩 설명이 역할을 보여 주는가. 역할 낱말이 없는 이름이나 카탈로그 밖 칩은 맞는 것으로 친다. */
export function chipFitsRole(entry: CharsetSemanticEntry | undefined, text: string, name = text): ChipFit {
  const role = characterRoleOf(text, name);
  if (!role || !entry) return { fits: true };
  const look = entryText(entry);
  if (!role.rule.looks.some((word) => look.includes(word.toLowerCase()))) {
    return { fits: false, role, why: `「${entry.label}」 칩에 ${role.rule.label} 다운 것(${role.rule.looks.slice(0, 3).join("·")})이 없다` };
  }
  if (role.elder && entry.age && entry.age !== "elder") return { fits: false, role, why: `「${entry.label}」 칩은 노인이 아니다` };
  if (role.child && entry.age && entry.age !== "child" && entry.age !== "youth") return { fits: false, role, why: `「${entry.label}」 칩은 아이가 아니다` };
  if (role.gender && entry.gender && entry.gender !== "none" && entry.gender !== role.gender) return { fits: false, role, why: `「${entry.label}」 칩은 ${role.gender === "female" ? "여성" : "남성"}이 아니다` };
  return { fits: true, role };
}

export function charsetEntryOf(textureKey: string | undefined, characterIndex: number): CharsetSemanticEntry | undefined {
  if (!textureKey) return undefined;
  const key = textureKey.startsWith("tex_") ? textureKey : `tex_${textureKey}`;
  return [...CHARSET_SEMANTICS, ...sharedCharacterSemantics()].find((entry) => entry.textureKey === key && entry.characterIndex === characterIndex);
}

/** 걷기 칩 생성(char-gen 「글로」)에 줄 영어 설명 — 역할 생김새 + 나이·성별. */
export function setCharacterRole(project: { meta: { oprnCharacterRoles?: Record<string, string> } }, mapId: string, eventId: string, role: string): void {
  (project.meta.oprnCharacterRoles ??= {})[`${mapId}/${eventId}`] = role.trim().slice(0, 80);
}

export function characterRoleText(project: { readonly meta: { readonly oprnCharacterRoles?: Readonly<Record<string, string>> } }, mapId: string, eventId: string): string {
  return project.meta.oprnCharacterRoles?.[`${mapId}/${eventId}`] ?? "";
}

export function eventRoleText(event: { readonly name?: string; readonly pages?: readonly { readonly commands?: readonly unknown[] }[] }): string {
  const lines = (event.pages ?? []).flatMap((page) => (page.commands ?? []).flatMap((command) => {
    const c = command as { kind?: string; body?: unknown; text?: unknown; speaker?: unknown };
    return c.kind === "text" ? [String(c.speaker ?? ""), String(c.body ?? c.text ?? "")] : [];
  }));
  return [event.name ?? "", ...lines].join(" ").slice(0, 600);
}

export function characterBrief(name: string, role: CharacterRole): string {
  const who = role.child ? (role.gender === "female" ? "young girl" : role.gender === "male" ? "young boy" : "child")
    : role.elder ? (role.gender === "female" ? "elderly woman with grey hair" : "elderly man with a white beard")
    : role.gender === "female" ? "middle-aged woman" : role.gender === "male" ? "middle-aged man" : "middle-aged adult (not a child or teenager)";
  return `${who}, ${role.rule.brief}. Name: ${name}.`.slice(0, 600);
}
