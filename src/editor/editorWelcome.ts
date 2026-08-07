// editor/editorWelcome.ts
// First-run editor welcome overlay: focused hero + unified bottom worlds strip.
// finishEditorBoot wires presentEditorWelcome (mode.ts).

import { showConfirm } from "@/editor/ui/modal";
import {
  WELCOME_BLANK_CONFIRM,
  WELCOME_GENRE_PRESETS,
  WELCOME_INSPIRATION_MINIS,
  WELCOME_QUICK_PICKS,
  WELCOME_STARTER_TEMPLATES,
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  type WelcomeGenrePresetId,
} from "@/editor/welcomeGenrePresets";
import { readProjectFromUrl } from "@/project/projectUrl";
import { el } from "@/util/dom";

export const EDITOR_WELCOME_DISMISSED_KEY = "rpg-zzu:editor-welcome-dismissed";

export const EDITOR_WELCOME_TESTIDS = {
  host: "editor-welcome",
  input: "editor-welcome-input",
  start: "editor-welcome-start",
  skip: "editor-welcome-skip",
  dismiss: "editor-welcome-dismiss",
  genreStart: "editor-welcome-genre-start",
  inspirationStrip: "editor-welcome-inspiration",
  promptInput: "editor-welcome-prompt-input",
  promptSubmit: "editor-welcome-prompt-submit",
  quickPick: "editor-welcome-quick-pick",
  templateCard: "editor-welcome-template-card",
  chips: [
    "editor-welcome-chip-0",
    "editor-welcome-chip-1",
    "editor-welcome-chip-2",
    "editor-welcome-chip-3",
    "editor-welcome-chip-4",
    "editor-welcome-chip-5",
  ],
  slide: "editor-welcome-slide",
} as const;

export const WELCOME_SLIDE_URLS = [
  "/assets/generated/welcome/slide-00-hero.png",
  "/assets/generated/welcome/slide-01.png",
  "/assets/generated/welcome/slide-02.png",
  "/assets/generated/welcome/slide-03.png",
  "/assets/generated/welcome/slide-04.png",
  "/assets/generated/welcome/slide-05.png",
  "/assets/generated/welcome/slide-06.png",
] as const;

/** Crossfade interval. Keep rotating even under reduced-motion (only CSS motion is softened). */
export const WELCOME_SLIDE_INTERVAL_MS = 4000;

/** Chip labels for UI/tests — source of truth is WELCOME_GENRE_PRESETS. */
export const WELCOME_CHIPS = WELCOME_GENRE_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
}));

export type EditorWelcomeAction = "start" | "skip";

export type EditorWelcomeResult = {
  readonly intent: string | null;
  /** Full AI prompt when genre pipeline should auto-send after blank load. */
  readonly prompt: string | null;
  readonly autoSend: boolean;
  readonly replaceWithBlank: boolean;
  readonly presetId?: WelcomeGenrePresetId;
  readonly source?: "chip" | "free-text";
  readonly dismiss: boolean;
  readonly action: EditorWelcomeAction;
};

export type ShouldPresentEditorWelcomeOptions = {
  readonly modeShellMounted: boolean;
  readonly dismissed?: boolean;
  readonly automation?: boolean;
  /** When true (or when URL has ?project=), skip first-run welcome overlay. */
  readonly deepLinkedProject?: boolean;
};

/** True when URL asks to open a specific remote project (share/bookmark deep-link). */
export function hasDeepLinkedProject(
  search = typeof window !== "undefined" ? window.location?.search ?? "" : "",
): boolean {
  return readProjectFromUrl(search).projectId != null;
}

/** prefers-reduced-motion: reduce — CSS transitions only; slideshow still advances. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function welcomeStorage(): Storage | null {
  try {
    const w = typeof window !== "undefined" ? (window as unknown as { localStorage?: Storage }).localStorage : undefined;
    if (w) return w as Storage;
  } catch { /* ignore */ }
  try {
    const g = (globalThis as unknown as { localStorage?: Storage }).localStorage;
    if (g) return g;
  } catch { /* ignore */ }
  try {
    if (typeof localStorage !== "undefined") return localStorage as unknown as Storage;
  } catch { /* ignore */ }
  return null;
}

