// src/editor/workshop/queue/queueDock.ts
/**
 * 공방 작업 줄 화면 — 내려받기 관리자처럼 늘 닿는 작은 단추(오른쪽 아래) + 펼치는 판.
 * 판은 모달이 아니다: 맵을 계속 고치는 동안 작업이 돈다. 판에서 진행·남은 시간·그만두기·다시·멈춤/계속을 보고,
 * 고를 차례가 된 작업은 후보 그림을 바로 눌러 칩셋에 넣는다(넣기는 작업 줄 → installOwnership 예약 → 굽기).
 * 작업이 하나도 없으면 단추도 숨는다. 편집기(renderEditor)가 그릴 때 붙이고, 편집기를 걷으면 함께 떨어진다.
 */
import "@/styles/database/workshop/queue.css";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";
import { castThumbDataUrl, packCast } from "../castPreview";
import { gridDataUrl } from "../pixels";
import { armWorkshopStamp } from "../workshopBake";
import { jobStateLabel, pauseParts, SOURCE_LABELS, type JobState } from "./jobModel";
import { QUEUE_MAX_LIMIT, workshopQueue, type JobView, type QueueSnapshot } from "./workshopQueue";

const BACKGROUND = [150, 120, 90, 255] as const;
// 물건·캐릭터·지형 꼬리표 — 다른 화면의 짧은 낱말(「물건」→ Item 등)과 겹치지 않게 「… 그림」으로 쓴다(영어 번역이 맞게).
const GENERATOR_LABELS: Readonly<Record<string, string>> = { "object-gen": "물건 그림", "char-gen": "캐릭터 그림", "tile-gen": "지형 그림" };

let root: HTMLElement | null = null;
let open = false;
let unsubscribe: (() => void) | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let lastSignature = "";
const packThumbs = new Map<string, string>();
/** 작은 그림이 사람 묶음(얼굴·앞모습)인 작업 */
const packCastThumbs = new Set<string>();
const busy = new Set<string>();

/** 편집기 셸에 작업 줄 단추를 붙인다(여러 번 불러도 하나). */
export function mountWorkshopQueueDock(parent: HTMLElement = document.body): void {
  if (root?.isConnected) return;
  root = el("div", { class: "wq-dock", dataset: { testid: "workshop-queue-dock" }, attrs: { hidden: "" } });
  parent.append(root);
  const queue = workshopQueue();
  unsubscribe?.();
  unsubscribe = queue.subscribe(() => render(false));
  void queue.ensure().then(() => render(true));
  if (ticker) clearInterval(ticker);
  // 남은 시간·멈춤 풀리는 때를 1초마다 고친다(그림이 바뀌지 않으면 서명이 같아 다시 그리지 않는다).
  ticker = setInterval(() => {
    if (!root?.isConnected) { if (ticker) clearInterval(ticker); ticker = null; return; }
    void queue.ensure().then(() => render(false));
    clearFloatingNeighbours();
  }, 1000);
  document.addEventListener("keydown", onKeydown);
}

/**
 * 오른쪽 아래에 이미 떠 있는 편집기 단추(조수 제안 엿보기·떠 있는 조수 창)와 겹치지 않게, 그 위로 올라간다.
 * 겹쳐 놓으면 알약 글이 가려지고(1280 실측: 「9개 고를 차례」 위에 조수 제안 단추) 둘 다 누르기 어렵다.
 */
const FLOATING_NEIGHBOURS = ".ai-suggestion-peek-button";
/** 이보다 큰 것은 「단추」가 아니라 판·창이다 — 그 위로 올라가면 알약이 화면 위쪽(상단 막대)까지 날아간다(2026-10-21 실측). */
const NEIGHBOUR_MAX_PX = 96;
function clearFloatingNeighbours(): void {
  if (!root || root.hidden) return;
  const pill = root.querySelector<HTMLElement>(".wq-pill");
  if (!pill) return;
  // 오른쪽 조수 막대(접힌 세로 띠든 펼친 창이든) 왼쪽에 선다 — 판이 「Assistant」 세로 이름을 가렸다(2026-10-21 VQA).
  const rail = document.querySelector<HTMLElement>('[data-testid="editor-ai-dock"]')?.getBoundingClientRect();
  const right = rail && rail.width > 0 && rail.left > window.innerWidth / 2 ? Math.max(16, window.innerWidth - rail.left + 12) : 16;
  const rightValue = `${Math.round(right)}px`;
  if (root.style.right !== rightValue) root.style.right = rightValue;
  const edge = window.innerWidth - right;
  const left = edge - pill.offsetWidth;
  let lift = 16;
  for (const node of document.querySelectorAll<HTMLElement>(FLOATING_NEIGHBOURS)) {
    if (root.contains(node)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.height > NEIGHBOUR_MAX_PX || rect.width > NEIGHBOUR_MAX_PX * 3 || getComputedStyle(node).visibility === "hidden") continue;
    if (rect.right <= left || rect.left >= edge || rect.bottom < window.innerHeight - 120) continue;
    lift = Math.max(lift, window.innerHeight - rect.top + 8);
  }
  const value = `${Math.round(Math.min(lift, 16 + NEIGHBOUR_MAX_PX + 8))}px`;
  if (root.style.bottom !== value) root.style.bottom = value;
}

