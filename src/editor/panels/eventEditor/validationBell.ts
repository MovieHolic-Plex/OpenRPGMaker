// 이벤트 편집기 타이틀바의 검토 알림 종.
//
// 왜 (실측, 2026-08-28): 검증 요약은 `.event-editor` 맨 아래에 `<details>` 로 붙어 있었고,
// 스타일은 존재하지 않는 래퍼(`.event-editor-command-header`)에만 걸려 있어 **아무 CSS 도
// 적용되지 않은 브라우저 기본 `<details>`** 로 출하됐다. 창 맨 아래라 눈에도 안 띈다.
// 이제 창 오른쪽 위에 종 + 개수 배지로 세우고, 목록은 종을 눌러 여는 팝오버로 보여준다.
//
// 소유 관계: 종은 모달 헤더(모달 수명 내내 유지)의 자식이고, 내용은 `refresh()` 마다
// 갱신된다. 헤더를 다시 만들지 않으므로 열어둔 팝오버는 재렌더에도 닫히지 않는다.
import { editorState } from "@/editor/editorState";
import type { EventDraftIssue, EventDraftValidation } from "@/editor/eventDraftValidator";
import { clearChildren, el } from "@/util/dom";
import { openEventRailGroupFor } from "./pageProps";

const BELL_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
 stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
