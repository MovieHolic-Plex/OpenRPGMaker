// start/settings/settingsDialog.ts
// 첫 화면 「설정」 — AI 엔진·모델 · 일반·언어 · 정보. 레일의 「설정」과 AI 상태 줄이 연다(필요할 때만 받는 모듈).
//
// 쓰는 사람은 개발자가 아니다: 낱말은 「이 PC 의 AI 프로그램」「로그인」「연결 시험」. 「API 키」는 「고급」 안에만 둔다.
// 엔진은 자동으로 찾아 기본값을 고른다(연결된 첫 프로그램). OPRN 은 로그인 정보를 읽거나 저장하지 않는다 —
// 각 프로그램이 스스로 로그인한 상태를 쓴다. 감지·연결 시험은 ./localAgents(PR #3072 백엔드의 얼굴)가 맡는다.
import "./settings.css";
import { el } from "@/util/dom";
import { getLocale, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, t, type SupportedLocale } from "@/i18n";
import { APP_VERSION } from "@/brand";
import {
  costLine, createLocalAgentsApi, loadEngineChoice, localAgentsEnabled, saveEngineChoice,
  type AssistantEngineChoice, type HealthResult, type LocalAgentsReport, type LocalCliId, type LocalCliStatus,
} from "./localAgents";

export type SettingsTab = "ai" | "general" | "about";

export const SETTINGS_TESTIDS = {
  dialog: "start-settings",
  tab: "start-settings-tab",
  engine: "start-settings-engine",
  test: "start-settings-test",
  close: "start-settings-close",
  locale: "start-locale-select",
  advanced: "start-settings-advanced",
} as const;

type Effort = "low" | "medium" | "high";

/** 엔진 카드에 늘 보이는 네 자리. 감지 결과가 없으면(깃발 꺼짐·백엔드 없음) 「확인 전」으로 그린다. */
const ENGINE_ORDER: readonly LocalCliId[] = ["claude", "codex", "gemini"];
const ENGINE_LABEL: Readonly<Record<LocalCliId, string>> = { claude: "Claude Code", codex: "Codex", gemini: "Gemini CLI" };

function stateDot(state: LocalCliStatus["state"] | "unknown"): HTMLElement {
  const tone = state === "ready" ? "ok" : state === "login-required" ? "warn" : state === "error" ? "bad" : "off";
  return el("span", { class: `st-dot is-${tone}`, attrs: { "aria-hidden": "true" } });
}

/** 상태 한 줄 — 경우마다 통째 문장(번역 카탈로그가 문장 단위로 찾는다). */
/** 상태 글자는 백엔드가 준 stateLabel(연결됨 / 로그인 필요 / 설치 필요 / 확인 실패)을 그대로 쓴다. */
function engineStateText(row: LocalCliStatus | null): string {
  if (!row) return "아직 확인하지 않았어요";
  return row.stateLabel;
}

