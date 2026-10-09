import { clearChildren, el } from "@/util/dom";
import { store } from "@/project/store";
import type { EventPageMovement, MoveCommand } from "@/project/types";
import { openEventSubdialog } from "./subdialog";
import { previewMoveRoute } from "./previewMoveRoute";
import {
  DIRECTIONAL_MOVE_TEST_IDS,
  MOVE_ROUTE_COMMAND_ROWS,
  defaultRouteSoundId,
  inferHopParameters,
  moveCommandLabel,
  type MoveRouteCommandContext,
} from "./moveRouteCommandCatalog";
import {
  checkboxLabel,
  renderFooter,
  renderTopBar,
  routeUtilityButton,
  updateDeleteState,
} from "./moveRouteDialogParts";

type PageMoveRouteDialogRequest = {
  readonly movement: EventPageMovement;
  readonly onApply: (movement: EventPageMovement) => void;
};

export function openPageMoveRouteDialog(request: PageMoveRouteDialogRequest): void {
  openEventSubdialog({
    title: "이동 경로",
    testId: "event-page-move-route-dialog",
    width: "wide",
    render: (body, close) => renderMoveRouteDialog(body, close, request),
  });
}

function renderMoveRouteDialog(body: HTMLElement, close: () => void, request: PageMoveRouteDialogRequest): void {
  let moves = [...(request.movement.route?.moves ?? [])];
  let selectedIndex = moves.length > 0 ? moves.length - 1 : -1;
  // Initial/appended selection remains an insertion template until a row is explicitly selected.
  let editedIndex = -1;
  let frequency = clampFrequency(request.movement.frequency);
  // 프로젝트에 실재하는 스위치를 기본값으로 (원시 문자열 "sw_route_seen" 은 없는 id 일 수 있다).
  let switchId = store.getCurrent().switches[0]?.id ?? "";
  let spriteId = "tex_easyrpg_charset_people1";
  let soundId = defaultRouteSoundId();
  let npcTargetMapId = inferNpcTargetMapId(moves);
  let npcTargetX = inferNpcTargetX(moves);
  let npcTargetY = inferNpcTargetY(moves);
  let npcTargetDirection = inferNpcTargetDirection(moves);
  const initialHop = inferHopParameters(moves);
  let hopDx = initialHop.hopDx;
  let hopDy = initialHop.hopDy;
  let hopHeightPx = initialHop.hopHeightPx;
  let hopDurationMs = initialHop.hopDurationMs;

  const commandList = el("div", {
    class: "event-page-move-route-command-list",
    dataset: { testid: "event-page-move-route-command-list" },
  });
  const repeat = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-page-move-route-repeat" },
  });
  repeat.checked = request.movement.route?.repeat ?? true;
  const skip = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "event-page-move-route-skippable" },
  });
  skip.checked = request.movement.route?.skippable ?? false;
  const helpPanel = el("div", {
    class: "event-page-move-route-help-panel",
    text: "현재 이벤트의 자율 이동 경로를 편집합니다. 이동 불가 시 건너뜀은 막힌 이동 명령을 다음 명령으로 넘깁니다.",
    dataset: { testid: "event-page-move-route-help-panel" },
  });
  helpPanel.hidden = true;
  const deleteButton = routeUtilityButton("삭제", "event-page-move-route-delete");
  const deleteAllButton = routeUtilityButton("모두 삭제", "event-page-move-route-delete-all");
  // 격자 궤적 라이브 프리뷰 (moveEvent 프리뷰 재사용).
  const preview = el("div", {
    class: "event-page-move-route-preview",
    dataset: { testid: "event-page-move-route-preview" },
  });
  const renderPreview = () => {
    clearChildren(preview);
    preview.append(
      previewMoveRoute({ kind: "moveEvent", eventId: "", route: { moves: [...moves], repeat: repeat.checked } })
    );
  };
  repeat.addEventListener("change", renderPreview);
  const renderAndSyncList = () => {
    renderCommandList(commandList, moves, selectedIndex, selectCommand);
    updateDeleteState(deleteButton, deleteAllButton, moves, selectedIndex);
    renderPreview();
    const legend = topBar.querySelector(".event-page-move-route-parameters legend");
    if (legend) legend.textContent = editedIndex < 0 ? "이 단계 값" : `선택한 ${editedIndex + 1}번 단계 값`;
  };
  const editSelected = (edit: (move: MoveCommand) => MoveCommand): void => {
    const current = moves[editedIndex];
    if (!current) return;
    const next = edit(current);
    if (next === current) return;
    moves = moves.map((move, index) => index === editedIndex ? next : move);
    renderAndSyncList();
  };
  const selectCommand = (index: number) => {
    selectedIndex = index;
    editedIndex = -1;
    const move = moves[index];
    if (move?.kind === "setSwitch") { switchId = move.switchId; editedIndex = index; }
    else if (move?.kind === "changeGraphic") { spriteId = move.spriteId; editedIndex = index; }
    else if (move?.kind === "playSe") { soundId = move.resourceId; editedIndex = index; }
    else if (move?.kind === "npcTransfer") {
      npcTargetMapId = move.mapId; npcTargetX = move.x; npcTargetY = move.y;
      npcTargetDirection = move.direction ?? "down"; editedIndex = index;
    }
    topBar.replaceChildren(...Array.from(renderTop().children));
    renderAndSyncList();
  };
  const appendCommand = (command: MoveCommand) => {
    editedIndex = -1;
    moves = [...moves, command];
    selectedIndex = moves.length - 1;
    renderAndSyncList();
  };
  deleteButton.addEventListener("click", () => {
    if (selectedIndex < 0 || selectedIndex >= moves.length) return;
    editedIndex = -1;
    moves = moves.filter((_, index) => index !== selectedIndex);
    selectedIndex = Math.min(selectedIndex, moves.length - 1);
    renderAndSyncList();
  });
  deleteAllButton.addEventListener("click", () => {
    editedIndex = -1;
    moves = [];
    selectedIndex = -1;
    renderAndSyncList();
  });

  const renderTop = () => renderTopBar(
    frequency,
    (next) => {
      frequency = next;
    },
    {
      switchId,
      spriteId,
      soundId,
      onSwitchId: (next) => {
        switchId = next;
        editSelected(move => move.kind === "setSwitch" ? { ...move, switchId: next } : move);
      },
      onSpriteId: (next) => {
        spriteId = next;
        editSelected(move => move.kind === "changeGraphic" ? { ...move, spriteId: next } : move);
      },
      onSoundId: (next) => {
        soundId = next;
        editSelected(move => move.kind === "playSe" ? { ...move, resourceId: next } : move);
      },
      npcTargetMapId,
      npcTargetX,
      npcTargetY,
      npcTargetDirection,
      onNpcTargetMapId: (next) => {
        npcTargetMapId = next;
        editSelected(move => move.kind === "npcTransfer" ? { ...move, mapId: next } : move);
      },
      onNpcTargetX: (next) => {
        npcTargetX = next;
        editSelected(move => move.kind === "npcTransfer" ? { ...move, x: next } : move);
      },
      onNpcTargetY: (next) => {
        npcTargetY = next;
        editSelected(move => move.kind === "npcTransfer" ? { ...move, y: next } : move);
      },
      onNpcTargetDirection: (next) => {
        npcTargetDirection = next;
        editSelected(move => move.kind === "npcTransfer" ? { ...move, direction: next } : move);
      },
      hopDx,
      hopDy,
      hopHeightPx,
      hopDurationMs,
      onHopDx: (next) => {
        hopDx = next;
      },
      onHopDy: (next) => {
        hopDy = next;
      },
      onHopHeightPx: (next) => {
        hopHeightPx = next;
      },
      onHopDurationMs: (next) => {
        hopDurationMs = next;
      },
    }
  );
  const topBar = renderTop();

  body.append(
    el("div", {
      class: "event-page-move-route",
      children: [
        topBar,
        el("div", {
          class: "event-page-move-route-main",
          children: [
            el("fieldset", {
              class: "event-page-move-route-list-panel",
              children: [el("legend", { text: "이동 명령" }), commandList, preview],
            }),
            renderCommandGrid(appendCommand, () => ({
              switchId,
              spriteId,
              soundId,
              npcTargetMapId,
              npcTargetX,
              npcTargetY,
              npcTargetDirection,
              hopDx,
              hopDy,
              hopHeightPx,
              hopDurationMs,
            })),
          ],
        }),
        el("div", {
          class: "event-page-move-route-bottom",
          children: [
            el("fieldset", {
              class: "event-page-move-route-options",
              children: [
                el("legend", { text: "옵션" }),
                checkboxLabel(repeat, "반복 실행"),
                checkboxLabel(skip, "이동 불가 시 건너뜀"),
              ],
            }),
            el("div", { class: "event-page-move-route-delete-box", children: [deleteButton, deleteAllButton] }),
          ],
        }),
        helpPanel,
        renderFooter(close, () => {
          request.onApply({
            ...request.movement,
            type: "custom",
            frequency,
            route: {
              moves,
              repeat: repeat.checked,
              skippable: skip.checked,
              ...(request.movement.route?.wait === undefined ? {} : { wait: request.movement.route.wait }),
            },
          });
          close();
        }, () => {
          helpPanel.hidden = !helpPanel.hidden;
        }),
      ],
    })
  );
  renderAndSyncList();
}

