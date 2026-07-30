import { updateEvent } from "@/editor/eventActions";
import { store } from "@/project/store";
import type { GameEvent, MapId, NpcScheduleEntry } from "@/project/types";
import { el } from "@/util/dom";
import { mapSelectElement } from "./sharedPickers";

export function renderEventScheduleEditor(mapId: MapId, event: GameEvent): HTMLElement | null {
  const schedule = event.schedule ?? [];
  if (schedule.length === 0) return null;

  const details = el("details", {
    class: "event-schedule-editor",
    dataset: { testid: "event-schedule-editor" },
  }) as HTMLDetailsElement;
  details.append(el("summary", {
    class: "event-schedule-summary",
    text: `NPC 일정 ${schedule.length}개`,
  }));

  const rows = el("div", { class: "event-schedule-rows" });
  schedule.forEach((entry, index) => rows.append(renderScheduleRow(mapId, event.id, entry, index)));
  details.append(rows);
  return details;
}

function renderScheduleRow(
  mapId: MapId,
  eventId: string,
  entry: NpcScheduleEntry,
  index: number,
): HTMLElement {
  const targetMap = mapSelectElement({
    selectedId: entry.at.mapId,
    testid: `event-schedule-map-${index}`,
    allowEmpty: false,
    onChange: (nextMapId) => updateScheduleEntry(mapId, eventId, index, (current) => ({
      ...current,
      at: { ...current.at, mapId: nextMapId },
    })),
  });
  const targetX = numberInput(entry.at.x, `event-schedule-x-${index}`);
  const targetY = numberInput(entry.at.y, `event-schedule-y-${index}`);
  const activity = el("input", {
    attrs: { type: "text", placeholder: "활동 (선택)" },
    value: entry.activity ?? "",
    dataset: { testid: `event-schedule-activity-${index}` },
  }) as HTMLInputElement;

  targetX.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    at: { ...current.at, x: integerValue(targetX) },
  })));
  targetY.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    at: { ...current.at, y: integerValue(targetY) },
  })));
  activity.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => {
    const nextActivity = activity.value.trim();
    return { ...current, activity: nextActivity || undefined };
  }));

  return el("div", {
    class: "event-schedule-row",
    dataset: { testid: `event-schedule-row-${index}` },
    children: [
      compactLabel("맵", targetMap),
      compactLabel("X", targetX),
      compactLabel("Y", targetY),
      compactLabel("활동", activity),
      el("button", {
        class: "btn small",
        text: "삭제",
        attrs: { type: "button" },
        dataset: { testid: `event-schedule-delete-${index}` },
        on: { click: () => deleteScheduleEntry(mapId, eventId, index) },
      }),
    ],
  });
}

function updateScheduleEntry(
  mapId: MapId,
  eventId: string,
  index: number,
  update: (entry: NpcScheduleEntry) => NpcScheduleEntry,
): void {
  const event = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
  const current = event?.schedule?.[index];
  if (!event || !current) return;
  const schedule = [...(event.schedule ?? [])];
  schedule[index] = update(current);
  updateEvent(mapId, eventId, { schedule });
}

function deleteScheduleEntry(mapId: MapId, eventId: string, index: number): void {
  const event = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
  if (!event?.schedule?.[index]) return;
  const schedule = event.schedule.filter((_entry, entryIndex) => entryIndex !== index);
  updateEvent(mapId, eventId, { schedule });
}

function numberInput(value: number, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", value: String(value), step: "1" },
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function compactLabel(text: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "event-schedule-label",
    children: [el("span", { text }), control],
  });
}

function integerValue(input: HTMLInputElement): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}
