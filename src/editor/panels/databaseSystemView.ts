import {
  FACESET_COLUMNS,
  FACESET_FACE_HEIGHT,
  FACESET_FACE_WIDTH,
  FACESET_ROWS,
} from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { BATTLE_SKINS, listBattleSkinIds, resolveSkinId } from "@/battle/skins/registry";
import {
  emptyToUndefined,
  field,
  numberField,
  selectField,
  selectLiteral,
  textControl,
} from "@/editor/panels/databaseControls";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { normalizeTimeSystemConfig, normalizeTypeChart } from "@/project/databaseRecordModel";
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import {
  DEFAULT_DAY_END_HOUR,
  DEFAULT_DAY_START_HOUR,
  DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
} from "@/project/gameTime";
import { store } from "@/project/store";
import type { ActorRecord, BattleFlow, TypeChartRecord } from "@/project/types";
import { el } from "@/util/dom";

const START_PARTY_SLOTS = 4;
const BATTLE_FLOW_OPTIONS = ["gauge", "strict"] as const satisfies readonly BattleFlow[];
const BATTLE_UI_STYLE_OPTIONS = listBattleSkinIds();

export function renderSystemTab(host: HTMLElement, rerender: () => void = () => undefined): void {
  const project = store.getCurrent();
  const titleScreen = project.system.titleScreen ?? defaultTitleScreenSettings();
  const titleBackgroundResourceId = titleScreen.backgroundResourceId ?? project.system.titleResourceId;
  const form = el("section", { class: "db-detail-form db-system-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("초기 파티", [
      startPartyFaceStrip(project.system.startActorIds, project.database.actors),
      ...startPartySlots(project.system.startActorIds, project.database.actors, rerender),
    ]),
    rm2k3Fieldset("리소스", [
      resourcePickerControl({
        label: "타이틀 리소스",
        resourceId: project.system.titleResourceId,
        kind: "title",
        testid: "db-field-title-resource",
        allowClear: true,
        dialogTitle: "타이틀 그래픽",
        onChange: (result) => {
          const resourceId = emptyToUndefined(result.resourceId);
          updateSystem((draft) => {
            draft.system.titleResourceId = resourceId;
            draft.system.titleScreen ??= defaultTitleScreenSettings();
            draft.system.titleScreen.backgroundResourceId = resourceId;
          });
        },
        rerender,
      }),
      resourcePickerControl({
        label: "시스템 리소스",
        resourceId: project.system.systemResourceId,
        kind: "system",
        testid: "db-field-system-resource",
        allowClear: true,
        dialogTitle: "시스템 그래픽",
        onChange: (result) => {
          updateSystem((draft) => {
            draft.system.systemResourceId = emptyToUndefined(result.resourceId);
          });
        },
        rerender,
      }),
      resourcePickerControl({
        label: "전투 시스템 리소스",
        resourceId: project.system.battleSystemResourceId,
        kind: "system2",
        testid: "db-field-battle-system-resource",
        allowClear: true,
        dialogTitle: "전투 시스템 그래픽",
        onChange: (result) => {
          updateSystem((draft) => {
            draft.system.battleSystemResourceId = emptyToUndefined(result.resourceId);
          });
        },
        rerender,
      }),
      el("div", {
        class: "db-system-resource-actions",
        children: [
          el("button", {
            class: "btn small",
            text: "미리보기 갱신",
            attrs: { type: "button" },
            dataset: { testid: "db-system-refresh-previews" },
            on: { click: () => rerender() },
          }),
        ],
      }),
    ]),
    rm2k3Fieldset("시작 설정", [
      selectField("초기 적 그룹", "db-picker-system-initial-troop", project.system.initialTroopId ?? "", project.database.troops, (value) => {
        updateSystem((draft) => {
          draft.system.initialTroopId = emptyToUndefined(value);
        });
      }),
      selectLiteral(
        "전투 흐름",
        "db-field-system-battle-flow",
        project.system.battleFlow === "strict" ? "strict" : "gauge",
        BATTLE_FLOW_OPTIONS,
        (value) => {
          updateSystem((draft) => {
            draft.system.battleFlow = value;
          });
        },
      ),
      field("전투 UI 스타일", (() => {
        // literalLabel 스위치에는 스킨 라벨이 없으므로 레지스트리 라벨로 직접 빌드한다.
        const select = el("select", { dataset: { testid: "db-field-system-battle-ui-style" } });
        for (const id of BATTLE_UI_STYLE_OPTIONS) {
          select.append(el("option", { text: BATTLE_SKINS[id].label, attrs: { value: id } }));
        }
        select.value = resolveSkinId(project.system.battleUiStyle);
        select.addEventListener("change", () => {
          updateSystem((draft) => {
            draft.system.battleUiStyle = select.value as (typeof BATTLE_UI_STYLE_OPTIONS)[number];
          });
        });
        return select;
      })()),
      numberField("기본 참전 수", "db-field-system-active-slots", project.system.activeSlots ?? 0, (value) => {
        updateSystem((draft) => {
          draft.system.activeSlots = optionalPositiveInteger(value);
        }, "system:active-slots");
      }),
      checkboxField("몬스터 수집", "db-field-system-monster-collection", project.system.monsterCollection === true, (checked) => {
        updateSystem((draft) => {
          if (checked) draft.system.monsterCollection = true;
          else delete draft.system.monsterCollection;
        });
      }),
      checkboxField("선물 시스템", "db-field-system-gift-system", project.system.giftSystem === true, (checked) => {
        updateSystem((draft) => {
          if (checked) draft.system.giftSystem = true;
          else delete draft.system.giftSystem;
        });
      }),
      checkboxField(
        "참전 보상만",
        "db-field-system-reward-participation-only",
        project.system.rewardPolicy?.participationOnly === true,
        (checked) => {
          updateSystem((draft) => {
            draft.system.rewardPolicy = nextRewardPolicy(draft.system.rewardPolicy, { participationOnly: checked });
          });
        },
      ),
      checkboxField(
        "레벨 격차 패널티",
        "db-field-system-reward-level-gap",
        project.system.rewardPolicy?.levelGapPenalty === true,
        (checked) => {
          updateSystem((draft) => {
            draft.system.rewardPolicy = nextRewardPolicy(draft.system.rewardPolicy, { levelGapPenalty: checked });
          });
        },
      ),
    ]),
    timeSystemFieldset(project.system.timeSystem, project.commonEvents, rerender),
    typeChartFieldset(project.system.typeChart, rerender),
    rm2k3Fieldset("게임 시작화면", [
      textControl("게임 타이틀", titleScreen.title, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.title = value;
        }, "system:title-screen:title");
      }, "db-field-title-screen-title"),
      textControl("배경 리소스", titleBackgroundResourceId ?? "", (value) => {
        const resourceId = emptyToUndefined(value);
        updateSystem((draft) => {
          draft.system.titleScreen ??= defaultTitleScreenSettings();
          draft.system.titleScreen.backgroundResourceId = resourceId;
        }, "system:title-screen:background");
      }, "db-field-title-screen-background"),
      numberField("타이틀 X", "db-field-title-screen-title-x", titleScreen.layout.titleX, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.titleX = clampStageCoordinate(value, 320);
        }, "system:title-screen:title-x");
      }),
      numberField("타이틀 Y", "db-field-title-screen-title-y", titleScreen.layout.titleY, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.titleY = clampStageCoordinate(value, 240);
        }, "system:title-screen:title-y");
      }),
      numberField("선택지 X", "db-field-title-screen-menu-x", titleScreen.layout.menuX, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.menuX = clampStageCoordinate(value, 320);
        }, "system:title-screen:menu-x");
      }),
      numberField("선택지 Y", "db-field-title-screen-menu-y", titleScreen.layout.menuY, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.layout.menuY = clampStageCoordinate(value, 240);
        }, "system:title-screen:menu-y");
      }),
      textControl("선택지 1", titleScreen.menuLabels.newGame, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.menuLabels.newGame = value;
        }, "system:title-screen:menu-new-game");
      }, "db-field-title-screen-new-game"),
      textControl("선택지 2", titleScreen.menuLabels.continueGame, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.menuLabels.continueGame = value;
        }, "system:title-screen:menu-continue");
      }, "db-field-title-screen-continue"),
      textControl("선택지 3", titleScreen.menuLabels.quit, (value) => {
        updateTitleScreen((titleScreenSettings) => {
          titleScreenSettings.menuLabels.quit = value;
        }, "system:title-screen:menu-quit");
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

function startPartySlots(
  startActorIds: readonly string[],
  actors: readonly { readonly id: string; readonly name: string }[],
  rerender: () => void,
): HTMLElement[] {
  const slots: HTMLElement[] = [];
  for (let index = 0; index < START_PARTY_SLOTS; index += 1) {
    const value = startActorIds[index] ?? "";
    // 첫 슬롯은 레거시 단일 피커 testid(`db-picker-system-start-actor`)를 유지한다.
    const testid = index === 0 ? "db-picker-system-start-actor" : `db-picker-system-start-actor-${index + 1}`;
    slots.push(
      selectField(`멤버 ${index + 1}`, testid, value, actors, (next) => {
        updateSystem((draft) => {
          const nextSlots = Array.from({ length: START_PARTY_SLOTS }, (_, slot) => draft.system.startActorIds[slot] ?? "");
          nextSlots[index] = next;
          const party = nextSlots.filter((id) => id.length > 0);
          draft.system.startActorIds = party;
          draft.session.partyActorIds = [...party];
        });
        rerender();
      }),
    );
  }
  return slots;
}

function startPartyFaceStrip(startActorIds: readonly string[], actors: readonly ActorRecord[]): HTMLElement {
  const project = store.getCurrent();
  const faces = Array.from({ length: START_PARTY_SLOTS }, (_, index) => {
    const actorId = startActorIds[index];
    const actor = actorId ? actors.find((entry) => entry.id === actorId) : undefined;
    if (!actor?.faceResourceId) {
      return el("span", {
        class: "db-system-party-face empty",
        attrs: { "aria-label": `파티 슬롯 ${index + 1} 비어 있음` },
      });
    }
    const url = resolveAssetResourceUrl(actor.faceResourceId, { project });
    if (!url) {
      return el("span", { class: "db-system-party-face empty", attrs: { "aria-label": actor.name } });
    }
    const faceIndex = actor.faceIndex ?? 0;
    const column = faceIndex % FACESET_COLUMNS;
    const row = Math.floor(faceIndex / FACESET_COLUMNS);
    const scale = 40 / FACESET_FACE_WIDTH;
    return el("span", {
      class: "db-system-party-face",
      attrs: {
        "aria-label": actor.name,
        role: "img",
        title: actor.name,
        style: [
          `background-image:url("${url}")`,
          `background-position:-${column * FACESET_FACE_WIDTH * scale}px -${row * FACESET_FACE_HEIGHT * scale}px`,
          `background-size:${FACESET_COLUMNS * FACESET_FACE_WIDTH * scale}px ${FACESET_ROWS * FACESET_FACE_HEIGHT * scale}px`,
        ].join(";"),
      },
    });
  });
  return el("div", {
    class: "db-system-party-face-strip",
    dataset: { testid: "db-system-party-face-strip" },
    children: faces,
  });
}

function timeSystemFieldset(
  timeSystem: ReturnType<typeof normalizeTimeSystemConfig>,
  commonEvents: readonly { readonly id: string; readonly name: string }[],
  rerender: () => void,
): HTMLElement {
  const enabled = timeSystem?.enabled === true;
  const children: HTMLElement[] = [
    checkboxField("시간/달력 사용", "db-field-system-time-enabled", enabled, (checked) => {
      updateSystem((draft) => {
        if (!checked) {
          delete draft.system.timeSystem;
          return;
        }
        draft.system.timeSystem = normalizeTimeSystemConfig({
          enabled: true,
          minutesPerRealSecond: draft.system.timeSystem?.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
          dayStartHour: draft.system.timeSystem?.dayStartHour ?? DEFAULT_DAY_START_HOUR,
          dayEndHour: draft.system.timeSystem?.dayEndHour ?? DEFAULT_DAY_END_HOUR,
          forceSleep: draft.system.timeSystem?.forceSleep === true,
          onDayEnd: draft.system.timeSystem?.onDayEnd,
        });
      });
      rerender();
    }),
  ];
  if (enabled && timeSystem) {
    children.push(
      numberField("분/초 배속", "db-field-system-time-minutes-per-second", timeSystem.minutesPerRealSecond ?? DEFAULT_TIME_MINUTES_PER_REAL_SECOND, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            minutesPerRealSecond: Number.isFinite(value) && value > 0 ? value : DEFAULT_TIME_MINUTES_PER_REAL_SECOND,
          });
        }, "system:time:minutes-per-second");
      }),
      numberField("하루 시작 시", "db-field-system-time-day-start", timeSystem.dayStartHour ?? DEFAULT_DAY_START_HOUR, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            dayStartHour: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAY_START_HOUR,
          });
        }, "system:time:day-start");
      }),
      numberField("하루 종료 시", "db-field-system-time-day-end", timeSystem.dayEndHour ?? DEFAULT_DAY_END_HOUR, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            dayEndHour: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_DAY_END_HOUR,
          });
        }, "system:time:day-end");
      }),
      checkboxField("종료 시 강제 취침", "db-field-system-time-force-sleep", timeSystem.forceSleep === true, (checked) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            forceSleep: checked,
          });
        });
      }),
      selectField("하루 종료 공통 이벤트", "db-picker-system-time-on-day-end", timeSystem.onDayEnd ?? "", commonEvents, (value) => {
        updateSystem((draft) => {
          draft.system.timeSystem = normalizeTimeSystemConfig({
            ...draft.system.timeSystem,
            enabled: true,
            onDayEnd: emptyToUndefined(value),
          });
        });
      }),
    );
  }
  return rm2k3Fieldset("시간 시스템", children);
}

