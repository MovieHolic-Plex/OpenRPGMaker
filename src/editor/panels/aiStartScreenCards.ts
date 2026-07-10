// 기본 모드 시작 화면 카드(스펙 §5) — "이렇게 해보세요" + "최근 AI 작업".
// aiChatPanel.buildStartScreen이 basic 모드에서만 삽입한다. 표시 전용(YAGNI).
import type { AiActivityLogRecord } from "@/ai/activityLog";
import type { SuggestedRegionCommand } from "@/editor/regionTask/suggestedCommands";
import { el } from "@/util/dom";

export function formatRelativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function summarizeActivityResult(record: AiActivityLogRecord): string {
  if (!record.result.ok) return "오류";
  const cells = record.result.changedCells ?? 0;
  const events = record.result.changedEvents ?? 0;
  if (cells === 0 && events === 0) return "변경 없음";
  const parts: string[] = [];
  if (cells > 0) parts.push(`${cells}칸`);
  if (events > 0) parts.push(`이벤트 ${events}건`);
  return parts.join(" · ");
}

export function buildTryRegionCard(opts: {
  readonly commands: readonly SuggestedRegionCommand[];
  readonly onPick: (instruction: string) => void;
}): HTMLElement {
  return el("div", {
    class: "ai-start-basic-card",
    dataset: { testid: "ai-start-try-region" },
    children: [
      el("div", { class: "ai-start-basic-card-title", text: "이렇게 해보세요" }),
      el("div", {
        class: "ai-start-basic-card-body",
        text: "맵에서 영역을 드래그로 선택하면 ✨ 칩이 뜹니다. 아래 예시를 눌러 바로 시작할 수도 있어요.",
      }),
      el("div", {
        class: "ai-start-basic-chips",
        children: opts.commands.map((command) =>
          el("button", {
            class: "ai-start-basic-chip",
            text: command.label,
            attrs: { type: "button", title: command.instruction },
            dataset: { testid: `ai-start-try-${command.id}` },
            on: { click: () => opts.onPick(command.instruction) },
          }),
        ),
      }),
    ],
  });
}

export function buildRecentAiWorkCard(records: readonly AiActivityLogRecord[], now: Date): HTMLElement | null {
  if (records.length === 0) return null; // 빈 카드 금지(스펙 §5)
  const rows = records.slice(0, 3).map((record) =>
    el("div", {
      class: "ai-start-recent-row",
      children: [
        el("span", { class: "ai-start-recent-instruction", text: record.instruction.slice(0, 40) }),
        el("span", { class: "ai-start-recent-meta", text: `${summarizeActivityResult(record)} · ${formatRelativeTime(record.at, now)}` }),
      ],
    }),
  );
  return el("div", {
    class: "ai-start-basic-card",
    dataset: { testid: "ai-start-recent-work" },
    children: [el("div", { class: "ai-start-basic-card-title", text: "최근 AI 작업" }), ...rows],
  });
}
