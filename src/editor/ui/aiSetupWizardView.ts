import { el } from "@/util/dom";
import type { WizardAction, WizardDetails, WizardScreen, WizardService } from "@/ai/setupWizardModel";

export const AI_SETUP_WIZARD_TESTIDS = {
  host: "ai-setup-wizard",
  title: "ai-setup-wizard-title",
  body: "ai-setup-wizard-body",
  primary: "ai-setup-wizard-primary",
  choice: "ai-setup-wizard-choice",
  secondary: "ai-setup-wizard-secondary",
  advanced: "ai-setup-wizard-advanced",
  command: "ai-setup-wizard-command",
  copy: "ai-setup-wizard-copy",
  keyInput: "ai-setup-wizard-key-input",
  notice: "ai-setup-wizard-notice",
  busy: "ai-setup-wizard-busy",
  manual: "ai-setup-wizard-manual",
  alert: "ai-setup-wizard-alert",
} as const;

export interface WizardViewState {
  readonly screen: WizardScreen;
  readonly busy?: string;
  readonly notice?: { readonly tone: "ok" | "error"; readonly text: string };
  readonly keyEntry?: { readonly service: string };
  readonly copied?: boolean;
}

export interface WizardViewHandlers {
  readonly onAction: (action: WizardAction, keyText?: string) => void;
}

const SERVICE_MARK: Readonly<Record<WizardService, string>> = { chatgpt: "G", claude: "C", google: "G", deepseek: "D" };

function actionButton(action: WizardAction, kind: "primary" | "choice" | "link", testid: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const button = el("button", {
    class: `app-modal-wizard-button app-modal-wizard-${kind}`,
    attrs: { type: "button" },
    dataset: { testid, action: action.id, ...(action.arg ? { arg: action.arg } : {}) },
  });
  if (kind === "choice" && action.arg && action.arg in SERVICE_MARK) {
    button.append(el("span", { class: "app-modal-wizard-mark is-small", dataset: { service: action.arg }, text: SERVICE_MARK[action.arg as WizardService], attrs: { "aria-hidden": "true" } }));
  }
  const text = el("span", { class: "app-modal-wizard-button-text" });
  text.append(el("span", { class: "app-modal-wizard-button-label", text: action.label }));
  if (action.hint) text.append(el("span", { class: "app-modal-wizard-button-hint", text: action.hint }));
  button.append(text);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function commandBox(command: { readonly command: string }, copied: boolean, onCopy: (() => void) | undefined): HTMLElement {
  const children: Node[] = [el("code", { class: "app-modal-wizard-command-text", text: command.command })];
  if (onCopy) {
    const copyButton = el("button", { class: "app-modal-wizard-copy", text: copied ? "✓ 복사됨" : "복사", attrs: { type: "button" }, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.copy } });
    copyButton.addEventListener("click", onCopy);
    children.push(copyButton);
  }
  return el("div", { class: "app-modal-wizard-command", dataset: { testid: AI_SETUP_WIZARD_TESTIDS.command }, children });
}

