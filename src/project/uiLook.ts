// project/uiLook.ts
// 게임 하나의 UI 모습 — 대사창 · ESC 메뉴 · 전투 창 · 타이틀 로고/메뉴 · HUD 글꼴/판을 «한 벌» 로 묶은 목록.
//
// 왜(오너 2026-11-13 «HUD 선택, 대사창 선택 이런 것들은 ???»): 스타일은 축마다 따로 있었고(대사창 18 · 메뉴 14 · 전투 창 12 · 로고 5)
// 조수의 끝맺음은 메뉴 하나만 낱말로 골랐다 — 대사창은 늘 유리, 전투 창은 늘 청색 도트 창. 게임마다 같은 얼굴이었고, 고른 메뉴도 대사창과 맞지 않았다.
// 여기서는 이미 있는 스타일만으로 서로 어울리는 조합을 적어 둔다(새 스타일 없음). 고르는 길은 둘:
//  - 모델이 청사진의 `look` 한 칸에 id 를 적는다(fit 한 줄을 읽고).
//  - 안 적으면 pickUiLook 이 게임의 사실(칩셋 계열의 시대 · 전투 방식 · 대사 중심인가)과 게임 열쇠로 고른다 — 요청 글의 낱말은 읽지 않는다.
// 무엇을 띄우고 얼마나 크게 띄우는가(HUD 칸·예산)는 project/fieldHud.ts 의 일이다. 여기는 «껍질» 만 정한다.
import type { BattleLookPresetId, BattleLookSettings, BattleLookWindow } from "./battleLook";
import type { DialogueStyleId } from "./dialogueStyles";
import type { HUD_FONTS, FieldHudConfig } from "./fieldHud";
import { tilesetFamily } from "./tilesetFamily";
import type { MenuUiStyle, Project, TitleLogoStyle, TitleMenuStyle } from "./types";

/** 칩셋 계열이 말하는 시대 — 낱말이 아니라 그 게임이 실제로 깐 타일셋에서 읽는다. */
export type UiLookEra = "fantasy" | "eastern" | "industrial" | "gothic" | "modern" | "future" | "primeval" | "monster";
/** 전투 방식 — none: 싸움 없음 · turn: 턴제 · action: 필드 실시간 · monster: 몬스터 수집(포켓몬식 전투 화면). */
export type UiLookCombat = "none" | "turn" | "action" | "monster";

export interface UiLookSet {
  readonly id: string;
  /** 사람용 이름(자료집·보고). */
  readonly label: string;
  /** 모델이 읽는 한 줄(영어) — 어떤 세계·시대·분위기에 맞는가. */
  readonly fit: string;
  readonly dialogue: DialogueStyleId;
  readonly menu: MenuUiStyle;
  readonly battle: BattleLookPresetId;
  /** 전투 창의 겉판만 바꾼다(battleLook.window) — 프리셋의 배치는 그대로 두고 창 색을 이 세트의 대사창·메뉴에 맞춘다. 생략 = 프리셋의 창. */
  readonly battleWindow?: BattleLookWindow;
  readonly title: { readonly logo: TitleLogoStyle; readonly menu: TitleMenuStyle };
  /** 윈도스킨 그림(「고전 · 윈도스킨」 대사창과 타이틀 창 메뉴가 쓴다). 생략 = 그대로. */
  readonly windowSkin?: "windowskin-default" | "windowskin-warm";
  /** 필드 HUD 껍질 — 글꼴과 판. 칸 구성·크기는 건드리지 않는다. */
  readonly hud: { readonly font: Exclude<keyof typeof HUD_FONTS, "auto">; readonly panel: "dark" | "paper" };
  /** 함수가 고를 때의 사실 조건. eras "any" = 시대를 가리지 않는다(talky 가 맞을 때만 후보). */
  readonly suits: { readonly eras: readonly UiLookEra[] | "any"; readonly combat?: readonly UiLookCombat[]; readonly talky?: boolean };
}

/** 편집기 기본 윈도스킨(project/databaseRecordModel.ts DEFAULT_RUNTIME_WINDOW_SKIN_ID 와 같은 값 — 순환 import 를 피하려 여기 둔다; 테스트가 같음을 본다). */
const DEFAULT_WINDOW_SKIN = "windowskin-warm";

const FIGHTS: readonly UiLookCombat[] = ["turn", "action"];
const CALM: readonly UiLookCombat[] = ["none", "turn"];

