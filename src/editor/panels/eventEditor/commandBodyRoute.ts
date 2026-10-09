import { clearChildren, el } from "@/util/dom";
import { store } from "@/project/store";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { createMoveRouteTargetPicker } from "./moveRouteTargetPicker";
import type { Command, Dir, MapId, MoveCommand } from "@/project/types";
import type { CommandEditContext } from "./types";
import { mapSelectElement } from "./sharedPickers";
import {
  DIRECTIONAL_MOVE_TEST_IDS,
  MOVE_ROUTE_COMMAND_ROWS,
  defaultRouteSoundId,
  inferHopParameters,
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
  // 검색 상자 겸 값의 정본 표시. 라벨을 «어느 이벤트» 에서 검색 안내로 바꾼 이유는
  // 이 상자에 원시 id 를 손으로 넣는 것이 더는 정상 경로가 아니기 때문이다(OPRN-OUT-012).
  const eventIdIn = el("input", {
    attrs: {
      type: "text",
      placeholder: "이름 또는 ID 검색",
      autocomplete: "off",
      role: "combobox",
      "aria-expanded": "false",
    },
    value: cmd.eventId === PLAYER_MOVE_TARGET ? "" : cmd.eventId,
    dataset: { testid: "move-route-event-id-input" },
  }) as HTMLInputElement;
  const resolvedEventId = (): string => {
    if (targetSelect.value === "player") return PLAYER_MOVE_TARGET;
    if (targetSelect.value === "this") return "";
    return eventIdIn.value.trim();
  };
  // 입력한 ID 가 어느 이벤트인지 이름으로 되읽어 준다 — 원시 ID 만 보이던 결함(2026-09-03 제안서 §6).
  // 지금은 여기에 «(없음)» 경고까지 실어, 끊어진 참조를 목록으로 고치라고 말한다.
  const eventNameHint = el("span", {
    class: "move-route-target-name",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "move-route-event-name" },
  });
  // 조수 프롬프트·조수 출력 검증과 **같은** 카탈로그를 쓴다(project/eventTargetCatalog).
  const targetPicker = createMoveRouteTargetPicker({
    input: eventIdIn,
    status: eventNameHint,
    isEventTarget: () => targetSelect.value === "event",
    onSelect: () => {
      // 목록에서 고른 순간 대상 종류도 «특정 이벤트» 로 확정한다(빈 상태에서 골랐을 때).
      targetSelect.value = "event";
      syncTargetVisibility();
      apply();
      renderPreview();
    },
  });
  function syncTargetVisibility(): void {
    const isEvent = targetSelect.value === "event";
    eventIdIn.style.display = isEvent ? "" : "none";
    targetPicker.openButton.style.display = isEvent ? "" : "none";
    targetPicker.sync();
  }
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
    attrs: { type: "number", min: "0", placeholder: "가로" },
    value: parameterDraft.npcTargetX,
    dataset: { testid: "move-route-npc-target-x-input" },
  });
  const npcTargetY = el("input", {
    attrs: { type: "number", min: "0", placeholder: "세로" },
    value: parameterDraft.npcTargetY,
    dataset: { testid: "move-route-npc-target-y-input" },
  });
  const npcTargetDirection = directionSelect(parameterDraft.npcTargetDirection);
  // 체공: 점프 오프셋은 음수(왼쪽·위로 뛰기)가 필수라 min 을 걸지 않는다. 높이·시간의 0 은
  // "저작하지 않음" 이라 커맨드에 필드가 아예 안 붙고 런타임 기본값이 쓰인다.
  const hopDx = el("input", {
    attrs: { type: "number", placeholder: "가로", title: "점프가 건너뛸 가로 타일 수. 음수는 왼쪽." },
    value: parameterDraft.hopDx,
    dataset: { testid: "move-route-hop-dx-input" },
  });
  const hopDy = el("input", {
    attrs: { type: "number", placeholder: "세로", title: "점프가 건너뛸 세로 타일 수. 음수는 위쪽." },
    value: parameterDraft.hopDy,
    dataset: { testid: "move-route-hop-dy-input" },
  });
  const hopHeightPx = el("input", {
    attrs: {
      type: "number",
      min: "0",
      placeholder: "0=기본",
      title: "0 이면 기본값 — 점프 12px, 낙하 128px(8칸). 보스 강림은 크게 잡는다.",
    },
    value: parameterDraft.hopHeightPx,
    dataset: { testid: "move-route-hop-height-input" },
  });
  const hopDurationMs = el("input", {
    attrs: {
      type: "number",
      min: "0",
      placeholder: "0=기본",
      title: "0 이면 기본값 — 점프 300ms, 낙하 620ms. 이동 속도와 무관하게 이 시간이 쓰인다.",
    },
    value: parameterDraft.hopDurationMs,
    dataset: { testid: "move-route-hop-duration-input" },
  });

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
    hopDx: parseInt(hopDx.value, 10) || 0,
    hopDy: parseInt(hopDy.value, 10) || 0,
    hopHeightPx: parseInt(hopHeightPx.value, 10) || 0,
    hopDurationMs: parseInt(hopDurationMs.value, 10) || 0,
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
    targetPicker.sync();
    apply();
    renderPreview();
  });
  // 세 체크박스는 전부 `apply()` 가 읽고(`route.repeat/wait/skippable`) 미리보기 배지로도
  // 나타난다(`previewMoveRoute.ts:38-40`). 그래서 배선도 셋이 같아야 한다.
  // 실측 결함: `skippable` 은 리스너가 아예 없어서 토글해도 저장되지 않았고, `wait` 는
  // 저장만 하고 배지를 다시 그리지 않아 "완료까지 대기"가 다른 조작 전까지 안 보였다.
  for (const box of [repeat, wait, skippable]) {
    box.addEventListener("change", () => {
      apply();
      renderPreview();
    });
  }
  for (const input of [
    switchIdIn,
    graphicIdIn,
    soundIdIn,
    npcTargetMap,
    npcTargetX,
    npcTargetY,
    npcTargetDirection,
    hopDx,
    hopDy,
    hopHeightPx,
    hopDurationMs,
  ]) {
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
      el("summary", { text: "이 단계 값 (스위치 · 모습 · 효과음 · NPC 맵 이동 · 체공)" }),
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
          labeledField("점프 dx", hopDx),
          labeledField("점프 dy", hopDy),
          labeledField("체공 높이(px)", hopHeightPx),
          labeledField("체공 시간(ms)", hopDurationMs),
        ],
      }),
      el("p", {
        class: "move-route-parameters-hint",
        text: "스위치 켜기/끄기, 모습 바꾸기, 효과음, NPC 맵 이동, 점프·위에서 낙하를 넣을 때 위 값을 씁니다.",
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
            targetPicker.openButton,
            eventNameHint,
            // 목록은 이 줄 안에 절대 위치로 펼친다 — 부모가 position:relative 여야 한다(part-1.css).
            targetPicker.dropdown,
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
  // 두 기본값 모두 실재하는 id 여야 한다 — 없는 id 는 「적용」에서 이벤트 저장을 통째로 막는다.
  let switchId = store.getCurrent().switches[0]?.id ?? "";
  let spriteId = "tex_easyrpg_charset_people1";
  let soundId = defaultRouteSoundId();
  // 아래 루프는 npcTransfer 를 만나면 즉시 반환하므로 체공값은 따로 훑는다.
  const hop = inferHopParameters(moves);
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
          ...hop,
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
    ...hop,
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
