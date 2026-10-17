/**
 * 자료집 「메뉴·시스템」 탭 — 플레이 화면의 시스템 UI 세 덩이를 한 화면에서 저작한다(2026-10-17, 미연시 3단계).
 *
 * - ESC 메뉴: 항목 켜기/끄기·순서·이름 (`meta.oprnFieldMenu`)
 * - 대사창: 백로그·오토·스킵·숨기기 단추, 기본 속도·스킵 범위·백로그 줄 수 (`meta.oprnDialogueSystem`)
 * - 갤러리·엔딩 목록·저장 카드 (`meta.oprnVnExtras`)
 *
 * 검증·병합·연동 규칙은 조수 도구(configure_field_menu·set_dialogue_system·set_vn_extras)와 같은 함수(`@/project/menuSystem`)를 쓴다 —
 * 화면과 도구가 같은 규칙을 갖는다. 저작이 없으면 옛 동작 그대로이고(연애·관계 중심 게임만 기본 구성이 처음부터 켜져 있다),
 * 값을 바꾸는 순간 그 칸이 이 게임만의 저작이 된다. 되돌리기 버튼은 저작을 지워 자동 판정으로 돌린다.
 */
import { PORTRAIT_BOTTOM_NOTICE } from "@/project/dialoguePortraitPosition";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { field, segmentedControl, selectField, toggleSwitch } from "@/editor/panels/databaseControls";
import { noticeBar, sectionCard } from "@/editor/panels/databaseWorkspace";
import {
  BACKLOG_LIMIT_MAX,
  BACKLOG_LIMIT_MIN,
  DIALOGUE_UI_LANGUAGES,
  WINDOW_OPACITY_MAX,
  WINDOW_OPACITY_MIN,
  defaultDialogueSystem,
  mergeDialogueSystem,
  resolveDialogueSystem,
  type DialogueSpeed,
  type DialogueSystemPatch,
  type SkipScope,
} from "@/project/dialogueSystem";
import { fieldMenu, type AuthoredFieldMenu, type FieldMenuCommand } from "@/project/fieldMenu";
import {
  FIELD_MENU_COMMAND_HELP,
  FIELD_MENU_DEFAULT_LABELS,
  MENU_STARTERS,
  applyMenuSystemEdit,
  describeMenuSystemError,
  menuAddableCommands,
  menuSystemIssues,
  menuWithEntry,
  menuWithLabel,
  menuWithMove,
  menuWithoutEntry,
  validateMenuSystemEdit,
  type MenuStarter,
  type MenuSystemEdit,
  type MenuSystemIssue,
} from "@/project/menuSystem";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { defaultVnExtras, listEndingRows, listGallerySlots, mergeVnExtras, resolveVnExtras, type VnExtrasPatch } from "@/project/vnExtras";
import {
  VN_CHOICE_STYLES,
  VN_FONT_SCALES,
  VN_LETTER_SPACINGS,
  VN_LINE_SPACINGS,
  VN_NAMEPLATES,
  VN_PORTRAIT_ENTRANCES,
  VN_PRESETS,
  VN_PRESET_IDS,
  VN_UI_THEMES,
  VN_WAIT_ICONS,
  mergeVnLook,
  resolveVnLook,
  type AuthoredVnLook,
  type VnLookPatch,
  type VnPresetId,
} from "@/project/vnLook";
import { el } from "@/util/dom";

const LANGUAGE_NAMES: Readonly<Record<(typeof DIALOGUE_UI_LANGUAGES)[number], string>> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "简体中文",
  auto: "플레이어 기기 언어",
};
const SPEED_OPTIONS = [
  { id: "slow", name: "느리게" },
  { id: "normal", name: "보통" },
  { id: "fast", name: "빠르게" },
] as const;
const SKIP_OPTIONS = [
  { id: "read", name: "읽은 글만" },
  { id: "all", name: "전부" },
] as const;
const LOOK_NAMEPLATE_NAMES: Readonly<Record<(typeof VN_NAMEPLATES)[number], string>> = { tab: "위로 솟은 탭", pill: "둥근 알약", ribbon: "리본" };
const LOOK_CHOICE_NAMES: Readonly<Record<(typeof VN_CHOICE_STYLES)[number], string>> = { bar: "가로 막대", card: "카드", bubble: "풍선" };
const LOOK_WAIT_NAMES: Readonly<Record<(typeof VN_WAIT_ICONS)[number], string>> = { arrow: "화살표", heart: "하트", dot: "점" };
const LOOK_SIZE_NAMES = { small: "작게", normal: "보통", large: "크게" } as const;
const LOOK_SPACING_NAMES = { tight: "촘촘히", normal: "보통", loose: "넓게" } as const;
const LOOK_LETTER_NAMES = { tight: "좁게", normal: "보통", wide: "넓게" } as const;
const LOOK_ENTRANCE_NAMES = { none: "없음", fade: "서서히", slide: "미끄러져" } as const;
const LOOK_UI_THEME_NAMES = { match: "룩과 같은 색", legacy: "예전 청색 창" } as const;
const LOOK_PRESET_DEFAULT = "preset";
const LOOK_LEGACY_OPTION = "legacy";
const MENU_MAX_ENTRIES = 12;
/** 설정이 어긋난 게 아니라 아직 채울 내용(엔딩·그림)이 없다는 안내 — 경고색이 아니라 안내색으로 보인다. */
const CONTENT_ISSUES: ReadonlySet<string> = new Set(["endings-none", "gallery-no-cg"]);

