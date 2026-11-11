// player/runtimeDebugRunLog.ts
// 테스트 플레이 🛠 디버그 패널의 「실행 로그」 칸(ED5 #1). 기록은 eventRunLog 가 갖고, 이 칸은 최근 항목을 보여 주고
// 「한 단계」 모드를 켜고 끈다. 패널(runtimeDebugPanel.ts)은 편집기 테스트 플레이 창에만 붙으므로 내보낸 게임에는 없다.

import { el } from "@/util/dom";
import { activeEventRunLog, type EventRunEffect, type EventRunEntry } from "@/player/eventRunLog";

const VISIBLE_ENTRIES = 40;

function effectText(effect: EventRunEffect): string {
  if ("switchId" in effect) return `${effect.switchId} ${effect.before ? "ON" : "OFF"}→${effect.after ? "ON" : "OFF"}`;
  return `${effect.variableId} ${effect.before}→${effect.after}`;
}

export function runLogLine(entry: EventRunEntry): string {
  const where = "eventId" in entry && entry.eventId ? entry.eventId : entry.type === "handEdit" ? "손 편집" : "공통";
  switch (entry.type) {
    case "runStart":
      return `#${entry.seq} ▶ ${where} 시작 (${entry.source})`;
    case "runEnd":
      return `#${entry.seq} ■ ${where} 끝: ${entry.outcome ?? ""}`;
    case "handEdit":
      return `#${entry.seq} ✎ 손 편집 ${effectText(entry.effect)}`;
    case "command": {
      const indent = "  ".repeat(Math.min(entry.depth, 6));
      const tail = entry.effect ? ` ${effectText(entry.effect)}` : entry.branch ? ` → ${entry.branch}` : "";
      return `#${entry.seq} ${indent}${where}[${entry.pc}] ${entry.kind}${tail}`;
    }
  }
}

export function renderRunLogSection(): HTMLElement {
  const list = el("pre", { class: "runtime-debug-state", dataset: { testid: "runtime-debug-runlog-list" }, text: "아직 실행된 이벤트가 없습니다." });
  const pausedLine = el("span", { class: "runtime-debug-live", dataset: { testid: "runtime-debug-step-paused" } });
  const stepToggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "runtime-debug-step-toggle" } }) as HTMLInputElement;
  const nextButton = el("button", {
    class: "runtime-debug-btn", text: "다음 ▶", attrs: { type: "button" }, dataset: { testid: "runtime-debug-step-next" },
    on: { click: () => activeEventRunLog()?.next() },
  }) as HTMLButtonElement;
  stepToggle.addEventListener("change", () => activeEventRunLog()?.setStepping(stepToggle.checked));
  const copyButton = el("button", {
    class: "runtime-debug-btn", text: "JSON 복사", attrs: { type: "button" }, dataset: { testid: "runtime-debug-runlog-copy" },
    on: { click: () => {
      const log = activeEventRunLog();
      if (log) void navigator.clipboard?.writeText(JSON.stringify(log.query({ limit: 500 }).entries, null, 1));
    } },
  });
  const clearButton = el("button", {
    class: "runtime-debug-btn", text: "지우기", attrs: { type: "button" }, dataset: { testid: "runtime-debug-runlog-clear" },
    on: { click: () => activeEventRunLog()?.clear() },
  });

  const section = el("details", {
    class: "runtime-debug-dump",
    dataset: { testid: "runtime-debug-runlog" },
    children: [
      el("summary", { text: "실행 로그" }),
      el("div", {
        class: "runtime-debug-controls",
        children: [
          el("label", { class: "runtime-debug-controls", children: [stepToggle, el("span", { text: "한 단계" })] }),
          nextButton, copyButton, clearButton, pausedLine,
        ],
      }),
      el("span", { class: "runtime-debug-label", text: "한 단계는 대화·자동 실행 이벤트만 멈춥니다. 병렬 이벤트는 멈추지 않고 기록만 합니다." }),
      list,
    ],
  }) as HTMLDetailsElement;

  let shownSeq = -1;
  const refresh = (): void => {
    const log = activeEventRunLog();
    const step = log?.stepState();
    stepToggle.checked = step?.stepping === true;
    nextButton.disabled = !step?.paused;
    const pausedText = step?.paused ? `멈춤: ${step.paused.eventId ?? "공통"}[${step.paused.pc}] ${step.paused.kind}` : step?.stepping ? "다음 명령을 기다림" : "";
    if (pausedLine.textContent !== pausedText) pausedLine.textContent = pausedText;
    if (!log || !section.open) return;
    const result = log.query({ limit: VISIBLE_ENTRIES });
    if (result.lastSeq === shownSeq) return;
    shownSeq = result.lastSeq;
    list.dataset.lastSeq = `${result.lastSeq}`;
    list.textContent = result.entries.length ? result.entries.map(runLogLine).join("\n") : "아직 실행된 이벤트가 없습니다.";
    list.scrollTop = list.scrollHeight;
  };
  section.addEventListener("toggle", () => { shownSeq = -1; refresh(); });
  if (typeof requestAnimationFrame === "function") {
    let mounted = false;
    const tick = (): void => {
      // 패널이 DOM 에 붙은 뒤 떨어지면(테스트 창 닫기) 루프를 멈춘다. 붙기 전 첫 프레임들은 기다린다.
      if (section.isConnected) mounted = true;
      else if (mounted) return;
      refresh();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  return section;
}
