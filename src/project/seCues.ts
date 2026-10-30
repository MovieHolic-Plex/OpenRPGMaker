// 효과음 자리(cue) 표 — 프로젝트에 저장되는 시스템 효과음(`project.system.seCues`).
//
// 왜 표인가(2026-10-30): 시스템 효과음 13개(SYSTEM_SE_CUES)는 세션 안에서만 바뀌었고(「시스템 효과음 바꾸기」 이벤트),
// 기본값은 battleJuice·runtimeJuice 에 EasyRPG id 로 박혀 있었다. 스토어 효과음 팩(kind "sound", meta.oprnSound.slots)이
// 자리 id 로 소리를 싣기 시작하면서 자리마다 프로젝트에 소리를 걸 곳이 필요해졌다.
//
// 데이터 계약:
// - 키는 자리 id(소문자 camelCase 또는 kebab 접두 가족: footstep-grass·magic-fire·attack-blunt). 모르는 id 도 저장한다 —
//   새 자리 id 가 생겨도 코드를 고치지 않고 표에 실린다(런타임이 그 자리를 부르는 곳이 생기면 그때 울린다).
// - 값은 리소스 id. 빈 문자열은 저장하지 않는다(= 기본 소리).
// - 우선순위: 세션 덮어쓰기(m2 「시스템 효과음 바꾸기」) → 이 표 → 옛 저작 칸(메뉴 소리·타이틀 소리·패배/도주 SE) → 내장 기본.
// - 가족 물러섬: magic-fire 가 비면 cast, footstep-snow 가 비면 footstep(지형 발소리) → 없음. seCueFallbacks 가 순서를 정한다.

export type SeCueGroup = "ui" | "battle" | "magic" | "field";

export interface SeCueSpec {
  readonly id: string;
  readonly group: SeCueGroup;
  readonly label: string;
}

/** 자리 id 꼴: 소문자로 시작, 영문·숫자, kebab 가족 하나까지(footstep-grass). */
export const SE_CUE_ID_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}(?:-[a-z][a-zA-Z0-9]{0,31})?$/u;

export function isSeCueId(value: unknown): value is string {
  return typeof value === "string" && SE_CUE_ID_PATTERN.test(value);
}

const ui = (id: string, label: string): SeCueSpec => ({ id, group: "ui", label });
const battle = (id: string, label: string): SeCueSpec => ({ id, group: "battle", label });
const magic = (id: string, label: string): SeCueSpec => ({ id, group: "magic", label });
const field = (id: string, label: string): SeCueSpec => ({ id, group: "field", label });

/**
 * 알려진 자리. 순서 = 편집기 표와 조수 결과의 순서. 스토어 효과음 제작자와 맞춘 목록(2026-10-30, oprnSound v1)이다 — id 를 바꾸지 말 것.
 * damage = 적이 맞는 소리, actorDamage = 아군이 맞는 소리, faint = 적이 쓰러짐, bossCollapse = 보스가 쓰러짐.
 */
export const SE_CUE_SPECS: readonly SeCueSpec[] = [
  ui("cursor", "커서"), ui("confirm", "결정"), ui("cancel", "취소"), ui("buzzer", "불가"),
  ui("menuOpen", "메뉴 열기"), ui("equip", "장비"), ui("save", "저장"), ui("load", "불러오기"),
  ui("shop", "상점 거래"), ui("useItem", "아이템 사용"), ui("itemGet", "아이템 획득"), ui("levelUp", "레벨 업"),
  battle("battleStart", "전투 시작"), battle("attack", "공격(베기)"), battle("attack-blunt", "공격(타격)"),
  battle("attack-pierce", "공격(찌르기)"), battle("attack-claw", "공격(할퀴기)"), battle("damage", "적 피해"),
  battle("actorDamage", "아군 피해"), battle("critical", "급소"), battle("miss", "빗나감"), battle("heal", "회복"),
  battle("defend", "방어"), battle("faint", "적 쓰러짐"), battle("bossCollapse", "보스 쓰러짐"),
  battle("defeat", "패배"), battle("escape", "도주"), battle("cast", "주문 시전"),
  magic("magic-fire", "불 마법"), magic("magic-ice", "얼음 마법"), magic("magic-thunder", "번개 마법"),
  magic("magic-wind", "바람 마법"), magic("magic-earth", "땅 마법"), magic("magic-water", "물 마법"),
  magic("magic-holy", "빛 마법"), magic("magic-dark", "어둠 마법"), magic("buff", "강화"), magic("debuff", "약화"),
  magic("poison", "독"), magic("sleep", "잠"), magic("paralyze", "마비"), magic("reflect", "반사"),
  magic("absorb", "흡수"), magic("revive", "부활"),
  field("door", "문 열기"), field("doorClose", "문 닫기"), field("chest", "상자"), field("key", "열쇠"),
  field("stairs", "계단"), field("switch", "스위치"), field("water", "물"),
  field("footstep-grass", "발소리(풀)"), field("footstep-stone", "발소리(돌)"), field("footstep-wood", "발소리(나무)"),
  field("footstep-sand", "발소리(모래)"), field("footstep-snow", "발소리(눈)"), field("footstep-water", "발소리(물)"),
];