/** 가장 최근 편집의 거절 이유·연동 안내. 그때의 프로젝트 판(store.getCurrent())에 묶여 있어 되돌리기·다른 편집·프로젝트 전환이 일어나면 저절로 사라진다. */
let lastRejection: string | null = null;
let lastNotices: readonly string[] = [];
let lastFeedbackProject: Project | null = null;

function liveFeedback(): { readonly rejection: string | null; readonly notices: readonly string[] } {
  if (lastFeedbackProject !== store.getCurrent()) return { rejection: null, notices: [] };
  return { rejection: lastRejection, notices: lastNotices };
}

type CommitOptions = {
  /** 다시 그린 뒤 키보드 포커스를 돌려줄 컨트롤의 data-testid(라디오 묶음이면 체크된 칸). */
  readonly focus?: string;
};

function refocus(testid: string): void {
  if (typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    const node = document.querySelector<HTMLElement>(`.db-menu-system-studio [data-testid="${testid}"]`);
    if (!node) return;
    const target = node.matches("input,select,button") ? node : (node.querySelector<HTMLElement>("input:checked") ?? node.querySelector<HTMLElement>("input, button"));
    target?.focus();
  });
}

function commit(label: string, edit: MenuSystemEdit, rerender: () => void, options: CommitOptions = {}): void {
  try {
    validateMenuSystemEdit(edit);
  } catch (error) {
    lastRejection = describeMenuSystemError(error);
    lastNotices = [];
    lastFeedbackProject = store.getCurrent();
    rerender();
    return;
  }
  lastRejection = null;
  let notices: string[] = [];
  recordProjectSnapshot();
  store.update((draft) => {
    notices = applyMenuSystemEdit(draft, edit);
  }, { scope: "system", label });
  lastNotices = notices;
  lastFeedbackProject = store.getCurrent();
  rerender();
  if (options.focus) refocus(options.focus);
}

function authoredFlags(project: Project): { readonly menu: boolean; readonly dialogue: boolean; readonly vn: boolean; readonly look: boolean } {
  return {
    menu: project.meta.oprnFieldMenu !== undefined,
    dialogue: project.meta.oprnDialogueSystem !== undefined,
    vn: project.meta.oprnVnExtras !== undefined,
    look: project.meta.oprnVnLook !== undefined,
  };
}

function sourceHint(authored: boolean, relationship: boolean): string {
  if (authored) return "이 게임에서 직접 저작";
  return relationship ? "연애 기본 구성 사용 중" : "저작 없음 — 옛 동작 그대로";
}

function resetButton(label: string, testid: string, onClick: () => void): HTMLElement {
  return el("button", {
    class: "db-ws-btn db-ws-btn-ghost db-menu-system-reset",
    text: label,
    attrs: { type: "button" },
    dataset: { testid },
    on: { click: onClick },
  });
}

