import { renderSpatialCardThumb, roomKindOf } from "@/editor/panels/spatialGallery";
import { interiorThemeCards } from "@/editor/panels/structureKitDbSources";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import {
  addSpaceObjectAt,
  layoutIssue,
  mutateWorkingSpace,
  workingProject,
  workingSpace,
} from "@/editor/panels/spatialSpaceCommands";
import { SPACE_TILE_PX, liveSpaceBoard, tileOf } from "@/editor/panels/spatialSpaceLayoutView";
import { listPlacedSpaceMembers } from "@/editor/panels/spatialSpaceMembers";
import { issuePlacedSpaceEdit } from "@/editor/panels/spatialSpacePlacedActions";
import { memberNode, portNode, renderSpaceBoardArt, slotNode } from "@/editor/panels/spatialSpaceTokens";
import { movePort, moveSlot, spaceDraftTarget, type SpaceDraftTarget } from "@/editor/panels/spatialSpaceDraft";
import { assertNever, spatialId } from "@/project/spatial/domain";
import type { SpaceDesign } from "@/project/spatial/types";
import { el } from "@/util/dom";

export { SPACE_TILE_PX };

function moveGesture(target: SpaceDraftTarget, tile: { x: number; y: number }, commitMember: boolean): void {
  const gesture = spaceChromeState.gesture;
  if (!gesture) return;
  switch (gesture.kind) {
    case "slot":
      mutateWorkingSpace(target, (current) => moveSlot(current, gesture.id, tile.x, tile.y));
      return;
    case "port":
      mutateWorkingSpace(target, (current) => movePort(current, gesture.id, tile.x, tile.y));
      return;
    case "member":
      if (!target.occurrenceId || !commitMember) return;
      issuePlacedSpaceEdit(workingProject(), target.occurrenceId, {
        kind: "move", member: { slotId: gesture.id, index: gesture.index }, position: tile,
      });
      return;
    default:
      return assertNever(gesture);
  }
}

function restoreGesture(target: SpaceDraftTarget): void {
  const gesture = spaceChromeState.gesture;
  if (!gesture) return;
  switch (gesture.kind) {
    case "slot":
      mutateWorkingSpace(target, (current) => moveSlot(current, gesture.id, gesture.originX, gesture.originY));
      break;
    case "port":
      mutateWorkingSpace(target, (current) => movePort(current, gesture.id, gesture.originX, gesture.originY));
      break;
    case "member":
      break;
    default:
      return assertNever(gesture);
  }
  spaceChromeState.gesture = null;
}

function nudgeSelected(target: SpaceDraftTarget, space: SpaceDesign, dx: number, dy: number): void {
  const slotId = spaceChromeState.selectedSlotId;
  const portId = spaceChromeState.selectedPortId;
  if (slotId && spaceChromeState.selectedIndex !== null && target.occurrenceId) {
    const member = listPlacedSpaceMembers(workingProject(), target.occurrenceId)
      .find((entry) => entry.member.slotId === slotId && entry.member.index === spaceChromeState.selectedIndex);
    if (!member) return;
    issuePlacedSpaceEdit(workingProject(), target.occurrenceId, {
      kind: "move", member: member.member, position: { x: member.child.x + dx, y: member.child.y + dy },
    });
    return;
  }
  if (slotId) {
    const slot = space.objectSlots.find((entry) => entry.id === slotId);
    const x = (slot?.placement.mode === "fixed" ? slot.placement.x : 0) + dx;
    const y = (slot?.placement.mode === "fixed" ? slot.placement.y : 0) + dy;
    mutateWorkingSpace(target, (current) => moveSlot(current, slotId, x, y));
    return;
  }
  if (portId) {
    const port = space.ports.find((entry) => entry.id === portId);
    mutateWorkingSpace(target, (current) => movePort(current, portId, (port?.x ?? 0) + dx, (port?.y ?? 0) + dy));
  }
}