<path d="M18 8.6c0 4.2 1.1 5.9 1.9 6.8.4.4.1 1.1-.5 1.1H4.6c-.6 0-.9-.7-.5-1.1.8-.9 1.9-2.6 1.9-6.8a6 6 0 0 1 12 0Z"/>
<path d="M9.9 19.6a2.3 2.3 0 0 0 4.2 0"/></svg>`;

const SEVERITY_LABEL: Record<EventDraftIssue["severity"], string> = {
  error: "오류",
  warning: "경고",
  info: "안내",
};

type BellSeverity = EventDraftIssue["severity"] | "none";

/** 헤더에 한 번 세우는 종 껍데기. 내용은 refreshEventValidationBell 이 채운다. */
export function renderEventValidationBell(): HTMLDetailsElement {
  // 심각도 단어(`오류 1 · 경고 2`)는 **접기 전에** 보여야 한다.
  //
  // 예전엔 tally 가 팝오버 안에 있어서 헤더에는 빨간 숫자 하나만 떴다. 오류(저장 차단)와
  // 안내(무시 가능)는 비용이 전혀 다른데 배지가 둘을 구분하지 않았고, 구분하려면 종을
  // 눌러야 했다. 색으로만 구분한 셈이라 WCAG 1.4.1(색만으로 정보 전달 금지)에도 걸린다.
  // DESIGN.md §5 의 계약도 `오류 N · 경고 N · 안내 N` 이다.
  const tally = el("span", {
    class: "event-draft-validation-tally",
    dataset: { testid: "event-draft-validation-tally" },
  });
  const summary = el("summary", {
    class: "event-draft-validation-summary",
    dataset: { testid: "event-draft-validation-summary" },
    children: [
      el("span", { class: "event-draft-validation-bell", html: BELL_ICON }),
      el("span", {
        class: "event-draft-validation-count",
        dataset: { testid: "event-draft-validation-count" },
      }),
      tally,
    ],
  });
  const issues = el("div", { class: "event-draft-validation-issues" });
  const details = el("details", {
    class: "event-draft-validation",
    dataset: { testid: "event-draft-validation", severity: "none", count: "0" },
    children: [
      summary,
      el("div", {
        class: "event-draft-validation-popover",
        children: [
          el("div", {
            class: "event-draft-validation-head",
            children: [
              el("span", { class: "event-draft-validation-title", text: "검토할 항목" }),
            ],
          }),
          issues,
        ],
      }),
    ],
  }) as HTMLDetailsElement;
  details.hidden = true;
  installOutsideDismiss(details);
  return details;
}

/** 종의 개수·심각도·목록을 현재 검증 결과에 맞춘다. 이슈가 없으면 종 자체를 숨긴다. */
export function refreshEventValidationBell(root: ParentNode, validation: EventDraftValidation): void {
  const details = root.querySelector<HTMLDetailsElement>('[data-testid="event-draft-validation"]');
  if (!details) return;
  const summary = details.querySelector<HTMLElement>('[data-testid="event-draft-validation-summary"]');
  const count = details.querySelector<HTMLElement>('[data-testid="event-draft-validation-count"]');
  const tally = details.querySelector<HTMLElement>('[data-testid="event-draft-validation-tally"]');
  const issues = details.querySelector<HTMLElement>(".event-draft-validation-issues");
  if (!summary || !count || !tally || !issues) return;

  const total = validation.issues.length;
  details.dataset.severity = bellSeverity(validation);
  details.dataset.count = String(total);
  if (total === 0) {
    details.open = false;
    details.hidden = true;
    clearChildren(issues);
    return;
  }
  details.hidden = false;
  count.textContent = total > 99 ? "99+" : String(total);
  const tallyText = tallyLabel(validation);
  tally.textContent = tallyText;
  const label = `검토 필요 ${total}건 · ${tallyText}`;
  summary.setAttribute("aria-label", label);
  summary.title = `${label}\n종을 눌러 목록을 열고, 항목을 누르면 그 자리로 이동합니다.`;
  clearChildren(issues);
  validation.issues.forEach((issue, index) => {
    issues.append(renderIssueRow(issue, index, details));
  });
}

export function navigateToEventDraftIssue(issue: EventDraftIssue): void {
  if (issue.pageId) editorState.set({ selectedEventPageId: issue.pageId });
  const focusIssue = (): void => {
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    const root = modal ?? document.body;
    let target: HTMLElement | null = null;
    if (issue.commandPath) {
      const encoded = JSON.stringify(issue.commandPath);
      target = Array.from(root.querySelectorAll<HTMLElement>(".cmd-item, .row, .leaf"))
        .find((candidate) => candidate.dataset.cmdPath === encoded) ?? null;
      if (target) {
        root.querySelectorAll(".cmd-item.selected, .row.selected, .leaf.selected").forEach((node) => node.classList.remove("selected", "is-selected"));
        target.classList.add("selected", "is-selected");
        target = target.querySelector<HTMLElement>(".cmd-head, .line") ?? target;
      }
    }
    if (!target && issue.field) {
      target = root.querySelector<HTMLElement>(`[data-testid="${issue.field.testId}"]`);
    }
    if (!target) return;
    // 앵커가 닫힌 설정 레일 그룹 속이면 그 그룹을 여는 것까지 해야 사용자가 고칠 자리를 본다.
    // 그룹은 <details> 가 아니라 is-open 클래스라 아래 DETAILS 루프가 달지 못한다(#212).
    openEventRailGroupFor(target);
    for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true;
    }
    if (target.getAttribute("tabindex") === null && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/u.test(target.tagName)) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "center", inline: "nearest" });
  };
  focusIssue();
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focusIssue);
  }
}

function renderIssueRow(issue: EventDraftIssue, index: number, details: HTMLDetailsElement): HTMLElement {
  return el("button", {
    class: "event-draft-validation-issue",
    attrs: { type: "button" },
    dataset: {
      testid: `event-draft-validation-issue-${index}`,
      issueCode: issue.code,
      severity: issue.severity,
    },
    children: [
      el("span", { class: "event-draft-validation-severity", text: SEVERITY_LABEL[issue.severity] }),
      el("span", { class: "event-draft-validation-message", text: issue.message }),
    ],
    on: {
      click: () => {
        details.open = false;
        navigateToEventDraftIssue(issue);
      },
    },
  });
}

function bellSeverity(validation: EventDraftValidation): BellSeverity {
  if (validation.errorCount > 0) return "error";
  if (validation.warningCount > 0) return "warning";
  if (validation.infoCount > 0) return "info";
  return "none";
}

function tallyLabel(validation: EventDraftValidation): string {
  const parts: string[] = [];
  if (validation.errorCount > 0) parts.push(`${SEVERITY_LABEL.error} ${validation.errorCount}`);
  if (validation.warningCount > 0) parts.push(`${SEVERITY_LABEL.warning} ${validation.warningCount}`);
  if (validation.infoCount > 0) parts.push(`${SEVERITY_LABEL.info} ${validation.infoCount}`);
  return parts.join(" · ");
}

/**
 * 팝오버는 바깥을 누르면 닫힌다(히스토리·신분 팝오버와 같은 규약).
 * 리스너는 종이 열릴 때만 붙고, 모달이 사라져 종이 문서에서 떨어지면 스스로 걷힌다.
 */
function installOutsideDismiss(details: HTMLDetailsElement): void {
  if (typeof document === "undefined") return;
  const onPointerDown = (event: Event): void => {
    if (!details.isConnected) {
      document.removeEventListener("pointerdown", onPointerDown, true);
      return;
    }
    if (!details.open) return;
    const target = event.target;
    if (target instanceof Node && details.contains(target)) return;
    details.open = false;
  };
  details.addEventListener("toggle", () => {
    if (details.open) {
      document.addEventListener("pointerdown", onPointerDown, true);
      return;
    }
    document.removeEventListener("pointerdown", onPointerDown, true);
  });
}