function issueFix(issue: MenuSystemIssue, project: Project, rerender: () => void): { readonly label: string; readonly testid: string; readonly onClick: () => void } | undefined {
  const dialogue = resolveDialogueSystem(project) ?? defaultDialogueSystem();
  const vn = resolveVnExtras(project) ?? defaultVnExtras();
  const menu = fieldMenu(project);
  switch (issue.id) {
    case "backlog-entry-off":
    case "savecard-no-backlog":
      return { label: "백로그 켜기", testid: `db-menu-system-fix-${issue.id}`, onClick: () => commit("대사창 편집", { dialogue: mergeDialogueSystem(dialogue, { backlog: true }) }, rerender) };
    case "backlog-on-no-entry":
      return menu ? { label: "메뉴에 추가", testid: `db-menu-system-fix-${issue.id}`, onClick: () => commit("메뉴 편집", { menu: menuWithEntry(menu, "backlog") }, rerender) } : undefined;
    case "gallery-entry-off":
      return { label: "갤러리 켜기", testid: `db-menu-system-fix-${issue.id}`, onClick: () => commit("갤러리 편집", { vn: mergeVnExtras(vn, { gallery: true }) }, rerender) };
    case "endings-entry-off":
      return { label: "엔딩 목록 켜기", testid: `db-menu-system-fix-${issue.id}`, onClick: () => commit("엔딩 목록 편집", { vn: mergeVnExtras(vn, { endings: true }) }, rerender) };
    case "gallery-on-no-entry":
      return menu ? { label: "메뉴에 추가", testid: `db-menu-system-fix-${issue.id}`, onClick: () => commit("메뉴 편집", { menu: menuWithEntry(menu, "gallery") }, rerender) } : undefined;
    case "endings-on-no-entry":
      return menu ? { label: "메뉴에 추가", testid: `db-menu-system-fix-${issue.id}`, onClick: () => commit("메뉴 편집", { menu: menuWithEntry(menu, "endings") }, rerender) } : undefined;
    default:
      return undefined;
  }
}

function issuesBlock(project: Project, rerender: () => void): HTMLElement | null {
  const issues = menuSystemIssues(project);
  if (issues.length === 0) return null;
  return el("div", {
    class: "db-menu-system-issues",
    dataset: { testid: "db-menu-system-issues" },
    children: issues.map((issue) => {
      const fix = issueFix(issue, project, rerender);
      return noticeBar({ text: issue.ui, tone: CONTENT_ISSUES.has(issue.id) ? "info" : "warn", testid: `db-menu-system-issue-${issue.id}`, ...(fix ? { action: { label: fix.label, testid: fix.testid, onClick: fix.onClick } } : {}) });
    }),
  });
}

/**
 * 범위가 있는 숫자 칸 — 입력 중에는 건드리지 않고 칸을 떠날 때(change: Enter·blur) 한 번만 범위로 맞춰 저장한다.
 * 공용 numberField 는 키를 칠 때마다 클램프해서 최솟값이 큰 칸(백로그 20~500)에 「250」을 치면 「2」가 곧바로 20 이 되어 500 에 닿는다.
 */
function boundedNumber(
  label: string,
  testid: string,
  value: number,
  bounds: { readonly min: number; readonly max: number; readonly step: number },
  onCommit: (value: number) => void,
  options: { readonly disabledReason?: string } = {}
): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: String(bounds.min), max: String(bounds.max), step: String(bounds.step), "aria-label": label, title: `${bounds.min}~${bounds.max}`, ...(options.disabledReason ? { disabled: "true" } : {}) },
    dataset: { testid },
    value,
  });
  input.addEventListener("change", () => {
    const raw = Number(input.value);
    const next = input.value === "" || !Number.isFinite(raw) ? value : Math.min(bounds.max, Math.max(bounds.min, raw));
    input.value = String(next);
    if (next !== value) onCommit(next);
  });
  const hint = el("span", { class: "db-menu-number-hint", text: options.disabledReason ?? `${bounds.min}~${bounds.max}` });
  return field(label, el("span", { class: "db-menu-number", children: [input, hint] }));
}

function entryRow(menu: AuthoredFieldMenu, index: number, rerender: () => void): HTMLElement {
  const entry = menu.entries[index]!;
  const isTitle = entry.command === "to-title";
  const input = el("input", {
    class: "db-menu-row-label",
    attrs: { type: "text", maxlength: "12", "aria-label": `${FIELD_MENU_DEFAULT_LABELS[entry.command]} 항목 이름`, title: "플레이 화면에 보이는 이름(1~12자)" },
    dataset: { testid: `db-menu-system-label-${entry.command}` },
    value: entry.label,
  });
  input.addEventListener("change", () => {
    if (input.value === entry.label) return;
    commit("메뉴 이름 편집", { menu: menuWithLabel(menu, entry.command, input.value) }, rerender);
  });
  const small = (text: string, testid: string, disabled: boolean, onClick: () => void, title: string): HTMLElement => el("button", {
    class: "db-menu-row-button",
    text,
    attrs: { type: "button", "aria-label": title, title, ...(disabled ? { disabled: "true" } : {}) },
    dataset: { testid },
    on: { click: onClick },
  });
  const lastMovable = menu.entries[menu.entries.length - 1]?.command === "to-title" ? menu.entries.length - 2 : menu.entries.length - 1;
  return el("li", {
    class: "db-menu-row",
    dataset: { testid: `db-menu-system-row-${entry.command}`, command: entry.command },
    children: [
      el("span", { class: "db-menu-row-index", text: String(index + 1) }),
      input,
      el("span", { class: "db-menu-row-help", text: FIELD_MENU_COMMAND_HELP[entry.command] }),
      small("▲", `db-menu-system-up-${entry.command}`, isTitle || index === 0, () => commit("메뉴 순서 편집", { menu: menuWithMove(menu, entry.command, -1) }, rerender), `${entry.label} 위로`),
      small("▼", `db-menu-system-down-${entry.command}`, isTitle || index >= lastMovable, () => commit("메뉴 순서 편집", { menu: menuWithMove(menu, entry.command, 1) }, rerender), `${entry.label} 아래로`),
      small("✕", `db-menu-system-remove-${entry.command}`, menu.entries.length <= 1, () => commit("메뉴 항목 삭제", { menu: menuWithoutEntry(menu, entry.command) }, rerender), `${entry.label} 항목 빼기`),
    ],
  });
}