let suppressed = false;

/** 판을 알약으로 접고, 공방 큰 화면이 열려 있는 동안 알약을 숨긴다(닫히면 다시 보인다). */
export function collapseWorkshopQueue(hidePill = false): void {
  suppressed = hidePill;
  open = false;
  render(true);
}

/** 작업 줄 판을 연다(공방 화면·조수 카드의 「작업 줄 보기」). */
export function openWorkshopQueue(): void {
  open = true;
  if (!root?.isConnected) mountWorkshopQueueDock();
  render(true);
  root?.querySelector<HTMLElement>(".wq-panel")?.focus();
}

function onKeydown(event: KeyboardEvent): void {
  if (!open || event.key !== "Escape" || !root) return;
  if (!root.contains(document.activeElement)) return;
  open = false;
  render(true);
  root.querySelector<HTMLElement>(".wq-pill")?.focus();
}

function signature(snapshot: QueueSnapshot): string {
  return JSON.stringify([open, snapshot.limit, snapshot.hold, snapshot.hold?.until ? Math.ceil((snapshot.hold.until - Date.now()) / 1000) : 0, snapshot.backend, [...busy],
    snapshot.jobs.map((view) => (view.job.pause?.until ? Math.ceil((view.job.pause.until - Date.now()) / 1000) : 0)),
    snapshot.jobs.map((view) => [view.job.id, view.state, view.holding, Math.round(view.progress * 20), view.etaMs === null ? null : Math.ceil(view.etaMs / 60_000),
      view.job.pause?.reason, view.job.error, view.job.installWait, view.job.calls,
      view.round?.runs.map((run) => [run.status, run.grid?.cells.length ?? 0, run.verdict?.verdict ?? ""]), packThumbs.has(view.job.id)])]);
}

function render(force: boolean): void {
  if (!root) return;
  const snapshot = workshopQueue().snapshot();
  const next = signature(snapshot);
  if (!force && next === lastSignature) return;
  lastSignature = next;
  requestAnimationFrame(clearFloatingNeighbours);
  // 공방 큰 화면이 열려 있는 동안은 알약을 숨긴다(공방 머리에 「작업 줄」 단추가 있다) — 알약이 후보 카드 단추를 가렸다(2026-10-21 VQA).
  const visible = (snapshot.jobs.length > 0 && !suppressed) || open;
  root.hidden = !visible;
  if (!visible) return;
  const focusedJob = (document.activeElement as HTMLElement | null)?.closest?.("[data-job]")?.getAttribute("data-job") ?? null;
  const focusedAction = (document.activeElement as HTMLElement | null)?.dataset?.action ?? null;
  const listScroll = root.querySelector(".wq-list")?.scrollTop ?? 0;
  clearChildren(root);
  root.append(pill(snapshot));
  if (open) root.append(panel(snapshot));
  const list = root.querySelector(".wq-list");
  if (list) list.scrollTop = listScroll;
  if (focusedJob && focusedAction) root.querySelector<HTMLElement>(`[data-job="${focusedJob}"] [data-action="${focusedAction}"]`)?.focus();
}

