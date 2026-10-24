// project/vnLook.ts
// 미연시 대사창 룩(스킨·레이아웃 프리셋) — 저작 데이터 · 프리셋 표 · 검증 · 해석을 한 곳에 둔다 (2026-10-17, vn-look-1).
//
// 왜 있나: 연애 게임의 대사창·ESC 메뉴가 RM2000/FF 풍 파란 창 하나뿐이었다. 다른 미연시(Ren'Py 기본 GUI·DDLC·Clannad·Persona·모바일 연애 앱)는
// 소재(캠퍼스·카페·회사·바닷가·학원)에 맞는 색과 모양, 이름표·선택지·대기 표시 문법을 따로 가진다. 이 모듈은 그것을 **데이터 표**로 두고
// 코드는 해석 함수(resolveVnLook · vnLookAttributes) 한 곳만 갖는다. DOM 을 만지지 않는다(플레이어 · 편집기 미리보기 · 조수 도구가 같은 답을 본다).
//
// 옵트인이다: 저작(meta.oprnVnLook)이 없으면 연애·관계 프로젝트만 소재별 기본 룩이 켜지고, 그 밖의 프로젝트는 undefined(= 옛 대사창, 바이트 불변).
// 새 그림·글꼴 파일은 쓰지 않는다 — 색·모서리·그림자·CSS 모양만이다. 글꼴은 기존 번들 글꼴 스택을 그대로 쓴다.
//
// 조사 근거(링크·서술만, 화면 캡처·에셋은 가져오지 않았다): ~/claude-viz/vn-look-1.html 의 비교 표.
import { usesRelationshipMenu } from "./relationshipMenu";
import type { Project } from "./types";

export const VN_LOOK_VERSION = 1 as const;

/** 소재(분위기) — 기본 룩을 고르는 열쇠. */
export const VN_SETTINGS = ["campus", "cafe", "office", "seaside", "academy"] as const;
export type VnSetting = (typeof VN_SETTINGS)[number];

/** 대사창 프리셋. layout 이 상자 모양을, tokens 가 색·모서리를 정한다. */
export const VN_PRESET_IDS = ["dual-fullbody-veil", "bar-tab", "sakura-card", "paper-note", "office-bar", "sea-glass", "night-glass", "nvl-page", "bubble"] as const;
export type VnPresetId = (typeof VN_PRESET_IDS)[number];
export const VN_LAYOUTS = ["bar", "card", "page", "bubble"] as const;
export type VnLayout = (typeof VN_LAYOUTS)[number];

export const VN_NAMEPLATES = ["tab", "pill", "ribbon"] as const;
export type VnNameplate = (typeof VN_NAMEPLATES)[number];
export const VN_CHOICE_STYLES = ["bar", "card", "bubble"] as const;
export type VnChoiceStyle = (typeof VN_CHOICE_STYLES)[number];
export const VN_WAIT_ICONS = ["arrow", "heart", "dot"] as const;
export type VnWaitIcon = (typeof VN_WAIT_ICONS)[number];
export const VN_FONT_SCALES = ["small", "normal", "large"] as const;
export type VnFontScale = (typeof VN_FONT_SCALES)[number];
export const VN_LINE_SPACINGS = ["tight", "normal", "loose"] as const;
export type VnLineSpacing = (typeof VN_LINE_SPACINGS)[number];
export const VN_LETTER_SPACINGS = ["tight", "normal", "wide"] as const;
export type VnLetterSpacing = (typeof VN_LETTER_SPACINGS)[number];
export const VN_PORTRAIT_ENTRANCES = ["none", "fade", "slide"] as const;
export type VnPortraitEntrance = (typeof VN_PORTRAIT_ENTRANCES)[number];
/** ESC 메뉴·저장·불러오기·설정 화면의 색 토큰: match = 프리셋과 같은 색·모서리·그림자, legacy = 지금까지의 청색 창. */
export const VN_UI_THEMES = ["match", "legacy"] as const;
export type VnUiTheme = (typeof VN_UI_THEMES)[number];