function starterButtons(rerender: () => void): HTMLElement {
  const make = (starter: MenuStarter, label: string): HTMLElement => el("button", {
    class: "db-ws-btn",
    text: label,
    attrs: { type: "button" },
    dataset: { testid: `db-menu-system-starter-${starter}` },
    on: { click: () => commit("메뉴 편집", { menu: MENU_STARTERS[starter]() }, rerender) },
  });
  return el("div", {
    class: "db-menu-system-starters",
    children: [
      make("custom", "기본 항목으로 직접 꾸미기"),
      make("romance", "연애 메뉴로 시작"),
      make("collector", "몬스터 수집 메뉴로 시작"),
    ],
  });
}

function menuCard(project: Project, rerender: () => void): HTMLElement {
  const menu = fieldMenu(project);
  const authored = project.meta.oprnFieldMenu !== undefined;
  const relationship = usesRelationshipMenu(project);
  const children: HTMLElement[] = [];
  if (!menu) {
    children.push(
      el("p", { class: "db-menu-system-lead", dataset: { testid: "db-menu-system-menu-legacy" }, text: "지금은 기본 ESC 메뉴(행동·파티·기록·시스템 묶음)를 씁니다. 항목을 고르고 싶으면 시작점을 고르세요. 한 번 꾸미면 플레이어에게 이 목록이 그대로 나옵니다." }),
      starterButtons(rerender),
    );
  } else {
    const rows = el("ol", { class: "db-menu-rows", dataset: { testid: "db-menu-system-rows" }, children: menu.entries.map((_, index) => entryRow(menu, index, rerender)) });
    const addable = menuAddableCommands(menu).filter((command) => command !== "to-title" || !menu.entries.some((entry) => entry.command === "to-title"));
    const full = menu.entries.length >= MENU_MAX_ENTRIES;
    const select = el("select", {
      attrs: { "aria-label": "메뉴에 넣을 항목", ...(full ? { disabled: "true", title: `메뉴는 ${MENU_MAX_ENTRIES}개까지 넣을 수 있습니다` } : {}) },
      dataset: { testid: "db-menu-system-add-select" },
      children: addable.map((command) => el("option", { text: `${FIELD_MENU_DEFAULT_LABELS[command]} — ${FIELD_MENU_COMMAND_HELP[command]}`, attrs: { value: command } })),
    });
    const add = el("button", {
      class: "db-ws-btn",
      text: "추가",
      attrs: { type: "button", ...(full || addable.length === 0 ? { disabled: "true" } : {}) },
      dataset: { testid: "db-menu-system-add" },
      on: { click: () => commit("메뉴 항목 추가", { menu: menuWithEntry(menu, select.value as FieldMenuCommand) }, rerender) },
    });
    children.push(
      el("p", { class: "db-menu-system-lead", text: `플레이 중 ESC 로 여는 메뉴입니다(${menu.entries.length}/${MENU_MAX_ENTRIES}). 위에서부터 이 순서로 나오고, 「타이틀로」는 항상 맨 끝입니다. 갤러리·엔딩·백로그는 해당 기능이 켜져 있을 때만 실제로 보입니다.` }),
      rows,
      el("div", { class: "db-menu-add-row", children: [el("span", { class: "db-menu-add-caption", text: "항목 추가" }), select, add] }),
      el("div", {
        class: "db-menu-system-starters",
        children: [
          resetButton(relationship ? "연애 기본 메뉴로 되돌리기" : "기본 메뉴로 되돌리기(저작 지우기)", "db-menu-system-menu-reset", () => commit("메뉴 편집", { menu: null }, rerender)),
        ],
      }),
    );
    if (!authored) {
      children.splice(1, 0, noticeBar({ text: "아직 직접 저작한 메뉴가 없어 연애 기본 메뉴를 보여 주고 있습니다. 이름·순서를 바꾸거나 항목을 빼면 이 게임만의 메뉴가 됩니다.", tone: "info", testid: "db-menu-system-menu-default-note" }));
    }
  }
  return sectionCard({ title: "ESC 메뉴", hint: sourceHint(authored, relationship && menu !== undefined), testid: "db-menu-system-menu-card", children });
}

