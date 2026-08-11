import type { SupabaseProjectConfigDraft } from "@/project/supabaseProjectConfig";
import { el } from "@/util/dom";

type AdvancedConnectionActions = {
  readonly onLoadDefaults: () => void;
  readonly onSave: () => void;
};

export function renderAdvancedConnectionSettings(
  draft: SupabaseProjectConfigDraft,
  actions: AdvancedConnectionActions,
): HTMLDetailsElement {
  return el("details", {
    class: "db-config-advanced",
    dataset: { testid: "db-config-advanced" },
    children: [
      el("summary", { text: "연결 문제 해결" }),
      el("div", {
        class: "db-config-advanced-body",
        children: [
          el("p", {
            class: "db-config-advanced-help",
            text: "대부분의 사용자는 건드릴 필요가 없습니다. 작업 목록이 보이지 않을 때만 확인하세요.",
          }),
          connectionField("서버 주소", "url", draft.url, "관리자에게 받은 서버 주소"),
          connectionField("접속 키", "anonKey", draft.anonKey, "관리자에게 받은 접속 키"),
          connectionField("작업 ID 직접 입력", "projectId", draft.projectId, "목록에 없는 작업 ID"),
          el("div", {
            class: "db-config-advanced-actions",
            children: [
              el("button", {
                class: "btn primary",
                text: "입력한 작업 열기",
                attrs: { type: "submit" },
                dataset: { testid: "db-config-connect" },
              }),
              el("button", {
                class: "btn",
                text: "기본 연결 정보 다시 불러오기",
                attrs: { type: "button" },
                dataset: { testid: "db-config-fill-env" },
                on: { click: actions.onLoadDefaults },
              }),
              el("button", {
                class: "btn",
                text: "이 기기에 연결 정보 저장",
                attrs: { type: "button" },
                dataset: { testid: "db-config-save" },
                on: { click: actions.onSave },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function fillConnectionForm(form: HTMLFormElement, draft: SupabaseProjectConfigDraft): void {
  setInputValue(form, "url", draft.url);
  setInputValue(form, "anonKey", draft.anonKey);
  setInputValue(form, "projectId", draft.projectId);
}

export function readConnectionForm(form: HTMLFormElement): SupabaseProjectConfigDraft {
  return {
    anonKey: inputValue(form, "anonKey"),
    projectId: inputValue(form, "projectId"),
    url: inputValue(form, "url"),
  };
}

function connectionField(
  label: string,
  name: keyof SupabaseProjectConfigDraft,
  value: string,
  placeholder: string,
): HTMLElement {
  return el("label", {
    class: "db-config-field",
    children: [
      el("span", { text: label }),
      el("input", {
        value,
        attrs: {
          autocomplete: name === "anonKey" ? "off" : "on",
          name,
          placeholder,
          spellcheck: "false",
          type: name === "anonKey" ? "password" : "text",
        },
        dataset: { testid: `db-config-${fieldTestId(name)}` },
      }),
    ],
  });
}

function setInputValue(form: HTMLFormElement, name: keyof SupabaseProjectConfigDraft, value: string): void {
  const control = form.elements.namedItem(name);
  if (control instanceof HTMLInputElement) control.value = value;
}

function inputValue(form: HTMLFormElement, name: keyof SupabaseProjectConfigDraft): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ? control.value : "";
}

function fieldTestId(name: keyof SupabaseProjectConfigDraft): string {
  if (name === "anonKey") return "anon-key";
  if (name === "projectId") return "project-id";
  return name;
}
