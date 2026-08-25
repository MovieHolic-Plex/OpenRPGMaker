import { clearChildren, el } from "@/util/dom";
import { store } from "@/project/store";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import type { Command, Dir, MapId, MoveCommand } from "@/project/types";
import type { CommandEditContext } from "./types";
import { mapSelectElement } from "./sharedPickers";
import {
  DIRECTIONAL_MOVE_TEST_IDS,
  MOVE_ROUTE_COMMAND_ROWS,
  moveCommandLabel,
  type MoveRouteCommandContext,
} from "./moveRouteCommandCatalog";
import { previewMoveRoute } from "./previewMoveRoute";

const routeParameterDrafts = new Map<string, MoveRouteCommandContext>();

export function moveEventBody(context: CommandEditContext, cmd: Extract<Command, { kind: "moveEvent" }>): HTMLElement {
  const wrap = el("div", { class: "move-route-editor cream-command-form", dataset: { testid: "move-route-editor" } });
  const parameterKey = context.path.join(".");
  const parameterDraft = routeParameterDrafts.get(parameterKey) ?? inferRouteParameters(cmd.route.moves);

  // 로컬 경로 상태: replaceCommand 가 폼을 재빌드하지 않으므로(shouldRerenderCommandForm)
  // 이동 단계 추가는 여기서 관리하고 동기화만 한다.
  let moves: MoveCommand[] = [...cmd.route.moves];
  let selectedIndex = moves.length > 0 ? moves.length - 1 : -1;

  // 대상: 이 이벤트("") / 주인공(PLAYER_MOVE_TARGET) / 특정 이벤트(임의 ID).
  const targetKindOf = (id: string): "this" | "player" | "event" =>
    id === PLAYER_MOVE_TARGET ? "player" : id === "" ? "this" : "event";
  const targetSelect = el("select", { dataset: { testid: "move-route-target-select" } }) as HTMLSelectElement;
  for (const option of [
    { value: "this", label: "이 이벤트" },
    { value: "player", label: "주인공" },
    { value: "event", label: "특정 이벤트" },
  ] as const) {
    targetSelect.append(el("option", { attrs: { value: option.value }, text: option.label }));
  }
  targetSelect.value = targetKindOf(cmd.eventId);
  const eventIdIn = el("input", {
    attrs: { type: "text", placeholder: "어느 이벤트" },
    value: cmd.eventId === PLAYER_MOVE_TARGET ? "" : cmd.eventId,
    dataset: { testid: "move-route-event-id-input" },
  });
  const resolvedEventId = (): string => {
    if (targetSelect.value === "player") return PLAYER_MOVE_TARGET;
    if (targetSelect.value === "this") return "";
    return eventIdIn.value.trim();
  };
  const syncTargetVisibility = () => {
    eventIdIn.style.display = targetSelect.value === "event" ? "" : "none";
  };
  syncTargetVisibility();

  const repeat = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "move-route-repeat-checkbox" },
  });
  repeat.checked = cmd.route.repeat;
  const wait = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "move-route-wait-checkbox" },
  });
  wait.checked = cmd.route.wait === true;
  const skippable = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "move-route-skippable-checkbox" },
  });
  skippable.checked = cmd.route.skippable === true;

  const switchIdIn = el("input", {
    attrs: { type: "text", placeholder: "스위치" },
    value: parameterDraft.switchId,
    dataset: { testid: "move-route-switch-id-input" },
  });
  const graphicIdIn = el("input", {
    attrs: { type: "text", placeholder: "모습" },
    value: parameterDraft.spriteId,
    dataset: { testid: "move-route-graphic-id-input" },
  });
  const soundIdIn = el("input", {
    attrs: { type: "text", placeholder: "효과음" },
    value: parameterDraft.soundId,
    dataset: { testid: "move-route-sound-id-input" },
  });
  const npcTargetMap = mapSelect(parameterDraft.npcTargetMapId);
  const npcTargetX = el("input", {
    attrs: { type: "number", min: "0", placeholder: "NPC X" },
    value: parameterDraft.npcTargetX,
    dataset: { testid: "move-route-npc-target-x-input" },
  });
  const npcTargetY = el("input", {
    attrs: { type: "number", min: "0", placeholder: "NPC Y" },
    value: parameterDraft.npcTargetY,
    dataset: { testid: "move-route-npc-target-y-input" },
  });
  const npcTargetDirection = directionSelect(parameterDraft.npcTargetDirection);

  const commandList = el("div", {
    class: "move-route-command-list",
    dataset: { testid: "move-route-command-list" },
  });
  const previewHost = el("div", {
    class: "move-route-path-preview",
    dataset: { testid: "move-route-path-preview" },
  });
  // 숨김 요약: 기존 e2e/도구가 move-route-summary 텍스트를 읽을 수 있게 유지.
  const summary = el("div", {
    class: "move-route-summary empty-hint",
    text: "",
    dataset: { testid: "move-route-summary" },
  });
  const deleteButton = el("button", {
    class: "btn small",
    text: "선택 삭제",
    attrs: { type: "button" },
    dataset: { testid: "move-route-delete-selected" },
  });
  const clearButton = el("button", {
    class: "btn small danger",
    text: "비우기",
    attrs: { type: "button" },
    dataset: { testid: "move-route-clear" },
  });

  const parameterContext = (): MoveRouteCommandContext => ({
    switchId: switchIdIn.value.trim(),
    spriteId: graphicIdIn.value.trim(),
    soundId: soundIdIn.value.trim(),
    npcTargetMapId: npcTargetMap.value,
    npcTargetX: parseInt(npcTargetX.value, 10) || 0,
    npcTargetY: parseInt(npcTargetY.value, 10) || 0,
    npcTargetDirection: toDirection(npcTargetDirection.value),
  });

  const persistParameters = () => {
    routeParameterDrafts.set(parameterKey, parameterContext());
  };

  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "moveEvent",
      eventId: resolvedEventId(),
      route: { moves: [...moves], repeat: repeat.checked, wait: wait.checked, skippable: skippable.checked },
    });
  };

  const renderList = () => {
    clearChildren(commandList);
    if (moves.length === 0) {
      commandList.append(
        el("div", {
          class: "move-route-list-empty",
          text: "(이동 단계 없음)",
        })
      );
    } else {
      moves.forEach((move, index) => {
        commandList.append(
          el("button", {
            class: selectedIndex === index ? "move-route-list-row selected" : "move-route-list-row",
            text: `${index + 1}. ${moveCommandLabel(move)}`,
            attrs: { type: "button" },
            dataset: { testid: `move-route-command-${index + 1}` },
            on: {
              click: () => {
                selectedIndex = index;
                renderList();
              },
            },
          })
        );
      });
    }
    summary.textContent = moves.map(moveCommandLabel).join(" -> ") || "(이동 단계 없음)";
    deleteButton.disabled = selectedIndex < 0 || selectedIndex >= moves.length;
    clearButton.disabled = moves.length === 0;
  };

  const renderPreview = () => {
    clearChildren(previewHost);
    previewHost.append(
      previewMoveRoute({
        kind: "moveEvent",
        eventId: resolvedEventId(),
        route: { moves: [...moves], repeat: repeat.checked, wait: wait.checked, skippable: skippable.checked },
      })
    );
  };

  const syncUi = () => {
    renderList();
    renderPreview();
    apply();
  };

  targetSelect.addEventListener("change", () => {
    if (targetSelect.value !== "event") eventIdIn.value = "";
    syncTargetVisibility();
    apply();
    renderPreview();
  });
  eventIdIn.addEventListener("change", () => {
    // e2e/직접 입력: ID 가 있으면 특정 이벤트 대상으로 승격.
    if (eventIdIn.value.trim()) {
      targetSelect.value = "event";
      syncTargetVisibility();
    }
    apply();
    renderPreview();
  });
  repeat.addEventListener("change", () => {
    apply();
    renderPreview();
  });
  wait.addEventListener("change", apply);
  for (const input of [switchIdIn, graphicIdIn, soundIdIn, npcTargetMap, npcTargetX, npcTargetY, npcTargetDirection]) {
    input.addEventListener("input", persistParameters);
    input.addEventListener("change", persistParameters);
  }

  const controls = el("div", { class: "move-route-controls" });
  for (const row of MOVE_ROUTE_COMMAND_ROWS) {
    for (const item of row) {
      const children: HTMLElement[] = [];
      if (item.icon) {
        children.push(
          el("span", {
            class: "move-route-command-icon",
            attrs: { "aria-hidden": "true" },
            dataset: { glyph: item.icon },
          })
        );
      }
      children.push(el("span", { class: "move-route-command-label", text: item.label }));
      const directional = DIRECTIONAL_MOVE_TEST_IDS.has(item.testId);
      controls.append(
        el("button", {
          class: directional
            ? "btn small move-route-add-command move-route-add-command-directional"
            : "btn small move-route-add-command",
          attrs: { type: "button" },
          dataset: { testid: `move-route-add-${item.testId}` },
          children,
          on: {
            click: () => {
              const move = item.createCommand(parameterContext());
              if (!move) return;
              moves = [...moves, move];
              selectedIndex = moves.length - 1;
              syncUi();
            },
          },
        })
      );
    }
  }

  deleteButton.addEventListener("click", () => {
    if (selectedIndex < 0 || selectedIndex >= moves.length) return;
    moves = moves.filter((_, index) => index !== selectedIndex);
    selectedIndex = moves.length === 0 ? -1 : Math.min(selectedIndex, moves.length - 1);
    syncUi();
  });
  clearButton.addEventListener("click", () => {
    moves = [];
    selectedIndex = -1;
    syncUi();
  });

  const repeatLabel = el("label", { class: "move-route-option", children: [repeat, el("span", { text: "반복" })] });
  const waitLabel = el("label", {
    class: "move-route-option",
    children: [wait, el("span", { text: "완료까지 대기" })],
  });
  const skippableLabel = el("label", {
    class: "move-route-option",
    dataset: { testid: "move-route-skippable-option" },
    children: [skippable, el("span", { text: "막히면 건너뛰기" })],
  });

  // 스위치/그래픽/효과음/NPC이동 버튼에만 쓰이므로 접어 두고,
  // 주 작업면(목록 + 명령 버튼 + 미리보기)을 먼저 보이게 한다.
  const parametersPanel = el("details", {
    class: "move-route-parameters-details",
    dataset: { testid: "move-route-parameters-details" },
    children: [
      el("summary", { text: "이 단계 값 (스위치 · 모습 · 효과음 · NPC 맵 이동)" }),
      el("div", {
        class: "move-route-parameters",
        children: [
          labeledField("스위치", switchIdIn),
          labeledField("모습", graphicIdIn),
          labeledField("효과음", soundIdIn),
          labeledField("NPC 맵", npcTargetMap),
          labeledField("X", npcTargetX),
          labeledField("Y", npcTargetY),
          labeledField("방향", npcTargetDirection),
        ],
      }),
      el("p", {
        class: "move-route-parameters-hint",
        text: "스위치 켜기/끄기, 모습 바꾸기, 효과음, NPC 맵 이동을 넣을 때 위 값을 씁니다.",
      }),
    ],
  });

  wrap.append(
    el("div", {
      class: "move-route-toolbar",
      children: [
        el("div", {
          class: "move-route-target-row",
          children: [
            el("span", { class: "move-route-target-label", text: "누구에게" }),
            targetSelect,
            eventIdIn,
          ],
        }),
        el("div", { class: "move-route-options", children: [repeatLabel, waitLabel, skippableLabel] }),
      ],
    }),
    el("p", {
      class: "move-route-help",
      dataset: { testid: "move-route-help" },
      text: "오른쪽 명령 버튼으로 경로를 쌓습니다. 왼쪽 목록에서 선택·삭제, 아래 격자에 궤적이 그려집니다.",
    }),
    el("div", {
      class: "move-route-main",
      children: [
        el("div", {
          class: "move-route-list-panel",
          children: [
            el("div", { class: "move-route-panel-title", text: "이동 명령" }),
            commandList,
            el("div", {
              class: "move-route-list-actions",
              children: [deleteButton, clearButton],
            }),
            el("div", { class: "move-route-panel-title", text: "경로 미리보기" }),
            previewHost,
            summary,
          ],
        }),
        el("div", {
          class: "move-route-controls-panel",
          children: [
            el("div", { class: "move-route-panel-title", text: "명령 추가" }),
            controls,
          ],
        }),
      ],
    }),
    parametersPanel,
  );

  renderList();
  renderPreview();
  return wrap;
}

