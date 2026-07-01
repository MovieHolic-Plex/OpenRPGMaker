import { renderAnimationPatternStripPanel, renderAnimationStagePanel } from "@/editor/panels/databaseAnimationPreview";
import { emptyToUndefined, field, numberField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type {
  BattleAnimationCell,
  BattleAnimationFrame,
  BattleAnimationPosition,
  BattleAnimationRecord,
  BattleAnimationScope,
  BattleAnimationSheet,
  BattleAnimationTiming,
} from "@/project/types";
import { el } from "@/util/dom";

const DEFAULT_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
const DEFAULT_CELL: BattleAnimationCell = { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true };
const DEFAULT_FRAME: BattleAnimationFrame = { cells: [{ ...DEFAULT_CELL }] };
const SCOPE_OPTIONS = ["singleTarget", "allTargets", "screen"] as const satisfies readonly BattleAnimationScope[];
const POSITION_OPTIONS = ["head", "center", "feet", "screen"] as const satisfies readonly BattleAnimationPosition[];

type AnimationEditorContext = {
  readonly animation: BattleAnimationRecord;
  readonly sheet: BattleAnimationSheet;
  readonly frames: readonly BattleAnimationFrame[];
  readonly selectedFrameIndex: number;
  readonly selectedFrame: BattleAnimationFrame;
  readonly timings: readonly BattleAnimationTiming[];
  readonly project: ReturnType<typeof store.getCurrent>;
  readonly rerender: () => void;
};

export function renderBattleAnimationRecordForm(form: HTMLElement, animation: BattleAnimationRecord): HTMLElement {
  const project = store.getCurrent();
  const sheet = animation.sheet ?? DEFAULT_SHEET;
  const frames = normalizedFrames(animation.frames);
  const timings = animation.timings ?? [];
  // editorState에서 선택 프레임/셀 인덱스를 읽어 범위 보정.
  const selectedFrameIndex = clampFrameIndex(editorState.get().selectedAnimationFrameIndex, frames.length);
  const selectedFrame = frames[selectedFrameIndex] ?? DEFAULT_FRAME;
  const rerender = () => {
    form.innerHTML = "";
    const next = store.getCurrent().database.battleAnimations.find((entry) => entry.id === animation.id) ?? animation;
    renderBattleAnimationRecordForm(form, next);
  };
  const context: AnimationEditorContext = { animation, sheet, frames, selectedFrameIndex, selectedFrame, timings, project, rerender };

  form.classList.add("animation-detail-form");
  form.append(animationEditor(context), referencePanel(animation), battlerSeparationNote(project.database.battlerAnimations?.length ?? 0));

  return form;
}

function animationEditor(context: AnimationEditorContext): HTMLElement {
  const editor = el("div", {
    class: "db-animation-rm2003-editor",
    dataset: { testid: "db-animation-rm2003-editor" },
  });
  editor.append(
    topFieldGrid(context),
    frameListPanel(context),
    renderAnimationStagePanel(context),
    timingTablePanel(context),
    cellTablePanel(context),
    renderAnimationPatternStripPanel(context)
  );
  return editor;
}

function topFieldGrid(context: AnimationEditorContext): HTMLElement {
  const grid = el("div", { class: "db-animation-top-grid" });
  grid.append(
    textField("애니메이션 그래픽", "db-field-animation-resource", context.animation.resourceId ?? "", (value) =>
      updateDatabaseRecord("battleAnimations", context.animation.id, { resourceId: emptyToUndefined(value) })
    ),
    readonlyField("대상", "말벌"),
    maxFrameField(context),
    animationFlagsPanel(context.animation, context.sheet)
  );
  return grid;
}

function animationFlagsPanel(animation: BattleAnimationRecord, sheet: BattleAnimationSheet): HTMLElement {
  const large = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "db-field-animation-large" },
  });
  large.checked = animation.large ?? false;
  large.addEventListener("change", () => updateDatabaseRecord("battleAnimations", animation.id, { large: large.checked }));

  const panel = panelWrap("설정", "db-animation-setup", "db-animation-setup-panel");
  panel.append(
    selectLiteral("범위", "db-field-animation-scope", animation.scope ?? "singleTarget", SCOPE_OPTIONS, (scope) =>
      updateDatabaseRecord("battleAnimations", animation.id, { scope })
    ),
    selectLiteral("위치", "db-field-animation-position", animation.position ?? "center", POSITION_OPTIONS, (position) =>
      updateDatabaseRecord("battleAnimations", animation.id, { position })
    ),
    field("대형", large),
    sheetFields(animation, sheet)
  );
  return panel;
}

