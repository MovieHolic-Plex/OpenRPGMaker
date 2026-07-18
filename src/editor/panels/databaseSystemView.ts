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
import type { ActorRecord, BattleFlow, Project, TitleScreenSettings, TitleScreenTitleMode, TypeChartRecord } from "@/project/types";
import { el } from "@/util/dom";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import { listTitleMenuOptions } from "@/player/titleScreen";

const START_PARTY_SLOTS = 4;
const BATTLE_FLOW_OPTIONS = ["gauge", "strict"] as const satisfies readonly BattleFlow[];
const BATTLE_UI_STYLE_OPTIONS = listBattleSkinIds();
const TITLE_PRESENTATION_MODES = ["text", "graphic", "both"] as const satisfies readonly TitleScreenTitleMode[];

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
      el("div", {
        class: "db-title-workbench",
        dataset: { testid: "db-title-workbench" },
        children: [
          el("div", {
            class: "db-title-workbench-fields",
            children: [
              titleScreenDisplayFieldset(titleScreen, titleBackgroundResourceId, project.system.titleResourceId, rerender),
              titleScreenAudioFieldset(titleScreen, rerender),
              titleScreenMenuFieldset(titleScreen, rerender),
            ],
          }),
          titleScreenWorkbenchPreview(project, titleScreen, titleBackgroundResourceId),
        ],
      }),
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

function titleScreenDisplayFieldset(
  titleScreen: TitleScreenSettings,
  titleBackgroundResourceId: string | undefined,
  systemTitleResourceId: string | undefined,
  rerender: () => void,
): HTMLElement {
  const presentationMode = titleScreen.titleGraphic?.mode ?? "text";
  const showLogoFields = presentationMode === "graphic" || presentationMode === "both";
  const children: HTMLElement[] = [
    textControl("게임 타이틀", titleScreen.title, (value) => {
      updateTitleScreen((settings) => {
        settings.title = value;
      }, "system:title-screen:title");
      rerender();
    }, "db-field-title-screen-title"),
    selectLiteral(
      "타이틀 표시 방식",
      "db-field-title-screen-presentation",
      presentationMode,
      TITLE_PRESENTATION_MODES,
      (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { mode: value });
        });
        rerender();
      },
    ),
  ];

  if (showLogoFields) {
    children.push(
      resourcePickerControl({
        label: "타이틀 로고",
        resourceId: titleScreen.titleGraphic?.resourceId,
        kind: "title",
        testid: "db-field-title-screen-logo",
        allowClear: true,
        dialogTitle: "타이틀 로고",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleGraphic(settings, { resourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:logo");
        },
        rerender,
      }),
      numberField("로고 X", "db-field-title-screen-logo-x", titleScreen.titleGraphic?.x ?? titleScreen.layout.titleX, (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { x: clampStageCoordinate(value, 320) });
        }, "system:title-screen:logo-x");
        rerender();
      }),
      numberField("로고 Y", "db-field-title-screen-logo-y", titleScreen.titleGraphic?.y ?? titleScreen.layout.titleY, (value) => {
        updateTitleScreen((settings) => {
          patchTitleGraphic(settings, { y: clampStageCoordinate(value, 240) });
        }, "system:title-screen:logo-y");
        rerender();
      }),
    );
  }

  children.push(
    resourcePickerControl({
      label: "배경 리소스",
      resourceId: titleBackgroundResourceId,
      kind: "title",
      testid: "db-field-title-screen-background",
      allowClear: true,
      dialogTitle: "타이틀 배경",
      onChange: (result) => {
        // Background writes only touch titleScreen.backgroundResourceId — never clear system.titleResourceId.
        updateTitleScreen((settings) => {
          settings.backgroundResourceId = emptyToUndefined(result.resourceId);
        }, "system:title-screen:background");
      },
      rerender,
    }),
    el("code", {
      class: "db-title-workbench-system-title-id",
      text: `system.titleResourceId: ${systemTitleResourceId ?? "(없음)"}`,
      dataset: { testid: "db-title-workbench-system-title-id" },
    }),
    numberField("타이틀 X", "db-field-title-screen-title-x", titleScreen.layout.titleX, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.titleX = clampStageCoordinate(value, 320);
      }, "system:title-screen:title-x");
      rerender();
    }),
    numberField("타이틀 Y", "db-field-title-screen-title-y", titleScreen.layout.titleY, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.titleY = clampStageCoordinate(value, 240);
      }, "system:title-screen:title-y");
      rerender();
    }),
    numberField("선택지 X", "db-field-title-screen-menu-x", titleScreen.layout.menuX, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.menuX = clampStageCoordinate(value, 320);
      }, "system:title-screen:menu-x");
      rerender();
    }),
    numberField("선택지 Y", "db-field-title-screen-menu-y", titleScreen.layout.menuY, (value) => {
      updateTitleScreen((settings) => {
        settings.layout.menuY = clampStageCoordinate(value, 240);
      }, "system:title-screen:menu-y");
      rerender();
    }),
    checkboxField("조작 힌트 표시", "db-field-title-screen-show-input-hint", titleScreen.showInputHint !== false, (checked) => {
      updateTitleScreen((settings) => {
        settings.showInputHint = checked;
      });
      rerender();
    }),
  );

  return el("fieldset", {
    class: "rm2k3-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-display" },
    children: [el("legend", { text: "표시" }), ...children],
  });
}

