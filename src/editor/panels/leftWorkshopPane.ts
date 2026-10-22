// src/editor/panels/leftWorkshopPane.ts
import "@/styles/database/workshop/index.css";
/**
 * 왼쪽 활동 막대 「공방」: 2026-10-23 부터 「한 번에 만들기」 하나(oneClick/oneClickPanel.ts) — 물건·캐릭터·지형 탭, 한 줄, 「만들기」.
 * 아래는 묶음 가져오기(글자 단추)와 곧 들어올 생성기(아이템). 옛 생성기 카드 넷(`editor/workshop/generators.ts`)은 곧 들어올 카드에만 쓴다.
 * 쓸 수 있는 카드는 실제 견본 그림 띠 + 한 줄 소개 + 상태 + 주 단추 하나(보조는 글자 단추). 곧 들어올 카드는 작게 아래에 둔다.
 * 2026-10-21 사용자 결정으로 하네스 목록(실내 가구·맵 소품 카드)을 뺐다 — 물건 그리기 실행기는 「물건·가구」 카드 안으로 들어갔다.
 * AI 가 필요한 버튼은 AI 가 준비됐을 때만 보인다. 연결 전이면 「AI 연결하기」, 서버가 AI 를 껐으면 안내 글만 보인다.
 */
import { AI_CONNECTION_STATUS_CHANGED_EVENT } from "@/editor/panels/aiConnectionStatus";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { workshopAiReady } from "@/editor/workshop/chat";
import { GENERATOR_STATUS_LABELS, WORKSHOP_GENERATORS, type WorkshopGenerator } from "@/editor/workshop/generators";
import { objectWorkshopHarness } from "@/editor/workshop/mapObjectTarget";
import { WORKSHOP_CHANGED_EVENT } from "@/editor/workshop/workshopSession";
import { workshopQueue } from "@/editor/workshop/queue/workshopQueue";
import { craftBar, generatorStage, workshopEmblem } from "@/editor/workshop/workshopArt";
import { oneClickLayoutKey, oneClickSignature, refreshOneClickCard, renderOneClick } from "@/editor/workshop/oneClick/oneClickPanel";
import { clearChildren, el } from "@/util/dom";

/** 물건 그리기 진행 — 두 실행기(실내 가구·지금 맵 칩셋)를 합쳐 센다. 아직 연 적 없으면 null. */
/** 물건 카드의 진행 수 — 작업 줄과 같은 수(알약·판 머리와 어긋나지 않게, 2026-10-21 VQA). */
function objectProgress(): { drawing: number; active: number; choose: number; paused: number; progress: number | null } | null {
  const { counts, jobs } = workshopQueue().snapshot();
  if (!jobs.length) return null;
  // 막대는 지금 그리는 작업들의 평균 진행(20칸으로 끊어 다시 그리기를 줄인다). 그리는 것 없이 줄만 서 있으면 끝을 모르는 막대.
  const working = jobs.filter((view) => view.state === "reference" || view.state === "drawing" || view.state === "review");
  const progress = working.length ? Math.round((working.reduce((sum, view) => sum + view.progress, 0) / working.length) * 20) / 20 : null;
  return { drawing: counts.active + counts.queued, active: counts.active, choose: counts.ready, paused: counts.paused, progress };
}

function button(text: string, testid: string, onClick: () => void, primary = false): HTMLButtonElement {
  return el("button", {
    class: primary ? "left-workshop-primary" : "left-workshop-link", text, attrs: { type: "button" }, dataset: { testid },
    on: { click: onClick },
  });
}

function openObjectWorkshop(): void {
  void import("@/editor/workshop/workshopWorkspace").then(({ openWorkshop }) => openWorkshop(objectWorkshopHarness()));
}

function openGen(generator: "char-gen" | "tile-gen" | "object-gen"): void {
  void Promise.all([import("@/editor/workshop/workshopWorkspace"), import("@/editor/workshop/genWorkspace")]).then(([workspace, gen]) => {
    workspace.closeWorkshop();
    gen.openGenWorkspace(generator);
  });
}

