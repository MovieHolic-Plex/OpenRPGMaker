// 이벤트 명령 편집 폼용 리치 공용 컨트롤 (EV-2).
// - recordPickerWithPreview: 기존 <select>(testid 불변)를 유지하면서 옆에
//   선택 레코드 카드(아이콘 24px + 이름 + 부제)를 라이브 렌더.
// - actorPicker: 주인공 전용 픽커(얼굴 아이콘 + 직업·레벨 부제).
// - searchableRecordBrowser: 검색 + 아이콘 카드 그리드 + 선택 스트립.
// - switchVariablePicker / databasePicker: 스위치·변수 검색 + 드롭다운 + ... 모달 피커.
// - segmentedSelect: 연산(= / + / −) 등을 세그먼트 버튼으로 편집하되,
//   기존 <select>는 시각적으로만 숨겨(측정 가능한 크기 유지) testid/change
//   이벤트 호환을 그대로 보존한다(Playwright selectOption 호환).
// - amountStepper: 수량 인풋을 − / + 버튼으로 감싼 스테퍼.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameSource,
} from "@/assets/easyrpgRtp";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { el } from "@/util/dom";
import type { ActorRecord, Project } from "@/project/types";

export {
  databasePicker,
  switchPicker,
  switchVariablePicker,
  variablePicker,
  type SwitchVariableKind,
  type SwitchVariablePickerHandle,
  type SwitchVariablePickerOptions,
} from "./switchVariablePicker";
export type RecordPickerIcon =
  | { readonly kind: "image"; readonly url: string }
  // 시트(페이스셋/캐릭셋 등)에서 한 칸만 잘라 보여주는 아이콘.
  // 한 장에 여러 얼굴·오브젝트가 있어도 index(또는 rect)로 단일 셀만 표시한다.
  | {
      readonly kind: "sheet";
      readonly url: string;
      readonly cellWidth: number;
      readonly cellHeight: number;
      readonly columns: number;
      readonly index: number;
      readonly sheetWidth: number;
      readonly sheetHeight: number;
    }
  | {
      readonly kind: "sheetRect";
      readonly url: string;
      readonly x: number;
      readonly y: number;
      readonly cellWidth: number;
      readonly cellHeight: number;
      readonly sheetWidth: number;
      readonly sheetHeight: number;
    };

export type RecordPickerRecordLike = { readonly id: string; readonly name: string };

export type RecordPickerOptions<T extends RecordPickerRecordLike> = {
  readonly records: readonly T[];
  readonly selectedId: string;
  readonly placeholder: string;
  readonly testid: string;
  readonly onChange?: (id: string) => void;
  // 아이콘 리졸버. null 이면 이니셜 플레이스홀더로 대체.
  readonly iconOf?: (record: T) => RecordPickerIcon | null;
  // 카드 부제(예: 장비 슬롯, 소속 적 이름). null/빈 문자열이면 생략.
  readonly subtitleOf?: (record: T) => string | null;
};

export type RecordPickerHandle = {
  readonly root: HTMLElement;
  readonly select: HTMLSelectElement;
  // 외부에서 값을 바꾼 뒤 카드를 다시 그릴 때 사용.
  readonly refreshCard: () => void;
};

const RICH_ICON_SIZE = 24;