/** 대사창 위치 규칙 한 줄 — 위·가운데는 저장할 수 있지만 흉상이 있는 대사는 항상 아래로 나온다. */
function portraitBottomNote(): HTMLElement {
  return el("p", { class: "db-menu-system-lead db-menu-system-portrait-note", dataset: { testid: "db-menu-system-portrait-bottom-note" }, text: PORTRAIT_BOTTOM_NOTICE });
}

function dialogueCard(project: Project, rerender: () => void): HTMLElement {
  const resolved = resolveDialogueSystem(project);
  const current = resolved ?? defaultDialogueSystem();
  const authored = project.meta.oprnDialogueSystem !== undefined;
  const relationship = usesRelationshipMenu(project);
  const patchWith = (patch: DialogueSystemPatch, options?: CommitOptions): void => commit("대사창 편집", { dialogue: mergeDialogueSystem(current, patch) }, rerender, options);
  const patchDefaults = (defaults: NonNullable<DialogueSystemPatch["defaults"]>, options?: CommitOptions): void => patchWith({ defaults }, options);
  const backlogOff = !current.backlog.enabled;
  const toggles = el("div", {
    class: "db-menu-system-toggles",
    children: [
      toggleSwitch("백로그(지난 대사 다시 읽기)", "db-menu-system-backlog", current.backlog.enabled, (checked) => patchWith({ backlog: checked }, { focus: "db-menu-system-backlog" })),
      toggleSwitch("오토(자동 진행)", "db-menu-system-auto", current.auto.enabled, (checked) => patchWith({ auto: checked }, { focus: "db-menu-system-auto" })),
      toggleSwitch("스킵(빨리 넘기기)", "db-menu-system-skip", current.skip.enabled, (checked) => patchWith({ skip: checked }, { focus: "db-menu-system-skip" })),
      toggleSwitch("숨기기(대사창 가리기)", "db-menu-system-hide", current.hideButton.enabled, (checked) => patchWith({ hideButton: checked }, { focus: "db-menu-system-hide" })),
    ],
  });
  const grid = el("div", {
    class: "db-menu-system-grid",
    children: [
      boundedNumber("백로그 줄 수", "db-menu-system-backlog-limit", current.backlog.limit, { min: BACKLOG_LIMIT_MIN, max: BACKLOG_LIMIT_MAX, step: 10 }, (value) => patchWith({ backlogLimit: Math.round(value) }, { focus: "db-menu-system-backlog-limit" }), backlogOff ? { disabledReason: "백로그가 꺼져 있어 쓰이지 않습니다" } : {}),
      boundedNumber("대사창 불투명도", "db-menu-system-opacity", current.defaults.windowOpacity, { min: WINDOW_OPACITY_MIN, max: WINDOW_OPACITY_MAX, step: 0.05 }, (value) => patchDefaults({ windowOpacity: Math.round(value * 100) / 100 }, { focus: "db-menu-system-opacity" })),
      segmentedControl("기본 대사 속도", "db-menu-system-text-speed", current.defaults.textSpeed, SPEED_OPTIONS, (value) => patchDefaults({ textSpeed: value as DialogueSpeed }, { focus: "db-menu-system-text-speed" })),
      segmentedControl("기본 오토 속도", "db-menu-system-auto-speed", current.defaults.autoSpeed, SPEED_OPTIONS, (value) => patchDefaults({ autoSpeed: value as DialogueSpeed }, { focus: "db-menu-system-auto-speed" })),
      segmentedControl("스킵 범위", "db-menu-system-skip-scope", current.defaults.skipScope, SKIP_OPTIONS, (value) => patchDefaults({ skipScope: value as SkipScope }, { focus: "db-menu-system-skip-scope" })),
      selectField("단추·패널 글자 언어", "db-menu-system-language", current.language, DIALOGUE_UI_LANGUAGES.map((id) => ({ id, name: LANGUAGE_NAMES[id] })), (value) => patchWith({ language: value as DialogueSystemPatch["language"] }, { focus: "db-menu-system-language" })),
    ],
  });
  const children: HTMLElement[] = [
    el("p", { class: "db-menu-system-lead", text: "대사창 아래 단추와 단축키(L 백로그 · A 오토 · S 스킵 · H 숨기기)입니다. 속도·스킵 범위·불투명도는 플레이어가 아직 정하지 않았을 때의 시작값이고, 플레이어는 설정에서 바꿀 수 있습니다. 스킵은 선택지·엔딩·넘기기 금지 글에서 항상 멈춥니다." }),
    portraitBottomNote(),
    toggles,
    grid,
  ];
  if (authored) {
    children.push(resetButton(relationship ? "연애 기본 구성으로 되돌리기" : "저작 지우기(옛 동작으로)", "db-menu-system-dialogue-reset", () => commit("대사창 편집", { dialogue: null }, rerender)));
  }
  return sectionCard({ title: "대사창", hint: sourceHint(authored, relationship && resolved !== undefined), testid: "db-menu-system-dialogue-card", children });
}

