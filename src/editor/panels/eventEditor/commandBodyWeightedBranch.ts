import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import { renderEditorIcon } from "./editorIcons";
import type { CommandEditContext } from "./types";
import { replaceFields } from "./commandBodyM2Page3";
import { formatWeightedBranchPercent, rowsForWeightedBranchEditor, serializeWeightedBranchTable, weightedBranchPercents } from "./weightedBranchTable";

type M2Command = Extract<Command, { kind: "m2Command" }>;
// Local draft rows are mutable; the command is updated only through replaceFields.
type DraftRow = { label: string; weight: number };

export function renderWeightedBranchCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement | undefined {
  const entry = m2CommandById(cmd.commandId);
  if (!entry || (entry.title !== "Weighted Branch" && cmd.commandId !== "m2-211-weighted-branch")) return undefined;

  const wrap = el("div", {
    class: "weighted-branch-command-body m2-command-body cream-command-form",
    dataset: { testid: "m2-command-body-m2-211-weighted-branch" },
  });
  const rows: DraftRow[] = rowsForWeightedBranchEditor(String(cmd.fields.table ?? "")).map(row => ({ ...row }));
  let table = String(cmd.fields.table ?? "");
  let resultVariableId = String(cmd.fields.resultVariableId ?? "");
  const rowsHost = el("div", { class: "weighted-branch-rows", dataset: { testid: "weighted-branch-rows" } });
  const allZeroError = el("span", {
    class: "weighted-branch-error", text: "뽑을 결과의 확률을 0%보다 크게 설정하세요.",
    attrs: { role: "status" }, dataset: { testid: "weighted-branch-all-zero" },
  });
  const destination = el("div", { class: "weighted-branch-destination", dataset: { testid: "weighted-branch-destination" } });
  const picker = databasePicker("variable", resultVariableId, id => {
    resultVariableId = id;
    replaceFields(context, cmd, { table, resultVariableId });
    refreshDestination();
  }, "weighted-branch-result-variable");
  const pickerButton = picker.querySelector("button");
  function refreshDestination(): void {
    destination.dataset.variableId = resultVariableId;
    if (pickerButton) {
      if (!resultVariableId.trim()) pickerButton.textContent = "결과를 저장할 변수 선택";
      pickerButton.setAttribute("aria-label", `결과 저장 변수: ${pickerButton.textContent}`);
    }
  }
  const commitRows = (): void => {
    table = serializeWeightedBranchTable(rows);
    replaceFields(context, cmd, { table, resultVariableId });
  };
  let controls: ReturnType<typeof createRow>[] = [];
  const refresh = (editing?: HTMLInputElement): void => {
    const percentages = weightedBranchPercents(rows);
    const positiveCount = rows.filter(row => row.weight > 0).length;
    allZeroError.hidden = positiveCount > 0;
    wrap.dataset.allZero = String(positiveCount === 0);
    let positiveIndex = 0;
    for (const [index, row] of rows.entries()) {
      const control = controls[index];
      if (!control) continue;
      const active = row.weight > 0;
      const percent = active ? percentages[positiveIndex] ?? 0 : 0;
      const value = active ? String(positiveIndex++) : "";
      if (control.chance !== editing && control.chance.getAttribute("aria-invalid") !== "true") {
        control.chance.value = formatWeightedBranchPercent(percent);
      }
      control.chance.disabled = rows.length === 1 && active;
      control.remove.disabled = rows.length === 1 || (active && positiveCount === 1);
      control.remove.title = control.remove.disabled ? "뽑을 결과가 하나 이상 필요합니다" : "결과 삭제";
      control.badge.textContent = active ? value : "뽑지 않음";
      control.badge.dataset.resultValue = value;
      control.badge.setAttribute("aria-label", active ? `저장값 ${value}` : "뽑지 않음");
      control.meter.setAttribute("aria-valuenow", String(percent));
      control.meter.setAttribute("aria-label", `${row.label || `결과 ${index + 1}`} 확률`);
      control.fill.style.width = `${percent}%`;
    }
  };
  const renderRows = (focusIndex?: number): void => {
    controls = rows.map(createRow);
    rowsHost.replaceChildren(...controls.map(control => control.root));
    refresh();
    if (focusIndex !== undefined) controls[focusIndex]?.name.focus();
  };
  function createRow(row: DraftRow, index: number) {
    const name = el("input", {
      class: "weighted-branch-label-input", value: row.label,
      attrs: { type: "text", autocomplete: "off", "aria-label": `결과 ${index + 1} 이름` },
      dataset: { testid: `weighted-branch-label-${index}` },
    });
    const chance = el("input", {
      class: "weighted-branch-chance-input",
      attrs: { type: "number", min: "0", max: "100", step: "any", "aria-label": `결과 ${index + 1} 확률 (%)` },
      dataset: { testid: `weighted-branch-chance-${index}` },
    });
    const error = el("span", { class: "weighted-branch-error", text: "0–100% 입력", attrs: { role: "status" } });
    error.hidden = true;
    const badge = el("output", { class: "weighted-branch-index", dataset: { testid: `weighted-branch-index-${index}` } });
    const fill = el("span", { class: "weighted-branch-meter-fill" });
    const meter = el("div", {
      class: "weighted-branch-meter", children: [fill],
      attrs: { role: "meter", "aria-valuemin": "0", "aria-valuemax": "100" },
      dataset: { testid: `weighted-branch-meter-${index}` },
    });
    const remove = el("button", {
      class: "btn small weighted-branch-remove", children: [renderEditorIcon("trash")],
      attrs: { type: "button", "aria-label": `결과 ${index + 1} 삭제`, title: "결과 삭제" },
      dataset: { testid: `weighted-branch-remove-${index}` },
      on: { click: () => {
        if (rows.length === 1 || (row.weight > 0 && rows.filter(candidate => candidate.weight > 0).length === 1)) return;
        rows.splice(index, 1);
        commitRows();
        renderRows(Math.min(index, rows.length - 1));
      } },
    });
    let composing = false;
    const syncName = (): void => {
      if (composing || row.label === name.value) return;
      row.label = name.value;
      commitRows();
      refresh();
    };
    name.addEventListener("compositionstart", () => { composing = true; });
    name.addEventListener("compositionend", () => { composing = false; syncName(); });
    name.addEventListener("input", syncName);
    name.addEventListener("change", syncName);
    const syncChance = (): void => {
      const percent = Number(chance.value);
      const valid = chance.value.trim() !== "" && Number.isFinite(percent) && percent >= 0 && percent <= 100
        && (rows.length > 1 || percent === 100);
      chance.setAttribute("aria-invalid", String(!valid));
      error.hidden = valid;
      if (!valid) return;
      const others = rows.filter(candidate => candidate !== row);
      const maximum = others.reduce((max, candidate) => Math.max(max, candidate.weight), 0);
      const total = maximum > 0 ? others.reduce((sum, candidate) => sum + candidate.weight / maximum, 0) : 0;
      for (const other of others) {
        other.weight = total > 0 ? (100 - percent) * (other.weight / maximum / total) : (100 - percent) / others.length;
      }
      row.weight = percent;
      commitRows();
      refresh(chance);
    };
    chance.addEventListener("input", syncChance);
    chance.addEventListener("change", syncChance);
    const root = el("div", {
      class: "weighted-branch-row", dataset: { testid: `weighted-branch-row-${index}` },
      children: [
        el("label", { class: "weighted-branch-name-field", children: [el("span", { class: "weighted-branch-label", text: `결과 ${index + 1}` }), name] }),
        el("label", { class: "weighted-branch-chance-field", children: [
          el("span", { class: "weighted-branch-label", text: "확률" }),
          el("span", { class: "weighted-branch-percent-control", children: [chance, el("span", { text: "%", attrs: { "aria-hidden": "true" } })] }),
        ] }),
        remove, meter,
        el("div", { class: "weighted-branch-mapping", children: [renderEditorIcon("arrowRight"), el("span", { text: "저장값" }), badge] }),
        error,
      ],
    });
    return { root, name, chance, badge, meter, fill, remove };
  }
  const add = el("button", {
    class: "btn small weighted-branch-add", children: [renderEditorIcon("plus"), "결과 추가"],
    attrs: { type: "button" }, dataset: { testid: "weighted-branch-add-row" },
    on: { click: () => {
      // A new row receives 1/(n+1), preserving the old outcomes' relative odds.
      const percentages = weightedBranchPercents(rows);
      let cursor = 0;
      rows.forEach(row => { if (row.weight > 0) row.weight = percentages[cursor++] ?? 0; });
      rows.push({ label: `결과${rows.length + 1}`, weight: 100 / rows.length });
      commitRows();
      renderRows(rows.length - 1);
    } },
  });
  destination.append(renderEditorIcon("arrowDown"), el("span", { class: "weighted-branch-label", text: "뽑힌 결과의 저장값" }), picker);
  wrap.append(
    el("div", { class: "cream-command-form-head", text: "확률로 결과 뽑기" }),
    el("div", { class: "weighted-branch-toolbar", children: [el("span", { class: "weighted-branch-label", text: "하나 뽑기 · 나머지 확률 자동 조정" }), add] }),
    rowsHost, allZeroError, destination,
  );
  renderRows();
  refreshDestination();
  return wrap;
}

/** Confirm must validate the visible draft, not silently apply the last valid command. */
export function validateWeightedBranchForm(formHost: HTMLElement): boolean {
  const form = formHost.querySelector<HTMLElement>(".weighted-branch-command-body");
  if (!form) return true;
  const invalid = Array.from(form.querySelectorAll<HTMLInputElement>("input"))
    .find(input => input.getAttribute("aria-invalid") === "true");
  if (invalid) {
    invalid.focus();
    return false;
  }
  if (form.dataset.allZero === "true") {
    form.querySelector<HTMLInputElement>(".weighted-branch-chance-input")?.focus();
    return false;
  }
  return true;
}