export function recordPickerWithPreview<T extends RecordPickerRecordLike>(
  options: RecordPickerOptions<T>
): RecordPickerHandle {
  // 기존 recordSelect 와 동일한 옵션 포맷(0001: 이름)을 유지해 테스트를 보호한다.
  const select = el("select", { dataset: { testid: options.testid } }) as HTMLSelectElement;
  select.append(el("option", { text: `(${options.placeholder})`, attrs: { value: "" } }));
  for (const [index, record] of options.records.entries()) {
    select.append(
      el("option", { text: `${String(index + 1).padStart(4, "0")}: ${record.name}`, attrs: { value: record.id } })
    );
  }
  select.value = options.selectedId;

  const card = el("span", {
    class: "record-picker-card",
    dataset: { testid: `${options.testid}-card` },
  });

  const refreshCard = (): void => {
    const record = options.records.find((entry) => entry.id === select.value);
    card.replaceChildren();
    if (!record) {
      card.dataset.empty = "true";
      card.append(
        initialBadge("?"),
        el("span", { class: "record-picker-card-name empty", text: `(${options.placeholder})` })
      );
      return;
    }
    delete card.dataset.empty;
    const icon = options.iconOf?.(record) ?? null;
    card.append(renderRecordIcon(icon, record.name));
    const copy = el("span", { class: "record-picker-card-copy" });
    copy.append(el("span", { class: "record-picker-card-name", text: record.name }));
    const subtitle = options.subtitleOf?.(record);
    if (subtitle) copy.append(el("span", { class: "record-picker-card-subtitle", text: subtitle }));
    card.append(copy);
  };
  refreshCard();

  select.addEventListener("change", () => {
    refreshCard();
    options.onChange?.(select.value);
  });

  const root = el("span", { class: "record-picker" });
  root.append(select, card);
  return { root, select, refreshCard };
}

/** 액터 카드 부제: 직업 이름(+ 초기 레벨). */
export function actorSubtitle(project: Project, record: ActorRecord): string | null {
  const className = project.database.classes.find((entry) => entry.id === record.classId)?.name;
  const level = `Lv.${record.initialLevel}`;
  return className ? `${className} · ${level}` : level;
}

/** 주인공 선택 공통 픽커 — 얼굴 아이콘 + 직업·레벨 부제. */
export function actorPicker(options: {
  readonly project: Project;
  readonly selectedId: string;
  readonly testid: string;
  readonly placeholder?: string;
  readonly onChange?: (id: string) => void;
}): RecordPickerHandle {
  return recordPickerWithPreview({
    records: options.project.database.actors,
    selectedId: options.selectedId,
    placeholder: options.placeholder ?? "주인공 선택",
    testid: options.testid,
    onChange: options.onChange,
    iconOf: (record) => facesetIconOf(options.project, record.faceResourceId),
    subtitleOf: (record) => actorSubtitle(options.project, record),
  });
}

export type SearchableRecordBrowserOptions<T extends RecordPickerRecordLike> = {
  readonly records: readonly T[];
  readonly selectedId: string;
  readonly testidPrefix: string;
  /** 숨김 native select testid (기본: `${testidPrefix}-select`). */
  readonly selectTestId?: string;
  /** 선택 스트립 안 레거시 카드 testid. */
  readonly selectedCardAliasTestId?: string;
  readonly label?: string;
  readonly searchPlaceholder?: string;
  readonly emptySelectionLabel?: string;
  readonly emptySelectionMeta?: (records: readonly T[]) => string;
  readonly noneCardLabel?: string;
  readonly noneCardMeta?: string;
  readonly clearLabel?: string;
  /** false 면 그리드 안 '없음' 카드를 숨긴다(선택 스트립/해제 버튼만 사용). 기본 true. */
  readonly includeNoneCard?: boolean;
  readonly allowNone?: boolean;
  readonly iconOf?: (record: T) => RecordPickerIcon | null;
  readonly subtitleOf?: (record: T) => string | null;
  readonly searchTextOf?: (record: T) => string;
  readonly emptyCatalogText?: string;
  readonly emptyFilterText?: string;
  readonly onChange?: (id: string) => void;
};

export type SearchableRecordBrowserHandle<T extends RecordPickerRecordLike> = {
  readonly root: HTMLElement;
  readonly select: HTMLSelectElement;
  readonly getSelectedId: () => string;
  readonly setSelectedId: (id: string) => void;
  readonly setRecords: (records: readonly T[]) => void;
  readonly refresh: () => void;
};

/**
 * 검색 가능한 아이콘 레코드 브라우저.
 * 숨김 select 를 유지해 Playwright selectOption/testid 호환을 지킨다.
 */
