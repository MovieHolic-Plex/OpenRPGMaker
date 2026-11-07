// 자료집 개요의 「퀘스트」 표 — 등록된 퀘스트와 아직 등록하지 않은 제안을 한 표로 본다.
//
// 전에는 「퀘스트 제안」 목록과 「이야기 구조」의 퀘스트 블록이 따로 있어서, 퀘스트가 스무 개쯤 되면 두 곳을 오가며
// 스크롤해야 했고 어느 NPC 가 부탁하는지 찾아갈 길이 없었다. 행 모델은 src/project/quest/questTable.ts(순수)다.
// 시작·보고 칸을 누르면 자료집을 닫고 그 맵을 열어 그 이벤트를 고르고 카메라를 옮긴다(focusEditorRegion — 채팅 답변 링크와 같은 길).
// 데려갈 수 없는 칸은 누를 수 없고 이유를 칸 안에 보인다.
// 저자가 쓴 글(퀘스트 제목·맵/이벤트 이름·대사)은 data-i18n-skip 요소에 담는다(openwiki/i18n.md).
import { editorState } from "@/editor/editorState";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { registerQuestCandidate } from "@/project/quest/questCandidates";
import {
  buildQuestTableRows,
  filterQuestTableRows,
  questTableCounts,
  type QuestJumpTarget,
  type QuestTableFilter,
  type QuestTablePlace,
  type QuestTableReward,
  type QuestTableRow,
} from "@/project/quest/questTable";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const FILTERS: readonly { readonly id: QuestTableFilter; readonly label: string }[] = [
  { id: "all", label: "전체" },
  { id: "registered", label: "등록됨" },
  { id: "suggested", label: "제안" },
];

let currentFilter: QuestTableFilter = "all";

function authored(tag: "span" | "strong" | "p", text: string, className?: string): HTMLElement {
  return el(tag, { ...(className ? { class: className } : {}), attrs: { "data-i18n-skip": "" }, text });
}

/** 자료집을 닫고 그 맵·이벤트로 간다. 이벤트가 사라졌으면 아무것도 바꾸지 않고 false. */
export function jumpToQuestEvent(target: QuestJumpTarget): boolean {
  if (!target.ok) return false;
  const event = store.getCurrent().maps[target.mapId]?.events.find((entry) => entry.id === target.eventId);
  if (!event) {
    toast("그 이벤트를 더 이상 찾을 수 없습니다.", "error");
    return false;
  }
  // 정적으로 걸면 자료집 모달 → 개요 → 이 모듈로 되돌아오는 순환이 생긴다(spatialUsage.jumpToUsageRow 와 같은 이유).
  void import("./databaseModal").then(({ requestDatabaseModalClose }) => requestDatabaseModalClose("x"));
  if (!focusEditorRegion({ mapId: target.mapId, x: event.x, y: event.y, w: 1, h: 1 }, { highlight: true })) return false;
  editorState.set({ tool: "event", layer: "event", selectedEventId: event.id, selectedEventPageId: event.pages?.[0]?.id ?? null });
  return true;
}

function placeCell(place: QuestTablePlace | null, jump: QuestJumpTarget, role: "giver" | "turnin", rowId: string): HTMLElement {
  if (!jump.ok) {
    return el("td", {
      class: "db-quest-table-place",
      children: [
        el("button", {
          class: "db-quest-table-jump",
          attrs: { type: "button", disabled: "", title: jump.reason },
          dataset: { testid: `db-quest-table-${role}`, rowId, jump: "disabled" },
          children: [
            ...(place ? [authored("span", place.mapName, "db-quest-table-map"), authored("span", place.eventName, "db-quest-table-event")] : []),
            el("span", { class: "db-quest-table-why", text: jump.reason }),
          ],
        }),
      ],
    });
  }
  const shown = place!;
  return el("td", {
    class: "db-quest-table-place",
    children: [
      el("button", {
        class: "db-quest-table-jump",
        attrs: { type: "button", title: "맵에서 이 이벤트로 이동" },
        dataset: { testid: `db-quest-table-${role}`, rowId, jump: "ok", mapId: jump.mapId, eventId: jump.eventId },
        on: { click: () => { jumpToQuestEvent(jump); } },
        children: [
          authored("span", shown.mapName, "db-quest-table-map"),
          authored("span", shown.eventName, "db-quest-table-event"),
        ],
      }),
    ],
  });
}

function rewardCell(reward: QuestTableReward | null): HTMLElement {
  const inner = reward
    ? [
      ...(reward.gold > 0 ? [el("span", { class: "db-quest-table-gold", text: `${reward.gold.toLocaleString("ko-KR")} G` })] : []),
      ...reward.items.map((item) => authored("span", item.count > 1 ? `${item.name} ×${item.count}` : item.name, "db-quest-table-item")),
    ]
    : [el("span", { class: "db-overview-story-meta", text: "없음" })];
  return el("td", { children: [el("div", { class: "db-quest-table-reward", children: inner })] });
}

