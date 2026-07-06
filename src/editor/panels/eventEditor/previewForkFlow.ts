import { el } from "@/util/dom";
import { commandSummary } from "./commandSummary";
import type { Command, Condition } from "@/project/types";

// 조건 분기(fork) 프리뷰: 조건 요약 뱃지 + 참/거짓 분기 흐름도 카드(명령 수).
export function previewForkFlow(cmd: Extract<Command, { kind: "fork" }>): HTMLElement {
  const root = el("div", { class: "ecp-fork", dataset: { testid: "ecp-fork-preview" } });
  root.append(
    el("div", {
      class: "ecp-fork-cond",
      children: [
        el("span", { class: "ecp-fork-cond-icon", text: "◇" }),
        el("span", { class: "ecp-fork-cond-text", text: describeCondition(cmd.condition) }),
      ],
    })
  );
  root.append(
    el("div", {
      class: "ecp-fork-branches",
      children: [
        branchCard("참일 때 (then)", cmd.then.length, "then"),
        cmd.else
          ? branchCard("그 외 (else)", cmd.else.length, "else")
          : branchCard("그 외 (else)", 0, "else-absent"),
      ],
    })
  );
  return root;
}

function branchCard(label: string, count: number, variant: "then" | "else" | "else-absent"): HTMLElement {
  return el("div", {
    class: `ecp-fork-branch ${variant}`,
    children: [
      el("span", { class: "ecp-fork-branch-label", text: label }),
      el("span", {
        class: "ecp-fork-branch-count",
        text: variant === "else-absent" ? "분기 없음" : `${count}개 명령`,
      }),
    ],
  });
}

// conditionSummary 는 commandSummary 안에 private 하므로, fork 요약("조건 분기: <cond>")에서
// 접두어만 떼어 재사용한다(중복 구현 방지).
function describeCondition(condition: Condition): string {
  const full = commandSummary({ kind: "fork", condition, then: [] });
  const sep = full.indexOf(": ");
  return sep >= 0 ? full.slice(sep + 2) : full;
}