function pill(snapshot: QueueSnapshot): HTMLElement {
  const { active, queued, ready, paused } = snapshot.counts;
  const working = active + queued;
  const parts: string[] = [];
  if (working) parts.push(`${working}개 진행`);
  if (ready) parts.push(`${ready}개 고를 차례`);
  if (paused) parts.push(`${paused}개 멈춤`);
  // 조각마다 따로 번역되게 span 으로 잇는다(한 덩이로 이으면 영어에서 「1개 진행 · 8 to pick」처럼 반만 바뀌었다).
  const label = partsNodes(parts.length ? parts : ["모두 끝남"]);
  return el("button", {
    class: "wq-pill" + (ready ? " has-ready" : "") + (snapshot.hold || paused ? " has-paused" : "") + (open ? " is-open" : ""),
    attrs: { type: "button", "aria-expanded": String(open), "aria-controls": "wq-panel", title: "공방 작업 줄" },
    dataset: { testid: "workshop-queue-pill" },
    on: { click: () => { open = !open; render(true); if (open) root?.querySelector<HTMLElement>(".wq-panel")?.focus(); } },
    children: [
      el("span", { class: "wq-pill-icon" + (active ? " is-spinning" : ""), attrs: { "aria-hidden": "true" } }),
      el("span", { class: "wq-pill-title", text: "공방 작업" }),
      el("span", { class: "wq-pill-count", children: label }),
    ],
  });
}

function panel(snapshot: QueueSnapshot): HTMLElement {
  const queue = workshopQueue();
  const { active, queued, ready, paused } = snapshot.counts;
  const waitingOthers = snapshot.jobs.some((view) => view.holding);
  const finished = snapshot.jobs.filter((view) => view.state === "installed" || view.state === "cancelled").length;
  return el("section", {
    class: "wq-panel", attrs: { id: "wq-panel", role: "dialog", "aria-label": "공방 작업 줄", tabindex: "-1" },
    dataset: { testid: "workshop-queue-panel" },
    children: [
      el("header", {
        class: "wq-head",
        children: [
          el("div", {
            class: "wq-head-text",
            children: [
              el("h2", { text: "공방 작업 줄" }),
              el("p", { class: "wq-summary", dataset: { testid: "workshop-queue-summary" }, children: partsNodes([`그리는 중 ${active}`, ...(queued ? [`대기 중 ${queued}`] : []), `고를 차례 ${ready}`, ...(paused ? [`멈춤 ${paused}`] : [])]) }),
            ],
          }),
          el("label", {
            class: "wq-limit",
            children: [
              el("span", { text: "동시에" }),
              el("select", {
                dataset: { testid: "workshop-queue-limit" }, attrs: { "aria-label": "동시에 도는 작업 수" },
                on: { change: (event) => queue.setLimit(Number((event.target as HTMLSelectElement).value)) },
                children: Array.from({ length: QUEUE_MAX_LIMIT }, (_, i) => i + 1).map((n) => el("option", { value: n, text: `${n}개`, attrs: n === snapshot.limit ? { selected: "" } : {} })),
              }),
            ],
          }),
          el("button", { class: "wq-close", text: "접기", attrs: { type: "button", "aria-label": "작업 줄 접기" }, on: { click: () => { open = false; render(true); } } }),
        ],
      }),
      ...(snapshot.hold ? [el("div", {
        class: "wq-hold", attrs: { role: "status" }, dataset: { testid: "workshop-queue-hold" },
        children: [
          el("strong", { text: snapshot.hold.probeJobId ? "다시 해 보는 중" : "잠시 멈춤" }),
          el("span", { children: partsNodes(pauseParts(snapshot.hold, Date.now())) }),
          ...(waitingOthers ? [el("span", { class: "wq-muted", text: "그동안 다른 작업은 AI 를 부르지 않고 기다려요." })] : []),
        ],
      })] : []),
      ...(snapshot.backend === "memory" ? [el("p", { class: "wq-hold", text: "이 브라우저는 저장소를 못 열어 새로 고침하면 작업 줄이 사라져요." })] : []),
      snapshot.jobs.length
        ? el("ol", { class: "wq-list", dataset: { testid: "workshop-queue-list" }, children: [...snapshot.jobs].reverse().map((view) => row(view, snapshot)) })
        : el("p", { class: "wq-empty", text: "작업이 없어요. 공방에서 물건을 그리거나 조수에게 없는 물건을 부탁하면 여기 줄을 서요." }),
      el("footer", {
        class: "wq-foot",
        children: [
          el("span", { class: "wq-muted", text: "창을 닫거나 맵을 고쳐도 계속 그려요. 새로고침해도 줄은 남아요." }),
          ...(finished ? [el("button", {
            class: "wq-link", text: `끝난 것 ${finished}개 지우기`, attrs: { type: "button" }, dataset: { testid: "workshop-queue-clear" },
            on: { click: () => void queue.clearFinished() },
          })] : []),
        ],
      }),
    ],
  });
}

