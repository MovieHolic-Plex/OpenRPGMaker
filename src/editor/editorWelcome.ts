// editor/editorWelcome.ts
// First-visit director briefing: one question on the live map, then the 감독 console.
// finishEditorBoot wires presentEditorWelcome (mode.ts) after enterMode(edit).

import {
  WELCOME_FEATURED_POSTER_CARDS,
  WELCOME_GENRE_PRESETS,
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  welcomeFreeTextDisplayText,
  welcomeGenrePresetDisplayText,
  type WelcomeGenrePresetId,
  type WelcomePosterCard,
  welcomeGenreSystemPresetPlanById,
} from "@/editor/welcomeGenrePresets";
import type { GenreBlankProjectSystemPresetPlan } from "@/editor/genrePacks";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import { showProjectInterview } from "@/editor/ui/projectInterviewDialog";
import { showConfirm } from "@/editor/ui/modal";
import { readProjectFromUrl } from "@/project/projectUrl";
import { el } from "@/util/dom";
import { isAutomationBootContext } from "@/editor/automationBootContext";

export { isAutomationBootContext };

export const EDITOR_WELCOME_DISMISSED_KEY = "oprn:editor-welcome-dismissed";

export const EDITOR_WELCOME_TESTIDS = {
  host: "editor-welcome",
  skip: "editor-welcome-skip",
  systemPresetError: "editor-welcome-system-preset-error",
  aiNotice: "editor-welcome-ai-notice",
  aiNoticeAction: "editor-welcome-ai-notice-action",
  promptInput: "editor-welcome-prompt-input",
  promptSubmit: "editor-welcome-prompt-submit",
  /** Poster button for a start-surface genre. */
  templateCard: "editor-welcome-template-card",
  /** Gear on a poster — applies that pack's system preset without AI. */
  starterCard: "editor-welcome-starter-card",
} as const;

export type EditorWelcomeAction = "start" | "skip";

export type EditorWelcomeResult = {
  readonly intent: string | null;
  /** Full AI prompt sent to the 감독 console for the current map. */
  readonly prompt: string | null;
  /** 조수 말풍선·입력창에 보일 사용자 쪽 문장. `prompt` 의 내부 지시문은 보이지 않는다. */
  readonly displayText?: string;
  readonly autoSend: boolean;
  readonly presetId?: WelcomeGenrePresetId;
  readonly source?: "chip" | "free-text" | "manual-system-preset";
  readonly systemPresetPlan?: GenreBlankProjectSystemPresetPlan;
  readonly dismiss: boolean;
  readonly action: EditorWelcomeAction;
};

