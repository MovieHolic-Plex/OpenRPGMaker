// The launcher owns the Settings tabs. The editor owns the shared AI form.
import { AI_CONFIG_CHANGED_EVENT } from "@/ai/llmClient";
import { AI_CONNECTION_STATUS_CHANGED_EVENT } from "@/editor/panels/aiConnectionStatus";
import { deckIcon } from "@/editor/panels/aiDeckIcons";
import { installAiModalFocus } from "@/editor/panels/aiModalFocus";
import { renderAiSettingsForm } from "@/editor/panels/aiSettingsModal";
import { readSmallTaskPreviewPreference, writeSmallTaskPreviewPreference } from "@/editor/smallTask/previewPreference";
import { modalCloseButton } from "@/editor/ui/modal";
import { isTopModal, registerModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";
import { getLocale, LOCALE_NATIVE_NAMES, setLocale, SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n";
import { APP_VERSION } from "@/brand";
import { renderAppUpdateControl } from "@/app/appUpdateChip";
import { ASSISTANT_ENGINE_CHANGED_EVENT } from "./localAgents";
import "../aiModalStyles";
import "./settings.css";

export type SettingsTab = "ai" | "general" | "about";

const TABS = [["ai", "AI 설정"], ["general", "일반·언어"], ["about", "정보"]] as const;

export function openSettingsDialog(options: {
  readonly tab?: SettingsTab;
  readonly onConnectionChange?: () => void;
} = {}): { close(): void } {
  let selected = options.tab ?? "ai";
  let aiForm: ReturnType<typeof renderAiSettingsForm> | undefined;
  let disposeTabExtras: (() => void) | null = null;
  const pane = el("div", { class: "ai-settings-body", attrs: { id: "start-settings-pane", role: "tabpanel" } });
  const tabButtons = TABS.map(([id, text]) => el("button", {
    class: "st-tab",
    text,
    attrs: { type: "button", id: `start-settings-tab-${id}`, role: "tab", "aria-controls": pane.id },
    dataset: { testid: `start-settings-tab-${id}` },
    on: { click: () => select(id) },
  }));
  const tabs = el("nav", {
    class: "st-tabs",
    attrs: { role: "tablist", "aria-label": "설정" },
    children: tabButtons,
    on: { keydown: (event) => {
      const index = TABS.findIndex(([id]) => id === selected);
      const last = TABS.length - 1;
      let next: number;
      switch ((event as KeyboardEvent).key) {
        case "ArrowRight": next = index === last ? 0 : index + 1; break;
        case "ArrowLeft": next = index === 0 ? last : index - 1; break;
        case "Home": next = 0; break;
        case "End": next = last; break;
        default: return;
      }
      event.preventDefault();
      select(TABS[next][0]);
      tabButtons[next].focus();
    } },
  });
  const closeButton = modalCloseButton("ai-settings-close", () => close(), {
    label: "설정 닫기", testid: "start-settings-close", icon: deckIcon("x"),
  });
  const header = el("header", { class: "ai-settings-titlebar", children: [closeButton, tabs] });
  const dialog = el("div", {
    class: "ai-settings-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "설정" },
    dataset: { testid: "start-settings" },
    children: [header, pane],
  });
  const backdrop = el("div", {
    class: "ai-settings-modal-backdrop",
    children: [dialog],
    on: { mousedown: (event) => { if (event.target === backdrop && isTopModal(backdrop)) close(); } },
  });

  function renderAi(): HTMLElement {
    aiForm ??= renderAiSettingsForm({
      onAdvancedChange: (open) => { header.inert = open; },
    });
    return aiForm.element;
  }

  function select(id: SettingsTab): void {
    if (id === selected && pane.firstChild) return;
    disposeTabExtras?.();
    disposeTabExtras = null;
    selected = id;
    TABS.forEach(([key], index) => {
      const button = tabButtons[index];
      button.setAttribute("aria-selected", String(key === id));
      button.tabIndex = key === id ? 0 : -1;
    });
    pane.setAttribute("aria-labelledby", `start-settings-tab-${id}`);
    if (id === "ai") {
      pane.replaceChildren(renderAi());
    } else if (id === "general") {
      const rendered = renderGeneral();
      disposeTabExtras = rendered.dispose;
      pane.replaceChildren(rendered.element);
    } else {
      const rendered = renderAbout();
      disposeTabExtras = rendered.dispose;
      pane.replaceChildren(rendered.element);
    }
  }

  const restoreFocus = installAiModalFocus(backdrop);
  const onConnectionChange = (): void => options.onConnectionChange?.();
  const close = registerModal(backdrop, () => {
    window.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, onConnectionChange);
    window.removeEventListener(AI_CONFIG_CHANGED_EVENT, onConnectionChange);
    window.removeEventListener(ASSISTANT_ENGINE_CHANGED_EVENT, onConnectionChange);
    disposeTabExtras?.();
    disposeTabExtras = null;
    aiForm?.dispose();
    backdrop.remove();
    restoreFocus();
  });
  window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, onConnectionChange);
  window.addEventListener(AI_CONFIG_CHANGED_EVENT, onConnectionChange);
  window.addEventListener(ASSISTANT_ENGINE_CHANGED_EVENT, onConnectionChange);
  document.body.append(backdrop);
  select(selected);
  if (selected === "ai") aiForm?.focusFirstInput();
  else tabButtons[TABS.findIndex(([id]) => id === selected)].focus();
  return { close };
}

