// editor/panels/eventEditor/stagedDiffView.ts
// AI 초안을 **명령 목록이 있던 자리에** 표시하는 읽기 전용 미리보기.
//
// 왜 별도 렌더러인가: commandList.ts 의 행은 드래그·편집창·삭제 버튼이 달린 상호작용 행이다.
// 아직 적용하지 않은 초안을 그 행으로 그리면 "누르면 뭐가 되는지" 가 모호해진다. 그래서
// 클래스(.cmd-item / .cmd-kind / .cmd-summary-token / .cmd-line-marker)만 공유해 **같은 모양**을
// 유지하고, 상호작용은 「제외」 토글 하나로 줄인다.
//
// 초안을 도크 안의 별도 카드에 monospace 로 그리던 예전 방식은 목록과 시각 언어가 달라
// "넣으면 어떻게 보일지" 예측이 안 됐고, 8개 중 1개만 틀렸을 때 전부 버리거나 전부 받는
// 선택밖에 없었다.

import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import {
  countCommandDiff,
  type CommandDiffBranch,
  type CommandDiffRow,
  type CommandDiffStatus,
} from "./commandDiff";
import { commandSummaryParts, isSummaryIconPart, isSummaryVisualPart } from "./commandSummary";

export type StagedDiffViewOptions = {
  readonly rows: readonly CommandDiffRow[];
  /** 되돌린(적용하지 않을) 행 id. 호출자가 소유하고 이 뷰는 읽기만 한다. */
  readonly excluded: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
};

const STATUS_MARK: Readonly<Record<CommandDiffStatus, string>> = {
  keep: "",
  add: "＋",
  remove: "−",
  change: "→",
};

const STATUS_WORD: Readonly<Record<CommandDiffStatus, string>> = {
  keep: "그대로",
  add: "새로 생김",
  remove: "없어짐",
  change: "바뀜",
};

export function renderStagedDiff(options: StagedDiffViewOptions): HTMLElement {
  const host = el("div", {
    class: "cmd-staged",
    dataset: { testid: "ai-event-staged" },
    attrs: { role: "list", "aria-label": "적용하면 이렇게 됩니다" },
  });
  appendRows(host, options.rows, options);
  if (host.childElementCount === 0) {
    host.append(el("div", { class: "empty-hint", text: "(명령 없음)" }));
  }
  return host;
}

/** 도크 상태줄에 쓰는 한 줄 요약. "새로 3개 · 바뀜 1개" 처럼 바뀐 것만 말한다. */
export function stagedDiffSummary(
  rows: readonly CommandDiffRow[],
  excluded: ReadonlySet<string>,
): string {
  const counts = countCommandDiff(rows, excluded);
  const parts: string[] = [];
  if (counts.added > 0) parts.push(`새로 ${counts.added}개`);
  if (counts.changed > 0) parts.push(`바뀜 ${counts.changed}개`);
  if (counts.removed > 0) parts.push(`없어짐 ${counts.removed}개`);
  return parts.length > 0 ? parts.join(" · ") : "바뀌는 것 없음";
}

function appendRows(
  host: HTMLElement,
  rows: readonly CommandDiffRow[],
  options: StagedDiffViewOptions,
): void {
  for (const row of rows) {
    host.append(renderRow(row, options));
    for (const branch of row.branches) appendBranch(host, row, branch, options);
  }
}

function appendBranch(
  host: HTMLElement,
  parent: CommandDiffRow,
  branch: CommandDiffBranch,
  options: StagedDiffViewOptions,
): void {
  // 분기 머리글은 부모 상태를 물려받는다 — 새로 생긴 fork 의 「조건이 맞을 때」도 새것이다.
  host.append(markerLine(branch.label, parent.depth, parent.status));
  if (branch.rows.length === 0) {
    host.append(markerLine("비어 있음", parent.depth + 1, parent.status));
    return;
  }
  appendRows(host, branch.rows, options);
}

function markerLine(text: string, depth: number, status: CommandDiffStatus): HTMLElement {
  const line = el("div", {
    class: "cmd-line-marker cmd-marker-fork cmd-staged-marker",
    text,
    dataset: { cmdDepth: String(depth), stagedStatus: status },
  });
  line.style.setProperty("--cmd-depth", String(depth));
  return line;
}

function renderRow(row: CommandDiffRow, options: StagedDiffViewOptions): HTMLElement {
  const reverted = row.status !== "keep" && options.excluded.has(row.id);
  // 되돌린 행은 원래 모습으로 보여야 한다 — 삭제를 취소했으면 그 명령이 그대로 남는 그림이다.
  const shown: CommandDiffStatus = reverted ? "keep" : row.status;
  const item = el("div", {
    class: "cmd-item cmd-staged-row",
    dataset: {
      testid: `ai-event-staged-row-${row.status}`,
      stagedId: row.id,
      stagedStatus: shown,
      stagedReverted: reverted ? "true" : "false",
      cmdDepth: String(row.depth),
    },
    attrs: { role: "listitem" },
  });
  item.style.setProperty("--cmd-depth", String(row.depth));

  const head = el("div", { class: "cmd-head cmd-staged-head" });
  head.style.setProperty("--cmd-depth", String(row.depth));
  head.append(el("span", {
    class: "cmd-staged-mark",
    text: STATUS_MARK[shown],
    attrs: { "aria-hidden": "true" },
  }));

  if (row.status === "change" && row.before && row.after) {
    head.append(el("span", {
      class: "cmd-staged-pair",
      children: reverted
        ? [summaryOf(row.before)]
        : [
          withClass(summaryOf(row.before), "cmd-staged-before"),
          el("span", { class: "cmd-staged-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
          withClass(summaryOf(row.after), "cmd-staged-after"),
        ],
    }));
  } else {
    const command = shownCommand(row, reverted);
    head.append(command ? summaryOf(command) : el("span", { class: "cmd-kind" }));
  }

  if (row.status !== "keep") {
    head.append(renderToggle(row, reverted, options));
  }
  item.append(head);
  return item;
}

function shownCommand(row: CommandDiffRow, reverted: boolean): Command | undefined {
  if (reverted) return row.before ?? row.after;
  return row.after ?? row.before;
}

function renderToggle(
  row: CommandDiffRow,
  reverted: boolean,
  options: StagedDiffViewOptions,
): HTMLElement {
  // 버튼 글자는 "지금 누르면 무엇이 되는가" 를 적는다. 상태 이름을 적으면 매번 헷갈린다.
  const label = reverted ? "다시 적용" : "이건 빼기";
  const aria = reverted
    ? `이 ${STATUS_WORD[row.status]}을 다시 적용`
    : `이 ${STATUS_WORD[row.status]}을 적용하지 않기`;
  return el("button", {
    class: "cmd-staged-toggle",
    text: label,
    attrs: { type: "button", "aria-pressed": String(reverted), "aria-label": aria },
    dataset: { testid: `ai-event-staged-toggle-${row.id}` },
    on: { click: () => options.onToggle(row.id) },
  });
}

function withClass(node: HTMLElement, className: string): HTMLElement {
  node.classList.add(className);
  return node;
}

// 아이콘·썸네일 토큰은 초안 미리보기에서 생략한다(아직 존재하지 않는 리소스를 가리킬 수 있다).
function summaryOf(command: Command): HTMLElement {
  const summary = el("span", { class: "cmd-kind" });
  for (const part of commandSummaryParts(command)) {
    if (isSummaryIconPart(part) || isSummaryVisualPart(part)) continue;
    summary.append(el("span", { class: `cmd-summary-token ${part.tone}`, text: part.text }));
  }
  return summary;
}