function labeledField(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "move-route-parameter-field",
    children: [el("span", { text: label }), control],
  });
}

function inferRouteParameters(moves: readonly MoveCommand[]): MoveRouteCommandContext {
  let switchId = "sw_route_seen";
  let spriteId = "tex_easyrpg_charset_people1";
  let soundId = "se_route_chime";
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const move = moves[index];
    if (move === undefined) continue;
    switch (move.kind) {
      case "setSwitch":
        switchId = move.switchId;
        break;
      case "changeGraphic":
        spriteId = move.spriteId;
        break;
      case "npcTransfer":
        return {
          switchId,
          spriteId,
          soundId,
          npcTargetMapId: move.mapId,
          npcTargetX: move.x,
          npcTargetY: move.y,
          npcTargetDirection: move.direction ?? "down",
        };
      case "playSe":
        soundId = move.resourceId;
        break;
      default:
        break;
    }
  }
  return {
    switchId,
    spriteId,
    soundId,
    npcTargetMapId: Object.keys(store.getCurrent().maps)[0] ?? "",
    npcTargetX: 0,
    npcTargetY: 0,
    npcTargetDirection: "down",
  };
}

function mapSelect(value: MapId): HTMLSelectElement {
  return mapSelectElement({
    selectedId: value,
    testid: "move-route-npc-target-map-input",
    allowEmpty: false,
  });
}

function directionSelect(value: Dir): HTMLSelectElement {
  const select = el("select", { dataset: { testid: "move-route-npc-target-direction-input" } });
  for (const option of [
    { value: "down", label: "아래" },
    { value: "left", label: "왼쪽" },
    { value: "right", label: "오른쪽" },
    { value: "up", label: "위" },
  ] as const) {
    select.append(el("option", { attrs: { value: option.value }, text: option.label }));
  }
  select.value = value;
  return select;
}

function toDirection(value: string): Dir {
  if (value === "left" || value === "right" || value === "up" || value === "down") return value;
  return "down";
}
