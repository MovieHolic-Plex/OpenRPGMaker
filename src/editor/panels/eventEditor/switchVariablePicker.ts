// 스위치/변수 공용 픽커.
// - 인라인 검색으로 select 옵션 필터
// - ... 버튼으로 classic 모달 피커
// - 네이티브 select 유지 (testid / Playwright selectOption 호환)
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
  /** 인라인 검색 입력 testid. 기본: event-${kind}-inline-filter */
  readonly filterTestId?: string;
  /** 네이티브 select testid. 지정 시 select 에 직접 붙인다. */
  readonly selectTestId?: string;
  /** ... 모달 버튼 testid. 기본: event-${kind}-picker-open */
  readonly pickerTestId?: string;
  /** true 면 삭제/유령 id 도 옵션에 남긴다 (페이지 조건 호환). */
  readonly keepMissingId?: boolean;
  /** false 면 인라인 검색 필드를 숨긴다 (페이지 조건 슬롯 밀도용). 기본 true. */
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
  const showFilter = options.showFilter !== false;

  const select = el("select", {
    dataset: options.selectTestId ? { testid: options.selectTestId } : undefined,
  }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const [index, item] of list.entries()) {
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
  select.addEventListener("change", () => options.onChange(select.value));

  const filter = el("input", {
    class: "event-record-inline-filter",
    attrs: {
      type: "search",
      placeholder: "검색",
      "aria-label": kind === "switch" ? "스위치 검색" : "변수 검색",
    },
    dataset: { testid: options.filterTestId ?? `event-${kind}-inline-filter` },
  }) as HTMLInputElement;
  filter.hidden = !showFilter;
  filter.addEventListener("input", () => {
    const needle = filter.value.trim().toLowerCase();
    for (const option of Array.from(select.querySelectorAll("option"))) {
      if (option.value === "") {
        option.hidden = false;
        continue;
      }
      const hay = option.textContent?.toLowerCase() ?? "";
      option.hidden = needle.length > 0 && !hay.includes(needle) && !option.value.toLowerCase().includes(needle);
    }
  });

  const pickerButton = el("button", {
    class: "btn small",
    text: "찾기",
    attrs: { type: "button", title: kind === "switch" ? "스위치 찾기" : "변수 찾기" },
    dataset: { testid: options.pickerTestId ?? `event-${kind}-picker-open` },
    on: {
      click: () =>
        openSwitchVariablePicker({
          kind,
          currentId: select.value,
          onSelect: (id) => {
            ensureOption(select, id);
            select.value = id;
            options.onChange(id);
          },
        }),
    },
  });

  const root = el("span", {
    class: options.className ?? (showFilter ? "event-record-select" : "event-condition-id-picker"),
    dataset: options.testId ? { testid: options.testId } : undefined,
    children: showFilter ? [filter, select, pickerButton] : [select, pickerButton],
  });

  return {
    root,
    select,
    getSelectedId: () => select.value,
    setSelectedId: (id) => {
      ensureOption(select, id);
      select.value = id;
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
