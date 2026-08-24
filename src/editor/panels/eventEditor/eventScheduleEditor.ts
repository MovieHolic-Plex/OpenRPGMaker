import { updateEvent } from "@/editor/eventActions";
import { SEASONS, TIME_PHASES, type Season, type TimePhase } from "@/project/gameTime";
import { store } from "@/project/store";
import type { Dir, GameEvent, MapId, NpcScheduleEntry } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { mapSelectElement } from "./sharedPickers";

const FACINGS = ["down", "left", "right", "up"] as const satisfies readonly Dir[];

export function renderEventScheduleEditor(mapId: MapId, event: GameEvent): HTMLElement {
  const details = el("details", {
    class: "event-schedule-editor",
    dataset: { testid: "event-schedule-editor" },
  }) as HTMLDetailsElement;

  const rerender = (): void => {
    clearChildren(details);
    const current = eventFromStore(mapId, event.id) ?? event;
    const schedule = current.schedule ?? [];
    details.append(
      el("summary", {
        class: "event-schedule-summary",
        text: `NPC 일정 ${schedule.length}개`,
      }),
      el("div", {
        class: "event-schedule-toolbar",
        children: [
          el("p", {
            class: "event-schedule-help",
            text: schedule.length === 0 ? "시간대별 이동 일정을 추가할 수 있습니다." : "조건과 목적지를 모두 편집할 수 있습니다.",
          }),
          el("button", {
            class: "btn small",
            text: "+ 일정 추가",
            attrs: { type: "button" },
            dataset: { testid: "event-schedule-add" },
            on: {
              click: () => {
                addScheduleEntry(mapId, event.id);
                details.open = true;
                rerender();
              },
            },
          }),
        ],
      }),
    );
    const rows = el("div", { class: "event-schedule-rows" });
    schedule.forEach((entry, index) => rows.append(renderScheduleRow(mapId, event.id, entry, index, rerender, index < schedule.length - 1 && isUnconditionalWhen(entry.when))));
    details.append(rows);
  };

  rerender();
  return details;
}