function lookCard(project: Project, rerender: () => void): HTMLElement {
  const resolved = resolveVnLook(project);
  const authored = project.meta.oprnVnLook !== undefined;
  const relationship = usesRelationshipMenu(project);
  const base: AuthoredVnLook | undefined = project.meta.oprnVnLook ?? (resolved ? { version: 1, preset: resolved.preset } : undefined);
  const patchWith = (patch: VnLookPatch, focus: string): void => commit("대사창 룩 편집", { look: mergeVnLook(base, patch) }, rerender, { focus });
  const presetDef = VN_PRESETS[resolved?.preset ?? "bar-tab"];
  const optional = <T extends string>(names: Readonly<Record<T, string>>, ids: readonly T[], presetValue: T): readonly { readonly id: string; readonly name: string }[] => [
    { id: LOOK_PRESET_DEFAULT, name: `프리셋 기본(${names[presetValue]})` },
    ...ids.map((id) => ({ id, name: names[id] })),
  ];
  const authoredValue = <T extends string>(key: keyof AuthoredVnLook): T | typeof LOOK_PRESET_DEFAULT => (base?.[key] as T | undefined) ?? LOOK_PRESET_DEFAULT;
  const children: HTMLElement[] = [
    el("p", { class: "db-menu-system-lead", text: "대사창·ESC 메뉴·저장 화면의 모양(색·모서리·이름표·선택지)을 프리셋 하나로 고릅니다. 연애 게임은 소재(캠퍼스·카페·회사·바닷가·학원)에 맞는 룩이 처음부터 적용되어 있고, 다른 장르는 고르기 전까지 옛 대사창 그대로입니다." }),
    portraitBottomNote(),
  ];
  if (!resolved) {
    children.push(
      el("p", { class: "db-menu-system-lead", dataset: { testid: "db-menu-system-look-legacy" }, text: "지금은 옛 대사창을 씁니다. 프리셋을 고르면 이 게임의 대사창 룩이 됩니다." }),
      selectField("대사창 룩", "db-menu-system-look-preset", LOOK_LEGACY_OPTION, [{ id: LOOK_LEGACY_OPTION, name: "옛 대사창(기본)" }, ...VN_PRESET_IDS.map((id) => ({ id, name: VN_PRESETS[id].label }))], (value) => {
        if (value !== LOOK_LEGACY_OPTION) commit("대사창 룩 편집", { look: mergeVnLook(undefined, { preset: value as VnPresetId }) }, rerender, { focus: "db-menu-system-look-preset" });
      }),
    );
    return sectionCard({ title: "대사창 룩", hint: sourceHint(false, false), testid: "db-menu-system-look-card", children });
  }
  children.push(
    el("div", {
      class: "db-menu-system-grid db-menu-system-look-grid",
      children: [
        selectField("프리셋", "db-menu-system-look-preset", resolved.preset, VN_PRESET_IDS.map((id) => ({ id, name: VN_PRESETS[id].label })), (value) => patchWith({ preset: value as VnPresetId }, "db-menu-system-look-preset")),
        field("이 프리셋은", el("span", { class: "db-menu-system-counts db-menu-system-look-fit", dataset: { testid: "db-menu-system-look-fit" }, text: `${presetDef.description} (어울리는 곳: ${presetDef.fit})` })),
        selectField("이름표 모양", "db-menu-system-look-nameplate", authoredValue("nameplate"), optional(LOOK_NAMEPLATE_NAMES, VN_NAMEPLATES, presetDef.nameplate), (value) => patchWith({ nameplate: value as VnLookPatch["nameplate"] }, "db-menu-system-look-nameplate")),
        selectField("선택지 모양", "db-menu-system-look-choice", authoredValue("choiceStyle"), optional(LOOK_CHOICE_NAMES, VN_CHOICE_STYLES, presetDef.choiceStyle), (value) => patchWith({ choiceStyle: value as VnLookPatch["choiceStyle"] }, "db-menu-system-look-choice")),
        selectField("다음 글 표시", "db-menu-system-look-wait", authoredValue("waitIcon"), optional(LOOK_WAIT_NAMES, VN_WAIT_ICONS, presetDef.waitIcon), (value) => patchWith({ waitIcon: value as VnLookPatch["waitIcon"] }, "db-menu-system-look-wait")),
        segmentedControl("글자 크기", "db-menu-system-look-font", resolved.fontScale, VN_FONT_SCALES.map((id) => ({ id, name: LOOK_SIZE_NAMES[id] })), (value) => patchWith({ fontScale: value as VnLookPatch["fontScale"] }, "db-menu-system-look-font")),
        segmentedControl("줄 간격", "db-menu-system-look-line", resolved.lineSpacing, VN_LINE_SPACINGS.map((id) => ({ id, name: LOOK_SPACING_NAMES[id] })), (value) => patchWith({ lineSpacing: value as VnLookPatch["lineSpacing"] }, "db-menu-system-look-line")),
        segmentedControl("글자 간격", "db-menu-system-look-letter", resolved.letterSpacing, VN_LETTER_SPACINGS.map((id) => ({ id, name: LOOK_LETTER_NAMES[id] })), (value) => patchWith({ letterSpacing: value as VnLookPatch["letterSpacing"] }, "db-menu-system-look-letter")),
        segmentedControl("초상 등장", "db-menu-system-look-entrance", resolved.portraitEntrance, VN_PORTRAIT_ENTRANCES.map((id) => ({ id, name: LOOK_ENTRANCE_NAMES[id] })), (value) => patchWith({ portraitEntrance: value as VnLookPatch["portraitEntrance"] }, "db-menu-system-look-entrance")),
        segmentedControl("ESC 메뉴·저장 화면 색", "db-menu-system-look-ui-theme", resolved.uiTheme, VN_UI_THEMES.map((id) => ({ id, name: LOOK_UI_THEME_NAMES[id] })), (value) => patchWith({ uiTheme: value as VnLookPatch["uiTheme"] }, "db-menu-system-look-ui-theme")),
      ],
    }),
    el("div", { class: "db-menu-system-toggles", children: [toggleSwitch("읽은 글을 옅은 색으로 구분", "db-menu-system-look-read-color", resolved.readColor, (checked) => patchWith({ readColor: checked }, "db-menu-system-look-read-color"))] }),
  );
  if (authored) {
    children.push(resetButton(relationship ? "소재별 기본 룩으로 되돌리기" : "저작 지우기(옛 대사창으로)", "db-menu-system-look-reset", () => commit("대사창 룩 편집", { look: null }, rerender)));
  } else {
    children.push(noticeBar({ text: "아직 직접 고른 룩이 없어 소재에 맞는 기본 룩을 보여 주고 있습니다. 아무 칸이나 바꾸면 이 게임만의 룩이 됩니다.", tone: "info", testid: "db-menu-system-look-default-note" }));
  }
  return sectionCard({ title: "대사창 룩", hint: sourceHint(authored, relationship && resolved !== undefined), testid: "db-menu-system-look-card", children });
}

