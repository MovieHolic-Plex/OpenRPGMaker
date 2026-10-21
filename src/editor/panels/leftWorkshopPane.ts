// src/editor/panels/leftWorkshopPane.ts
import "@/styles/database/workshop/index.css";
/**
 * 왼쪽 활동 막대 「공방」: 생성기 카드 넷(물건·캐릭터·지형 + 곧 들어올 아이템, `editor/workshop/generators.ts`).
 * 쓸 수 있는 카드는 실제 견본 그림 띠 + 한 줄 소개 + 상태 + 주 단추 하나(보조는 글자 단추). 곧 들어올 카드는 작게 아래에 둔다.
 * 2026-10-21 사용자 결정으로 하네스 목록(실내 가구·맵 소품 카드)을 뺐다 — 물건 그리기 실행기는 「물건·가구」 카드 안으로 들어갔다.
 * AI 가 필요한 버튼은 AI 가 준비됐을 때만 보인다. 연결 전이면 「AI 연결하기」, 서버가 AI 를 껐으면 안내 글만 보인다.
 */
import { loadAiConfig } from "@/ai/llmClient";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { workshopAiReady } from "@/editor/workshop/chat";
import { GENERATOR_STATUS_LABELS, WORKSHOP_GENERATORS, type WorkshopGenerator } from "@/editor/workshop/generators";
import { objectWorkshopHarness } from "@/editor/workshop/mapObjectTarget";
import { WORKSHOP_CHANGED_EVENT } from "@/editor/workshop/workshopSession";
import { workshopQueue } from "@/editor/workshop/queue/workshopQueue";
import { clearChildren, el } from "@/util/dom";

/** 물건 그리기 진행 — 두 실행기(실내 가구·지금 맵 칩셋)를 합쳐 센다. 아직 연 적 없으면 null. */
/** 물건 카드의 진행 수 — 작업 줄과 같은 수(알약·판 머리와 어긋나지 않게, 2026-10-21 VQA). */
function objectProgress(): { drawing: number; choose: number; paused: number } | null {
  const { counts, jobs } = workshopQueue().snapshot();
  if (!jobs.length) return null;
  return { drawing: counts.active + counts.queued, choose: counts.ready, paused: counts.paused };
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

/** 견본 띠 — 그 생성기가 실제로 만든 도트를 2배 정수 배율로 보여 준다(견본이 있는 카드만). */
function sampleBand(sample: NonNullable<WorkshopGenerator["sample"]>): HTMLElement {
  return el("div", {
    class: "left-workshop-art",
    children: [
      el("img", { attrs: { src: sample.src, alt: sample.alt, width: String(sample.width * 2), height: String(sample.height * 2), loading: "lazy", decoding: "async" } }),
      ...(sample.caption ? [el("span", { class: "left-workshop-art-caption", text: sample.caption })] : []),
    ],
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
        notes.push(el("span", {
          class: "left-workshop-meta", dataset: { testid: "left-workshop-progress" },
          text: progress.paused ? `그리는 중 ${progress.drawing} · 고를 차례 ${progress.choose} · 멈춤 ${progress.paused}` : `그리는 중 ${progress.drawing} · 고를 차례 ${progress.choose}`,
        }));
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
      ...(generator.sample ? [sampleBand(generator.sample)] : generator.status === "local" || generator.status === "ready"
        ? [el("div", { class: "left-workshop-art is-empty", children: [el("span", { text: "견본은 첫 결과가 나오면 올라와요" })] })] : []),
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
  const render = (): void => {
    if (root.hidden) return;
    clearChildren(root);
    const ready = workshopAiReady();
    const hostOff = !ready && getAiConnectionStatus(loadAiConfig()).hostAiDisabled === true;
    root.append(
      el("h2", { class: "left-workshop-title", text: "공방" }),
      el("p", { class: "left-workshop-lead", text: "새 그림을 만들어 이 게임에 넣어요. 후보 중 마음에 드는 것은 내가 골라요." }),
      el("ul", { class: "left-workshop-list", children: WORKSHOP_GENERATORS.filter((g) => g.status === "ready" || g.status === "local").map((generator) => generatorCard(generator, { ready, hostOff })) }),
      el("h3", { class: "left-workshop-subtitle", text: "곧 들어올 생성기" }),
      el("ul", { class: "left-workshop-list is-upcoming", children: WORKSHOP_GENERATORS.filter((g) => g.status === "next" || g.status === "soon").map((generator) => generatorCard(generator, { ready, hostOff })) }),
    );
  };
  // 프로젝트 store 는 칠할 때마다 알린다 — 그걸 듣지 않고, 공방 세션이 바뀔 때만 다시 그린다(펼칠 때는 show).
  window.addEventListener(WORKSHOP_CHANGED_EVENT, render);
  // AI 연결 상태(연결됨·서버에서 꺼짐)가 바뀌면 연결 안내도 바로 바꾼다.
  window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
  // 작업 줄 수(그리는 중·고를 차례·멈춤)가 바뀔 때만 다시 그린다 — 작업 줄은 자주 알린다.
  let lastProgress = JSON.stringify(objectProgress());
  const unsubscribeQueue = workshopQueue().subscribe(() => {
    const next = JSON.stringify(objectProgress());
    if (next === lastProgress) return;
    lastProgress = next;
    render();
  });
  return {
    root, show: render,
    dispose: () => {
      unsubscribeQueue();
      window.removeEventListener(WORKSHOP_CHANGED_EVENT, render);
      window.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, render);
    },
  };
}
