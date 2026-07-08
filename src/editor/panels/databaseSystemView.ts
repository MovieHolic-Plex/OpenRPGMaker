import {
  emptyToUndefined,
  numberField,
  selectField,
  textControl,
} from "@/editor/panels/databaseControls";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { normalizeTypeChart } from "@/project/databaseRecordModel";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { store } from "@/project/store";
import type { TypeChartRecord } from "@/project/types";
import { el } from "@/util/dom";

export function renderSystemTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const titleScreen = project.system.titleScreen ?? defaultTitleScreenSettings();
  const titleBackgroundResourceId = titleScreen.backgroundResourceId ?? project.system.titleResourceId;
  const form = el("section", { class: "db-detail-form db-system-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("초기 파티", [
      readonlyValue("멤버 1", project.database.actors[0]?.name ?? "(없음)"),
      readonlyValue("멤버 2", project.database.actors[1]?.name ?? "(없음)"),
      readonlyValue("멤버 3", project.database.actors[2]?.name ?? "(없음)"),
      readonlyValue("멤버 4", project.database.actors[3]?.name ?? "(없음)"),
    ]),
    rm2k3Fieldset("리소스", [
      textControl("타이틀 리소스", project.system.titleResourceId ?? "", (value) => {
        const resourceId = emptyToUndefined(value);
        store.update((draft) => {
          draft.system.titleResourceId = resourceId;
          draft.system.titleScreen ??= defaultTitleScreenSettings();
          draft.system.titleScreen.backgroundResourceId = resourceId;
        });
      }, "db-field-title-resource"),
      textControl("시스템 리소스", project.system.systemResourceId ?? "", (value) => {
        store.update((draft) => {
          draft.system.systemResourceId = emptyToUndefined(value);
        });
      }, "db-field-system-resource"),
      textControl("전투 시스템 리소스", project.system.battleSystemResourceId ?? "", (value) => {
        store.update((draft) => {
          draft.system.battleSystemResourceId = emptyToUndefined(value);
        });
      }, "db-field-battle-system-resource"),
    ]),
    rm2k3Fieldset("시작 설정", [
      selectField("시작 파티", "db-picker-system-start-actor", project.system.startActorIds[0] ?? "", project.database.actors, (value) => {
        store.update((draft) => {
          draft.system.startActorIds = value ? [value] : [];
          draft.session.partyActorIds = value ? [value] : [];
        });
      }),
      selectField("초기 적 그룹", "db-picker-system-initial-troop", project.system.initialTroopId ?? "", project.database.troops, (value) => {
        store.update((draft) => {
          draft.system.initialTroopId = emptyToUndefined(value);
        });
      }),
      numberField("기본 참전 수", "db-field-system-active-slots", project.system.activeSlots ?? 0, (value) => {
        store.update((draft) => {
          draft.system.activeSlots = optionalPositiveInteger(value);
        });
      }),
      checkboxField("몬스터 수집", "db-field-system-monster-collection", project.system.monsterCollection === true, (checked) => {
        store.update((draft) => {
          draft.system.monsterCollection = checked;
        });
      }),
    ]),
    typeChartFieldset(project.system.typeChart),
    rm2k3Fieldset("게임 시작화면", [
      textControl("게임 타이틀", titleScreen.title, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.title = value;
        });
      }, "db-field-title-screen-title"),
      textControl("배경 리소스", titleBackgroundResourceId ?? "", (value) => {
        const resourceId = emptyToUndefined(value);
        store.update((draft) => {
          draft.system.titleScreen ??= defaultTitleScreenSettings();
          draft.system.titleScreen.backgroundResourceId = resourceId;
        });
      }, "db-field-title-screen-background"),
      numberField("타이틀 X", "db-field-title-screen-title-x", titleScreen.layout.titleX, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.titleX = clampStageCoordinate(value, 320);
        });
      }),
      numberField("타이틀 Y", "db-field-title-screen-title-y", titleScreen.layout.titleY, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.titleY = clampStageCoordinate(value, 240);
        });
      }),
      numberField("선택지 X", "db-field-title-screen-menu-x", titleScreen.layout.menuX, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.menuX = clampStageCoordinate(value, 320);
        });
      }),
      numberField("선택지 Y", "db-field-title-screen-menu-y", titleScreen.layout.menuY, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.menuY = clampStageCoordinate(value, 240);
        });
      }),
      textControl("선택지 1", titleScreen.menuLabels.newGame, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.menuLabels.newGame = value;
        });
      }, "db-field-title-screen-new-game"),
      textControl("선택지 2", titleScreen.menuLabels.continueGame, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.menuLabels.continueGame = value;
        });
      }, "db-field-title-screen-continue"),
      textControl("선택지 3", titleScreen.menuLabels.quit, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.menuLabels.quit = value;
        });
      }, "db-field-title-screen-quit"),
    ]),
    rm2k3Fieldset("그래픽 미리보기", [
      systemPreviewWell("타이틀", project.system.titleResourceId),
      systemPreviewWell("시작화면", titleBackgroundResourceId),
      systemPreviewWell("시스템", project.system.systemResourceId),
      systemPreviewWell("전투", project.system.battleSystemResourceId),
    ]),
  );
  host.append(el("h3", { text: "시스템" }), form);
}