export function searchableRecordBrowser<T extends RecordPickerRecordLike>(
  options: SearchableRecordBrowserOptions<T>
): SearchableRecordBrowserHandle<T> {
  let records = [...options.records];
  let selectedId = options.selectedId;
  let filterQuery = "";
  const allowNone = options.allowNone !== false;
  const includeNoneCard = options.includeNoneCard !== false && allowNone;
  const prefix = options.testidPrefix;
  const selectTestId = options.selectTestId ?? `${prefix}-select`;
  const emptySelectionLabel = options.emptySelectionLabel ?? "선택 없음";
  const noneCardLabel = options.noneCardLabel ?? emptySelectionLabel;
  const noneCardMeta = options.noneCardMeta ?? "비우기";
  const clearLabel = options.clearLabel ?? "해제";
  const emptyCatalogText = options.emptyCatalogText ?? "등록된 항목이 없습니다.";
  const emptyFilterText = options.emptyFilterText ?? "검색 결과가 없습니다. 다른 키워드를 입력하세요.";

  const select = el("select", {
    class: "record-browser-hidden-select",
    dataset: { testid: selectTestId },
    attrs: { "aria-hidden": "true", tabindex: "-1" },
  }) as HTMLSelectElement;

  const searchInput = el("input", {
    class: "commerce-command-input record-browser-search",
    attrs: {
      type: "search",
      placeholder: options.searchPlaceholder ?? "이름 검색",
      "aria-label": options.searchPlaceholder ?? "검색",
      autocomplete: "off",
    },
    dataset: { testid: `${prefix}-search` },
  }) as HTMLInputElement;

  const filterMeta = el("span", {
    class: "record-browser-filter-meta",
    dataset: { testid: `${prefix}-filter-meta` },
  });
  const selectedStrip = el("div", {
    class: "record-browser-selected",
    dataset: { testid: `${prefix}-selected` },
  });
  const selectedCardAlias = options.selectedCardAliasTestId
    ? (el("span", {
        class: "record-browser-selected-card-alias",
        dataset: { testid: options.selectedCardAliasTestId },
      }) as HTMLElement)
    : null;
  const grid = el("div", {
    class: "record-browser-grid",
    dataset: { testid: `${prefix}-grid` },
  });

  const rebuildSelect = (preferredId: string): void => {
    select.replaceChildren();
    if (allowNone) select.append(el("option", { text: `(${emptySelectionLabel})`, attrs: { value: "" } }));
    for (const [index, record] of records.entries()) {
      select.append(
        el("option", {
          text: `${String(index + 1).padStart(4, "0")}: ${record.name}`,
          attrs: { value: record.id },
        })
      );
    }
    const stillValid = preferredId && records.some((record) => record.id === preferredId);
    if (stillValid) {
      select.value = preferredId;
      selectedId = preferredId;
      return;
    }
    select.value = allowNone ? "" : (records[0]?.id ?? "");
    selectedId = select.value;
  };

  const filteredRecords = (): readonly T[] => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => {
      const haystack = (options.searchTextOf?.(record) ?? [record.name, record.id, options.subtitleOf?.(record) ?? ""].join(" ")).toLowerCase();
      return haystack.includes(query);
    });
  };

  const emitChange = (): void => {
    options.onChange?.(selectedId);
  };

  const selectRecord = (nextId: string): void => {
    const valid = nextId === "" ? allowNone : records.some((record) => record.id === nextId);
    selectedId = valid ? nextId : allowNone ? "" : (records[0]?.id ?? "");
    select.value = selectedId;
    refresh();
    emitChange();
  };

  const renderSelected = (): void => {
    const record = records.find((entry) => entry.id === selectedId);
    selectedStrip.replaceChildren();
    selectedCardAlias?.replaceChildren();
    if (!record) {
      selectedStrip.classList.add("is-empty");
      if (selectedCardAlias) selectedCardAlias.textContent = `(${emptySelectionLabel})`;
      selectedStrip.append(
        el("span", { class: "record-browser-card-icon empty", text: "×" }),
        el("div", {
          class: "record-browser-selected-copy",
          children: [
            el("strong", { text: emptySelectionLabel }),
            el("span", {
              text: options.emptySelectionMeta?.(records) ?? noneCardMeta,
            }),
            ...(selectedCardAlias ? [selectedCardAlias] : []),
          ],
        })
      );
      return;
    }
    selectedStrip.classList.remove("is-empty");
    if (selectedCardAlias) selectedCardAlias.textContent = record.name;
    const children: HTMLElement[] = [
      recordIconElement(options.iconOf?.(record) ?? null, record.name),
      el("div", {
        class: "record-browser-selected-copy",
        children: [
          el("strong", { text: record.name }),
          el("span", { text: options.subtitleOf?.(record) ?? "" }),
          ...(selectedCardAlias ? [selectedCardAlias] : []),
        ],
      }),
    ];
    if (allowNone) {
      children.push(
        el("button", {
          class: "btn small record-browser-clear-btn",
          text: clearLabel,
          attrs: { type: "button", title: clearLabel },
          // 그리드 none 카드가 없을 때(e.g. equipment includeNoneCard:false) 해제 진입점 유지
          dataset: { testid: includeNoneCard ? `${prefix}-clear` : `${prefix}-card-unequip` },
          on: { click: () => selectRecord("") },
        })
      );
    }
    selectedStrip.append(...children);
  };

  const renderGrid = (): void => {
    const filtered = filteredRecords();
    filterMeta.textContent =
      filterQuery.trim().length > 0
        ? `${records.length}개 중 ${filtered.length}개`
        : `${records.length}개`;

    grid.replaceChildren();
    if (includeNoneCard) {
      grid.append(
        el("button", {
          class: "record-browser-card" + (selectedId === "" ? " is-active" : ""),
          attrs: { type: "button" },
          dataset: { testid: `${prefix}-card-unequip` },
          on: { click: () => selectRecord("") },
          children: [
            el("span", { class: "record-browser-card-icon empty", text: "×" }),
            el("div", {
              class: "record-browser-card-copy",
              children: [
                el("strong", { text: noneCardLabel }),
                el("span", { class: "record-browser-card-meta", text: noneCardMeta }),
              ],
            }),
          ],
        })
      );
    }

    for (const record of filtered) {
      const active = selectedId === record.id;
      grid.append(
        el("button", {
          class: "record-browser-card" + (active ? " is-active" : ""),
          attrs: { type: "button", title: record.name },
          dataset: { testid: `${prefix}-card-${record.id}` },
          on: { click: () => selectRecord(record.id) },
          children: [
            el("span", {
              class: "record-browser-card-icon",
              children: [recordIconElement(options.iconOf?.(record) ?? null, record.name)],
            }),
            el("div", {
              class: "record-browser-card-copy",
              children: [
                el("strong", { text: record.name }),
                el("span", {
                  class: "record-browser-card-meta",
                  text: options.subtitleOf?.(record) ?? "",
                }),
              ],
            }),
          ],
        })
      );
    }

    if (filtered.length === 0) {
      grid.append(
        el("div", {
          class: "record-browser-grid-empty",
          text: records.length === 0 ? emptyCatalogText : emptyFilterText,
        })
      );
    }
  };

  const refresh = (): void => {
    renderSelected();
    renderGrid();
  };

  select.addEventListener("change", () => {
    selectedId = select.value;
    refresh();
    emitChange();
  });
  searchInput.addEventListener("input", () => {
    filterQuery = searchInput.value;
    renderGrid();
  });

  rebuildSelect(selectedId);
  refresh();

  const root = el("div", {
    class: "record-browser",
    dataset: { testid: `${prefix}-browser` },
    children: [
      el("div", {
        class: "record-browser-head",
        children: [
          el("span", { class: "record-browser-label", text: options.label ?? "목록" }),
          filterMeta,
        ],
      }),
      searchInput,
      selectedStrip,
      grid,
      select,
    ],
  });

  return {
    root,
    select,
    getSelectedId: () => selectedId,
    setSelectedId: (id) => {
      selectedId = id;
      rebuildSelect(id);
      refresh();
    },
    setRecords: (next) => {
      records = [...next];
      rebuildSelect(selectedId);
      refresh();
    },
    refresh,
  };
}