function act(jobId: string, work: () => Promise<unknown>, failText: string): void {
  if (busy.has(jobId)) return;
  busy.add(jobId);
  render(true);
  work().catch((error: unknown) => toast(`${failText}: ${error instanceof Error ? error.message : String(error)}`, "error"))
    .finally(() => { busy.delete(jobId); render(true); });
}

function actionButton(text: string, action: string, onClick: () => void, primary = false, disabled = false, quiet = false): HTMLButtonElement {
  return el("button", {
    class: primary ? "wq-btn is-primary" : quiet ? "wq-btn is-quiet" : "wq-btn", text, attrs: { type: "button", ...(disabled ? { disabled: "" } : {}) },
    dataset: { action, testid: `workshop-queue-${action}` }, on: { click: onClick },
  }) as HTMLButtonElement;
}

/** 작업 그림: 고를 차례면 첫 후보, 그리는 중이면 지금까지 그린 후보(흐리게), 묶음은 첫 그림. */
function thumb(view: JobView): HTMLElement {
  const { job, round, item, session } = view;
  if (job.pack) {
    const url = packThumbs.get(job.id);
    if (!url) void loadPackThumb(job.id);
    // 사람 묶음은 밝은 바탕(물건용 갈색 바닥이 아니라) — 얼굴이나 앞모습 머리~가슴을 정수 배율로.
    return el("div", { class: "wq-thumb" + (packCastThumbs.has(job.id) ? " is-cast" : ""), children: url ? [el("img", { attrs: { src: url, alt: "" } })] : [] });
  }
  const run = round?.runs.find((candidate) => candidate.status === "done" && candidate.grid) ?? round?.runs.find((candidate) => candidate.grid);
  if (run?.grid && item && session) {
    const scale = Math.max(1, Math.floor(Math.min(52 / item.width, 52 / item.height)));
    return el("div", {
      class: "wq-thumb" + (view.state === "ready" || view.state === "installed" ? "" : " is-draft"),
      children: [el("img", { attrs: { src: gridDataUrl(run.grid, session.runner.palette(item), scale), alt: "" } })],
    });
  }
  return el("div", { class: `wq-thumb is-empty is-${view.state}`, attrs: { "aria-hidden": "true" } });
}

async function loadPackThumb(jobId: string): Promise<void> {
  if (packThumbs.has(jobId)) return;
  packThumbs.set(jobId, "");
  const queue = workshopQueue();
  const view = queue.snapshot().jobs.find((candidate) => candidate.job.id === jobId);
  const sha = view?.job.pack?.previewBlob;
  if (!view) return;
  try {
    const pack = await queue.packOf(view.job);
    // 사람 묶음: 시트 통째(288×256)를 52px 로 찌그러뜨리지 않고 첫 사람의 얼굴·앞모습을 쓴다.
    const castUrl = await castThumbDataUrl(packCast(pack.manifest, pack.blobs)).catch(() => null);
    if (castUrl) {
      packCastThumbs.add(jobId);
      packThumbs.set(jobId, castUrl);
      render(true);
      return;
    }
    const bytes = sha ? pack.blobs.get(sha) : undefined;
    if (!bytes) return;
    packThumbs.set(jobId, URL.createObjectURL(new Blob([bytes.slice()], { type: "image/png" })));
    render(true);
  } catch { /* 그림 없이 둔다 */ }
}

/**
 * 작업 한 줄 설명 — **조각마다 따로** 돌려준다. 화면 번역은 글 덩이 하나를 통째로 맞추므로 「후보 0/3장 · 약 18분 남음」처럼
 * 틀 안에 또 틀(「약 {0}분」)을 넣으면 영어에서 반쯤만 바뀌었다(2026-10-21 VQA). 조각은 각자 완성된 문장·숫자 틀이다.
 */
