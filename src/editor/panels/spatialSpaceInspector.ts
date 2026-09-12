import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { cardSubtitle, spatialSourceLabel } from "@/editor/panels/spatialFeedback";
import { roomKindOf } from "@/editor/panels/spatialGallery";
import { interiorThemeCards } from "@/editor/panels/structureKitDbSources";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { mutateWorkingSpace, spaceDeletePreview, workingProject, workingSpace } from "@/editor/panels/spatialSpaceCommands";
import {
  spaceEnvironmentControls,
  spaceShapeControls,
  spaceSizeControls,
} from "@/editor/panels/spatialSpaceInspectorControls";
import { listPlacedSpaceMembers, memberChips } from "@/editor/panels/spatialSpaceMembers";
import { issuePlacedSpaceEdit } from "@/editor/panels/spatialSpacePlacedActions";
import { setSlotChips, setSlotRequired, spaceDraftTarget, type SpaceDraftTarget } from "@/editor/panels/spatialSpaceDraft";
import { el } from "@/util/dom";

export function renderSpatialSpacesInspector(
  card: SpatialGalleryCard | undefined,
  open: boolean,
  rerender: () => void,
): HTMLElement {
  const space = workingSpace(card);
  const target = card ? spaceDraftTarget(card) : undefined;
  const body: HTMLElement[] = [];
  if (card) {
    body.push(el("h3", { class: "spatial-inspector-name", text: card.name }));
    const subtitle = cardSubtitle(card);
    if (subtitle) body.push(el("p", { class: "spatial-inspector-sub", text: subtitle }));
    body.push(el("dl", {
      class: "spatial-inspector-facts",
      children: [
        el("dt", { text: "분류" }),
        el("dd", { text: spatialSourceLabel(card) }),
        ...(card.missingSource
          ? [el("dt", { text: "원본" }), el("dd", { class: "spatial-card-badge is-missing", text: "없음" })]
          : []),
      ],
    }));
  }
  // 설계 레코드가 있는 카드는 방 종류로 오인하면 안 된다 — id 충돌 방지로 !space 일 때만 본다.
  const kind = card && !space ? roomKindOf(card) : undefined;
  if (kind) {
    const theme = interiorThemeCards(undefined, [kind])[0];
    body.push(el("dl", {
      class: "spatial-inspector-facts",
      dataset: { testid: "spatial-space-kind-facts" },
      children: [
        el("dt", { text: "필수 역할" }),
        el("dd", { text: theme && theme.roles.length > 0 ? theme.roles.map((role) => role.label).join(", ") : "없음" }),
        el("dt", { text: "분위기" }),
        el("dd", { text: theme && theme.modifierLabels.length > 0 ? theme.modifierLabels.join(", ") : "—" }),
      ],
    }));
    body.push(el("p", {
      class: "spatial-readonly-note",
      text: "방 종류는 읽기 전용입니다 — 「시공」으로 실내를 만들거나 「추가」로 설계를 시작하세요.",
      dataset: { testid: "spatial-readonly-note" },
    }));
  }
  if (space && target) {
    body.push(spaceShapeControls(space, target, rerender));
    body.push(spaceSizeControls(space, target, rerender));
    body.push(spaceEnvironmentControls(space, target, rerender));
    body.push(...memberFields(space, target, rerender));
    const port = space.ports.find((entry) => entry.id === spaceChromeState.selectedPortId);
    if (port) {
      body.push(el("p", {
        class: "spatial-inspector-sub",
        text: `${port.name} (${port.x},${port.y})`,
        dataset: { testid: "spatial-port-label" },
      }));
    }
  }
  if (spaceChromeState.deleteOpen) {
    const impact = spaceDeletePreview(card);
    body.push(el("div", {
      class: "spatial-space-impact",
      dataset: { testid: "spatial-delete-impact" },
      children: [
        el("p", { text: `참조 ${impact?.strong.length ?? 0}` }),
        el("p", { text: `스냅샷 ${impact?.historical.length ?? 0}` }),
      ],
    }));
  }
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: body,
  });
}