export type VnLookTokens = {
  /** 상자 배경(rgba/hex). */
  readonly bg: string;
  readonly bgStrong: string;
  readonly border: string;
  readonly text: string;
  /** 읽은 글 색. */
  readonly textRead: string;
  readonly textShadow: string;
  readonly nameBg: string;
  readonly nameText: string;
  readonly accent: string;
  readonly accentText: string;
  /** 상자 배경 위에서 글자로 쓸 수 있는 강조색(메뉴 제목·선택 항목). accent 는 면 색이라 밝은 배경에서 글자로는 대비가 모자란다. */
  readonly accentInk: string;
  /** ESC 메뉴·저장 화면 뒤에 깔리는 화면 전체 막. */
  readonly stage: string;
  /** 논리 px. */
  readonly radius: number;
  readonly borderWidth: number;
  readonly shadow: string;
  /** backdrop-filter blur 논리 px(0 = 없음). */
  readonly blur: number;
};

export type VnPresetDefinition = {
  readonly id: VnPresetId;
  readonly label: string;
  readonly description: string;
  /** 어느 소재에 어울리는가(조수 추천·기본 룩 선택). */
  readonly fit: string;
  readonly layout: VnLayout;
  readonly nameplate: VnNameplate;
  readonly choiceStyle: VnChoiceStyle;
  readonly waitIcon: VnWaitIcon;
  readonly tokens: VnLookTokens;
};

/**
 * 프리셋 표 — 색과 모양의 정본. CSS(styles/vnLook.css)는 data-vn-* 속성과 --vn-* 변수만 읽고 숫자를 따로 갖지 않는다.
 * 대비: 본문 글자 ↔ 상자 배경은 모두 WCAG AA(4.5:1) 이상이 되게 골랐다(test/vnLook.test.ts 가 계산으로 확인한다).
 */
