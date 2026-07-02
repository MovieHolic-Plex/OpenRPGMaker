import { updateEvent } from "@/editor/eventActions";
import { deleteEditorEvent } from "@/editor/eventDeletion";
import { el } from "@/util/dom";
import { field, selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, TRIGGER_OPTIONS } from "./options";
import type { GameEvent, MapId } from "@/project/types";

export function renderEventProps(mapId: MapId, ev: GameEvent): HTMLElement {
  const wrap = el("div", {});
  const posRow = el("div", { class: "field" });
  posRow.append(el("label", { text: `위치 (${ev.x}, ${ev.y})` }));
  wrap.append(posRow);
  wrap.append(field("트리거", triggerInput(mapId, ev)));
  wrap.append(field("스프라이트(비우면 숨김)", spriteInput(mapId, ev)));
  wrap.append(field("발동 조건 스위치(선택)", conditionInput(mapId, ev)));
  wrap.append(
    el("button", {
      class: "btn danger",
      text: "이벤트 삭제",
      on: {
        click: () => {
          deleteEditorEvent(mapId, ev.id);
        },
      },
    })
  );
  return wrap;
}

function triggerInput(mapId: MapId, ev: GameEvent): HTMLElement {
  const trigSel = selectWithOptions(TRIGGER_OPTIONS, ev.trigger.kind);
  trigSel.addEventListener("change", () => {
    updateEvent(mapId, ev.id, {
      trigger: { kind: selectedOptionValue(trigSel, TRIGGER_OPTIONS, ev.trigger.kind) },
    });
  });
  return trigSel;
}

function spriteInput(mapId: MapId, ev: GameEvent): HTMLElement {
  const sprite = el("input", {
    attrs: { type: "text", placeholder: "예: tex_easyrpg_charset_people1" },
    value: ev.sprite?.id ?? "",
  }) as HTMLInputElement;
  sprite.addEventListener("change", () => {
    const value = sprite.value.trim();
    updateEvent(mapId, ev.id, {
      sprite: value ? { type: "bundled", id: value } : undefined,
    });
  });
  return sprite;
}

function conditionInput(mapId: MapId, ev: GameEvent): HTMLElement {
  const row = el("span", {});
  const condSwitch = el("input", {
    attrs: { type: "text", placeholder: "스위치 ID" },
    value: ev.condition?.kind === "switch" ? ev.condition.switchId : "",
  }) as HTMLInputElement;
  const condVal = selectWithOptions(
    BOOLEAN_OPTIONS,
    ev.condition?.kind === "switch" ? String(ev.condition.value) : "true"
  );
  const applyCond = () => {
    const switchId = condSwitch.value.trim();
    if (!switchId) {
      updateEvent(mapId, ev.id, { condition: undefined });
    } else {
      updateEvent(mapId, ev.id, {
        condition: { kind: "switch", switchId, value: condVal.value === "true" },
      });
    }
  };
  condSwitch.addEventListener("change", applyCond);
  condVal.addEventListener("change", applyCond);
  row.append(condSwitch, condVal);
  return row;
}
