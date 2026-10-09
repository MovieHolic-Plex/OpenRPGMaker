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
import { navigateToEventCommand } from "./content";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";

import { renderEventValidationActions } from "./validationActions";
import { scrollIntoNearestScroller } from "./scrollIntoNearestScroller";

const closeBell = new WeakMap<HTMLDetailsElement, () => void>();

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
    attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
    dataset: { testid: "event-draft-validation-tally" },
  });
  const summary = el("summary", {
    class: "event-draft-validation-summary",
    dataset: { testid: "event-draft-validation-summary" },
    children: [
      el("span", { class: "event-draft-validation-bell", html: BELL_ICON }),
      el("span", {
        class: "event-draft-validation-count",
        attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
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
  details.querySelector(".event-draft-validation-popover")?.append(renderEventValidationActions(() => closeBell.get(details)?.()));
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
    closeBell.get(details)?.();
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
  const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
  if (issue.commandPath) {
    const mapId = modal?.dataset.mapId;
    const eventId = modal?.dataset.eventId;
    if (!mapId || !eventId || !navigateToEventCommand(mapId, eventId, issue.pageId, issue.commandPath)) return;
  } else if (issue.pageId) {
    editorState.set({ selectedEventPageId: issue.pageId });
  }
  if (!issue.field) return;
  if (issue.field.openTestId) modal?.querySelector<HTMLElement>(`[data-testid="${issue.field.openTestId}"]`)?.click();
  const root = issue.field.openTestId ? document.body : (issue.commandPath
    ? modal?.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]') : modal) ?? document.body;
  const scope = issue.field.conditionPath
    ? Array.from(root.querySelectorAll<HTMLElement>("[data-condition-path]"))
      .find(form => form.dataset.conditionPath === JSON.stringify(issue.field?.conditionPath))
    : issue.field.scopeTestId
      ? root.querySelector<HTMLElement>(`[data-testid="${issue.field.scopeTestId}"]`)
      : root;
  if (issue.field.selectTestId) scope?.querySelector<HTMLElement>(`[data-testid="${issue.field.selectTestId}"]`)?.click();
  const findField = () => scope?.querySelector<HTMLElement>(`[data-testid="${issue.field?.testId}"]`);
  const initialField = findField();
  if (issue.field.selectBeforeFocus) initialField?.click();
  const field = findField();
  if (!field) return;
  // Both custom selects and record pickers keep a hidden native select for form state.
  const target = scope?.querySelector<HTMLElement>(`[data-custom-select-for="${issue.field.testId}"]`)
    ?? (field.tagName === "SELECT" && field.classList.contains("event-record-modal-select")
      ? field.parentElement?.querySelector<HTMLElement>(".event-record-picker-trigger") : null)
    ?? field.querySelector<HTMLElement>(".event-record-picker-trigger, input[type=search], button")
    ?? field;
  openEventRailGroupFor(target);
  for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true;
  }
  for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
    const style = typeof getComputedStyle === "function" ? getComputedStyle(ancestor) : undefined;
    if (ancestor.hidden || style?.display === "none" || style?.visibility === "hidden") return;
  }
  if (target.getAttribute("tabindex") === null && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/u.test(target.tagName)) {
    target.setAttribute("tabindex", "-1");
  }
  target.focus({ preventScroll: true });
  // 자기 열 안에서만 스크롤한다 — scrollIntoView 는 워크벤치까지 밀어 올려 열 머리를 잘랐다.
  scrollIntoNearestScroller(target, "center");
}

function renderIssueRow(issue: EventDraftIssue, index: number, details: HTMLDetailsElement): HTMLElement {
  return el("button", {
    class: "event-draft-validation-issue",
    attrs: { type: "button" },
    dataset: {
      testid: `event-draft-validation-issue-${index}`,
      issueCode: issue.code,
      severity: issue.severity,
      commandPath: JSON.stringify(issue.commandPath ?? []),
      field: issue.field?.testId ?? "",
      selectTarget: issue.field?.selectTestId ?? "",
    },
    children: [
      el("span", { class: "event-draft-validation-severity", text: SEVERITY_LABEL[issue.severity] }),
      // 사람이 읽는 줄만 보인다: 무슨 일인지(원인) → 어떻게 하면 되는지(힌트). 코드·페이지 ID·
      // 명령 경로·testid 는 진단 복사(validationActions)와 dataset 에 남긴다 — 화면에 `page.invisible-collision ·
      // page_e869… · []` 같은 내부 토큰을 늘어놓는 것은 위키 «조건 문구에 내부 토큰을 넣지 마라» 위반이었다.
      el("span", { class: "event-draft-validation-message", attrs: { title: `${issue.code} · ${issue.pageId}${issue.commandPath?.length ? ` · ${JSON.stringify(issue.commandPath)}` : ""}` }, children: [
        el("span", { class: "event-draft-validation-cause", text: issue.cause ?? issue.message }),
        ...(issue.expected && issue.expected !== issue.hint ? [el("span", { class: "event-draft-validation-expected", text: issue.expected })] : []),
        ...(issue.hint ? [el("span", { class: "event-draft-validation-hint", text: issue.hint })] : []),
      ] }),
    ],
    on: {
      click: () => {
        closeBell.get(details)?.();
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
  const summary = details.querySelector("summary");
  let registered = false;
  let parent: HTMLElement | null = null;
  const observer = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => {
    if (!details.isConnected) dispose();
  });
  const close = (): void => {
    details.open = false;
    registered = false;
    unregisterModal(details);
    document.removeEventListener("pointerdown", onPointerDown, true);
    parent?.removeEventListener("oprn:event-editor-close", dispose);
    parent = null;
    observer?.disconnect();
  };
  const dispose = (): void => {
    close();
    details.removeEventListener("toggle", sync);
    summary?.removeEventListener("click", onSummaryClick);
    closeBell.delete(details);
  };
  const onPointerDown = (event: Event): void => {
    if (event.target instanceof Node && details.contains(event.target)) return;
    close();
  };
  const sync = (): void => {
    if (!details.open) { close(); return; }
    if (registered || !details.isConnected) return;
    registered = true;
    registerModal(details, () => {
      close();
      if (summary?.isConnected) summary.focus();
    });
    parent = details.closest<HTMLElement>('[data-testid="event-editor-modal"]');
    parent?.addEventListener("oprn:event-editor-close", dispose);
    document.addEventListener("pointerdown", onPointerDown, true);
    observer?.observe(document.body, { childList: true, subtree: true });
  };
  const onSummaryClick = (event: Event): void => {
    // Native toggle is queued; register synchronously so a following Escape cannot close the editor.
    event.preventDefault();
    details.open = !details.open;
    sync();
  };
  closeBell.set(details, close);
  summary?.addEventListener("click", onSummaryClick);
  details.addEventListener("toggle", sync);
}
