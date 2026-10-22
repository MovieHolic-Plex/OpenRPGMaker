// editor/panels/aiObjectGenCard.ts
// 조수의 generate_missing_object(objectGenTool.ts)가 돌려준 요청을 턴이 끝난 뒤 카드로 보여 준다(2026-10-21).
// 요청은 공방 작업 줄(editor/workshop/queue)에 선다 — 한 턴에 여러 개면 모두 함께 줄 서서 동시에 그린다(하나씩 막지 않는다).
// 카드는 작업 줄의 그 작업을 비추기만 한다: 후보가 나오면 사용자가 「이걸로 넣기」를 누르거나, 사용자가 켠 「알아서 고르기」가
// 검수 통과 첫 후보를 그 맵 칩셋에 굽는다(작업 줄이 굽는다 — 카드가 닫혀 있어도). 작업 줄 판에서 골라도 같다.
// 묶음의 요청이 모두 끝나면(넣음·그만둠) 조수에게 후속 요청 하나로 물체 id·자리를 한꺼번에 보낸다.
// 굽기는 공방 칸(이 게임에만)이다 — 스토어 올리기·공용 DB 로는 나가지 못한다(storePublishBlockReason, object-gate 미배선).
// 위키: openwiki/editor-ai-tools.md 「없는 기물 그리기」, openwiki/editor-workshop.md 「작업 줄」.

import type { WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";
import type { ObjectGenRequest } from "@/editor/workshop/objectRequest";
import { objectGenFollowUp } from "@/editor/workshop/objectRequest";
import type { JobView, WorkshopJobInstalledDetail } from "@/editor/workshop/queue/workshopQueue";
import { clearChildren, el } from "@/util/dom";

export type ObjectGenFollowUp = (text: string) => void;

const RUN_STATUS: Readonly<Record<WorkshopRun["status"], string>> = {
  queued: "기다리는 중", drawing: "그리는 중", reviewing: "검수 중", done: "다 그림", failed: "못 그림", cancelled: "그만둠",
};
const BACKGROUND = [150, 120, 90, 255] as const;
const KIND_LABELS: Readonly<Record<string, string>> = { floor: "바닥에 세움", wall: "벽 앞", hang: "벽에 걺", flat: "바닥 무늬" };
const AUTO_PICK_KEY = "oprn:assistant-objectgen-autopick";
const INSTALLED_EVENT = "oprn:workshop-job-installed";

function autoPickOn(): boolean {
  try { return localStorage.getItem(AUTO_PICK_KEY) === "1"; } catch { return false; }
}

function button(text: string, testid: string, onClick: () => void, primary = false): HTMLButtonElement {
  return el("button", { text, class: primary ? "is-primary" : "", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick } });
}

type Outcome = { readonly text: string } | { readonly declined: string };
type CardHandle = { readonly root: HTMLElement; readonly settled: Promise<Outcome> };

type QueueModule = typeof import("@/editor/workshop/queue/workshopQueue");
type PixelsModule = typeof import("@/editor/workshop/pixels");
type BadgeModule = typeof import("@/editor/workshop/gateBadge");