function stateParts(view: JobView): string[] {
  const { job, state } = view;
  if (view.holding) return ["계정이 풀리기를 기다리는 중"];
  if (state === "paused") return job.pause ? pauseParts(job.pause, Date.now()) : ["잠시 멈춤"];
  if (state === "installing") return [job.installWait ?? "넣는 중"];
  if (state === "failed") return [job.error ?? failedRunText(view) ?? "후보를 그리지 못했어요"];
  if (state === "cancelled") return ["그리기를 그만뒀어요"];
  if (state === "installed" && job.installed?.kind === "object") return [job.installed.auto ? `${job.installed.letter} 를 칩셋에 넣었어요(알아서 고르기)` : `${job.installed.letter} 를 칩셋에 넣었어요`];
  if (state === "installed") return ["이 게임에 넣었어요"];
  const minutes = view.etaMs === null ? null : Math.ceil(view.etaMs / 60_000);
  const total = view.round?.runs.length ?? job.count ?? 0;
  const done = view.round?.runs.filter((run) => run.status === "done").length ?? 0;
  if (state === "queued") return [minutes === null ? "줄 서는 중" : minutes <= 1 ? "1분 안에 시작" : `약 ${minutes}분 뒤 시작`];
  if (state === "ready" && job.pack) return ["미리 보고 넣어 주세요"];
  if (state === "ready") return ["마음에 드는 후보를 눌러 넣으세요"];
  const left = minutes === null ? [] : [minutes <= 1 ? "1분 안에 끝나요" : `약 ${minutes}분 남음`];
  return total ? [`후보 ${done}/${total}장`, ...left] : left;
}


/** 조각들을 「 · 」로 이은 span 들(조각마다 따로 번역된다). */
function partsNodes(parts: readonly string[]): (HTMLElement | string)[] {
  return parts.flatMap((part, index) => (index === 0 ? [el("span", { text: part })] : [" · ", el("span", { text: part })]));
}

function failedRunText(view: JobView): string | null {
  return view.round?.runs.find((run) => run.status === "failed" && run.error)?.error ?? null;
}

function candidates(view: JobView): HTMLElement | null {
  const { job, round, item, session } = view;
  if (view.state !== "ready" || !round || !item || !session || job.pack) return null;
  const palette = session.runner.palette(item);
  const scale = Math.max(2, Math.floor(Math.min(64 / item.width, 64 / item.height)));
  return el("div", {
    class: "wq-candidates", attrs: { role: "group", "aria-label": "후보 고르기" },
    children: round.runs.filter((run) => run.grid).map((run) => {
      const passed = run.verdict?.verdict === "PASS";
      return el("button", {
        class: "wq-candidate" + (passed ? " is-pass" : ""), attrs: { type: "button", title: `${run.letter} 를 칩셋에 넣기`, "aria-label": `${run.letter} 를 칩셋에 넣기`, ...(busy.has(job.id) ? { disabled: "" } : {}) },
        dataset: { action: `pick-${run.letter}`, testid: "workshop-queue-pick", letter: run.letter },
        on: { click: () => act(job.id, () => workshopQueue().install(job.id, run.letter).then((outcome) => {
          if (outcome === "waiting") toast("조수가 그 맵에서 일하는 중이라, 끝나면 넣을게요.", "info");
        }), "넣지 못했어요") },
        children: [
          el("img", { attrs: { src: gridDataUrl(run.grid!, palette, scale, BACKGROUND), alt: `후보 ${run.letter}` } }),
          el("span", { class: "wq-candidate-tag", text: passed ? `${run.letter} · 검수 통과` : run.letter }),
        ],
      });
    }),
  });
}