function titleScreenAudioFieldset(titleScreen: TitleScreenSettings, rerender: () => void): HTMLElement {
  return el("fieldset", {
    class: "rm2k3-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-audio" },
    children: [
      el("legend", { text: "오디오" }),
      resourcePickerControl({
        label: "타이틀 BGM",
        resourceId: titleScreen.musicResourceId,
        kind: "music",
        testid: "db-field-title-screen-music",
        allowClear: true,
        dialogTitle: "타이틀 BGM",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            settings.musicResourceId = emptyToUndefined(result.resourceId);
          }, "system:title-screen:music");
        },
        rerender,
      }),
      resourcePickerControl({
        label: "커서 SE",
        resourceId: titleScreen.sounds?.cursorSeResourceId,
        kind: "sound",
        testid: "db-field-title-screen-se-cursor",
        allowClear: true,
        dialogTitle: "타이틀 커서 SE",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleSounds(settings, { cursorSeResourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:se-cursor");
        },
        rerender,
      }),
      resourcePickerControl({
        label: "결정 SE",
        resourceId: titleScreen.sounds?.confirmSeResourceId,
        kind: "sound",
        testid: "db-field-title-screen-se-confirm",
        allowClear: true,
        dialogTitle: "타이틀 결정 SE",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleSounds(settings, { confirmSeResourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:se-confirm");
        },
        rerender,
      }),
      resourcePickerControl({
        label: "취소 SE",
        resourceId: titleScreen.sounds?.cancelSeResourceId,
        kind: "sound",
        testid: "db-field-title-screen-se-cancel",
        allowClear: true,
        dialogTitle: "타이틀 취소 SE",
        onChange: (result) => {
          updateTitleScreen((settings) => {
            patchTitleSounds(settings, { cancelSeResourceId: emptyToUndefined(result.resourceId) });
          }, "system:title-screen:se-cancel");
        },
        rerender,
      }),
    ],
  });
}

