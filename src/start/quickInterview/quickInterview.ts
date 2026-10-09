// 새 게임 · 빠른 인터뷰(2026-10-09). 장르 하나 + 질문 셋을 그림 카드로 고르면 바로 만든다.
//
// 왜: 옛 인터뷰(장르 → 질문 다섯 → 요약 편집)는 길었고, 컨셉 피드로 바뀐 뒤에는 「내 게임을 고르면서 만들기」 입구가 없었다.
// 이제 네 번 누르면 끝난다. 카드마다 그 선택의 장면(인터뷰 배경 은행, cdn.openrpgmaker.com)을 미리 보여 주고,
// 고르면 그 장면이 화면 전체 배경이 된다. 진행 방식·첫 범위(옛 질문 4·5)는 추천안으로 채우고 나중에 「기획 수정」에서 바꾼다.
// 결과는 옛 인터뷰와 같은 GameDesignBrief(interview 포함) — 그다음 경로(generationPending → 첫 생성)는 컨셉 피드와 같다.
//
// 런처 번들에 넣는다 — 편집기 모듈(gameDesignBrief.ts 등)은 정적으로 끌어오지 않는다.
import "./quickInterview.css";
import data from "@/editor/projectInterviewScenes.json";
import { interviewSceneImage } from "@/editor/interviewSceneBank";
import { cinematicInterviewSummary, SCENE_SLOTS } from "@/editor/cinematicInterviewQuestions";
import { interviewPreset, type GameInterview, type InterviewGenre } from "@/project/gameInterview";
import type { GameDesignAnswer, GameDesignAnswers, GameDesignBrief } from "@/project/gameDesignBrief";
import { el } from "@/util/dom";

export const QUICK_INTERVIEW_TESTIDS = {
  root: "quick-interview",
  close: "quick-interview-close",
  back: "quick-interview-back",
  option: "quick-interview-option",
  make: "quick-interview-make",
  note: "quick-interview-note",
  edit: "quick-interview-edit",
  error: "quick-interview-error",
} as const;

type Genre = (typeof data.genres)[number];
type Question = Genre["questions"][number];
type Option = Question["options"][number];

/** 묻는 질문(앞 셋). 나머지는 추천안. */
const ASKED = 3;
const STEP_NAMES = ["장르", "시작", "플레이", "분위기", "만들기"] as const;

export type QuickInterviewOptions = {
  /** 만들기. true = 시작됨(창은 부르는 쪽이 닫는다). false = 취소. 던지면 오류 줄. */
  readonly onMake: (brief: GameDesignBrief, title: string) => Promise<boolean>;
  readonly onClose: () => void;
  readonly initialGenre?: InterviewGenre;
};

export type QuickInterview = { readonly element: HTMLElement; destroy(): void };

const answerText = (o: Option) => `${o.label} — ${o.detail}`;