export const SE_CUE_IDS: readonly string[] = SE_CUE_SPECS.map((spec) => spec.id);
const KNOWN = new Set(SE_CUE_IDS);

export function isKnownSeCue(id: string): boolean {
  return KNOWN.has(id);
}

export function seCueSpec(id: string): SeCueSpec | undefined {
  return SE_CUE_SPECS.find((spec) => spec.id === id);
}

/** 가족 물러섬: 자기 → (kebab 가족이면) 가족의 기본 자리. magic-* → cast, attack-* → attack, footstep-* → 없음(지형 칸). */
const FAMILY_BASE: Readonly<Record<string, string | undefined>> = { magic: "cast", attack: "attack", footstep: undefined };

export function seCueFallbacks(id: string): readonly string[] {
  const dash = id.indexOf("-");
  if (dash < 0) return [id];
  const base = FAMILY_BASE[id.slice(0, dash)];
  return base && base !== id ? [id, base] : [id];
}

/** 저장 모양 정리: 꼴이 맞는 키와 빈칸 아닌 문자열 값만, 최대 128개. 아무것도 없으면 undefined(옛 JSON 바이트 유지). */
export function normalizeSeCues(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [key, raw] of Object.entries(value)) {
    if (count >= 128) break;
    if (!isSeCueId(key) || typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id || id.length > 200) continue;
    out[key] = id;
    count += 1;
  }
  return count ? out : undefined;
}

type SeCueSource = {
  readonly system: { readonly seCues?: Readonly<Record<string, string>> };
};

/** 프로젝트에 저장된 자리 소리(가족 물러섬 포함). 없으면 undefined. */
export function projectSeCue(project: SeCueSource | undefined, id: string): string | undefined {
  const table = project?.system.seCues;
  if (!table) return undefined;
  for (const key of seCueFallbacks(id)) {
    const hit = table[key]?.trim();
    if (hit) return hit;
  }
  return undefined;
}

/** 속성 id → 마법 자리. 기본 속성 id(fire·ice·thunder …)와 한국어 이름을 받는다. 모르면 undefined. */
const ELEMENT_CUE: Readonly<Record<string, string>> = {
  fire: "magic-fire", flame: "magic-fire", 불: "magic-fire", 화염: "magic-fire",
  ice: "magic-ice", frost: "magic-ice", 얼음: "magic-ice", 빙결: "magic-ice",
  thunder: "magic-thunder", lightning: "magic-thunder", electric: "magic-thunder", 번개: "magic-thunder", 뇌전: "magic-thunder",
  wind: "magic-wind", air: "magic-wind", 바람: "magic-wind", 질풍: "magic-wind",
  earth: "magic-earth", rock: "magic-earth", ground: "magic-earth", 땅: "magic-earth", 암석: "magic-earth",
  water: "magic-water", 물: "magic-water",
  holy: "magic-holy", light: "magic-holy", 빛: "magic-holy", 신성: "magic-holy",
  dark: "magic-dark", shadow: "magic-dark", 어둠: "magic-dark", 암흑: "magic-dark",
};

export function magicCueForElement(elementId: string | undefined, elementName?: string): string | undefined {
  for (const raw of [elementId, elementName]) {
    const key = raw?.trim().toLowerCase();
    if (key && ELEMENT_CUE[key]) return ELEMENT_CUE[key];
  }
  return undefined;
}

/** 지형 이름 → 발소리 자리(풀·돌·나무·모래·눈·물). 모르면 undefined — 그때는 지형 칸의 발소리만 쓴다. */
const SURFACE_WORDS: readonly (readonly [string, RegExp])[] = [
  ["footstep-water", /물|얕은|늪|water|swamp|shallow/iu],
  ["footstep-snow", /눈|얼음|설원|snow|ice/iu],
  ["footstep-sand", /모래|사막|해변|sand|desert|beach/iu],
  ["footstep-wood", /나무|마루|다리|목재|wood|plank|bridge/iu],
  ["footstep-stone", /돌|바위|자갈|포장|석|stone|rock|cobble|paved/iu],
  ["footstep-grass", /풀|잔디|숲|초원|흙|grass|forest|meadow|dirt/iu],
];

export function footstepCueForTerrain(name: string | undefined): string | undefined {
  const text = name?.trim();
  if (!text) return undefined;
  return SURFACE_WORDS.find(([, re]) => re.test(text))?.[0];
}
