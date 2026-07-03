import { clearChildren, el } from "@/util/dom";
import { store } from "@/project/store";
import type { EventPageMovement, MoveCommand } from "@/project/types";
import { openEventSubdialog } from "./subdialog";
import {
  MOVE_ROUTE_COMMAND_ROWS,
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
  let frequency = clampFrequency(request.movement.frequency);
  let switchId = "sw_route_seen";
  let spriteId = "tex_easyrpg_charset_people1";
  let soundId = "se_route_chime";
  let npcTargetMapId = inferNpcTargetMapId(moves);
  let npcTargetX = inferNpcTargetX(moves);
  let npcTargetY = inferNpcTargetY(moves);
  let npcTargetDirection = inferNpcTargetDirection(moves);

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
  const renderAndSyncList = () => {
    renderCommandList(commandList, moves, selectedIndex, selectCommand);
    updateDeleteState(deleteButton, deleteAllButton, moves, selectedIndex);
  };
  const selectCommand = (index: number) => {
    selectedIndex = index;
    renderAndSyncList();
  };
  const appendCommand = (command: MoveCommand) => {
    moves = [...moves, command];
    selectedIndex = moves.length - 1;
    renderAndSyncList();
  };
  deleteButton.addEventListener("click", () => {
    if (selectedIndex < 0 || selectedIndex >= moves.length) return;
    moves = moves.filter((_, index) => index !== selectedIndex);
    selectedIndex = Math.min(selectedIndex, moves.length - 1);
    renderAndSyncList();
  });
  deleteAllButton.addEventListener("click", () => {
    moves = [];
    selectedIndex = -1;
    renderAndSyncList();
  });

  body.append(
    el("div", {
      class: "event-page-move-route",
      children: [
        renderTopBar(
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
            },
            onSpriteId: (next) => {
              spriteId = next;
            },
            onSoundId: (next) => {
              soundId = next;
            },
            npcTargetMapId,
            npcTargetX,
            npcTargetY,
            npcTargetDirection,
            onNpcTargetMapId: (next) => {
              npcTargetMapId = next;
            },
            onNpcTargetX: (next) => {
              npcTargetX = next;
            },
            onNpcTargetY: (next) => {
              npcTargetY = next;
            },
            onNpcTargetDirection: (next) => {
              npcTargetDirection = next;
            },
          }
        ),
        el("div", {
          class: "event-page-move-route-main",
          children: [
            el("fieldset", {
              class: "event-page-move-route-list-panel",
              children: [el("legend", { text: "이동 명령" }), commandList],
            }),
            renderCommandGrid(appendCommand, () => ({ switchId, spriteId, soundId, npcTargetMapId, npcTargetX, npcTargetY, npcTargetDirection })),
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
      grid.append(
        el("button", {
          class: "event-page-move-route-command",
          text: item.label,
          attrs: { type: "button" },
          dataset: { testid: `event-page-move-route-add-${item.testId}` },
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
      text: "$>",
      attrs: { type: "button" },
      on: { click: () => onSelect(-1) },
    })
  );
  moves.forEach((move, index) => {
    target.append(
      el("button", {
        class: selectedIndex === index ? "event-page-move-route-list-row selected" : "event-page-move-route-list-row",
        text: `@> ${moveCommandLabel(move)}`,
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
