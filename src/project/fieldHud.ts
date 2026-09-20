/** Serializable HUD authoring. No executable expressions or arbitrary CSS in project data. */
export const FIELD_HUD_THEMES = { collector: "수집 · 여행", classic: "고전 JRPG", horror: "상징 · 호러", chase: "추격 · HUD 없음", hearts: "하트 · 모험", minimal: "고요한 탐험", farm: "생활 · 농장", survival: "생존 · 탐험", adventure: "액션 · 모험", party: "파티 RPG", legacy: "기존 HUD" } as const;
export const HUD_KINDS = { gauge: "게이지", clock: "달력 · 시계", slots: "슬롯 모음", text: "정보 · 숫자", party: "파티", timers: "상태 타이머", image: "이미지" } as const;
export const HUD_SOURCES = { hp: "체력", mp: "마력", energy: "생활 에너지", stamina: "액션 스태미나", gold: "소지금", variable: "프로젝트 변수", timer: "타이머", tools: "손 슬롯", inventory: "아이템 보유량", weather: "오늘 날씨", map: "현재 맵" } as const;
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
  panel: "none" | "paper" | "dark";
  condition: keyof typeof HUD_CONDITIONS;
  showValue: boolean;
  enabled: boolean; hideEmpty: boolean; autoAvoid: boolean;
  max: number; slots: number;
  actorId?: string; variableId?: string; maxVariableId?: string; switchId?: string; timerId?: string; resourceId?: string;
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
    x: number(raw.x, 10, 0, 1920), y: number(raw.y, 10, 0, 1080), width: number(raw.width, 90, 20, 640), height: number(raw.height, 30, 14, 480),
    color: typeof raw.color === "string" && /^#[\da-f]{6}$/i.test(raw.color) ? raw.color : "#e5c878",
    panel: choice(raw.panel, { none: 1, paper: 1, dark: 1 }, "none"),
    condition: choice(raw.condition, HUD_CONDITIONS, "always"),
    showValue: raw.showValue !== false, enabled: raw.enabled !== false, hideEmpty: raw.hideEmpty !== false, autoAvoid: raw.autoAvoid === true,
    max: number(raw.max, 100, 1, 999999999), slots: number(raw.slots, 8, 1, 10),
    actorId: optional("actorId"), variableId: optional("variableId"), maxVariableId: optional("maxVariableId"), switchId: optional("switchId"), timerId: optional("timerId"), resourceId: optional("resourceId"),
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
export function hudPreset(theme: FieldHudConfig["theme"]): HudWidget[] {
  const w = (id: string, patch: Partial<HudWidget>) => normalizeHudWidget({ id, ...patch });
  const clock = w("clock", { kind: "clock", label: "", anchor: "top-right", width: 76, height: 44 });
  const hp = w("health", { label: "체력", source: "hp", width: 94, height: 30, color: "#df765f" });
  const toolbar = w("tools", { kind: "slots", source: "tools", label: "도구", anchor: "bottom-center", width: 218, height: 32, slots: 8, autoAvoid: true });
  if (["legacy", "classic", "chase"].includes(theme)) return [];
  if (theme === "collector") return [w("location", { kind: "text", source: "map", label: "", width: 132, height: 28, panel: "paper" })];
  if (theme === "horror") return [w("life", { source: "hp", label: "", shape: "petals", width: 34, height: 44, color: "#b74660", showValue: false })];
  if (theme === "hearts") return [
    { ...hp, shape: "hearts", label: "", width: 91, height: 22, color: "#ef6a68", showValue: false },
    w("coins", { kind: "text", source: "gold", label: "G", y: 36, width: 66, height: 20, color: "#f4d17b" }),
    { ...toolbar, label: "", anchor: "bottom-right", width: 36, height: 36, slots: 1, autoAvoid: false },
  ];
  if (theme === "farm") return [
    { ...clock, panel: "paper" },
    w("gold", { kind: "text", source: "gold", label: "소지금", anchor: "top-right", y: 58, width: 76, height: 23, panel: "paper", color: "#bc8a35" }),
    { ...toolbar, panel: "paper", width: 234, height: 34 },
    w("energy", { source: "energy", label: "기력", shape: "vertical", anchor: "bottom-right", y: 56, width: 26, height: 82, color: "#83b457", panel: "paper" }),
    { ...hp, anchor: "bottom-right", x: 41, y: 56, shape: "vertical", width: 26, height: 82, condition: "damaged", panel: "paper" },
  ];
  if (theme === "survival") return [
    { ...toolbar, anchor: "top-left", width: 202, height: 32, panel: "dark", slots: 7, autoAvoid: false },
    { ...hp, anchor: "bottom-left", width: 104, height: 34, panel: "dark" },
    w("food", { kind: "slots", source: "inventory", label: "휴대 식량", anchor: "bottom-left", y: 49, width: 104, height: 37, slots: 3, panel: "dark" }),
    w("stamina", { source: "stamina", label: "스태미나", anchor: "bottom-center", y: 12, width: 84, height: 24, condition: "damaged", color: "#d8bf6a" }),
    { ...clock, width: 65, height: 39, panel: "dark" },
    w("effects", { kind: "timers", label: "상태", anchor: "top-right", y: 55, width: 75, height: 45, panel: "dark" }),
  ];
  if (theme === "party") return [w("party", { kind: "party", label: "동료", width: 90, height: 138, panel: "dark" }), { ...clock, panel: "dark" }, { ...toolbar, panel: "dark" }];
  if (theme === "adventure") return [{ ...hp, panel: "dark", width: 120, height: 31 }, w("magic", { source: "mp", label: "마력", y: 45, width: 120, height: 25, color: "#78bddb" }), { ...toolbar, anchor: "bottom-right", width: 154, slots: 5, panel: "dark", autoAvoid: false }, w("stamina", { source: "stamina", label: "기력", shape: "ring", anchor: "bottom-left", width: 40, height: 40, color: "#a3c982", condition: "damaged" })];
  return [{ ...hp, shape: "hearts", label: "", color: "#fff8df", width: 80, height: 25 }, { ...clock, width: 60, height: 34 }, { ...toolbar, anchor: "bottom-left", width: 40, height: 34, slots: 1, autoAvoid: false }];
}
export function resolvedHudWidgets(config: FieldHudConfig): HudWidget[] {
  if (config.widgets !== undefined) return config.widgets;
  return hudPreset(config.theme).filter(w => (w.source !== "hp" || config.vitals) && (w.kind !== "clock" || config.clock) && (w.source !== "tools" || config.tools)).map(w => w.source === "tools" ? { ...w, hideEmpty: config.hideEmpty } : w);
}