export function openSettingsDialog(options: {
  readonly tab?: SettingsTab;
  /** 엔진 선택·감지가 바뀌면 레일 AI 상태 줄을 다시 그린다. */
  readonly onEngineChange?: (summary: AiStatusSummary) => void;
} = {}): { close(): void } {
  const enabled = localAgentsEnabled();
  const api = enabled ? createLocalAgentsApi() : null;
  let report: LocalAgentsReport | null = null;
  let detecting = false;
  let detectFailed = false;
  let choice: AssistantEngineChoice | null = loadEngineChoice();
  let split = Boolean(choice?.deepModel && choice.deepModel !== choice.routineModel);
  const health = new Map<string, HealthResult | "running">();
  let lastTestAt: number | null = null;
  let tab: SettingsTab = options.tab ?? "ai";

  const previousFocus = document.activeElement as HTMLElement | null;
  const pane = el("div", { class: "st-pane" });
  const tabButtons = new Map<SettingsTab, HTMLButtonElement>();
  const TABS: readonly (readonly [SettingsTab, string])[] = [["ai", "AI 엔진·모델"], ["general", "일반·언어"], ["about", "정보"]];
  const tabs = el("nav", { class: "st-tabs", attrs: { role: "tablist", "aria-label": "설정" }, children: [
    el("h2", { class: "st-title", text: "설정" }),
    ...TABS.map(([id, label]) => {
      const button = el("button", {
        class: "st-tab", attrs: { type: "button", role: "tab" }, dataset: { testid: `${SETTINGS_TESTIDS.tab}-${id}` }, text: label,
        on: { click: () => { tab = id; render(); } },
      });
      tabButtons.set(id, button);
      return button;
    }),
  ] });
  const closeButton = el("button", { class: "st-btn st-btn-ghost", attrs: { type: "button" }, dataset: { testid: SETTINGS_TESTIDS.close }, text: "닫기", on: { click: () => close() } });
  const dialog = el("div", {
    class: "st-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "설정" }, dataset: { testid: SETTINGS_TESTIDS.dialog },
    children: [tabs, pane],
  });
  const backdrop = el("div", { class: "st-backdrop", children: [dialog], on: { mousedown: (event) => { if (event.target === backdrop) close(); } } });

  const rowFor = (id: LocalCliId): LocalCliStatus | null => report?.clis.find((row) => row.id === id) ?? null;
  const selected = (): LocalCliId | null => choice?.cli ?? null;
  const readySelected = (): LocalCliStatus | null => { const id = selected(); const row = id ? rowFor(id) : null; return row?.state === "ready" ? row : null; };

  const notify = (): void => options.onEngineChange?.(summarizeAiStatus(choice, report));

  const choose = (id: LocalCliId): void => {
    const row = rowFor(id);
    if (!row || row.state !== "ready") return;
    choice = { kind: "local-cli", cli: id, ...(row.defaults.routine ? { routineModel: row.defaults.routine } : {}), ...(row.defaults.deep ? { deepModel: row.defaults.deep } : {}), effort: choice?.effort ?? "medium" };
    split = false;
    saveEngineChoice(choice);
    notify();
    render();
  };

  const updateChoice = (patch: Partial<AssistantEngineChoice>): void => {
    if (!choice) return;
    choice = { ...choice, ...patch };
    if (!split) choice = { ...choice, deepModel: choice.routineModel };
    saveEngineChoice(choice);
    notify();
    render();
  };

  const detect = async (fresh: boolean): Promise<void> => {
    if (!api || detecting) return;
    detecting = true;
    detectFailed = false;
    render();
    try {
      report = await api.detect(fresh);
      // 고르는 건 사용자다(#3072 D1: 동등성 입증 전에는 opt-in — 기본은 지금 엔진). 백엔드 추천은 카드에 「추천」으로만 보인다.
    } catch {
      detectFailed = true;
    } finally {
      detecting = false;
      notify();
      render();
    }
  };

  const runTest = async (): Promise<void> => {
    const row = readySelected();
    if (!api || !row || !choice) return;
    const models = split ? [choice.routineModel, choice.deepModel] : [choice.routineModel];
    for (const model of models) health.set(model ?? "", "running");
    render();
    // 연결 시험은 프로그램 하나에 한 번(아주 짧은 「OK」 왕복) — 역할 줄은 같은 결과를 보인다.
    let result: HealthResult;
    try { result = await api.health(row.id); }
    catch (error) { result = { ok: false, ms: 0, problem: error instanceof Error ? error.message : String(error) }; }
    for (const model of models) health.set(model ?? "", result);
    lastTestAt = Date.now();
    render();
  };

  // ── AI 엔진·모델 ────────────────────────────────────────────────────
  const engineCard = (id: LocalCliId): HTMLElement => {
    const row = rowFor(id);
    const on = selected() === id && row?.state === "ready";
    const recommended = !choice && report?.recommended === id && row?.state === "ready";
    const state = row?.state ?? "unknown";
    const lines: (HTMLElement | string)[] = [el("span", { class: "st-eng-state", text: engineStateText(row) })];
    if (row?.state === "ready") {
      if (row.version) lines.push(el("code", { text: row.version, attrs: { translate: "no" } }));
      if (row.authMethod) lines.push(el("span", { class: "st-eng-sub", text: t("로그인 방식: {0}").replace("{0}", row.authMethod) }));
    } else if (row?.state === "login-required") {
      lines.push(el("span", { class: "st-eng-sub", text: "터미널에서 아래 명령으로 로그인한 뒤 「다시 확인」을 눌러 주세요." }));
      if (row.login.command) lines.push(copyCommand(row.login.command));
    } else if (row?.state === "not-installed") {
      if (row.install.url) lines.push(el("a", { class: "st-link", attrs: { href: row.install.url, target: "_blank", rel: "noopener" }, text: "설치 방법 보기 ↗" }));
    } else if (row?.state === "error") {
      lines.push(el("span", { class: "st-eng-sub", text: row.problem ?? "" , attrs: { translate: "no" } }));
    }
    return el("button", {
      class: "st-eng" + (on ? " is-on" : "") + (row?.state === "ready" ? "" : " is-idle"),
      attrs: { type: "button", "aria-pressed": String(on), ...(row?.state === "ready" ? {} : { "aria-disabled": "true" }) },
      dataset: { testid: `${SETTINGS_TESTIDS.engine}-${id}`, state },
      on: { click: () => choose(id) },
      children: [
        el("span", { class: "st-eng-name", children: [stateDot(state), el("b", { text: row?.label ?? ENGINE_LABEL[id], attrs: { translate: "no" } })] }),
        ...lines,
        ...(on ? [el("span", { class: "st-eng-use", text: "● 사용 중" })] : []),
        ...(recommended ? [el("span", { class: "st-eng-use", text: "추천 · 눌러서 쓰기" })] : []),
      ],
    });
  };

  const modelSelect = (row: LocalCliStatus, value: string | undefined, onPick: (model: string) => void): HTMLElement => {
    const select = el("select", { class: "st-select", attrs: { "aria-label": "모델" } });
    select.append(el("option", { text: "프로그램 기본값", attrs: { value: "" } }));
    for (const model of row.models) select.append(el("option", { text: model.label, attrs: { value: model.id, translate: "no" } }));
    select.value = value && row.models.some((model) => model.id === value) ? value : "";
    select.addEventListener("change", () => onPick(select.value));
    return select;
  };

  const effortControl = (): HTMLElement => el("div", { class: "st-seg", attrs: { role: "radiogroup", "aria-label": "생각 깊이" }, children: (
    [["low", "낮음"], ["medium", "보통"], ["high", "높음"]] as const
  ).map(([value, label]) => el("button", {
    class: "st-seg-btn" + ((choice?.effort ?? "medium") === value ? " is-on" : ""),
    attrs: { type: "button", role: "radio", "aria-checked": String((choice?.effort ?? "medium") === value) },
    text: label,
    on: { click: () => updateChoice({ effort: value as Effort }) },
  })) });

  const healthCell = (model: string | undefined): HTMLElement => {
    const result = health.get(model ?? "");
    if (result === undefined) return el("span", { class: "st-faint", text: "—" });
    if (result === "running") return el("span", { class: "st-faint", text: "시험 중…" });
    if (result.ok) return el("span", { class: "st-ok", text: t("✓ {0}초").replace("{0}", (result.ms / 1000).toFixed(1)) });
    return el("span", { class: "st-warn", text: t("! {0}").replace("{0}", result.problem ?? "실패"), attrs: { title: result.problem ?? "" } });
  };

  const rolesTable = (): HTMLElement => {
    const row = readySelected();
    if (!row || !choice) {
      const anyReady = Boolean(report?.clis.some((item) => item.state === "ready"));
      return el("p", { class: "st-empty", text: enabled
        ? (anyReady ? "위에서 조수가 쓸 프로그램을 고르면 여기서 모델을 정할 수 있어요. 고르기 전에는 지금 쓰던 AI 연결 그대로예요." : "연결된 AI 프로그램이 없어요. 위에서 하나를 설치·로그인하면 여기서 모델을 고를 수 있어요.")
        : "이 PC 의 AI 프로그램을 찾는 기능은 곧 켜져요. 지금은 편집기 안 「AI 연결」을 써요." });
    }
    const routineRow = el("tr", { children: [
      el("td", { children: [el("b", { text: split ? "조수" : "모든 일" }), el("span", { class: "st-faint", text: split ? " · 대화·맵 짓기" : " · 대화·맵 짓기·그림·큰 계획" })] }),
      el("td", { children: [modelSelect(row, choice.routineModel, (model) => updateChoice({ routineModel: model || undefined }))] }),
      el("td", { children: [effortControl()] }),
      el("td", { children: [healthCell(choice.routineModel)] }),
    ] });
    const deepRow = split ? el("tr", { children: [
      el("td", { children: [el("b", { text: "그림·큰 계획" }), el("span", { class: "st-faint", text: " · 도트·설계" })] }),
      el("td", { children: [modelSelect(row, choice.deepModel, (model) => updateChoice({ deepModel: model || undefined }))] }),
      el("td"),
      el("td", { children: [healthCell(choice.deepModel)] }),
    ] }) : null;
    return el("div", { children: [
      el("table", { class: "st-roles", children: [
        el("thead", { children: [el("tr", { children: ["역할", "모델", "생각 깊이", "상태"].map((head) => el("th", { text: head })) })] }),
        el("tbody", { children: [routineRow, ...(deepRow ? [deepRow] : [])] }),
      ] }),
      el("button", {
        class: "st-link st-split", attrs: { type: "button", "aria-expanded": String(split) },
        text: split ? "한 모델로 합치기" : "역할별로 나누기",
        on: { click: () => { split = !split; if (!split && choice) updateChoice({ deepModel: choice.routineModel }); else render(); } },
      }),
    ] });
  };

  const renderAi = (): HTMLElement[] => {
    const row = readySelected();
    const status = !enabled ? null
      : detecting ? "찾는 중…"
      : detectFailed ? "AI 프로그램 목록을 읽지 못했어요. 앱을 다시 켜 보세요."
      : null;
    return [
      el("section", { class: "st-sec", children: [
        el("div", { class: "st-sec-head", children: [
          el("h3", { text: "AI 엔진" }),
          ...(enabled ? [el("button", { class: "st-link", attrs: { type: "button" }, text: "다시 확인", on: { click: () => void detect(true) } })] : []),
        ] }),
        el("p", { class: "st-sub", text: "조수는 이 PC 에 깔린 Claude Code · Codex · Gemini CLI 로 일해요. 로그인은 그 프로그램 안에서 직접 하고, OPRN 은 로그인 정보를 보거나 저장하지 않아요." }),
        ...(status ? [el("p", { class: "st-status", attrs: { role: "status" }, text: status })] : []),
        ...(!enabled ? [el("p", { class: "st-status", text: "이 PC 의 AI 프로그램을 찾는 기능은 곧 켜져요. 지금은 편집기 안 「AI 연결」을 써요." })] : []),
        el("div", { class: "st-engines", children: ENGINE_ORDER.map(engineCard) }),
      ] }),
      el("section", { class: "st-sec", children: [
        el("h3", { text: "모델" }),
        el("p", { class: "st-sub", text: "처음엔 한 모델이 모든 일을 해요. 그림·큰 계획만 더 좋은 모델로 돌리고 싶으면 나누세요." }),
        rolesTable(),
        ...(row ? [el("p", { class: "st-cost", text: costLine(row.billing) })] : []),
      ] }),
      el("details", { class: "st-advanced", dataset: { testid: SETTINGS_TESTIDS.advanced }, children: [
        el("summary", { text: "고급 — 자동으로 찾지 못했을 때만" }),
        el("dl", { children: [
          el("dt", { text: "API 키로 쓰기" }),
          el("dd", { text: "AI 프로그램 없이 Anthropic · OpenAI · Google AI Studio · OpenRouter 키를 쓸 수 있어요. 키는 이 PC 의 보안 저장소에만 남고 프로젝트 파일·팀·스토어로 나가지 않아요. 편집기의 「AI 연결 → API 키」에서 넣어요." }),
          el("dt", { text: "프로그램 위치" }),
          el("dd", { text: "자동 (PATH · ~/.local/bin · %APPDATA%/npm)", attrs: { translate: "no" } }),
          el("dt", { text: "요금" }),
          el("dd", { text: "구독으로 로그인했으면 따로 청구되지 않고 그 계정 한도를 써요. 쓴 양은 참고용 환산 금액으로만 보여요. API 키는 쓴 만큼 키 계정에 청구돼요." }),
        ] }),
      ] }),
      el("div", { class: "st-foot", children: [
        el("button", {
          class: "st-btn st-btn-primary", attrs: { type: "button", ...(row ? {} : { disabled: "" }) }, dataset: { testid: SETTINGS_TESTIDS.test },
          text: "연결 시험", on: { click: () => void runTest() },
        }),
        el("span", { class: "st-faint", text: lastTestAt ? "방금 시험했어요" : "짧은 요청 하나를 실제로 보내 봐요" }),
        ...(choice ? [el("button", {
          class: "st-link", attrs: { type: "button" }, dataset: { testid: "settings-engine-reset" }, text: "원래 AI 연결로 되돌리기",
          on: { click: () => { choice = null; split = false; health.clear(); saveEngineChoice(null); notify(); render(); } },
        })] : []),
        closeButton,
      ] }),
    ];
  };

  // ── 일반·언어 ──────────────────────────────────────────────────────
  const renderGeneral = (): HTMLElement[] => {
    const select = el("select", {
      class: "st-select st-locale", attrs: { "aria-label": "언어", translate: "no" }, dataset: { testid: SETTINGS_TESTIDS.locale },
      children: SUPPORTED_LOCALES.map((locale) => el("option", { text: LOCALE_NATIVE_NAMES[locale], attrs: { value: locale, lang: locale } })),
    });
    select.value = getLocale();
    select.addEventListener("change", () => void setLocale(select.value as SupportedLocale));
    return [
      el("section", { class: "st-sec", children: [
        el("h3", { text: "언어" }),
        el("p", { class: "st-sub", text: "편집기와 이 화면의 글자 언어예요. 만든 게임 안의 글자는 바뀌지 않아요." }),
        select,
      ] }),
      el("div", { class: "st-foot", children: [closeButton] }),
    ];
  };

  const renderAbout = (): HTMLElement[] => [
    el("section", { class: "st-sec", children: [
      el("h3", { text: "정보" }),
      el("p", { class: "st-sub", children: [el("b", { text: "OPRN Studio", attrs: { translate: "no" } }), " ", el("span", { text: APP_VERSION, attrs: { translate: "no" } })] }),
      el("p", { class: "st-sub", text: "편집기는 SUL, 게임 런타임은 MIT 라이선스예요. 만든 게임은 자유롭게 배포할 수 있어요." }),
      el("a", { class: "st-link", attrs: { href: "https://github.com/MovieHolic-Plex/OpenRPGMaker", target: "_blank", rel: "noopener" }, text: "소스 코드 ↗" }),
    ] }),
    el("section", { class: "st-sec", children: [
      el("h3", { text: "크레딧" }),
      el("p", { class: "st-sub", children: [
        el("b", { text: "general-good-writing", attrs: { translate: "no" } }),
        " — ",
        el("span", { text: "코드 연규(code-yeongyu)", attrs: { translate: "no" } }),
      ] }),
      el("p", { class: "st-sub", text: "AI 조수의 공식 윤문 규칙과 윤문 린터를 이 프로젝트에서 가져왔어요." }),
      el("a", { class: "st-link", attrs: { href: "https://github.com/code-yeongyu/general-good-writing", target: "_blank", rel: "noopener" }, text: "general-good-writing ↗" }),
    ] }),
    el("div", { class: "st-foot", children: [closeButton] }),
  ];

  function render(): void {
    for (const [id, button] of tabButtons) {
      button.setAttribute("aria-selected", String(id === tab));
      button.classList.toggle("is-on", id === tab);
    }
    pane.replaceChildren(...(tab === "ai" ? renderAi() : tab === "general" ? renderGeneral() : renderAbout()));
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
  };
  function close(): void {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
    previousFocus?.focus?.();
  }

  document.addEventListener("keydown", onKey, true);
  document.body.append(backdrop);
  render();
  tabButtons.get(tab)?.focus();
  if (enabled) void detect(false);
  return { close };
}

