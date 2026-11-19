import { ASSISTANT_CHATGPT_MODEL, atLeastMediumEffort, isLegacyTerraModel } from "@/ai/chatgptDefault";
import { LOCAL_CLI_DEFAULT_MODELS } from "@/ai/localCliEngine";
import {
  ASSISTANT_ENGINE_CHANGED_EVENT, createLocalAgentsApi, loadEngineChoice, LOCAL_CLI_IDS, LOCAL_PROGRAM_LABELS,
  saveEngineChoice, type AssistantEngineChoice, type LocalAgentsReport, type LocalCliId, type LocalCliStatus,
} from "@/start/settings/localAgents";
import { t } from "@/i18n";
import { el } from "@/util/dom";

const STATE_LABELS = {
  ready: "연결됨",
  "login-required": "로그인 필요",
  "not-installed": "설치 필요",
  error: "확인 실패",
} as const;

export function renderAiLocalProgramSettings(): { element: HTMLDetailsElement; dispose: () => void } {
  const api = createLocalAgentsApi();
  const lifetime = new AbortController();
  let report: LocalAgentsReport | undefined;
  let detecting = false;
  let detectFailed = false;
  let lastFresh = false;
  let testing = false;

  const status = el("p", { class: "ai-config-help", attrs: { role: "status" } });
  const health = el("p", { class: "ai-config-help", attrs: { role: "status" }, dataset: { testid: "start-settings-test-result" } });
  const detectButton = el("button", {
    class: "ai-assistant-action", attrs: { type: "button" }, text: "다시 확인",
    dataset: { testid: "start-settings-detect" },
    on: { click: () => void detect(detectFailed ? lastFresh : true) },
  });
  const testButton = el("button", {
    class: "ai-assistant-action", attrs: { type: "button" }, text: "연결 시험",
    dataset: { testid: "start-settings-test" },
    on: { click: () => void runTest() },
  });
  const resetButton = el("button", {
    class: "ai-settings-link", attrs: { type: "button" }, text: "원래 AI 연결로 되돌리기",
    dataset: { testid: "settings-engine-reset" },
    on: { click: () => {
      saveEngineChoice(null);
      for (const button of buttons.values()) {
        if (button.getAttribute("aria-disabled") !== "true") { button.focus(); return; }
      }
      detectButton.focus();
    } },
  });

  const rowFor = (id: LocalCliId): LocalCliStatus | undefined => report?.clis.find(row => row.id === id);
  const entries = LOCAL_CLI_IDS.map(id => {
    const label = el("span");
    const button = el("button", {
      class: "ai-assistant-action", attrs: { type: "button", "aria-pressed": "false", "aria-disabled": "true" },
      dataset: { testid: `start-settings-engine-${id}` },
      children: [el("span", { text: LOCAL_PROGRAM_LABELS[id] }), " · ", label],
      on: { click: () => {
        const row = rowFor(id);
        if (row?.state !== "ready" || loadEngineChoice()?.cli === id) return;
        const defaults = LOCAL_CLI_DEFAULT_MODELS[id];
        const routineDefault = isLegacyTerraModel(row.defaults.routine) ? defaults.routine : row.defaults.routine || defaults.routine;
        const model = id === "codex" ? ASSISTANT_CHATGPT_MODEL : routineDefault;
        const deepModel = id === "codex" || isLegacyTerraModel(row.defaults.deep) ? model : row.defaults.deep || model;
        saveEngineChoice({ kind: "local-cli", cli: id, routineModel: model, deepModel, effort: "medium" });
      } },
    });
    const help = el("div", { class: "ai-config-help" });
    return { id, label, button, help };
  });
  const buttons = new Map(entries.map(({ id, button }) => [id, button]));
  const routine = el("select", { class: "ai-config-select", attrs: { "aria-label": "기본 모델" } });
  const planning = el("select", { class: "ai-config-select", attrs: { "aria-label": "계획 모델" } });
  const effort = el("select", { class: "ai-config-select", attrs: { "aria-label": "생각 깊이" } });
  const modelOptions = el("details", { children: [
    el("summary", { text: "프로그램 모델 설정" }),
    el("label", { class: "ai-settings-row", children: [el("span", { text: "기본 모델" }), routine] }),
    el("label", { class: "ai-settings-row", children: [el("span", { text: "계획 모델" }), planning] }),
    el("label", { class: "ai-settings-row", children: [el("span", { text: "생각 깊이" }), effort] }),
  ] });
  const element = el("details", {
    class: "ai-settings-alternatives",
    dataset: { testid: "ai-settings-local-programs" },
    children: [
      el("summary", { class: "ai-settings-row", text: "이 PC에 설치한 AI 프로그램" }),
      el("div", { class: "ai-settings-alternative-body", children: [
        el("p", { class: "ai-config-help", text: "프로그램에서 로그인한 다음 여기서 사용할 프로그램을 고르세요." }),
        status,
        ...entries.map(({ button, help }) => el("div", { children: [button, help] })),
        el("div", { class: "ai-auth-actions", children: [detectButton, testButton, resetButton] }),
        health,
        modelOptions,
      ] }),
    ],
  });

  function render(): void {
    const choice = loadEngineChoice();
    const selected = choice && rowFor(choice.cli);
    detectButton.disabled = detecting;
    detectButton.textContent = detectFailed ? "다시 시도" : "다시 확인";
    status.textContent = detecting ? "찾는 중…" : detectFailed ? "AI 프로그램 목록을 확인하지 못했어요." : "";
    testButton.disabled = testing || selected?.state !== "ready";
    resetButton.hidden = !choice;
    for (const { id, button, label, help } of entries) {
      const row = rowFor(id);
      label.textContent = row ? STATE_LABELS[row.state] : "아직 확인하지 않았어요";
      button.dataset.state = row?.state ?? "unknown";
      button.setAttribute("aria-disabled", String(row?.state !== "ready"));
      button.setAttribute("aria-pressed", String(choice?.cli === id));
      help.replaceChildren();
      if (row?.state === "not-installed" && row.install.url) {
        help.append(el("a", { attrs: { href: row.install.url, target: "_blank", rel: "noopener" }, text: "설치 방법 보기 ↗" }));
      } else if (row?.state === "login-required" && row.login.command) {
        const copy = el("button", {
          class: "ai-settings-link", attrs: { type: "button", "aria-label": "명령 복사" }, text: "복사",
          on: { click: () => void navigator.clipboard?.writeText(row.login.command)
            .then(() => { copy.textContent = t("복사됨"); }, () => undefined) },
        });
        help.append(el("p", { text: "터미널에서 아래 명령으로 로그인한 뒤 「다시 확인」을 눌러 주세요." }),
          el("code", { text: row.login.command }), " ", copy);
      }
    }
    modelOptions.hidden = !choice || selected?.state !== "ready";
    if (!choice || selected?.state !== "ready") return;
    const models = selected.models.filter(model => !isLegacyTerraModel(model.id));
    const fill = (select: HTMLSelectElement, stored: string | undefined): void => {
      const value = isLegacyTerraModel(stored) ? undefined : stored;
      select.replaceChildren(el("option", { attrs: { value: "" }, text: "프로그램 기본값" }), ...models.map(model =>
        el("option", { attrs: { value: model.id }, text: model.label })));
      if (value && !models.some(model => model.id === value)) select.append(el("option", { attrs: { value }, text: value }));
      select.value = value ?? "";
    };
    fill(routine, choice.routineModel);
    fill(planning, choice.deepModel);
    const efforts = [["low", "낮음"], ["medium", "보통"], ["high", "높음"]] as const;
    effort.replaceChildren(...efforts.filter(([id]) => id !== "low" || choice.cli !== "codex")
      .map(([value, text]) => el("option", { attrs: { value }, text })));
    effort.value = choice.cli === "codex" ? atLeastMediumEffort(choice.effort) : choice.effort ?? "medium";
  }

  async function detect(fresh: boolean): Promise<void> {
    if (detecting || lifetime.signal.aborted) return;
    lastFresh = fresh;
    detecting = true;
    detectFailed = false;
    render();
    try {
      report = await api.detect(fresh, lifetime.signal);
    } catch {
      detectFailed = true;
    } finally {
      detecting = false;
      if (!lifetime.signal.aborted) render();
    }
  }

  async function runTest(): Promise<void> {
    const choice = loadEngineChoice();
    if (!choice || testing || rowFor(choice.cli)?.state !== "ready") return;
    testing = true;
    testButton.disabled = true;
    health.textContent = "시험 중…";
    const ok = await api.health(choice.cli, lifetime.signal).then(result => result.ok, () => false);
    if (lifetime.signal.aborted) return;
    testing = false;
    if (loadEngineChoice()?.cli === choice.cli) health.textContent = ok ? "연결 시험에 성공했어요." : "연결 시험에 실패했어요. 프로그램에서 로그인 상태를 확인해 주세요.";
    render();
  }

  element.addEventListener("toggle", () => {
    if (element.hasAttribute("open") && !report && !detectFailed) void detect(false);
  });
  const syncChoice = (): void => { health.textContent = ""; render(); };
  window.addEventListener(ASSISTANT_ENGINE_CHANGED_EVENT, syncChoice);
  const update = (patch: Partial<AssistantEngineChoice>): void => {
    const choice = loadEngineChoice();
    if (choice) saveEngineChoice({ ...choice, ...patch });
  };
  routine.addEventListener("change", () => update({ routineModel: routine.value || undefined }));
  planning.addEventListener("change", () => update({ deepModel: planning.value || undefined }));
  effort.addEventListener("change", () => update({ effort: effort.value === "low" || effort.value === "high" ? effort.value : "medium" }));

  render();
  return {
    element,
    dispose: () => {
      lifetime.abort();
      window.removeEventListener(ASSISTANT_ENGINE_CHANGED_EVENT, syncChoice);
    },
  };
}
