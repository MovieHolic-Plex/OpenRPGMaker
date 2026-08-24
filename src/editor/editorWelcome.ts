// editor/editorWelcome.ts
// First-visit director briefing: one question on the live map, then the 감독 console.
// finishEditorBoot wires presentEditorWelcome (mode.ts) after enterMode(edit).

import {
  DIRECTOR_BRIEFING_CARDS,
  WELCOME_GENRE_PRESETS,
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  type WelcomeGenrePresetId,
  welcomeGenrePresetById,
  welcomeGenreSystemPresetPlanById,
} from "@/editor/welcomeGenrePresets";
import type { GenreBlankProjectSystemPresetPlan } from "@/editor/genrePacks";
import { showConfirm } from "@/editor/ui/modal";
import { readProjectFromUrl } from "@/project/projectUrl";
import { el } from "@/util/dom";

export const EDITOR_WELCOME_DISMISSED_KEY = "oprn:editor-welcome-dismissed";

export const EDITOR_WELCOME_TESTIDS = {
  host: "editor-welcome",
  input: "editor-welcome-input",
  start: "editor-welcome-start",
  skip: "editor-welcome-skip",
  dismiss: "editor-welcome-dismiss",
  genreStart: "editor-welcome-genre-start",
  systemPresetError: "editor-welcome-system-preset-error",
  inspirationStrip: "editor-welcome-inspiration",
  promptInput: "editor-welcome-prompt-input",
  promptSubmit: "editor-welcome-prompt-submit",
  quickPick: "editor-welcome-quick-pick",
  templateCard: "editor-welcome-template-card",
  starterCard: "editor-welcome-starter-card",
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

/** Crossfade interval. Kept for callers that still import the cinematic constant. */
export const WELCOME_SLIDE_INTERVAL_MS = 4000;

/** Chip labels for UI/tests — source of truth is WELCOME_GENRE_PRESETS. */
export const WELCOME_CHIPS = WELCOME_GENRE_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
}));

export type EditorWelcomeAction = "start" | "skip";

export type EditorWelcomeResult = {
  readonly intent: string | null;
  /** Full AI prompt sent to the 감독 console for the current map. */
  readonly prompt: string | null;
  readonly autoSend: boolean;
  readonly replaceWithBlank: boolean;
  readonly presetId?: WelcomeGenrePresetId;
  readonly source?: "chip" | "free-text" | "manual-system-preset";
  readonly systemPresetPlan?: GenreBlankProjectSystemPresetPlan;
  readonly dismiss: boolean;
  readonly action: EditorWelcomeAction;
};