function actions(view: JobView): HTMLElement[] {
  const queue = workshopQueue();
  const { job, state } = view;
  const id = job.id;
  const disabled = busy.has(id);
  const out: HTMLElement[] = [];
  const stateAct = (text: string, action: string, work: () => Promise<unknown>, primary = false) =>
    out.push(actionButton(text, action, () => act(id, work, "작업을 바꾸지 못했어요"), primary, disabled));
  if (state === "queued" || state === "reference" || state === "drawing" || state === "review") {
    stateAct("멈추기", "pause", () => queue.pause(id));
    stateAct("취소", "cancel", () => queue.cancel(id));
  } else if (state === "paused") {
    // 계정 한도로 멈춘 동안 「지금 다시」는 또 막히기 쉽다 — 주 단추로 두지 않는다(연결 끊김·직접 멈춤은 주 단추).
    const account = job.pause && (job.pause.kind === "quota" || job.pause.kind === "rate" || job.pause.kind === "auth");
    stateAct(job.pause?.kind === "user" ? "계속" : account ? "그래도 지금 해 보기" : "지금 다시 해 보기", "resume", () => queue.resume(id), !account);
    stateAct("취소", "cancel", () => queue.cancel(id));
  } else if (state === "ready" && job.pack) {
    stateAct("이 게임에 넣기", "install", () => queue.install(id, null), true);
    out.push(actionButton("줄에서 빼기", "remove", () => act(id, () => queue.remove(id), "작업을 바꾸지 못했어요"), false, disabled, true));
  } else if (state === "ready") {
    out.push(actionButton("공방에서 보기", "open", () => openInWorkshop(view), false, disabled));
    out.push(actionButton("줄에서 빼기", "cancel", () => act(id, () => queue.cancel(id), "작업을 바꾸지 못했어요"), false, disabled, true));
  } else if (state === "failed" || state === "cancelled") {
    stateAct("다시", "retry", () => queue.retry(id), state === "failed");
    out.push(actionButton("줄에서 빼기", "remove", () => act(id, () => queue.remove(id), "작업을 바꾸지 못했어요"), false, disabled, true));
  } else if (state === "installed") {
    if (job.installed?.kind === "object" && view.item && view.round) {
      const grid = view.round.runs.find((run) => run.letter === (job.installed as { letter: string }).letter)?.grid;
      if (grid) out.push(actionButton("맵에 놓기", "place", () => {
        const reason = armWorkshopStamp(view.item!, grid);
        if (reason) { toast(reason, "info"); return; }
        open = false;
        render(true);
        toast(`「${job.title}」 붓을 들었어요. 맵에서 놓을 곳을 누르세요. Esc 로 내려놓아요.`, "info");
      }, true, disabled));
    }
    out.push(actionButton("줄에서 빼기", "remove", () => act(id, () => queue.remove(id), "작업을 바꾸지 못했어요"), false, disabled, true));
  }
  return out;
}

function openInWorkshop(view: JobView): void {
  if (!view.job.harnessId) return;
  void import("../workshopWorkspace").then(({ openWorkshop }) => openWorkshop(view.job.harnessId!));
}

const STATE_TONE: Readonly<Record<JobState, string>> = {
  queued: "wait", reference: "work", drawing: "work", review: "work", ready: "ready", installing: "wait",
  installed: "done", failed: "bad", paused: "warn", cancelled: "muted",
};

function row(view: JobView, _snapshot: QueueSnapshot): HTMLElement {
  const { job, state } = view;
  const tone = view.holding ? "warn" : STATE_TONE[state];
  const showBar = state === "queued" || state === "reference" || state === "drawing" || state === "review";
  return el("li", {
    class: `wq-row is-${tone}`, dataset: { job: job.id, state, testid: "workshop-queue-row", source: job.source },
    children: [
      thumb(view),
      el("div", {
        class: "wq-row-body",
        children: [
          el("div", {
            class: "wq-row-head",
            children: [
              el("strong", { class: "wq-title", text: job.title, attrs: { translate: "no", title: job.title } }),
              el("span", { class: `wq-state is-${tone}`, text: view.holding ? "기다림" : jobStateLabel(job, state) }),
            ],
          }),
          el("div", {
            class: "wq-meta",
            children: [
              el("span", { class: "wq-chip", text: SOURCE_LABELS[job.source] }),
              el("span", { class: "wq-chip", text: GENERATOR_LABELS[job.generator] ?? job.generator }),
              el("span", { class: "wq-line", dataset: { testid: "workshop-queue-line" }, children: partsNodes(stateParts(view)) }),
            ],
          }),
          ...(showBar ? [el("div", {
            class: "wq-bar", attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(view.progress * 100)), "aria-label": "진행" },
            children: [el("span", { attrs: { style: `width: ${Math.max(4, Math.round(view.progress * 100))}%` } })],
          })] : []),
          ...[candidates(view)].filter((node): node is HTMLElement => node !== null),
          el("div", { class: "wq-actions", children: actions(view) }),
        ],
      }),
    ],
  });
}

/** 시험·정리용 */
export function unmountWorkshopQueueDock(): void {
  unsubscribe?.();
  unsubscribe = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
  document.removeEventListener("keydown", onKeydown);
  root?.remove();
  root = null;
  open = false;
  lastSignature = "";
}
