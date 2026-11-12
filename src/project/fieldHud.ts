import type { Project } from "./types";
/** Serializable HUD authoring. No executable expressions or arbitrary CSS in project data. */
export const FIELD_HUD_THEMES = { collector: "수집 · 여행", classic: "고전 JRPG", horror: "상징 · 호러", chase: "추격 · HUD 없음", hearts: "하트 · 모험", minimal: "고요한 탐험", farm: "생활 · 농장", survival: "생존 · 탐험", adventure: "액션 · 모험", party: "파티 RPG", legacy: "기존 HUD" } as const;
export const HUD_KINDS = { gauge: "게이지", clock: "달력 · 시계", slots: "슬롯 모음", text: "정보 · 숫자", party: "파티", timers: "상태 타이머", image: "이미지" } as const;
export const HUD_SOURCES = { hp: "체력", mp: "마력", energy: "생활 에너지", stamina: "액션 스태미나", gold: "소지금", variable: "프로젝트 변수", timer: "타이머", tools: "손 슬롯", inventory: "아이템 보유량", weather: "오늘 날씨", map: "현재 맵", friendship: "호감(인물 하나·생략하면 가장 높은 사람)", socialSlots: "오늘 남은 대화 시간" } as const;
export const HUD_SHAPES = { bar: "가로 막대", vertical: "세로 막대", hearts: "하트", ring: "원형", number: "숫자", petals: "꽃잎 · 생명" } as const;
export const HUD_ANCHORS = { "top-left": "왼쪽 위", "top-center": "가운데 위", "top-right": "오른쪽 위", "middle-left": "왼쪽 중앙", "middle-center": "정중앙", "middle-right": "오른쪽 중앙", "bottom-left": "왼쪽 아래", "bottom-center": "가운데 아래", "bottom-right": "오른쪽 아래" } as const;
export const HUD_CONDITIONS = { always: "항상", damaged: "최댓값 미만", low: "25% 이하", nonzero: "0보다 클 때", action: "액션 맵에서", switch: "스위치가 켜질 때", changed: "값 변경 후 3초" } as const;
export const HUD_FONTS = { auto: "스타일 권장", pixel: "갈무리 9 · 또렷한 픽셀", round: "Neo둥근모 · 고전", clean: "기본 UI · 부드러운 고딕" } as const;
export const HUD_MENUS = { project: "기존 메뉴 설정", "field-list": "여행 · 세로 명령창", sheet: "여행 · 사이드 시트", classic: "고전 · 청색 창", journal: "수첩 · 종이", workbench: "아이템 · 작업대" } as const;
export const HUD_DESCRIPTIONS: Record<keyof typeof FIELD_HUD_THEMES, string> = {
  collector: "탐색에는 지역명만. 메뉴를 열면 동료와 아이템을 확인하는 수집 모험 구성입니다.",
  classic: "탐색 화면을 비우고 능력치와 소지품은 메뉴에서 확인합니다. 청색 창과 둥근 픽셀 글꼴을 권장합니다.",
  horror: "다섯 꽃잎으로 생명을 표현합니다. 체력이 줄면 꽃잎이 사라지고 마지막 꽃잎은 어둡게 변합니다.",
  chase: "상시 HUD를 표시하지 않습니다. 조사·대화·아이템 메뉴에 집중하는 추격형 구성입니다.",
  hearts: "하트로 체력을, 작은 숫자로 소지금을 읽습니다. 선택한 도구만 오른쪽 아래에 표시합니다.",
  farm: "시간·소지금·기력과 도구를 밝은 종이 패널에 모읍니다.", survival: "도구·휴대 식량·체력과 소모 중인 스태미나를 분리합니다.",
  party: "동료의 상태를 항상 확인하는 파티 패널 구성입니다.", adventure: "체력·마력과 액션 조작에 집중합니다.", minimal: "작은 하트·시계·현재 도구만 표시합니다.", legacy: "기존 HUD를 사용합니다.",
};
export function recommendedHudFont(theme: FieldHudConfig["theme"]): "pixel" | "round" | "clean" {
  return ["collector", "hearts", "farm"].includes(theme) ? "pixel" : ["classic", "horror", "chase"].includes(theme) ? "round" : "clean";
}
export function recommendedHudMenu(theme: FieldHudConfig["theme"]): keyof typeof HUD_MENUS {
  return theme === "collector" ? "field-list" : theme === "classic" ? "classic" : theme === "horror" || theme === "chase" ? "workbench" : "project";
}
export const HUD_PANELS = { none: "없음", paper: "종이", dark: "어두운 판" } as const;
export const HUD_WIDGET_LIMIT = 24;
export interface HudWidget {
  id: string;
  kind: keyof typeof HUD_KINDS;
  source: keyof typeof HUD_SOURCES;
  label: string;
  shape: keyof typeof HUD_SHAPES;
  anchor: keyof typeof HUD_ANCHORS;
  x: number; y: number; width: number; height: number;
  color: string;
  panel: keyof typeof HUD_PANELS;
  condition: keyof typeof HUD_CONDITIONS;
  showValue: boolean;
  enabled: boolean; hideEmpty: boolean; autoAvoid: boolean;
  max: number; slots: number;
  actorId?: string; npcKey?: string; variableId?: string; maxVariableId?: string; switchId?: string; timerId?: string; resourceId?: string;
  itemIds: string[];
}
export interface FieldHudConfig {
  theme: keyof typeof FIELD_HUD_THEMES;
  font?: keyof typeof HUD_FONTS;
  menuStyle?: keyof typeof HUD_MENUS;
  vitals: boolean; clock: boolean; tools: boolean; objective: boolean; hideEmpty: boolean;
  /** Omitted = generated preset; [] = deliberately empty HUD. */
  widgets?: HudWidget[];
}
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const choice = <T extends string>(v: unknown, values: Record<T, unknown>, fallback: T): T => typeof v === "string" && Object.hasOwn(values, v) ? v as T : fallback;
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
export function normalizeHudWidget(value: unknown, index = 0): HudWidget {
  const raw = record(value);
  const optional = (key: string) => typeof raw[key] === "string" && raw[key].trim() ? raw[key].trim().slice(0, 160) : undefined;
  return {
    id: optional("id") ?? `hud-${index + 1}`,
    kind: choice(raw.kind, HUD_KINDS, "gauge"), source: choice(raw.source, HUD_SOURCES, "hp"),
    label: typeof raw.label === "string" ? raw.label.slice(0, 60) : "체력",
    shape: choice(raw.shape, HUD_SHAPES, "bar"), anchor: choice(raw.anchor, HUD_ANCHORS, "top-left"),
    x: number(raw.x, 10, 0, 1920), y: number(raw.y, 10, 0, 1080), width: number(raw.width, 90, 8, 640), height: number(raw.height, 30, 8, 480),
    color: typeof raw.color === "string" && /^#[\da-f]{6}$/i.test(raw.color) ? raw.color : "#e5c878",
    panel: choice(raw.panel, HUD_PANELS, "none"),
    condition: choice(raw.condition, HUD_CONDITIONS, "always"),
    showValue: raw.showValue !== false, enabled: raw.enabled !== false, hideEmpty: raw.hideEmpty !== false, autoAvoid: raw.autoAvoid === true,
    max: number(raw.max, 100, 1, 999999999), slots: number(raw.slots, 8, 1, 10),
    actorId: optional("actorId"), npcKey: optional("npcKey"), variableId: optional("variableId"), maxVariableId: optional("maxVariableId"), switchId: optional("switchId"), timerId: optional("timerId"), resourceId: optional("resourceId"),
    itemIds: Array.isArray(raw.itemIds) ? [...new Set(raw.itemIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 160))].slice(0, 10) : [],
  };
}
export function normalizeFieldHud(value: unknown): FieldHudConfig {
  const raw = record(value);
  const theme = choice(raw.theme, FIELD_HUD_THEMES, "minimal");
  const flag = (key: string, fallback: boolean): boolean => typeof raw[key] === "boolean" ? raw[key] as boolean : fallback;
  const ids = new Set<string>();
  const widgets = Array.isArray(raw.widgets) ? raw.widgets.slice(0, HUD_WIDGET_LIMIT).map((v, i) => {
    const widget = normalizeHudWidget(v, i);
    let id = widget.id;
    while (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    return { ...widget, id };
  }) : undefined;
  return { theme, ...(raw.font !== undefined ? { font: choice(raw.font, HUD_FONTS, "auto") } : {}), ...(raw.menuStyle !== undefined ? { menuStyle: choice(raw.menuStyle, HUD_MENUS, "project") } : {}), vitals: flag("vitals", true), clock: flag("clock", true), tools: flag("tools", true), objective: flag("objective", !["minimal", "collector", "classic", "horror", "chase", "hearts"].includes(theme)), hideEmpty: flag("hideEmpty", true), ...(widgets !== undefined ? { widgets } : {}) };
}
/**
 * 필드 HUD 예산 — 논리 화면에 대한 몫. 화면이 좁다(320×240 을 3배쯤으로 본다): 게임이 보여야 한다.
 *  - persistent: 늘 떠 있는 것(HUD 칸 + 목표 줄 한 줄)의 넓이 합 ≤ 6%
 *  - centre: 화면 가운데 60%×60% 에는 늘 떠 있는 것도, 잠깐 뜨는 알림도 두지 않는다
 *  - prompt: 「Z 조사」 조작 안내 ≤ 4%, 아래 끝
 *  - objectiveWidth · objectiveHeight: 목표 줄은 폭 45% 까지, 두 줄일 때도 높이 8% 까지
 * 값은 test/fieldHudBudget.test.ts 가 프리셋과 zoneFeedback.css 에서 잰다.
 */
export const HUD_BUDGET = { persistent: 0.06, centre: 0.6, prompt: 0.04, objectiveWidth: 0.45, objectiveHeight: 0.08 } as const;
/** 목표 줄·조작 안내·알림의 글 크기(논리 px, 높이 240 기준 — zoneFeedback.css 가 같은 값을 --play-ui-scale 로 곱한다). */
export const HUD_LINE = { font: 7, line: 8.5, padY: 1, padX: 4, promptMaxWidth: 0.6 } as const;
/** 동료 판 한 줄(논리 px — fieldHud.css): 줄 높이 · 줄 사이 · 판 여백 · 테두리. 네 명이면 4×7 + 3×1 + 2×(3+1) = 39. */
export const HUD_PARTY_ROW = { row: 7, gap: 1, pad: 3, border: 1 } as const;

/**
 * 테마 프리셋 — 논리 화면 320×240 에 맞춘 크기다. 화면이 좁다: 늘 떠 있는 칸의 합이 화면의 6% 를 넘지 않고(목표 줄 한 줄 포함),
 * 가운데 60%×60% 에는 아무것도 두지 않는다(HUD_BUDGET · test/fieldHudBudget.test.ts 가 테마마다 잰다).
 * 전에는 동료 판 90×138, 시계 76×44, 도구 8칸 218×32, 체력 막대 120×31 … 로 농장 테마는 화면의 20%, 파티 테마는 한 명일 때도 6% 를 덮었다(2026-11-13 오너 «HUD 가 개판»).
 * 줄인 방법: 이름표·숫자를 떼고 한 줄 높이(높이 16 미만이면 렌더러가 한 줄 배치 — data-compact), 시계는 날짜와 시각을 한 줄로, 슬롯은 11px 칸.
 * 파티 테마의 도구 8칸은 뺐다(동료 넷 + 시계 + 도구 + 목표 줄이면 예산을 넘는다 — 도구를 쓰는 파티 게임은 widgets 로 직접 짠다).
 */
export function hudPreset(theme: FieldHudConfig["theme"]): HudWidget[] {
  const w = (id: string, patch: Partial<HudWidget>) => normalizeHudWidget({ id, ...patch });
  const clock = w("clock", { kind: "clock", label: "", shape: "number", anchor: "top-right", x: 6, y: 6, width: 56, height: 12 });
  const hp = w("health", { label: "", source: "hp", x: 6, y: 6, width: 56, height: 10, color: "#df765f", showValue: false });
  const toolbar = w("tools", { kind: "slots", source: "tools", label: "", anchor: "bottom-center", y: 6, width: 99, height: 14, slots: 8, autoAvoid: true });
  if (["legacy", "classic", "chase"].includes(theme)) return [];
  if (theme === "collector") return [w("location", { kind: "text", source: "map", label: "", width: 132, height: 28, panel: "paper" })];
  if (theme === "horror") return [w("life", { source: "hp", label: "", shape: "petals", width: 34, height: 44, color: "#b74660", showValue: false })];
  if (theme === "hearts") return [
    { ...hp, shape: "hearts", width: 76, height: 15, color: "#ef6a68" },
    w("coins", { kind: "text", source: "gold", label: "G", x: 6, y: 24, width: 46, height: 12, color: "#f4d17b" }),
    { ...toolbar, anchor: "bottom-right", x: 6, width: 20, height: 20, slots: 1, autoAvoid: false },
  ];
  if (theme === "farm") return [
    { ...clock, panel: "paper" },
    w("gold", { kind: "text", source: "gold", label: "G", anchor: "top-right", x: 65, y: 6, width: 44, height: 12, panel: "paper", color: "#bc8a35" }),
    { ...toolbar, panel: "paper" },
    w("energy", { source: "energy", label: "", shape: "vertical", anchor: "bottom-right", x: 6, y: 6, width: 12, height: 36, color: "#83b457", panel: "paper", showValue: false }),
    { ...hp, anchor: "bottom-right", x: 21, shape: "vertical", width: 12, height: 36, condition: "damaged", panel: "paper" },
  ];
  if (theme === "survival") return [
    { ...toolbar, anchor: "top-left", x: 6, width: 87, height: 14, panel: "dark", slots: 7, autoAvoid: false },
    { ...hp, anchor: "bottom-left", panel: "dark" },
    w("food", { kind: "slots", source: "inventory", label: "", anchor: "bottom-left", x: 6, y: 19, width: 39, height: 14, slots: 3, panel: "dark" }),
    w("stamina", { source: "stamina", label: "", anchor: "bottom-center", y: 6, width: 60, height: 10, condition: "damaged", color: "#d8bf6a", showValue: false }),
    { ...clock, panel: "dark" },
    w("effects", { kind: "timers", label: "", anchor: "top-left", x: 6, y: 23, width: 56, height: 24, panel: "dark" }),
  ];
  if (theme === "party") return [w("party", { kind: "party", label: "", x: 6, y: 6, width: 54, height: 40, panel: "dark" }), { ...clock, panel: "dark" }];
  if (theme === "adventure") return [
    { ...hp, width: 64 },
    w("magic", { source: "mp", label: "", x: 6, y: 18, width: 64, height: 10, color: "#78bddb", showValue: false }),
    { ...toolbar, anchor: "bottom-right", x: 6, width: 63, slots: 5, panel: "dark", autoAvoid: false },
    w("stamina", { source: "stamina", label: "", shape: "ring", anchor: "bottom-left", x: 6, y: 6, width: 24, height: 24, color: "#a3c982", condition: "damaged", showValue: false }),
  ];
  return [{ ...hp, shape: "hearts", color: "#fff8df", width: 70, height: 14 }, clock, { ...toolbar, anchor: "bottom-left", x: 6, width: 18, height: 18, slots: 1, autoAvoid: false }];
}
/** 몸 게이지(체력·마력·기력·스태미나). vitals 가 꺼지면 넷이 함께 꺼진다 — 체력만 끄면 「마력 43/43」 막대 하나가 혼자 남았다(2026-11-11 Terra 게임 fun-x1). */
export const HUD_BODY_SOURCES: readonly HudWidget["source"][] = ["hp", "mp", "energy", "stamina"];
export const isBodyGauge = (w: Pick<HudWidget, "kind" | "source">): boolean => w.kind === "gauge" && HUD_BODY_SOURCES.includes(w.source);
export function resolvedHudWidgets(config: FieldHudConfig): HudWidget[] {
  if (config.widgets !== undefined) return config.widgets;
  return hudPreset(config.theme).filter(w => (!isBodyGauge(w) || config.vitals) && (w.kind !== "clock" || config.clock) && (w.source !== "tools" || config.tools)).map(w => w.source === "tools" ? { ...w, hideEmpty: config.hideEmpty } : w);
}

/** 클래식 JRPG 의 필드 HUD — 프리셋 위젯이 없는 「고전 JRPG」 테마. 저작자가 정한 fieldHud 가 없을 때만 쓴다(jrpg-real-1 J09: 기본 하트 HUD 가 지도 위쪽을 덮었다). */
export const JRPG_CLASSIC_FIELD_HUD: FieldHudConfig = { theme: "classic", vitals: true, clock: true, tools: true, objective: false, hideEmpty: true };

/** 저장된 fieldHud 가 없는 파티 모험 JRPG 는 프리셋을 거치기 전에 만든 프로젝트·헤드리스 생성물도 같은 클래식 HUD 로 본다. */
export function effectiveFieldHud(project: { readonly system: { readonly fieldHud?: FieldHudConfig; readonly genre?: string } }): FieldHudConfig | undefined {
  return project.system.fieldHud ?? (project.system.genre === "adventure-jrpg" ? JRPG_CLASSIC_FIELD_HUD : undefined);
}

/** 플레이 중 체력이 줄 수 있는가: 인카운트, 전투 명령, 체력을 깎는 명령(changeActorHp -=). 하나도 없으면 체력 HUD 는 장식일 뿐이다. */
export function projectCanLoseHp(p: Pick<Project, "maps" | "database">): boolean {
  let found=false;
  const walk=(list:unknown):void=>{if(found||!Array.isArray(list))return;for(const raw of list){if(found)return;if(!raw||typeof raw!=='object')continue;const c=raw as Record<string,unknown>;
    if(c.kind==='battleProcessing'||(c.kind==='changeActorHp'&&(c.op==='-='||(typeof c.amount==='number'&&c.amount<0)))){found=true;return;}
    for(const v of Object.values(c)){if(Array.isArray(v))walk(v);else if(v&&typeof v==='object')for(const w of Object.values(v as Record<string,unknown>))if(Array.isArray(w))walk(w);}}};
  for(const map of Object.values(p.maps)){if((map.encounterRate??0)>0&&(map.encounterTable??[]).length>0)return true;for(const ev of map.events??[])for(const page of ev.pages??[])walk(page.commands);}
  for(const ce of (p.database as {commonEvents?:{commands?:unknown}[]}).commonEvents??[])walk(ce.commands);
  return found;
}

/**
 * 필드에서 체력이 깎일 수 있는가 — 실시간 액션 전투, 또는 맵·공통 이벤트의 체력 깎기 명령(함정·독 늪·추격자).
 * 턴제 전투 안에서만 바뀌는 체력은 여기 들지 않는다: 그 숫자는 전투 화면과 메뉴의 것이고, 필드에서는 걷는 내내 한 번도 움직이지 않는다.
 */
export function projectFieldHpChanges(p: Pick<Project, "maps" | "database" | "system">): boolean {
  if (p.system.actionCombat?.enabled === true) return true;
  let found = false;
  const walk = (list: unknown): void => {
    if (found || !Array.isArray(list)) return;
    for (const raw of list) {
      if (found) return;
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      if (c.kind === "changeActorHp" && (c.op === "-=" || (typeof c.amount === "number" && c.amount < 0))) { found = true; return; }
      for (const v of Object.values(c)) { if (Array.isArray(v)) walk(v); else if (v && typeof v === "object") for (const inner of Object.values(v as Record<string, unknown>)) if (Array.isArray(inner)) walk(inner); }
    }
  };
  for (const map of Object.values(p.maps)) for (const ev of map.events ?? []) for (const page of ev.pages ?? []) walk(page.commands);
  for (const ce of (p.database as { commonEvents?: { commands?: unknown }[] }).commonEvents ?? []) walk(ce.commands);
  return found;
}

/**
 * 이 게임에서 «필드에서» 움직이는 몸 게이지 — 필드에서 바뀔 수 없는 것은 필드에 띄울 까닭이 없다(메뉴와 전투 화면에 있다).
 * hp = 필드에서 깎인다(액션 전투·피해 명령). mp·stamina = 실시간 액션 전투에서만 필드에서 쓴다.
 * 2026-11-13 전에는 hp 가 «전투가 있다» 였다 — 턴제 게임이 필드에 「514 / 514」 를 내내 띄웠다.
 */
export interface HudUse { readonly hp: boolean; readonly mp: boolean; readonly stamina: boolean }
export function projectHudUse(p: Pick<Project, "maps" | "database" | "system">): HudUse {
  const action = p.system.actionCombat?.enabled === true;
  const costsMp = (cost: unknown): boolean => typeof cost === "number" ? cost > 0 : !!cost && typeof cost === "object" && Object.values(cost as Record<string, unknown>).some((v) => typeof v === "number" && v > 0);
  const mp = action && ((p.database as { skills?: { mpCost?: unknown }[] }).skills ?? []).some((s) => costsMp(s.mpCost));
  return { hp: projectFieldHpChanges(p), mp, stamina: action };
}
/** 필드에서 바뀔 수 없는 칸인가 — 체력·마력·스태미나 게이지와 동료 체력 판(호감 목록은 대화로 바뀌므로 아니다). 기력(energy)은 생활 게임이 필드에서 쓴다. */
function idleOnField(w: HudWidget, use: HudUse): boolean {
  if (w.kind === "party") return w.source !== "friendship" && !use.hp;
  return isBodyGauge(w) && ((w.source === "hp" && !use.hp) || (w.source === "mp" && !use.mp) || (w.source === "stamina" && !use.stamina));
}
/**
 * 필드에 실제로 올리는 칸 — 프리셋 구성(widgets 생략)에서는 이 게임의 필드에서 바뀔 수 없는 칸을 뺀다. 저자가 widgets 를 직접 짰으면 그대로다.
 * 런타임(player/fieldHud.ts)과 조수 도구가 같은 함수를 쓴다.
 */
export function fieldHudWidgets(p: Pick<Project, "maps" | "database" | "system">, config: FieldHudConfig): HudWidget[] {
  const widgets = resolvedHudWidgets(config);
  if (config.widgets !== undefined) return widgets;
  const use = projectHudUse(p);
  return widgets.filter((w) => !idleOnField(w, use));
}
/**
 * widgets 가 그 테마 프리셋에서 몇 칸을 뺀 것뿐이면(조수가 쓰지 않는 게이지를 빼고 저장한 모양) widgets 를 떼어 프리셋 구성으로 되돌린다.
 * 저자가 칸을 옮기거나 새로 짠 widgets 는 그대로다. 프리셋으로 되돌려야 vitals 를 다시 켜거나 전투가 생긴 뒤에 뺀 게이지가 돌아온다.
 */
export function asPresetHud(config: FieldHudConfig): FieldHudConfig {
  if (config.widgets === undefined) return config;
  const preset = new Map(hudPreset(config.theme).map((w) => [w.id, JSON.stringify({ ...w, hideEmpty: true })]));
  if (!config.widgets.every((w) => preset.get(w.id) === JSON.stringify({ ...w, hideEmpty: true }))) return config;
  const { widgets: _dropped, ...rest } = config;
  return rest;
}
/** 고른 HUD 에서 이 게임의 필드에서 바뀔 수 없는 칸 — 몸 게이지와 동료 체력 판(프리셋 구성일 때만 — 저자가 직접 짠 widgets 는 묻지 않는다). */
export function unusedHudGauges(config: FieldHudConfig, use: HudUse): HudWidget[] {
  if (config.widgets !== undefined) return [];
  return resolvedHudWidgets(config).filter((w) => w.enabled && idleOnField(w, use));
}
/** 필드에 늘 보이는 것(읽는 쪽은 조수 — 고른 테마가 실제로 무엇을 띄우는지 도구 답에 싣는다). 빈 슬롯처럼 값이 없으면 숨는 칸은 「when filled」. */
export function hudOnScreen(config: FieldHudConfig): string[] {
  const out = resolvedHudWidgets(config).filter((w) => w.enabled).map((w) => {
    const what = w.kind === "gauge" ? `${w.source} gauge${w.shape === "bar" ? "" : ` (${w.shape})`}` : w.kind === "slots" ? `${w.source} slots ×${w.slots}` : w.kind === "text" ? `${w.source} text` : w.kind;
    const when = w.condition !== "always" ? `, only when ${w.condition}` : w.kind === "slots" && w.hideEmpty ? ", only when filled" : "";
    return `${what}${w.label ? ` «${w.label}»` : ""} at ${w.anchor}${when}`;
  });
  if (config.objective) out.push("objective line at top-right");
  return out;
}