export type EditorWelcomeOptions = {
  /** Required by production for the remote-verified manual path; AI cards do not use it. */
  readonly applySystemPreset?: (plan: GenreBlankProjectSystemPresetPlan) => Promise<unknown>;
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

/** prefers-reduced-motion: reduce — CSS transitions only. */
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

function preloadCardImages(): void {
  if (typeof Image === "undefined") return;
  for (const card of DIRECTOR_BRIEFING_CARDS) {
    const img = new Image();
    img.decoding = "async";
    img.src = card.thumb;
  }
}

function syncBriefingPosition(root: HTMLElement): void {
  const canvas =
    document.querySelector<HTMLElement>("[data-testid='editor-canvas-scroll-shell']")
    ?? document.querySelector<HTMLElement>(".canvas-area");
  const rect = canvas?.getBoundingClientRect();
  root.style.position = "fixed";
  if (!rect || rect.width < 80 || rect.height < 80) {
    root.style.inset = "0";
    root.style.width = "";
    root.style.height = "";
    return;
  }
  root.style.top = `${rect.top}px`;
  root.style.left = `${rect.left}px`;
  root.style.width = `${rect.width}px`;
  root.style.height = `${rect.height}px`;
  root.style.right = "auto";
  root.style.bottom = "auto";
}

/**
 * Mount the canvas briefing under `host` and resolve when the user starts or skips.
 * Always removes the overlay. Start sends to the current map — it does not mint a blank project.
 */
export function presentEditorWelcome(
  host: HTMLElement,
  options: EditorWelcomeOptions = {},
): Promise<EditorWelcomeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const reduceMotion = prefersReducedMotion();
    preloadCardImages();

    const promptInput = el("input", {
      class: "editor-welcome-prompt-input",
      attrs: {
        type: "text",
        placeholder: "예: 눈 내리는 마을에 여관이 있고, 여관 주인이 잠을 팔아요",
        autocomplete: "off",
        "aria-label": "만들고 싶은 게임",
      },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.promptInput },
    }) as HTMLInputElement;

    const root = el("div", {
      class: reduceMotion
        ? "editor-welcome editor-welcome-briefing is-reduced-motion"
        : "editor-welcome editor-welcome-briefing",
      attrs: { role: "presentation" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.host },
    });

    const settle = (result: EditorWelcomeResult): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("director-briefing-open");
      if (result.dismiss) setEditorWelcomeDismissed(true);
      root.remove();
      resolve(result);
    };

    const startFreeText = (label: string): void => {
      const trimmed = label.trim();
      if (!trimmed) return;
      settle({
        intent: trimmed,
        prompt: buildWelcomeFreeTextPrompt(trimmed),
        autoSend: true,
        replaceWithBlank: false,
        source: "free-text",
        dismiss: true,
        action: "start",
      });
    };

    const startPreset = (presetId: WelcomeGenrePresetId, label: string): void => {
      const preset = WELCOME_GENRE_PRESETS.find((entry) => entry.id === presetId);
      if (!preset) return;
      settle({
        intent: label,
        prompt: buildWelcomeGenrePresetPrompt(preset),
        autoSend: true,
        replaceWithBlank: false,
        presetId,
        source: "chip",
        dismiss: true,
        action: "start",
      });
    };

    let applyingSystemPreset = false;
    const systemPresetError = el("p", {
      class: "editor-welcome-system-preset-error",
      attrs: { role: "alert", "aria-live": "polite", hidden: "" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.systemPresetError },
    });

    const startManualPreset = async (presetId: WelcomeGenrePresetId, label: string): Promise<void> => {
      if (applyingSystemPreset) return;
      const systemPresetPlan = welcomeGenreSystemPresetPlanById(presetId);
      const confirmed = await showConfirm({
        title: "빈 프로젝트에 시스템 프리셋 적용",
        message: "현재 프로젝트를 먼저 저장한 뒤, 선택한 시스템 설정으로 별도 프로젝트를 만들고 재로드를 확인합니다.",
        confirmLabel: "저장하고 새 프로젝트 만들기",
      });
      if (!confirmed || settled) return;
      if (!options.applySystemPreset) {
        systemPresetError.hidden = false;
        systemPresetError.textContent = "원격 저장 경로를 준비하지 못했습니다. 프로젝트 연결을 확인하세요.";
        return;
      }
      applyingSystemPreset = true;
      systemPresetError.hidden = true;
      systemPresetError.textContent = "";
      const controls = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
      controls.forEach((button) => { button.disabled = true; });
      try {
        await options.applySystemPreset(systemPresetPlan);
        if (settled) return;
        settle({
          intent: label,
          prompt: null,
          autoSend: false,
          replaceWithBlank: false,
          presetId,
          source: "manual-system-preset",
          systemPresetPlan,
          dismiss: true,
          action: "start",
        });
      } catch {
        systemPresetError.hidden = false;
        systemPresetError.textContent = "새 프로젝트 저장과 재확인을 완료하지 못했습니다. 현재 프로젝트는 그대로 유지됩니다.";
      } finally {
        applyingSystemPreset = false;
        if (!settled) controls.forEach((button) => { button.disabled = false; });
      }
    };

    const finishSkip = (): void => {
      settle({
        intent: null,
        prompt: null,
        autoSend: false,
        replaceWithBlank: false,
        dismiss: true,
        action: "skip",
      });
    };

    const submit = el("button", {
      class: "editor-welcome-prompt-submit",
      text: "만들기",
      attrs: { type: "button" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.promptSubmit },
      on: {
        click: () => startFreeText(promptInput.value),
      },
    });

    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        startFreeText(promptInput.value);
      }
    });

    const cards = el("div", {
      class: "editor-welcome-briefing-cards",
      children: DIRECTOR_BRIEFING_CARDS.map((card, index) =>
        el("div", {
          class: "editor-welcome-template-option",
          dataset: { packId: card.packId },
          children: [
            el("button", {
              class: "editor-welcome-template-card",
              attrs: {
                type: "button",
                "aria-label": `${card.label} — ${card.blurb}`,
              },
              dataset: {
                testid: `${EDITOR_WELCOME_TESTIDS.templateCard}-${index}`,
                templateId: card.id,
              },
              on: {
                click: () => startPreset(card.id, card.label),
              },
              children: [
                el("span", {
                  class: "editor-welcome-template-thumb",
                  attrs: { style: `background-image:url('${card.thumb}')` },
                }),
                el("span", { class: "editor-welcome-template-label", text: card.label }),
                el("span", { class: "editor-welcome-template-blurb", text: card.blurb }),
              ],
            }),
            ...(card.inspirationPresetIds.length > 0
              ? [
                  el("div", {
                    class: "editor-welcome-card-inspirations",
                    dataset: { testid: EDITOR_WELCOME_TESTIDS.inspirationStrip },
                    children: card.inspirationPresetIds.map((presetId) => {
                      const preset = welcomeGenrePresetById(presetId);
                      if (!preset) throw new Error(`Unknown welcome inspiration preset: ${presetId}`);
                      return el("button", {
                        class: "editor-welcome-card-inspiration",
                        text: preset.label,
                        attrs: {
                          type: "button",
                          "aria-label": `${card.label} 영감: ${preset.label}`,
                        },
                        dataset: { presetId: preset.id },
                        on: { click: () => startPreset(preset.id, preset.label) },
                      });
                    }),
                  }),
                ]
              : []),
            el("button", {
              class: "editor-welcome-template-starter",
              text: "빈 프로젝트 시스템 설정",
              attrs: { type: "button", "aria-label": `${card.label} 빈 프로젝트 시스템 프리셋 적용` },
              dataset: {
                testid: `${EDITOR_WELCOME_TESTIDS.starterCard}-${index}`,
                templateId: card.id,
              },
              on: { click: () => void startManualPreset(card.id, card.label) },
            }),
          ],
        }),
      ),
    });

    const stage = el("div", {
      class: "editor-welcome-stage",
      attrs: {
        role: "dialog",
        "aria-labelledby": "editor-welcome-title",
        "aria-modal": "true",
      },
      children: [
        el("p", { class: "editor-welcome-kicker", text: "감독" }),
        el("h1", {
          class: "editor-welcome-title",
          text: "어떤 게임을 만들까요?",
          attrs: { id: "editor-welcome-title" },
        }),
        el("p", {
          class: "editor-welcome-sub",
          text: "한 문장으로 지시하면 이 맵에 초안이 생깁니다. 도구 설명은 결과가 찍힌 뒤에 합니다.",
        }),
        el("div", {
          class: "editor-welcome-prompt-row",
          children: [promptInput, submit],
        }),
        cards,
        systemPresetError,
        el("button", {
          class: "editor-welcome-skip",
          text: "빈 맵으로 시작",
          attrs: { type: "button" },
          dataset: { testid: EDITOR_WELCOME_TESTIDS.skip },
          on: { click: () => finishSkip() },
        }),
      ],
    });

    root.append(
      el("div", { class: "editor-welcome-scrim", attrs: { "aria-hidden": "true" } }),
      stage,
    );

    const onResize = (): void => {
      if (!root.isConnected) {
        window.removeEventListener("resize", onResize);
        return;
      }
      syncBriefingPosition(root);
    };
    window.addEventListener("resize", onResize);
    document.body.classList.add("director-briefing-open");
    host.append(root);
    syncBriefingPosition(root);
    queueMicrotask(() => {
      try {
        promptInput.focus();
      } catch {
        /* headless */
      }
    });
  });
}