export const VN_PRESETS: Readonly<Record<VnPresetId, VnPresetDefinition>> = {
  "dual-fullbody-veil": {
    id: "dual-fullbody-veil",
    label: "양쪽 전신 · 반투명 베일",
    description: "화면 양쪽에 전신 스탠딩 초상을 함께 세우고, 하단에는 테두리 없는 반투명 다크 그라데이션 대화창을 겹칩니다.",
    fit: "연애 시뮬레이션 · 오토메 · 양쪽 전신 스탠딩 대화 장면",
    layout: "bar", nameplate: "pill", choiceStyle: "bar", waitIcon: "arrow",
    tokens: { bg: "rgba(10, 8, 16, 0.84)", bgStrong: "rgba(8, 7, 14, 0.92)", border: "rgba(255, 255, 255, 0.14)", text: "#ffffff", textRead: "#d0d6e8", textShadow: "0 1px 2px rgba(0, 0, 0, 0.98), 0 -1px 2px rgba(0, 0, 0, 0.92), 1px 0 2px rgba(0, 0, 0, 0.92), -1px 0 2px rgba(0, 0, 0, 0.92), 0 2px 6px rgba(0, 0, 0, 0.88)", nameBg: "transparent", nameText: "#ffecbe", accent: "#f3d28c", accentText: "#1b1405", accentInk: "#f5d99b", stage: "rgba(8, 10, 18, 0.80)", radius: 0, borderWidth: 0, shadow: "none", blur: 0 },
  },
  "bar-tab": {
    id: "bar-tab",
    label: "하단 반투명 바 · 이름 탭",
    description: "화면 아래 전폭 반투명 바에 이름이 위로 솟은 탭. Ren'Py 기본 구성처럼 장면을 가장 적게 가립니다.",
    fit: "무엇에나 — 가장 무난한 기본형",
    layout: "bar", nameplate: "tab", choiceStyle: "bar", waitIcon: "arrow",
    tokens: { bg: "rgba(18, 24, 40, 0.80)", bgStrong: "rgba(18, 24, 40, 0.94)", border: "rgba(255, 255, 255, 0.30)", text: "#ffffff", textRead: "#b9c4dd", textShadow: "0 1px 0 rgba(0,0,0,0.7)", nameBg: "#e8eefb", nameText: "#1c2740", accent: "#7fb0ff", accentText: "#10203d", accentInk: "#9cc4ff", stage: "rgba(8, 12, 24, 0.78)", radius: 0, borderWidth: 1, shadow: "0 -2px 8px rgba(0,0,0,0.35)", blur: 2 },
  },
  "sakura-card": {
    id: "sakura-card",
    label: "벚꽃 파스텔 · 둥근 카드",
    description: "연분홍 둥근 카드와 하트 대기 표시. 도키도키풍 밝고 달콤한 연애 장면에 맞습니다.",
    fit: "캠퍼스 · 학교 · 첫사랑 · 달달한 분위기",
    layout: "card", nameplate: "pill", choiceStyle: "card", waitIcon: "heart",
    tokens: { bg: "rgba(255, 240, 246, 0.94)", bgStrong: "rgba(255, 232, 241, 0.98)", border: "#f3a6c1", text: "#4a2a38", textRead: "#85606f", textShadow: "none", nameBg: "#c23a6b", nameText: "#ffffff", accent: "#c23a6b", accentText: "#ffffff", accentInk: "#b02f5e", stage: "rgba(70, 30, 48, 0.62)", radius: 10, borderWidth: 2, shadow: "0 3px 10px rgba(214, 96, 138, 0.35)", blur: 0 },
  },
  "paper-note": {
    id: "paper-note",
    label: "따뜻한 종이 · 노트",
    description: "크림색 종이에 갈색 잉크, 가로 줄 무늬(CSS 만). 카페·서점처럼 아늑한 일상 장면에 맞습니다.",
    fit: "카페 · 서점 · 일기장 같은 잔잔한 이야기",
    layout: "card", nameplate: "ribbon", choiceStyle: "card", waitIcon: "dot",
    tokens: { bg: "rgba(251, 243, 224, 0.97)", bgStrong: "rgba(246, 234, 206, 1)", border: "#b98f5a", text: "#3e2a17", textRead: "#7d654a", textShadow: "none", nameBg: "#8c5a2b", nameText: "#fff6e4", accent: "#a85a1f", accentText: "#ffffff", accentInk: "#9a4f12", stage: "rgba(52, 34, 16, 0.66)", radius: 4, borderWidth: 2, shadow: "0 3px 8px rgba(80, 50, 20, 0.35)", blur: 0 },
  },
  "office-bar": {
    id: "office-bar",
    label: "깔끔한 그레이 · 사무 바",
    description: "연회색 바와 네이비 이름 탭, 화살표 대기 표시. 회사·사무실처럼 차분하고 단정한 장면에 맞습니다.",
    fit: "회사 · 사무실 · 어른 연애",
    layout: "bar", nameplate: "tab", choiceStyle: "bar", waitIcon: "arrow",
    tokens: { bg: "rgba(240, 242, 245, 0.96)", bgStrong: "rgba(232, 235, 240, 0.98)", border: "#9aa5b4", text: "#1f2937", textRead: "#6b7687", textShadow: "none", nameBg: "#243a5e", nameText: "#ffffff", accent: "#2f6fdb", accentText: "#ffffff", accentInk: "#2457b8", stage: "rgba(20, 28, 44, 0.70)", radius: 0, borderWidth: 1, shadow: "0 -2px 6px rgba(20, 30, 50, 0.25)", blur: 0 },
  },
  "sea-glass": {
    id: "sea-glass",
    label: "청량한 바다 · 유리 카드",
    description: "맑은 하늘색 반투명 유리 카드와 흰 글자. 바닷가·여름 장면의 시원한 분위기입니다.",
    fit: "바닷가 · 여름 · 휴양지 · 청량한 분위기",
    layout: "card", nameplate: "pill", choiceStyle: "bubble", waitIcon: "dot",
    tokens: { bg: "rgba(14, 76, 104, 0.78)", bgStrong: "rgba(10, 62, 88, 0.92)", border: "rgba(190, 240, 255, 0.65)", text: "#ffffff", textRead: "#b6dbe8", textShadow: "0 1px 0 rgba(0,40,60,0.6)", nameBg: "#ffd87a", nameText: "#4a3200", accent: "#6fe0f2", accentText: "#06323f", accentInk: "#8eeaf8", stage: "rgba(4, 34, 52, 0.72)", radius: 12, borderWidth: 1, shadow: "0 4px 12px rgba(0, 60, 90, 0.4)", blur: 3 },
  },
  "night-glass": {
    id: "night-glass",
    label: "다크 글라스 · 금빛 강조",
    description: "어두운 보랏빛 유리에 금색 이름 탭. 밤·학원·미스터리가 섞인 진지한 장면에 맞습니다.",
    fit: "학원 · 밤 장면 · 진지한 관계극",
    layout: "bar", nameplate: "ribbon", choiceStyle: "bar", waitIcon: "arrow",
    tokens: { bg: "rgba(26, 20, 44, 0.90)", bgStrong: "rgba(20, 15, 36, 0.95)", border: "rgba(240, 200, 120, 0.32)", text: "#f6f1ff", textRead: "#b5aacb", textShadow: "0 0.5px 1.5px rgba(0,0,0,0.5)", nameBg: "#e6b85c", nameText: "#2a1d05", accent: "#e6b85c", accentText: "#2a1d05", accentInk: "#f0c872", stage: "rgba(10, 6, 22, 0.80)", radius: 2, borderWidth: 1, shadow: "0 -2px 10px rgba(10, 0, 30, 0.5)", blur: 3 },
  },
  "nvl-page": {
    id: "nvl-page",
    label: "풀스크린 NVL · 글 페이지",
    description: "화면 전체를 덮는 어두운 글 페이지. 긴 독백·회상·고백 장면에서 글만 가득 읽습니다(초상은 숨김).",
    fit: "회상 · 독백 · 편지 · 고백 같은 긴 글 장면",
    layout: "page", nameplate: "tab", choiceStyle: "bar", waitIcon: "dot",
    tokens: { bg: "rgba(12, 14, 22, 0.90)", bgStrong: "rgba(8, 10, 16, 0.96)", border: "rgba(255, 255, 255, 0.18)", text: "#f2f2f5", textRead: "#a2a6b8", textShadow: "none", nameBg: "transparent", nameText: "#ffd27f", accent: "#ffd27f", accentText: "#1b1400", accentInk: "#ffd27f", stage: "rgba(4, 5, 10, 0.86)", radius: 0, borderWidth: 0, shadow: "none", blur: 0 },
  },
  bubble: {
    id: "bubble",
    label: "말풍선형 · 둥근 풍선",
    description: "가운데로 모인 둥근 말풍선과 꼬리. 대화체 연애 앱(스토리 노벨)처럼 가볍게 읽습니다.",
    fit: "가벼운 일상 대화 · 모바일 스토리 앱풍",
    layout: "bubble", nameplate: "pill", choiceStyle: "bubble", waitIcon: "dot",
    tokens: { bg: "rgba(255, 255, 255, 0.96)", bgStrong: "rgba(250, 250, 255, 0.99)", border: "#cfd6ea", text: "#26304a", textRead: "#6f768b", textShadow: "none", nameBg: "#3f5fe0", nameText: "#ffffff", accent: "#3f5fe0", accentText: "#ffffff", accentInk: "#3350c8", stage: "rgba(24, 30, 56, 0.60)", radius: 16, borderWidth: 2, shadow: "0 3px 9px rgba(40, 60, 120, 0.3)", blur: 0 },
  },
};

