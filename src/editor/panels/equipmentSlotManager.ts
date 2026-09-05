import { addEquipmentSlot, equipmentSlots, equipmentSlotRemovalBlocker, removeEquipmentSlot, renameEquipmentSlot } from "@/project/equipmentSlots";
import { store } from "@/project/store";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { el } from "@/util/dom";

/** Inline catalog management beside the equipment's real slot selector. */
export function equipmentSlotManager(equipmentId: string, refresh: () => void): HTMLElement {
  const project = store.getCurrent();
  const name = el("input", {
    attrs: { type: "text", placeholder: "예: 신발, 망토", "aria-label": "새 장비 부위 이름" },
    dataset: { testid: "db-equipment-slot-new-label" },
  });
  const add = el("button", {
    class: "btn small", text: "부위 추가하고 선택", attrs: { type: "button" },
    dataset: { testid: "db-equipment-slot-add" },
    on: { click: () => {
      if (!name.value.trim()) { name.focus(); return; }
      recordProjectSnapshot("장비 부위 추가");
      store.update((draft) => {
        const slot = addEquipmentSlot(draft, name.value);
        const equipment = draft.database.equipment.find((record) => record.id === equipmentId)!;
        equipment.slot = slot.id;
        equipment.twoHanded = false;
      }, { scope: "database", collection: "equipment", label: "장비 부위 추가" });
      refresh();
    } },
  });
  const rows = equipmentSlots(project).map((slot) => {
    const input = el("input", {
      attrs: { type: "text", "aria-label": `${slot.label} 부위 이름` },
      dataset: { testid: `db-equipment-slot-label-${slot.id}` },
    });
    input.value = slot.label;
    input.addEventListener("change", () => {
      if (!input.value.trim()) { input.value = slot.label; return; }
      if (input.value.trim() === slot.label) return;
      recordProjectSnapshot("장비 부위 이름 변경");
      store.update((draft) => renameEquipmentSlot(draft, slot.id, input.value),
        { scope: "database", collection: "equipment", label: "장비 부위 이름 변경" });
      refresh();
    });
    const blocker = equipmentSlotRemovalBlocker(project, slot.id);
    const remove = el("button", {
      class: "btn small", text: "삭제", attrs: { type: "button" },
      dataset: { testid: `db-equipment-slot-remove-${slot.id}` },
      on: { click: () => {
        if (equipmentSlotRemovalBlocker(store.getCurrent(), slot.id)) return;
        recordProjectSnapshot("장비 부위 삭제");
        store.update((draft) => { removeEquipmentSlot(draft, slot.id); },
          { scope: "database", collection: "equipment", label: "장비 부위 삭제" });
        refresh();
      } },
    });
    remove.disabled = blocker !== undefined;
    return el("div", { class: "db-eq-grid", children: [input, remove,
      ...(blocker ? [el("small", { text: blocker === "builtin" ? "기본 부위 · 이름만 변경 가능" : "사용 중 · 장비, 초기 장비와 이벤트 참조를 먼저 변경하세요" })] : []),
    ] });
  });
  return el("details", {
    class: "db-equipment-slot-manager db-ws-span",
    dataset: { testid: "db-equipment-slot-manager" },
    children: [
      el("summary", { text: "부위 추가 · 관리", dataset: { testid: "db-equipment-slot-manage" } }),
      el("div", { class: "db-ws-stack", children: [
        el("div", { class: "db-eq-grid", children: [name, add] }), ...rows,
      ] }),
    ],
  });
}
