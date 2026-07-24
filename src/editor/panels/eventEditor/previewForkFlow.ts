import { el } from "@/util/dom";
import { commandSummary } from "./commandSummary";
import type { Command, Condition } from "@/project/types";
import type { CommandPreviewContext } from "./commandPreview";

export function previewForkFlow(cmd: Extract<Command, { kind: "fork" }>, context?: CommandPreviewContext): HTMLElement {
  const root = el("div", { class: "ecp-fork", dataset: { testid: "ecp-fork-preview" } });
  if (context?.skipped) root.classList.add("ecp-skipped");
  root.append(
    el("div", {
      class: "ecp-fork-cond",
      children: [
        el("span", { class: "ecp-fork-cond-icon", text: "◇" }),
        el("span", { class: "ecp-fork-cond-text", text: describeCondition(cmd.condition) }),
      ],
    })
  );
  if (context?.forkTaken) {
    const taken = context.forkTaken;
    root.append(
      el("div", {
        class: `ecp-fork-eval ${taken === "then" ? "is-true" : "is-false"}`,
        dataset: { testid: "ecp-fork-eval" },
        text: taken === "then" ? "조건 충족 → 참 분기 실행" : "조건 불충족 → 거짓 분기 실행",
      })
    );
  }
  root.append(
    el("div", {
      class: "ecp-fork-branches",
      children: [
        branchCard("참일 때 (then)", cmd.then.length, "then", context?.forkTaken === "then", context?.forkTaken === "else"),
        cmd.else
          ? branchCard("그 외 (else)", cmd.else.length, "else", context?.forkTaken === "else", context?.forkTaken === "then")
          : branchCard("그 외 (else)", 0, "else-absent", false, false),
      ],
    })
  );
  return root;
}

function branchCard(label: string, count: number, variant: "then" | "else" | "else-absent", taken = false, skipped = false): HTMLElement {
  const classes = [`ecp-fork-branch ${variant}`];
  if (taken) classes.push("taken");
  if (skipped) classes.push("skipped");
  return el("div", {
    class: classes.join(" "),
    children: [
      el("span", { class: "ecp-fork-branch-label", text: label }),
      el("span", {
        class: "ecp-fork-branch-count",
        text: variant === "else-absent" ? "분기 없음" : `${count}개 명령`,
      }),
      el("span", {
        class: "ecp-fork-branch-hint",
        text: taken ? "실행됨" : skipped ? "건너뜀" : variant === "then" ? "조건 참" : variant === "else" ? "조건 거짓" : "미사용",
      }),
    ],
  });
}

function describeCondition(condition: Condition): string {
  const full = commandSummary({ kind: "fork", condition, then: [] });
  const sep = full.indexOf(": ");
  return sep >= 0 ? full.slice(sep + 2) : full;
}