function titleScreenMenuFieldset(titleScreen: TitleScreenSettings, rerender: () => void): HTMLElement {
  const visibility = titleScreen.menuVisibility ?? {
    newGame: true,
    continueGame: true,
    quit: true,
  };
  return el("fieldset", {
    class: "rm2k3-db-fieldset db-title-workbench-group",
    dataset: { testid: "db-title-workbench-menu" },
    children: [
      el("legend", { text: "메뉴" }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-new-game" },
        children: [
          textControl("새 게임", titleScreen.menuLabels.newGame, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.newGame = value;
            }, "system:title-screen:menu-new-game");
            rerender();
          }, "db-field-title-screen-new-game"),
          lockedCheckboxField("표시", "db-field-title-screen-visible-new-game", true),
        ],
      }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-continue" },
        children: [
          textControl("이어 하기", titleScreen.menuLabels.continueGame, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.continueGame = value;
            }, "system:title-screen:menu-continue");
            rerender();
          }, "db-field-title-screen-continue"),
          checkboxField("표시", "db-field-title-screen-visible-continue", visibility.continueGame !== false, (checked) => {
            updateTitleScreen((settings) => {
              settings.menuVisibility = {
                newGame: true,
                continueGame: checked,
                quit: settings.menuVisibility?.quit !== false,
              };
            });
            rerender();
          }),
        ],
      }),
      el("div", {
        class: "db-title-menu-option-row",
        dataset: { testid: "db-title-menu-option-quit" },
        children: [
          textControl("종료", titleScreen.menuLabels.quit, (value) => {
            updateTitleScreen((settings) => {
              settings.menuLabels.quit = value;
            }, "system:title-screen:menu-quit");
            rerender();
          }, "db-field-title-screen-quit"),
          checkboxField("표시", "db-field-title-screen-visible-quit", visibility.quit !== false, (checked) => {
            updateTitleScreen((settings) => {
              settings.menuVisibility = {
                newGame: true,
                continueGame: settings.menuVisibility?.continueGame !== false,
                quit: checked,
              };
            });
            rerender();
          }),
        ],
      }),
    ],
  });
}

function lockedCheckboxField(label: string, testid: string, checked: boolean): HTMLElement {
  const input = el("input", {
    attrs: { type: "checkbox", disabled: "true", ...(checked ? { checked: "true" } : {}) },
    dataset: { testid },
  }) as HTMLInputElement;
  input.checked = checked;
  input.disabled = true;
  return el("label", { class: "db-field db-field-locked", children: [el("span", { text: label }), input] });
}

function patchTitleGraphic(
  settings: TitleScreenSettings,
  patch: {
    readonly mode?: TitleScreenTitleMode;
    readonly resourceId?: string | undefined;
    readonly x?: number;
    readonly y?: number;
  },
): void {
  const current = settings.titleGraphic;
  const mode = patch.mode ?? current?.mode ?? "text";
  const resourceId = patch.resourceId !== undefined ? patch.resourceId : current?.resourceId;
  const x = patch.x ?? current?.x ?? settings.layout.titleX;
  const y = patch.y ?? current?.y ?? settings.layout.titleY;
  if (mode === "text" && !resourceId) {
    delete settings.titleGraphic;
    return;
  }
  settings.titleGraphic = {
    mode,
    ...(resourceId ? { resourceId } : {}),
    x: clampStageCoordinate(x, 320),
    y: clampStageCoordinate(y, 240),
  };
}

function patchTitleSounds(
  settings: TitleScreenSettings,
  patch: {
    readonly cursorSeResourceId?: string | undefined;
    readonly confirmSeResourceId?: string | undefined;
    readonly cancelSeResourceId?: string | undefined;
  },
): void {
  const current = settings.sounds ?? {};
  const next = {
    cursorSeResourceId: patch.cursorSeResourceId !== undefined ? patch.cursorSeResourceId : current.cursorSeResourceId,
    confirmSeResourceId: patch.confirmSeResourceId !== undefined ? patch.confirmSeResourceId : current.confirmSeResourceId,
    cancelSeResourceId: patch.cancelSeResourceId !== undefined ? patch.cancelSeResourceId : current.cancelSeResourceId,
  };
  const cleaned = {
    ...(next.cursorSeResourceId ? { cursorSeResourceId: next.cursorSeResourceId } : {}),
    ...(next.confirmSeResourceId ? { confirmSeResourceId: next.confirmSeResourceId } : {}),
    ...(next.cancelSeResourceId ? { cancelSeResourceId: next.cancelSeResourceId } : {}),
  };
  if (Object.keys(cleaned).length === 0) delete settings.sounds;
  else settings.sounds = cleaned;
}

