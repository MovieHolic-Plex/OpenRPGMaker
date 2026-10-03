// editor/editorWelcome.ts
// First-visit world previews → the author's first sentence → connection and planning.
// finishEditorBoot wires presentEditorWelcome (mode.ts) after enterMode(edit).

import {
  WELCOME_GENRE_PRESETS,
  buildWelcomeFreeTextPrompt,
  buildWelcomeGenrePresetPrompt,
  welcomeFreeTextDisplayText,
  welcomeGenrePresetDisplayText,
  type WelcomeGenrePresetId,
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
import { createFirstWorldArrival } from "@/start/firstWorldArrival";

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
   * 첫 문장을 제출하면 기획 인터뷰 전에 부른다. 장르 미리보기 선택만으로는 연결하지 않는다.
   * 연결을 미루면 입력과 선택을 유지하고 첫 화면에 남는다. 직접 만들기는 이 관문을 지나지 않는다.
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
 * Mount the first-world stage under `host` and resolve when the user starts or skips.
 * Removes the overlay on success/skip. Presets create a verified project first; free text uses the current map.
 */
export function presentEditorWelcome(
  host: HTMLElement,
  options: EditorWelcomeOptions = {},
): Promise<EditorWelcomeResult> {
  return new Promise((resolve) => {
    let settled = false;
    const reduceMotion = prefersReducedMotion();

    const root = el("div", {
      class: reduceMotion
        ? "editor-welcome editor-welcome-briefing editor-welcome-first-world is-reduced-motion"
        : "editor-welcome editor-welcome-briefing editor-welcome-first-world",
      attrs: { role: "presentation" },
      dataset: { testid: EDITOR_WELCOME_TESTIDS.host },
    });

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const setWelcomeBusy = (busy: boolean): void => {
      root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>("button, textarea").forEach(control => { control.disabled = busy; });
      arrival.setBusy(busy);
    };
    const settle = (result: EditorWelcomeResult): void => {
      if (settled) return;
      settled = true;
      unregisterModal(root);
      arrival.dispose();
      document.body.classList.remove("director-briefing-open");
      if (result.dismiss) setEditorWelcomeDismissed(true);
      root.remove();
      if (opener?.isConnected) opener.focus();
      resolve(result);
    };

    const startFreeText = async (label: string): Promise<void> => {
      const trimmed = label.trim();
      if (!trimmed || applyingSystemPreset) return;
      // AI 가 없으면 보내지 않는다 — 보내면 "의도 읽는 중…" 에서 조용히 멈춘다(실측 30초+).
      // 대신 왜 안 되는지와 어디를 눌러야 하는지를 같은 자리에 띄운다.
      if (!options.ensureAiConnected && options.canGenerate && !options.canGenerate()) {
        aiReadinessNotice.hidden = false;
        aiReadinessNotice.querySelector<HTMLButtonElement>("button")?.focus();
        return;
      }
      aiReadinessNotice.hidden = true;
      if (options.ensureAiConnected) {
        applyingSystemPreset = true;
        setWelcomeBusy(true);
        let connected = false;
        try { connected = await options.ensureAiConnected("내 이야기"); } catch { /* Keep the author's draft. */ }
        finally { applyingSystemPreset = false; if (!settled) setWelcomeBusy(false); }
        if (!connected || settled) { if (!settled) arrival.input.focus(); return; }
      }
      settle({
        intent: trimmed,
        prompt: buildWelcomeFreeTextPrompt(trimmed),
        displayText: welcomeFreeTextDisplayText(trimmed),
        autoSend: options.canGenerate?.() ?? true,
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

    const startPreset = async (presetId: WelcomeGenrePresetId, label: string, autoSend: boolean, firstSentence = ""): Promise<void> => {
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
        setWelcomeBusy(true);
        let connected = false;
        try {
          connected = await options.ensureAiConnected(label);
        } catch {
          connected = false;
        } finally {
          applyingSystemPreset = false;
          if (!settled) setWelcomeBusy(false);
        }
        if (!connected || settled) { if (!settled) arrival.input.focus(); return; }
      }
      applyingSystemPreset = true;
      const presetOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      systemPresetError.hidden = true;
      systemPresetError.textContent = "";
      const controls = Array.from(root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement>("button, input, textarea"));
      controls.forEach((button) => { button.disabled = true; });
      arrival.setBusy(true);
      try {
        // 포스터 경로는 별도 확인 창 없이 인터뷰가 곧 확인이다. 확정 단추가 열린 프로젝트를 이 장르의
        // 빈 시작점으로 바꾸고 저장한다는 사실을 말해야 한다(직접 만들기 확인 문구와 같은 뜻).
        const brief = autoSend
          ? await showProjectInterview(presetId, { initialAnswer: firstSentence, confirmLabel: "열린 프로젝트를 바꾸고 이 기획으로 시작" })
          : undefined;
        if (brief === null || settled) return;
        const selectedPreset = brief ? welcomeGenrePresetById(brief.presetId)! : preset;
        const selectedPlan = brief ? welcomeGenreSystemPresetPlanById(brief.presetId) : systemPresetPlan;
        preparationNotice.hidden = false;
        await options.applySystemPreset(selectedPlan, brief);
        if (settled) return;
        settle({
          intent: firstSentence || selectedPreset.label,
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
          arrival.setBusy(false);
          if (presetOpener?.isConnected) presetOpener.focus();
        }
      }
    };

    const finishSkip = (): void => {
      if (applyingSystemPreset) return;
      settle({
        intent: null,
        prompt: null,
        autoSend: false,
        dismiss: true,
        action: "skip",
      });
    };

    const arrival = createFirstWorldArrival({
      inputTestId: EDITOR_WELCOME_TESTIDS.promptInput,
      submitTestId: EDITOR_WELCOME_TESTIDS.promptSubmit,
      genreTestId: (_choice, index) => `${EDITOR_WELCOME_TESTIDS.templateCard}-${index}`,
      cardsClass: "editor-welcome-briefing-cards",
      onChoice: () => { aiReadinessNotice.hidden = true; systemPresetError.hidden = true; },
      onIntent: () => { aiReadinessNotice.hidden = true; },
      onSubmit: (presetId, text) => {
        const preset = welcomeGenrePresetById(presetId ?? undefined);
        if (preset) void startPreset(preset.id, preset.label, true, text);
        else void startFreeText(text);
      },
      alternative: (preset, index) => el("button", {
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
        "aria-label": "새로운 게임의 시작",
        "aria-modal": "true",
      },
      children: [
        el("div", { class: "editor-welcome-brand", text: "OPRN Studio" }),
        arrival.element,
        aiReadinessNotice,
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

    document.body.classList.add("director-briefing-open");
    host.append(root);
    const closeWelcome = (): void => {
      if (applyingSystemPreset) registerModal(root, closeWelcome);
      else finishSkip();
    };
    registerModal(root, closeWelcome);
    stage.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || !isTopModal(root)) return;
      const controls = Array.from(stage.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled)"))
        .filter((control) => !control.closest("[hidden]"));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    queueMicrotask(() => {
      try {
        arrival.element.querySelector<HTMLButtonElement>("[data-first-world-choice]")?.focus();
      } catch {
        /* headless */
      }
    });
  });
}
