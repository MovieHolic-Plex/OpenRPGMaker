// 스위치/변수 공용 픽커 (2026-08 모달 통일).
// - UI 는 단일 트리거 버튼(현재 선택값 라벨)뿐이고, 클릭 시 openSwitchVariablePicker
//   클래식 모달(블록 내비게이션·이름/번호 검색·생성·이름변경 내장)을 연다.
// - visible 네이티브 <select> 와 인라인 검색 필터는 제거됐다.
// - 숨은 네이티브 select 는 Playwright selectOption 과 기존 폼 change 파이프라인
//   (select.value 설정 + change dispatch) 호환을 위해 DOM 에 남는다. 선례:
//   searchableRecordBrowser 의 record-browser-hidden-select, segmentedSelect 계약.
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { openSwitchVariablePicker } from "./recordPickerDialog";

export type SwitchVariableKind = "switch" | "variable";

export type SwitchVariablePickerOptions = {
  readonly kind: SwitchVariableKind;
  readonly selectedId: string;
  readonly onChange: (id: string) => void;
  /** 루트 컨테이너 testid (명령 폼 등). */
  readonly testId?: string;
  /** @deprecated 인라인 검색 필터 제거로 사용되지 않는다. 호출부 호환을 위해 시그니처만 유지. */
  readonly filterTestId?: string;
  /** 숨은 select testid. 지정 시 select 에 직접 붙인다 (e2e selectOption 호환). */
  readonly selectTestId?: string;
  /** 트리거 버튼 testid. 기본: event-${kind}-picker-open */
  readonly pickerTestId?: string;
  /** true 면 삭제/유령 id 도 옵션에 남긴다 (페이지 조건 호환). */
  readonly keepMissingId?: boolean;
  /** @deprecated 인라인 필터 제거로 무시된다. */
  readonly showFilter?: boolean;
  readonly className?: string;
};

export type SwitchVariablePickerHandle = {
  readonly root: HTMLElement;
  readonly select: HTMLSelectElement;
  readonly getSelectedId: () => string;
  readonly setSelectedId: (id: string) => void;
};

export function switchVariablePicker(options: SwitchVariablePickerOptions): SwitchVariablePickerHandle {
  const project = store.getCurrent();
  const kind = options.kind;
  const list = kind === "switch" ? project.switches : project.variables;

  const select = el("select", {
    class: "event-record-modal-select",
    attrs: { "aria-hidden": "true", tabindex: "-1" },
    dataset: options.selectTestId ? { testid: options.selectTestId } : undefined,
  }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const item of list) {
    select.append(
      el("option", {
        text: item.name.trim() || "(이름 없음)",
        attrs: { value: item.id },
      })
    );
  }
  if (options.keepMissingId && options.selectedId && !list.some((entry) => entry.id === options.selectedId)) {
    select.append(el("option", { text: options.selectedId, attrs: { value: options.selectedId } }));
  }
  select.value = options.selectedId;

  const labelOf = (id: string): string => {
    if (!id) return "(선택)";
    return (
      list.find((entry) => entry.id === id)?.name.trim() ||
      Array.from(select.querySelectorAll("option")).find((option) => option.value === id)?.textContent ||
      "(선택)"
    );
  };

  const trigger = el("button", {
    class: "btn small event-record-picker-trigger",
    text: labelOf(select.value),
    attrs: {
      type: "button",
      title: kind === "switch" ? "스위치 선택" : "변수 선택",
      "aria-haspopup": "dialog",
    },
    dataset: { testid: options.pickerTestId ?? `event-${kind}-picker-open` },
    on: {
      click: () =>
        openSwitchVariablePicker({
          kind,
          currentId: select.value,
          onSelect: (id) => {
            ensureOption(select, id);
            select.value = id;
            trigger.textContent = labelOf(id);
            options.onChange(id);
          },
        }),
    },
  }) as HTMLButtonElement;

  // select 값이 폼 로직 등 외부에서 바뀌면 트리거 라벨도 따라가야 하지만,
  // change 이벤트는 onChange 계약상 그대로 호출자에게 맡긴다. 여기선 set 시점 동기화만.
  select.addEventListener("change", () => {
    trigger.textContent = labelOf(select.value);
    options.onChange(select.value);
  });

  const root = el("span", {
    // showFilter 는 이제 무시되지만 기존 호출부의 CSS 훅(event-record-select ↔
    // event-condition-id-picker) 분기를 그대로 유지해 레이아웃 회귀를 막는다.
    class: options.className ?? ((options.showFilter !== false) ? "event-record-select" : "event-condition-id-picker"),
    dataset: options.testId ? { testid: options.testId } : undefined,
    children: [select, trigger],
  });

  return {
    root,
    select,
    getSelectedId: () => select.value,
    setSelectedId: (id) => {
      ensureOption(select, id);
      select.value = id;
      trigger.textContent = labelOf(id);
    },
  };
}

/** 레거시 이름 — 명령/조건 폼이 쓰던 databasePicker API. */
export function databasePicker(
  kind: SwitchVariableKind,
  currentId: string,
  onChange: (id: string) => void,
  testId?: string
): HTMLElement {
  return switchVariablePicker({
    kind,
    selectedId: currentId,
    onChange,
    testId,
  }).root;
}

export function switchPicker(options: Omit<SwitchVariablePickerOptions, "kind">): SwitchVariablePickerHandle {
  return switchVariablePicker({ ...options, kind: "switch" });
}

export function variablePicker(options: Omit<SwitchVariablePickerOptions, "kind">): SwitchVariablePickerHandle {
  return switchVariablePicker({ ...options, kind: "variable" });
}

function ensureOption(select: HTMLSelectElement, id: string): void {
  if (!id) return;
  const exists = Array.from(select.querySelectorAll("option")).some((option) => (option as HTMLOptionElement).value === id);
  if (!exists) select.append(el("option", { text: id, attrs: { value: id } }));
}