export function renderSpatialSpacesCanvas(
  _session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  const space = workingSpace(card);
  const target = card ? spaceDraftTarget(card) : undefined;
  const issue = layoutIssue(card);
  if (issue) spaceChromeState.previewError = issue;
  const board = el("div", {
    class: "spatial-space-board",
    attrs: {
      tabindex: "0",
      "aria-label": "공간 배치",
      style: space
        ? `width:${Math.max(space.width, 8) * SPACE_TILE_PX}px;height:${Math.max(space.height, 6) * SPACE_TILE_PX}px`
        : "",
    },
    dataset: { testid: "spatial-space-board" },
  });
  if (space) {
    board.append(renderSpaceBoardArt(space));
    if (target?.occurrenceId) {
      for (const view of listPlacedSpaceMembers(workingProject(), target.occurrenceId)) board.append(memberNode(view, rerender));
    } else {
      for (const slot of space.objectSlots) board.append(slotNode(space, slot.id, rerender));
    }
    for (const port of space.ports) board.append(portNode(space, port.id, rerender));
  }
  const eventBoard = (event: Event): HTMLElement => liveSpaceBoard(board.parentElement) ?? liveSpaceBoard()
    ?? (event.currentTarget instanceof HTMLElement ? event.currentTarget : board);
  const eventTile = (event: Event, active: HTMLElement): { x: number; y: number } => {
    if (!(event instanceof MouseEvent) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return spaceChromeState.cursorTile;
    }
    return tileOf(event, active);
  };
  board.addEventListener("pointermove", (event) => {
    if (!target || !space) return;
    const active = eventBoard(event);
    const tile = tileOf(event, active);
    spaceChromeState.cursorTile = tile;
    const gesture = spaceChromeState.gesture;
    if (!gesture) return;
    if (gesture.kind === "member") {
      const token = active.querySelector<HTMLElement>(`[data-testid='spatial-member-${gesture.id}-${gesture.index}']`);
      if (token) {
        token.style.left = `${tile.x * SPACE_TILE_PX}px`;
        token.style.top = `${tile.y * SPACE_TILE_PX}px`;
      }
      return;
    }
    moveGesture(target, tile, false);
    rerender();
  });
  board.addEventListener("pointerup", (event) => {
    if (!target || !space || !spaceChromeState.gesture) return;
    if (spaceChromeState.gesture.kind === "member") moveGesture(target, eventTile(event, eventBoard(event)), true);
    spaceChromeState.gesture = null;
    rerender();
  });
  board.addEventListener("keydown", (event) => {
    if (!target || !space) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      restoreGesture(target);
      rerender();
      return;
    }
    if (event.key === "Enter" && spaceChromeState.selectedObjectId && target.occurrenceId) {
      event.preventDefault();
      addSpaceObjectAt(target, spaceChromeState.selectedObjectId, spaceChromeState.cursorTile);
      rerender();
      return;
    }
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    nudgeSelected(target, space, dx, dy);
    rerender();
  });
  const objects = Object.values(workingProject().spatialAuthoring?.library.objects ?? {});
  const gallery = el("div", {
    class: "spatial-space-object-gallery",
    dataset: { testid: "spatial-object-gallery" },
    children: objects.map((object) => el("button", {
      class: `spatial-space-object${spaceChromeState.selectedObjectId === object.id ? " is-selected" : ""}`,
      attrs: { type: "button", draggable: "true", "aria-pressed": String(spaceChromeState.selectedObjectId === object.id) },
      dataset: { testid: `spatial-object-${object.id}`, objectId: object.id },
      children: [renderSpatialCardThumb({
        id: object.id, name: object.name, source: "own", kind: "objects", usage: 0,
        tilesetId: object.graphic.tilesetId, objectId: object.graphic.kitId, localId: object.id,
      })],
      on: {
        click: () => { spaceChromeState.selectedObjectId = spatialId(object.id); rerender(); },
        dragstart: (event) => {
          spaceChromeState.selectedObjectId = spatialId(object.id);
          const data = event instanceof DragEvent ? event.dataTransfer : null;
          data?.setData("text/spatial-object", object.id);
        },
      },
    })),
  });
  board.addEventListener("dragover", (event) => event.preventDefault());
  board.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!target) return;
    const transfer = "dataTransfer" in event ? event.dataTransfer : null;
    const objectId = (transfer instanceof DataTransfer ? transfer.getData("text/spatial-object") : "") || spaceChromeState.selectedObjectId;
    if (!objectId) return;
    addSpaceObjectAt(target, objectId, eventTile(event, eventBoard(event)));
    rerender();
  });
  /**
   * 방 종류 카드(기본 7종·호환 규칙)는 편집용 SpaceDesign 이 없다 — 빈 보드 대신
   * 종류 문법을 읽기 전용으로 요약해서 보여 준다.
   */
  function roomKindPanel(card: SpatialGalleryCard): HTMLElement | undefined {
    const kind = roomKindOf(card);
    if (!kind) return undefined;
    const tileset = card.tilesetId && Object.hasOwn(workingProject().tilesets, card.tilesetId)
      ? workingProject().tilesets[card.tilesetId]
      : undefined;
    const theme = interiorThemeCards(tileset, [kind])[0];
    return el("section", {
      class: "spatial-space-kind",
      dataset: { testid: "spatial-space-kind", roomKind: kind.id },
      children: [
        el("h4", { class: "spatial-space-kind-name", text: kind.label }),
        el("p", {
          class: "spatial-space-kind-note",
          text: kind.walkway
            ? "통로 공간 — 방이 아니라 이동 경로로 쓰입니다."
            : card.compatibility === "room-rule"
              ? "호환 방 규칙 — 이 타일셋이 정의한 방 종류입니다."
              : "기본 방 종류 — 실내를 만들 때 이 문법으로 채웁니다.",
        }),
        el("dl", {
          class: "spatial-inspector-facts",
          children: [
            el("dt", { text: "필수 역할" }),
            el("dd", {
              dataset: { testid: "spatial-space-kind-roles" },
              text: theme && theme.roles.length > 0 ? theme.roles.map((role) => role.label).join(", ") : "없음",
            }),
            el("dt", { text: "분위기" }),
            el("dd", {
              dataset: { testid: "spatial-space-kind-modifiers" },
              text: theme && theme.modifierLabels.length > 0 ? theme.modifierLabels.join(", ") : "—",
            }),
          ],
        }),
        el("div", { class: "spatial-space-kind-thumb", children: [renderSpatialCardThumb(card)] }),
      ],
    });
  }
  const kindPanel = !space && card ? roomKindPanel(card) : undefined;
  const filters: Array<typeof spaceChromeState.environment> = ["all", "interior", "outdoor"];
  return el("div", {
    class: "spatial-canvas spatial-spaces-canvas",
    attrs: { tabindex: "0", "aria-label": "공간 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [
      el("div", {
        class: "spatial-space-env",
        children: filters.map((id) => el("button", {
          class: `spatial-source-chip${spaceChromeState.environment === id ? " is-active" : ""}`,
          text: id === "all" ? "모두" : id === "interior" ? "실내" : "실외",
          attrs: { type: "button", "aria-pressed": String(spaceChromeState.environment === id) },
          dataset: { testid: `spatial-env-${id}` },
          on: { click: () => { spaceChromeState.environment = id; rerender(); } },
        })),
      }),
      gallery,
      kindPanel ?? el("div", { class: "spatial-canvas-camera", children: [board] }),
    ],
  });
}
