import { openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command, M2CommandValue } from "@/project/types";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import {
  actorPicker,
  facesetIconOf,
  imageIconOf,
  recordIconElement,
  recordPickerWithPreview,
  segmentedSelect,
  type SegmentOption,
} from "./recordPicker";
import { faceDisplayModeOf, renderFacesetCrop, renderFacesetIndexGrid } from "./facesetPreview";
import type { CommandEditContext } from "./types";

type M2Command = Extract<Command, { kind: "m2Command" }>;

const ACTOR_TARGET_SEGMENTS = [
  { value: "party", key: "party", label: "파티 전체" },
  { value: "actor", key: "actor", label: "주인공" },
] as const satisfies readonly SegmentOption<"party" | "actor">[];

const STATE_OP_SEGMENTS = [
  { value: "add", key: "add", label: "부여" },
  { value: "remove", key: "remove", label: "해제" },
] as const satisfies readonly SegmentOption<"add" | "remove">[];

const DAMAGE_OP_SEGMENTS = [
  { value: "add", key: "add", label: "데미지" },
  { value: "remove", key: "remove", label: "회복" },
] as const satisfies readonly SegmentOption<"add" | "remove">[];

const PARAM_OP_SEGMENTS = [
  { value: "add", key: "add", label: "＋" },
  { value: "remove", key: "remove", label: "−" },
  { value: "set", key: "set", label: "＝" },
] as const satisfies readonly SegmentOption<"add" | "remove" | "set">[];

const VALUE_SOURCE_SEGMENTS = [
  { value: "number", key: "number", label: "숫자" },
  { value: "variable", key: "variable", label: "변수" },
] as const satisfies readonly SegmentOption<"number" | "variable">[];

const PARAM_CHIPS = [
  { id: "maxHp", label: "최대 HP" },
  { id: "maxMp", label: "최대 MP" },
  { id: "attack", label: "공격" },
  { id: "defense", label: "방어" },
  { id: "mind", label: "정신" },
  { id: "agility", label: "민첩" },
] as const;

/** 스크린샷 7종 + 능력치 변경 전용 리치 폼. 해당 없으면 undefined → 일반 M2 폼. */
export function renderActorM2CommandBody(
  context: CommandEditContext,
  cmd: M2Command
): HTMLElement | undefined {
  const entry = m2CommandById(cmd.commandId);
  if (!entry) return undefined;
  switch (entry.title) {
    case "Change Parameters":
      return changeParametersCommandBody(context, cmd);
    case "Change State":
      return changeStateCommandBody(context, cmd);
    case "Damage Processing":
      return damageProcessingCommandBody(context, cmd);
    case "Change Actor Name":
      return changeActorNameCommandBody(context, cmd, "name");
    case "Change Actor Nickname":
      return changeActorNameCommandBody(context, cmd, "nickname");
    case "Change Actor Graphic":
      return changeActorGraphicCommandBody(context, cmd);
    case "Change Actor Faceset":
      return changeActorFacesetCommandBody(context, cmd);
    case "Change Actor Class":
      return changeActorClassCommandBody(context, cmd);
    default:
      return undefined;
  }
}

function changeParametersCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("change-parameters-command-body", "change-parameters-command-body");
  const project = store.getCurrent();
  const actors = project.database.actors;
  const targetMode = targetModeOf(String(cmd.fields.target ?? ""));
  const target = segmentedSelect({
    options: ACTOR_TARGET_SEGMENTS,
    value: targetMode,
    testid: "change-parameters-target-mode",
    ariaLabel: "대상",
  });
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: targetMode === "actor" ? String(cmd.fields.target ?? "") : "",
    placeholder: "주인공 선택",
    testid: "change-parameters-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => record.classId,
  });
  const parameter = String(cmd.fields.parameter ?? "maxHp");
  const operation = segmentedSelect({
    options: PARAM_OP_SEGMENTS,
    value: opOf(cmd.fields.operation, "add"),
    testid: "change-parameters-operation",
    ariaLabel: "조작",
  });
  const source = valueSourceControls(cmd, {
    testidBase: "change-parameters",
    defaultNumber: 1,
  });
  const chips = el("div", {
    class: "change-parameters-param-chips actor-m2-chip-grid",
    dataset: { testid: "change-parameters-param-chips" },
  });
  const preview = el("div", {
    class: "change-parameters-preview actor-m2-preview",
    dataset: { testid: "change-parameters-preview" },
  });
  let currentParameter = PARAM_CHIPS.some((chip) => chip.id === parameter) ? parameter : "maxHp";

  const renderChips = () => {
    chips.replaceChildren();
    for (const chip of PARAM_CHIPS) {
      chips.append(
        el("button", {
          class: "btn small actor-m2-chip" + (chip.id === currentParameter ? " is-active" : ""),
          text: chip.label,
          attrs: { type: "button" },
          dataset: { testid: `change-parameters-param-${chip.id}` },
          on: {
            click: () => {
              currentParameter = chip.id;
              renderChips();
              commit();
            },
          },
        })
      );
    }
  };

  const commit = () => {
    const amount = source.read();
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: target.select.value === "party" ? "party" : actor.select.value,
        parameter: currentParameter,
        operation: operation.select.value,
        value: amount.numberValue,
        valueSource: amount.source,
        valueVariableId: amount.variableId,
      },
    });
    renderPreview();
  };

  const renderPreview = () => {
    const who =
      target.select.value === "party"
        ? "파티 전체"
        : actors.find((entry) => entry.id === actor.select.value)?.name ?? "주인공";
    const paramLabel = PARAM_CHIPS.find((chip) => chip.id === currentParameter)?.label ?? currentParameter;
    const opLabel =
      operation.select.value === "remove" ? "−" : operation.select.value === "set" ? "＝" : "＋";
    const amount = source.read();
    const amountLabel =
      amount.source === "variable"
        ? `변수 ${variableLabel(amount.variableId)}`
        : String(amount.numberValue);
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: `${who} · ${paramLabel} ${opLabel}${amountLabel}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "능력치 변경은 영구 보정입니다. 현재 HP/MP 회복이 필요하면 HP/MP 변경 또는 데미지 처리를 쓰세요.",
      })
    );
  };

  const actorField = fieldBlock("주인공", actor.root, "change-parameters-actor-field");
  const syncVisibility = () => {
    actorField.hidden = target.select.value === "party";
    source.syncVisibility();
  };

  target.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  actor.select.addEventListener("change", commit);
  operation.select.addEventListener("change", commit);
  source.bind(commit);
  renderChips();
  syncVisibility();
  renderPreview();

  wrap.append(
    intentCard(
      "능력치 변경",
      "최대 HP/MP·공격 등 영구 보정을 더하거나 줄이거나 대입합니다. 값은 숫자 또는 변수.",
      "change-parameters-intent"
    ),
    el("div", {
      class: "change-parameters-layout actor-m2-layout",
      children: [
        el("div", {
          class: "change-parameters-main actor-m2-main",
          children: [
            fieldBlock("대상", target.root),
            actorField,
            fieldBlock("능력치", chips),
            fieldBlock("조작", operation.root),
            fieldBlock("값 소스", source.sourceRoot),
            source.numberField,
            source.variableField,
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function changeStateCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("actor-m2-command-body", "change-state-command-body");
  const project = store.getCurrent();
  const actors = project.database.actors;
  const states = project.database.states;
  const targetMode = targetModeOf(String(cmd.fields.target ?? "party"));
  const target = segmentedSelect({
    options: ACTOR_TARGET_SEGMENTS,
    value: targetMode,
    testid: "change-state-target-mode",
    ariaLabel: "대상",
  });
  const actor = actorPicker({
    project,
    selectedId: targetMode === "actor" ? String(cmd.fields.target ?? "") : "",
    testid: "change-state-actor-select",
  });
  const operation = segmentedSelect({
    options: STATE_OP_SEGMENTS,
    value: opOf(cmd.fields.operation, "add") === "remove" ? "remove" : "add",
    testid: "change-state-operation",
    ariaLabel: "조작",
  });
  let currentStateId = String(cmd.fields.value ?? "").trim();
  if (currentStateId && !states.some((entry) => entry.id === currentStateId)) {
    currentStateId = states[0]?.id ?? "";
  } else if (!currentStateId) {
    currentStateId = states[0]?.id ?? "";
  }
  const stateSelect = el("select", {
    class: "record-browser-hidden-select",
    dataset: { testid: "change-state-state-select" },
    attrs: { "aria-hidden": "true", tabindex: "-1" },
  }) as HTMLSelectElement;
  stateSelect.append(el("option", { text: "(상태 선택)", attrs: { value: "" } }));
  for (const [index, record] of states.entries()) {
    stateSelect.append(
      el("option", {
        text: `${String(index + 1).padStart(4, "0")}: ${record.name}`,
        attrs: { value: record.id },
      })
    );
  }
  stateSelect.value = currentStateId;
  const chips = el("div", {
    class: "actor-m2-chip-grid",
    dataset: { testid: "change-state-grid" },
  });
  const preview = el("div", {
    class: "actor-m2-preview",
    dataset: { testid: "change-state-preview" },
  });
  const actorField = fieldBlock("주인공", actor.root);

  const renderChips = () => {
    chips.replaceChildren();
    for (const state of states) {
      chips.append(
        el("button", {
          class: "btn small actor-m2-chip" + (state.id === currentStateId ? " is-active" : ""),
          text: state.name,
          attrs: { type: "button", title: state.name },
          dataset: { testid: `change-state-chip-${state.id}` },
          on: {
            click: () => {
              currentStateId = state.id;
              stateSelect.value = state.id;
              renderChips();
              commit();
            },
          },
        })
      );
    }
    if (states.length === 0) {
      chips.append(
        el("span", {
          class: "actor-m2-preview-note",
          text: "등록된 상태가 없습니다.",
        })
      );
    }
  };

  const commit = () => {
    currentStateId = stateSelect.value;
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: target.select.value === "party" ? "party" : actor.select.value,
        operation: operation.select.value,
        value: currentStateId,
      },
    });
    renderPreview();
  };

  const renderPreview = () => {
    const who =
      target.select.value === "party"
        ? "파티 전체"
        : actors.find((entry) => entry.id === actor.select.value)?.name ?? "주인공";
    const stateName = states.find((entry) => entry.id === currentStateId)?.name ?? "(상태 선택)";
    const opLabel = operation.select.value === "remove" ? "해제" : "부여";
    preview.replaceChildren(
      el("p", { class: "actor-m2-preview-line", text: `${who} · ${stateName} ${opLabel}` }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "독·수면 등 상태 이상을 붙이거나 뗍니다. 전투/필드 세션 actorStateIds 에 반영됩니다.",
      })
    );
  };

  const syncVisibility = () => {
    actorField.hidden = target.select.value === "party";
  };
  target.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  actor.select.addEventListener("change", commit);
  operation.select.addEventListener("change", commit);
  stateSelect.addEventListener("change", () => {
    currentStateId = stateSelect.value;
    renderChips();
    commit();
  });
  renderChips();
  syncVisibility();
  renderPreview();

  wrap.append(
    intentCard("상태 변경", "상태 이상을 부여하거나 해제합니다.", "change-state-intent"),
    el("div", {
      class: "actor-m2-layout",
      children: [
        el("div", {
          class: "actor-m2-main",
          children: [
            fieldBlock("대상", target.root),
            actorField,
            fieldBlock("조작", operation.root),
            fieldBlock("상태", chips),
            stateSelect,
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function damageProcessingCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("actor-m2-command-body", "damage-processing-command-body");
  const project = store.getCurrent();
  const actors = project.database.actors;
  const targetMode = targetModeOf(String(cmd.fields.target ?? "party"));
  const target = segmentedSelect({
    options: ACTOR_TARGET_SEGMENTS,
    value: targetMode,
    testid: "damage-processing-target-mode",
    ariaLabel: "대상",
  });
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: targetMode === "actor" ? String(cmd.fields.target ?? "") : "",
    placeholder: "주인공 선택",
    testid: "damage-processing-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => record.classId,
  });
  const operation = segmentedSelect({
    options: DAMAGE_OP_SEGMENTS,
    value: opOf(cmd.fields.operation, "add") === "remove" ? "remove" : "add",
    testid: "damage-processing-operation",
    ariaLabel: "조작",
  });
  const source = valueSourceControls(cmd, {
    testidBase: "damage-processing",
    defaultNumber: 10,
  });
  const presets = el("div", {
    class: "actor-m2-presets",
    dataset: { testid: "damage-processing-presets" },
  });
  for (const preset of [
    { id: "10", label: "10", value: 10 },
    { id: "25", label: "25", value: 25 },
    { id: "50", label: "50", value: 50 },
    { id: "100", label: "100", value: 100 },
  ] as const) {
    presets.append(
      el("button", {
        class: "btn small",
        text: preset.label,
        attrs: { type: "button" },
        dataset: { testid: `damage-processing-preset-${preset.id}` },
        on: {
          click: () => {
            source.setNumber(preset.value);
            commit();
          },
        },
      })
    );
  }
  const preview = el("div", {
    class: "actor-m2-preview",
    dataset: { testid: "damage-processing-preview" },
  });
  const actorField = fieldBlock("주인공", actor.root);

  const commit = () => {
    const amount = source.read();
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: target.select.value === "party" ? "party" : actor.select.value,
        operation: operation.select.value,
        value: amount.numberValue,
        valueSource: amount.source,
        valueVariableId: amount.variableId,
      },
    });
    renderPreview();
  };

  const renderPreview = () => {
    const who =
      target.select.value === "party"
        ? "파티 전체"
        : actors.find((entry) => entry.id === actor.select.value)?.name ?? "주인공";
    const opLabel = operation.select.value === "remove" ? "회복" : "데미지";
    const amount = source.read();
    const amountLabel =
      amount.source === "variable"
        ? `변수 ${variableLabel(amount.variableId)}`
        : `${amount.numberValue}`;
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: `${who} · HP ${opLabel} ${amountLabel}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "현재 HP에 즉시 반영됩니다. 변수 소스를 쓰면 실행 시점의 변수 값을 사용합니다.",
      })
    );
  };

  const syncVisibility = () => {
    actorField.hidden = target.select.value === "party";
    source.syncVisibility();
  };
  target.select.addEventListener("change", () => {
    syncVisibility();
    commit();
  });
  actor.select.addEventListener("change", commit);
  operation.select.addEventListener("change", commit);
  source.bind(commit);
  syncVisibility();
  renderPreview();

  wrap.append(
    intentCard(
      "데미지 처리",
      "현재 HP를 깎거나 회복합니다. 숫자 고정값 또는 변수 값을 쓸 수 있습니다.",
      "damage-processing-intent"
    ),
    el("div", {
      class: "actor-m2-layout",
      children: [
        el("div", {
          class: "actor-m2-main",
          children: [
            fieldBlock("대상", target.root),
            actorField,
            fieldBlock("조작", operation.root),
            fieldBlock("값 소스", source.sourceRoot),
            source.numberField,
            source.variableField,
            fieldBlock("빠른 값", presets),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function changeActorNameCommandBody(
  context: CommandEditContext,
  cmd: M2Command,
  mode: "name" | "nickname"
): HTMLElement {
  const wrap = shell(
    "actor-m2-command-body",
    mode === "name" ? "change-actor-name-command-body" : "change-actor-nickname-command-body"
  );
  const project = store.getCurrent();
  const actors = project.database.actors;
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: String(cmd.fields.target ?? ""),
    placeholder: "주인공 선택",
    testid: mode === "name" ? "change-actor-name-actor-select" : "change-actor-nickname-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => record.name,
  });
  const text = el("input", {
    class: "actor-m2-text-input",
    attrs: {
      type: "text",
      maxlength: mode === "name" ? "12" : "16",
      placeholder: mode === "name" ? "새 이름" : "새 별명",
    },
    value: String(cmd.fields.value ?? ""),
    dataset: {
      testid: mode === "name" ? "change-actor-name-value-input" : "change-actor-nickname-value-input",
    },
  }) as HTMLInputElement;
  const preview = el("div", {
    class: "actor-m2-preview",
    dataset: {
      testid: mode === "name" ? "change-actor-name-preview" : "change-actor-nickname-preview",
    },
  });

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: actor.select.value,
        value: text.value,
      },
    });
    renderPreview();
  };

  const renderPreview = () => {
    const record = actors.find((entry) => entry.id === actor.select.value);
    const label = mode === "name" ? "이름" : "별명";
    const next = text.value.trim() || `(${label} 비움)`;
    preview.replaceChildren(
      el("div", {
        class: "actor-m2-preview-actor",
        children: [
          record
            ? recordIconElement(facesetIconOf(project, record.faceResourceId), record.name)
            : el("span", { text: "—" }),
          el("div", {
            class: "actor-m2-preview-copy",
            children: [
              el("p", {
                class: "actor-m2-preview-line",
                text: record ? `${record.name} → ${next}` : `주인공 선택 · ${next}`,
              }),
              el("p", {
                class: "actor-m2-preview-note",
                text:
                  mode === "name"
                    ? "대화 \\n[n] / 메뉴 표시 이름에 반영됩니다."
                    : "별명은 상태 창·일부 대화 치환에 쓰입니다.",
              }),
            ],
          }),
        ],
      })
    );
  };

  actor.select.addEventListener("change", commit);
  text.addEventListener("change", commit);
  text.addEventListener("input", renderPreview);
  renderPreview();

  wrap.append(
    intentCard(
      mode === "name" ? "주인공 이름 변경" : "주인공 별명 변경",
      mode === "name"
        ? "선택한 주인공의 표시 이름을 바꿉니다."
        : "선택한 주인공의 별명을 바꿉니다.",
      mode === "name" ? "change-actor-name-intent" : "change-actor-nickname-intent"
    ),
    el("div", {
      class: "actor-m2-layout",
      children: [
        el("div", {
          class: "actor-m2-main",
          children: [
            fieldBlock("주인공", actor.root),
            fieldBlock(mode === "name" ? "이름" : "별명", text),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function changeActorGraphicCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("actor-m2-command-body", "change-actor-graphic-command-body");
  const project = store.getCurrent();
  const actors = project.database.actors;
  let resourceId = String(cmd.fields.value ?? "").trim();
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: String(cmd.fields.target ?? ""),
    placeholder: "주인공 선택",
    testid: "change-actor-graphic-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => record.characterResourceId ?? null,
  });
  const resourceSelect = charsetResourceSelect(resourceId, "change-actor-graphic-resource-select");
  const preview = el("div", {
    class: "actor-m2-preview",
    dataset: { testid: "change-actor-graphic-preview" },
  });
  const pickBtn = el("button", {
    class: "btn small",
    text: "리소스 선택…",
    attrs: { type: "button" },
    dataset: { testid: "change-actor-graphic-resource-picker" },
    on: {
      click: () => {
        openDatabaseResourcePickerDialog({
          kind: "charset",
          title: "캐릭터 그래픽 선택",
          currentId: resourceId,
          onConfirm: (result) => {
            resourceId = result.resourceId;
            resourceSelect.value = resourceId;
            commit();
          },
        });
      },
    },
  });

  const commit = () => {
    resourceId = resourceSelect.value.trim();
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: actor.select.value,
        value: resourceId,
      },
    });
    renderPreview();
  };

  const renderPreview = () => {
    const record = actors.find((entry) => entry.id === actor.select.value);
    const icon = imageIconOf(project, resourceId || undefined);
    preview.replaceChildren(
      el("div", {
        class: "actor-m2-preview-actor",
        children: [
          recordIconElement(icon, resourceId || "선택 없음"),
          el("div", {
            class: "actor-m2-preview-copy",
            children: [
              el("p", {
                class: "actor-m2-preview-line",
                text: record
                  ? `${record.name} 맵 그래픽 → ${resourceId || "(선택 없음)"}`
                  : `주인공 선택 · ${resourceId || "(선택 없음)"}`,
              }),
              el("p", {
                class: "actor-m2-preview-note",
                text: "필드 캐릭터 스프라이트(charset) 오버라이드. 얼굴 그래픽과 별개입니다.",
              }),
            ],
          }),
        ],
      })
    );
  };

  actor.select.addEventListener("change", commit);
  resourceSelect.addEventListener("change", commit);
  renderPreview();

  wrap.append(
    intentCard(
      "주인공 그래픽 변경",
      "맵에서 보이는 캐릭터 시트를 바꿉니다.",
      "change-actor-graphic-intent"
    ),
    el("div", {
      class: "actor-m2-layout",
      children: [
        el("div", {
          class: "actor-m2-main",
          children: [
            fieldBlock("주인공", actor.root),
            fieldBlock(
              "캐릭터 그래픽",
              el("div", {
                class: "actor-m2-inline",
                children: [resourceSelect, pickBtn],
              })
            ),
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function changeActorFacesetCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("actor-m2-command-body", "change-actor-faceset-command-body");
  const project = store.getCurrent();
  const actors = project.database.actors;
  let resourceId = String(cmd.fields.value ?? "").trim();
  let faceIndex = Math.max(0, Math.min(15, Math.trunc(Number(cmd.fields.faceIndex ?? 0)) || 0));
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: String(cmd.fields.target ?? ""),
    placeholder: "주인공 선택",
    testid: "change-actor-faceset-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => record.faceResourceId ?? null,
  });
  const resourceSelect = facesetResourceSelect(resourceId, "change-actor-faceset-resource-select");
  const facePreview = el("div", {
    class: "actor-m2-faceset-preview",
    dataset: { testid: "change-actor-faceset-face-preview" },
  });
  const faceGrid = el("div", {
    class: "actor-m2-faceset-grid",
    dataset: { testid: "change-actor-faceset-face-grid" },
  });
  const preview = el("div", {
    class: "actor-m2-preview",
    dataset: { testid: "change-actor-faceset-preview" },
  });
  const pickBtn = el("button", {
    class: "btn small",
    text: "리소스 선택…",
    attrs: { type: "button" },
    dataset: { testid: "change-actor-faceset-resource-picker" },
    on: {
      click: () => {
        openDatabaseResourcePickerDialog({
          kind: "faceset",
          title: "얼굴 그래픽 선택",
          currentId: resourceId,
          onConfirm: (result) => {
            resourceId = result.resourceId;
            resourceSelect.value = resourceId;
            faceIndex = Math.max(0, Math.min(15, Math.trunc(Number(result.faceIndex ?? 0)) || 0));
            commit();
          },
        });
      },
    },
  });

  const commit = () => {
    resourceId = resourceSelect.value.trim();
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: actor.select.value,
        value: resourceId,
        faceIndex,
      },
    });
    renderFaceUi();
  };

  const renderFaceUi = () => {
    facePreview.replaceChildren();
    faceGrid.replaceChildren();
    if (resourceId) {
      facePreview.append(
        renderFacesetCrop({
          resourceId,
          faceIndex,
          displaySize: 96,
        })
      );
      faceGrid.append(
        renderFacesetIndexGrid({
          resourceId,
          faceIndex,
          onSelect: (index) => {
            faceIndex = Math.max(0, Math.min(15, Math.trunc(index) || 0));
            commit();
          },
        })
      );
    } else {
      facePreview.append(el("span", { class: "rich-preview-hint", text: "얼굴 리소스를 선택하세요." }));
    }
    const record = actors.find((entry) => entry.id === actor.select.value);
    const mode = faceDisplayModeOf(resourceId);
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: record
          ? `${record.name} 얼굴 → ${resourceId || "(선택 없음)"} #${faceIndex + 1}`
          : `주인공 선택 · ${resourceId || "(선택 없음)"}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text:
          mode === "bust"
            ? "흉상(-bust) 리소스입니다. 대화 창 옆 큰 초상으로 표시됩니다."
            : "faceset 인덱스 칸을 고르면 해당 얼굴이 저장됩니다.",
      })
    );
  };

  actor.select.addEventListener("change", commit);
  resourceSelect.addEventListener("change", () => {
    faceIndex = 0;
    commit();
  });
  renderFaceUi();

  wrap.append(
    intentCard(
      "주인공 얼굴 변경",
      "대화/메뉴에 쓰이는 얼굴 그래픽을 바꿉니다.",
      "change-actor-faceset-intent"
    ),
    el("div", {
      class: "actor-m2-layout",
      children: [
        el("div", {
          class: "actor-m2-main",
          children: [
            fieldBlock("주인공", actor.root),
            fieldBlock(
              "얼굴 그래픽",
              el("div", {
                class: "actor-m2-inline",
                children: [resourceSelect, pickBtn],
              })
            ),
            facePreview,
            faceGrid,
          ],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function changeActorClassCommandBody(context: CommandEditContext, cmd: M2Command): HTMLElement {
  const wrap = shell("actor-m2-command-body", "change-actor-class-command-body");
  const project = store.getCurrent();
  const actors = project.database.actors;
  const classes = project.database.classes;
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: String(cmd.fields.target ?? ""),
    placeholder: "주인공 선택",
    testid: "change-actor-class-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => {
      const klass = classes.find((entry) => entry.id === record.classId);
      return klass?.name ?? record.classId;
    },
  });
  const klass = recordPickerWithPreview({
    records: classes,
    selectedId: String(cmd.fields.value ?? ""),
    placeholder: "직업 선택",
    testid: "change-actor-class-class-select",
    iconOf: () => null,
    subtitleOf: (record) => record.id,
  });
  const preview = el("div", {
    class: "actor-m2-preview",
    dataset: { testid: "change-actor-class-preview" },
  });

  const commit = () => {
    context.actions.replaceCommand(context.path, {
      ...cmd,
      fields: {
        ...cmd.fields,
        target: actor.select.value,
        value: klass.select.value,
      },
    });
    renderPreview();
  };

  const renderPreview = () => {
    const record = actors.find((entry) => entry.id === actor.select.value);
    const from =
      classes.find((entry) => entry.id === record?.classId)?.name ?? record?.classId ?? "—";
    const to = classes.find((entry) => entry.id === klass.select.value)?.name ?? "(직업 선택)";
    preview.replaceChildren(
      el("p", {
        class: "actor-m2-preview-line",
        text: record ? `${record.name}: ${from} → ${to}` : `주인공 선택 · ${to}`,
      }),
      el("p", {
        class: "actor-m2-preview-note",
        text: "런타임 classOverrides 로 반영됩니다. 성장 곡선/전투 커맨드는 직업 DB를 따릅니다.",
      })
    );
  };

  actor.select.addEventListener("change", commit);
  klass.select.addEventListener("change", commit);
  renderPreview();

  wrap.append(
    intentCard("주인공 직업 변경", "선택한 주인공의 직업을 바꿉니다.", "change-actor-class-intent"),
    el("div", {
      class: "actor-m2-layout",
      children: [
        el("div", {
          class: "actor-m2-main",
          children: [fieldBlock("주인공", actor.root), fieldBlock("직업", klass.root)],
        }),
        preview,
      ],
    })
  );
  return wrap;
}

function valueSourceControls(
  cmd: M2Command,
  options: { readonly testidBase: string; readonly defaultNumber: number }
): {
  readonly sourceRoot: HTMLElement;
  readonly numberField: HTMLElement;
  readonly variableField: HTMLElement;
  readonly read: () => { source: "number" | "variable"; numberValue: number; variableId: string };
  readonly setNumber: (value: number) => void;
  readonly syncVisibility: () => void;
  readonly bind: (onChange: () => void) => void;
} {
  const initialSource =
    String(cmd.fields.valueSource ?? "") === "variable" ||
    Boolean(String(cmd.fields.valueVariableId ?? "").trim())
      ? "variable"
      : "number";
  let variableId = String(cmd.fields.valueVariableId ?? "").trim();
  const source = segmentedSelect({
    options: VALUE_SOURCE_SEGMENTS,
    value: initialSource,
    testid: `${options.testidBase}-value-source`,
    ariaLabel: "값 소스",
  });
  const numberInput = el("input", {
    attrs: { type: "number", min: "0", step: "1" },
    value: String(
      typeof cmd.fields.value === "number"
        ? cmd.fields.value
        : Number(cmd.fields.value) || options.defaultNumber
    ),
    dataset: { testid: `${options.testidBase}-value-input` },
  }) as HTMLInputElement;
  let outerOnChange: (() => void) | null = null;
  const variable = databasePicker(
    "variable",
    variableId,
    (nextId) => {
      variableId = nextId;
      outerOnChange?.();
    },
    `${options.testidBase}-value-variable`
  );
  const numberField = fieldBlock("값", numberInput, `${options.testidBase}-number-field`);
  const variableField = fieldBlock("변수", variable, `${options.testidBase}-variable-field`);

  const syncVisibility = () => {
    const useVariable = source.select.value === "variable";
    numberField.hidden = useVariable;
    variableField.hidden = !useVariable;
  };

  return {
    sourceRoot: source.root,
    numberField,
    variableField,
    read: () => ({
      source: source.select.value === "variable" ? "variable" : "number",
      numberValue: Math.max(0, Math.trunc(Number(numberInput.value) || 0)),
      variableId,
    }),
    setNumber: (value) => {
      source.select.value = "number";
      numberInput.value = String(value);
      syncVisibility();
    },
    syncVisibility,
    bind: (onChange) => {
      outerOnChange = onChange;
      source.select.addEventListener("change", () => {
        syncVisibility();
        onChange();
      });
      numberInput.addEventListener("change", onChange);
      numberInput.addEventListener("input", onChange);
    },
  };
}

function charsetResourceSelect(currentId: string, testId: string): HTMLSelectElement {
  const project = store.getCurrent();
  const select = el("select", {
    dataset: { testid: testId },
    attrs: { "aria-label": "캐릭터 그래픽" },
  }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택 없음)", attrs: { value: "" } }));
  const ids = new Set<string>();
  for (const profile of project.resourceProfiles) {
    if (profile.kind !== "charset" || !profile.assetId || ids.has(profile.assetId)) continue;
    ids.add(profile.assetId);
    select.append(
      el("option", {
        text: `${profile.name} (${profile.assetId})`,
        attrs: { value: profile.assetId },
      })
    );
  }
  for (const asset of Object.values(project.assets.uploaded)) {
    if ((asset.kind !== "sprite" && asset.kind !== "charset") || ids.has(asset.id)) continue;
    ids.add(asset.id);
    select.append(el("option", { text: `${asset.name} (${asset.id})`, attrs: { value: asset.id } }));
  }
  if (currentId && !ids.has(currentId)) {
    select.append(el("option", { text: `현재 값: ${currentId}`, attrs: { value: currentId } }));
  }
  select.value = currentId;
  return select;
}

function facesetResourceSelect(currentId: string, testId: string): HTMLSelectElement {
  const project = store.getCurrent();
  const select = el("select", {
    dataset: { testid: testId },
    attrs: { "aria-label": "얼굴 그래픽" },
  }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택 없음)", attrs: { value: "" } }));
  const ids = new Set<string>();
  for (const profile of project.resourceProfiles) {
    if (profile.kind !== "faceset" || !profile.assetId || ids.has(profile.assetId)) continue;
    ids.add(profile.assetId);
    select.append(
      el("option", {
        text: `${profile.name} (${profile.assetId})`,
        attrs: { value: profile.assetId },
      })
    );
  }
  for (const asset of Object.values(project.assets.uploaded)) {
    if (asset.kind !== "faceset" || ids.has(asset.id)) continue;
    ids.add(asset.id);
    select.append(el("option", { text: `${asset.name} (${asset.id})`, attrs: { value: asset.id } }));
  }
  if (currentId && !ids.has(currentId)) {
    select.append(el("option", { text: `현재 값: ${currentId}`, attrs: { value: currentId } }));
  }
  select.value = currentId;
  return select;
}

function shell(className: string, testId: string): HTMLElement {
  return el("div", {
    class: `rich-command-form ${className}`,
    dataset: { testid: testId },
  });
}

function intentCard(title: string, body: string, testId: string): HTMLElement {
  return el("div", {
    class: "party-member-intent",
    dataset: { testid: testId },
    children: [
      el("div", { class: "party-member-intent-title", text: title }),
      el("p", { class: "party-member-intent-body", text: body }),
    ],
  });
}

function fieldBlock(label: string, control: HTMLElement, testId?: string): HTMLElement {
  return el("div", {
    class: "actor-m2-field change-parameters-field",
    dataset: testId ? { testid: testId } : undefined,
    children: [el("div", { class: "actor-m2-field-label change-parameters-field-label", text: label }), control],
  });
}

function targetModeOf(raw: string): "party" | "actor" {
  const value = raw.trim();
  if (!value || value === "party" || value === "all") return "party";
  return "actor";
}

function opOf(value: M2CommandValue | undefined, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function variableLabel(variableId: string): string {
  if (!variableId) return "(미선택)";
  const project = store.getCurrent();
  const index = project.variables.findIndex((entry) => entry.id === variableId);
  if (index < 0) return variableId;
  const name = project.variables[index]?.name?.trim();
  return name ? `${String(index + 1).padStart(4, "0")}: ${name}` : String(index + 1).padStart(4, "0");
}