function typeChartFieldset(chart: TypeChartRecord | undefined, rerender: () => void): HTMLElement {
  const types = chart?.types ?? [];
  const typeInput = el("input", {
    attrs: { type: "text", placeholder: "fire, water, grass" },
    value: types.join(", "),
    dataset: { testid: "db-field-system-type-chart-types" },
  }) as HTMLInputElement;
  typeInput.addEventListener("change", () => {
    const nextTypes = parseTypes(typeInput.value);
    updateSystem((draft) => {
      const normalized = normalizeTypeChart({ types: nextTypes, multipliers: draft.system.typeChart?.multipliers ?? {} });
      if (normalized) draft.system.typeChart = normalized;
      else delete draft.system.typeChart;
    });
    rerender();
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
  updateSystem((draft) => {
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

function updateTitleScreen(mutator: (settings: ReturnType<typeof defaultTitleScreenSettings>) => void, snapshotKey?: string): void {
  updateSystem((draft) => {
    draft.system.titleScreen ??= defaultTitleScreenSettings();
    mutator(draft.system.titleScreen);
  }, snapshotKey);
}

// snapshotKey가 있으면 텍스트/숫자 연속 입력으로 보고 병합 스냅샷(recordCoalescedSnapshot)을,
// 없으면 이산 토글/선택으로 보고 매번 새 스냅샷(recordProjectSnapshot)을 남긴다 — 그래야
// 이 시스템 뷰의 모든 필드에서 Ctrl+Z가 똑같이 동작한다.
function updateSystem(mutator: (draft: ReturnType<typeof store.getCurrent>) => void, snapshotKey?: string): void {
  if (snapshotKey) recordCoalescedSnapshot(`db-utility:${snapshotKey}`);
  else recordProjectSnapshot();
  store.update(mutator, { scope: "system" });
}

function nextRewardPolicy(
  current: { participationOnly?: boolean; levelGapPenalty?: boolean } | undefined,
  patch: { participationOnly?: boolean; levelGapPenalty?: boolean },
): { participationOnly?: boolean; levelGapPenalty?: boolean } | undefined {
  const participationOnly = patch.participationOnly ?? current?.participationOnly === true;
  const levelGapPenalty = patch.levelGapPenalty ?? current?.levelGapPenalty === true;
  if (!participationOnly && !levelGapPenalty) return undefined;
  return {
    ...(participationOnly ? { participationOnly: true } : {}),
    ...(levelGapPenalty ? { levelGapPenalty: true } : {}),
  };
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