function typeChartFieldset(chart: TypeChartRecord | undefined): HTMLElement {
  const types = chart?.types ?? [];
  const typeInput = el("input", {
    attrs: { type: "text", placeholder: "fire, water, grass" },
    value: types.join(", "),
    dataset: { testid: "db-field-system-type-chart-types" },
  }) as HTMLInputElement;
  typeInput.addEventListener("change", () => {
    const nextTypes = parseTypes(typeInput.value);
    store.update((draft) => {
      const normalized = normalizeTypeChart({ types: nextTypes, multipliers: draft.system.typeChart?.multipliers ?? {} });
      if (normalized) draft.system.typeChart = normalized;
      else delete draft.system.typeChart;
    });
  });
  const children: HTMLElement[] = [
    el("label", { class: "db-field", children: [el("span", { text: "타입 목록" }), typeInput] }),
  ];
  if (types.length > 0) children.push(typeChartMatrix(chart));
  return rm2k3Fieldset("타입 상성", children);
}

function typeChartMatrix(chart: TypeChartRecord | undefined): HTMLElement {
  const types = chart?.types ?? [];
  const table = el("table", { class: "db-type-chart-matrix", dataset: { testid: "db-type-chart-matrix" } });
  const head = el("tr", { children: [el("th", { text: "공\\방" }), ...types.map((type) => el("th", { text: type }))] });
  table.append(el("thead", { children: [head] }));
  const body = el("tbody");
  for (const attacker of types) {
    const row = el("tr", { children: [el("th", { text: attacker })] });
    for (const defender of types) {
      const input = el("input", {
        attrs: { type: "number", step: "0.25", min: "0", max: "4" },
        value: String(chart?.multipliers[attacker]?.[defender] ?? 1),
        dataset: { testid: `db-type-chart-${attacker}-${defender}` },
      }) as HTMLInputElement;
      input.addEventListener("change", () => updateTypeChartCell(attacker, defender, parseFloat(input.value)));
      row.append(el("td", { children: [input] }));
    }
    body.append(row);
  }
  table.append(body);
  return el("div", { class: "db-type-chart-wrap", children: [table] });
}

function updateTypeChartCell(attacker: string, defender: string, value: number): void {
  store.update((draft) => {
    const chart = draft.system.typeChart;
    if (!chart) return;
    const multipliers = { ...chart.multipliers, [attacker]: { ...(chart.multipliers[attacker] ?? {}), [defender]: value } };
    const normalized = normalizeTypeChart({ types: chart.types, multipliers });
    if (normalized) draft.system.typeChart = normalized;
  });
}

function parseTypes(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function updateTitleScreen(mutator: (settings: ReturnType<typeof defaultTitleScreenSettings>) => void): void {
  store.update((draft) => {
    draft.system.titleScreen ??= defaultTitleScreenSettings();
    mutator(draft.system.titleScreen);
  });
}

function rm2k3Fieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "rm2k3-db-fieldset", children: [el("legend", { text: title }), ...children] });
}

function clampStageCoordinate(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function optionalPositiveInteger(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.trunc(value);
}

function readonlyValue(label: string, value: string): HTMLElement {
  return el("div", {
    class: "db-readonly-row",
    children: [el("span", { text: label }), el("code", { text: value })],
  });
}

function checkboxField(label: string, testid: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "db-field", children: [el("span", { text: label }), input] });
}

function systemPreviewWell(label: string, resourceId: string | undefined): HTMLElement {
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const preview = url
    ? el("img", { attrs: { alt: `${label} 미리보기`, src: url } })
    : el("span", { class: "db-system-preview-empty", text: resourceId ?? "(없음)" });
  return el("div", {
    class: "db-system-preview-well",
    children: [
      el("span", { class: "db-system-preview-label", text: label }),
      el("div", { class: "db-system-preview-frame", children: [preview] }),
      el("code", { text: resourceId ?? "(없음)" }),
    ],
  });
}