/** 요청 하나의 카드. settled = 넣었으면 후속 요청 글, 그만뒀으면 「있는 것으로」 지시. */
function objectGenCard(request: ObjectGenRequest, modules: Promise<[QueueModule, PixelsModule, typeof import("@/editor/workshop/chat"), BadgeModule]>): CardHandle {
  const status = el("p", { class: "ai-tileset-change-status", attrs: { role: "status" } });
  const candidates = el("div", { class: "ai-objectgen-candidates", dataset: { testid: "ai-objectgen-candidates" } });
  // 참고 그림(object-gen ref 단계): 그리는 모델만 모양을 본다. 칩셋에 들어가지 않는다 — 카드에도 그렇게 적는다.
  const reference = el("div", { class: "ai-objectgen-reference", dataset: { testid: "ai-objectgen-reference" } });
  const footer = el("footer");
  let settled = false;
  let jobId: string | null = null;
  let resolveOutcome!: (outcome: Outcome) => void;
  const settledPromise = new Promise<Outcome>((resolve) => { resolveOutcome = resolve; });
  let unsubscribe: (() => void) | null = null;
  let loaded: [QueueModule, PixelsModule, typeof import("@/editor/workshop/chat"), BadgeModule] | null = null;

  const finish = (text: string, outcome: Outcome): void => {
    if (settled) return;
    settled = true;
    unsubscribe?.();
    unsubscribe = null;
    window.removeEventListener(INSTALLED_EVENT, onInstalled);
    for (const node of root.querySelectorAll("button")) (node as HTMLButtonElement).disabled = true;
    status.textContent = text;
    root.dataset.settled = "true";
    resolveOutcome(outcome);
  };

  function onInstalled(event: Event): void {
    const detail = (event as CustomEvent<WorkshopJobInstalledDetail>).detail;
    if (!detail || detail.jobId !== jobId || detail.job.installed?.kind !== "object") return;
    const installed = detail.job.installed;
    const baked = detail.baked ?? { objectId: installed.objectId, title: request.title, tilesetId: installed.tilesetId, columns: request.tilesW, rows: request.tilesH };
    const reason = installed.auto && detail.reason ? ` 고른 까닭: ${detail.reason}.` : "";
    finish(`「${request.title}」(${installed.letter})을(를) 칩셋 ${installed.tilesetId} 에 넣었어요.${reason}`, { text: objectGenFollowUp(request, baked, installed.auto ? "auto" : "user") });
  }

  const renderReference = (round: WorkshopRound): void => {
    const ref = round.reference;
    clearChildren(reference);
    reference.dataset.status = ref?.status ?? "pending";
    if (!ref) {
      if (round.runs.some((r) => r.status === "drawing" && !r.grid)) reference.append(el("small", { text: "참고 그림을 만드는 중… (모양만 보는 그림이에요)" }));
      return;
    }
    if (ref.status === "ok" && ref.dataUrl) {
      reference.append(
        el("img", { attrs: { alt: "참고 그림", src: ref.dataUrl } }),
        el("small", { text: "참고용, 설치 안 됨 — 모양만 보고 도트는 새로 찍어요" }),
      );
      return;
    }
    reference.append(el("small", { class: "is-none", text: "참고 그림 없이 그림" }), ...(ref.note ? [el("small", { text: ref.note.replace(/^참고 그림 없이 그림 — /u, "") })] : []));
  };

  const view = (): JobView | null => (loaded && jobId ? loaded[0].workshopQueue().snapshot().jobs.find((candidate) => candidate.job.id === jobId) ?? null : null);

  const render = (): void => {
    const current = view();
    if (!current || !loaded || settled) return;
    const [{ workshopQueue }, { gridDataUrl }, , badges] = loaded;
    const { round, item, session, state, job } = current;
    root.dataset.state = state;
    if (round) renderReference(round);
    const palette = item && session ? session.runner.palette(item) : null;
    clearChildren(candidates);
    for (const run of round?.runs ?? []) {
      const passed = run.verdict?.verdict === "PASS";
      const verdict = run.status === "done" ? (passed ? "검수 통과" : "검수 불통과") : RUN_STATUS[run.status];
      const pick = button("이걸로 넣기", "ai-objectgen-pick", () => {
        pick.disabled = true;
        status.textContent = `${run.letter} 를 칩셋에 넣는 중…`;
        workshopQueue().install(job.id, run.letter).then(
          (outcome) => { if (outcome === "waiting") status.textContent = "조수가 그 맵에서 일하는 중이라, 끝나면 바로 넣을게요."; },
          (error: unknown) => { status.textContent = `넣지 못했어요: ${error instanceof Error ? error.message : String(error)}`; pick.disabled = false; },
        );
      }, passed);
      pick.disabled = state !== "ready" || run.status !== "done" || !run.grid;
      const scale = item ? Math.max(2, Math.floor(Math.min(96 / item.width, 96 / item.height))) : 4;
      candidates.append(el("article", {
        class: `ai-objectgen-candidate${passed ? " is-pass" : ""}`,
        dataset: { letter: run.letter, status: run.status, verdict: run.verdict?.verdict ?? "" },
        children: [
          run.grid && palette
            ? el("img", { attrs: { alt: `후보 ${run.letter}`, src: gridDataUrl(run.grid, palette, scale, BACKGROUND) } })
            : el("div", { class: "ai-objectgen-placeholder", text: RUN_STATUS[run.status] }),
          el("strong", { text: `${run.letter} · ${verdict}` }),
          ...(badges.gateBadge(run) ? [badges.gateBadge(run)!] : []),
          ...(run.status === "done" && run.verdict?.looksLike ? [el("small", { class: "ai-objectgen-looks", text: `검수 눈엔: ${run.verdict.looksLike}` })] : []),
          ...(run.status === "failed" && run.error ? [el("small", { text: run.error.slice(0, 80) })] : []),
          pick,
        ],
      }));
    }
    if (state === "queued") status.textContent = current.holding ? "AI 계정이 잠깐 쉬는 중이라 기다려요. 풀리면 바로 그려요." : "공방 작업 줄에서 차례를 기다리는 중이에요. 다른 일을 해도 돼요.";
    else if (state === "reference" || state === "drawing" || state === "review") {
      const done = round?.runs.filter((r) => r.status === "done").length ?? 0;
      status.textContent = `후보를 그리는 중이에요(${done}/${round?.runs.length ?? 0}). 한 판에 4~8분 걸려요(참고 그림·고치기·검수). 다른 물건도 함께 그려요. 맵을 계속 고쳐도 돼요.`;
    } else if (state === "paused") status.textContent = `멈춤: ${job.pause?.reason ?? ""}. 작업 줄에서 이어서 그려요.`;
    else if (state === "installing") status.textContent = job.installWait ?? "넣는 중…";
    else if (state === "failed") status.textContent = "후보를 그리지 못했어요. 「다시 그리기」를 누르거나 조수에게 있는 것으로 해 달라고 하세요.";
    else if (state === "cancelled") finish("그리기를 그만뒀어요. 있는 기물로 할게요.", { declined: request.title });
    else if (state === "ready" && autoPickOn() && job.timeline.some((entry) => entry.note === "알아서 고르기: 고르는 중") && !job.timeline.some((entry) => entry.note === "알아서 고르기: 통과 후보 없음")) {
      status.textContent = "알아서 고르기: 검수를 통과한 후보 중 하나를 고르는 중…";
    } else if (state === "ready") {
      status.textContent = autoPickOn() && job.timeline.some((entry) => entry.note === "알아서 고르기: 통과 후보 없음")
        ? "검수를 통과한 후보가 없어 알아서 고르지 않았어요. 마음에 드는 것을 직접 골라 주세요."
        : "마음에 드는 후보의 「이걸로 넣기」를 눌러 주세요. 검수 통과·3/4 배지는 참고일 뿐 — 직접 보고 고르세요.";
    }
  };

  const autoBox = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "ai-objectgen-autopick" } }) as HTMLInputElement;
  autoBox.checked = autoPickOn();
  autoBox.addEventListener("change", () => {
    try { localStorage.setItem(AUTO_PICK_KEY, autoBox.checked ? "1" : "0"); } catch { /* restricted storage */ }
    // 이미 고를 차례면 작업 줄이 다음 변화 때 고른다 — 지금 바로 한 번 깨운다.
    if (loaded) loaded[0].workshopQueue().pump();
  });

  const begin = async (): Promise<void> => {
    loaded = await modules;
    const [{ workshopQueue }, , chat] = loaded;
    if (!chat.workshopAiReady()) {
      status.textContent = "그리려면 내 AI 계정을 연결해야 해요. 연결한 뒤 「다시 그리기」를 눌러 주세요.";
      if (!footer.querySelector('[data-testid="ai-objectgen-connect"]')) {
        footer.prepend(button("AI 연결하기", "ai-objectgen-connect", () => {
          void import("@/editor/panels/aiSettingsModal").then(({ openAiSettingsModal }) => openAiSettingsModal());
        }));
      }
      return;
    }
    status.textContent = "공방 작업 줄에 넣는 중…";
    const job = await workshopQueue().enqueueAssistantRequest(request);
    jobId = job.id;
    root.dataset.job = job.id;
    window.addEventListener(INSTALLED_EVENT, onInstalled);
    unsubscribe = workshopQueue().subscribe(render);
    render();
  };
  const start = (): void => {
    if (settled || jobId) return;
    begin().catch((error: unknown) => { status.textContent = `그리기를 시작하지 못했어요: ${error instanceof Error ? error.message : String(error)}`; });
  };

  const redraw = button("다시 그리기", "ai-objectgen-redraw", () => {
    if (settled) return;
    if (!jobId) { start(); return; }
    const current = view();
    if (!current || !loaded) return;
    if (current.state === "ready" && current.round && current.session) {
      for (const run of current.round.runs) if (run.status === "failed" || (run.status === "done" && run.verdict?.verdict !== "PASS")) void current.session.engine.redrawRun(current.round.id, run.letter, "");
      return;
    }
    void loaded[0].workshopQueue().retry(current.job.id);
  });
  const queueButton = button("작업 줄에서 보기", "ai-objectgen-open-queue", () => {
    void import("@/editor/workshop/queue/queueDock").then(({ openWorkshopQueue }) => openWorkshopQueue());
  });
  const existing = button("있는 것으로 해 줘", "ai-objectgen-existing", () => {
    if (jobId && loaded) void loaded[0].workshopQueue().cancel(jobId);
    finish("그리기를 그만뒀어요. 있는 기물로 할게요.", { declined: request.title });
  });
  footer.append(redraw, queueButton, existing);

  // 그림 높이 = 발밑 칸 + 위로 솟는 칸(rise). 발밑만 적으면 「1×1」이라 해 놓고 두 칸 높이로 그려져 사용자가 놀란다(2026-10-21 VQA).
  const riseRows = Math.ceil(Math.max(0, request.rise) / 16);
  const size = `발밑 ${request.tilesW}×${request.tilesH}칸${riseRows ? ` · 그림은 ${request.tilesW}×${request.tilesH + riseRows}칸 높이` : ""} · ${KIND_LABELS[request.objectKind] ?? request.objectKind}`;
  const root = el("section", {
    class: "ai-tileset-change-card ai-store-card ai-objectgen-card",
    dataset: { testid: "ai-objectgen-card", harness: request.harnessId, tileset: request.tilesetId },
    attrs: { "aria-label": `「${request.title}」 그리기` },
    children: [
      el("span", { class: "ai-tileset-change-eyebrow", text: "없는 기물 그리기" }),
      el("h3", { text: `「${request.title}」을(를) 그려 넣어요` }),
      el("p", { class: "ai-tileset-change-reason", text: request.description }),
      el("p", { class: "ai-tileset-change-detail", text: `칩셋 「${request.tilesetName}」의 색과 그림 느낌으로 ${size}${request.base ? ` · (${request.base.x},${request.base.y})에 놓아요` : ""}. 내 AI 계정으로 그리고, 이 게임에만 들어가요.` }),
      reference,
      candidates,
      el("label", { class: "ai-store-agree ai-objectgen-auto", children: [autoBox, "알아서 고르기 — 검수를 통과한 첫 후보를 바로 넣어요(이 기기에 기억)"] }),
      status,
      footer,
    ],
  });
  start();
  return { root, settled: settledPromise };
}