export const UI_LOOKS: readonly UiLookSet[] = [
  { id: "kingdom", label: "왕국 · 청색 창", fit: "blue-window fantasy JRPG",
    dialogue: "retro-blue", menu: "classic", battle: "pixel", title: { logo: "metal", menu: "window" }, windowSkin: "windowskin-default", hud: { font: "round", panel: "dark" },
    suits: { eras: ["fantasy"], combat: FIGHTS } },
  { id: "storybook", label: "동화책 · 나무와 종이", fit: "wood and parchment, fairy tale",
    dialogue: "wood", menu: "journal", battle: "parch", title: { logo: "gold", menu: "plain" }, windowSkin: "windowskin-warm", hud: { font: "pixel", panel: "paper" },
    suits: { eras: ["fantasy", "primeval"], combat: CALM } },
  { id: "gilded", label: "금장 흑판", fit: "black and gold, epic or tragedy",
    dialogue: "gold", menu: "party-first-warm", battle: "gold", title: { logo: "gold", menu: "plain" }, hud: { font: "round", panel: "dark" },
    suits: { eras: ["fantasy", "industrial", "gothic"], combat: FIGHTS } },
  { id: "rm2003", label: "청록 입체 창", fit: "teal bevelled windows, machines",
    dialogue: "classic", menu: "retro-2003", battle: "teal", title: { logo: "metal", menu: "window" }, windowSkin: "windowskin-default", hud: { font: "round", panel: "dark" },
    suits: { eras: ["fantasy", "industrial"] } },
  { id: "hanji", label: "한지와 먹", fit: "paper and ink, East Asian period",
    dialogue: "joseon", menu: "journal", battle: "ink", battleWindow: "parch", title: { logo: "stone", menu: "plain" }, hud: { font: "round", panel: "paper" },
    suits: { eras: ["eastern"] } },
  { id: "ink-night", label: "먹빛 밤", fit: "dark ink, thin gold, wuxia",
    dialogue: "float", menu: "party-first-warm", battle: "ink", title: { logo: "stone", menu: "plain" }, hud: { font: "round", panel: "dark" },
    suits: { eras: ["eastern", "gothic"], combat: FIGHTS } },
  { id: "handheld", label: "휴대기 흰 창", fit: "white handheld, monster collecting",
    dialogue: "handheld", menu: "field-list", battle: "teal", battleWindow: "parch", title: { logo: "plain", menu: "window" }, windowSkin: "windowskin-default", hud: { font: "pixel", panel: "paper" },
    suits: { eras: ["monster", "fantasy", "modern"] } },
  { id: "terminal", label: "단말기 · 녹색", fit: "green terminal, sci-fi",
    dialogue: "terminal", menu: "workbench", battle: "veil", title: { logo: "glow", menu: "plain" }, hud: { font: "clean", panel: "dark" },
    suits: { eras: ["future"] } },
  { id: "haunted", label: "폐허 · 떠 있는 글", fit: "floating serif text, gothic horror",
    dialogue: "float", menu: "sheet", battle: "cinema", title: { logo: "stone", menu: "plain" }, hud: { font: "round", panel: "dark" },
    suits: { eras: ["gothic", "industrial"] } },
  { id: "soft", label: "흰 카드 · 둥근", fit: "soft white cards, school or romance",
    dialogue: "white-card", menu: "field-list", battle: "soft", battleWindow: "parch", title: { logo: "plain", menu: "plain" }, hud: { font: "clean", panel: "paper" },
    suits: { eras: ["modern", "fantasy"], combat: CALM, talky: true } },
  { id: "cozy", label: "말랑 크림", fit: "cream and round, cute or healing",
    dialogue: "cream", menu: "journal", battle: "icons", battleWindow: "parch", title: { logo: "plain", menu: "plain" }, hud: { font: "pixel", panel: "paper" },
    suits: { eras: ["modern", "fantasy", "primeval", "monster"], combat: CALM } },
  { id: "cinematic", label: "영화창", fit: "letterboxed film look, story-first",
    dialogue: "pixel-cinematic", menu: "sheet", battle: "cinema", title: { logo: "plain", menu: "plain" }, hud: { font: "clean", panel: "dark" },
    suits: { eras: "any", talky: true } },
  { id: "glass", label: "유리 · 무난", fit: "neutral glass, minimal sci-fi",
    dialogue: "glass", menu: "workbench", battle: "veil", title: { logo: "plain", menu: "plain" }, hud: { font: "clean", panel: "dark" },
    suits: { eras: ["future", "modern"] } },
];