function memberFields(space: ReturnType<typeof workingSpace>, target: SpaceDraftTarget, rerender: () => void): HTMLElement[] {
  const slotId = spaceChromeState.selectedSlotId;
  if (!slotId || !space) return [];
  const occurrenceId = target.occurrenceId;
  if (occurrenceId && spaceChromeState.selectedIndex !== null) {
    const view = listPlacedSpaceMembers(workingProject(), occurrenceId)
      .find((entry) => entry.member.slotId === slotId && entry.member.index === spaceChromeState.selectedIndex);
    const slot = view?.slot;
    if (!view || !slot) return [];
    return [
      requiredField(slot.required, (checked) => {
        mutateWorkingSpace(target, (current) => setSlotRequired(current, slotId, checked));
        rerender();
      }),
      quantityField(slot.quantity, (quantity) => {
        issuePlacedSpaceEdit(workingProject(), occurrenceId, {
          kind: "quantity", slotId, quantity,
          positions: Array.from({ length: Math.max(0, quantity - slot.quantity) }, (_, offset) => (
            { x: view.child.x + offset + 1, y: view.child.y }
          )),
        });
        rerender();
      }),
      chipsField(memberChips(view.child).join(","), (chips) => {
        issuePlacedSpaceEdit(workingProject(), occurrenceId, { kind: "chips", member: view.member, chips });
        rerender();
      }),
      el("button", {
        class: "spatial-source-chip",
        text: "선택 삭제",
        attrs: { type: "button" },
        dataset: { testid: "spatial-member-remove" },
        on: {
          click: () => {
            issuePlacedSpaceEdit(workingProject(), occurrenceId, { kind: "remove", member: view.member });
            spaceChromeState.selectedSlotId = null;
            spaceChromeState.selectedIndex = null;
            rerender();
          },
        },
      }),
    ];
  }
  const slot = space.objectSlots.find((entry) => entry.id === slotId);
  if (!slot) return [];
  return [
    requiredField(slot.required, (checked) => {
      mutateWorkingSpace(target, (current) => setSlotRequired(current, slot.id, checked));
      rerender();
    }),
    chipsField((slot.chipOverrides ?? []).join(","), (chips) => {
      mutateWorkingSpace(target, (current) => setSlotChips(current, slot.id, chips));
      rerender();
    }),
  ];
}

function requiredField(required: boolean, onChange: (checked: boolean) => void): HTMLElement {
  return el("label", {
    class: "spatial-space-field",
    children: [
      el("span", { text: "필수" }),
      el("input", {
        attrs: { type: "checkbox", ...(required ? { checked: "" } : {}) },
        dataset: { testid: "spatial-slot-required" },
        on: { change: (event) => {
          const box = event.target;
          if (box instanceof HTMLInputElement) onChange(box.checked);
        } },
      }),
    ],
  });
}

function quantityField(quantity: number, onChange: (value: number) => void): HTMLElement {
  return el("label", {
    class: "spatial-space-field",
    children: [
      el("span", { text: "용량" }),
      el("input", {
        attrs: { type: "number", min: "0", value: String(quantity) },
        dataset: { testid: "spatial-slot-quantity" },
        on: { change: (event) => {
          const input = event.target;
          if (!(input instanceof HTMLInputElement)) return;
          const value = Number(input.value);
          if (Number.isSafeInteger(value) && value >= 0) onChange(value);
        } },
      }),
    ],
  });
}

function chipsField(value: string, onChange: (chips: readonly string[]) => void): HTMLElement {
  return el("label", {
    class: "spatial-space-field",
    children: [
      el("span", { text: "칩" }),
      el("input", {
        attrs: { type: "text", value },
        dataset: { testid: "spatial-slot-chips" },
        on: { change: (event) => {
          const input = event.target;
          if (input instanceof HTMLInputElement) onChange(input.value.split(",").map((part) => part.trim()).filter(Boolean));
        } },
      }),
    ],
  });
}