export function renderAiSetupWizard(state: WizardViewState, handlers: WizardViewHandlers): HTMLElement {
  const { screen } = state;
  const busy = Boolean(state.busy);
  const keyInput = state.keyEntry
    ? (el("input", {
      class: "app-modal-wizard-key",
      attrs: { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "여기에 붙여 넣기", "aria-label": "키" },
      dataset: { testid: AI_SETUP_WIZARD_TESTIDS.keyInput },
    }) as HTMLInputElement)
    : undefined;

  const fire = (action: WizardAction) => () => {
    if (busy && action.id !== "later" && action.id !== "back") return;
    handlers.onAction(action, keyInput?.value.trim() || undefined);
    if (keyInput && action.id === "paste-key") keyInput.value = "";
  };
  const copy = (command: string) => () => handlers.onAction({ id: "copy-command", label: "복사", arg: command });

  const children: Node[] = [];
  if (screen.service) {
    children.push(el("span", { class: "app-modal-wizard-mark", dataset: { service: screen.service }, text: SERVICE_MARK[screen.service], attrs: { "aria-hidden": "true" } }));
  }
  children.push(
    el("h2", { class: "app-modal-wizard-title", text: screen.title, attrs: { id: "ai-setup-wizard-title" }, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.title } }),
    el("p", { class: "app-modal-wizard-body", text: screen.body, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.body } }),
  );

  if (screen.id === "finding") children.push(el("div", { class: "app-modal-wizard-spinner", attrs: { role: "progressbar", "aria-label": "찾는 중" } }));

  if (screen.alert) {
    children.push(el("p", { class: "app-modal-wizard-alert", text: screen.alert, attrs: { role: "alert" }, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.alert } }));
  }

  if (screen.command) children.push(commandBox(screen.command, Boolean(state.copied), screen.primary?.id === "copy-command" ? undefined : copy(screen.command.command)));
  if (keyInput) children.push(keyInput);

  if (screen.choices.length) {
    children.push(el("div", {
      class: "app-modal-wizard-choices",
      attrs: { role: "group", "aria-label": "AI 고르기" },
      children: screen.choices.map((choice) => actionButton(choice, "choice", AI_SETUP_WIZARD_TESTIDS.choice, fire(choice), busy)),
    }));
  }

  if (busy) {
    children.push(el("div", {
      class: "app-modal-wizard-waiting",
      attrs: { role: "status" },
      dataset: { testid: AI_SETUP_WIZARD_TESTIDS.busy },
      children: [el("span", { class: "app-modal-wizard-spinner is-inline", attrs: { "aria-hidden": "true" } }), el("span", { text: state.busy ?? "" })],
    }));
  } else if (screen.primary) {
    children.push(actionButton(screen.primary, "primary", AI_SETUP_WIZARD_TESTIDS.primary, fire(screen.primary), false));
  }

  if (state.notice) {
    children.push(el("p", {
      class: "app-modal-wizard-notice",
      text: state.notice.text,
      attrs: { role: state.notice.tone === "error" ? "alert" : "status" },
      dataset: { testid: AI_SETUP_WIZARD_TESTIDS.notice, tone: state.notice.tone },
    }));
  }

  const secondary = busy ? screen.secondary.filter((action) => action.id === "later" || action.id === "back") : screen.secondary;
  if (secondary.length) {
    children.push(el("div", {
      class: "app-modal-wizard-secondary",
      children: secondary.map((action) => actionButton(busy && action.id === "later" ? { ...action, label: "취소" } : action, "link", AI_SETUP_WIZARD_TESTIDS.secondary, fire(action), false)),
    }));
  }

  if (screen.details && !busy) children.push(detailsFold(screen.details, state, fire, screen.primary?.id === "copy-command" ? undefined : copy));

  return el("section", {
    class: "app-modal-wizard",
    attrs: { "aria-labelledby": "ai-setup-wizard-title", "aria-busy": String(busy) },
    dataset: { testid: AI_SETUP_WIZARD_TESTIDS.host, screen: screen.id },
    children,
  });
}

function detailsFold(details: WizardDetails, state: WizardViewState, fire: (action: WizardAction) => () => void, copy: ((command: string) => () => void) | undefined): HTMLElement {
  const body: Node[] = [];
  if (details.rows.length) {
    body.push(el("dl", {
      class: "app-modal-wizard-facts",
      children: details.rows.flatMap((row) => [el("dt", { text: row.label }), el("dd", { text: row.value })]),
    }));
  }
  if (details.command) body.push(commandBox(details.command, Boolean(state.copied), copy?.(details.command.command)));
  for (const action of details.actions) body.push(actionButton(action, "link", AI_SETUP_WIZARD_TESTIDS.secondary, fire(action), false));
  return el("details", {
    class: `app-modal-wizard-advanced${details.command ? " app-modal-wizard-manual" : ""}`,
    attrs: details.open ? { open: "" } : {},
    dataset: { testid: details.command ? AI_SETUP_WIZARD_TESTIDS.manual : AI_SETUP_WIZARD_TESTIDS.advanced },
    children: [el("summary", { text: details.summary }), el("div", { class: "app-modal-wizard-advanced-body", children: body })],
  });
}