export const UI_LOOK_IDS: readonly string[] = UI_LOOKS.map((look) => look.id);
/** 어느 조건에도 맞는 것이 없을 때(시대를 모르는 업로드 칩셋의 게임) — 지금까지의 기본 모습. */
export const FALLBACK_UI_LOOK_ID = "glass";

export function uiLookById(id: unknown): UiLookSet | undefined {
  return typeof id === "string" ? UI_LOOKS.find((look) => look.id === id.trim()) : undefined;
}

/** 도구 답에 싣는 한 줄을 이 수까지만 — 모델은 세계를 안 뒤에야 고를 수 있고, 그 세계의 후보는 두셋이다. */
export const UI_LOOK_HINT_LIMIT = 3;

/**
 * write_blueprint 의 답에 싣는 한 줄(영어) — 이 게임의 세계에 맞는 세트 두셋(`id = fit`). 모델에게 가는 목록은 이것뿐이다:
 * 지시문 카드에는 싣지 않는다(카드를 읽을 때 모델은 세계를 모른다). 청사진이 아직 맵을 짓기 전이므로 시대는 세계의 칩셋(tilesetId)에서,
 * 전투 방식은 청사진 단계(battle 단계가 있으면 턴제)에서 읽는다. 후보가 셋을 넘으면 게임 열쇠로 돌려 셋만 싣는다.
 */
export function uiLookHint(project: LookProject, seed: string, worldTilesetId?: string): string {
  const facts = uiLookFacts(project);
  const steps = project.gameBlueprint?.steps ?? [];
  const era = (worldTilesetId ? UI_LOOK_ERA_BY_FAMILY[tilesetFamily(project, worldTilesetId)] : undefined) ?? facts.era;
  const combat: UiLookCombat = facts.combat === "none" && steps.some((step) => step.kind === "battle") ? "turn" : facts.combat;
  const pool = uiLookCandidates({ ...(era ? { era } : {}), combat, talky: combat === "none" || facts.talky });
  const start = lookHash(`ui-look|${seed}`) % pool.length;
  const shown = Array.from({ length: Math.min(UI_LOOK_HINT_LIMIT, pool.length) }, (_, i) => pool[(start + i) % pool.length]!);
  return ` UI look (set look to choose, else code picks): ${shown.map((look) => `${look.id} = ${look.fit}`).join(" · ")}.`;
}

/** 칩셋 계열 → 시대. 목록에 없는 계열(업로드 칩셋 등)은 시대를 모른다 — 시대를 가리지 않는 세트만 후보가 된다. */
export const UI_LOOK_ERA_BY_FAMILY: Readonly<Record<string, UiLookEra>> = {
  "oprn-atlas": "fantasy", "oprn-atlas-wave": "fantasy", "oprn-snow": "fantasy", "oprn-desert-east": "fantasy", "oprn-sky": "fantasy", "oprn-pirate": "fantasy", "oprn-wizard": "fantasy",
  "oprn-joseon": "eastern", "oprn-sengoku": "eastern",
  "oprn-steampunk": "industrial",
  "oprn-gothic": "gothic",
  "oprn-modern": "modern", "oprn-jp": "modern", "oprn-campus": "modern",
  "oprn-scifi": "future",
  "oprn-prehistoric": "primeval",
  "oprn-monster": "monster", "oprn-monster-emerald": "monster",
};

export interface UiLookFacts { readonly era?: UiLookEra; readonly combat: UiLookCombat; readonly talky: boolean }

type LookProject = Pick<Project, "maps" | "tilesets" | "system"> & Partial<Pick<Project, "startMapId" | "gameBlueprint">>;

/** 게임이 깐 맵들의 칩셋 계열 가운데 시대를 말하는 것 — 맵 수가 가장 많은 시대(같으면 시작 맵의 시대). 세계 지도·실내 공용 칩셋만 있으면 그 계열 그대로. */
export function uiLookEra(project: LookProject): UiLookEra | undefined {
  const count = new Map<UiLookEra, number>();
  const eraOf = (tilesetId: string | undefined): UiLookEra | undefined => tilesetId ? UI_LOOK_ERA_BY_FAMILY[tilesetFamily(project, tilesetId)] : undefined;
  for (const map of Object.values(project.maps)) {
    const era = eraOf(map.tilesetId);
    if (era) count.set(era, (count.get(era) ?? 0) + 1);
  }
  if (!count.size) return undefined;
  // 버들항 계열(fantasy)은 실내 공용 칩셋이기도 해서 어느 세계에나 섞여 있다 — 다른 시대의 맵이 하나라도 있으면 그쪽이 이 게임의 시대다.
  const specific = [...count].filter(([era]) => era !== "fantasy");
  const pool = specific.length ? specific : [...count];
  const best = Math.max(...pool.map(([, n]) => n));
  const top = pool.filter(([, n]) => n === best).map(([era]) => era);
  const start = eraOf(project.startMapId ? project.maps[project.startMapId]?.tilesetId : undefined);
  return start && top.includes(start) ? start : top[0];
}

