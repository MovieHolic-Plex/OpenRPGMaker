import { matchesNameOrId, numberField, selectField, textControl } from "@/editor/panels/databaseControls";
import {
  detailHero,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  detailPane as makeDetailPane,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { scheduleReferenceMessage } from "@/editor/databaseReferences";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  SCHEDULE_ACTIVITY_LIMIT,
  SCHEDULE_MAX_USES_LIMIT,
  SCHEDULE_RECORD_LIMIT,
  SCHEDULE_SLOT_LIMIT,
} from "@/project/schedule";
import { store } from "@/project/store";
import type { Condition, Project, ScheduleActivityRecord, ScheduleRecord } from "@/project/types";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let selectedScheduleId: string | null = null;
let scheduleSearch = "";

/** 다른 화면이 일정표 하나를 골라 둔 채로 이 탭을 연다. */
export function selectScheduleForView(id: string): void {
  selectedScheduleId = id;
  scheduleSearch = "";
}

function schedulesOf(project: Project): ScheduleRecord[] {
  return project.database.schedules ?? [];
}

/** 레코드가 하나도 없으면 속성 자체를 지운다 — 일정표를 안 쓰는 프로젝트의 JSON 은 그대로여야 한다. */
function pruneEmptySchedules(project: Project): void {
  if (project.database.schedules && project.database.schedules.length === 0) delete project.database.schedules;
}

function mutateSchedule(id: string, apply: (target: ScheduleRecord) => void): void {
  store.update((project) => {
    const target = project.database.schedules?.find((row) => row.id === id);
    if (target) apply(target);
  });
}

export function renderSchedulesTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const schedules = schedulesOf(project);
  if (!schedules.some((record) => record.id === selectedScheduleId)) {
    selectedScheduleId = schedules[0]?.id ?? null;
  }
  const selected = schedules.find((record) => record.id === selectedScheduleId);
  const query = scheduleSearch.trim();

  const rows: HTMLElement[] = [];
  for (const [index, schedule] of schedules.entries()) {
    if (query && !matchesNameOrId(schedule.title, schedule.id, query)) continue;
    rows.push(
      listRow({
        name: schedule.title || "(제목 없음)",
        sub: `슬롯 ${schedule.slots.length} · 활동 ${schedule.activities.length}`,
        number: index + 1,
        active: schedule.id === selected?.id,
        testid: `db-schedule-row-${schedule.id}`,
        onSelect: () => {
          selectedScheduleId = schedule.id;
          rerender();
        },
      }),
    );
  }

  const list = listPane({
    title: "일정표",
    count: schedules.length,
    search: listSearch({
      placeholder: "일정표 검색",
      value: scheduleSearch,
      testid: "db-schedule-search",
      onInput: (value) => {
        scheduleSearch = value;
        rerender();
      },
    }),
    rows,
    empty:
      query.length > 0
        ? emptyState({ icon: "⌕", title: "검색 결과가 없습니다", body: `"${query}" 와 일치하는 일정표가 없습니다.`, compact: true })
        : emptyState({ icon: "▦", title: "첫 일정표를 만들면 여기에 나타납니다", compact: true }),
    toolbar: listToolbar([
      {
        label: "+ 일정표 추가",
        kind: "primary",
        testid: "db-schedule-add",
        title: "슬롯마다 활동을 고르는 주간 일정표를 만듭니다",
        onClick: () => addSchedule(rerender),
      },
      {
        label: "복제",
        testid: "db-schedule-duplicate",
        title: "선택한 일정표를 복사합니다",
        onClick: () => duplicateSchedule(rerender),
      },
    ]),
    testid: "db-schedule-list-pane",
  });

  const detail = selected
    ? makeDetailPane({
        hero: detailHero({
          title: selected.title || "(제목 없음)",
          eyebrow: `일정표 · ${selected.id}`,
          subtitle: "「일정 계획」 명령이 이 표를 화면에 띄우고, 「일정 실행」 명령이 고른 활동의 공통 이벤트를 슬롯 순서대로 부릅니다.",
          tags: [`슬롯 ${selected.slots.length}`, `활동 ${selected.activities.length}`],
          testid: "db-schedule-hero",
        }),
        body: scheduleEditor(selected, rerender),
        legacyClass: "db-schedule-detail-pane",
        testid: "db-detail-form",
      })
    : makeDetailPane({
        body: [
          emptyState({
            icon: "▦",
            title: "일정표가 없습니다",
            body: "슬롯(예: 월~일)과 활동 카드를 정의하면 플레이어가 한 주를 직접 짤 수 있습니다.",
            action: { label: "+ 일정표 추가", kind: "primary", testid: "db-schedule-empty-add", onClick: () => addSchedule(rerender) },
            testid: "db-schedule-empty",
          }),
        ],
        legacyClass: "db-schedule-detail-pane",
        testid: "db-detail-form",
      });

  host.append(workspaceShell({ list, detail, testid: "db-schedules-workspace" }));
}