function renderCommandGrid(
  onCommand: (command: MoveCommand) => void,
  commandContext: () => MoveRouteCommandContext
): HTMLElement {
  const grid = el("div", { class: "event-page-move-route-grid" });
  for (const row of MOVE_ROUTE_COMMAND_ROWS) {
    for (const item of row) {
      const children: HTMLElement[] = [];
      if (item.icon) {
        // 글리프는 data-glyph + CSS ::before 로만 그린다. 버튼 textContent 는 라벨 그대로
        // 유지되어야 한다 (e2e toHaveText/라벨 클릭 보호).
        children.push(
          el("span", {
            class: "event-page-move-route-command-icon",
            attrs: { "aria-hidden": "true" },
            dataset: { glyph: item.icon },
          })
        );
      }
      children.push(el("span", { class: "event-page-move-route-command-label", text: item.label }));
      const directional = DIRECTIONAL_MOVE_TEST_IDS.has(item.testId);
      grid.append(
        el("button", {
          class: directional
            ? "event-page-move-route-command event-page-move-route-command-directional"
            : "event-page-move-route-command",
          attrs: { type: "button" },
          dataset: { testid: `event-page-move-route-add-${item.testId}` },
          children,
          on: {
            click: () => {
              const command = item.createCommand(commandContext());
              if (command) onCommand(command);
            },
          },
        })
      );
    }
  }
  return grid;
}