function renderScheduleRow(
  mapId: MapId,
  eventId: string,
  entry: NpcScheduleEntry,
  index: number,
  rerender: () => void,
  shadowsLater: boolean,
): HTMLElement {
  const timePhase = optionalSelect(
    entry.when.timePhase,
    TIME_PHASES.map((value) => ({ value, label: phaseLabel(value) })),
    `event-schedule-time-phase-${index}`,
  );
  const hourStart = numberInput(entry.when.hourRange?.[0] ?? 6, `event-schedule-hour-start-${index}`, 0, 47);
  const hourEnd = numberInput(entry.when.hourRange?.[1] ?? 18, `event-schedule-hour-end-${index}`, 0, 48);
  const hourEnabled = checkboxInput(entry.when.hourRange !== undefined, `event-schedule-hour-enabled-${index}`, "정확 시각 사용");
  hourStart.disabled = !hourEnabled.checked;
  hourEnd.disabled = !hourEnabled.checked;
  const season = optionalSelect(
    entry.when.season,
    SEASONS.map((value) => ({ value, label: seasonLabel(value) })),
    `event-schedule-season-${index}`,
  );
  const dayStart = numberInput(entry.when.dayRange?.[0] ?? 1, `event-schedule-day-start-${index}`, 1, 99);
  const dayEnd = numberInput(entry.when.dayRange?.[1] ?? 28, `event-schedule-day-end-${index}`, 1, 99);
  const dayEnabled = checkboxInput(entry.when.dayRange !== undefined, `event-schedule-day-enabled-${index}`, "날짜 범위 사용");
  dayStart.disabled = !dayEnabled.checked;
  dayEnd.disabled = !dayEnabled.checked;
  const targetMap = mapSelectElement({
    selectedId: entry.at.mapId,
    testid: `event-schedule-map-${index}`,
    allowEmpty: false,
    onChange: (nextMapId) => {
      updateScheduleEntry(mapId, eventId, index, (current) => ({
        ...current,
        at: {
          mapId: nextMapId,
          x: clampCoordinate(nextMapId, "x", current.at.x),
          y: clampCoordinate(nextMapId, "y", current.at.y),
        },
      }));
      rerender();
    },
  });
  const targetX = numberInput(entry.at.x, `event-schedule-x-${index}`);
  const targetY = numberInput(entry.at.y, `event-schedule-y-${index}`);
  const facing = optionalSelect(
    entry.facing,
    FACINGS.map((value) => ({ value, label: facingLabel(value) })),
    `event-schedule-facing-${index}`,
  );
  const activity = el("input", {
    attrs: { type: "text", placeholder: "활동 (선택)" },
    value: entry.activity ?? "",
    dataset: { testid: `event-schedule-activity-${index}` },
  }) as HTMLInputElement;

  timePhase.addEventListener("change", () => updateWhen(mapId, eventId, index, {
    timePhase: timePhase.value ? timePhase.value as TimePhase : undefined,
  }));
  hourEnabled.addEventListener("change", () => {
    hourStart.disabled = !hourEnabled.checked;
    hourEnd.disabled = !hourEnabled.checked;
    updateWhen(mapId, eventId, index, {
      hourRange: hourEnabled.checked ? [clampInput(hourStart, 0, 47), clampInput(hourEnd, 0, 48)] : undefined,
    });
  });
  hourStart.addEventListener("change", () => updateWhen(mapId, eventId, index, {
    hourRange: [clampInput(hourStart, 0, 47), clampInput(hourEnd, 0, 48)],
  }));
  hourEnd.addEventListener("change", () => updateWhen(mapId, eventId, index, {
    hourRange: [clampInput(hourStart, 0, 47), clampInput(hourEnd, 0, 48)],
  }));
  season.addEventListener("change", () => updateWhen(mapId, eventId, index, {
    season: season.value ? season.value as Season : undefined,
  }));
  dayEnabled.addEventListener("change", () => {
    dayStart.disabled = !dayEnabled.checked;
    dayEnd.disabled = !dayEnabled.checked;
    updateWhen(mapId, eventId, index, {
      dayRange: dayEnabled.checked ? [clampInput(dayStart, 1, 99), clampInput(dayEnd, 1, 99)] : undefined,
    });
  });
  dayStart.addEventListener("change", () => updateWhen(mapId, eventId, index, {
    dayRange: [clampInput(dayStart, 1, 99), clampInput(dayEnd, 1, 99)],
  }));
  dayEnd.addEventListener("change", () => updateWhen(mapId, eventId, index, {
    dayRange: [clampInput(dayStart, 1, 99), clampInput(dayEnd, 1, 99)],
  }));
  targetX.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    at: { ...current.at, x: clampInput(targetX, 0, maxCoordinate(current.at.mapId, "x")) },
  })));
  targetY.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    at: { ...current.at, y: clampInput(targetY, 0, maxCoordinate(current.at.mapId, "y")) },
  })));
  facing.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    facing: facing.value ? facing.value as Dir : undefined,
  })));
  activity.addEventListener("change", () => updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    activity: activity.value.trim() || undefined,
  })));

  return el("div", {
    class: "event-schedule-row",
    dataset: { testid: `event-schedule-row-${index}` },
    children: [
      ...(shadowsLater ? [el("p", {
        class: "event-schedule-shadow-warning",
        text: "이 행은 조건이 없어 뒤의 일정을 가립니다. 항상 일정은 마지막 행으로 옮기거나 조건을 추가하세요.",
        dataset: { testid: `event-schedule-shadow-warning-${index}` },
      })] : []),
      el("div", {
        class: "event-schedule-condition-grid",
        children: [
          compactLabel("시간대", timePhase),
          compactLabel("정확 시각", el("span", { class: "event-schedule-range", children: [hourEnabled, hourStart, el("span", { text: "–" }), hourEnd] })),
          compactLabel("계절", season),
          compactLabel("날짜", el("span", { class: "event-schedule-range", children: [dayEnabled, dayStart, el("span", { text: "–" }), dayEnd] })),
        ],
      }),
      el("div", {
        class: "event-schedule-target-grid",
        children: [
          compactLabel("맵", targetMap),
          compactLabel("X", targetX),
          compactLabel("Y", targetY),
          compactLabel("방향", facing),
          compactLabel("활동", activity),
        ],
      }),
      el("button", {
        class: "btn small danger",
        text: "일정 삭제",
        attrs: { type: "button" },
        dataset: { testid: `event-schedule-delete-${index}` },
        on: {
          click: () => {
            deleteScheduleEntry(mapId, eventId, index);
            rerender();
          },
        },
      }),
    ],
  });
}