// 단순 이미지 아이콘 리졸버(아이템/장비 iconResourceId 등).
export function imageIconOf(project: Pick<Project, "assets">, resourceId: string | undefined): RecordPickerIcon | null {
  const url = resolveAssetResourceUrl(resourceId, { project });
  return url === null ? null : { kind: "image", url };
}

// 페이스셋 한 칸(faceIndex 0..15)을 24px 로 잘라 쓰는 아이콘. 시트 전체 표시 금지.
export function facesetIconOf(
  project: Pick<Project, "assets">,
  resourceId: string | undefined,
  faceIndex = 0,
): RecordPickerIcon | null {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (url === null) return null;
  const slicing = RESOURCE_SLICING.faceset;
  const maxIndex = slicing.columns * slicing.rows - 1;
  const index = clampSheetIndex(faceIndex, maxIndex);
  return {
    kind: "sheet",
    url,
    cellWidth: slicing.cellWidth,
    cellHeight: slicing.cellHeight,
    columns: slicing.columns,
    index,
    sheetWidth: slicing.sheetWidth,
    sheetHeight: slicing.sheetHeight,
  };
}

// 캐릭셋 시트에서 characterIndex(0..7) 한 명의 idle-front 프레임만 크롭.
// Object1/2 문·상자처럼 한 시트에 여러 오브젝트가 있어도 슬롯 하나만 보인다.
export function charsetIconOf(
  project: Pick<Project, "assets">,
  resourceId: string | undefined,
  characterIndex = 0,
): RecordPickerIcon | null {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (url === null) return null;
  const source = charsetFrameSource({
    characterIndex: clampSheetIndex(characterIndex, 7),
    direction: "down",
    pattern: 1,
  });
  return {
    kind: "sheetRect",
    url,
    x: source.x,
    y: source.y,
    cellWidth: source.width,
    cellHeight: source.height,
    sheetWidth: CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH,
    sheetHeight: CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT,
  };
}