function readonlyField(label: string, value: string): HTMLElement {
  return field(label, el("input", { attrs: { readonly: "true", type: "text" }, value }));
}

// 최대 프레임 수 표시 + 프레임 추가 컨트롤. 이제 "..." 버튼이 동작한다.
function maxFrameField(context: AnimationEditorContext): HTMLElement {
  const input = el("input", {
    attrs: { readonly: "true", type: "text" },
    value: String(context.frames.length),
    dataset: { testid: "db-field-animation-max-frames" },
  });
  const addFrame = el("button", {
    class: "db-animation-picker-button",
    text: "+ 프레임",
    attrs: { type: "button", title: "프레임 추가" },
    dataset: { testid: "db-animation-add-frame" },
    on: { click: () => addAnimationFrame(context.animation.id, context.frames, context.rerender) },
  });
  return field("최대 수", el("span", { class: "db-animation-inline-control", children: [input, addFrame] }));
}

function sheetFields(animation: BattleAnimationRecord, sheet: BattleAnimationSheet): HTMLElement {
  const grid = el("div", { class: "db-animation-sheet-fields" });
  grid.append(
    numberField("프레임 폭", "db-field-animation-frame-width", sheet.frameWidth, (frameWidth) =>
      updateAnimationSheet(animation.id, { frameWidth })
    ),
    numberField("프레임 높이", "db-field-animation-frame-height", sheet.frameHeight, (frameHeight) =>
      updateAnimationSheet(animation.id, { frameHeight })
    ),
    numberField("열", "db-field-animation-columns", sheet.columns, (columns) =>
      updateAnimationSheet(animation.id, { columns })
    )
  );
  return grid;
}

function updateAnimationSheet(id: string, patch: Partial<BattleAnimationSheet>): void {
  const current = store.getCurrent().database.battleAnimations.find((animation) => animation.id === id);
  const sheet = current?.sheet ?? DEFAULT_SHEET;
  updateDatabaseRecord("battleAnimations", id, { sheet: { ...sheet, ...patch } });
}

// 프레임 목록 — 선택/추가/삭제/복제/이동이 모두 동작.
function frameListPanel(context: AnimationEditorContext): HTMLElement {
  const panel = panelWrap("프레임 #", "db-animation-frame-list-panel", "db-animation-frame-list-panel");
  const prev = el("button", {
    text: "↑ 이전",
    attrs: { type: "button", ...disabledAttr(context.selectedFrameIndex <= 0) },
    dataset: { testid: "db-animation-frame-prev" },
    on: { click: () => selectFrame(context.selectedFrameIndex - 1) },
  });
  const next = el("button", {
    text: "↓ 다음",
    attrs: { type: "button", ...disabledAttr(context.selectedFrameIndex >= context.frames.length - 1) },
    dataset: { testid: "db-animation-frame-next" },
    on: { click: () => selectFrame(context.selectedFrameIndex + 1) },
  });
  const list = el("div", { class: "db-animation-frame-list", dataset: { testid: "db-animation-frame-list" } });
  context.frames.forEach((frame, index) => {
    const row = el("button", {
      class: `db-animation-frame-row${index === context.selectedFrameIndex ? " active" : ""}`,
      text: `< ${index + 1}>`,
      attrs: { type: "button", title: `${frame.cells.length}개 셀` },
      dataset: { testid: `db-animation-frame-${index}` },
      on: { click: () => selectFrame(index) },
    });
    list.append(row);
  });
  panel.append(prev, next, list);
  // 추가/복제/삭제 컨트롤을 프레임 목록 아래에 배치.
  panel.append(
    el("div", {
      class: "db-animation-frame-actions",
      children: [
        el("button", {
          text: "추가",
          attrs: { type: "button", title: "마지막에 프레임 추가" },
          dataset: { testid: "db-animation-frame-add" },
          on: { click: () => addAnimationFrame(context.animation.id, context.frames, context.rerender) },
        }),
        el("button", {
          text: "복제",
          attrs: { type: "button", title: "선택 프레임 복제" },
          dataset: { testid: "db-animation-frame-duplicate" },
          on: { click: () => duplicateAnimationFrame(context.animation.id, context.frames, context.selectedFrameIndex, context.rerender) },
        }),
        el("button", {
          text: "삭제",
          attrs: { type: "button", title: "선택 프레임 삭제", ...disabledAttr(context.frames.length <= 1) },
          dataset: { testid: "db-animation-frame-delete" },
          on: { click: () => deleteAnimationFrame(context.animation.id, context.frames, context.selectedFrameIndex, context.rerender) },
        }),
      ],
    })
  );
  return panel;
}