function extrasCard(project: Project, rerender: () => void): HTMLElement {
  const resolved = resolveVnExtras(project);
  const current = resolved ?? defaultVnExtras();
  const authored = project.meta.oprnVnExtras !== undefined;
  const relationship = usesRelationshipMenu(project);
  const patchWith = (patch: VnExtrasPatch, focus: string): void => commit("갤러리·엔딩 편집", { vn: mergeVnExtras(current, patch) }, rerender, { focus });
  const slots = listGallerySlots(project).length;
  const endingRows = listEndingRows(project, undefined).length;
  const galleryOff = !current.gallery.enabled;
  const endingsOff = !current.endings.enabled;
  const inherit = current.language ?? "inherit";
  const children: HTMLElement[] = [
    el("p", { class: "db-menu-system-lead", text: "새 그림은 만들지 않습니다. 이미 있는 「갤러리에 기록」 그림, 엔딩 정의, 저장 칸을 읽어 보여 줄 뿐입니다. 한 번 본 엔딩과 한 번 연 그림은 저장 칸이 아니라 이 기기에 남아, 다른 저장 칸·새 게임·옛 저장을 불러온 뒤에도 그대로 열려 있습니다." }),
    el("div", {
      class: "db-menu-system-toggles",
      children: [
        toggleSwitch("갤러리", "db-menu-system-gallery", current.gallery.enabled, (checked) => patchWith({ gallery: checked }, "db-menu-system-gallery")),
        toggleSwitch("안 연 그림 칸을 「잠김」으로 보이기", "db-menu-system-gallery-locked", current.gallery.showLocked, (checked) => patchWith({ galleryShowLocked: checked }, "db-menu-system-gallery-locked")),
        toggleSwitch("엔딩 목록", "db-menu-system-endings", current.endings.enabled, (checked) => patchWith({ endings: checked }, "db-menu-system-endings")),
        toggleSwitch("못 본 엔딩 이름을 ???로 가리기", "db-menu-system-endings-hide", current.endings.hideUnseen, (checked) => patchWith({ endingsHideUnseen: checked }, "db-menu-system-endings-hide")),
        toggleSwitch("저장 카드(날짜 + 마지막 대사 한 줄)", "db-menu-system-savecards", current.saveCards.enabled, (checked) => patchWith({ saveCards: checked }, "db-menu-system-savecards")),
      ],
    }),
    el("div", {
      class: "db-menu-system-grid",
      children: [
        selectField("갤러리·엔딩 글자 언어", "db-menu-system-vn-language", inherit, [{ id: "inherit", name: "대사창 언어를 따름" }, ...DIALOGUE_UI_LANGUAGES.map((id) => ({ id, name: LANGUAGE_NAMES[id] }))], (value) => patchWith({ language: value as VnExtrasPatch["language"] }, "db-menu-system-vn-language")),
        field("지금 게임의 그림 칸 · 엔딩", el("span", {
          class: "db-menu-system-counts",
          dataset: { testid: "db-menu-system-counts" },
          text: `갤러리 그림 칸 ${slots}개${galleryOff ? "(꺼짐)" : ""} · 엔딩 ${endingRows}개${endingsOff ? "(꺼짐)" : ""}`,
        })),
      ],
    }),
  ];
  if (authored) {
    children.push(resetButton(relationship ? "연애 기본 구성으로 되돌리기" : "저작 지우기(옛 동작으로)", "db-menu-system-vn-reset", () => commit("갤러리·엔딩 편집", { vn: null }, rerender)));
  }
  return sectionCard({ title: "갤러리 · 엔딩 목록 · 저장 카드", hint: sourceHint(authored, relationship && resolved !== undefined), testid: "db-menu-system-extras-card", children });
}

