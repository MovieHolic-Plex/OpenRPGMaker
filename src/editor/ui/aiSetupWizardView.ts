import { el } from "@/util/dom";
import type { WizardAction, WizardScreen } from "@/ai/setupWizardModel";

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

function actionButton(action: WizardAction, kind: "primary" | "choice" | "link", testid: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const button = el("button", {
    class: `app-modal-wizard-button app-modal-wizard-${kind}${action.outline ? " app-modal-wizard-outline" : ""}`,
    attrs: { type: "button" },
    dataset: { testid, action: action.id, ...(action.arg ? { arg: action.arg } : {}) },
  });
  button.append(el("span", { class: "app-modal-wizard-button-label", text: action.label }));
  if (action.hint) button.append(el("span", { class: "app-modal-wizard-button-hint", text: action.hint }));
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
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
    if (busy) return;
    handlers.onAction(action, keyInput?.value.trim() || undefined);
    if (keyInput && action.id === "paste-key") keyInput.value = "";
  };

  const children: (Node | string)[] = [
    el("h2", { class: "app-modal-wizard-title", text: screen.title, attrs: { id: "ai-setup-wizard-title" }, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.title } }),
    el("p", { class: "app-modal-wizard-body", text: screen.body, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.body } }),
  ];

  if (screen.id === "finding") children.push(el("div", { class: "app-modal-wizard-spinner", attrs: { role: "progressbar", "aria-label": "찾는 중" } }));

  const afterPrimary: Node[] = [];
  if (screen.command) {
    const command = screen.command;
    const copyButton = el("button", { class: "app-modal-wizard-button app-modal-wizard-choice", text: state.copied ? "✓ 복사됨" : "복사하기", attrs: { type: "button" }, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.copy } });
    copyButton.addEventListener("click", () => handlers.onAction({ id: "copy-command", label: "복사하기", arg: command.command }));
    const box = el("div", {
      class: "app-modal-wizard-command",
      dataset: { testid: AI_SETUP_WIZARD_TESTIDS.command },
      children: [
        el("p", { class: "app-modal-wizard-command-where", text: `열리는 곳: ${command.opens}` }),
        el("code", { class: "app-modal-wizard-command-text", text: command.command }),
        copyButton,
      ],
    });
    if (screen.commandFold) {
      afterPrimary.push(el("details", {
        class: "app-modal-wizard-advanced app-modal-wizard-manual",
        attrs: screen.commandFold.open ? { open: "" } : {},
        dataset: { testid: AI_SETUP_WIZARD_TESTIDS.manual },
        children: [el("summary", { text: "자동 설치가 안 되면 직접 설치하기" }), box],
      }));
    } else children.push(box);
  }

  if (keyInput) children.push(keyInput);

  if (screen.choices.length) {
    children.push(el("div", {
      class: "app-modal-wizard-choices",
      attrs: { role: "group", "aria-label": "서비스 고르기" },
      children: screen.choices.map((choice) => actionButton(choice, "choice", AI_SETUP_WIZARD_TESTIDS.choice, fire(choice), busy)),
    }));
  }

  if (screen.primary) children.push(actionButton(screen.primary, "primary", AI_SETUP_WIZARD_TESTIDS.primary, fire(screen.primary), busy));

  children.push(...afterPrimary);
  if (state.busy) children.push(el("p", { class: "app-modal-wizard-busy", text: state.busy, attrs: { role: "status" }, dataset: { testid: AI_SETUP_WIZARD_TESTIDS.busy } }));
  if (state.notice) {
    children.push(el("p", {
      class: "app-modal-wizard-notice",
      text: state.notice.text,
      attrs: { role: state.notice.tone === "error" ? "alert" : "status" },
      dataset: { testid: AI_SETUP_WIZARD_TESTIDS.notice, tone: state.notice.tone },
    }));
  }

  if (screen.secondary.length) {
    children.push(el("div", {
      class: "app-modal-wizard-secondary",
      children: screen.secondary.map((action) => actionButton(action, "link", AI_SETUP_WIZARD_TESTIDS.secondary, fire(action), false)),
    }));
  }

  if (screen.advanced.length) {
    children.push(el("details", {
      class: "app-modal-wizard-advanced",
      dataset: { testid: AI_SETUP_WIZARD_TESTIDS.advanced },
      children: [
        el("summary", { text: "고급" }),
        el("div", { class: "app-modal-wizard-advanced-body", children: screen.advanced.map((action) => actionButton(action, "link", AI_SETUP_WIZARD_TESTIDS.secondary, fire(action), false)) }),
      ],
    }));
  }

  return el("section", {
    class: "app-modal-wizard",
    attrs: { "aria-labelledby": "ai-setup-wizard-title", "aria-busy": String(busy) },
    dataset: { testid: AI_SETUP_WIZARD_TESTIDS.host, screen: screen.id },
    children,
  });
}
