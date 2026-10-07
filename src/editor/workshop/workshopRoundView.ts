// src/editor/workshop/workshopRoundView.ts
/**
 * 판 화면. 카드마다 단품(맞춤 확대) + 사실 칩(꼭대기 N행 · 검수 통과/불통과 · 다시 그린 횟수).
 * 「검수 통과」는 보증이 아니다 — 사람이 본다. 고르기는 사람만 한다.
 * 버린 이유는 다음 판 지시문의 「하지 말 것」이 된다(engine.contextFor → rejected).
 */
import { CALLS_PER_CANDIDATE_ESTIMATE } from "@/harnesses/_core/workshop/engine";
import type { WorkshopItem, WorkshopRun } from "@/harnesses/_core/workshop/types";
import { REJECT_REASONS } from "@/harnesses/interior-props/editor/prompts";
import { el } from "@/util/dom";
import { workshopObjectId } from "@/project/workshopTiles";
import { WORKSHOP_MODEL_ADVICE } from "./chat";
import { gridDataUrl } from "./pixels";
import { bakeWorkshopPick, isWorkshopPickBaked } from "./workshopBake";
import type { WorkshopSession } from "./workshopSession";
import { latestRound, roundProgress } from "./workshopStatus";

export type RoundViewState = { selected: number; zoom: "fit" | "big"; rejectFor: string | null };

const BACKGROUND = [150, 120, 90, 255] as const;
const RUN_STATUS: Readonly<Record<WorkshopRun["status"], string>> = {
  queued: "기다리는 중", drawing: "그리는 중", reviewing: "검수 중", done: "다 그림", failed: "못 그림", cancelled: "취소됨",
};
/** 판 메모 — 다시 그려도 지워지지 않게 기물별로 모듈에 둔다 */
const notes = new Map<string, string>();
let lastError: { itemKey: string; message: string } | null = null;

/** 버려진 약속에서 오류가 사라지지 않게 잡아 보여 준다. 화면 쪽 표시 방법은 onError 가 정한다. */
export function runAction(work: () => Promise<void>, onError: (message: string) => void): void {
  work().catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
}
const newId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function keyButton(action: string, text: string, onClick: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
  return el("button", { text, attrs: { type: "button", ...extra }, dataset: { keyAction: action }, on: { click: onClick } }) as HTMLButtonElement;
}