export type EditorWelcomeOptions = {
  /** Creates and verifies the preset project before either manual completion or AI handoff. */
  readonly applySystemPreset?: (plan: GenreBlankProjectSystemPresetPlan, brief?: GameDesignBrief) => Promise<unknown>;
  /**
   * AI 로 초안을 만들 수 있는 상태인가. false 면 "만들기" 를 받지 않고 설정으로 안내한다.
   *
   * 왜 필요한가 (2026-09-22 실측): 브리핑은 AI 준비 여부를 보지 않았고, 미설정 상태에서
   * "만들기" 를 누르면 채팅 패널이 "의도 읽는 중…" 에서 30초 넘게 멈췄다. 실패 토스트조차
   * 뜨지 않아 초심자에게는 앱이 고장난 것으로 보인다. 없는 능력을 약속하지 않는다.
   */
  readonly canGenerate?: () => boolean;
  /** AI 설정을 열어 준다. 안내 문구의 버튼이 부른다. */
  readonly openAiSettings?: () => void;
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

/**
 * Poster art. `loading="lazy"` matters here: the second tier stays collapsed, and each source PNG is
 * ~1MB, so the browser must not fetch the ten hidden tiles until the user opens them.
 */
function posterImage(src: string): HTMLElement {
  // alt="" — the enclosing button already carries the accessible name, so the art is decorative.
  return el("img", {
    class: "editor-welcome-poster-img",
    attrs: { src, alt: "", loading: "lazy", decoding: "async", draggable: "false" },
  });
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
 * Removes the overlay on success/skip. Presets create a verified project first; free text uses the current map.
 */
export function presentEditorWelcome(
  host: HTMLElement,
  options: EditorWelcomeOptions = {},
): Promise<EditorWelcomeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const reduceMotion = prefersReducedMotion();

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
      if (!trimmed || applyingSystemPreset) return;
      // AI 가 없으면 보내지 않는다 — 보내면 "의도 읽는 중…" 에서 조용히 멈춘다(실측 30초+).
      // 대신 왜 안 되는지와 어디를 눌러야 하는지를 같은 자리에 띄운다.
      if (options.canGenerate && !options.canGenerate()) {
        aiReadinessNotice.hidden = false;
        return;
      }
      aiReadinessNotice.hidden = true;
      settle({
        intent: trimmed,
        prompt: buildWelcomeFreeTextPrompt(trimmed),
        displayText: welcomeFreeTextDisplayText(trimmed),
        autoSend: true,
        source: "free-text",
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

    /**
     * AI 가 준비되지 않았을 때 "만들기" 옆에 뜨는 안내. 문구는 **다음 행동**을 말한다 —
     * "AI 설정이 필요합니다" 만으로는 초심자가 어디를 눌러야 하는지 알 수 없다.
     */
    const aiReadinessNotice = el("div", {
      class: "editor-welcome-ai-notice",
      attrs: { role: "status", "aria-live": "polite", hidden: "" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.aiNotice },
      children: [
        el("span", { text: "AI 연결이 없어 초안을 만들 수 없습니다. 장르 카드의 ⚙ 로 AI 없이 시작할 수 있습니다." }),
        el("button", {
          class: "editor-welcome-ai-notice-action",
          text: "AI 설정 열기",
          attrs: { type: "button" },
          dataset: { testid: EDITOR_WELCOME_TESTIDS.aiNoticeAction },
          on: { click: () => options.openAiSettings?.() },
        }),
      ],
    });

    const startPreset = async (presetId: WelcomeGenrePresetId, label: string, autoSend: boolean): Promise<void> => {
      if (applyingSystemPreset) return;
      const systemPresetPlan = welcomeGenreSystemPresetPlanById(presetId);
      if (!autoSend) {
        const confirmed = await showConfirm({
          title: "빈 프로젝트에 시스템 프리셋 적용",
          message: "열려 있는 프로젝트를 선택한 장르의 빈 맵과 시스템 설정으로 바꾸고 저장합니다.",
          confirmLabel: "시스템 설정 적용하고 저장",
        });
        if (!confirmed || settled || applyingSystemPreset) return;
      }
      const preset = WELCOME_GENRE_PRESETS.find((entry) => entry.id === presetId);
      if (!preset || settled) return;
      if (!options.applySystemPreset) {
        systemPresetError.hidden = false;
        systemPresetError.textContent = "원격 저장 경로를 준비하지 못했습니다. 프로젝트 연결을 확인하세요.";
        return;
      }
      applyingSystemPreset = true;
      systemPresetError.hidden = true;
      systemPresetError.textContent = "";
      const controls = Array.from(root.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input"));
      controls.forEach((button) => { button.disabled = true; });
      try {
        const brief = autoSend ? await showProjectInterview(presetId) : undefined;
        if (brief === null || settled) return;
        await options.applySystemPreset(systemPresetPlan, brief);
        if (settled) return;
        settle({
          intent: label,
          prompt: autoSend ? buildWelcomeGenrePresetPrompt(preset, brief) : null,
          ...(autoSend ? { displayText: welcomeGenrePresetDisplayText(preset, brief) } : {}),
          autoSend: autoSend && (options.canGenerate?.() ?? true),
          presetId,
          source: autoSend ? "chip" : "manual-system-preset",
          ...(autoSend ? {} : { systemPresetPlan }),
          dismiss: true,
          action: "start",
        });
      } catch {
        systemPresetError.hidden = false;
        systemPresetError.textContent = "프로젝트 저장을 완료하지 못해 생성을 시작하지 않았습니다. 저장 연결을 확인한 뒤 다시 시도해 주세요.";
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

    const renderPosterOption = (card: WelcomePosterCard, index: number): HTMLElement => {
      const { preset } = card;
      return el("div", {
        class: "editor-welcome-template-option",
        // Anchor posters carry data-pack-id; sibling variants of an already-anchored pack do not,
        // which keeps "each official pack once" true without demoting the variant visually.
        dataset: {
          presetId: preset.id,
          ...(card.packAnchor ? { packId: card.packAnchor } : {}),
        },
        children: [
          el("button", {
            class: "editor-welcome-template-card editor-welcome-poster",
            attrs: {
              type: "button",
              "aria-label": `${preset.label} — ${preset.blurb}`,
            },
            dataset: {
              testid: `${EDITOR_WELCOME_TESTIDS.templateCard}-${index}`,
              templateId: preset.id,
            },
            on: {
              click: () => void startPreset(preset.id, preset.label, true),
            },
            children: [
              posterImage(preset.thumb),
              el("span", { class: "editor-welcome-poster-veil", attrs: { "aria-hidden": "true" } }),
              el("span", {
                class: "editor-welcome-poster-text",
                children: [
                  ...(card.reference
                    ? [el("span", { class: "editor-welcome-poster-eyebrow", text: card.reference })]
                    : []),
                  el("span", { class: "editor-welcome-poster-title", text: card.title }),
                  el("span", { class: "editor-welcome-poster-blurb", text: preset.blurb }),
                ],
              }),
            ],
          }),
          el("button", {
            class: "editor-welcome-poster-system",
            text: "⚙",
            attrs: {
              type: "button",
              title: `${preset.label} — AI 없이 시스템 설정만 적용`,
              "aria-label": `${preset.label} 빈 프로젝트 시스템 프리셋만 적용 (AI 생성 없음)`,
            },
            dataset: {
              testid: `${EDITOR_WELCOME_TESTIDS.starterCard}-${index}`,
              templateId: preset.id,
            },
            on: { click: () => void startPreset(preset.id, preset.label, false) },
          }),
        ],
      });
    };

    const cards = el("div", {
      class: "editor-welcome-briefing-cards",
      children: WELCOME_FEATURED_POSTER_CARDS.map((card, index) => renderPosterOption(card, index)),
    });

    const stage = el("div", {
      class: "editor-welcome-stage",
      attrs: {
        role: "dialog",
        "aria-labelledby": "editor-welcome-title",
        "aria-modal": "true",
      },
      children: [
        el("p", { class: "editor-welcome-kicker", text: "새 게임" }),
        el("h1", {
          class: "editor-welcome-title",
          text: "어떤 게임을 만들까요?",
          attrs: { id: "editor-welcome-title" },
        }),
        el("p", {
          class: "editor-welcome-sub",
          text: "만들고 싶은 게임을 한 문장으로 적어 주세요. AI가 맵과 인물, 이야기를 만들어 드려요.",
        }),
        el("div", {
          class: "editor-welcome-prompt-row",
          children: [promptInput, submit],
        }),
        aiReadinessNotice,
        cards,
        el("p", {
          class: "editor-welcome-note",
          text: "포스터 오른쪽 위 ⚙ 는 AI 생성 없이 그 장르의 시스템 설정만 적용합니다.",
        }),
        systemPresetError,
        el("div", {
          class: "editor-welcome-footer",
          children: [
            el("button", {
              class: "editor-welcome-skip",
              text: "빈 맵으로 시작",
              attrs: { type: "button" },
              dataset: { testid: EDITOR_WELCOME_TESTIDS.skip },
              on: { click: () => finishSkip() },
            }),
          ],
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