// 셀 테이블 — 선택 프레임의 셀을 인라인 편집(pattern/x/y/zoom/opacity/visible) + 추가/삭제.
function cellTablePanel(context: AnimationEditorContext): HTMLElement {
  const panel = panelWrap("선택 프레임 셀", "db-animation-cell-table");
  const cells = context.selectedFrame.cells;
  const table = dataTable(["셀", "패턴", "X", "Y", "확대", "불투명도", "표시", "색조", "삭제"]);
  const body = table.querySelector("tbody");
  cells.forEach((cell, index) => {
    body?.append(cellEditableRow(context, cell, index));
  });
  panel.append(table);
  panel.append(
    el("div", {
      class: "db-animation-cell-actions",
      children: [
        el("button", {
          class: "btn btn-mini",
          text: "셀 추가",
          attrs: { type: "button" },
          dataset: { testid: "db-animation-cell-add" },
          on: {
            click: () => {
              const nextCells = [...cells, { ...DEFAULT_CELL }];
              updateFrameCells(context.animation.id, context.selectedFrameIndex, nextCells);
              context.rerender();
            },
          },
        }),
      ],
    })
  );
  return panel;
}

// 셀 한 줄 — 입력값 변경 시 즉시 store에 반영.
function cellEditableRow(context: AnimationEditorContext, cell: BattleAnimationCell, index: number): HTMLElement {
  const row = el("tr");
  const updateCell = (patch: Partial<BattleAnimationCell>) => {
    const nextCells = context.selectedFrame.cells.map((c, i) => (i === index ? { ...c, ...patch } : c));
    updateFrameCells(context.animation.id, context.selectedFrameIndex, nextCells);
  };
  const numInput = (value: number, testid: string, onInput: (v: number) => void): HTMLInputElement => {
    const input = el("input", { attrs: { type: "number", value: String(value) }, dataset: { testid } }) as HTMLInputElement;
    input.addEventListener("input", () => onInput(Number(input.value) || 0));
    return input;
  };
  row.append(
    el("td", { text: `C${String(index + 1).padStart(2, "0")}` }),
    el("td", { children: [numInput(cell.pattern, `db-animation-cell-pattern-${index}`, (pattern) => updateCell({ pattern }))] }),
    el("td", { children: [numInput(cell.x, `db-animation-cell-x-${index}`, (x) => updateCell({ x }))] }),
    el("td", { children: [numInput(cell.y, `db-animation-cell-y-${index}`, (y) => updateCell({ y }))] }),
    el("td", { children: [numInput(cell.zoom, `db-animation-cell-zoom-${index}`, (zoom) => updateCell({ zoom }))] }),
    el("td", { children: [numInput(cell.opacity, `db-animation-cell-opacity-${index}`, (opacity) => updateCell({ opacity }))] }),
    el("td", { children: [visibleCheckbox(cell, () => updateCell({ visible: !cell.visible }))] }),
    el("td", { text: toneText(cell.tone) }),
    el("td", {
      children: [
        el("button", {
          class: "btn btn-mini",
          text: "삭제",
          attrs: { type: "button", title: "셀 삭제" },
          dataset: { testid: `db-animation-cell-delete-${index}` },
          on: {
            click: () => {
              const nextCells = context.selectedFrame.cells.filter((_, i) => i !== index);
              updateFrameCells(context.animation.id, context.selectedFrameIndex, nextCells);
              context.rerender();
            },
          },
        }),
      ],
    })
  );
  return row;
}