function copyCommand(command: string): HTMLElement {
  const button = el("button", { class: "st-copy", attrs: { type: "button", "aria-label": "명령 복사" }, text: "복사" });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void navigator.clipboard?.writeText(command).then(() => { button.textContent = t("복사됨"); }).catch(() => {});
  });
  return el("span", { class: "st-cmd", children: [el("code", { text: command, attrs: { translate: "no" } }), button] });
}

/** 레일 AI 상태 줄이 그리는 요약. */
export type AiStatusSummary = { readonly tone: "ok" | "warn" | "off"; readonly text: string };

export function summarizeAiStatus(choice: AssistantEngineChoice | null, report: LocalAgentsReport | null): AiStatusSummary {
  const label = (id: LocalCliId): string => report?.clis.find((row) => row.id === id)?.label ?? ENGINE_LABEL[id];
  if (choice) {
    const row = report?.clis.find((entry) => entry.id === choice.cli);
    if (!report || row?.state === "ready") return { tone: "ok", text: t("{0} · 연결됨").replace("{0}", label(choice.cli)) };
    return { tone: "warn", text: t("{0} · 확인 필요").replace("{0}", label(choice.cli)) };
  }
  const ready = report?.clis.find((row) => row.state === "ready");
  // 찾았지만 아직 고르지 않았다 — 조수는 지금 엔진 그대로다(opt-in).
  if (ready) return { tone: "warn", text: t("{0} 찾음 · 고르기").replace("{0}", ready.label) };
  return { tone: "off", text: "AI 엔진 · 설정" };
}