/**
 * 한 턴의 없는 기물 요청 묶음. 모두 작업 줄에 함께 서서 동시에 그린다. 묶음이 모두 끝나면(넣음·그만둠) 후속 요청 하나를 보낸다.
 * 하나만 오래 걸리면 「넣은 것부터 놓게 하기」로 먼저 보낼 수 있다(남은 것은 끝날 때 따로 보낸다).
 */
export function createObjectGenBatch(requests: readonly ObjectGenRequest[], followUp: ObjectGenFollowUp): HTMLElement {
  const modules = Promise.all([import("@/editor/workshop/queue/workshopQueue"), import("@/editor/workshop/pixels"), import("@/editor/workshop/chat"), import("@/editor/workshop/gateBadge")]);
  const cards = requests.map((request) => objectGenCard(request, modules));
  if (cards.length === 1) {
    void cards[0]!.settled.then((outcome) => followUp(outcomeText([outcome], requests)));
    return cards[0]!.root;
  }
  const outcomes: (Outcome | null)[] = cards.map(() => null);
  const sent = new Set<number>();
  const summary = el("p", { class: "ai-tileset-change-detail", attrs: { role: "status" }, dataset: { testid: "ai-objectgen-batch-status" } });
  const flush = el("button", { text: "넣은 것부터 놓게 하기", attrs: { type: "button", disabled: "" }, dataset: { testid: "ai-objectgen-batch-flush" } }) as HTMLButtonElement;
  const send = (indices: number[]): void => {
    const ready = indices.filter((i) => outcomes[i] && !sent.has(i));
    if (!ready.length) return;
    for (const i of ready) sent.add(i);
    followUp(outcomeText(ready.map((i) => outcomes[i]!), ready.map((i) => requests[i]!)));
  };
  const paint = (): void => {
    const done = outcomes.filter(Boolean).length;
    const unsent = outcomes.filter((outcome, i) => outcome && !sent.has(i)).length;
    summary.textContent = done === cards.length
      ? `${cards.length}개를 모두 마쳤어요.`
      : `${cards.length}개를 함께 그려요 · ${done}개 끝남. 다 끝나면 조수가 한 번에 놓아요.`;
    flush.disabled = unsent === 0 || done === cards.length;
  };
  flush.addEventListener("click", () => { send(outcomes.map((_, i) => i)); paint(); });
  cards.forEach((card, index) => {
    void card.settled.then((outcome) => {
      outcomes[index] = outcome;
      if (outcomes.every(Boolean)) send(outcomes.map((_, i) => i));
      paint();
    });
  });
  paint();
  return el("section", {
    class: "ai-objectgen-batch", dataset: { testid: "ai-objectgen-batch", count: String(cards.length) },
    attrs: { "aria-label": `없는 기물 ${cards.length}개 그리기` },
    children: [
      el("div", { class: "ai-objectgen-batch-head", children: [summary, flush] }),
      ...cards.map((card) => card.root),
    ],
  });
}

/** 끝난 카드들 → 조수에게 보낼 후속 요청 하나. */
function outcomeText(outcomes: readonly Outcome[], requests: readonly ObjectGenRequest[]): string {
  const placed = outcomes.filter((outcome): outcome is { text: string } => "text" in outcome).map((outcome) => outcome.text);
  const declined = outcomes.filter((outcome): outcome is { declined: string } => "declined" in outcome).map((outcome) => outcome.declined);
  const lines = [...placed];
  if (declined.length) {
    const need = requests.find((request) => declined.includes(request.title))?.need ?? "";
    lines.push(`[사용자 선택] ${declined.map((title) => `「${title}」`).join(", ")}은(는) 새로 그리지 말고 있는 기물로 가장 가까운 대안을 만들어라. generate_missing_object 를 다시 부르지 마라.${need ? ` 원래 요청: ${need}` : ""}`);
  }
  return lines.join("\n");
}

/** 옛 호출자(aiStoreCard) — 요청 하나짜리 묶음. */
export function createObjectGenCard(request: ObjectGenRequest, followUp: ObjectGenFollowUp): HTMLElement {
  return createObjectGenBatch([request], followUp);
}