function hasBattleCommand(project: LookProject): boolean {
  let found = false;
  const walk = (node: unknown, depth = 0): void => {
    if (found || depth > 24 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) walk(item, depth + 1); return; }
    const o = node as Record<string, unknown>;
    if (o.kind === "battleProcessing") { found = true; return; }
    for (const value of Object.values(o)) if (value && typeof value === "object") walk(value, depth + 1);
  };
  for (const map of Object.values(project.maps)) {
    walk(map.events ?? []);
    if (found || ((map.encounterRate ?? 0) > 0 && (map.encounterTable ?? []).length > 0)) return true;
  }
  return found;
}

/** 이 게임의 사실 — 시대(칩셋 계열) · 전투 방식 · 대사 중심인가(싸움이 없거나, 청사진 단계의 과반이 사람과 말하기·고르기). */
export function uiLookFacts(project: LookProject): UiLookFacts {
  const system = project.system;
  const combat: UiLookCombat = system.battleUiStyle === "pokemon" ? "monster" : system.actionCombat?.enabled === true ? "action" : hasBattleCommand(project) ? "turn" : "none";
  const steps = project.gameBlueprint?.steps ?? [];
  const spoken = steps.filter((step) => step.kind === "talk" || step.kind === "choice").length;
  const talky = combat === "none" || (steps.length > 0 && spoken * 2 > steps.length);
  const era = combat === "monster" ? "monster" : uiLookEra(project);
  return { ...(era ? { era } : {}), combat, talky };
}

/** FNV-1a + 끝 섞기(project/kitLook.ts 와 같은 꼴) — 열쇠가 비슷한 게임들이 같은 순번으로 몰리지 않게. */
function lookHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

/**
 * 축마다 지금 저장된 값(생략 = 아무도 고르지 않음). 저장 정규화는 기본값(유리 대사창 · 도트 메뉴 · 도트 전투 창)을 지우므로
 * «기본을 일부러 골랐다» 와 «안 골랐다» 는 구별되지 않는다 — 둘 다 안 고른 것으로 본다.
 */
interface Stored {
  readonly dialogue?: string; readonly menu?: string; readonly battle?: string; readonly logo?: string; readonly titleMenu?: string; readonly hudFont?: string; readonly hudPanel?: string;
  /** 필드 HUD 가 메뉴 모양을 따로 정했다(fieldHud.menuStyle) — 메뉴 축은 그쪽이 이긴다. */
  readonly hudMenu: boolean;
}

/** 전투 창 축의 값 한 낱말 — 프리셋(+ 겉판을 바꿨으면 그 창). */
const battleKey = (preset: string, window?: string): string => window ? `${preset}+${window}` : preset;
const lookBattleKey = (look: UiLookSet): string => battleKey(look.battle, look.battleWindow);
/** battleLook 안에서 창의 모습이 아닌 칸 — 세트를 입혀도 그대로 둔다. */
const BATTLE_INFO_KEYS: readonly string[] = ["enemyNames", "enemyHp"];

/** 축의 편집기 기본 — 저장되지 않는 값. */
const AXIS_DEFAULT = { dialogue: "glass", menu: "pixel", battle: "pixel", titleMenu: "window" } as const;