function renderGeneral(): { readonly element: HTMLElement; readonly dispose: () => void } {
  const select = el("select", {
    class: "ai-config-select",
    attrs: { "aria-label": "언어" },
    dataset: { testid: "start-locale-select" },
    children: SUPPORTED_LOCALES.map(locale => el("option", {
      text: LOCALE_NATIVE_NAMES[locale], attrs: { value: locale, lang: locale, translate: "no" },
    })),
  });
  select.value = getLocale();
  select.addEventListener("change", () => void setLocale(select.value as SupportedLocale));
  const preview = el("input", { attrs: { type: "checkbox" } });
  preview.checked = readSmallTaskPreviewPreference();
  preview.addEventListener("change", () => writeSmallTaskPreviewPreference(preview.checked));
  const updateControl = renderAppUpdateControl({ testIdPrefix: "settings-update" });
  const element = el("div", { class: "st-info ai-settings-content", children: [
    el("h3", { text: "언어" }),
    el("p", { text: "편집기와 이 화면의 글자 언어예요. 만든 게임 안의 글자는 바뀌지 않아요." }),
    select,
    el("p", { children: [el("label", { class: "ai-compat-toggle", children: [preview, "AI가 고친 내용을 적용 전에 보기"] })] }),
    ...renderAutoUpdateToggle(),
    ...(updateControl ? [updateControl.element] : []),
  ] });
  return { element, dispose: () => updateControl?.dispose() };
}

/** 데스크톱 앱에서만 보인다. 끄면 자동 확인·내려받기를 하지 않는다(수동 확인은 별도 단추로 동작). */
function renderAutoUpdateToggle(): HTMLElement[] {
  const update = window.oprn?.update;
  if (!update) return [];
  const toggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "settings-auto-update" } });
  toggle.disabled = true;
  void update.status().then((status) => {
    toggle.checked = status.enabled;
    toggle.disabled = status.mode === "off";
  }, () => {});
  toggle.addEventListener("change", () => void update.setEnabled(toggle.checked));
  return [el("p", { children: [el("label", { class: "ai-compat-toggle", children: [toggle, "자동 업데이트"] })] })];
}

function renderAbout(): { readonly element: HTMLElement; readonly dispose: () => void } {
  const updateControl = renderAppUpdateControl({ testIdPrefix: "about-update" });
  const element = el("div", { class: "st-info ai-settings-content", children: [
    el("h3", { text: `OPRN Studio ${APP_VERSION}` }),
    ...(updateControl ? [updateControl.element] : []),
    el("p", { text: "편집기는 SUL, 게임 런타임은 MIT 라이선스예요. 만든 게임은 자유롭게 배포할 수 있어요." }),
    el("a", { attrs: { href: "https://github.com/MovieHolic-Plex/OpenRPGMaker", target: "_blank", rel: "noopener" }, text: "소스 코드 ↗" }),
    el("h3", { text: "크레딧" }),
    el("p", { children: [
      el("b", { text: "general-good-writing" }), " · ", el("span", { text: "코드 연규(code-yeongyu)" }),
    ] }),
    el("p", { text: "AI 조수의 공식 윤문 규칙과 윤문 린터를 이 프로젝트에서 가져왔어요." }),
    el("a", { attrs: { href: "https://github.com/code-yeongyu/general-good-writing", target: "_blank", rel: "noopener" }, text: "general-good-writing ↗" }),
  ] });
  return { element, dispose: () => updateControl?.dispose() };
}
