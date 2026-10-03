import { el } from "@/util/dom";
import { isTopModal, registerModal, unregisterModal } from "./modalStack";
import { GAME_BRIEF_ANSWER_LIMIT, GAME_BRIEF_SUMMARY_LIMIT, normalizeGameDesignBrief,
  type GameDesignAnswer, type GameDesignAnswers, type GameDesignBrief, type GamePresetId } from "@/project/gameDesignBrief";
import { interviewPreset, type GameInterview, type InterviewGenre } from "@/project/gameInterview";
import { INTERVIEW_SCENES, SCENE_SLOTS, blendChoices, cinematicInterviewSummary, interviewSceneUrl, sceneGenre } from "@/editor/cinematicInterviewQuestions";
import type { ProjectInterviewOptions } from "./legacyProjectInterviewDialog";
import "@/styles/shell/dialogs/cinematic-interview.css";
export type { ProjectInterviewOptions } from "./legacyProjectInterviewDialog";

type SceneOption = { id: string; label: string; detail: string; image: string };

/** The production interview. No project writes or model calls until the caller receives confirmation. */
export async function showProjectInterview(presetId: GamePresetId, options: ProjectInterviewOptions = {}): Promise<GameDesignBrief | null> {
  if (typeof document === "undefined" || !document.body) return null;
  // Keep older authored transcripts editable without reinterpreting their questions or dropping answers.
  if (options.initialBrief && !options.initialBrief.interview) {
    const { showLegacyProjectInterview } = await import("./legacyProjectInterviewDialog");
    return showLegacyProjectInterview(presetId, options);
  }
  return new Promise(resolve => {
    const opener = document.activeElement;
    const original = options.initialBrief;
    const draft: GameInterview = original?.interview ? structuredClone(original.interview) : {
      version: 1, genre: presetId === "monster-collect" || presetId === "partner-raise" ? "monster" : presetId === "adventure-jrpg" || presetId === "action-rpg" ? "adventure" : presetId.includes("horror") ? "mystery" : "romance",
      concept: (options.initialAnswer ?? "").slice(0, 1000), protagonist: "", notes: "", choiceIds: {},
    };
    let answers: GameDesignAnswers = original ? structuredClone(original.answers) : {};
    const genreDrafts = new Map<InterviewGenre, { answers: GameDesignAnswers; choiceIds: GameInterview["choiceIds"] }>();
    let step = original ? 99 : -1;
    let closed = false;
    let summaryOverride = original?.summary;
    const basis = () => JSON.stringify({ draft, answers });
    let summaryBasis = basis();
    let sceneToken = 0;
    let sceneKey = "";
    let front = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let motion = !motionPreference.matches;
    const overlay = el("div", { class: "cinematic-interview-backdrop", dataset: { testid: "project-interview" } });
    const panel = el("section", { class: "cinematic-interview", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "project-interview-title" } });
    const background = el("div", { class: "ci-backdrop", attrs: { "aria-hidden": "true" } });
    const video = el("video", { attrs: { src: "/assets/project-interview/world-motion.mp4", poster: "/assets/project-interview/world-poster.webp", loop: "", playsinline: "", preload: "metadata" } });
    video.muted = true;
    const images = [el("img", { attrs: { alt: "", draggable: "false" } }), el("img", { attrs: { alt: "", draggable: "false" } })];
    background.append(video, ...images, el("div", { class: "ci-vignette" }));
    const body = el("div", { class: "ci-body" });
    const caption = el("aside", { class: "ci-scene-caption", children: [
      el("span", { text: "YOUR NEXT STORY" }), el("strong", { text: "선택이 장면이 되는 순간" }),
      el("p", { text: "그림은 분위기 참고용이에요. 주인공과 설정은 직접 고른 답변으로 정해요." }),
    ] });
    const status = el("p", { class: "ci-status", attrs: { role: "status", "aria-live": "polite" } });
    const done = (brief: GameDesignBrief | null) => {
      if (closed) return;
      closed = true; sceneToken++; motionPreference.removeEventListener("change", onMotionPreference); video.pause(); video.removeAttribute("src"); video.load();
      unregisterModal(overlay); overlay.remove(); resolve(brief);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
    const button = (text: string, id: string, action: () => void, primary = false) => el("button", {
      class: `ci-button${primary ? " is-primary" : ""}`, text, attrs: { type: "button" }, dataset: { testid: id }, on: { click: action },
    });
    const syncMotion = () => {
      panel.classList.toggle("is-still", !motion);
      if (motion && !sceneKey) void video.play().catch(() => { /* Poster remains available when autoplay is denied. */ });
      else video.pause();
    };
    const showScene = async (key: string) => {
      if (sceneKey === key) return;
      sceneKey = key;
      const token = ++sceneToken;
      const url = interviewSceneUrl(key);
      const probe = new Image(); probe.src = url;
      try { await probe.decode(); } catch {
        if (!closed && token === sceneToken) {
          // The same choice must be retryable when connectivity returns.
          sceneKey = "";
          status.textContent = "참고 그림을 불러오지 못했어요. 답변은 계속 고를 수 있어요.";
        }
        return;
      }
      if (closed || token !== sceneToken) return;
      const next = 1 - front;
      images[next]!.src = url;
      images[next]!.className = "is-visible";
      images[front]!.className = "";
      front = next; video.pause(); video.hidden = true;
      panel.dataset.scene = key;
      status.textContent = "";
    };
    const fields = (label: string, value: string, id: string, limit: number, update: (text: string) => void, rows = 2) => {
      const input = el("textarea", { class: "ci-input", value, attrs: { id, rows: String(rows), maxlength: String(limit) }, dataset: { testid: id } });
      input.addEventListener("input", () => update(input.value));
      return el("label", { class: "ci-field", attrs: { for: id }, children: [el("span", { text: label }), input] });
    };
    const questions = () => {
      const result = sceneGenre(draft.genre).questions.map(q => ({ ...q, slot: SCENE_SLOTS[q.id]! }));
      return result;
    };
    const steps = () => {
      const list = questions().map(q => q.id);
      if (draft.secondary) list.splice(2, 0, "blend");
      return list;
    };
    const currentImage = () => {
      for (const q of [...questions()].reverse()) {
        const selected = q.options.find(o => o.id === draft.choiceIds[q.slot]);
        if (selected) return selected.image;
      }
      return sceneGenre(draft.genre).image;
    };
    const render = () => {
      if (closed) return;
      body.replaceChildren();
      const ids = steps();
      const summary = step >= ids.length;
      const title = step < 0 ? "어떤 세계를 만들까요?" : summary ? "이제, 당신의 이야기로." : "한 장면씩, 선명하게.";
      body.append(el("header", { class: "ci-header", children: [
        el("div", { children: [el("span", { class: "ci-eyebrow", text: "새 게임 만들기" }), el("h2", { text: title, attrs: { id: "project-interview-title", tabindex: "-1" } })] }),
        button("닫기", "project-interview-cancel", () => done(null)),
      ] }));
      const progress = el("p", { class: "ci-progress", text: step < 0 ? "01 / DIRECTION" : summary ? "마지막 · 게임의 방향 확인" : `${String(step + 1).padStart(2, "0")} / ${ids.length} · ${sceneGenre(draft.genre).label}${draft.secondary ? ` + ${sceneGenre(draft.secondary).label}` : ""}` });
      body.append(progress);
      if (step < 0) {
        body.append(el("p", { class: "ci-hint", text: "마음이 가는 장르를 고르세요. 다른 장르를 섞거나, 내 말로 시작해도 좋아요." }));
        const choices = el("div", { class: "ci-genres" });
        for (const g of INTERVIEW_SCENES) {
          const id = g.id as InterviewGenre;
          const b = button("", `project-interview-genre-${id}`, () => {
            if (id !== draft.genre) {
              genreDrafts.set(draft.genre, { answers, choiceIds: draft.choiceIds });
              draft.genre = id; const saved = genreDrafts.get(id);
              answers = saved?.answers ?? {}; draft.choiceIds = saved?.choiceIds ?? {};
              if (draft.secondary === id) delete draft.secondary;
              delete draft.blend;
            }
            void showScene(g.image); render();
          });
          b.classList.add("ci-genre"); b.setAttribute("aria-pressed", String(id === draft.genre));
          b.disabled = !!original && id !== draft.genre;
          b.append(el("img", { attrs: { src: interviewSceneUrl(g.image), alt: "", loading: "lazy" } }),
            el("span", { children: [el("strong", { text: g.label }), el("small", { text: g.tag })] }));
          choices.append(b);
        }
        body.append(choices);
        const secondary = el("select", { class: "ci-input", attrs: { id: "ci-secondary", "aria-label": "함께 섞을 장르" }, dataset: { testid: "project-interview-secondary" } });
        secondary.append(el("option", { text: "이 장르에 집중하기", attrs: { value: "" } }));
        for (const g of INTERVIEW_SCENES.filter(g => g.id !== draft.genre)) {
          if (original && interviewPreset(draft.genre, g.id as InterviewGenre) !== original.presetId) continue;
          secondary.append(el("option", { text: `${g.label} 함께 섞기`, attrs: { value: g.id } }));
        }
        secondary.value = draft.secondary ?? "";
        // Editing an existing project never silently changes its configured engine.
        if (original && interviewPreset(draft.genre) !== original.presetId) secondary.querySelector("option")!.disabled = true;
        secondary.addEventListener("change", () => { draft.secondary = secondary.value as InterviewGenre || undefined; delete draft.blend; render(); });
        body.append(el("label", { class: "ci-field", attrs: { for: "ci-secondary" }, children: [el("span", { text: "장르 섞기" }), secondary] }),
          fields("떠오르는 아이디어 · 자유롭게", draft.concept, "project-interview-concept", 1000, text => { draft.concept = text; }),
          el("footer", { class: "ci-actions", children: [button("이 방향으로 시작", "project-interview-begin", () => { step = 0; void showScene(sceneGenre(draft.genre).image); render(); }, true)] }));
      } else if (!summary) {
        const id = ids[step]!;
        const q = questions().find(q => q.id === id);
        const blending = id === "blend";
        const title = blending ? "두 장르는 어떻게 이어질까요?" : q!.title;
        const label = blending ? "장르의 연결" : q!.label;
        const choices: SceneOption[] = blending ? blendChoices(draft.genre, draft.secondary!) : q!.options;
        const read = () => blending ? draft.blend : answers[q!.slot];
        let selectedId = blending ? choices.find(o => read()?.text === `${o.label} — ${o.detail}`)?.id : draft.choiceIds[q!.slot];
        body.append(el("h3", { text: title, attrs: { id: "project-interview-question" } }), el("p", { class: "ci-hint", text: blending ? "각 장르에서 하는 일이 하나의 게임 안에 이어져요." : q!.hint }));
        const optionsNode = el("div", { class: "ci-options", attrs: { role: "group", "aria-labelledby": "project-interview-question" } });
        const next = button(step === ids.length - 1 ? "기획 확인하기" : "다음 장면", "project-interview-next", () => { if (!read()?.text.trim()) return; step++; render(); }, true);
        const sync = () => {
          next.disabled = !read()?.text.trim();
          optionsNode.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.optionId === selectedId)));
        };
        const set = (text: string, source: GameDesignAnswer["source"], optionId?: string) => {
          const answer: GameDesignAnswer = { question: title, label, text, source };
          if (blending) draft.blend = answer;
          else { answers[q!.slot] = answer; if (optionId) draft.choiceIds[q!.slot] = optionId; else delete draft.choiceIds[q!.slot]; }
          selectedId = optionId; sync();
        };
        const field = fields("내 말로 답하거나 덧붙이기", read()?.text ?? "", "project-interview-answer", GAME_BRIEF_ANSWER_LIMIT, text => set(text, "user"));
        for (const [index, option] of choices.entries()) {
          const b = button("", `project-interview-option-${index}`, () => {
            const text = `${option.label} — ${option.detail}`;
            set(text, "user", option.id); field.querySelector("textarea")!.value = text; void showScene(option.image);
          });
          b.classList.add("ci-option"); b.dataset.optionId = option.id;
          b.append(el("img", { attrs: { src: interviewSceneUrl(option.image), alt: "", loading: "lazy" } }),
            el("span", { children: [el("strong", { text: option.label }), el("small", { text: option.detail })] }));
          optionsNode.append(b);
        }
        const recommend = button("추천으로 골라 보기", "project-interview-recommend", () => {
          const option = choices[0]!; const text = `${option.label} — ${option.detail}`;
          set(text, "recommended", option.id); field.querySelector("textarea")!.value = text; void showScene(option.image);
          status.textContent = "추천안으로 담았어요. 직접 고칠 수 있어요.";
        });
        body.append(optionsNode, field, recommend, el("footer", { class: "ci-actions", children: [
          button("이전", "project-interview-previous", () => { step--; render(); }), next,
        ] }));
        sync();
        const selected = choices.find(o => o.id === selectedId);
        if (selected) void showScene(selected.image);
      } else {
        void showScene(currentImage());
        const review = el("div", { class: "ci-review" });
        for (const [index, id] of ids.entries()) {
          const q = questions().find(q => q.id === id);
          const a = id === "blend" ? draft.blend : answers[q!.slot];
          const edit = button(`${a?.label ?? "장르의 연결"} · ${a?.text ?? "답변 필요"}${a?.source === "recommended" ? " (추천안)" : ""}`, `project-interview-edit-${q?.slot ?? "blend"}`, () => { step = index; render(); });
          edit.setAttribute("translate", "no"); review.append(edit);
        }
        body.append(el("p", { class: "ci-hint", text: "고른 방향을 확인하세요. 시작하면 AI 조수가 이 기획을 이어받아 첫 구간을 만듭니다." }), review,
          button("장르와 아이디어 다시 보기", "project-interview-edit-genre", () => { step = -1; render(); }));
        const summaryField = fields("우리가 만들 게임", summaryOverride ?? cinematicInterviewSummary(draft, answers), "project-interview-summary", GAME_BRIEF_SUMMARY_LIMIT, text => { summaryOverride = text; summaryBasis = basis(); syncSummary(); }, 7);
        const summaryInput = summaryField.querySelector("textarea")!;
        const warning = el("p", { class: "ci-status", attrs: { role: "status" } });
        const confirm = button(options.confirmLabel ?? "이 기획으로 시작", "project-interview-confirm", () => {
          if (confirm.disabled) return;
          done(normalizeGameDesignBrief({ version: 1, presetId: interviewPreset(draft.genre, draft.secondary), answers, summary: summaryInput.value.trim(), interview: draft }));
        }, true);
        const syncSummary = () => {
          const stale = summaryOverride !== undefined && summaryBasis !== basis();
          const complete = questions().every(q => answers[q.slot]?.text.trim()) && (!draft.secondary || !!draft.blend?.text.trim());
          const tooLong = summaryInput.value.length > GAME_BRIEF_SUMMARY_LIMIT;
          confirm.disabled = stale || !complete || !summaryInput.value.trim() || tooLong;
          warning.textContent = stale ? "답변이 바뀌었어요. 아래 요약을 갱신하거나 직접 고쳐 주세요." : !complete ? "빠진 답변을 먼저 골라 주세요." : tooLong ? "요약을 4,000자 안으로 줄여 주세요. 원래 답변은 별도로 보존돼요." : "";
        };
        const updateExtra = () => { if (summaryOverride === undefined) summaryInput.value = cinematicInterviewSummary(draft, answers); syncSummary(); };
        body.append(fields("주인공 · 정한 내용이 있다면", draft.protagonist, "project-interview-protagonist", 300, text => { draft.protagonist = text; updateExtra(); }),
          fields("추가로 꼭 담고 싶은 것", draft.notes, "project-interview-notes", 1000, text => { draft.notes = text; updateExtra(); }),
          summaryField, warning, el("footer", { class: "ci-actions", children: [button("답변으로 요약 갱신", "project-interview-refresh-summary", () => { summaryOverride = undefined; summaryBasis = basis(); render(); }), confirm] }));
        syncSummary();
      }
      body.append(status);
      body.scrollTop = 0;
      panel.scrollTop = 0;
      body.querySelector<HTMLElement>("#project-interview-title")?.focus({ preventScroll: true });
    };
    const motionButton = button("모션", "project-interview-motion", () => { motion = !motion; syncMotion(); motionButton.setAttribute("aria-pressed", String(motion)); });
    motionButton.classList.add("ci-motion"); motionButton.setAttribute("aria-pressed", String(motion));
    const onMotionPreference = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      motion = false; syncMotion(); motionButton.setAttribute("aria-pressed", "false");
    };
    motionPreference.addEventListener("change", onMotionPreference);
    panel.append(background, caption, body, motionButton); overlay.append(panel); document.body.append(overlay);
    panel.addEventListener("keydown", event => {
      if (event.key !== "Tab" || !isTopModal(overlay)) return;
      const controls = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, select")];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    registerModal(overlay, () => done(null)); syncMotion(); render();
  });
}