export function recordIconElement(icon: RecordPickerIcon | null, name: string): HTMLElement {
  return renderRecordIcon(icon, name);
}

function renderRecordIcon(icon: RecordPickerIcon | null, name: string): HTMLElement {
  if (icon === null) return initialBadge(name);
  if (icon.kind === "image") {
    return el("img", {
      class: "rich-record-icon",
      attrs: { src: icon.url, alt: "", width: String(RICH_ICON_SIZE), height: String(RICH_ICON_SIZE) },
    });
  }
  // 시트 크롭: 한 셀만 보이도록 background-position. 전체 시트 축소 금지.
  const scale = RICH_ICON_SIZE / icon.cellWidth;
  const crop = el("span", {
    class: "rich-record-icon-crop",
    attrs: { role: "img", "aria-label": `${name} 아이콘` },
  });
  crop.style.setProperty("background-image", `url("${icon.url}")`);
  crop.style.setProperty("background-size", `${icon.sheetWidth * scale}px ${icon.sheetHeight * scale}px`);
  if (icon.kind === "sheet") {
    const col = icon.index % icon.columns;
    const row = Math.floor(icon.index / icon.columns);
    crop.style.setProperty(
      "background-position",
      `-${col * icon.cellWidth * scale}px -${row * icon.cellHeight * scale}px`,
    );
  } else {
    crop.style.setProperty(
      "background-position",
      `-${icon.x * scale}px -${icon.y * scale}px`,
    );
  }
  // 비정사각 셀(캐릭셋 24×32)도 24px 박스 안에서 잘리게 고정.
  crop.style.setProperty("width", `${RICH_ICON_SIZE}px`);
  crop.style.setProperty("height", `${RICH_ICON_SIZE}px`);
  crop.style.setProperty("overflow", "hidden");
  return crop;
}

// 아이콘이 없을 때 쓰는 이니셜 플레이스홀더(--bg-inset 원형).
export function initialBadge(name: string): HTMLElement {
  const initial = Array.from(name.trim())[0] ?? "?";
  return el("span", { class: "rich-record-initial", text: initial, attrs: { "aria-hidden": "true" } });
}

function clampSheetIndex(value: number | undefined, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

export type SegmentOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  // testid 안전 키(예: "=" → "set").
  readonly key: string;
};

export type SegmentedSelectHandle = {
  readonly root: HTMLElement;
  readonly select: HTMLSelectElement;
};

