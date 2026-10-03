// Shared first-input stage. Presentation only: no project store, AI calls, or editor boot.
import { NEW_PROJECT_CHOICES, type NewProjectChoice, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import { el } from "@/util/dom";
import { t } from "@/i18n";
import "@/styles/shell/first-world-arrival.css";

const MOTION_KEY = "oprn:start-lobby-motion-paused";
const WORLD_POSTER = "/assets/project-interview/world-poster.webp";
const WORLD_MOTION = "/assets/project-interview/world-motion.mp4";
const SCENES: Partial<Record<NewProjectChoiceId, { image: string; title: string; line: string; example: string }>> = {
  "monster-collect": {
    image: "/assets/project-interview/new-monster.webp", title: "처음 만나는 작은 친구들", line: "함께라서 가능한 모험.",
    example: "구름 위 하늘섬에서 작은 몬스터들과 친구가 되어 떠나는 모험",
  },
  "story-cutscene": {
    image: "/assets/project-interview/new-romance-memory.webp", title: "다시 만나는 그날의 기억", line: "한 장면에 담긴 긴 이야기.",
    example: "눈 내리는 마을에서 잃어버린 기억을 찾아가는 두 사람의 이야기",
  },
  "adventure-jrpg": {
    image: "/assets/project-interview/old-adventure.webp", title: "강 너머의 첫 번째 모험", line: "작은 용기, 커다란 세계.",
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
  let composing = Boolean(choiceId || options.intent?.trim());
  let busy = false;
  let disposed = false;
  let sceneToken = 0;
  let front = 0;
  let paused = false;
  try { paused = window.localStorage.getItem(MOTION_KEY) === "true"; } catch { /* Optional preference. */ }
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const root = el("section", { class: "first-world-arrival", attrs: { "aria-labelledby": `${id}-title` }, dataset: { testid: "first-world-arrival" } });
  const video = el("video", { class: "first-world-film", attrs: {
    src: WORLD_MOTION, poster: WORLD_POSTER, loop: "", playsinline: "", preload: "metadata", "aria-hidden": "true",
  } });
  video.muted = true;
  const images = [0, 1].map(() => el("img", { class: "first-world-scene", attrs: { alt: "", draggable: "false", "aria-hidden": "true" } }));
  const background = el("div", { class: "first-world-background", attrs: { "aria-hidden": "true" }, children: [
    video, ...images, el("div", { class: "first-world-shade" }), el("div", { class: "first-world-light" }),
  ] });
  const title = el("h1", { class: "first-world-title", attrs: { id: `${id}-title` } });
  const caption = el("p", { class: "first-world-caption", text: "장르 분위기를 보여주는 참고 장면입니다." });
  const status = el("p", { class: "first-world-status", attrs: { role: "status", "aria-live": "polite", hidden: "" } });
  const motion = el("button", { class: "first-world-motion", attrs: { type: "button" }, dataset: { testid: "first-world-motion" } });
  const updateMotion = () => {
    const still = paused || reduced?.matches === true;
    root.classList.toggle("is-still", still);
    motion.hidden = reduced?.matches === true;
    motion.setAttribute("aria-pressed", String(paused));
    motion.textContent = paused ? "움직임 켜기" : "움직임 멈추기";
    if (still || choiceId || disposed || document.hidden) video.pause();
    else void video.play().catch(() => { /* The poster is already visible when autoplay is denied. */ });
  };
  motion.addEventListener("click", () => {
    if (busy) return;
    paused = !paused;
    try { window.localStorage.setItem(MOTION_KEY, String(paused)); } catch { /* Optional preference. */ }
    updateMotion();
  });

  const input = el("textarea", { class: "first-world-input", value: options.intent ?? "", attrs: {
    id: `${id}-input`, rows: "2", maxlength: "600", autocomplete: "off", "aria-describedby": `${id}-hint`,
    placeholder: "예: 눈 내리는 마을에서 잃어버린 기억을 찾는 이야기",
  }, dataset: { testid: options.inputTestId } });
  const submit = el("button", { class: "first-world-submit", attrs: { type: "button" }, dataset: { testid: options.submitTestId } });
  const submitDraft = () => {
    if (busy || !input.value.trim()) return;
    options.onSubmit(choiceId, input.value.trim());
  };
  submit.addEventListener("click", submitDraft);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
      event.preventDefault(); submitDraft();
    }
  });
  const example = el("button", { class: "first-world-example", text: "아이디어가 필요하면, 예시로 시작", attrs: { type: "button" }, dataset: { testid: "first-world-example" } });
  const composer = el("div", { class: "first-world-composer", children: [
    el("label", { class: "first-world-label", attrs: { for: input.id }, text: "만들고 싶은 게임을 한 문장으로" }), input,
    el("div", { class: "first-world-compose-actions", children: [example, submit] }),
    el("p", { class: "first-world-hint", attrs: { id: `${id}-hint` }, text: "처음부터 완벽하지 않아도 괜찮아요. 다음 단계에서 AI와 함께 구체화해요." }),
  ] });
  const free = el("button", { class: "first-world-free", text: "내 문장으로 바로 시작", attrs: { type: "button" }, dataset: { testid: "first-world-free" } });
  const cards = el("div", { class: `first-world-cards ${options.cardsClass ?? ""}`.trim(), attrs: { role: "group", "aria-label": "첫 게임의 세계 선택" } });

  const sync = () => {
    const selected = choices.find(choice => choice.id === choiceId);
    const scene = selected ? SCENES[selected.id] : undefined;
    title.textContent = selected ? t("{0}의 세계에서,\n어떤 이야기를 시작할까요?").replace("{0}", t(selected.label)) : "만들고 싶은 세계에,\n먼저 들어가 보세요.";
    root.classList.toggle("has-choice", Boolean(selected));
    root.classList.toggle("has-intent", Boolean(input.value.trim()));
    input.placeholder = scene ? t(scene.example) : t("예: 눈 내리는 마을에서 잃어버린 기억을 찾는 이야기");
    composer.hidden = !composing;
    free.hidden = composing;
    submit.textContent = busy ? "이어갈 준비 중…" : "이 이야기로 시작 ↗";
    submit.disabled = busy || !input.value.trim();
    cards.querySelectorAll<HTMLButtonElement>("[data-first-world-choice]").forEach(button => {
      const selectedCard = button.dataset.firstWorldChoice === choiceId;
      button.setAttribute("aria-pressed", String(selectedCard));
      const label = button.querySelector(".first-world-poster-action");
      if (label) label.textContent = selectedCard ? "이 세계를 골랐어요 ✓" : "이 세계에서 시작 ↗";
    });
  };
  const showScene = async () => {
    const token = ++sceneToken;
    const scene = choiceId ? SCENES[choiceId] : undefined;
    if (!scene) {
      images.forEach(image => image.classList.remove("is-visible"));
      video.hidden = false;
      status.hidden = true;
      updateMotion();
      return;
    }
    video.pause();
    const probe = new Image(); probe.src = scene.image;
    try { await probe.decode(); } catch {
      if (disposed || token !== sceneToken) return;
      status.hidden = false;
      status.textContent = "참고 장면을 불러오지 못했어요. 첫 문장은 계속 쓸 수 있어요.";
      return;
    }
    if (disposed || token !== sceneToken) return;
    const next = 1 - front;
    images[next]!.src = scene.image;
    images[next]!.classList.add("is-visible");
    images[front]!.classList.remove("is-visible");
    front = next;
    status.hidden = true;
    // Leave the world-map poster behind the crossfade; hidden video never resumes on a choice.
    updateMotion();
  };
  choices.forEach((choice, index) => {
    const scene = SCENES[choice.id];
    const button = el("button", { class: "first-world-poster", attrs: { type: "button", "aria-pressed": "false", "aria-label": t("{0} 세계 선택").replace("{0}", t(choice.label)) },
      dataset: { testid: options.genreTestId(choice, index), templateId: choice.id, firstWorldChoice: choice.id }, children: [
        el("img", { class: "first-world-poster-img", attrs: { src: scene?.image ?? choice.thumb, alt: "", decoding: "async", draggable: "false" } }),
        el("span", { class: "first-world-poster-shade", attrs: { "aria-hidden": "true" } }),
        el("span", { class: "first-world-poster-copy", children: [el("small", { text: choice.label }), el("strong", { text: scene?.title ?? choice.label }), el("span", { text: scene?.line ?? choice.blurb })] }),
        el("span", { class: "first-world-poster-action", text: "이 세계에서 시작 ↗" }),
      ], on: { click: () => {
        if (busy) return;
        choiceId = choice.id; composing = true;
        options.onChoice(choiceId); sync(); void showScene();
        input.focus({ preventScroll: true });
        composer.scrollIntoView({ behavior: paused || reduced?.matches ? "instant" : "smooth", block: "nearest" });
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
  free.addEventListener("click", () => {
    if (busy) return;
    composing = true; choiceId = null; options.onChoice(null); sync(); void showScene(); input.focus({ preventScroll: true });
    composer.scrollIntoView({ behavior: paused || reduced?.matches ? "instant" : "smooth", block: "nearest" });
  });
  root.append(background, el("div", { class: "first-world-content", children: [
    el("div", { class: "first-world-topline", children: [el("span", { class: "first-world-eyebrow", text: "YOUR FIRST WORLD" }), motion] }),
    el("header", { class: "first-world-heading", children: [title, el("p", { text: "작은 마을도, 거대한 모험도. 당신의 한 문장에서 시작됩니다." })] }),
    cards, free, composer, caption, status,
  ] }));
  sync();
  reduced?.addEventListener?.("change", updateMotion);
  document.addEventListener("visibilitychange", updateMotion);
  queueMicrotask(() => { if (!disposed && root.isConnected) { updateMotion(); if (choiceId) void showScene(); } });
  return {
    element: root, input,
    setBusy: value => {
      busy = value; root.setAttribute("aria-busy", String(value));
      root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>("button, textarea").forEach(control => { control.disabled = value; });
      sync();
    },
    dispose: () => {
      disposed = true; sceneToken++;
      reduced?.removeEventListener?.("change", updateMotion);
      document.removeEventListener("visibilitychange", updateMotion);
      video.pause(); video.removeAttribute("src"); video.load();
    },
  };
}