function addSchedule(rerender: () => void): void {
  if (schedulesOf(store.getCurrent()).length >= SCHEDULE_RECORD_LIMIT) {
    toast(`일정표는 ${SCHEDULE_RECORD_LIMIT}개까지 만들 수 있습니다.`, "error");
    return;
  }
  const next: ScheduleRecord = {
    id: genId("sched"),
    title: "새 일정표",
    slots: [{ label: "1" }, { label: "2" }],
    activities: [],
  };
  recordProjectSnapshot();
  store.update((project) => {
    (project.database.schedules ??= []).push(next);
  });
  selectedScheduleId = next.id;
  scheduleSearch = "";
  rerender();
}

function duplicateSchedule(rerender: () => void): void {
  const id = selectedScheduleId;
  if (!id) return;
  if (schedulesOf(store.getCurrent()).length >= SCHEDULE_RECORD_LIMIT) {
    toast(`일정표는 ${SCHEDULE_RECORD_LIMIT}개까지 만들 수 있습니다.`, "error");
    return;
  }
  const copyId = genId("sched");
  recordProjectSnapshot();
  store.update((project) => {
    const source = project.database.schedules?.find((row) => row.id === id);
    if (!source) return;
    const copy = structuredClone(source);
    copy.id = copyId;
    copy.title = `${source.title} 복사`;
    project.database.schedules?.push(copy);
  });
  selectedScheduleId = copyId;
  scheduleSearch = "";
  rerender();
}

function scheduleEditor(schedule: ScheduleRecord, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-schedule-editor",
    dataset: { testid: "db-schedule-editor" },
    children: [
      sectionCard({
        title: "기본",
        children: [
          textControl(
            "제목",
            schedule.title,
            (value) => {
              recordCoalescedSnapshot(`db-schedule:title:${schedule.id}`);
              mutateSchedule(schedule.id, (target) => {
                target.title = value;
              });
            },
            "db-schedule-title",
          ),
          deleteRow(schedule, rerender),
        ],
        testid: "db-schedule-basics",
      }),
      slotsCard(schedule, rerender),
      activitiesCard(schedule, rerender),
    ],
  });
}

function deleteRow(schedule: ScheduleRecord, rerender: () => void): HTMLElement {
  let armedUntil = 0;
  let resetTimer: number | null = null;
  const button = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button" },
    dataset: { testid: `db-schedule-delete-${schedule.id}` },
    on: {
      click: () => {
        const blocked = scheduleReferenceMessage(schedule.id);
        if (blocked) {
          toast(blocked, "error");
          return;
        }
        const now = Date.now();
        if (now > armedUntil) {
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            armedUntil = 0;
            button.textContent = DELETE_IDLE_LABEL;
            button.classList.remove("confirming");
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }
        const remaining = schedulesOf(store.getCurrent()).filter((row) => row.id !== schedule.id);
        selectedScheduleId = remaining[0]?.id ?? null;
        recordProjectSnapshot();
        store.update((project) => {
          if (!project.database.schedules) return;
          project.database.schedules = project.database.schedules.filter((row) => row.id !== schedule.id);
          pruneEmptySchedules(project);
        });
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        rerender();
      },
    },
  });
  return el("div", { class: "db-row", children: [el("span", { class: "db-id", text: schedule.id }), button] });
}

function slotsCard(schedule: ScheduleRecord, rerender: () => void): HTMLElement {
  const rows = schedule.slots.map((slot, index) =>
    el("div", {
      class: "db-row",
      dataset: { testid: `db-schedule-slot-${index}` },
      children: [
        el("span", { class: "db-id", text: `#${index + 1}` }),
        textControl(
          "라벨",
          slot.label,
          (value) => {
            recordCoalescedSnapshot(`db-schedule:slot:${schedule.id}:${index}`);
            mutateSchedule(schedule.id, (target) => {
              const row = target.slots[index];
              if (row) row.label = value;
            });
          },
          `db-schedule-slot-label-${index}`,
        ),
        el("button", {
          class: "db-ws-btn db-ws-btn-danger",
          text: "삭제",
          attrs: { type: "button", "aria-label": `슬롯 ${index + 1} 삭제` },
          dataset: { testid: `db-schedule-slot-remove-${index}` },
          on: {
            click: () => {
              recordProjectSnapshot();
              mutateSchedule(schedule.id, (target) => {
                target.slots.splice(index, 1);
              });
              rerender();
            },
          },
        }),
      ],
    }),
  );
  const add = el("button", {
    class: "db-ws-btn",
    text: "+ 슬롯 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-schedule-slot-add" },
    on: {
      click: () => {
        if (schedule.slots.length >= SCHEDULE_SLOT_LIMIT) {
          toast(`슬롯은 ${SCHEDULE_SLOT_LIMIT}개까지 둘 수 있습니다.`, "error");
          return;
        }
        recordProjectSnapshot();
        mutateSchedule(schedule.id, (target) => {
          target.slots.push({ label: String(target.slots.length + 1) });
        });
        rerender();
      },
    },
  });
  return sectionCard({
    title: "슬롯",
    hint: `플레이어가 활동을 채울 칸입니다(최대 ${SCHEDULE_SLOT_LIMIT}). 라벨은 칩에 그대로 보입니다.`,
    children: [...rows, add],
    testid: "db-schedule-slots",
  });
}