// 세그먼트 버튼 + 숨김 네이티브 select.
// select 는 opacity 0 이지만 크기를 유지해 Playwright selectOption/actionability 를 통과하고,
// selectOption → change 이벤트 시 세그먼트 하이라이트도 동기화된다.
export function segmentedSelect<T extends string>(options: {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly testid: string;
  readonly ariaLabel?: string;
}): SegmentedSelectHandle {
  const select = el("select", {
    class: "rich-native-select",
    dataset: { testid: options.testid },
    attrs: options.ariaLabel ? { "aria-label": options.ariaLabel } : {},
  }) as HTMLSelectElement;
  for (const option of options.options) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = options.value;

  const root = el("span", { class: "rich-segment-group", attrs: { role: "group" } });
  const buttons = new Map<string, HTMLButtonElement>();
  for (const option of options.options) {
    const button = el("button", {
      class: "rich-segment",
      text: option.label,
      attrs: { type: "button", "aria-pressed": "false" },
      dataset: { testid: `${options.testid}-segment-${option.key}` },
      on: {
        click: () => {
          if (select.value === option.value) return;
          select.value = option.value;
          // 기존 폼 로직(select change 리스너)을 그대로 태운다.
          select.dispatchEvent(new Event("change"));
        },
      },
    }) as HTMLButtonElement;
    buttons.set(option.value, button);
    root.append(button);
  }
  const syncSelected = (): void => {
    for (const [value, button] of buttons) {
      const selected = value === select.value;
      // (fakeDom 호환) classList.toggle 대신 add/remove 사용.
      if (selected) button.classList.add("selected");
      else button.classList.remove("selected");
      button.setAttribute("aria-pressed", String(selected));
    }
  };
  syncSelected();
  select.addEventListener("change", syncSelected);
  root.append(select);
  return { root, select };
}

// 수량 스테퍼: [−] [input] [+]. 인풋 자체(testid)는 호출자가 만든 것을 그대로 감싼다.
export function amountStepper(input: HTMLInputElement, options: { readonly testidBase: string; readonly min?: number }): HTMLElement {
  const min = options.min ?? 0;
  const step = (delta: number): void => {
    const current = Number.parseInt(input.value, 10);
    const next = Math.max(min, (Number.isFinite(current) ? current : 0) + delta);
    input.value = String(next);
    // 기존 change 파이프라인(replaceCommand)을 그대로 태운다.
    input.dispatchEvent(new Event("change"));
  };
  const minus = el("button", {
    class: "rich-stepper-button",
    text: "−",
    attrs: { type: "button", "aria-label": "감소" },
    dataset: { testid: `${options.testidBase}-minus` },
    on: { click: () => step(-1) },
  });
  const plus = el("button", {
    class: "rich-stepper-button",
    text: "+",
    attrs: { type: "button", "aria-label": "증가" },
    dataset: { testid: `${options.testidBase}-plus` },
    on: { click: () => step(1) },
  });
  const root = el("span", { class: "rich-stepper" });
  root.append(minus, input, plus);
  return root;
}

// 런타임(session.ts changeGold/changeItem)과 동일한 규칙으로 실행 후 값을 미리 계산.
export function previewAmountAfter(current: number, op: "=" | "+=" | "-=", amount: number): number {
  switch (op) {
    case "=":
      return Math.max(0, amount);
    case "+=":
      return Math.max(0, current + amount);
    case "-=":
      return Math.max(0, current - amount);
  }
}

// 전/후 프리뷰 스트립 골격. body 는 호출자가 라이브로 갈아끼운다.
export function previewStrip(testid: string, caption: string): { root: HTMLElement; body: HTMLElement } {
  const body = el("span", { class: "rich-preview-body" });
  const root = el("span", { class: "rich-preview-strip", dataset: { testid } });
  root.append(body, el("span", { class: "rich-preview-caption", text: caption }));
  return { root, body };
}

// 연산(= / + / −) 세그먼트 공용 옵션.
export const AMOUNT_OP_SEGMENTS = [
  { value: "=", label: "＝ 대입", key: "set" },
  { value: "+=", label: "＋ 증가", key: "inc" },
  { value: "-=", label: "− 감소", key: "dec" },
] as const satisfies readonly SegmentOption<"=" | "+=" | "-=">[];