function visibleCheckbox(cell: BattleAnimationCell, onToggle: () => void): HTMLInputElement {
  const input = el("input", { attrs: { type: "checkbox" } }) as HTMLInputElement;
  input.checked = cell.visible;
  input.addEventListener("change", onToggle);
  return input;
}

// 타이밍 테이블 — 타이밍 추가/삭제 버튼 포함.
function timingTablePanel(context: AnimationEditorContext): HTMLElement {
  const panel = panelWrap("SE 및 플래시 타이밍", "db-animation-timing-table", "db-animation-timing-panel");
  if (context.timings.length === 0) {
    panel.append(el("div", { class: "empty-hint", text: "SE, 플래시, 화면 흔들림 타이밍이 없습니다." }));
  } else {
    const table = dataTable(["번호", "사운드...", "플래시", "흔들림", "삭제"]);
    const body = table.querySelector("tbody");
    context.timings.forEach((timing, index) => {
      const row = el("tr");
      row.append(
        el("td", { text: `< ${timing.frameIndex + 1}>` }),
        el("td", { text: timing.soundResourceId ?? "-" }),
        el("td", { text: timing.flash ? `${timing.flash.target} ${toneText(timing.flash.color)} ${timing.flash.durationFrames}f` : "-" }),
        el("td", { text: timing.screenShake ? `p${timing.screenShake.power} s${timing.screenShake.speed} ${timing.screenShake.durationFrames}f` : "-" }),
        el("td", {
          children: [
            el("button", {
              class: "btn btn-mini",
              text: "삭제",
              attrs: { type: "button" },
              dataset: { testid: `db-animation-timing-delete-${index}` },
              on: {
                click: () => {
                  const next = context.timings.filter((_, i) => i !== index);
                  updateDatabaseRecord("battleAnimations", context.animation.id, { timings: next });
                  context.rerender();
                },
              },
            }),
          ],
        })
      );
      body?.append(row);
    });
    panel.append(table);
  }
  panel.append(
    el("button", {
      class: "btn btn-mini",
      text: "타이밍 추가",
      attrs: { type: "button", title: "현재 프레임에 타이밍 추가" },
      dataset: { testid: "db-animation-timing-add" },
      on: {
        click: () => {
          const next = [...context.timings, { frameIndex: context.selectedFrameIndex }];
          updateDatabaseRecord("battleAnimations", context.animation.id, { timings: next });
          context.rerender();
        },
      },
    })
  );
  return panel;
}

// 프레임 선택 — editorState에 저장하고 셀 인덱스 초기화.
function selectFrame(index: number): void {
  editorState.set({ selectedAnimationFrameIndex: Math.max(0, index), selectedAnimationCellIndex: 0 });
}

// 프레임 추가 — 마지막 프레임을 복제하거나 빈 프레임.
function addAnimationFrame(id: string, frames: readonly BattleAnimationFrame[], rerender: () => void): void {
  const last = frames[frames.length - 1];
  const nextFrame: BattleAnimationFrame = last ? { cells: last.cells.map((c) => ({ ...c })) } : { cells: [{ ...DEFAULT_CELL }] };
  const nextFrames = [...frames, nextFrame];
  updateDatabaseRecord("battleAnimations", id, { frames: nextFrames });
  editorState.set({ selectedAnimationFrameIndex: nextFrames.length - 1 });
  rerender();
}