export function renderRoundView(session: WorkshopSession, item: WorkshopItem, state: RoundViewState, rerender: () => void): HTMLElement {
  const round = latestRound(item.key, session.rounds);
  const palette = session.runner.palette(item);
  const current = session.runner.currentGrid(item);
  const pick = session.picks.find((p) => p.itemKey === item.key);
  // fit = 카드 그림 상자(약 170×250)에 들어가는 가장 큰 정수 배율, big = 그 2배. CSS 로 늘리지 않는다(도트가 흐려진다).
  const fitScale = Math.max(1, Math.floor(Math.min(170 / item.width, 250 / item.height)));
  const scale = state.zoom === "big" ? fitScale * 2 : fitScale;
  const compareScale = state.zoom === "big" ? 16 : 8;

  const noteText = () => (notes.get(item.key) ?? "").trim();
  function act(work: () => Promise<void>): void {
    runAction(async () => {
      await work();
      if (lastError) { lastError = null; rerender(); }
    }, (message) => { lastError = { itemKey: item.key, message }; rerender(); });
  }
  const errorLine = (): HTMLElement[] => (lastError?.itemKey === item.key
    ? [el("p", { class: "workshop-blocked", attrs: { role: "alert" }, text: `작업이 실패했습니다: ${lastError.message}` })] : []);

  async function startRound(note: string): Promise<void> {
    await session.engine.startRound(item, { note });
    state.selected = 0;
    await session.reload();
  }
  async function choose(run: WorkshopRun): Promise<void> {
    if (!round) return;
    await session.store.putPick({ projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter: run.letter, at: Date.now() });
    await session.store.addFeedback({ id: newId(), projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter: run.letter, verdict: "pick", reasons: [], note: "", at: Date.now() });
    await session.reload();
  }
  async function reject(run: WorkshopRun | null, reasons: string[], note = ""): Promise<void> {
    if (!round) return;
    const targets = run ? [run] : round.runs.filter((r) => r.grid);
    for (const target of targets) {
      await session.store.addFeedback({ id: newId(), projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter: target.letter, verdict: "reject", reasons, note, at: Date.now() });
    }
    state.rejectFor = null;
    await session.reload();
    rerender();
  }

  const note = el("textarea", { class: "workshop-note", attrs: { placeholder: "그릴 때 지킬 말(선택) — 예: 나무를 더 밝게, 윗판을 두껍게", "aria-label": "판 메모" } }) as HTMLTextAreaElement;
  note.value = notes.get(item.key) ?? "";
  note.addEventListener("input", () => { notes.set(item.key, note.value); });
  const startBlock = el("div", {
    class: "workshop-start",
    children: [
      note,
      el("button", {
        attrs: { type: "button" }, dataset: { testid: "workshop-start-round" },
        text: `후보 ${session.runner.candidates}장 뽑기 (모델 호출 약 ${session.runner.candidates * CALLS_PER_CANDIDATE_ESTIMATE}번)`,
        on: { click: () => act(() => startRound(noteText())) },
      }),
      el("p", { class: "workshop-item-meta", dataset: { testid: "workshop-model-advice" }, text: WORKSHOP_MODEL_ADVICE }),
    ],
  });

  // 공방 2단계: 고른 그림을 이 프로젝트의 손 도트 실내 칩셋에 넣는다 — 조수가 workshop:… id 로 맵에 놓는다
  const pickedRun = pick ? session.rounds.find((r) => r.id === pick.roundId)?.runs.find((r) => r.letter === pick.letter) : undefined;
  const bakeRow = (): HTMLElement[] => {
    const grid = pickedRun?.grid;
    if (!grid) return [];
    const baked = isWorkshopPickBaked(item, grid);
    const objectId = workshopObjectId(item.key);
    return [el("div", {
      class: "workshop-bake",
      children: [
        el("button", {
          text: baked ? `칩셋에 넣음 ✓ (${pick!.letter})` : `고른 ${pick!.letter} 를 프로젝트 칩셋에 넣기`,
          attrs: { type: "button", ...(baked ? { disabled: "" } : {}) },
          dataset: { testid: "workshop-bake" },
          on: { click: () => act(async () => { bakeWorkshopPick(item, grid, palette, session.env); rerender(); }) },
        }),
        el("span", {
          class: "workshop-item-meta",
          text: baked
            ? `실내 칩셋에 ${objectId} 로 들어갔어요. 조수에게 「${item.title} 놓아 줘」라고 하면 맵에 놓아요.`
            : "넣으면 이 프로젝트의 손 도트 실내 칩셋 끝에 칸이 붙고, 조수와 스탬프가 이 기물을 쓸 수 있어요. 되돌리기로 뺄 수 있어요.",
        }),
      ],
    })];
  };

  const head = el("div", {
    class: "workshop-round-head",
    children: [
      el("h3", { text: item.title }),
      el("span", { class: "workshop-chip", text: `${item.width}×${item.height}px` }),
      el("span", { class: "workshop-chip", text: item.category }),
      ...(round ? [el("span", { class: "workshop-chip", text: `판 ${roundProgress(round).done}/${roundProgress(round).total}` })] : []),
      ...(pick ? [el("span", { class: "workshop-chip is-pass", text: `고름: ${pick.letter}` })] : []),
      el("span", { class: "workshop-round-desc", text: item.description }),
    ],
  });

  if (!round) return el("div", { children: [...errorLine(), head, ...bakeRow(), startBlock, ...(current ? [compare(null)] : [])] });

  const runs = round.runs;
  state.selected = Math.max(0, Math.min(runs.length - 1, state.selected));
  const selectedRun = runs[state.selected];

  function card(run: WorkshopRun, index: number): HTMLElement {
    const picked = pick?.roundId === round!.id && pick.letter === run.letter;
    const rejected = state.rejectFor === run.letter;
    const facts = [
      el("span", { class: "workshop-chip", text: `${run.letter} · ${RUN_STATUS[run.status]}${run.status === "drawing" || run.status === "reviewing" ? ` ${run.attempt}/3` : ""}` }),
      ...(run.topRows !== null ? [el("span", { class: "workshop-chip", text: `꼭대기 ${run.topRows}행` })] : []),
      ...(run.verdict ? [el("span", { class: `workshop-chip ${run.verdict.verdict === "PASS" ? "is-pass" : "is-fail"}`, text: run.verdict.verdict === "PASS" ? "검수 통과" : `검수 불통과 ${run.verdict.codes.join(",")}`, attrs: { title: run.verdict.reasons } })] : []),
      ...(run.attempt > 1 ? [el("span", { class: "workshop-chip", text: `다시 그림 ${run.attempt - 1}번` })] : []),
      ...(run.error ? [el("span", { class: "workshop-chip is-fail", text: run.error, attrs: { title: run.error } })] : []),
    ];
    return el("article", {
      class: "workshop-card" + (index === state.selected ? " is-selected" : "") + (picked ? " is-picked" : ""),
      dataset: { testid: "workshop-card", letter: run.letter, status: run.status, zoom: state.zoom },
      on: { click: () => { state.selected = index; rerender(); } },
      children: [
        el("div", {
          class: "workshop-card-art",
          children: run.grid ? [el("img", { attrs: { src: gridDataUrl(run.grid, palette, scale, BACKGROUND), alt: `후보 ${run.letter}` } })] : [el("span", { text: RUN_STATUS[run.status] })],
        }),
        el("div", { class: "workshop-card-facts", children: facts }),
        ...(run.note ? [el("div", { class: "workshop-item-meta", text: run.note })] : []),
        el("div", {
          class: "workshop-card-actions",
          children: run.grid ? [
            el("button", { text: picked ? "고름 ✓" : "고르기", attrs: { type: "button" }, dataset: { testid: "workshop-pick" }, on: { click: (e) => { e.stopPropagation(); act(() => choose(run)); } } }),
            el("button", { text: "버리기", attrs: { type: "button" }, dataset: { testid: "workshop-reject" }, on: { click: (e) => { e.stopPropagation(); state.rejectFor = run.letter; rerender(); } } }),
            el("button", { text: "이 장 다시", attrs: { type: "button" }, on: { click: (e) => { e.stopPropagation(); act(() => session.engine.redrawRun(round!.id, run.letter, noteText())); } } }),
          ] : [],
        }),
        ...(rejected ? [el("div", {
          class: "workshop-reasons",
          children: Object.entries(REJECT_REASONS).map(([code, labelText]) => el("button", {
            text: labelText, attrs: { type: "button" }, on: { click: (e) => { e.stopPropagation(); act(() => reject(run, [code])); } },
          })),
        })] : []),
      ],
    });
  }

  function compare(run: WorkshopRun | null): HTMLElement {
    const figures: HTMLElement[] = [];
    if (current) figures.push(el("figure", { children: [el("img", { attrs: { src: gridDataUrl(current, palette, compareScale, BACKGROUND), alt: "지금 그림" } }), el("figcaption", { text: "지금 시트의 그림" })] }));
    if (run?.grid) figures.push(el("figure", { children: [el("img", { attrs: { src: gridDataUrl(run.grid, palette, compareScale, BACKGROUND), alt: `후보 ${run.letter}` } }), el("figcaption", { text: `후보 ${run.letter}` })] }));
    return el("div", { class: "workshop-compare", dataset: { testid: "workshop-compare" }, children: figures });
  }

  const hidden = el("div", {
    attrs: { hidden: "" },
    children: [
      ...runs.map((_, index) => keyButton(String(index + 1), "", () => { state.selected = index; rerender(); })),
      keyButton("enter", "", () => { if (selectedRun?.grid) act(() => choose(selectedRun)); }),
      keyButton("x", "", () => { if (selectedRun?.grid) { state.rejectFor = selectedRun.letter; rerender(); } }),
      keyButton("0", "", () => { act(() => reject(null, ["worse"], "지금 그림이 낫다")); }),
      keyButton("r", "", () => { if (selectedRun) act(() => session.engine.redrawRun(round.id, selectedRun.letter, noteText())); }),
      keyButton("f", "", () => { state.zoom = state.zoom === "fit" ? "big" : "fit"; rerender(); }),
    ],
  });

  const pending = runs.some((run) => run.status === "queued" || run.status === "drawing" || run.status === "reviewing");
  return el("div", {
    children: [
      ...errorLine(),
      head,
      ...bakeRow(),
      el("p", { class: "workshop-item-meta", text: `1~${runs.length} 카드 · Enter 고르기 · X 버리기 · 0 지금 것이 낫다 · R 이 장 다시 · F 확대 · ↑↓ 기물. 「검수 통과」는 AI 판정일 뿐입니다 — 직접 보고 고르세요.` }),
      el("div", { class: "workshop-cards" + (state.zoom === "big" ? " is-big" : ""), children: runs.map(card) }),
      compare(selectedRun ?? null),
      pending
        ? el("button", { attrs: { type: "button" }, text: "이 판 그만 그리기", on: { click: () => act(() => session.engine.cancelRound(round.id)) } })
        : startBlock,
      hidden,
    ],
  });
}