function activitiesCard(schedule: ScheduleRecord, rerender: () => void): HTMLElement {
  const cards = schedule.activities.map((activity, index) => activityCard(schedule, activity, index, rerender));
  const add = el("button", {
    class: "db-ws-btn",
    text: "+ 활동 추가",
    attrs: { type: "button" },
    dataset: { testid: "db-schedule-activity-add" },
    on: {
      click: () => {
        if (schedule.activities.length >= SCHEDULE_ACTIVITY_LIMIT) {
          toast(`활동은 ${SCHEDULE_ACTIVITY_LIMIT}개까지 둘 수 있습니다.`, "error");
          return;
        }
        recordProjectSnapshot();
        mutateSchedule(schedule.id, (target) => {
          target.activities.push({
            id: uniqueActivityId(target),
            label: "새 활동",
            description: "",
            commonEventId: "",
          });
        });
        rerender();
      },
    },
  });
  return sectionCard({
    title: "활동",
    hint: "각 카드는 고르면 해당 슬롯에서 공통 이벤트를 실행합니다. 조건이 거짓이면 카드가 숨고, 사용 횟수 한도에 닿으면 흐려집니다.",
    children: [...cards, add],
    testid: "db-schedule-activities",
  });
}

function uniqueActivityId(schedule: ScheduleRecord): string {
  const taken = new Set(schedule.activities.map((row) => row.id));
  let n = schedule.activities.length + 1;
  while (taken.has(`act${n}`)) n += 1;
  return `act${n}`;
}

function mutateActivity(scheduleId: string, index: number, apply: (target: ScheduleActivityRecord) => void): void {
  mutateSchedule(scheduleId, (schedule) => {
    const target = schedule.activities[index];
    if (target) apply(target);
  });
}

function activityCard(
  schedule: ScheduleRecord,
  activity: ScheduleActivityRecord,
  index: number,
  rerender: () => void,
): HTMLElement {
  const project = store.getCurrent();
  const key = (suffix: string) => `db-schedule:act:${schedule.id}:${index}:${suffix}`;
  const tid = (suffix: string) => `db-schedule-activity-${index}-${suffix}`;

  const text = (label: string, value: string, suffix: string, apply: (target: ScheduleActivityRecord, value: string) => void) =>
    textControl(
      label,
      value,
      (next) => {
        recordCoalescedSnapshot(key(suffix));
        mutateActivity(schedule.id, index, (target) => apply(target, next));
      },
      tid(suffix),
    );

  const commonEvents = project.commonEvents.map((row) => ({ id: row.id, name: row.name || row.id }));
  const items = project.database.items.map((row) => ({ id: row.id, name: row.name || row.id }));

  const removeButton = el("button", {
    class: "db-ws-btn db-ws-btn-danger",
    text: "활동 삭제",
    attrs: { type: "button", "aria-label": `활동 ${activity.label || activity.id} 삭제` },
    dataset: { testid: tid("remove") },
    on: {
      click: () => {
        recordProjectSnapshot();
        mutateSchedule(schedule.id, (target) => {
          target.activities.splice(index, 1);
        });
        rerender();
      },
    },
  });

  return el("div", {
    class: "db-schedule-activity",
    dataset: { testid: `db-schedule-activity-${index}` },
    children: [
      el("div", { class: "db-row", children: [el("span", { class: "db-id", text: `#${index + 1}` }), removeButton] }),
      text("ID", activity.id, "id", (target, value) => {
        target.id = value.trim();
      }),
      text("이름", activity.label, "label", (target, value) => {
        target.label = value;
      }),
      text("설명", activity.description, "description", (target, value) => {
        target.description = value;
      }),
      text("힌트", activity.hint ?? "", "hint", (target, value) => {
        if (value) target.hint = value;
        else delete target.hint;
      }),
      selectField("공통 이벤트", tid("common-event"), activity.commonEventId, commonEvents, (value) => {
        recordProjectSnapshot();
        mutateActivity(schedule.id, index, (target) => {
          target.commonEventId = value;
        });
      }),
      selectField("아이콘(아이템)", tid("icon-item"), activity.icon?.kind === "item" ? activity.icon.itemId : "", items, (value) => {
        recordProjectSnapshot();
        mutateActivity(schedule.id, index, (target) => {
          if (value) target.icon = { kind: "item", itemId: value };
          else delete target.icon;
        });
      }),
      numberField(
        "사용 횟수 한도(0 = 무제한)",
        tid("max-uses"),
        activity.maxUses ?? 0,
        (value) => {
          recordCoalescedSnapshot(key("max-uses"));
          mutateActivity(schedule.id, index, (target) => {
            const next = Math.max(0, Math.min(SCHEDULE_MAX_USES_LIMIT, Math.floor(value)));
            if (next > 0) target.maxUses = next;
            else delete target.maxUses;
          });
        },
        { min: 0, max: SCHEDULE_MAX_USES_LIMIT, step: 1 },
      ),
      conditionControl(project, schedule, activity, index, rerender),
    ],
  });
}