function addScheduleEntry(mapId: MapId, eventId: string): void {
  const event = eventFromStore(mapId, eventId);
  if (!event) return;
  const schedule = [...(event.schedule ?? []), {
    when: {},
    at: { mapId, x: event.x, y: event.y },
  } satisfies NpcScheduleEntry];
  updateEvent(mapId, eventId, { schedule });
}

function updateWhen(mapId: MapId, eventId: string, index: number, patch: Partial<NpcScheduleEntry["when"]>): void {
  updateScheduleEntry(mapId, eventId, index, (current) => ({
    ...current,
    when: compactWhen({ ...current.when, ...patch }),
  }));
}

function compactWhen(when: NpcScheduleEntry["when"]): NpcScheduleEntry["when"] {
  return {
    ...(when.timePhase ? { timePhase: when.timePhase } : {}),
    ...(when.hourRange ? { hourRange: when.hourRange } : {}),
    ...(when.season ? { season: when.season } : {}),
    ...(when.dayRange ? { dayRange: when.dayRange } : {}),
  };
}

function updateScheduleEntry(
  mapId: MapId,
  eventId: string,
  index: number,
  update: (entry: NpcScheduleEntry) => NpcScheduleEntry,
): void {
  const event = eventFromStore(mapId, eventId);
  const current = event?.schedule?.[index];
  if (!event || !current) return;
  const schedule = [...(event.schedule ?? [])];
  schedule[index] = update(current);
  updateEvent(mapId, eventId, { schedule });
}

function deleteScheduleEntry(mapId: MapId, eventId: string, index: number): void {
  const event = eventFromStore(mapId, eventId);
  if (!event?.schedule?.[index]) return;
  updateEvent(mapId, eventId, {
    schedule: event.schedule.filter((_entry, entryIndex) => entryIndex !== index),
  });
}

function eventFromStore(mapId: MapId, eventId: string): GameEvent | undefined {
  return store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
}

function numberInput(value: number, testId: string, min?: number, max?: number): HTMLInputElement {
  return el("input", {
    attrs: {
      type: "number",
      value: String(value),
      step: "1",
      ...(min !== undefined ? { min: String(min) } : {}),
      ...(max !== undefined ? { max: String(max) } : {}),
    },
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function checkboxInput(value: boolean, testid: string, label: string): HTMLInputElement {
  const input = el("input", {
    attrs: { type: "checkbox", "aria-label": label },
    dataset: { testid },
  }) as HTMLInputElement;
  input.checked = value;
  return input;
}

function optionalSelect<T extends string>(
  selected: T | undefined,
  options: readonly { readonly value: T; readonly label: string }[],
  testid: string,
): HTMLSelectElement {
  const select = el("select", {
    dataset: { testid },
    children: [
      el("option", { value: "", text: "항상" }),
      ...options.map((option) => el("option", { value: option.value, text: option.label })),
    ],
  }) as HTMLSelectElement;
  select.value = selected ?? "";
  return select;
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

function clampInput(input: HTMLInputElement, min: number, max: number): number {
  const value = Math.max(min, Math.min(max, integerValue(input)));
  input.value = String(value);
  return value;
}

function maxCoordinate(mapId: MapId, axis: "x" | "y"): number {
  const map = store.getCurrent().maps[mapId];
  if (!map) return 0;
  return Math.max(0, (axis === "x" ? map.width : map.height) - 1);
}

function clampCoordinate(mapId: MapId, axis: "x" | "y", value: number): number {
  return Math.max(0, Math.min(maxCoordinate(mapId, axis), Math.trunc(Number.isFinite(value) ? value : 0)));
}

function isUnconditionalWhen(when: NpcScheduleEntry["when"]): boolean {
  return !when.timePhase && !when.hourRange && !when.season && !when.dayRange;
}

function phaseLabel(value: TimePhase): string {
  return ({ morning: "아침", day: "낮", evening: "저녁", night: "밤" })[value];
}

function seasonLabel(value: Season): string {
  return ({ spring: "봄", summer: "여름", fall: "가을", winter: "겨울" })[value];
}

function facingLabel(value: Dir): string {
  return ({ down: "아래", left: "왼쪽", right: "오른쪽", up: "위" })[value];
}