export function isEditorWelcomeDismissed(): boolean {
  try {
    const s = welcomeStorage();
    if (!s) return false;
    return s.getItem(EDITOR_WELCOME_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setEditorWelcomeDismissed(dismissed = true): void {
  try {
    const s = welcomeStorage();
    if (!s) return;
    if (dismissed) {
      s.setItem(EDITOR_WELCOME_DISMISSED_KEY, "1");
    } else {
      s.removeItem(EDITOR_WELCOME_DISMISSED_KEY);
    }
  } catch {
    /* private mode / quota */
  }
}

/**
 * e2e/dev boot contexts where floating first-run UI must not intercept the surface.
 * Mirrors teamWorkflowUi automation boot detection.
 */
export function isAutomationBootContext(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location?.search ?? "";
  const params = new URLSearchParams(search);
  // Intentional browser-verify / dogfood: force welcome even under Playwright webdriver.
  if (params.has("forceWelcome")) return false;
  if (window.__RPG_ZZU_E2E_PROJECT__) return true;
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  return (
    params.has("freshProject")
    || params.has("devProject")
    || params.has("blankProject")
    || params.has("aiBridge")
    || params.has("softConfirm")
    || params.has("sc2")
    || params.has("sc3")
  );
}

/** Alias for callers that prefer a welcome-scoped name. */
export function shouldSuppressEditorWelcomeForAutomation(): boolean {
  return isAutomationBootContext();
}

export function shouldPresentEditorWelcome(
  options: ShouldPresentEditorWelcomeOptions
): boolean {
  // Cold-boot only: if the edit/play shell is already mounted, never overlay welcome.
  if (options.modeShellMounted) return false;
  const dismissed = options.dismissed ?? isEditorWelcomeDismissed();
  if (dismissed) return false;
  // Opening a shared/bookmarked project must not trap the user in "new world" welcome.
  if (options.deepLinkedProject ?? hasDeepLinkedProject()) return false;
  const automation = options.automation ?? isAutomationBootContext();
  if (automation) return false;
  return true;
}

function preloadSlideImages(urls: readonly string[]): void {
  if (typeof Image === "undefined") return;
  for (const src of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

/**
 * Mount the full-screen welcome overlay under `host` and resolve when the user
 * starts or skips. Always removes the overlay and clears the slideshow timer.
 */
export function presentEditorWelcome(host: HTMLElement): Promise<EditorWelcomeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let slideIndex = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let dismissChecked = false;
    let customOpen = false;
    let selectedPresetId: WelcomeGenrePresetId | null = null;
    let freeIntent: string | null = null;

    preloadSlideImages(WELCOME_SLIDE_URLS);
    preloadSlideImages(WELCOME_INSPIRATION_MINIS.map((m) => m.thumb));

    const reduceMotion = prefersReducedMotion();
    if (reduceMotion) {
      host.classList.add("editor-welcome-host-reduced-motion");
    }

    const slides = WELCOME_SLIDE_URLS.map((src, index) => {
      const frame = el("div", {
        class: `editor-welcome-slide${index === 0 ? " is-active" : ""}`,
        dataset: { testid: EDITOR_WELCOME_TESTIDS.slide, slideIndex: String(index) },
        attrs: {
          "aria-hidden": index === 0 ? "false" : "true",
        },
      });
      const img = el("img", {
        class: "editor-welcome-slide-img",
        attrs: {
          src,
          alt: "",
          draggable: "false",
          decoding: "async",
          loading: index === 0 ? "eager" : "lazy",
        },
      }) as HTMLImageElement;
      frame.append(img);
      return frame;
    });

    const slideshow = el("div", {
      class: "editor-welcome-slideshow",
      attrs: { "aria-hidden": "true" },
      children: slides,
    });

    const input = el("input", {
      class: "editor-welcome-input",
      attrs: {
        type: "text",
        placeholder: "예: 몬스터를 모으는 모험",
        autocomplete: "off",
        "aria-label": "만들고 싶은 게임 스타일",
      },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.input },
    }) as HTMLInputElement;

    const promptInput = el("input", {
      class: "editor-welcome-prompt-input",
      attrs: {
        type: "text",
        placeholder: '한 문장으로 말해보세요 \u2014 예: "눈 내리는 마을에 여관이 있고, 여관 주인이 잠을 팔아요"',
        autocomplete: "off",
        "aria-label": "AI 프롬프트 \u2014 한 문장으로 말해보세요",
      },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.promptInput },
    }) as HTMLInputElement;

    const settle = (result: EditorWelcomeResult): void => {
      if (settled) return;
      settled = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (result.dismiss) {
        setEditorWelcomeDismissed(true);
      }
      root.remove();
      resolve(result);
    };

    const confirmAndFinish = async (opts: {
      readonly action: EditorWelcomeAction;
      readonly source: "chip" | "free-text";
      readonly presetId?: WelcomeGenrePresetId;
      readonly label: string;
    }): Promise<void> => {
      if (settled) return;
      const ok = await showConfirm({
        title: WELCOME_BLANK_CONFIRM.title,
        message: WELCOME_BLANK_CONFIRM.message,
        confirmLabel: WELCOME_BLANK_CONFIRM.confirmLabel,
        cancelLabel: WELCOME_BLANK_CONFIRM.cancelLabel,
        danger: WELCOME_BLANK_CONFIRM.danger,
      });
      if (!ok || settled) return;
      const preset = opts.presetId
        ? WELCOME_GENRE_PRESETS.find((entry) => entry.id === opts.presetId)
        : undefined;
      const prompt = preset
        ? buildWelcomeGenrePresetPrompt(preset)
        : buildWelcomeFreeTextPrompt(opts.label);
      settle({
        intent: opts.label,
        prompt,
        autoSend: true,
        replaceWithBlank: true,
        presetId: opts.presetId,
        source: opts.source,
        dismiss: dismissChecked,
        action: opts.action,
      });
    };

    const finishSkip = (): void => {
      settle({
        intent: null,
        prompt: null,
        autoSend: false,
        replaceWithBlank: false,
        dismiss: dismissChecked,
        action: "skip",
      });
    };

    const finishStart = (): void => {
      const trimmed = input.value.trim();
      if (!trimmed) {
        finishSkip();
        return;
      }
      void confirmAndFinish({
        action: "start",
        source: "free-text",
        label: trimmed,
      });
    };

    const genreStartButton = el("button", {
      class: "editor-welcome-genre-start",
      text: "이 세계로 시작",
      attrs: { type: "button", disabled: "true" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.genreStart },
    }) as HTMLButtonElement;

    const selectionBar = el("div", {
      class: "editor-welcome-selection",
      children: [genreStartButton],
    });

    const genreButtons: HTMLButtonElement[] = [];
    const miniButtons: HTMLButtonElement[] = [];

    const setBackgroundThumb = (src: string): void => {
      // Pin the slideshow on the chosen world's art so the hero focuses on that vibe.
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      let matched = false;
      for (const frame of slides) {
        const img = frame.querySelector("img");
        const match = img?.getAttribute("src") === src;
        frame.classList.toggle("is-active", Boolean(match));
        frame.setAttribute("aria-hidden", match ? "false" : "true");
        if (match) matched = true;
      }
      if (!matched && slides[0]) {
        const img = slides[0].querySelector("img");
        if (img) img.setAttribute("src", src);
        for (const frame of slides) {
          frame.classList.remove("is-active");
          frame.setAttribute("aria-hidden", "true");
        }
        slides[0].classList.add("is-active");
        slides[0].setAttribute("aria-hidden", "false");
      }
      root.classList.add("has-world-focus");
    };

    const selectPreset = (presetId: WelcomeGenrePresetId): void => {
      selectedPresetId = presetId;
      freeIntent = null;
      const preset = WELCOME_GENRE_PRESETS.find((entry) => entry.id === presetId);
      for (const btn of genreButtons) {
        const on = btn.dataset.chipId === presetId;
        btn.classList.toggle("is-selected", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
      for (const btn of miniButtons) {
        btn.classList.remove("is-selected");
      }
      if (preset) setBackgroundThumb(preset.thumb);
      selectionBar.classList.add("has-selection");
      genreStartButton.disabled = false;
      genreStartButton.removeAttribute("disabled");
    };

    const selectMini = (intent: string, thumb: string, button: HTMLButtonElement): void => {
      selectedPresetId = null;
      freeIntent = intent;
      for (const btn of genreButtons) {
        btn.classList.remove("is-selected");
        btn.setAttribute("aria-pressed", "false");
      }
      for (const btn of miniButtons) {
        btn.classList.toggle("is-selected", btn === button);
      }
      setBackgroundThumb(thumb);
      selectionBar.classList.add("has-selection");
      genreStartButton.disabled = false;
      genreStartButton.removeAttribute("disabled");
    };

    const startSelectedGenre = (): void => {
      if (freeIntent && !selectedPresetId) {
        void confirmAndFinish({
          action: "start",
          source: "free-text",
          label: freeIntent,
        });
        return;
      }
      if (!selectedPresetId) return;
      const preset = WELCOME_GENRE_PRESETS.find((entry) => entry.id === selectedPresetId);
      if (!preset) return;
      void confirmAndFinish({
        action: "start",
        source: "chip",
        presetId: preset.id,
        label: preset.label,
      });
    };

    genreStartButton.addEventListener("click", () => startSelectedGenre());

    const worldsTrack = el("div", {
      class: "editor-welcome-worlds-track",
      attrs: { role: "list", "aria-label": "세계 선택" },
      children: [
        ...WELCOME_GENRE_PRESETS.map((chip, index) => {
          const btn = el("button", {
            class: "editor-welcome-genre-item",
            attrs: {
              type: "button",
              role: "listitem",
              "aria-label": chip.label,
              "aria-pressed": "false",
              title: `${chip.label} · ${chip.blurb}`,
            },
            dataset: {
              testid: EDITOR_WELCOME_TESTIDS.chips[index]!,
              chipId: chip.id,
            },
            on: {
              click: () => selectPreset(chip.id),
              dblclick: () => {
                selectPreset(chip.id);
                startSelectedGenre();
              },
            },
            children: [
              el("img", {
                class: "editor-welcome-genre-img",
                attrs: {
                  src: chip.thumb,
                  alt: "",
                  draggable: "false",
                  loading: index < 4 ? "eager" : "lazy",
                  decoding: "async",
                },
              }),
              el("span", {
                class: "editor-welcome-genre-label",
                text: chip.label,
              }),
            ],
          }) as HTMLButtonElement;
          genreButtons.push(btn);
          return btn;
        }),
        ...WELCOME_INSPIRATION_MINIS.map((mini, index) => {
          const btn = el("button", {
            class: "editor-welcome-inspiration-item",
            attrs: {
              type: "button",
              role: "listitem",
              "aria-label": `${mini.label} (${mini.blurb})`,
              title: `${mini.label} · ${mini.blurb}`,
            },
            dataset: {
              testid: `editor-welcome-inspiration-${index}`,
              inspirationId: mini.id,
            },
            on: {
              click: () => selectMini(mini.intent, mini.thumb, btn),
              dblclick: () => {
                selectMini(mini.intent, mini.thumb, btn);
                startSelectedGenre();
              },
            },
            children: [
              el("img", {
                class: "editor-welcome-inspiration-img",
                attrs: {
                  src: mini.thumb,
                  alt: "",
                  draggable: "false",
                  loading: "lazy",
                  decoding: "async",
                },
              }),
              el("span", {
                class: "editor-welcome-inspiration-label",
                text: mini.label,
              }),
            ],
          }) as HTMLButtonElement;
          miniButtons.push(btn);
          return btn;
        }),
      ],
    });

    const worldsStrip = el("div", {
      class: "editor-welcome-worlds",
      dataset: { testid: EDITOR_WELCOME_TESTIDS.inspirationStrip },
      children: [
        el("p", {
          class: "editor-welcome-worlds-caption",
          text: "Choose a world",
        }),
        worldsTrack,
      ],
    });

    const dismissToggle = el("input", {
      class: "editor-welcome-dismiss-check",
      attrs: { type: "checkbox", id: "editor-welcome-dismiss-check" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.dismiss },
    }) as HTMLInputElement;
    dismissToggle.addEventListener("change", () => {
      dismissChecked = dismissToggle.checked;
    });

    const dismissLabel = el("label", {
      class: "editor-welcome-dismiss-label",
      attrs: { for: "editor-welcome-dismiss-check" },
      children: [dismissToggle, el("span", { text: "다시 보지 않기" })],
    });

    const promptSubmit = el("button", {
      class: "editor-welcome-prompt-submit",
      text: "\u2728 초안 만들기 \u2014 10초",
      attrs: { type: "button" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.promptSubmit },
      on: {
        click: () => {
          const trimmed = promptInput.value.trim();
          if (!trimmed) return;
          void confirmAndFinish({ action: "start", source: "free-text", label: trimmed });
        },
      },
    }) as HTMLButtonElement;

    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        promptSubmit.click();
      }
    });

    const quickPickRow = el("div", {
      class: "editor-welcome-quick-picks",
      children: WELCOME_QUICK_PICKS.map((pick, index) =>
        el("button", {
          class: "editor-welcome-quick-pick",
          text: pick.label,
          attrs: { type: "button" },
          dataset: { testid: `${EDITOR_WELCOME_TESTIDS.quickPick}-${index}`, quickPickId: String(index) },
          on: {
            click: () => {
              promptInput.value = pick.intent;
              try { promptInput.focus(); } catch { /* headless */ }
            },
          },
        })
      ),
    });

    const promptPanel = el("div", {
      class: "editor-welcome-prompt-panel",
      children: [
        el("p", { class: "editor-welcome-prompt-hint", text: "한 문장으로 말해보세요 \u2014 AI가 초안을 짜드립니다" }),
        promptInput,
        quickPickRow,
        el("div", {
          class: "editor-welcome-prompt-actions",
          children: [promptSubmit, el("span", { class: "editor-welcome-prompt-note", text: "또는 아래 세계를 고르세요" })],
        }),
      ],
    });

    const templateRow = el("div", {
      class: "editor-welcome-template-row",
      children: WELCOME_STARTER_TEMPLATES.map((tpl, index) =>
        el("button", {
          class: "editor-welcome-template-card",
          attrs: { type: "button", "aria-label": `${tpl.label} \u2014 ${tpl.blurb}` },
          dataset: { testid: `${EDITOR_WELCOME_TESTIDS.templateCard}-${index}`, templateId: tpl.id },
          on: {
            click: () => {
              void confirmAndFinish({ action: "start", source: "free-text", label: tpl.intent });
            },
          },
          children: [
            el("span", { class: "editor-welcome-template-thumb", attrs: { style: `background-image:url('${tpl.thumb}')` } }),
            el("span", { class: "editor-welcome-template-label", text: tpl.label }),
            el("span", { class: "editor-welcome-template-blurb", text: tpl.blurb }),
          ],
        })
      ),
    });

    const startButton = el("button", {
      class: "editor-welcome-start",
      text: "시작하기",
      attrs: { type: "button" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.start },
      on: { click: () => finishStart() },
    });

    const skipButton = el("button", {
      class: "editor-welcome-skip",
      text: "건너뛰기",
      attrs: { type: "button" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.skip },
      on: { click: () => finishSkip() },
    });

    const customPanel = el("div", {
      class: "editor-welcome-custom-panel",
      attrs: { hidden: "true", id: "editor-welcome-custom-panel" },
      children: [
        input,
        el("div", {
          class: "editor-welcome-actions",
          children: [startButton],
        }),
      ],
    });

    const customToggle = el("button", {
      class: "editor-welcome-custom-toggle",
      text: "직접 쓰기",
      attrs: {
        type: "button",
        "aria-expanded": "false",
        "aria-controls": "editor-welcome-custom-panel",
      },
      on: {
        click: () => {
          customOpen = !customOpen;
          if (customOpen) {
            customPanel.removeAttribute("hidden");
            customToggle.setAttribute("aria-expanded", "true");
            customToggle.classList.add("is-open");
            customToggle.textContent = "직접 쓰기 접기";
            queueMicrotask(() => {
              try {
                input.focus();
              } catch {
                /* headless */
              }
            });
          } else {
            customPanel.setAttribute("hidden", "true");
            customToggle.setAttribute("aria-expanded", "false");
            customToggle.classList.remove("is-open");
            customToggle.textContent = "직접 쓰기";
          }
        },
      },
    });

    const dock = el("div", {
      class: "editor-welcome-dock",
      children: [
        promptPanel,
        templateRow,
        selectionBar,
        worldsStrip,
        el("div", {
          class: "editor-welcome-custom",
          children: [customToggle, customPanel],
        }),
        el("footer", {
          class: "editor-welcome-footer",
          children: [skipButton, dismissLabel],
        }),
      ],
    });

    const stage = el("div", {
      class: "editor-welcome-stage",
      attrs: { role: "dialog", "aria-labelledby": "editor-welcome-title", "aria-modal": "true" },
      children: [
        el("header", {
          class: "editor-welcome-header",
          children: [
            el("p", {
              class: "editor-welcome-kicker",
              text: "AI RPG MAKER · New",
            }),
            el("h1", {
              class: "editor-welcome-title",
              text: "무엇을 만들고 싶어요?",
              attrs: { id: "editor-welcome-title" },
            }),
            el("p", {
              class: "editor-welcome-sub",
              text: "세계를 고르면 새 뼈대와 생성 제안이 이어집니다",
            }),
          ],
        }),
        dock,
      ],
    });

    const root = el("div", {
      class: reduceMotion ? "editor-welcome is-reduced-motion" : "editor-welcome",
      attrs: { role: "presentation" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.host },
      children: [slideshow, el("div", { class: "editor-welcome-scrim" }), stage],
    });

    host.append(root);

    const advanceSlide = (): void => {
      if (slides.length <= 1) return;
      // Stop auto-rotation once a world is focused.
      if (root.classList.contains("has-world-focus")) return;
      const prev = slides[slideIndex];
      if (prev) {
        prev.classList.remove("is-active");
        prev.setAttribute("aria-hidden", "true");
      }
      slideIndex = (slideIndex + 1) % slides.length;
      const next = slides[slideIndex];
      if (next) {
        next.classList.add("is-active");
        next.setAttribute("aria-hidden", "false");
      }
    };

    if (slides.length > 1) {
      intervalId = setInterval(advanceSlide, WELCOME_SLIDE_INTERVAL_MS);
    }
  });
}