/** 소재 → 기본 프리셋. 연애·관계 프로젝트가 저작 없이 받는 룩이다. */
export const VN_SETTING_DEFAULT_PRESET: Readonly<Record<VnSetting, VnPresetId>> = {
  campus: "sakura-card",
  cafe: "paper-note",
  office: "office-bar",
  seaside: "sea-glass",
  academy: "night-glass",
};

export type AuthoredVnLook = {
  version: 1;
  preset: VnPresetId;
  /** 생략 = 프리셋 기본값. */
  nameplate?: VnNameplate;
  choiceStyle?: VnChoiceStyle;
  waitIcon?: VnWaitIcon;
  fontScale?: VnFontScale;
  lineSpacing?: VnLineSpacing;
  letterSpacing?: VnLetterSpacing;
  /** 읽은 글을 옅은 색으로 구분(스킵·다시 읽기에 유용). 생략 = true. */
  readColor?: boolean;
  portraitEntrance?: VnPortraitEntrance;
  uiTheme?: VnUiTheme;
};

export type ResolvedVnLook = {
  readonly preset: VnPresetId;
  readonly layout: VnLayout;
  readonly nameplate: VnNameplate;
  readonly choiceStyle: VnChoiceStyle;
  readonly waitIcon: VnWaitIcon;
  readonly fontScale: VnFontScale;
  readonly lineSpacing: VnLineSpacing;
  readonly letterSpacing: VnLetterSpacing;
  readonly readColor: boolean;
  readonly portraitEntrance: VnPortraitEntrance;
  readonly uiTheme: VnUiTheme;
  readonly tokens: VnLookTokens;
  /** authored = 저작 · setting-default = 연애 기본(소재로 고름). */
  readonly source: "authored" | "setting-default";
};