function renderCommandList(
  target: HTMLElement,
  moves: readonly MoveCommand[],
  selectedIndex: number,
  onSelect: (index: number) => void
): void {
  clearChildren(target);
  target.append(
    el("button", {
      class: selectedIndex === -1 ? "event-page-move-route-list-row selected" : "event-page-move-route-list-row",
      text: "시작",
      attrs: { type: "button" },
      on: { click: () => onSelect(-1) },
    })
  );
  moves.forEach((move, index) => {
    target.append(
      el("button", {
        class: selectedIndex === index ? "event-page-move-route-list-row selected" : "event-page-move-route-list-row",
        text: moveCommandLabel(move),
        attrs: { type: "button" },
        dataset: { testid: `event-page-move-route-command-${index + 1}` },
        on: { click: () => onSelect(index) },
      })
    );
  });
}

function clampFrequency(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}

function inferNpcTargetMapId(moves: readonly MoveCommand[]): string {
  const transfer = latestNpcTransfer(moves);
  return transfer?.mapId ?? Object.keys(store.getCurrent().maps)[0] ?? "";
}

function inferNpcTargetX(moves: readonly MoveCommand[]): number {
  return latestNpcTransfer(moves)?.x ?? 0;
}

function inferNpcTargetY(moves: readonly MoveCommand[]): number {
  return latestNpcTransfer(moves)?.y ?? 0;
}

function inferNpcTargetDirection(moves: readonly MoveCommand[]): "down" | "left" | "right" | "up" {
  return latestNpcTransfer(moves)?.direction ?? "down";
}

function latestNpcTransfer(moves: readonly MoveCommand[]): Extract<MoveCommand, { kind: "npcTransfer" }> | undefined {
  for (let index = moves.length - 1; index >= 0; index -= 1) {
    const move = moves[index];
    if (move?.kind === "npcTransfer") return move;
  }
  return undefined;
}