type SimpleConditionKind = "" | "switch" | "variable";

function conditionKindOf(condition: Condition | undefined): SimpleConditionKind {
  if (condition?.kind === "switch") return "switch";
  if (condition?.kind === "variable") return "variable";
  return "";
}

/**
 * 활동 조건은 스위치/변수 두 가지만 이 화면에서 편집한다. 다른 종류(아이템·골드 등)는
 * 조수 도구나 JSON 으로 넣을 수 있고, 여기서는 읽기 전용 안내로 보존한다.
 */
function conditionControl(
  project: Project,
  schedule: ScheduleRecord,
  activity: ScheduleActivityRecord,
  index: number,
  rerender: () => void,
): HTMLElement {
  const tid = (suffix: string) => `db-schedule-activity-${index}-cond-${suffix}`;
  const condition = activity.condition;
  const kind = conditionKindOf(condition);
  const set = (next: Condition | undefined, structural: boolean) => {
    recordProjectSnapshot();
    mutateActivity(schedule.id, index, (target) => {
      if (next) target.condition = next;
      else delete target.condition;
    });
    if (structural) rerender();
  };

  const children: HTMLElement[] = [];
  const foreign = condition && kind === "" ? condition.kind : "";
  const kindOptions = [
    { id: "switch", name: "스위치" },
    { id: "variable", name: "변수" },
  ];
  children.push(
    selectField(foreign ? `조건(${foreign} — 이 화면에서 바꾸면 대체됩니다)` : "조건", tid("kind"), kind, kindOptions, (value) => {
      if (value === "switch") {
        set({ kind: "switch", switchId: project.switches[0]?.id ?? "", value: true }, true);
      } else if (value === "variable") {
        set({ kind: "variable", variableId: project.variables[0]?.id ?? "", op: ">=", value: 1 }, true);
      } else {
        set(undefined, true);
      }
    }),
  );

  if (condition?.kind === "switch") {
    const current = condition;
    children.push(
      selectField("스위치", tid("switch"), current.switchId, project.switches, (value) => {
        set({ ...current, switchId: value }, false);
      }),
      selectField("값", tid("switch-value"), current.value ? "on" : "off", [{ id: "on", name: "켜짐" }, { id: "off", name: "꺼짐" }], (value) => {
        set({ ...current, value: value === "on" }, false);
      }),
    );
  } else if (condition?.kind === "variable") {
    const current = condition;
    const ops = (["==", ">=", "<=", ">", "<", "!="] as const).map((op) => ({ id: op, name: op }));
    children.push(
      selectField("변수", tid("variable"), current.variableId, project.variables, (value) => {
        set({ ...current, variableId: value }, false);
      }),
      selectField("비교", tid("op"), current.op, ops, (value) => {
        const op = ops.find((row) => row.id === value)?.id;
        if (op) set({ ...current, op }, false);
      }),
      numberField("값", tid("value"), current.value, (value) => {
        recordCoalescedSnapshot(`db-schedule:cond:${schedule.id}:${index}`);
        mutateActivity(schedule.id, index, (target) => {
          if (target.condition?.kind === "variable") target.condition = { ...target.condition, value: Math.floor(value) };
        });
      }),
    );
  }

  return el("div", { class: "db-schedule-condition", children });
}
