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
  welcomeGenrePresetById,
} from "@/editor/welcomeGenrePresets";
import type { GenreBlankProjectSystemPresetPlan } from "@/editor/genrePacks";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import { showProjectInterview } from "@/editor/ui/projectInterviewDialog";
import { showConfirm } from "@/editor/ui/modal";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
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
  /** Visible manual action under a poster — applies the system preset without AI. */
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
  /**
   * 프리셋 포스터를 누르면 기획 인터뷰 **전에** 부른다. AI 가 연결돼 있거나 연결을 마치면 true,
   * 사용자가 「나중에」를 고르면 false(포스터는 아무 일도 하지 않고 첫 화면에 남는다).
   * ⚙ 시스템 프리셋(AI 없이 시작)은 이 관문을 지나지 않는다.
   */
  readonly ensureAiConnected?: (presetLabel: string) => Promise<boolean>;
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

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const settle = (result: EditorWelcomeResult): void => {
      if (settled) return;
      settled = true;
      unregisterModal(root);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("director-briefing-open");
      if (result.dismiss) setEditorWelcomeDismissed(true);
      root.remove();
      if (opener?.isConnected) opener.focus();
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
        el("span", { text: "AI를 연결하면 기획 질문과 자동 제작을 시작할 수 있어요. 직접 만들려면 장르 아래 ‘AI 없이 직접 만들기’를 누르세요." }),
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
      if (autoSend && !options.ensureAiConnected && options.canGenerate && !options.canGenerate()) {
        aiReadinessNotice.hidden = false;
        aiReadinessNotice.scrollIntoView?.({ block: "nearest" });
        aiReadinessNotice.querySelector<HTMLButtonElement>("button")?.focus();
        return;
      }
      aiReadinessNotice.hidden = true;
      const systemPresetPlan = welcomeGenreSystemPresetPlanById(presetId);
      if (!autoSend) {
        const confirmed = await showConfirm({
          title: `${label} 직접 만들기`,
          message: "열려 있는 프로젝트를 이 장르의 빈 맵과 기본 설정으로 바꾸고 저장합니다. AI는 사용하지 않습니다. 시작한 뒤 왼쪽 ‘그리기’에서 타일을 골라 맵을 만들고, 위의 ‘테스트’로 확인하세요.",
          confirmLabel: "빈 맵 준비하고 저장",
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
      // 프리셋 경로는 AI 팀이 첫 생성을 맡는다 — 연결이 없으면 인터뷰를 시작하기 전에 연결부터 안내한다.
      if (autoSend && options.ensureAiConnected) {
        applyingSystemPreset = true;
        let connected = false;
        try {
          connected = await options.ensureAiConnected(label);
        } catch {
          connected = false;
        } finally {
          applyingSystemPreset = false;
        }
        if (!connected || settled) return;
      }
      applyingSystemPreset = true;
      const presetOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      systemPresetError.hidden = true;
      systemPresetError.textContent = "";
      const controls = Array.from(root.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input"));
      controls.forEach((button) => { button.disabled = true; });
      try {
        // 포스터 경로는 별도 확인 창 없이 인터뷰가 곧 확인이다. 확정 단추가 열린 프로젝트를 이 장르의
        // 빈 시작점으로 바꾸고 저장한다는 사실을 말해야 한다(직접 만들기 확인 문구와 같은 뜻).
        const brief = autoSend
          ? await showProjectInterview(presetId, { confirmLabel: "열린 프로젝트를 바꾸고 이 기획으로 시작" })
          : undefined;
        if (brief === null || settled) return;
        const selectedPreset = brief ? welcomeGenrePresetById(brief.presetId)! : preset;
        const selectedPlan = brief ? welcomeGenreSystemPresetPlanById(brief.presetId) : systemPresetPlan;
        preparationNotice.hidden = false;
        await options.applySystemPreset(selectedPlan, brief);
        if (settled) return;
        settle({
          intent: label,
          prompt: autoSend ? buildWelcomeGenrePresetPrompt(selectedPreset, brief) : null,
          ...(autoSend ? { displayText: welcomeGenrePresetDisplayText(selectedPreset, brief) } : {}),
          autoSend: autoSend && (options.canGenerate?.() ?? true),
          presetId: selectedPreset.id,
          source: autoSend ? "chip" : "manual-system-preset",
          ...(autoSend ? {} : { systemPresetPlan }),
          dismiss: true,
          action: "start",
        });
      } catch (error) {
        systemPresetError.hidden = false;
        systemPresetError.textContent = `시작을 완료하지 못했습니다. ${error instanceof Error ? error.message : "프로젝트 저장 연결을 확인한 뒤 다시 시도해 주세요."}`;
      } finally {
        applyingSystemPreset = false;
        preparationNotice.hidden = true;
        if (!settled) {
          controls.forEach((button) => { button.disabled = false; });
          if (presetOpener?.isConnected) presetOpener.focus();
        }
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
              "aria-label": `${preset.label} — AI와 기획하고 만들기. ${preset.blurb}`,
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
            text: "AI 없이 직접 만들기",
            attrs: {
              type: "button",
              "aria-label": `${preset.label} — AI 없이 빈 맵과 기본 설정으로 시작`,
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

    const preparationNotice = el("p", {
      class: "editor-welcome-note", text: "기본 소재를 준비하고 프로젝트를 저장하고 있어요…",
      attrs: { role: "status", "aria-live": "polite", hidden: "" },
      dataset: { testid: "editor-welcome-preparing" },
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
          text: "AI와 만들려면 한 문장을 적거나 포스터를 고르세요. 직접 만들려면 장르 아래 ‘AI 없이 직접 만들기’를 누르세요.",
        }),
        el("div", {
          class: "editor-welcome-prompt-row",
          children: [promptInput, submit],
        }),
        aiReadinessNotice,
        cards,
        el("p", {
          class: "editor-welcome-note",
          text: "포스터: AI와 기획·제작 · 직접 만들기: 빈 맵과 장르 기본 설정",
        }),
        systemPresetError,
        preparationNotice,
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
    const closeWelcome = (): void => {
      if (applyingSystemPreset) registerModal(root, closeWelcome);
      else finishSkip();
    };
    registerModal(root, closeWelcome);
    stage.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !isTopModal(root)) return;
      const controls = Array.from(stage.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"))
        .filter((control) => !control.closest("[hidden]"));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
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
