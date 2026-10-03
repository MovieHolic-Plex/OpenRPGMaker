import { el } from "@/util/dom";
import { isTopModal, registerModal, unregisterModal } from "./modalStack";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { projectInterviewQuestions } from "@/editor/projectInterviewQuestions";
import {
  GAME_BRIEF_ANSWER_LIMIT, GAME_BRIEF_SLOTS, GAME_BRIEF_SUMMARY_LIMIT,
  gameDesignSummary, normalizeGameDesignBrief,
  type GameBriefSlot, type GameDesignAnswers, type GameDesignBrief, type GamePresetId,
} from "@/project/gameDesignBrief";
import "@/styles/shell/dialogs/project-interview.css";
import { sourceTextOf } from "@/i18n/domTranslator";

export interface ProjectInterviewOptions {
  initialBrief?: GameDesignBrief;
  confirmLabel?: string;
  /** 첫 질문 입력칸에 미리 담을 사용자 문장(시작 화면의 한 문장). 사용자가 「다음」을 눌러야 답이 된다. */
  initialAnswer?: string;
  /** Bounded reading time for the answer receipt. Zero is useful for deterministic callers. */
  presentationDelayMs?: number;
}

function presentationPause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

/** Draft-only modal: neither selecting, cancelling, nor extracting answers mutates the project. */
export function showLegacyProjectInterview(presetId: GamePresetId, options: ProjectInterviewOptions = {}): Promise<GameDesignBrief | null> {
  if (typeof document === "undefined" || !document.body) return Promise.resolve(null);
  const choice = newProjectChoiceById(presetId);
  if (!choice) return Promise.resolve(null);
  return new Promise(resolve => {
    const opener = document.activeElement;
    const answers: GameDesignAnswers = options.initialBrief ? structuredClone(options.initialBrief.answers) : {};
    const visited: GameBriefSlot[] = [];
    let slot: GameBriefSlot | null = options.initialBrief ? null : GAME_BRIEF_SLOTS[0];
    let summaryOverride = options.initialBrief?.summary;
    let pendingInitialAnswer = options.initialBrief ? "" : options.initialAnswer?.trim().slice(0, GAME_BRIEF_ANSWER_LIMIT) ?? "";
    let closed = false;
    let busy = false;
    let request: AbortController | undefined;
    let notice = "";
    let lastReceipt: { label: string; text: string; next: string } | null = null;
    const presentationMs = Math.min(2400, Math.max(0, options.presentationDelayMs ?? 1200));
    const overlay = el("div", { class: "project-interview-backdrop", dataset: { testid: "project-interview" } });
    const panel = el("section", { class: "project-interview-window", attrs: {
      role: "dialog", "aria-modal": "true", "aria-labelledby": "project-interview-title",
    } });
    const done = (brief: GameDesignBrief | null): void => {
      if (closed) return;
      closed = true;
      request?.abort();
      unregisterModal(overlay);
      overlay.remove();
      resolve(brief);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
    const button = (text: string, testid: string, action: () => void, primary = false): HTMLButtonElement =>
      el("button", { class: `project-interview-button${primary ? " is-primary" : ""}`, text,
        attrs: { type: "button" }, dataset: { testid }, on: { click: action } });
    const render = (): void => {
      if (closed) return;
      const questions = projectInterviewQuestions(presetId, answers);
      const current = questions.find(q => q.slot === slot);
      if (slot && !visited.includes(slot)) visited.push(slot);
      panel.replaceChildren();
      const heading = el("h2", { text: slot ? "어떤 게임을 만들까요?" : "우리가 만들 게임의 방향", attrs: { id: "project-interview-title" } });
      const header = el("header", { class: "project-interview-header", children: [
        el("div", { children: [el("span", { class: "project-interview-kicker", text: choice.label }), heading] }),
        button("취소", "project-interview-cancel", () => done(null)),
      ] });
      const content = el("div", { class: "project-interview-content" });
      const main = el("div", { class: "project-interview-main" });
      const aside = el("aside", { class: "project-interview-aside", children: [
        el("img", { attrs: { src: choice.thumb, alt: `${choice.label} 참고 이미지` } }),
        el("p", { class: "project-interview-caption", text: "프리셋은 출발점이에요. 답변에 맞춰 분위기와 진행을 바꿀 수 있어요." }),
      ] });
      const progress = el("ol", { class: "project-interview-progress", attrs: { "aria-label": "게임 기획 진행" }, children: questions.map(q => el("li", {
        class: answers[q.slot] ? "is-complete" : q.slot === slot ? "is-current" : "", text: q.label,
        attrs: { ...(q.slot === slot ? { "aria-current": "step" } : {}) },
      })) });
      const answersList = el("dl", { class: "project-interview-answers" });
      questions.forEach(q => {
        const answer = answers[q.slot];
        answersList.append(el("div", { class: answer ? "is-answered" : "", children: [
          el("dt", { text: q.label }),
          el("dd", { text: answer ? `${answer.text}${answer.source === "recommended" ? " · 추천안" : ""}` : "아직 정하지 않았어요", attrs: answer ? { translate: "no" } : {} }),
        ] }));
      });
      aside.append(el("h3", { class: "project-interview-outline-title", text: "쌓여 가는 게임 기획" }), answersList);
      const status = el("p", { class: "project-interview-status", text: notice, attrs: { role: "status" } });
      if (current && slot) {
        const activeSlot = slot;
        const count = el("p", { class: "project-interview-count", text: `질문 ${visited.indexOf(slot) + 1} / 최대 5 · 이미 답한 내용은 건너뛰어요` });
        const question = el("h3", { text: current.title, attrs: { id: "project-interview-question" } });
        let selected = answers[slot]?.text ?? (slot === GAME_BRIEF_SLOTS[0] ? pendingInitialAnswer : "");
        pendingInitialAnswer = "";
        let source = answers[slot]?.source ?? "user";
        const choices = el("div", { class: "project-interview-options", attrs: { role: "group", "aria-labelledby": "project-interview-question" } });
        const input = el("textarea", { class: "project-interview-input", value: selected,
          attrs: { id: "project-interview-answer", rows: "3", maxlength: String(GAME_BRIEF_ANSWER_LIMIT), placeholder: "원하는 변주나 이미 정한 진행·분량을 함께 적어도 좋아요." },
          dataset: { testid: "project-interview-answer" } });
        const advance = button("다음", "project-interview-next", () => void submit(), true);
        advance.disabled = !selected.trim();
        const sync = (): void => {
          advance.disabled = busy || !selected.trim();
          choices.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.setAttribute("aria-pressed", String(sourceTextOf(b) === selected)));
        };
        current.choices.forEach((text, index) => {
          const option = button(text, `project-interview-option-${index}`, () => {
            selected = text; source = "user"; input.value = text; sync();
          });
          option.setAttribute("aria-pressed", String(selected === text));
          choices.append(option);
        });
        input.addEventListener("input", () => { selected = input.value; source = "user"; sync(); });
        const setBusy = (value: boolean): void => {
          busy = value;
          main.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>("button, textarea").forEach(b => { b.disabled = value; });
          sync();
        };
        const submit = async (): Promise<void> => {
          if (busy || !selected.trim()) return;
          setBusy(true);
          request = new AbortController();
          const signal = request.signal;
          const text = selected.trim();
          const before = projectInterviewQuestions(presetId, answers)[3]?.title;
          answers[activeSlot] = { question: current.title, label: current.label, text, source };
          // A changed premise can invalidate a dependent answer. Ask that slot again, within the same five slots.
          if (activeSlot === "experience" && before !== projectInterviewQuestions(presetId, answers)[3]?.title) delete answers.detail;
          notice = "";
          const remaining = projectInterviewQuestions(presetId, answers).filter(q => !answers[q.slot]);
          const phaseTitle = el("strong", { text: "답변을 확인하고 있어요", attrs: { role: "status" }, dataset: { testid: "project-interview-phase" } });
          const phases = ["답변 확인", "기획에 반영", remaining.length ? "다음 질문 준비" : "게임 기획 요약"];
          const phaseNodes = phases.map((label, index) => el("li", { text: label, class: index === 0 ? "is-current" : "" }));
          const receipt = el("section", { class: "project-interview-receipt", attrs: { "aria-label": "답변 반영 과정" }, dataset: { testid: "project-interview-receipt" }, children: [
            el("span", { class: "project-interview-receipt-label", text: "이번 답변 · " + current.label }),
            el("blockquote", { text, attrs: { translate: "no" } }),
            phaseTitle,
            el("ol", { class: "project-interview-phases", children: phaseNodes }),
          ] });
          const phase = (index: number, label: string) => {
            if (closed || signal.aborted) return;
            phaseTitle.textContent = label;
            phaseNodes.forEach((node, i) => { node.className = i < index ? "is-complete" : i === index ? "is-current" : ""; });
          };
          const present = async () => {
            if (presentationMs <= 0) return;
            main.replaceChildren(count, receipt, status);
            panel.setAttribute("aria-busy", "true");
            await presentationPause(presentationMs / 2, signal);
            phase(1, "선택한 방향을 기획에 담고 있어요");
            await presentationPause(presentationMs / 2, signal);
          };
          const presentation = present();
          if (source === "user" && !current.choices.includes(text) && remaining.length > 0) {
            const extractionRequest = new AbortController();
            const cancelExtraction = () => extractionRequest.abort();
            signal.addEventListener("abort", cancelExtraction, { once: true });
            const timer = setTimeout(() => extractionRequest.abort(), 12000);
            status.textContent = "함께 적어 준 내용 중 이미 답한 항목을 정리하고 있어요…";
            try {
              const { extractAdditionalInterviewAnswers } = await import("@/ai/projectInterviewAnswers");
              if (closed || signal.aborted) return;
              const extra = await extractAdditionalInterviewAnswers(text, remaining, extractionRequest.signal);
              if (closed) return;
              for (const q of remaining) {
                const value = extra[q.slot];
                if (value) answers[q.slot] = { question: q.title, label: q.label, text: value, source: "user" };
              }
              if (Object.keys(extra).length) notice = "함께 적어 준 답은 반영했어요. 마지막 요약에서 모두 수정할 수 있어요.";
            } catch {
              notice = "답변은 유지했어요. 나머지는 한 가지씩 정할게요.";
            } finally { clearTimeout(timer); signal.removeEventListener("abort", cancelExtraction); }
          }
          if (presentationMs > 0) await presentation;
          if (closed || signal.aborted) return;
          slot = GAME_BRIEF_SLOTS.find(key => !answers[key]) ?? null;
          const nextQuestion = projectInterviewQuestions(presetId, answers).find(q => q.slot === slot);
          lastReceipt = { label: current.label, text, next: nextQuestion?.title ?? "답변을 모아 게임 기획을 확인해요." };
          phase(2, slot ? "다음 질문을 준비했어요" : "게임 기획을 정리했어요");
          // The third state is a readable handoff, rather than a flash between two questions.
          if (presentationMs > 0) await presentationPause(450, signal);
          if (closed || signal.aborted) return;
          busy = false;
          panel.removeAttribute("aria-busy");
          render();
        };
        const recommend = button("아직 모르겠어요 · 추천받기", "project-interview-recommend", () => {
          selected = current.choices[0] ?? "첫 장면부터 작게 시작";
          source = "recommended"; input.value = selected; sync();
          status.textContent = "추천을 골랐어요. 직접 고치거나 ‘다음’을 눌러 반영하세요.";
        });
        const previous = button("이전", "project-interview-previous", () => {
          const index = GAME_BRIEF_SLOTS.indexOf(activeSlot);
          slot = GAME_BRIEF_SLOTS[index - 1] ?? GAME_BRIEF_SLOTS[0]; render();
        });
        previous.disabled = activeSlot === GAME_BRIEF_SLOTS[0];
        if (lastReceipt) main.append(el("section", { class: "project-interview-last-receipt", children: [
          el("strong", { text: lastReceipt.label + " · 기획에 반영했어요" }),
          el("p", { text: lastReceipt.text, attrs: { translate: "no" } }),
        ] }));
        main.append(count, question, el("p", { class: "project-interview-hint", text: current.hint }), choices,
          el("label", { text: "내 말로 답하기", attrs: { for: "project-interview-answer" } }), input,
          el("div", { class: "project-interview-actions", children: [recommend, previous, advance] }), status);
      } else {
        const summary = el("textarea", { class: "project-interview-input project-interview-summary",
          value: summaryOverride ?? gameDesignSummary(answers).slice(0, GAME_BRIEF_SUMMARY_LIMIT),
          attrs: { id: "project-interview-summary", rows: "9", maxlength: String(GAME_BRIEF_SUMMARY_LIMIT) },
          dataset: { testid: "project-interview-summary" } });
        const confirm = button(options.confirmLabel ?? "이 기획으로 시작", "project-interview-confirm", () => {
          done(normalizeGameDesignBrief({ version: 1, presetId, answers, summary: summary.value.trim() }));
        }, true);
        summary.addEventListener("input", () => { summaryOverride = summary.value; confirm.disabled = !summary.value.trim(); });
        const edit = el("div", { class: "project-interview-edit-answers", children: questions.map(q =>
          button(`${q.label} 수정`, `project-interview-edit-${q.slot}`, () => { slot = q.slot; render(); })) });
        main.append(el("p", { class: "project-interview-hint", text: "핵심 행동·분위기·진행·첫 제작 범위를 확인해 주세요. 아래 요약을 고치면 수정한 내용이 생성에 우선 반영됩니다. 추천안은 구별해서 남깁니다." }),
          el("label", { text: "게임 기획 요약", attrs: { for: "project-interview-summary" } }), summary, edit,
          el("div", { class: "project-interview-actions", children: [
            button("답변으로 요약 갱신", "project-interview-refresh-summary", () => { summaryOverride = undefined; render(); }), confirm,
          ] }), status);
      }
      content.append(main, aside); panel.append(header, progress, content);
      // Focus a real control after each transition; Tab stays in this modal.
      panel.querySelector<HTMLElement>(slot ? ".project-interview-options button" : "textarea")?.focus();
    };
    panel.addEventListener("keydown", event => {
      if (event.key !== "Tab" || !isTopModal(overlay)) return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)"));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    overlay.addEventListener("click", event => { if (event.target === overlay) done(null); });
    overlay.append(panel); document.body.append(overlay); registerModal(overlay, () => done(null)); render();
  });
}