function generatorCard(generator: WorkshopGenerator, ai: { ready: boolean; hostOff: boolean }): HTMLElement {
  const actions: HTMLElement[] = [];
  const notes: HTMLElement[] = [];
  if (generator.id === "object-gen") {
    if (ai.ready) {
      actions.push(button("새 물건 그리기", "workshop-gen-open-object-gen", openObjectWorkshop, true));
      const progress = objectProgress();
      if (progress && progress.drawing + progress.choose + progress.paused > 0) {
        const meta = el("span", {
          class: "left-workshop-meta", dataset: { testid: "left-workshop-progress" },
          text: progress.paused ? `그리는 중 ${progress.drawing} · 고를 차례 ${progress.choose} · 멈춤 ${progress.paused}` : `그리는 중 ${progress.drawing} · 고를 차례 ${progress.choose}`,
        });
        // 그리는 작업이 있으면 대장간 막대(진행 평균), 줄만 서 있으면 끝을 모르는 막대
        notes.push(progress.drawing > 0
          ? el("div", { class: "left-workshop-forge", children: [craftBar({ value: progress.active ? progress.progress : null, hot: progress.active > 0, label: "후보 그리기" }), meta] })
          : meta);
      }
    } else if (ai.hostOff) {
      notes.push(el("p", { class: "left-workshop-note", dataset: { testid: "left-workshop-no-ai" }, text: "이 서버는 AI를 꺼 두어 여기서 그릴 수 없어요. 만든 묶음은 가져올 수 있어요." }));
    } else {
      actions.push(button("내 AI 연결하기", "left-workshop-connect", () => { openAiSettingsModal(); }, true));
      notes.push(el("p", { class: "left-workshop-note", dataset: { testid: "left-workshop-no-ai" }, text: "그림은 내 AI 계정으로 그려요. 연결하면 바로 만들 수 있어요." }));
    }
    actions.push(button("만든 묶음 가져오기", "workshop-gen-import-object-gen", () => openGen("object-gen"), actions.length === 0));
  } else if (generator.id === "char-gen" || generator.id === "tile-gen") {
    const id = generator.id;
    actions.push(button("부탁하고 가져오기", `workshop-gen-open-${id}`, () => openGen(id), true));
  }
  return el("li", {
    class: `left-workshop-card is-${generator.status}`,
    dataset: { testid: `workshop-gen-card-${generator.id}`, status: generator.status },
    children: [
      // 무대: 그 생성기가 실제로 만든 도트(정수 배율, 캐릭터는 제자리 걸음). 견본이 없으면 모눈 빈 작업대.
      ...(generator.sample || generator.status === "local" || generator.status === "ready" ? [generatorStage(generator, "card")] : []),
      el("div", {
        class: "left-workshop-card-body",
        children: [
          el("div", {
            class: "left-workshop-card-head",
            children: [
              el("strong", { text: generator.title }),
              el("span", { class: `left-workshop-status is-${generator.status}`, text: GENERATOR_STATUS_LABELS[generator.status] }),
            ],
          }),
          el("p", { class: "left-workshop-description", text: generator.makes }),
          ...notes,
          ...(actions.length ? [el("div", { class: "left-workshop-actions", children: actions })] : []),
        ],
      }),
    ],
  });
}

export function createLeftWorkshopPane(): { root: HTMLElement; show(): void; dispose(): void } {
  const root = el("section", { class: "left-workshop-pane", attrs: { "aria-label": "공방" }, dataset: { testid: "left-workshop-pane" } });
  let lastLayout = "";
  /** 작업 줄·시계가 부를 때: 창 위쪽 모양이 같으면 진행 카드만 고친다(무대 그림을 다시 읽지 않게 — 검은 띠 깜빡임). */
  const update = (): void => {
    if (root.hidden) return;
    if (lastLayout === oneClickLayoutKey() && refreshOneClickCard(root, render)) return;
    render();
  };
  const render = (): void => {
    if (root.hidden) return;
    // 입력 중이면 글자·포커스를 지키려고 다시 그리지 않는다(작업 줄이 자주 알린다).
    const focused = root.contains(document.activeElement) && (document.activeElement as HTMLElement | null)?.tagName === "INPUT";
    if (focused) { pendingRender = true; return; }
    pendingRender = false;
    lastLayout = oneClickLayoutKey();
    clearChildren(root);
    root.append(
      el("div", { class: "left-workshop-heading", children: [workshopEmblem(32), el("h2", { class: "left-workshop-title", text: "공방" })] }),
      el("p", { class: "left-workshop-lead", text: "한 줄로 적고 「만들기」. 다 되면 「맵에 놓기」로 바로 놓아요." }),
    );
    renderOneClick(root, render);
    const kind = (root.querySelector("[data-testid=workshop-oneclick]") as HTMLElement | null)?.dataset.kind;
    const importGen = kind === "character" ? "char-gen" : kind === "terrain" ? "tile-gen" : "object-gen";
    root.append(el("div", {
      class: "left-workshop-actions",
      children: [button("만든 묶음 가져오기", `workshop-gen-import-${importGen}`, () => openGen(importGen))],
    }));
    const upcoming = WORKSHOP_GENERATORS.filter((g) => g.status === "next" || g.status === "soon");
    if (upcoming.length) {
      const ai = { ready: workshopAiReady(), hostOff: false };
      root.append(
        el("h3", { class: "left-workshop-subtitle", text: "곧 들어올 생성기" }),
        el("ul", { class: "left-workshop-list is-upcoming", children: upcoming.map((generator) => generatorCard(generator, ai)) }),
      );
    }
  };
  let pendingRender = false;
  const onFocusOut = (): void => { if (pendingRender) queueMicrotask(render); };
  root.addEventListener("focusout", onFocusOut);
  // 프로젝트 store 는 칠할 때마다 알린다 — 그걸 듣지 않고, 공방 세션이 바뀔 때만 다시 그린다(펼칠 때는 show).
  window.addEventListener(WORKSHOP_CHANGED_EVENT, update);
  // AI 연결 상태(연결됨·서버에서 꺼짐)가 바뀌면 연결 안내도 바로 바꾼다.
  window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
  // 작업 줄 수(그리는 중·고를 차례·멈춤)나 한 번에 만들기 진행이 바뀔 때만 다시 그린다 — 작업 줄은 자주 알린다.
  let lastProgress = JSON.stringify(objectProgress()) + oneClickSignature();
  const unsubscribeQueue = workshopQueue().subscribe(() => {
    const next = JSON.stringify(objectProgress()) + oneClickSignature();
    if (next === lastProgress) return;
    lastProgress = next;
    update();
  });
  // 경과 시간(30초 단위)을 갱신한다.
  const tick = window.setInterval(() => {
    const next = JSON.stringify(objectProgress()) + oneClickSignature();
    if (next === lastProgress) return;
    lastProgress = next;
    update();
  }, 5000);
  void workshopQueue().ensure().then(render, () => undefined);
  return {
    root, show: render,
    dispose: () => {
      unsubscribeQueue();
      window.clearInterval(tick);
      root.removeEventListener("focusout", onFocusOut);
      window.removeEventListener(WORKSHOP_CHANGED_EVENT, update);
      window.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
    },
  };
}