function storedMembers(system: Project["system"]): Stored {
  const hud = system.fieldHud;
  const hudMenu = !!hud?.menuStyle && hud.menuStyle !== "project";
  // 적 이름표·체력 막대(끝맺음의 fillEnemyHpLook 이 켠다)는 창의 모습이 아니다 — 그 두 칸은 «전투 창을 골랐다» 로 치지 않는다.
  const battleKeys = system.battleLook ? Object.keys(system.battleLook).filter((key) => !BATTLE_INFO_KEYS.includes(key)) : [];
  const battle = !battleKeys.length ? undefined : battleKeys.every((key) => key === "preset" || key === "window") ? battleKey(system.battleLook!.preset ?? AXIS_DEFAULT.battle, system.battleLook!.window) : "custom";
  return {
    ...(system.dialogueStyle && system.dialogueStyle !== AXIS_DEFAULT.dialogue ? { dialogue: system.dialogueStyle } : {}),
    ...(hudMenu ? { menu: hud!.menuStyle } : system.menuUiStyle && system.menuUiStyle !== AXIS_DEFAULT.menu ? { menu: system.menuUiStyle } : {}),
    ...(battle && battle !== AXIS_DEFAULT.battle ? { battle } : {}),
    ...(system.titleScreen?.logoStyle ? { logo: system.titleScreen.logoStyle } : {}),
    ...(system.titleScreen?.menuStyle && system.titleScreen.menuStyle !== AXIS_DEFAULT.titleMenu ? { titleMenu: system.titleScreen.menuStyle } : {}),
    ...(hud?.font && hud.font !== "auto" ? { hudFont: hud.font } : {}),
    ...(hud?.panel ? { hudPanel: hud.panel } : {}),
    hudMenu,
  };
}

const agreement = (look: UiLookSet, chosen: Stored): number =>
  (chosen.dialogue === look.dialogue ? 4 : 0) + (chosen.menu === look.menu ? 2 : 0) + (chosen.battle === lookBattleKey(look) ? 2 : 0) + (chosen.logo === look.title.logo ? 1 : 0);

/** 사실에 맞는 세트들 — 시대가 맞고 전투 방식이 맞는 것. 시대를 가리지 않는 세트(영화창)는 대사 중심 게임에서만 낀다. */
export function uiLookCandidates(facts: UiLookFacts): UiLookSet[] {
  const combatOk = (look: UiLookSet) => !look.suits.combat || look.suits.combat.includes(facts.combat);
  const byEra = UI_LOOKS.filter((look) => look.suits.eras !== "any" && !!facts.era && look.suits.eras.includes(facts.era) && combatOk(look) && (look.suits.talky !== true || facts.talky));
  const anyEra = UI_LOOKS.filter((look) => look.suits.eras === "any" && look.suits.talky === true && facts.talky && combatOk(look));
  const pool = [...byEra, ...anyEra];
  return pool.length ? pool : UI_LOOKS.filter((look) => look.id === FALLBACK_UI_LOOK_ID);
}

/**
 * 이 게임의 모습 한 벌을 고른다. 차례: ① 모델이 청사진에 적은 것(blueprint.look) ② 전에 입힌 것(system.uiLook — 같은 게임은 끝맺음을 다시 돌아도 같은 모습)
 * ③ 이미 고른 대사창이 든 세트(있으면), 없으면 사실에 맞는 후보 — 그 가운데 이미 골라 둔 다른 축과 가장 많이 겹치는 것들에서 게임 열쇠로 하나.
 */
export function pickUiLook(project: LookProject, seed: string): { readonly look: UiLookSet; readonly by: "blueprint" | "kept" | "facts"; readonly facts: UiLookFacts; readonly pool: readonly string[] } {
  const facts = uiLookFacts(project);
  const named = uiLookById(project.gameBlueprint?.look);
  if (named) return { look: named, by: "blueprint", facts, pool: [named.id] };
  const kept = uiLookById(project.system.uiLook);
  if (kept) return { look: kept, by: "kept", facts, pool: [kept.id] };
  const era = uiLookCandidates(facts);
  const chosen = storedMembers(project.system);
  // 대사창을 이미 골랐으면(모델의 set_project_settings · 저자) 그 대사창이 든 세트가 먼저다 — 시대 후보에 없어도. 가장 많이 보이는 축이라, 그것과 안 맞는 메뉴·전투 창을
  // 입히면 한 벌이 아니다(명세 은행 실측: 선사 세계에 금장 대사창을 고른 게임이 종이 수첩 메뉴를 받았다). 그런 세트가 시대 후보에도 있으면 그 안에서 고른다.
  // 메뉴·전투 창·로고만 고른 게임은 시대 후보 밖으로 나가지 않는다(메뉴 하나가 세계와 안 맞는 대사창을 끌고 오지 않게).
  const withDialogue = chosen.dialogue ? UI_LOOKS.filter((look) => look.dialogue === chosen.dialogue) : [];
  const inEra = withDialogue.filter((look) => era.includes(look));
  const candidates = inEra.length ? inEra : withDialogue.length ? withDialogue : era;
  const best = Math.max(...candidates.map((look) => agreement(look, chosen)));
  const pool = candidates.filter((look) => agreement(look, chosen) === best);
  return { look: pool[lookHash(`ui-look|${seed}`) % pool.length]!, by: "facts", facts, pool: pool.map((look) => look.id) };
}

