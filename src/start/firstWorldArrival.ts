// Shared click-first stage. Presentation only: no project store, AI calls, or editor boot.
import { NEW_PROJECT_CHOICES, type NewProjectChoice, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import { el } from "@/util/dom";
import { t } from "@/i18n";
import "@/styles/shell/first-world-arrival.css";

const MOTION_KEY = "oprn:start-lobby-motion-paused";
const WORLD_POSTER = "/assets/project-interview/world-poster.webp";
const WORLD_MOTION = "/assets/project-interview/world-motion.mp4";
const SCENES: Partial<Record<NewProjectChoiceId, { example: string }>> = {
  "monster-collect": {
    example: "구름 위 하늘섬에서 작은 몬스터들과 친구가 되어 떠나는 모험",
  },
  "story-cutscene": {
    example: "눈 내리는 마을에서 잃어버린 기억을 찾아가는 두 사람의 이야기",
  },
  "adventure-jrpg": {
    example: "별이 사라진 마을에서 작은 정령과 함께 모험을 떠나는 RPG",
  },
};

export type FirstWorldArrivalOptions = {
  readonly choiceId?: NewProjectChoiceId | null;
  readonly intent?: string;
  readonly inputTestId: string;
  readonly submitTestId: string;
  readonly genreTestId: (choice: NewProjectChoice, index: number) => string;
  readonly cardsClass?: string;
  readonly onChoice: (choiceId: NewProjectChoiceId | null) => void;
  readonly onIntent: (text: string) => void;
  readonly onSubmit: (choiceId: NewProjectChoiceId | null, text: string) => void;
  /** A separate explicit manual action, never part of choosing a reference scene. */
  readonly alternative?: (choice: NewProjectChoice, index: number) => HTMLElement;
};

export type FirstWorldArrival = {
  readonly element: HTMLElement;
  readonly input: HTMLTextAreaElement;
  readonly setBusy: (busy: boolean) => void;
  readonly dispose: () => void;
};

let instance = 0;

/** Choosing a world and writing are local drafts. Only the explicit submit calls the owner. */
export function createFirstWorldArrival(options: FirstWorldArrivalOptions): FirstWorldArrival {
  const id = `first-world-${++instance}`;
  const choices = NEW_PROJECT_CHOICES.filter(choice => choice.featured);
  let choiceId = options.choiceId ?? null;
  let busy = false;
  let disposed = false;
  let paused = false;
  try { paused = window.localStorage.getItem(MOTION_KEY) === "true"; } catch { /* Optional preference. */ }
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const root = el("section", { class: "first-world-arrival", attrs: { "aria-labelledby": `${id}-title` }, dataset: { testid: "first-world-arrival" } });
  const video = el("video", { class: "first-world-film", attrs: {
    src: WORLD_MOTION, poster: WORLD_POSTER, loop: "", playsinline: "", preload: "metadata", "aria-hidden": "true",
  } });
  video.muted = true;
  const background = el("div", { class: "first-world-background", attrs: { "aria-hidden": "true" }, children: [
    video, el("div", { class: "first-world-shade" }), el("div", { class: "first-world-light" }),
  ] });
  const title = el("h1", { class: "first-world-title", attrs: { id: `${id}-title` } });
  const status = el("p", { class: "first-world-status", attrs: { role: "status", "aria-live": "polite", hidden: "" } });
  const motion = el("button", { class: "first-world-motion", attrs: { type: "button" }, dataset: { testid: "first-world-motion" } });
  const updateMotion = () => {
    const still = paused || reduced?.matches === true;
    root.classList.toggle("is-still", still);
    motion.hidden = reduced?.matches === true;
    motion.setAttribute("aria-pressed", String(paused));
    motion.textContent = paused ? "움직임 켜기" : "움직임 멈추기";
    if (still || busy || disposed || document.hidden) video.pause();
    else void video.play().catch(() => { /* The poster is already visible when autoplay is denied. */ });
  };
  motion.addEventListener("click", () => {
    if (busy) return;
    paused = !paused;
    try { window.localStorage.setItem(MOTION_KEY, String(paused)); } catch { /* Optional preference. */ }
    updateMotion();
  });

  const input = el("textarea", { class: "first-world-input", value: options.intent ?? "", attrs: {
    id: `${id}-input`, rows: "2", maxlength: "600", autocomplete: "off",
    placeholder: "예: 눈 내리는 마을에서 잃어버린 기억을 찾는 이야기",
  }, dataset: { testid: options.inputTestId } });
  const submit = el("button", { class: "first-world-submit", attrs: { type: "button" }, dataset: { testid: options.submitTestId } });
  const submitDraft = () => {
    if (busy || (!choiceId && !input.value.trim())) return;
    options.onSubmit(choiceId, input.value.trim());
  };
  submit.addEventListener("click", submitDraft);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault(); submitDraft();
    }
  });
  const example = el("button", { class: "first-world-example", text: "예시 넣기", attrs: { type: "button" }, dataset: { testid: "first-world-example" } });
  const composer = el("div", { class: "first-world-composer", children: [
    el("label", { class: "first-world-label", attrs: { for: input.id }, text: "내 아이디어 · 선택" }), input,
    el("div", { class: "first-world-compose-actions", children: [example, submit] }),
  ] });
  const cards = el("div", { class: `first-world-cards ${options.cardsClass ?? ""}`.trim(), attrs: { role: "group", "aria-label": "첫 게임의 세계 선택" } });

  const sync = () => {
    const selected = choices.find(choice => choice.id === choiceId);
    const scene = selected ? SCENES[selected.id] : undefined;
    title.textContent = "어떤 게임을 만들까요?";
    root.classList.toggle("has-choice", Boolean(selected));
    root.classList.toggle("has-intent", Boolean(input.value.trim()));
    input.placeholder = scene ? t(scene.example) : t("예: 눈 내리는 마을에서 잃어버린 기억을 찾는 이야기");
    submit.textContent = busy ? "이어갈 준비 중…" : "선택하고 시작";
    submit.disabled = busy || (!choiceId && !input.value.trim());
    cards.querySelectorAll<HTMLButtonElement>("[data-first-world-choice]").forEach(button => {
      const selectedCard = button.dataset.firstWorldChoice === choiceId;
      button.setAttribute("aria-pressed", String(selectedCard));
      const label = button.querySelector(".first-world-poster-action");
      if (label) label.textContent = selectedCard ? "선택됨 ✓" : "선택하기";
    });
  };
  choices.forEach((choice, index) => {
    const button = el("button", { class: "first-world-poster", attrs: { type: "button", "aria-pressed": "false", "aria-label": t("{0} 세계 선택").replace("{0}", t(choice.label)) },
      dataset: { testid: options.genreTestId(choice, index), templateId: choice.id, firstWorldChoice: choice.id }, children: [
        el("span", { class: "first-world-poster-shade", attrs: { "aria-hidden": "true" } }),
        el("span", { class: "first-world-poster-copy", children: [el("strong", { text: choice.label })] }),
        el("span", { class: "first-world-poster-action", text: "선택하기" }),
      ], on: { click: () => {
        if (busy) return;
        choiceId = choice.id;
        options.onChoice(choiceId); sync();
      } },
    });
    cards.append(el("div", { class: "first-world-option", dataset: { presetId: choice.id, packId: choice.packId }, children: [button, ...(options.alternative ? [options.alternative(choice, index)] : [])] }));
  });
  input.addEventListener("input", () => { options.onIntent(input.value); sync(); });
  example.addEventListener("click", () => {
    if (busy) return;
    input.value = t(SCENES[choiceId ?? "story-cutscene"]?.example ?? "예: 눈 내리는 마을에서 잃어버린 기억을 찾는 이야기");
    options.onIntent(input.value); sync(); input.focus({ preventScroll: true });
  });
  root.append(background, el("div", { class: "first-world-content", children: [
    el("div", { class: "first-world-topline", children: [el("span", { class: "first-world-eyebrow", text: "YOUR FIRST WORLD" }), motion] }),
    el("header", { class: "first-world-heading", children: [title] }),
    cards, composer, status,
  ] }));
  sync();
  reduced?.addEventListener?.("change", updateMotion);
  document.addEventListener("visibilitychange", updateMotion);
  queueMicrotask(() => { if (!disposed && root.isConnected) { updateMotion(); } });
  return {
    element: root, input,
    setBusy: value => {
      busy = value; root.setAttribute("aria-busy", String(value));
      root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>("button, textarea").forEach(control => { control.disabled = value; });
      sync();
      updateMotion();
    },
    dispose: () => {
      disposed = true;
      reduced?.removeEventListener?.("change", updateMotion);
      document.removeEventListener("visibilitychange", updateMotion);
      video.pause(); video.removeAttribute("src"); video.load();
    },
  };
}