function titleScreenWorkbenchPreview(
  project: Project,
  titleScreen: TitleScreenSettings,
  backgroundResourceId: string | undefined,
): HTMLElement {
  const bgUrl = resolveAssetResourceUrl(backgroundResourceId, { project });
  const stage = el("div", {
    class: "db-title-workbench-stage",
    dataset: { testid: "db-title-workbench-stage" },
    attrs: bgUrl
      ? {
          style: [
            `background-image:url("${bgUrl}")`,
            "background-size:100% 100%",
            "background-repeat:no-repeat",
            "background-position:center",
            "image-rendering:pixelated",
          ].join(";"),
        }
      : {},
  });

  const presentationMode = titleScreen.titleGraphic?.mode ?? "text";
  const showText = presentationMode === "text" || presentationMode === "both" || !titleScreen.titleGraphic;
  const showLogo = (presentationMode === "graphic" || presentationMode === "both") && !!titleScreen.titleGraphic?.resourceId;

  if (showText) {
    const titleNode = el("div", {
      class: "db-title-workbench-title",
      text: titleScreen.title || "(제목 없음)",
      dataset: { testid: "db-title-workbench-title-text" },
    });
    titleNode.style.left = `${(titleScreen.layout.titleX / 320) * 100}%`;
    titleNode.style.top = `${(titleScreen.layout.titleY / 240) * 100}%`;
    stage.append(titleNode);
  }

  if (showLogo && titleScreen.titleGraphic) {
    const logo = titleScreen.titleGraphic;
    const logoUrl = resolveAssetResourceUrl(logo.resourceId, { project });
    const logoNode = el("div", {
      class: "db-title-workbench-logo",
      dataset: {
        testid: "db-title-workbench-logo",
        ...(logo.resourceId ? { titleLogoResource: logo.resourceId } : {}),
      },
      attrs: logoUrl
        ? {
            style: [
              `background-image:url("${logoUrl}")`,
              "background-size:contain",
              "background-repeat:no-repeat",
              "background-position:center",
              "image-rendering:pixelated",
            ].join(";"),
          }
        : {},
    });
    logoNode.style.left = `${(logo.x / 320) * 100}%`;
    logoNode.style.top = `${(logo.y / 240) * 100}%`;
    stage.append(logoNode);
  }

  // graphic mode without logo still needs a stable title node for layout tests.
  if (!showText && !showLogo) {
    const fallback = el("div", {
      class: "db-title-workbench-title",
      text: titleScreen.title || "(제목 없음)",
      dataset: { testid: "db-title-workbench-title-text" },
    });
    fallback.style.left = `${(titleScreen.layout.titleX / 320) * 100}%`;
    fallback.style.top = `${(titleScreen.layout.titleY / 240) * 100}%`;
    stage.append(fallback);
  }

  const visibleOptions = listTitleMenuOptions(titleScreen);
  const menu = el("div", {
    class: "db-title-workbench-menu",
    dataset: { testid: "db-title-workbench-menu-preview" },
    children: visibleOptions.map((option) =>
      el("div", {
        class: "db-title-workbench-menu-item",
        text: option.label,
        dataset: { titleMenuOption: option.id },
      }),
    ),
  });
  menu.style.left = `${(titleScreen.layout.menuX / 320) * 100}%`;
  menu.style.top = `${(titleScreen.layout.menuY / 240) * 100}%`;
  stage.append(menu);

  const musicId = titleScreen.musicResourceId;
  const play = el("button", {
    class: "btn small",
    text: "BGM 재생",
    attrs: { type: "button", ...(musicId ? {} : { disabled: "true" }) },
    dataset: { testid: "db-title-bgm-play" },
    on: {
      click: () => {
        if (!musicId) return;
        playAudioCommand({ resourceId: musicId, loop: true }, project);
      },
    },
  });
  const stop = el("button", {
    class: "btn small",
    text: "BGM 정지",
    attrs: { type: "button" },
    dataset: { testid: "db-title-bgm-stop" },
    on: {
      click: () => {
        stopAudioCommand();
      },
    },
  });
  return el("div", {
    class: "db-title-workbench-preview",
    dataset: { testid: "db-title-workbench-preview" },
    children: [
      el("span", { class: "db-title-workbench-preview-label", text: "라이브 프리뷰" }),
      stage,
      el("div", {
        class: "db-title-workbench-audio",
        children: [
          play,
          stop,
          el("code", {
            class: "db-title-workbench-music-id",
            text: musicId ?? "(BGM 없음)",
            dataset: { testid: "db-title-workbench-music-id" },
          }),
        ],
      }),
    ],
  });
}