const TOP_KEYS = ["version", "preset", "nameplate", "choiceStyle", "waitIcon", "fontScale", "lineSpacing", "letterSpacing", "readColor", "portraitEntrance", "uiTheme"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function oneOf<T extends string>(name: string, value: unknown, allowed: readonly T[]): void {
  if (value !== undefined && !allowed.includes(value as T)) throw Error(`vnLook: ${name} must be one of ${allowed.join("|")}`);
}

/** 저장 직전 검증. 모르는 칸·범위 밖 값은 거절한다(저작 데이터는 조용히 고치지 않는다). */
export function validateVnLook(value: unknown): asserts value is AuthoredVnLook {
  if (!isRecord(value)) throw Error("vnLook: object required");
  const bad = Object.keys(value).find((key) => !TOP_KEYS.includes(key));
  if (bad) throw Error(`vnLook: unknown field ${bad}`);
  if (value.version !== VN_LOOK_VERSION) throw Error("vnLook: version 1 required");
  if (!VN_PRESET_IDS.includes(value.preset as VnPresetId)) throw Error(`vnLook: preset must be one of ${VN_PRESET_IDS.join("|")}`);
  oneOf("nameplate", value.nameplate, VN_NAMEPLATES);
  oneOf("choiceStyle", value.choiceStyle, VN_CHOICE_STYLES);
  oneOf("waitIcon", value.waitIcon, VN_WAIT_ICONS);
  oneOf("fontScale", value.fontScale, VN_FONT_SCALES);
  oneOf("lineSpacing", value.lineSpacing, VN_LINE_SPACINGS);
  oneOf("letterSpacing", value.letterSpacing, VN_LETTER_SPACINGS);
  oneOf("portraitEntrance", value.portraitEntrance, VN_PORTRAIT_ENTRANCES);
  oneOf("uiTheme", value.uiTheme, VN_UI_THEMES);
  if (value.readColor !== undefined && typeof value.readColor !== "boolean") throw Error("vnLook: readColor boolean required");
}

export function defaultVnLook(preset: VnPresetId = "bar-tab"): AuthoredVnLook {
  return { version: 1, preset };
}

/** 도구용 부분 패치. setting 은 소재에 맞는 프리셋을 고른다(preset 이 따로 오면 preset 이 이긴다). */
export type VnLookPatch = {
  readonly preset?: VnPresetId;
  readonly setting?: VnSetting;
  readonly nameplate?: VnNameplate | "preset";
  readonly choiceStyle?: VnChoiceStyle | "preset";
  readonly waitIcon?: VnWaitIcon | "preset";
  readonly fontScale?: VnFontScale;
  readonly lineSpacing?: VnLineSpacing;
  readonly letterSpacing?: VnLetterSpacing;
  readonly readColor?: boolean;
  readonly portraitEntrance?: VnPortraitEntrance;
  readonly uiTheme?: VnUiTheme;
};

/** 부분 패치를 현재 값 위에 덮어 완성형으로 만든다. 검증은 호출자가 validateVnLook 으로. */
export function mergeVnLook(base: AuthoredVnLook | undefined, patch: VnLookPatch): AuthoredVnLook {
  const preset = patch.preset ?? (patch.setting ? VN_SETTING_DEFAULT_PRESET[patch.setting] : base?.preset ?? "bar-tab");
  const next: { -readonly [K in keyof AuthoredVnLook]: AuthoredVnLook[K] } = { version: 1, preset };
  const pick = <K extends Exclude<keyof AuthoredVnLook, "version" | "preset">>(key: K, patched: AuthoredVnLook[K] | "preset" | undefined): void => {
    const value = patched === undefined ? base?.[key] : patched === "preset" ? undefined : patched;
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  };
  pick("nameplate", patch.nameplate);
  pick("choiceStyle", patch.choiceStyle);
  pick("waitIcon", patch.waitIcon);
  pick("fontScale", patch.fontScale);
  pick("lineSpacing", patch.lineSpacing);
  pick("letterSpacing", patch.letterSpacing);
  pick("readColor", patch.readColor);
  pick("portraitEntrance", patch.portraitEntrance);
  pick("uiTheme", patch.uiTheme);
  return next;
}

export function resolveAuthoredVnLook(authored: AuthoredVnLook, source: ResolvedVnLook["source"] = "authored"): ResolvedVnLook {
  const preset = VN_PRESETS[authored.preset];
  return {
    preset: preset.id,
    layout: preset.layout,
    nameplate: authored.nameplate ?? preset.nameplate,
    choiceStyle: authored.choiceStyle ?? preset.choiceStyle,
    waitIcon: authored.waitIcon ?? preset.waitIcon,
    fontScale: authored.fontScale ?? "normal",
    lineSpacing: authored.lineSpacing ?? "normal",
    letterSpacing: authored.letterSpacing ?? "normal",
    readColor: authored.readColor ?? true,
    portraitEntrance: authored.portraitEntrance ?? "fade",
    uiTheme: authored.uiTheme ?? "match",
    tokens: preset.tokens,
    source,
  };
}

const SETTING_PATTERNS: readonly { setting: VnSetting; pattern: RegExp }[] = [
  { setting: "cafe", pattern: /카페|커피|찻집|베이커리|서점|cafe|coffee|bakery|bookstore/iu },
  { setting: "office", pattern: /회사|사무실|사내|직장|오피스|출근|office|workplace|company/iu },
  { setting: "seaside", pattern: /바닷가|해변|바다|해수욕|섬마을|항구|beach|seaside|ocean|harbor/iu },
  { setting: "academy", pattern: /학원|기숙|아카데미|입시|academy|boarding|cram/iu },
  { setting: "campus", pattern: /캠퍼스|대학|학교|교정|동아리|campus|university|college|school/iu },
];

type VnLookHost = Pick<Project, "system" | "gameDesignBrief"> & {
  readonly meta?: { readonly title?: string; readonly oprnVnLook?: AuthoredVnLook };
  readonly maps?: Project["maps"];
  readonly startMapId?: string;
};

/** 프로젝트의 소재 추정 — 기획서 문장 · 인터뷰 선택 · 프로젝트 제목 · 시작 맵 이름을 본다. 못 정하면 campus. */
export function detectVnSetting(project: VnLookHost): VnSetting {
  const brief = project.gameDesignBrief;
  const texts: string[] = [];
  if (brief) {
    texts.push(brief.summary ?? "");
    for (const answer of Object.values(brief.answers ?? {})) if (answer && typeof answer === "object" && "text" in answer) texts.push(String((answer as { text: unknown }).text ?? ""));
    const interview = brief.interview;
    if (interview) texts.push(interview.concept ?? "", interview.protagonist ?? "", interview.notes ?? "");
  }
  texts.push(project.meta?.title ?? "");
  const startMap = project.startMapId ? project.maps?.[project.startMapId] : undefined;
  if (startMap?.name) texts.push(startMap.name);
  const blob = texts.join(" \n");
  for (const { setting, pattern } of SETTING_PATTERNS) if (pattern.test(blob)) return setting;
  return "campus";
}

/**
 * 이 프로젝트의 대사창 룩. 저작이 우선이다. 없으면 연애·관계 중심 게임은 소재에 맞는 기본 룩, 그 밖은 undefined(= 옛 대사창, 바이트 불변).
 * 저작이 있으면 어떤 장르든 그대로 쓴다(옵트인).
 */
export function resolveVnLook(project: VnLookHost | undefined): ResolvedVnLook | undefined {
  if (!project) return undefined;
  const authored = project.meta?.oprnVnLook;
  if (authored) return resolveAuthoredVnLook(authored);
  if (!usesRelationshipMenu(project)) return undefined;
  return resolveAuthoredVnLook(defaultVnLook(VN_SETTING_DEFAULT_PRESET[detectVnSetting(project)]), "setting-default");
}

const FONT_SCALE_VALUE: Readonly<Record<VnFontScale, number>> = { small: 0.9, normal: 1, large: 1.2 };
const LINE_HEIGHT_VALUE: Readonly<Record<VnLineSpacing, number>> = { tight: 1.3, normal: 1.5, loose: 1.75 };
const LETTER_SPACING_VALUE: Readonly<Record<VnLetterSpacing, string>> = { tight: "-0.01em", normal: "0em", wide: "0.04em" };

export type VnLookAttributes = {
  /** 대사창 오버레이(그리고 ESC 메뉴 루트)에 쓰는 data-* — 키는 camelCase(dataset 키). */
  readonly dataset: Readonly<Record<string, string>>;
  /** CSS 사용자 속성(--vn-*). */
  readonly vars: Readonly<Record<string, string>>;
};

/** 해석된 룩 → DOM 속성. 플레이어 대사창·ESC 메뉴·편집기 미리보기가 같은 함수를 쓴다(순수 함수). */
export function vnLookAttributes(look: ResolvedVnLook): VnLookAttributes {
  const t = look.tokens;
  return {
    dataset: {
      vnLook: look.preset,
      vnLayout: look.layout,
      vnName: look.nameplate,
      vnChoice: look.choiceStyle,
      vnWait: look.waitIcon,
      vnEnter: look.portraitEntrance,
      vnRead: look.readColor ? "on" : "off",
      vnFont: look.fontScale,
      vnTheme: look.uiTheme,
    },
    vars: {
      "--vn-bg": t.bg,
      "--vn-bg-strong": t.bgStrong,
      "--vn-border": t.border,
      "--vn-text": t.text,
      "--vn-text-read": t.textRead,
      "--vn-text-shadow": t.textShadow,
      "--vn-name-bg": t.nameBg,
      "--vn-name-text": t.nameText,
      "--vn-accent": t.accent,
      "--vn-accent-text": t.accentText,
      "--vn-accent-ink": t.accentInk,
      "--vn-stage": t.stage,
      "--vn-radius": `${t.radius}px`,
      "--vn-border-width": `${t.borderWidth}px`,
      "--vn-shadow": t.shadow,
      "--vn-blur": t.blur > 0 ? `blur(${t.blur}px)` : "none",
      "--vn-font-scale": String(FONT_SCALE_VALUE[look.fontScale]),
      "--vn-line-height": String(LINE_HEIGHT_VALUE[look.lineSpacing]),
      "--vn-letter-spacing": LETTER_SPACING_VALUE[look.letterSpacing],
    },
  };
}

/** 대사창 한 페이지에 보이는 줄 수 상한: 풀스크린 NVL 은 글만 가득 채운다. */
export function vnLookMaxLines(layout: VnLayout | undefined, fallback: number): number {
  return layout === "page" ? Math.max(fallback, 9) : fallback;
}

/** 이 룩에서 흉상·전신 초상을 보이는가(풀스크린 글 페이지는 숨긴다). */
export function vnLookShowsPortraits(look: ResolvedVnLook | undefined): boolean {
  return look?.layout !== "page";
}

/** 본문 글자와 상자 배경의 대비(WCAG). 색은 #rgb/#rrggbb/rgba() 만 읽는다 — 프리셋 표 검사용. */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const [r, g, b] = parseColor(color).map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function parseColor(color: string): [number, number, number] {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(color.trim());
  if (hex) {
    const raw = hex[1]!.length === 3 ? hex[1]!.split("").map((c) => c + c).join("") : hex[1]!;
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/iu.exec(color.trim());
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  throw Error(`vnLook: unreadable color ${color}`);
}