/**
 * 모습 한 벌을 프로젝트에 입힌다 — 축마다 «아무도 고르지 않았을 때» 만(force 면 전부). 전에 입힌 세트(system.uiLook)의 값 그대로인 축은 고른 것이 아니라
 * 입힌 것이므로 새 세트 값으로 바꾼다(모델이 청사진의 look 을 바꿔 적었을 때). 바꾼 축을 사람 말로 돌려준다(없으면 빈 배열).
 * 필드 HUD 는 글꼴·판만 — fieldHud 가 없으면(아무 HUD 도 정하지 않은 게임) 건드리지 않는다.
 */
export function applyUiLook(project: Pick<Project, "system">, id: string, options: { readonly force?: boolean; readonly skipHud?: boolean } = {}): string[] {
  const look = uiLookById(id);
  if (!look) return [];
  const s = project.system;
  const before = uiLookById(s.uiLook);
  const now = storedMembers(s);
  // 이 축을 채워도 되는가: 아무도 안 골랐거나, 전에 입힌 세트의 값 그대로다.
  const free = (stored: string | undefined, old: string | undefined): boolean => options.force === true || stored === undefined || (before !== undefined && stored === old);
  const out: string[] = [];
  if (free(now.dialogue, before?.dialogue) && (now.dialogue ?? AXIS_DEFAULT.dialogue) !== look.dialogue) { s.dialogueStyle = look.dialogue; out.push(`대사창 ${look.dialogue}`); }
  if ((!now.hudMenu || options.force === true) && free(now.hudMenu ? undefined : now.menu, before?.menu) && ((now.hudMenu ? undefined : now.menu) ?? AXIS_DEFAULT.menu) !== look.menu) {
    s.menuUiStyle = look.menu; out.push(`메뉴 ${look.menu}`);
  }
  if (free(now.battle, before ? lookBattleKey(before) : undefined) && (now.battle ?? AXIS_DEFAULT.battle) !== lookBattleKey(look)) {
    // 적 이름표·체력 막대는 지킨다 — 세트는 창의 모습(프리셋 + 겉판)만 바꾼다.
    const kept = Object.fromEntries(Object.entries(s.battleLook ?? {}).filter(([key]) => BATTLE_INFO_KEYS.includes(key))) as BattleLookSettings;
    s.battleLook = { ...kept, preset: look.battle, ...(look.battleWindow ? { window: look.battleWindow } : {}) };
    out.push(`전투 창 ${lookBattleKey(look)}`);
  }
  if (s.titleScreen) {
    const title = s.titleScreen;
    if (free(now.logo, before?.title.logo) && now.logo !== look.title.logo) { title.logoStyle = look.title.logo; out.push(`타이틀 로고 ${look.title.logo}`); }
    if (free(now.titleMenu, before?.title.menu) && (now.titleMenu ?? AXIS_DEFAULT.titleMenu) !== look.title.menu) { title.menuStyle = look.title.menu; out.push(`타이틀 메뉴 ${look.title.menu}`); }
  }
  const skinFree = options.force === true || s.systemResourceId === undefined || s.systemResourceId === DEFAULT_WINDOW_SKIN || (before?.windowSkin !== undefined && s.systemResourceId === before.windowSkin);
  if (look.windowSkin && skinFree && s.systemResourceId !== look.windowSkin) { s.systemResourceId = look.windowSkin; out.push(`창 그림 ${look.windowSkin}`); }
  // skipHud: HUD 구성이 아직 정해지기 전(청사진을 쓰는 순간)에는 껍질을 입히지 않는다 — 끝맺음이 구성을 고른 뒤에 입힌다.
  if (s.fieldHud && !options.skipHud) {
    const hud: FieldHudConfig = s.fieldHud;
    if (free(now.hudFont, before?.hud.font) && now.hudFont !== look.hud.font) { hud.font = look.hud.font; out.push(`HUD 글꼴 ${look.hud.font}`); }
    if (free(now.hudPanel, before?.hud.panel) && now.hudPanel !== look.hud.panel) { hud.panel = look.hud.panel; out.push(`HUD 판 ${look.hud.panel}`); }
  }
  if (s.uiLook !== look.id) s.uiLook = look.id;
  return out;
}