function statusCell(row: QuestTableRow, onRegistered: (title: string) => void): HTMLElement {
  const chip = row.status === "registered"
    ? el("span", { class: "db-quest-table-chip is-registered", text: "등록됨" })
    : row.status === "unreachable"
      ? el("span", { class: "db-quest-table-chip is-unreachable", text: "닿지 않음", attrs: { title: row.problem ?? "" } })
      : el("span", { class: "db-quest-table-chip is-suggested", text: `제안 ${Math.round((row.confidence ?? 0) * 100)}%` });
  const children: HTMLElement[] = [chip];
  if (row.status === "unreachable" && row.problem) children.push(el("span", { class: "db-quest-table-why", text: row.problem }));
  if (row.status === "suggested" && row.candidate) {
    const candidate = row.candidate;
    children.push(el("button", {
      class: "db-quest-table-register",
      text: "퀘스트로 등록",
      attrs: { type: "button", ...(row.registrable ? {} : { disabled: "", title: "아이템으로만 끝나는 흐름이라 진행 값(스위치·변수)이 없습니다." }) },
      dataset: { testid: "db-quest-table-register", candidateId: candidate.id },
      on: {
        click: () => {
          store.update((draft) => { registerQuestCandidate(draft, candidate); }, { scope: "project", label: "퀘스트 제안 등록", reason: candidate.title });
          onRegistered(candidate.title);
        },
      },
    }));
  }
  return el("td", { children: [el("div", { class: "db-quest-table-status", children })] });
}

function tableRow(row: QuestTableRow, onRegistered: (title: string) => void): HTMLElement {
  return el("tr", {
    class: `db-quest-table-row is-${row.status}`,
    dataset: { testid: "db-quest-table-row", rowId: row.id, status: row.status },
    children: [
      el("td", {
        class: "db-quest-table-title",
        children: [
          authored("strong", row.title),
          ...(row.request ? [authored("span", `“${row.request}”`, "db-quest-table-request")] : []),
        ],
      }),
      placeCell(row.giver, row.giverJump, "giver", row.id),
      placeCell(row.turnIn, row.turnInJump, "turnin", row.id),
      rewardCell(row.reward),
      statusCell(row, onRegistered),
    ],
  });
}

export function renderQuestTable(): HTMLElement {
  const section = el("section", {
    class: "db-overview-story-structure db-quest-table-section",
    attrs: { "aria-labelledby": "db-quest-table-title" },
    dataset: { testid: "db-quest-table" },
  });
  const summary = el("p", { dataset: { testid: "db-quest-table-count" } });
  const chips = el("div", { class: "db-quest-table-filters", attrs: { role: "group", "aria-label": "퀘스트 거르기" } });
  const body = el("tbody");
  const empty = el("p", { class: "db-overview-story-empty", dataset: { testid: "db-quest-table-empty" } });
  const status = el("p", { class: "db-overview-story-hint", attrs: { role: "status" }, dataset: { testid: "db-quest-table-status" } });
  const table = el("table", {
    class: "db-quest-table",
    children: [
      el("thead", {
        children: [el("tr", {
          children: ["퀘스트", "시작(부탁)", "보고", "보상", "상태"].map((label) => el("th", { attrs: { scope: "col" }, text: label })),
        })],
      }),
      body,
    ],
  });
  const scroller = el("div", { class: "db-quest-table-scroll", children: [table] });

  const fill = (): void => {
    const rows = buildQuestTableRows(store.getCurrent());
    const counts = questTableCounts(rows);
    const shown = filterQuestTableRows(rows, currentFilter);
    summary.textContent = `등록 ${counts.registered + counts.unreachable}개 · 제안 ${counts.suggested}개${counts.unreachable > 0 ? ` · 닿지 않음 ${counts.unreachable}개` : ""}`;
    chips.replaceChildren(...FILTERS.map((filter) => el("button", {
      class: `db-quest-table-filter${filter.id === currentFilter ? " is-active" : ""}`,
      attrs: { type: "button", "aria-pressed": String(filter.id === currentFilter) },
      dataset: { testid: `db-quest-table-filter-${filter.id}` },
      text: `${filter.label} ${filter.id === "all" ? rows.length : filter.id === "suggested" ? counts.suggested : counts.registered + counts.unreachable}`,
      on: { click: () => { currentFilter = filter.id; fill(); } },
    })));
    body.replaceChildren(...shown.map((row) => tableRow(row, (title) => {
      status.textContent = `등록했습니다: ${title} — 플레이 중 퀘스트 로그에 나타납니다.`;
      fill();
    })));
    scroller.hidden = shown.length === 0;
    empty.hidden = shown.length > 0;
    empty.textContent = rows.length === 0
      ? "아직 퀘스트가 없고, 퀘스트처럼 보이는 이벤트 흐름도 찾지 못했습니다."
      : "이 거르기에 맞는 퀘스트가 없습니다.";
  };

  section.append(
    el("header", {
      children: [
        el("h3", { attrs: { id: "db-quest-table-title" }, text: "퀘스트" }),
        summary,
        el("p", { class: "db-overview-story-hint", text: "시작·보고 칸을 누르면 맵에서 그 이벤트로 이동합니다. 제안은 부탁 → 진행 값 → 부탁한 인물의 반응으로 이어진 이벤트 흐름이며, 등록해도 이벤트는 바뀌지 않습니다." }),
      ],
    }),
    chips,
    scroller,
    empty,
    status,
  );
  fill();
  return section;
}
