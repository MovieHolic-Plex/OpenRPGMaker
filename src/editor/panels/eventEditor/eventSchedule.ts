import { updateEvent } from "@/editor/eventActions";
import type { GameEvent, MapId, NpcScheduleEntry } from "@/project/types";
import { el } from "@/util/dom";

export function renderEventScheduleSection(mapId: MapId, event: GameEvent): HTMLElement {
  const textarea = el("textarea", {
    class: "event-schedule-json",
    value: JSON.stringify(event.schedule ?? [], null, 2),
    attrs: { rows: "8", spellcheck: "false" },
    dataset: { testid: "event-schedule-json" },
  }) as HTMLTextAreaElement;
  const status = el("div", {
    class: "empty-hint",
    text: scheduleSummary(event.schedule),
    dataset: { testid: "event-schedule-status" },
  });
  const apply = () => {
    const parsed = parseSchedule(textarea.value);
    if (parsed instanceof Error) {
      status.textContent = parsed.message;
      textarea.classList.add("invalid");
      return;
    }
    textarea.classList.remove("invalid");
    updateEvent(mapId, event.id, { schedule: parsed.length > 0 ? parsed : undefined });
    status.textContent = scheduleSummary(parsed);
  };
  const clear = () => {
    textarea.value = "[]";
    updateEvent(mapId, event.id, { schedule: undefined });
    status.textContent = scheduleSummary([]);
  };
  return el("fieldset", {
    class: "event-rm2k3-fieldset event-schedule-section",
    dataset: { testid: "event-schedule-section" },
    children: [
      el("legend", { text: "스케줄" }),
      textarea,
      el("div", {
        class: "event-schedule-actions",
        children: [
          el("button", {
            class: "btn small",
            text: "적용",
            attrs: { type: "button" },
            dataset: { testid: "event-schedule-apply" },
            on: { click: apply },
          }),
          el("button", {
            class: "btn small",
            text: "비우기",
            attrs: { type: "button" },
            dataset: { testid: "event-schedule-clear" },
            on: { click: clear },
          }),
        ],
      }),
      status,
    ],
  });
}

function parseSchedule(text: string): NpcScheduleEntry[] | Error {
  let value: unknown;
  try {
    value = JSON.parse(text || "[]");
  } catch (cause) {
    return new Error(`JSON 오류: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!Array.isArray(value)) return new Error("스케줄은 배열이어야 합니다.");
  return value as NpcScheduleEntry[];
}

function scheduleSummary(schedule: readonly NpcScheduleEntry[] | undefined): string {
  const count = schedule?.length ?? 0;
  return count === 0 ? "등록된 스케줄 없음" : `스케줄 ${count}개`;
}
