import { el } from "@/util/dom";
import { isTopModal, registerModal, unregisterModal } from "./modalStack";
import { GAME_BRIEF_ANSWER_LIMIT, GAME_BRIEF_SUMMARY_LIMIT, normalizeGameDesignBrief,
  type GameDesignAnswer, type GameDesignAnswers, type GameDesignBrief, type GamePresetId } from "@/project/gameDesignBrief";
import { interviewPreset, type GameInterview, type InterviewGenre } from "@/project/gameInterview";
import { INTERVIEW_SCENES, SCENE_SLOTS, blendChoices, cinematicInterviewSummary, sceneGenre } from "@/editor/cinematicInterviewQuestions";
import { generateInterviewScene, interviewArtPrompt } from "@/editor/interviewSceneGeneration";
import type { ProjectInterviewOptions } from "./legacyProjectInterviewDialog";
import "@/styles/shell/dialogs/cinematic-interview.css";
export type { ProjectInterviewOptions } from "./legacyProjectInterviewDialog";

type SceneOption = { id: string; label: string; detail: string; image: string };

/** The production interview generates ephemeral art. Project writes start only after confirmation. */
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
    let sceneAbort: AbortController | undefined;
    let sceneTimer: ReturnType<typeof setTimeout> | undefined;
    let latestFocus = "새로운 세계의 첫 풍경";
    let front = 0;
    let acceptedScene = false;
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
    const top = el("div", { class: "ci-top" });
    const navigation = el("div", { class: "ci-navigation" });
    const controls = el("div", { class: "ci-controls", children: [top, body, navigation] });
    const caption = el("aside", { class: "ci-scene-caption", children: [
      el("span", { text: "YOUR NEXT STORY" }), el("strong", { text: "당신이 고른 세계" }),
    ] });
    const status = el("p", { class: "ci-status", attrs: { role: "status", "aria-live": "polite" } });
    const done = (brief: GameDesignBrief | null) => {
      if (closed) return;
      closed = true; sceneToken++; sceneAbort?.abort(); clearTimeout(sceneTimer); motionPreference.removeEventListener("change", onMotionPreference); video.pause(); video.removeAttribute("src"); video.load();
      unregisterModal(overlay); overlay.remove(); resolve(brief);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
    const button = (text: string, id: string, action: () => void, primary = false) => el("button", {
      class: `ci-button${primary ? " is-primary" : ""}`, text, attrs: { type: "button" }, dataset: { testid: id }, on: { click: action },
    });
    const syncMotion = () => {
      panel.classList.toggle("is-still", !motion);
      if (motion && !video.hidden) void video.play().catch(() => { /* Poster remains available when autoplay is denied. */ });
      else video.pause();
    };
    const showScene = (focus: string, force = false) => {
      latestFocus = focus;
      const prompt = interviewArtPrompt(draft, answers, focus);
      if (!force && sceneKey === prompt) return;
      sceneKey = prompt;
      const token = ++sceneToken;
      sceneAbort?.abort(); clearTimeout(sceneTimer);
      const controller = sceneAbort = new AbortController();
      // The film is an arrival, not a loading fallback. After the first choice keep a
      // pixel still until the next reviewed scene is ready; never flash back to video.
      video.pause(); video.hidden = true;
      if (!acceptedScene) {
        images[front]!.src = video.poster;
        images[front]!.className = "is-visible";
      }
      panel.dataset.artState = "generating";
      status.textContent = acceptedScene ? "이전 장면 · 새 장면 그리는 중…" : "새 장면 그리는 중…";
      sceneTimer = setTimeout(() => {
        void generateInterviewScene(prompt, controller.signal, (phase, attempt) => {
          if (closed || token !== sceneToken) return;
          panel.dataset.artState = phase;
          status.textContent = (acceptedScene ? "이전 장면 · " : "") + (phase === "reviewing" ? "도트 확인 중…" : phase === "retrying" ? `다시 그리는 중 · ${attempt}/3` : "새 장면 그리는 중…");
        }).then(async url => {
          const probe = new Image(); probe.src = url; await probe.decode();
          if (closed || token !== sceneToken || controller.signal.aborted) return;
          const next = 1 - front;
          images[next]!.src = url; images[next]!.className = "is-visible";
          images[front]!.className = ""; front = next;
          acceptedScene = true;
          video.pause(); video.hidden = true;
          panel.dataset.artState = "accepted"; panel.dataset.scene = focus;
          status.textContent = "";
        }).catch(() => {
          if (closed || token !== sceneToken || controller.signal.aborted) return;
          panel.dataset.artState = "error";
          status.textContent = (acceptedScene ? "이전 장면 · " : "") + "그림을 준비하지 못했어요. 선택은 계속할 수 있어요.";
        });
      }, 750);
    };
    const fields = (label: string, value: string, id: string, limit: number, update: (text: string) => void, rows = 2) => {
      const input = el("textarea", { class: "ci-input", value, attrs: { id, rows: String(rows), maxlength: String(limit) }, dataset: { testid: id } });
      input.addEventListener("input", () => { update(input.value); showScene(latestFocus); });
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
            showScene(g.label); render();
          });
          b.classList.add("ci-genre"); b.setAttribute("aria-pressed", String(id === draft.genre));
          b.disabled = !!original && id !== draft.genre;
          b.append(el("span", { children: [el("strong", { text: g.label }), el("small", { text: g.tag })] }));
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
        secondary.addEventListener("change", () => { draft.secondary = secondary.value as InterviewGenre || undefined; delete draft.blend; showScene(draft.secondary ? `${sceneGenre(draft.genre).label} + ${sceneGenre(draft.secondary).label}` : sceneGenre(draft.genre).label); render(); });
        body.append(el("label", { class: "ci-field", attrs: { for: "ci-secondary" }, children: [el("span", { text: "장르 섞기" }), secondary] }),
          fields("떠오르는 아이디어 · 자유롭게", draft.concept, "project-interview-concept", 1000, text => { draft.concept = text; }),
          el("footer", { class: "ci-actions", children: [button("이 방향으로 시작", "project-interview-begin", () => { step = 0; showScene(sceneGenre(draft.genre).label); render(); }, true)] }));
      } else if (!summary) {
        const id = ids[step]!;
        const q = questions().find(q => q.id === id);
        const blending = id === "blend";
        const title = blending ? "두 장르는 어떻게 이어질까요?" : q!.title;
        const label = blending ? "장르의 연결" : q!.label;
        const choices: SceneOption[] = blending ? blendChoices(draft.genre, draft.secondary!) : q!.options;
        const read = () => blending ? draft.blend : answers[q!.slot];
        let selectedId = blending ? choices.find(o => read()?.text === `${o.label} — ${o.detail}`)?.id : draft.choiceIds[q!.slot];
        body.querySelector("#project-interview-title")!.textContent = title;
        const optionsNode = el("div", { class: "ci-options", attrs: { role: "group", "aria-labelledby": "project-interview-title" } });
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
        const field = fields("직접 쓰기 · 선택", read()?.text ?? "", "project-interview-answer", GAME_BRIEF_ANSWER_LIMIT, text => set(text, "user"));
        for (const [index, option] of choices.entries()) {
          const b = button("", `project-interview-option-${index}`, () => {
            const text = `${option.label} — ${option.detail}`;
            set(text, "user", option.id); field.querySelector("textarea")!.value = text; showScene(text);
          });
          b.classList.add("ci-option"); b.dataset.optionId = option.id;
          b.append(el("span", { children: [el("strong", { text: option.label })] }));
          optionsNode.append(b);
        }
        const recommend = button("추천", "project-interview-recommend", () => {
          const option = choices[0]!; const text = `${option.label} — ${option.detail}`;
          set(text, "recommended", option.id); field.querySelector("textarea")!.value = text; showScene(text);
          status.textContent = "추천안으로 담았어요. 직접 고칠 수 있어요.";
        });
        body.append(optionsNode, field, el("footer", { class: "ci-actions", children: [
          button("이전", "project-interview-previous", () => { step--; render(); }), recommend, next,
        ] }));
        sync();

      } else {

        const review = el("div", { class: "ci-review" });
        for (const [index, id] of ids.entries()) {
          const q = questions().find(q => q.id === id);
          const a = id === "blend" ? draft.blend : answers[q!.slot];
          const edit = button(`${a?.label ?? "장르의 연결"} · ${a?.text ?? "답변 필요"}${a?.source === "recommended" ? " (추천안)" : ""}`, `project-interview-edit-${q?.slot ?? "blend"}`, () => { step = index; render(); });
          edit.setAttribute("translate", "no"); review.append(edit);
        }
        body.append(review,
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
      top.replaceChildren(); navigation.replaceChildren();
      const header = body.querySelector(".ci-header"), meter = body.querySelector(".ci-progress");
      if (header) top.append(header);
      if (meter) top.append(meter);
      const actions = body.querySelector(".ci-actions");
      if (actions) navigation.append(actions);
      navigation.append(status);
      body.scrollTop = 0;
      panel.scrollTop = 0;
      top.querySelector<HTMLElement>("#project-interview-title")?.focus({ preventScroll: true });
    };
    const motionButton = button("모션", "project-interview-motion", () => { motion = !motion; syncMotion(); motionButton.setAttribute("aria-pressed", String(motion)); });
    motionButton.classList.add("ci-motion"); motionButton.setAttribute("aria-pressed", String(motion));
    const onMotionPreference = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      motion = false; syncMotion(); motionButton.setAttribute("aria-pressed", "false");
    };
    motionPreference.addEventListener("change", onMotionPreference);
    caption.append(button("다시 그리기", "project-interview-redraw", () => showScene(latestFocus, true)));
    panel.append(background, caption, controls, motionButton); overlay.append(panel); document.body.append(overlay);
    panel.addEventListener("keydown", event => {
      if (event.key !== "Tab" || !isTopModal(overlay)) return;
      const controls = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, select")];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    panel.dataset.artState = "opening";
    registerModal(overlay, () => done(null)); syncMotion(); render();
  });
}
