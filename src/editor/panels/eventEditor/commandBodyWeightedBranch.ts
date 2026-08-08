import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import type { CommandEditContext } from "./types";
import { replaceFields } from "./commandBodyM2Page3";
import {
  formatWeightedBranchSummary,
  rowsForWeightedBranchEditor,
  serializeWeightedBranchTable,
  weightedBranchPercents,
  type WeightedBranchRow,
} from "./weightedBranchTable";

type M2Command = Extract<Command, { kind: "m2Command" }>;

type MutableRow = {
  label: string;
  weight: number;
};

const BAR_COLORS = ["#0d7a6f", "#b8454a", "#3b4f9c", "#c47a12", "#6b4fa0", "#2a6f9c"] as const;

/** Dedicated Weighted Branch editor — returns undefined for other M2 commands. */
export function renderWeightedBranchCommandBody(
  context: CommandEditContext,
  cmd: M2Command,
): HTMLElement | undefined {
  const entry = m2CommandById(cmd.commandId);
  if (!entry) return undefined;
  if (entry.title !== "Weighted Branch" && cmd.commandId !== "m2-211-weighted-branch") {
    return undefined;
  }

  const wrap = el("div", {
    class: "weighted-branch-command-body m2-command-body",
    dataset: { testid: "m2-command-body-m2-211-weighted-branch" },
  });

  const rows: MutableRow[] = rowsForWeightedBranchEditor(String(cmd.fields.table ?? "")).map((row) => ({
    label: row.label,
    weight: row.weight,
  }));
  let resultVariableId = String(cmd.fields.resultVariableId ?? "").trim();

  const help = el("p", {
    class: "weighted-branch-help empty-hint",
    text: "가중치 비율로 하나를 고르고, 결과 번호를 변수에 저장합니다.",
    dataset: { testid: "weighted-branch-help" },
  });

  const variableWarn = el("p", {
    class: "weighted-branch-variable-warn",
    text: "비어 있으면 결과를 나중에 분기할 수 없습니다.",
    dataset: { testid: "weighted-branch-variable-warn" },
  });

  const variablePicker = databasePicker(
    "variable",
    resultVariableId,
    (variableId) => {
      resultVariableId = variableId;
      commit();
      refreshMeta();
    },
    "weighted-branch-result-variable",
  );

  const variableField = el("div", {
    class: "weighted-branch-field",
    children: [
      el("label", { class: "weighted-branch-label", text: "결과 변수" }),
      variablePicker,
      variableWarn,
    ],
  });

  const rowsHost = el("div", {
    class: "weighted-branch-rows",
    dataset: { testid: "weighted-branch-rows" },
  });

  const addButton = el("button", {
    class: "btn small weighted-branch-add",
    text: "+ 결과 추가",
    attrs: { type: "button", "aria-label": "결과 행 추가" },
    dataset: { testid: "weighted-branch-add-row" },
    on: {
      click: () => {
        rows.push({ label: `결과${rows.length + 1}`, weight: 1 });
        renderRows();
        commit();
        refreshMeta();
      },
    },
  });

  const bar = el("div", {
    class: "weighted-branch-bar",
    attrs: { role: "img", "aria-label": "결과 확률 바" },
    dataset: { testid: "weighted-branch-bar" },
  });
  const legend = el("div", {
    class: "weighted-branch-legend",
    dataset: { testid: "weighted-branch-legend" },
  });
  const barEmpty = el("p", {
    class: "weighted-branch-bar-empty empty-hint",
    text: "유효한 가중치가 없습니다",
    dataset: { testid: "weighted-branch-bar-empty" },
  });

  const guide = el("div", {
    class: "weighted-branch-guide",
    dataset: { testid: "weighted-branch-guide" },
  });

  const summaryLive = el("div", {
    class: "weighted-branch-summary-live empty-hint",
    dataset: { testid: "weighted-branch-summary-live" },
  });

  const commit = () => {
    replaceFields(context, cmd, {
      table: serializeWeightedBranchTable(rows),
      resultVariableId,
    });
  };

  const renderRows = () => {
    rowsHost.replaceChildren();
    const positiveIndexByRow = positiveIndexMap(rows);
    for (const [index, row] of rows.entries()) {
      rowsHost.append(rowElement(index, row, positiveIndexByRow.get(index)));
    }
  };

  const rowElement = (index: number, row: MutableRow, positiveIndex: number | undefined): HTMLElement => {
    const badge = el("span", {
      class: "weighted-branch-index" + (positiveIndex === undefined ? " is-inactive" : ""),
      text: positiveIndex === undefined ? "—" : `#${positiveIndex}`,
      dataset: { testid: `weighted-branch-index-${index}` },
    });

    const labelInput = el("input", {
      class: "weighted-branch-label-input",
      attrs: {
        type: "text",
        spellcheck: "false",
        autocomplete: "off",
        placeholder: `결과${index + 1}`,
        "aria-label": `결과 ${index + 1} 이름`,
      },
      value: row.label,
      dataset: { testid: `weighted-branch-label-${index}` },
    }) as HTMLInputElement;

    const weightInput = el("input", {
      class: "weighted-branch-weight-input",
      attrs: {
        type: "number",
        min: "0",
        step: "any",
        "aria-label": `결과 ${index + 1} 가중치`,
      },
      value: String(row.weight),
      dataset: { testid: `weighted-branch-weight-${index}` },
    }) as HTMLInputElement;

    const pct = el("span", {
      class: "weighted-branch-pct",
      text: "—",
      dataset: { testid: `weighted-branch-pct-${index}` },
    });

    const remove = el("button", {
      class: "btn small weighted-branch-remove",
      text: "×",
      attrs: {
        type: "button",
        "aria-label": `결과 ${index + 1} 삭제`,
        title: "삭제",
        ...(rows.length <= 1 ? { disabled: "true" } : {}),
      },
      dataset: { testid: `weighted-branch-remove-${index}` },
      on: {
        click: () => {
          if (rows.length <= 1) return;
          rows.splice(index, 1);
          renderRows();
          commit();
          refreshMeta();
        },
      },
    }) as HTMLButtonElement;

    const syncRow = () => {
      row.label = labelInput.value;
      const nextWeight = Number(weightInput.value);
      row.weight = Number.isFinite(nextWeight) ? nextWeight : 0;
      commit();
      refreshMeta();
    };

    labelInput.addEventListener("input", syncRow);
    labelInput.addEventListener("change", syncRow);
    weightInput.addEventListener("input", syncRow);
    weightInput.addEventListener("change", syncRow);

    return el("div", {
      class: "weighted-branch-row",
      dataset: { testid: `weighted-branch-row-${index}` },
      children: [badge, labelInput, weightInput, pct, remove],
    });
  };

  const refreshMeta = () => {
    const snapshot: WeightedBranchRow[] = rows.map((row) => ({ label: row.label, weight: row.weight }));
    const percents = weightedBranchPercents(snapshot);
    const positiveIndexByRow = positiveIndexMap(rows);

    // index badges + pct cells
    for (const [index] of rows.entries()) {
      const badge = wrap.querySelector(`[data-testid="weighted-branch-index-${index}"]`);
      const pctEl = wrap.querySelector(`[data-testid="weighted-branch-pct-${index}"]`);
      const positiveIndex = positiveIndexByRow.get(index);
      if (badge) {
        badge.textContent = positiveIndex === undefined ? "—" : `#${positiveIndex}`;
        badge.classList.toggle("is-inactive", positiveIndex === undefined);
      }
      if (pctEl) {
        if (positiveIndex === undefined) {
          pctEl.textContent = "—";
        } else {
          pctEl.textContent = `${percents[positiveIndex] ?? 0}%`;
        }
      }
    }

    // probability bar
    bar.replaceChildren();
    legend.replaceChildren();
    if (percents.length === 0) {
      bar.hidden = true;
      barEmpty.hidden = false;
    } else {
      bar.hidden = false;
      barEmpty.hidden = true;
      let positiveCursor = 0;
      for (const [index, row] of rows.entries()) {
        if (!(row.weight > 0)) continue;
        const pct = percents[positiveCursor] ?? 0;
        const color = BAR_COLORS[positiveCursor % BAR_COLORS.length] ?? BAR_COLORS[0];
        bar.append(
          el("div", {
            class: "weighted-branch-bar-seg",
            attrs: {
              style: `flex:${Math.max(pct, 0.0001)};background:${color}`,
              title: `${row.label.trim() || `결과${index + 1}`} ${pct}%`,
            },
          }),
        );
        legend.append(
          el("span", {
            class: "weighted-branch-legend-item",
            children: [
              el("span", {
                class: "weighted-branch-legend-swatch",
                attrs: { style: `background:${color}` },
              }),
              el("span", {
                text: `${row.label.trim() || `결과${index + 1}`} ${pct}% · #${positiveCursor}`,
              }),
            ],
          }),
        );
        positiveCursor += 1;
      }
    }

    // guide card
    guide.replaceChildren();
    guide.append(el("strong", { text: "다음에 할 일" }));
    if (!resultVariableId) {
      guide.append(
        el("p", {
          text: "결과 변수를 고른 뒤, 조건 분기에서 그 변수를 비교하세요.",
        }),
      );
    } else {
      const project = store.getCurrent();
      const variableName =
        project.variables.find((record) => record.id === resultVariableId)?.name ?? resultVariableId;
      guide.append(
        el("p", {
          text: `이 명령 다음에 「조건 분기」를 넣고`,
        }),
      );
      const list = el("ul", { class: "weighted-branch-guide-list" });
      const positiveRows = rows.filter((row) => row.weight > 0);
      const shown = positiveRows.slice(0, 3);
      for (const [index, row] of shown.entries()) {
        list.append(
          el("li", {
            text: `변수 ${variableName} == ${index} → ${row.label.trim() || `결과${index + 1}`}`,
          }),
        );
      }
      if (positiveRows.length > 3) {
        list.append(el("li", { text: "…" }));
      }
      if (positiveRows.length === 0) {
        list.append(el("li", { text: "유효한 결과 행이 없습니다" }));
      }
      guide.append(list);
    }

    const project = store.getCurrent();
    const variableName = resultVariableId
      ? project.variables.find((record) => record.id === resultVariableId)?.name
      : undefined;
    summaryLive.textContent = formatWeightedBranchSummary(
      serializeWeightedBranchTable(rows),
      resultVariableId,
      variableName,
    );

    variableWarn.hidden = Boolean(resultVariableId);
  };

  renderRows();
  refreshMeta();

  wrap.append(
    help,
    variableField,
    el("div", {
      class: "weighted-branch-field",
      children: [
        el("label", { class: "weighted-branch-label", text: "결과 목록" }),
        rowsHost,
        addButton,
      ],
    }),
    el("div", {
      class: "weighted-branch-field",
      children: [
        el("label", { class: "weighted-branch-label", text: "확률" }),
        bar,
        barEmpty,
        legend,
      ],
    }),
    guide,
    summaryLive,
  );

  return wrap;
}

function positiveIndexMap(rows: readonly MutableRow[]): Map<number, number> {
  const map = new Map<number, number>();
  let cursor = 0;
  for (const [index, row] of rows.entries()) {
    if (row.weight > 0 && Number.isFinite(row.weight)) {
      map.set(index, cursor);
      cursor += 1;
    }
  }
  return map;
}
