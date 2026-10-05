// editor/panels/aiBetweenTurnLog.ts — 조수 패널의 「턴 사이 기록」 접이식 목록.
// 데이터는 uiEventLog 의 이 브라우저 링(최대 300건)이고, 문장·정렬은 aiBetweenTurnLogRows 가 만든다.
import { betweenTurnLogText, betweenTurnRowText, buildBetweenTurnRows, type BetweenTurnRow } from "./aiBetweenTurnLogRows";
import { clearAiUiEvents, listAiUiEvents } from "@/ai/uiEventLog";
import { copyTextToClipboard } from "@/util/clipboard";
import { el } from "@/util/dom";

const PAGE = 50;

export function createBetweenTurnLogSection(): HTMLElement {
  let shown = PAGE;
  let query = "";
  let lastRows: readonly BetweenTurnRow[] = [];
  const ALL = Number.MAX_SAFE_INTEGER;

  const summary = el("summary", { dataset: { testid: "ai-between-turns-summary" }, text: "턴 사이 기록" });
  const meta = el("p", { class: "ai-activity-meta", dataset: { testid: "ai-between-turns-meta" } });
  const search = el("input", {
    attrs: { type: "search", placeholder: "버튼·설정·이유 검색", "aria-label": "턴 사이 기록 검색" },
    dataset: { testid: "ai-between-turns-search" },
  }) as HTMLInputElement;
  const copyButton = el("button", {
    attrs: { type: "button", title: "지금 보이는 기록을 글로 복사합니다" },
    dataset: { testid: "ai-between-turns-copy" },
    text: "복사",
  }) as HTMLButtonElement;
  const clearButton = el("button", {
    attrs: { type: "button", title: "이 브라우저에 남은 턴 사이 기록을 지웁니다" },
    dataset: { testid: "ai-between-turns-clear" },
    text: "지우기",
  }) as HTMLButtonElement;
  const refreshButton = el("button", {
    attrs: { type: "button" }, dataset: { testid: "ai-between-turns-refresh" }, text: "새로 고침",
  }) as HTMLButtonElement;
  const moreButton = el("button", {
    attrs: { type: "button" }, dataset: { testid: "ai-between-turns-more" }, text: "이전 50건 더 보기",
  }) as HTMLButtonElement;
  const list = el("div", { dataset: { testid: "ai-between-turns-list" } });
  const status = el("p", { class: "ai-activity-meta", attrs: { role: "status" }, dataset: { testid: "ai-between-turns-status" } });

  function rowNode(row: BetweenTurnRow): HTMLElement {
    const tail = [
      row.reason ? `이유: ${row.reason}` : "",
      row.detail ?? "",
      row.disabled ? "비활성 상태" : "",
    ].filter(Boolean).join(" · ");
    return el("div", {
      class: "ai-activity-entry",
      dataset: { testid: "ai-between-turns-row", seq: row.key },
      children: [
        el("div", { class: "ai-activity-entry-title", children: [
          el("span", { class: "ai-activity-mark", text: "•" }),
          el("span", { text: `${row.clock} · ${betweenTurnRowText(row)}` }),
        ] }),
        ...(tail ? [el("small", { text: tail })] : []),
      ],
    });
  }

  function render(): void {
    const all = buildBetweenTurnRows(listAiUiEvents(), { query, limit: ALL });
    lastRows = all.slice(0, shown);
    meta.textContent = query
      ? `검색 결과 ${all.length}건 · 최신이 위`
      : `이 브라우저에 남은 기록 ${all.length}건 · 최신이 위`;
    list.replaceChildren(...(lastRows.length
      ? lastRows.map(rowNode)
      : [el("p", { class: "ai-activity-meta", text: query ? "검색 결과가 없어요." : "아직 턴 사이 기록이 없어요." })]));
    moreButton.hidden = all.length <= shown;
  }

  search.addEventListener("input", () => {
    query = search.value.toLowerCase();
    shown = PAGE;
    render();
  });
  moreButton.addEventListener("click", () => {
    shown += PAGE;
    render();
  });
  copyButton.addEventListener("click", () => {
    const snapshot = lastRows;
    void copyTextToClipboard(betweenTurnLogText(snapshot)).then((ok) => {
      status.textContent = ok ? `기록 ${snapshot.length}건을 복사했어요.` : "복사하지 못했어요 — 브라우저가 막았어요.";
    });
  });
  clearButton.addEventListener("click", () => {
    clearAiUiEvents();
    shown = PAGE;
    status.textContent = "이 브라우저의 턴 사이 기록을 지웠어요.";
    render();
  });
  refreshButton.addEventListener("click", () => {
    render();
    status.textContent = "다시 읽었어요.";
  });

  const view = el("section", {
    class: "ai-activity-view",
    attrs: { "aria-label": "턴 사이 기록" },
    dataset: { testid: "ai-between-turns-view" },
    children: [
      el("p", { class: "ai-activity-meta", text: "대화하지 않는 동안 남은 기록이에요 — 버튼·설정·보관 같은 프론트 동작만 담아요. 턴 안의 도구 실행은 「실행 기록」에서 봐요." }),
      el("div", { class: "ai-activity-filters", children: [search, copyButton, clearButton, refreshButton] }),
      meta,
      moreButton,
      list,
      status,
    ],
  });
  const root = el("details", {
    class: "ai-activity-history",
    dataset: { testid: "ai-between-turns" },
    children: [summary, el("div", { class: "ai-activity-history-body", children: [view] })],
  }) as HTMLDetailsElement;
  root.addEventListener("toggle", () => {
    if (root.open) render();
  });
  return root;
}