// 프레임 복제 — 선택 프레임을 다음 위치에 삽입.
function duplicateAnimationFrame(id: string, frames: readonly BattleAnimationFrame[], index: number, rerender: () => void): void {
  const source = frames[index] ?? DEFAULT_FRAME;
  const copy: BattleAnimationFrame = { cells: source.cells.map((c) => ({ ...c })) };
  const nextFrames = [...frames.slice(0, index + 1), copy, ...frames.slice(index + 1)];
  updateDatabaseRecord("battleAnimations", id, { frames: nextFrames });
  editorState.set({ selectedAnimationFrameIndex: index + 1 });
  rerender();
}

// 프레임 삭제 — 최소 1개는 유지.
function deleteAnimationFrame(id: string, frames: readonly BattleAnimationFrame[], index: number, rerender: () => void): void {
  if (frames.length <= 1) return;
  const nextFrames = frames.filter((_, i) => i !== index);
  updateDatabaseRecord("battleAnimations", id, { frames: nextFrames });
  editorState.set({ selectedAnimationFrameIndex: Math.max(0, index - 1) });
  rerender();
}

// 선택 프레임의 셀 배열을 통째로 교체.
function updateFrameCells(id: string, frameIndex: number, cells: BattleAnimationCell[]): void {
  const record = store.getCurrent().database.battleAnimations.find((a) => a.id === id);
  if (!record) return;
  const frames = normalizedFrames(record.frames);
  frames[frameIndex] = { cells: cells.length > 0 ? cells : [{ ...DEFAULT_CELL }] };
  updateDatabaseRecord("battleAnimations", id, { frames: [...frames] });
}

function referencePanel(animation: BattleAnimationRecord): HTMLElement {
  const database = store.getCurrent().database;
  const referencingSkills = database.skills.filter((skill) => skill.animationId === animation.id);
  const referencingItems = database.items.filter((item) => item.animationId === animation.id);
  const panel = panelWrap("참조", "db-animation-references");

  if (referencingSkills.length === 0 && referencingItems.length === 0) {
    panel.append(el("div", { class: "empty-hint", text: "이 효과 애니메이션을 참조하는 스킬 또는 아이템이 없습니다." }));
    return panel;
  }

  for (const skill of referencingSkills) panel.append(el("div", { class: "db-ref-row", text: `스킬: ${skill.name} (${skill.id})` }));
  for (const item of referencingItems) panel.append(el("div", { class: "db-ref-row", text: `아이템: ${item.name} (${item.id})` }));
  return panel;
}

function battlerSeparationNote(count: number): HTMLElement {
  return el("div", {
    class: "db-field-hint",
    dataset: { testid: "db-animation-battler-note" },
    text: `배틀러 포즈 애니메이션은 이 효과 편집기와 분리되어 있습니다. 프로젝트 포즈 세트: ${count}개.`,
  });
}

function panelWrap(title: string, testid: string, className = ""): HTMLElement {
  const panel = el("section", {
    class: `db-animation-panel${className ? ` ${className}` : ""}`,
    dataset: { testid },
    children: title ? [el("h4", { text: title })] : [],
  });
  return panel;
}

function dataTable(headers: readonly string[]): HTMLElement {
  const table = el("table", { class: "db-animation-table" });
  const headRow = el("tr");
  for (const header of headers) headRow.append(el("th", { text: header }));
  table.append(el("thead", { children: [headRow] }), el("tbody"));
  return table;
}

function normalizedFrames(frames: readonly BattleAnimationFrame[] | undefined): BattleAnimationFrame[] {
  return frames && frames.length > 0 ? frames.map((f) => ({ cells: f.cells.map((c) => ({ ...c })) })) : [{ cells: [{ ...DEFAULT_CELL }] }];
}

function clampFrameIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length - 1));
}

// 조건부 disabled — 비활성일 때만 속성을 포함한다. ElProps.attrs는 string만 허용하므로 undefined를 넣을 수 없다.
function disabledAttr(disabled: boolean): { disabled: string } | Record<string, never> {
  return disabled ? { disabled: "true" } : {};
}

function toneText(tone: BattleAnimationCell["tone"]): string {
  if (!tone) return "-";
  return `${tone.red}/${tone.green}/${tone.blue}/${tone.gray}`;
}
