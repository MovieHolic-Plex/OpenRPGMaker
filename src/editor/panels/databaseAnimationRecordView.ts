import { renderAnimationPatternStripPanel, renderAnimationStagePanel } from "@/editor/panels/databaseAnimationPreview";
import { emptyToUndefined, field, numberField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
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
const DEFAULT_FRAME: BattleAnimationFrame = {
  cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }],
};
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
};

export function renderBattleAnimationRecordForm(form: HTMLElement, animation: BattleAnimationRecord): HTMLElement {
  const project = store.getCurrent();
  const sheet = animation.sheet ?? DEFAULT_SHEET;
  const frames = normalizedFrames(animation.frames);
  const timings = animation.timings ?? [];
  const selectedFrameIndex = 0;
  const selectedFrame = frames[selectedFrameIndex] ?? DEFAULT_FRAME;
  const context: AnimationEditorContext = { animation, sheet, frames, selectedFrameIndex, selectedFrame, timings, project };

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
    timingTablePanel(context.timings),
    cellTablePanel(context.selectedFrame.cells),
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
    maxFrameField(context.frames.length),
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

function maxFrameField(frameCount: number): HTMLElement {
  const input = el("input", {
    attrs: { readonly: "true", type: "text" },
    value: String(Math.max(frameCount, 1)),
    dataset: { testid: "db-field-animation-max-frames" },
  });
  const picker = el("button", { class: "db-animation-picker-button", text: "...", attrs: { disabled: "true", type: "button" } });
  return field("최대 수", el("span", { class: "db-animation-inline-control", children: [input, picker] }));
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

function frameListPanel(context: AnimationEditorContext): HTMLElement {
  const panel = panelWrap("프레임 #", "db-animation-frame-list-panel", "db-animation-frame-list-panel");
  const controls = el("div", {
    class: "db-animation-frame-nav",
    children: [
      el("button", { text: "↑ 이전", attrs: { disabled: "true", type: "button" } }),
      el("button", { text: "↓ 다음", attrs: { disabled: "true", type: "button" } }),
    ],
  });
  const list = el("div", { class: "db-animation-frame-list", dataset: { testid: "db-animation-frame-list" } });
  context.frames.forEach((frame, index) => {
    list.append(
      el("button", {
        class: `db-animation-frame-row${index === context.selectedFrameIndex ? " active" : ""}`,
        text: `< ${index + 1}>`,
        attrs: { type: "button", title: `${frame.cells.length}개 셀` },
        dataset: { testid: `db-animation-frame-${index}` },
      })
    );
  });
  panel.append(controls.children[0] ?? "", list, controls.children[1] ?? "");
  return panel;
}

function cellTablePanel(cells: readonly BattleAnimationCell[]): HTMLElement {
  const panel = panelWrap("선택 프레임 셀", "db-animation-cell-table");
  const table = dataTable(["셀", "패턴", "X", "Y", "확대", "불투명도", "표시", "색조"]);
  if (!cells.some((cell) => cell.tone)) table.classList.add("tone-empty");
  const body = table.querySelector("tbody");
  for (const [index, cell] of cells.entries()) {
    body?.append(
      tableRow([
        `C${String(index + 1).padStart(2, "0")}`,
        String(cell.pattern),
        String(cell.x),
        String(cell.y),
        `${cell.zoom}%`,
        String(cell.opacity),
        cell.visible ? "예" : "아니오",
        toneText(cell.tone),
      ])
    );
  }
  panel.append(table);
  return panel;
}

function timingTablePanel(timings: readonly BattleAnimationTiming[]): HTMLElement {
  const panel = panelWrap("SE 및 플래시 타이밍", "db-animation-timing-table", "db-animation-timing-panel");
  if (timings.length === 0) {
    panel.append(el("div", { class: "empty-hint", text: "SE, 플래시, 화면 흔들림 타이밍이 없습니다." }));
    return panel;
  }

  const table = dataTable(["번호", "사운드...", "플래시", "흔들림"]);
  const body = table.querySelector("tbody");
  for (const timing of timings) {
    body?.append(
      tableRow([
        `< ${timing.frameIndex + 1}>`,
        timing.soundResourceId ?? "-",
        timing.flash ? `${timing.flash.target} ${toneText(timing.flash.color)} ${timing.flash.durationFrames}f` : "-",
        timing.screenShake ? `p${timing.screenShake.power} s${timing.screenShake.speed} ${timing.screenShake.durationFrames}f` : "-",
      ])
    );
  }
  panel.append(table);
  return panel;
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

function tableRow(values: readonly string[]): HTMLElement {
  const row = el("tr");
  for (const value of values) row.append(el("td", { text: value }));
  return row;
}

function normalizedFrames(frames: readonly BattleAnimationFrame[] | undefined): BattleAnimationFrame[] {
  return frames && frames.length > 0 ? [...frames] : [DEFAULT_FRAME];
}

function toneText(tone: BattleAnimationCell["tone"]): string {
  if (!tone) return "-";
  return `${tone.red}/${tone.green}/${tone.blue}/${tone.gray}`;
}
