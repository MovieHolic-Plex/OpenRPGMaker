// player/dialogueControlBar.ts
// 대사창 읽기 도구 줄(오토·스킵·백로그·숨기기) — 대사 상자에 붙는 작은 단추 줄(2026-10-17, 미연시 시스템 UI 1단계).
// 켜진 기능만 단추가 나온다(AuthoredDialogueSystem). 단추를 눌러도 대사가 넘어가지 않게 클릭을 상자에 번지지 않게 한다.
// 단축키는 dialogue.ts 가 다룬다: A 오토 · S 스킵 · H 숨기기 · L/PageUp/휠 위 백로그 · Ctrl 누르는 동안 스킵.
import { dialogueUiText, type DialogueUiKey } from "@/player/dialogueUiStrings";
import type { AuthoredDialogueSystem } from "@/project/dialogueSystem";
import { el } from "@/util/dom";

export type DialogueBarAction = "auto" | "skip" | "backlog" | "hide";

export type DialogueBarState = { readonly auto: boolean; readonly skip: boolean };

export type DialogueControlBar = {
  readonly root: HTMLElement;
  /** 오토·스킵 켜짐 표시를 맞춘다. */
  sync(state: DialogueBarState): void;
  /** 멈춘 이유를 잠깐 알린다(읽기 보조가 안전 규칙으로 꺼졌을 때). */
  notice(text: string): void;
};

const ACTIONS: readonly { readonly action: DialogueBarAction; readonly key: DialogueUiKey; readonly shortcut: string; readonly toggle: boolean }[] = [
  { action: "auto", key: "bar.auto", shortcut: "A", toggle: true },
  { action: "skip", key: "bar.skip", shortcut: "S", toggle: true },
  { action: "backlog", key: "bar.backlog", shortcut: "L", toggle: false },
  { action: "hide", key: "bar.hide", shortcut: "H", toggle: false },
];

const NOTICE_MS = 2400;

function actionEnabled(system: AuthoredDialogueSystem, action: DialogueBarAction): boolean {
  if (action === "auto") return system.auto.enabled;
  if (action === "skip") return system.skip.enabled;
  if (action === "backlog") return system.backlog.enabled;
  return system.hideButton.enabled;
}

export function createDialogueControlBar(system: AuthoredDialogueSystem, onAction: (action: DialogueBarAction) => void): DialogueControlBar | undefined {
  const entries = ACTIONS.filter((entry) => actionEnabled(system, entry.action));
  if (entries.length === 0) return undefined;
  const buttons = new Map<DialogueBarAction, HTMLButtonElement>();
  const noticeEl = el("span", { class: "dialogue-bar-notice", attrs: { role: "status", "aria-live": "polite" }, dataset: { testid: "dialogue-bar-notice" } });
  const root = el("div", {
    class: "dialogue-bar",
    attrs: { role: "toolbar", "aria-label": dialogueUiText(system, "bar.label") },
    dataset: { testid: "dialogue-bar" },
  });
  root.append(noticeEl);
  for (const entry of entries) {
    const label = dialogueUiText(system, entry.key);
    const button = el("button", {
      class: "dialogue-bar-btn",
      attrs: { type: "button", title: `${label} (${entry.shortcut})`, "aria-label": `${label} (${entry.shortcut})`, "data-play-input-owner": "play-ui", ...(entry.toggle ? { "aria-pressed": "false" } : {}) },
      dataset: { testid: `dialogue-bar-${entry.action}`, action: entry.action },
      children: [
        el("span", { class: "dialogue-bar-label", text: label }),
        el("kbd", { class: "dialogue-bar-key", text: entry.shortcut, attrs: { "aria-hidden": "true" } }),
      ],
    });
    // 상자의 click 이 대사를 넘기므로 단추 클릭은 상자에 닿지 않게 한다. 포커스는 단추에 남기지 않는다(Enter 가 단추를 다시 누르면 안 된다).
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      button.blur();
      onAction(entry.action);
    });
    button.addEventListener("mousedown", (event) => event.preventDefault());
    buttons.set(entry.action, button);
    root.append(button);
  }
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    root,
    sync(state) {
      for (const [action, pressed] of [["auto", state.auto], ["skip", state.skip]] as const) {
        const button = buttons.get(action);
        if (!button) continue;
        button.setAttribute("aria-pressed", pressed ? "true" : "false");
        button.classList.toggle("is-on", pressed);
      }
      root.dataset.mode = state.skip ? "skip" : state.auto ? "auto" : "off";
    },
    notice(text) {
      noticeEl.textContent = text;
      noticeEl.classList.add("is-visible");
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { noticeEl.classList.remove("is-visible"); noticeEl.textContent = ""; }, NOTICE_MS);
    },
  };
}
