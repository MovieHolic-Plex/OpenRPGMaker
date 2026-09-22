import { field, segmentedControl } from "@/editor/panels/databaseControls";
import {
  absenceEditor,
  bodyField,
  boundedCanonText,
  lawCard,
  toneRow,
  writeCanon,
  WORLD_CANON_TONE_LABELS,
} from "@/editor/panels/databaseWorldCanonFields";
import { detailPane, inspectorTabs, sectionCard, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { worldDocumentProperties } from "./worldDocumentProperties";
import { WORLD_CANON_BODY_EXCERPT_CHARS, worldCanonPromptSection } from "@/ai/worldCanonContext";
import { composeBodyWithDraft, mergeInterviewPatch, requestWorldCanonInterview, requestWorldCanonBodyDraft, type BodyDraftMode } from "@/ai/worldCanonInterview";

/**
 * 조수가 실제로 보는 본문 길이. 표시 문구가 이 값과 어긋나면 사용자가 "앞 600자만 본다"고
 * 믿고 세계관을 그 길이에 맞춰 쓰는데, 실제로는 20,000자를 보내므로 손해다. 그래서 UI 는
 * 하드코딩하지 않고 `worldCanonPromptSection` 과 **같은 상수**를 읽는다.
 */
const EXCERPT_MAX = WORLD_CANON_BODY_EXCERPT_CHARS;
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import {
  resolveWorldCanon,
  WORLD_CANON_LAW_KINDS,
  WORLD_CANON_BOUNDS,
  type ResolvedWorldCanon,
} from "@/project/world/canon";
import { el } from "@/util/dom";

const propertiesOpen = new WeakMap<HTMLElement, boolean>();
const activeSpreadTab = new WeakMap<HTMLElement, string>();

function excerptHint(filled: number): string {
  const excerptLen = Math.min(EXCERPT_MAX, filled);
  return filled > EXCERPT_MAX
    ? `역사·지형·문화·비밀 — 조수는 앞 ${EXCERPT_MAX}자를 본다 (뒤 ${filled - EXCERPT_MAX}자는 발췌 밖)`
    : `역사·지형·문화·비밀 — 조수는 앞 ${EXCERPT_MAX}자 중 ${excerptLen}자를 본다`;
}

export function renderWorldCanonTab(host: HTMLElement, rerender: () => void): void {
  const canon = resolveWorldCanon(store.getCurrent().worldCanon);
  const bodyCard = sectionCard({
    title: "본문",
    hint: "형식 없음",
    testid: "db-world-canon-body-card",
    children: [bodyField(canon.body, hintLine)],
  });
  // 본문 타이핑마다 힌트 줄의 발췌 카운터를 갱신한다 — 다시 렌더하지 않고 숫자만 바꾼다.
  function hintLine(): void {
    const filled = (bodyCard.querySelector("[data-testid='db-world-canon-body']") as HTMLTextAreaElement | null)
      ?.value.trim().length ?? canon.body.trim().length;
    const hint = bodyCard.querySelector(".db-ws-card-hint");
    if (hint) hint.textContent = excerptHint(filled);
  }
  hintLine();
  const aiPreview = el("pre", { class: "world-ai-preview", dataset: { testid: "world-canon-ai-preview" } });
  // "조수 전달" 탭의 라이브 값들. 탭 패널은 지연 생성되므로 refs 가 없을 수 있다 — 있을 때만 갱신.
  const aiRefs: { pre?: HTMLElement; tiles?: Map<string, { item: HTMLElement; value: HTMLElement }> } = {};
  const aiTileDefs = [
    {
      key: "premise",
      label: "한 줄 전제",
      value: (c: ResolvedWorldCanon) => c.premise.trim() || "미작성",
      tone: (c: ResolvedWorldCanon) => (c.premise.trim() ? "ok" : "missing"),
    },
    {
      key: "tones",
      label: "톤",
      value: (c: ResolvedWorldCanon) => (c.tones.length ? c.tones.map((tone) => WORLD_CANON_TONE_LABELS[tone]).join(", ") : "미작성"),
      tone: (c: ResolvedWorldCanon) => (c.tones.length ? "ok" : "missing"),
    },
    {
      key: "absences",
      label: "없는 것(절대 금지)",
      value: (c: ResolvedWorldCanon) => (c.absences.length ? `${c.absences.length}개 — ${c.absences.join(", ")}` : "미지정"),
      tone: (c: ResolvedWorldCanon) => (c.absences.length ? "ok" : "warn"),
    },
    {
      key: "laws",
      label: "법칙 확정",
      value: (c: ResolvedWorldCanon) => {
        const unset = WORLD_CANON_LAW_KINDS.filter((kind) => c.laws[kind].present === undefined).length;
        return unset === 0 ? "4 / 4 확정" : `${4 - unset} / 4 확정 · 미정 ${unset}`;
      },
      tone: (c: ResolvedWorldCanon) => (WORLD_CANON_LAW_KINDS.every((kind) => c.laws[kind].present !== undefined) ? "ok" : "warn"),
    },
    {
      key: "body",
      label: "본문 발췌",
      value: (c: ResolvedWorldCanon) => {
        const filled = c.body.trim().length;
        return filled > EXCERPT_MAX ? `앞 ${EXCERPT_MAX.toLocaleString()}자 / 뒤 ${(filled - EXCERPT_MAX).toLocaleString()}자 잘림` : `앞 ${filled.toLocaleString()}자 / ${EXCERPT_MAX.toLocaleString()}자`;
      },
      tone: (c: ResolvedWorldCanon) => (c.body.trim().length > EXCERPT_MAX ? "warn" : "ok"),
    },
  ];
  const updateAiTiles = (): void => {
    if (!aiRefs.tiles) return;
    const next = resolveWorldCanon(store.getCurrent().worldCanon);
    for (const def of aiTileDefs) {
      const ref = aiRefs.tiles.get(def.key);
      if (!ref) continue;
      ref.value.textContent = def.value(next);
      ref.item.dataset.tone = def.tone(next);
    }
  };
  const updateAiPreview = (): void => {
    const section = worldCanonPromptSection(store.getCurrent().worldCanon) ?? "아직 AI에 전달할 설정이 없습니다.";
    aiPreview.textContent = section;
    if (aiRefs.pre) aiRefs.pre.textContent = section;
    updateAiTiles();
  };
  const aiDetails = el("details", {
    class: "world-ai-scope",
    children: [el("summary", { text: "AI 미리보기 — 이 세계(세계관 고정)" }), aiPreview],
    on: { toggle: updateAiPreview },
  });
  updateAiPreview();
  const properties = worldDocumentProperties([
    sectionCard({
      title: "문서 설정",
      children: [
        segmentedControl("작성 상태", "db-world-canon-status", canon.status, [
          { id: "draft", name: "초안" }, { id: "canon", name: "확정" },
        ], (value) => {
          if (value !== "draft" && value !== "canon") return;
          recordProjectSnapshot("세계관 상태");
          writeCanon({ status: value });
          updateAiPreview();
        }),
        segmentedControl("공개 범위", "db-world-canon-visibility", canon.visibility, [
          { id: "public", name: "공개" }, { id: "secret", name: "비밀" },
        ], (value) => {
          if (value !== "public" && value !== "secret") return;
          recordProjectSnapshot("세계관 공개 범위");
          writeCanon({ visibility: value });
          updateAiPreview();
        }),
        el("p", { class: "world-muted", text: "비밀 설정도 AI는 참고하지만, 플레이어 대사에 직접 공개하지 않도록 지시합니다." }),
      ],
    }),
    aiDetails,
  ], propertiesOpen.get(host) ?? false, (open) => propertiesOpen.set(host, open));

  // ---- 탭 구성: 본문(도화지)이 첫 화면의 주인공이다 ----
  // 세계 개요를 클릭하면 폼이 아니라 쓰기 시작할 수 있는 도화지가 먼저 보여야 한다(2026-09-22 사용자 피드백).
  const bodyPanel = el("div", {
    class: "world-canon-tab-body world-canon-body-panel",
    children: [
      el("p", {
        class: "world-canon-body-lead",
        text: "이 세계의 이야기를 자유롭게 적으세요 — 역사, 땅, 문화, 숨겨 둔 것. 이름·톤·법칙 같은 설정은 세계 설정 탭에 있다.",
      }),
      bodyCard,
    ],
  });

  // 본문 도화지에도 AI 도움을 붙인다 — 초안/이어쓰기 제안. 저장은 저자가 한다.
  const bodyArea = bodyCard.querySelector("[data-testid='db-world-canon-body']") as HTMLTextAreaElement | null;
  if (bodyArea) {
    bodyPanel.append(buildBodyAiAssist(bodyArea, () => {
      const hint = bodyCard.querySelector(".db-ws-card-hint");
      if (hint) hint.textContent = excerptHint(bodyArea.value.trim().length);
    }));
  }
  // 세계 설정 탭 = AI 문답 인터뷰(2026-09-22 사용자 피드백: 폼으로 나열하지 말고 질의응답으로).
  // 값은 기존 writeCanon 경로로 들어간다 — 스키마·경계값은 그대로고 입력 방식만 바뀌다.
  const settingsPanel = buildInterviewPanel(canon, rerender, updateAiPreview);
  // ---- 탭 2: 조수 전달 (AI 프롬프트 투영 + 전달 상태) ----
  const buildAiPanel = (): HTMLElement => {
    const wrap = el("div", { class: "world-canon-tab-body world-canon-ai-panel", dataset: { testid: "world-canon-ai-panel" } });
    wrap.append(el("p", {
      class: "world-canon-ai-lead",
      text: "조수가 매 턴 읽는 고정 블록이다. 여기 보이는 것 = 조수가 아는 것의 전부다. 고치려면 세계 설정 탭에서 해당 필드를 수정하면 된다.",
    }));
    const grid = el("div", { class: "world-canon-ai-grid" });
    aiRefs.tiles = new Map();
    for (const def of aiTileDefs) {
      const value = el("span", { class: "world-canon-ai-grid-value" });
      const item = el("div", {
        class: "world-canon-ai-grid-item",
        children: [el("span", { class: "world-canon-ai-grid-label", text: def.label }), value],
      });
      aiRefs.tiles.set(def.key, { item, value });
      grid.append(item);
    }
    aiRefs.pre = el("pre", { class: "world-ai-preview world-canon-ai-pre", dataset: { testid: "world-canon-ai-panel-preview" } });
    wrap.append(grid, sectionCard({
      title: "조수 프롬프트 투영",
      hint: "worldCanonPromptSection — 이름·전제·톤·없는 것·법칙 + 본문 발췌",
      children: [aiRefs.pre],
    }));
    updateAiPreview();
    return wrap;
  };
  const unsetCount = WORLD_CANON_LAW_KINDS.filter((kind) => canon.laws[kind].present === undefined).length;
  const tabs = inspectorTabs({
    sections: [
      { id: "body", label: "본문", build: () => bodyPanel },
      { id: "settings", label: "세계 설정", ...(unsetCount > 0 ? { badge: `법칙 미정 ${unsetCount}` } : {}), build: () => settingsPanel },
      { id: "ai", label: "조수 전달", build: buildAiPanel },
    ],
    activeId: activeSpreadTab.get(host),
    onChange: (id) => activeSpreadTab.set(host, id),
    testidPrefix: "db-ws-section",
  });

  const workspace = workspaceShell({
      testid: "db-world-canon-workspace",
      header: el("header", {
        class: "world-document-toolbar",
        dataset: { testid: "db-world-canon-hero" },
        children: [
          el("strong", { text: "세계 개요" }),
          el("span", { class: "world-ai-scope-label", text: `AI 참고 · 핵심 설정 + 본문 앞 ${EXCERPT_MAX}자` }),
        ],
      }),
      detail: detailPane({
        body: [el("div", {
          class: "world-document-layout",
          children: [
            el("div", {
              class: "world-document-content",
              children: [tabs],
            }),
            properties,
          ],
        })],
      }),
    });
  workspace.classList.add("world-document-workspace", "world-canon-workspace");
  workspace.addEventListener("input", updateAiPreview);
  host.append(workspace);
}


// ---------------------------------------------------------------------------
// 세계 설정 = AI 문답 인터뷰 (2026-09-22)
//
// 폼을 나열하는 대신 조수가 한 번에 한 칸씩 묻고, 사용자가 답하면 그 답이 스키마 패치로 들어온다.
// 값 저장은 기존 writeCanon 하나로 모은다 — 경계값·undo 스냅숏·AI 투영이 전부 그 경로를 탄다.
// ---------------------------------------------------------------------------

type InterviewLine = { readonly role: "user" | "assistant"; readonly text: string };

const interviewHistory = new WeakMap<HTMLElement, InterviewLine[]>();
const interviewBusy = new WeakMap<HTMLElement, boolean>();


// ---------------------------------------------------------------------------
// 본문 AI 도움 (2026-09-22)
//
// 본문은 장문 prose 라 인터뷰처럼 한 칸씩 채울 수 없다. 저자가 막막한 지점에서
//  · "초안 잡기" — 지금까지의 설정만으로 본문 4~6문단을 새로 쓴다
//  · "이어쓰기" — 이미 쓴 본문의 끝을 이어받아 다음 절을 쓴다
// 두 모드를 버튼 하나씩으로 제공한다. 결과는 **제안**으로 textarea 에 들어가고
// 저장은 저자가 한다(본문은 길고 되돌리기 비용이 크다).
// ---------------------------------------------------------------------------

function buildBodyAiAssist(area: HTMLTextAreaElement, onApplied: () => void): HTMLElement {
  const wrap = el("div", { class: "world-canon-body-ai", dataset: { testid: "world-canon-body-ai" } });
  const instruction = el("input", {
    class: "world-canon-body-ai-instruction",
    attrs: {
      type: "text",
      placeholder: "지시(선택) — 예: 왕도 멸망만 3문단",
      "aria-label": "본문 AI 지시",
      maxlength: "200",
    },
    dataset: { testid: "world-canon-body-ai-instruction" },
  }) as HTMLInputElement;
  const draftButton = el("button", {
    class: "btn small world-canon-body-ai-draft",
    attrs: { type: "button", title: "지금까지의 세계 설정만으로 본문을 새로 씁니다. 기존 본문을 덮어쓸지 물어봅니다." },
    text: "초안 잡기",
    dataset: { testid: "world-canon-body-ai-draft" },
  });
  const continueButton = el("button", {
    class: "btn small world-canon-body-ai-continue",
    attrs: { type: "button", title: "지금 적힌 본문의 끝을 이어받아 다음 절을 씁니다." },
    text: "이어쓰기",
    dataset: { testid: "world-canon-body-ai-continue" },
  });
  const status = el("span", { class: "world-canon-body-ai-status", dataset: { testid: "world-canon-body-ai-status" } });
  const notes = el("ul", { class: "world-canon-body-ai-notes", dataset: { testid: "world-canon-body-ai-notes" } });
  let busy = false;

  const setBusy = (next: boolean, message = ""): void => {
    busy = next;
    for (const button of [draftButton, continueButton]) {
      if (next) button.setAttribute("disabled", "");
      else button.removeAttribute("disabled");
    }
    instruction.toggleAttribute("disabled", next);
    status.textContent = message;
  };
  const showNotes = (items: readonly string[]): void => {
    notes.replaceChildren();
    if (items.length === 0) return;
    notes.append(el("li", { class: "world-canon-body-ai-notes-head", text: "조수가 새로 지어낸 것 — 아니면 지우세요:" }));
    for (const item of items) notes.append(el("li", { text: item }));
  };

  const run = async (mode: BodyDraftMode): Promise<void> => {
    if (busy) return;
    const existing = area.value;
    if (mode === "draft" && existing.trim().length > 0) {
      const replace = typeof window.confirm === "function"
        ? window.confirm("이미 쓴 본문이 있습니다. 초안으로 덮어쓸까요? (취소하면 이어쓰기로 바뀝니다)")
        : false;
      if (!replace) {
        await run("continue");
        return;
      }
    }
    setBusy(true, mode === "draft" ? "조수가 초안을 쓰는 중…" : "조수가 이어 쓰는 중…");
    showNotes([]);
    const result = await requestWorldCanonBodyDraft({
      mode,
      existingBody: existing,
      instruction: instruction.value,
      canon: resolveWorldCanon(store.getCurrent().worldCanon),
    });
    if (!result.ok) {
      setBusy(false, result.message);
      return;
    }
    area.value = composeBodyWithDraft(existing, result.body, mode);
    writeCanon({ body: area.value }, "db-world-canon-body");
    onApplied();
    showNotes(result.notes);
    setBusy(false, mode === "draft" ? "초안을 넣었습니다. 고친 뒤 저장하세요." : "이어썼습니다. 고친 뒤 저장하세요.");
  };

  draftButton.addEventListener("click", () => { void run("draft"); });
  continueButton.addEventListener("click", () => { void run("continue"); });

  wrap.append(
    el("div", { class: "world-canon-body-ai-row", children: [draftButton, continueButton, instruction] }),
    status,
    notes,
  );
  return wrap;
}


function buildInterviewPanel(
  canon: ResolvedWorldCanon,
  rerender: () => void,
  onCanonChanged: () => void,
): HTMLElement {
  const host = el("div", {
    class: "world-canon-tab-body world-canon-interview",
    dataset: { testid: "world-canon-interview" },
  });
  const log = el("div", { class: "world-canon-interview-log", dataset: { testid: "world-canon-interview-log" } });
  const quick = el("div", { class: "world-canon-interview-quick", dataset: { testid: "world-canon-interview-choices" } });
  const input = el("textarea", {
    class: "world-canon-interview-input",
    attrs: {
      rows: "2",
      placeholder: "답을 적거나 위 선택지를 누르세요 (Enter 전송, Shift+Enter 줄바꿈)",
      "aria-label": "세계 설정 답변",
    },
    dataset: { testid: "world-canon-interview-input" },
  }) as HTMLTextAreaElement;
  const send = el("button", {
    class: "btn small world-canon-interview-send",
    attrs: { type: "button" },
    text: "보내기",
    dataset: { testid: "world-canon-interview-send" },
  });
  const startButton = el("button", {
    class: "btn small world-canon-interview-start",
    attrs: { type: "button" },
    text: "시작하기",
    dataset: { testid: "world-canon-interview-start" },
  });
  const status = el("span", { class: "world-canon-interview-status", dataset: { testid: "world-canon-interview-status" } });
  const summary = el("div", { class: "world-canon-interview-summary", dataset: { testid: "world-canon-interview-summary" } });

  // 패널은 탭을 열 때마다 새로 만들어지지만 기록은 host 기준 WeakMap 에 남는다.
  const history = interviewHistory.get(host) ?? [];
  interviewHistory.set(host, history);

  const renderLog = (): void => {
    log.replaceChildren();
    if (history.length === 0) {
      log.append(el("p", {
        class: "world-canon-interview-empty",
        text: "조수가 세계 설정을 한 칸씩 함께 정한다. 「시작하기」를 누르면 첫 질문이 온다.",
      }));
      return;
    }
    for (const line of history) {
      log.append(el("div", { class: `world-canon-interview-line is-${line.role}`, text: line.text }));
    }
    log.scrollTop = log.scrollHeight;
  };
  const renderChoices = (choices: readonly string[]): void => {
    quick.replaceChildren();
    for (const choice of choices) {
      const button = el("button", { class: "world-canon-interview-choice", attrs: { type: "button" }, text: choice });
      button.addEventListener("click", () => { void submit(choice); });
      quick.append(button);
    }
  };
  const renderSummary = (): void => {
    const next = resolveWorldCanon(store.getCurrent().worldCanon);
    const chip = (label: string, value: string, filled: boolean): HTMLElement =>
      el("span", { class: `world-canon-interview-chip${filled ? " is-filled" : ""}`, text: `${label} ${value}` });
    const decided = WORLD_CANON_LAW_KINDS.filter((kind) => next.laws[kind].present !== undefined).length;
    summary.replaceChildren(
      chip("이름", next.name.trim() || "—", Boolean(next.name.trim())),
      chip("전제", next.premise.trim() ? "작성" : "—", Boolean(next.premise.trim())),
      chip("톤", next.tones.length > 0 ? `${next.tones.length}종` : "—", next.tones.length > 0),
      chip("법칙", `${decided}/4`, decided === 4),
      chip("없는 것", next.absences.length > 0 ? `${next.absences.length}개` : "—", next.absences.length > 0),
      chip("시대", next.era.trim() ? "작성" : "—", Boolean(next.era.trim())),
      chip("기술", next.techCeiling.trim() ? "작성" : "—", Boolean(next.techCeiling.trim())),
    );
  };
  const setBusy = (busy: boolean, message = ""): void => {
    interviewBusy.set(host, busy);
    if (busy) { send.setAttribute("disabled", ""); input.setAttribute("disabled", ""); }
    else { send.removeAttribute("disabled"); input.removeAttribute("disabled"); }
    status.textContent = message;
  };
  const submit = async (text: string): Promise<void> => {
    const answer = text.trim();
    if (!answer || interviewBusy.get(host)) return;
    history.push({ role: "user", text: answer });
    renderLog();
    renderChoices([]);
    input.value = "";
    setBusy(true, "조수가 답을 반영하는 중…");
    const result = await requestWorldCanonInterview({
      history,
      canon: resolveWorldCanon(store.getCurrent().worldCanon),
    });
    if (!result.ok) {
      history.push({ role: "assistant", text: `(연결 실패) ${result.message}` });
      renderLog();
      setBusy(false, result.message);
      return;
    }
    const turn = result.turn;
    if (turn.recap) history.push({ role: "assistant", text: turn.recap });
    if (turn.question) history.push({ role: "assistant", text: turn.question });
    if (!turn.recap && !turn.question) history.push({ role: "assistant", text: "(빈 응답이 왔습니다. 다시 말해 주세요.)" });
    renderLog();
    renderChoices(turn.choices);
    const patch = mergeInterviewPatch(resolveWorldCanon(store.getCurrent().worldCanon), turn.patch);
    if (Object.keys(patch).length > 0) {
      recordProjectSnapshot("세계관 인터뷰");
      writeCanon(patch);
      renderSummary();
      onCanonChanged();
    }
    setBusy(false, turn.done ? "조수가 준비 완료로 표시했다. 더 물어보거나 본문 탭에서 이어 쓰세요." : "");
  };

  send.addEventListener("click", () => { void submit(input.value); });
  startButton.addEventListener("click", () => { void submit("세계 설정을 처음부터 함께 정하자. 첫 질문을 해 줘."); });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void submit(input.value);
  });

  renderLog();
  renderSummary();
  host.append(
    el("p", {
      class: "world-canon-interview-lead",
      text: "조수가 한 번에 한 칸씩 묻는다. 답하면 이름·전제·톤·법칙으로 정리되어 이 세계에 저장된다.",
    }),
    summary,
    log,
    quick,
    el("div", { class: "world-canon-interview-compose", children: [input, el("div", { class: "world-canon-interview-actions", children: [startButton, send] })] }),
    status,
    el("details", {
      class: "world-canon-interview-manual",
      children: [
        el("summary", { text: "직접 입력하기 (인터뷰 없이 손으로)" }),
        el("div", { class: "world-canon-fields", children: [
          identityCard(canon),
          el("h5", { class: "world-canon-group-title", text: "톤" }),
          toneRow(canon.tones, rerender),
          el("div", {
            class: "world-canon-spread-era",
            children: [
              boundedCanonText("시대", canon.era, (value) => writeCanon({ era: value }, "db-world-canon-era"), "db-world-canon-era", WORLD_CANON_BOUNDS.era),
              boundedCanonText("기술 수준", canon.techCeiling, (value) => writeCanon({ techCeiling: value }, "db-world-canon-tech"), "db-world-canon-tech", WORLD_CANON_BOUNDS.techCeiling),
            ],
          }),
          el("h5", { class: "world-canon-group-title", text: "세계에 없는 것 (부분일치)" }),
          absenceEditor(canon.absences, rerender),
          el("h5", { class: "world-canon-group-title", text: "법칙 (힘·신·죽음·돈)" }),
          el("div", {
            class: "world-canon-law-grid is-cards",
            children: WORLD_CANON_LAW_KINDS.map((kind) => lawCard(kind, canon.laws[kind], rerender)),
          }),
        ] }),
      ],
    }),
  );
  return host;
}