export function createQuickInterview(options: QuickInterviewOptions): QuickInterview {
  let genre: Genre | undefined = options.initialGenre ? data.genres.find((g) => g.id === options.initialGenre) : undefined;
  let picks: Option[] = [];
  let step = genre ? 1 : 0;
  let busy = false;
  let note = "";
  let front = 0;

  const sceneKey = (g: Genre | undefined, chosen: readonly Option[]) => (g ? [g.id, ...chosen.map((o) => o.id)].join("--") : "opening");
  /** 그 선택까지의 장면 — 아직 없는 장면이면 가장 가까운 앞 장면. */
  const sceneUrl = (g: Genre | undefined, chosen: readonly Option[], size: "full" | "thumb"): string | undefined => {
    for (let n = chosen.length; n >= 0; n -= 1) {
      const url = interviewSceneImage(sceneKey(g, chosen.slice(0, n)), size);
      if (url) return url;
    }
    return g ? interviewSceneImage("opening", size) : undefined;
  };

  const layers = [el("img", { class: "qi-bg is-on", attrs: { alt: "", draggable: "false" } }), el("img", { class: "qi-bg", attrs: { alt: "", draggable: "false" } })];
  const showBackground = (url: string | undefined) => {
    if (!url || layers[front]!.getAttribute("src") === url) return;
    const next = 1 - front;
    const img = layers[next]!;
    img.onload = () => { img.classList.add("is-on"); layers[front]!.classList.remove("is-on"); front = next; };
    img.src = url;
  };

  const stepsBar = el("ol", { class: "qi-steps", attrs: { "aria-label": "진행" } });
  const closeButton = el("button", { class: "qi-icon", text: "✕", attrs: { type: "button", "aria-label": "닫기" }, dataset: { testid: QUICK_INTERVIEW_TESTIDS.close }, on: { click: () => { if (!busy) options.onClose(); } } });
  const backButton = el("button", { class: "qi-back", text: "← 이전", attrs: { type: "button" }, dataset: { testid: QUICK_INTERVIEW_TESTIDS.back }, on: { click: () => back() } });
  const top = el("header", { class: "qi-top", children: [backButton, stepsBar, closeButton] });
  const stage = el("section", { class: "qi-stage", attrs: { "aria-live": "polite" } });
  const root = el("div", {
    class: "qi", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "새 게임 만들기" }, dataset: { testid: QUICK_INTERVIEW_TESTIDS.root },
    children: [...layers, el("div", { class: "qi-shade", attrs: { "aria-hidden": "true" } }), top, stage],
  });

  const back = () => {
    if (busy || step === 0) return;
    step -= 1;
    picks = picks.slice(0, Math.max(0, step - 1));
    if (step === 0) genre = undefined;
    render();
  };

  const choose = (index: number) => {
    if (busy) return;
    if (step === 0) {
      const g = data.genres[index];
      if (!g) return;
      if (genre?.id !== g.id) picks = [];
      genre = g; step = 1;
    } else if (genre && step <= ASKED) {
      const o = genre.questions[step - 1]?.options[index];
      if (!o) return;
      picks = [...picks.slice(0, step - 1), o];
      step += 1;
    } else return;
    render();
  };

  const buildBrief = (): { brief: GameDesignBrief; title: string } => {
    const g = genre!;
    const answers: GameDesignAnswers = {};
    const choiceIds: GameInterview["choiceIds"] = {};
    g.questions.forEach((q, index) => {
      const slot = SCENE_SLOTS[q.id]!;
      const chosen = picks[index];
      const option = chosen ?? q.options[0]!;
      const answer: GameDesignAnswer = { question: q.title, label: q.label, text: answerText(option), source: chosen ? "user" : "recommended" };
      answers[slot] = answer;
      choiceIds[slot] = option.id;
    });
    const interview: GameInterview = { version: 1, genre: g.id as InterviewGenre, concept: note.trim().slice(0, 1000), protagonist: "", notes: "", choiceIds };
    const brief: GameDesignBrief = { version: 1, presetId: interviewPreset(interview.genre), answers: answers as GameDesignBrief["answers"], summary: cinematicInterviewSummary(interview, answers), interview };
    return { brief, title: `${picks[0]?.label ?? g.label}`.slice(0, 80) };
  };

  const optionCard = (index: number, label: string, detail: string, thumb: string | undefined, selected: boolean) =>
    el("button", {
      class: `qi-card${selected ? " is-picked" : ""}`,
      attrs: { type: "button", "aria-pressed": String(selected) },
      dataset: { testid: QUICK_INTERVIEW_TESTIDS.option, index: String(index) },
      on: {
        click: () => choose(index),
        mouseenter: () => { if (thumb) preload(thumb.replace("/thumb/", "/full/")); },
      },
      children: [
        el("span", { class: "qi-thumb", children: [
          ...(thumb ? [el("img", { attrs: { src: thumb, alt: "", loading: "lazy", draggable: "false" } })] : []),
          el("kbd", { class: "qi-key", text: String(index + 1) }),
        ] }),
        el("span", { class: "qi-card-text", children: [el("strong", { text: label }), el("small", { text: detail })] }),
      ],
    });

  const preloaded = new Set<string>();
  const preload = (url: string) => { if (preloaded.has(url)) return; preloaded.add(url); const img = new Image(); img.src = url; };

  const render = () => {
    stepsBar.replaceChildren(...STEP_NAMES.map((name, index) => el("li", {
      class: index < step ? "is-done" : index === step ? "is-now" : "",
      attrs: index === step ? { "aria-current": "step" } : {},
      text: name,
    })));
    backButton.style.visibility = step === 0 ? "hidden" : "";
    showBackground(sceneUrl(genre, picks, "full"));

    if (step === 0) {
      stage.replaceChildren(
        el("p", { class: "qi-eyebrow", text: "새 게임 · 네 번만 고르면 시작해요" }),
        el("h1", { class: "qi-title", text: "어떤 게임을 만들까요?" }),
        el("div", { class: "qi-cards is-four", children: data.genres.map((g, index) => optionCard(index, g.label, g.tag, interviewSceneImage(g.id, "thumb"), genre?.id === g.id)) }),
      );
    } else if (genre && step <= ASKED) {
      const q = genre.questions[step - 1]!;
      const chosen = picks[step - 1];
      stage.replaceChildren(
        el("p", { class: "qi-eyebrow", text: `${genre.label} · ${q.label}` }),
        el("h1", { class: "qi-title", text: q.title }),
        el("div", { class: "qi-cards", children: q.options.map((o, index) => optionCard(index, o.label, o.detail, sceneUrl(genre, [...picks.slice(0, step - 1), o], "thumb"), chosen?.id === o.id)) }),
      );
    } else if (genre) {
      const error = el("p", { class: "qi-error", attrs: { role: "alert" }, dataset: { testid: QUICK_INTERVIEW_TESTIDS.error } });
      const input = el("input", {
        class: "qi-note", value: note,
        attrs: { type: "text", maxlength: "300", placeholder: "더 넣고 싶은 것 한 줄 (선택) — 예: 주인공은 고양이를 키운다" },
        dataset: { testid: QUICK_INTERVIEW_TESTIDS.note },
      });
      input.addEventListener("input", () => { note = input.value; });
      const make = el("button", { class: "qi-make", text: "이 게임 만들기", attrs: { type: "button" }, dataset: { testid: QUICK_INTERVIEW_TESTIDS.make } });
      make.addEventListener("click", () => {
        if (busy) return;
        busy = true; make.disabled = true; make.textContent = "만드는 중…"; error.textContent = "";
        root.setAttribute("aria-busy", "true");
        const { brief, title } = buildBrief();
        void options.onMake(brief, title).then((started) => {
          if (started) return;
          busy = false; make.disabled = false; make.textContent = "이 게임 만들기"; root.removeAttribute("aria-busy");
        }).catch((reason: unknown) => {
          busy = false; make.disabled = false; make.textContent = "이 게임 만들기"; root.removeAttribute("aria-busy");
          error.textContent = reason instanceof Error ? reason.message : String(reason);
        });
      });
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") make.click(); });
      const chips = picks.map((o, index) => el("button", {
        class: "qi-chip", attrs: { type: "button", title: "다시 고르기" }, dataset: { testid: QUICK_INTERVIEW_TESTIDS.edit, index: String(index) },
        on: { click: () => { if (!busy) { step = index + 1; render(); } } },
        children: [el("small", { text: genre!.questions[index]!.label }), el("span", { text: o.label })],
      }));
      stage.replaceChildren(
        el("p", { class: "qi-eyebrow", text: genre.label }),
        el("h1", { class: "qi-title", text: "이 게임을 만들까요?" }),
        el("div", { class: "qi-chips", children: chips }),
        el("div", { class: "qi-final", children: [input, make] }),
        error,
        el("p", { class: "qi-fine", text: "진행 방식과 처음 만들 범위는 추천안으로 정해요. 만든 뒤 「기획 수정」에서 바꿀 수 있어요." }),
      );
      queueMicrotask(() => make.focus());
    }
    stage.querySelector<HTMLElement>(".qi-card.is-picked, .qi-card")?.focus({ preventScroll: true });
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) { if (event.key === "Escape") (event.target as HTMLInputElement).blur(); return; }
    if (event.key === "Escape") { event.stopPropagation(); if (!busy) options.onClose(); return; }
    if (event.key === "Backspace" || event.key === "ArrowLeft" && event.altKey) { event.preventDefault(); back(); return; }
    const n = Number(event.key);
    if (Number.isInteger(n) && n >= 1 && n <= 4) { event.preventDefault(); choose(n - 1); }
  };
  root.addEventListener("keydown", onKey);
  layers[0]!.src = sceneUrl(genre, picks, "full") ?? "";
  render();
  // 장르 넷의 큰 그림은 미리 받아 둔다(고르면 바로 바뀌게).
  for (const g of data.genres) { const url = interviewSceneImage(g.id, "full"); if (url) preload(url); }

  return { element: root, destroy: () => { root.removeEventListener("keydown", onKey); root.remove(); } };
}