function introLine(project: Project): HTMLElement {
  const relationship = usesRelationshipMenu(project);
  const flags = authoredFlags(project);
  const anyAuthored = flags.menu || flags.dialogue || flags.vn || flags.look;
  const status = anyAuthored
    ? "이 게임에서 일부 또는 전부를 직접 저작했습니다."
    : relationship
      ? "연애 게임이라 아래 값이 처음부터 켜져 있습니다. 바꾸면 이 게임만의 설정이 됩니다."
      : "아직 아무것도 켜지 않았습니다. 지금은 옛 메뉴·옛 대사창 그대로이고, 필요한 칸만 켜면 됩니다.";
  return el("p", {
    class: "db-menu-system-intro",
    dataset: { testid: "db-menu-system-intro" },
    children: [
      el("span", { text: "플레이 중 ESC 메뉴에 무엇이 나오는지, 대사창에 어떤 읽기 도구가 붙는지, 갤러리·엔딩 목록·저장 칸에 무엇을 보일지 한 곳에서 정합니다. " }),
      el("strong", { dataset: { testid: "db-menu-system-status" }, text: status }),
    ],
  });
}

export function renderMenuSystemTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const rerender = (): void => {
    host.replaceChildren();
    renderMenuSystemTab(host);
  };
  const form = el("section", {
    class: "db-detail-form db-parity-form db-battle-studio-surface db-menu-system-studio db-ws-studio",
    dataset: { testid: "db-detail-form" },
  });
  const heading = el("header", {
    class: "db-battle-studio-heading",
    children: [
      el("div", {
        class: "db-battle-studio-title-block",
        children: [el("h3", { text: "메뉴·시스템" }), introLine(project)],
      }),
    ],
  });
  const stack = el("div", { class: "db-menu-system-stack" });
  const feedback = liveFeedback();
  if (feedback.rejection) {
    stack.append(noticeBar({ text: `저장하지 않았습니다 — ${feedback.rejection}`, tone: "bad", testid: "db-menu-system-rejection" }));
  }
  if (feedback.notices.length > 0) {
    stack.append(noticeBar({ text: `함께 바꾼 것: ${feedback.notices.join("; ")}.`, tone: "info", testid: "db-menu-system-notices" }));
  }
  const issues = issuesBlock(project, rerender);
  if (issues) stack.append(issues);
  stack.append(menuCard(project, rerender), dialogueCard(project, rerender), lookCard(project, rerender), extrasCard(project, rerender));
  form.append(heading, stack);
  host.append(form);
}