function identityCard(canon: ResolvedWorldCanon): HTMLElement {
  const name = el("input", {
    class: "db-world-canon-name",
    attrs: {
      type: "text",
      placeholder: "이 세계의 이름",
      "aria-label": "세계 이름",
      maxlength: String(WORLD_CANON_BOUNDS.name),
      title: `세계 이름: ${WORLD_CANON_BOUNDS.name}자까지`,
    },
    value: canon.name,
    dataset: { testid: "db-world-canon-name" },
  });
  name.addEventListener("input", () => writeCanon({ name: name.value }, "db-world-canon-name"));
  const premise = el("textarea", {
    class: "db-world-canon-premise",
    attrs: {
      rows: "2",
      placeholder: "한 줄로, 이 세계는 어떤 곳인가",
      "aria-label": "한 줄 전제",
      maxlength: String(WORLD_CANON_BOUNDS.premise),
      title: `한 줄 전제: ${WORLD_CANON_BOUNDS.premise}자까지`,
    },
    value: canon.premise,
    dataset: { testid: "db-world-canon-premise" },
  });
  premise.addEventListener("input", () => writeCanon({ premise: premise.value }, "db-world-canon-premise"));
  return el("div", {
    class: "world-canon-fields",
    dataset: { testid: "db-world-canon-identity" },
    children: [
      field("이름", name),
      field("한 줄 전제", premise),
    ],
  });
}

