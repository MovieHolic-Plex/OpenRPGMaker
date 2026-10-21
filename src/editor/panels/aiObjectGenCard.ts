// editor/panels/aiObjectGenCard.ts
// 조수의 generate_missing_object(objectGenTool.ts)가 돌려준 요청을 턴이 끝난 뒤 카드로 보여 준다(2026-10-21).
// 카드가 공방 실행기(object-gen)로 후보를 그리고(사용자 자기 AI 계정), 사용자가 「이걸로 넣기」를 누르거나
// 사용자가 켠 「알아서 고르기」가 검수 통과 첫 후보를 골라 그 맵 칩셋에 굽는다. 그 뒤 조수에게 물체 id·자리를 후속 요청으로 보낸다.
// 굽기는 공방 칸(이 게임에만)이다 — 스토어 올리기·공용 DB 로는 나가지 못한다(storePublishBlockReason, object-gate 미배선).
// 위키: openwiki/editor-ai-tools.md 「없는 기물 그리기」.

import type { WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";
import type { ObjectGenRequest } from "@/editor/workshop/objectRequest";
import { objectGenFollowUp } from "@/editor/workshop/objectRequest";
import { clearChildren, el } from "@/util/dom";

export type ObjectGenFollowUp = (text: string) => void;

const RUN_STATUS: Readonly<Record<WorkshopRun["status"], string>> = {
  queued: "기다리는 중", drawing: "그리는 중", reviewing: "검수 중", done: "다 그림", failed: "못 그림", cancelled: "그만둠",
};
const BACKGROUND = [150, 120, 90, 255] as const;
const KIND_LABELS: Readonly<Record<string, string>> = { floor: "바닥에 세움", wall: "벽 앞", hang: "벽에 걺", flat: "바닥 무늬" };

function button(text: string, testid: string, onClick: () => void, primary = false): HTMLButtonElement {
  return el("button", { text, class: primary ? "is-primary" : "", attrs: { type: "button" }, dataset: { testid }, on: { click: onClick } });
}

export function createObjectGenCard(request: ObjectGenRequest, followUp: ObjectGenFollowUp): HTMLElement {
  const status = el("p", { class: "ai-tileset-change-status", attrs: { role: "status" } });
  const candidates = el("div", { class: "ai-objectgen-candidates", dataset: { testid: "ai-objectgen-candidates" } });
  const autoBox = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "ai-objectgen-autopick" } }) as HTMLInputElement;
  const footer = el("footer");
  let settled = false;
  let baking = false;
  let started: import("@/editor/workshop/assistantObjectGen").ObjectGenRun | null = null;
  let glue: typeof import("@/editor/workshop/assistantObjectGen") | null = null;
  let unsubscribe: (() => void) | null = null;
  const pickButtons: HTMLButtonElement[] = [];

  const finish = (text: string, next: string | null): void => {
    if (settled) return;
    settled = true;
    unsubscribe?.();
    unsubscribe = null;
    for (const node of [...pickButtons, ...footer.querySelectorAll("button")]) (node as HTMLButtonElement).disabled = true;
    status.textContent = text;
    if (next) followUp(next);
  };

  const bake = async (letter: string, auto: boolean): Promise<void> => {
    if (settled || baking || !started || !glue) return;
    baking = true;
    for (const node of pickButtons) node.disabled = true;
    status.textContent = auto ? `알아서 고르기: 검수를 통과한 ${letter} 를 칩셋에 넣는 중…` : `${letter} 를 칩셋에 넣는 중…`;
    try {
      const baked = await glue.bakeObjectGenRun(started, letter, auto);
      finish(`「${baked.title}」(${letter})을(를) 칩셋 ${baked.tilesetId} 에 넣었어요. 조수가 이어서 놓을게요.`, objectGenFollowUp(request, baked, auto ? "auto" : "user"));
    } catch (error) {
      status.textContent = `넣지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      for (const node of pickButtons) node.disabled = false;
    } finally {
      baking = false;
    }
  };

  const render = (round: WorkshopRound): void => {
    if (!glue || !started) return;
    const { gridDataUrl } = pixelsModule!;
    const item = started.session.items().find((candidate) => candidate.key === started!.itemKey);
    const palette = item ? started.session.runner.palette(item) : null;
    clearChildren(candidates);
    pickButtons.length = 0;
    for (const run of round.runs) {
      const passed = run.verdict?.verdict === "PASS";
      const verdict = run.status === "done" ? (passed ? "검수 통과" : "검수 불통과") : RUN_STATUS[run.status];
      const pick = button("이걸로 넣기", "ai-objectgen-pick", () => void bake(run.letter, false), passed);
      pick.disabled = settled || baking || run.status !== "done" || !run.grid;
      pickButtons.push(pick);
      const scale = item ? Math.max(2, Math.floor(Math.min(96 / item.width, 96 / item.height))) : 4;
      candidates.append(el("article", {
        class: `ai-objectgen-candidate${passed ? " is-pass" : ""}`,
        dataset: { letter: run.letter, status: run.status, verdict: run.verdict?.verdict ?? "" },
        children: [
          run.grid && palette
            ? el("img", { attrs: { alt: `후보 ${run.letter}`, src: gridDataUrl(run.grid, palette, scale, BACKGROUND) } })
            : el("div", { class: "ai-objectgen-placeholder", text: RUN_STATUS[run.status] }),
          el("strong", { text: `${run.letter} · ${verdict}` }),
          ...(run.status === "failed" && run.error ? [el("small", { text: run.error.slice(0, 80) })] : []),
          pick,
        ],
      }));
    }
    if (settled || baking) return;
    if (!glue.roundSettled(round)) {
      const done = round.runs.filter((r) => r.status === "done").length;
      status.textContent = `후보를 그리는 중이에요(${done}/${round.runs.length}). 한 판에 1~3분 걸려요. 다른 일을 해도 계속 그려요.`;
      return;
    }
    const auto = autoBox.checked ? glue.autoPickLetter(started) : null;
    if (auto) { void bake(auto, true); return; }
    const usable = round.runs.some((r) => r.status === "done" && r.grid);
    status.textContent = !usable
      ? "후보를 그리지 못했어요. 「다시 그리기」를 누르거나 조수에게 있는 것으로 해 달라고 하세요."
      : autoBox.checked
        ? "검수를 통과한 후보가 없어 알아서 고르지 않았어요. 마음에 드는 것을 직접 골라 주세요."
        : "마음에 드는 후보의 「이걸로 넣기」를 눌러 주세요. 검수 통과는 참고일 뿐 — 직접 보고 고르세요.";
  };

  let pixelsModule: typeof import("@/editor/workshop/pixels") | null = null;
  const start = async (): Promise<void> => {
    const [chat, pixels, loaded] = await Promise.all([
      import("@/editor/workshop/chat"), import("@/editor/workshop/pixels"), import("@/editor/workshop/assistantObjectGen"),
    ]);
    pixelsModule = pixels;
    glue = loaded;
    autoBox.checked = loaded.objectGenAutoPick();
    if (!chat.workshopAiReady()) {
      status.textContent = "그리려면 내 AI 계정을 연결해야 해요. 연결한 뒤 「다시 그리기」를 눌러 주세요.";
      const connect = button("AI 연결하기", "ai-objectgen-connect", () => {
        void import("@/editor/panels/aiSettingsModal").then(({ openAiSettingsModal }) => openAiSettingsModal());
      });
      if (!footer.querySelector('[data-testid="ai-objectgen-connect"]')) footer.prepend(connect);
      return;
    }
    status.textContent = "후보를 그리기 시작했어요…";
    started = await loaded.startObjectGenRound(request);
    const update = (): void => {
      const round = started ? loaded.currentRound(started) : null;
      if (round) render(round);
    };
    unsubscribe = started.session.subscribe(update);
    update();
  };
  const begin = (): void => {
    if (settled || started) return;
    start().catch((error: unknown) => {
      status.textContent = `그리기를 시작하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
    });
  };

  autoBox.addEventListener("change", () => {
    glue?.setObjectGenAutoPick(autoBox.checked);
    if (!glue || !started || settled) return;
    const round = glue.currentRound(started);
    if (round) render(round);
  });

  const redraw = button("다시 그리기", "ai-objectgen-redraw", () => {
    if (settled) return;
    if (!started) { begin(); return; }
    const session = started.session, round = glue?.currentRound(started);
    if (!round) return;
    for (const run of round.runs) if (run.status === "failed" || (run.status === "done" && run.verdict?.verdict !== "PASS")) void session.engine.redrawRun(round.id, run.letter, "");
  });
  const workshop = button("공방에서 보기", "ai-objectgen-open-workshop", () => {
    void import("@/editor/workshop/workshopWorkspace").then(({ openWorkshop }) => openWorkshop(request.harnessId));
  });
  const existing = button("있는 것으로 해 줘", "ai-objectgen-existing", () => {
    if (started && glue) { const round = glue.currentRound(started); if (round) void started.session.engine.cancelRound(round.id); }
    finish("그리기를 그만뒀어요. 있는 기물로 할게요.", `[사용자 선택] 「${request.title}」을(를) 새로 그리지 말고 있는 기물로 가장 가까운 대안을 만들어라. generate_missing_object 를 다시 부르지 마라. 원래 요청: ${request.need}`);
  });
  footer.append(redraw, workshop, existing);

  const size = `${request.tilesW}×${request.tilesH}칸 · ${KIND_LABELS[request.objectKind] ?? request.objectKind}`;
  const root = el("section", {
    class: "ai-tileset-change-card ai-store-card ai-objectgen-card",
    dataset: { testid: "ai-objectgen-card", harness: request.harnessId, tileset: request.tilesetId },
    attrs: { "aria-label": `「${request.title}」 그리기` },
    children: [
      el("span", { class: "ai-tileset-change-eyebrow", text: "없는 기물 그리기" }),
      el("h3", { text: `「${request.title}」을(를) 그려 넣어요` }),
      el("p", { class: "ai-tileset-change-reason", text: request.description }),
      el("p", { class: "ai-tileset-change-detail", text: `칩셋 「${request.tilesetName}」의 색과 그림 느낌으로 ${size}${request.base ? ` · (${request.base.x},${request.base.y})에 놓아요` : ""}. 내 AI 계정으로 그리고, 이 게임에만 들어가요.` }),
      candidates,
      el("label", { class: "ai-store-agree ai-objectgen-auto", children: [autoBox, "알아서 고르기 — 검수를 통과한 첫 후보를 바로 넣어요(이 기기에 기억)"] }),
      status,
      footer,
    ],
  });
  begin();
  return root;
}
