import type { ActorInitialEquipment, ActorRecord, EquipmentRecord, EquipmentStatBonuses } from "@/project/types";
import type { StatusMenuFunctionSceneOptions } from "@/player/playerStatusMenuFunctionTypes";
import { EQUIPMENT_SLOTS, STAT_LABELS } from "@/player/playerStatusMenuFunctionTypes";
import { actorFaceTile, actionButton, classicScene, classicWindow, descriptionStrip, entryIcon } from "@/player/playerStatusMenuClassicDom";
import { actorLevel, actorVitals, className, equipmentName, equipmentStats, partyActors, totalEquipmentStats } from "@/player/playerStatusMenuFunctionData";
import { canEquip } from "@/player/playerEquipmentRules";
import { el } from "@/util/dom";

export function renderEquipmentScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const actors = partyActors(options.project, options.session);
  const actor = actors.find((record) => record.id === options.equipmentActorId);
  if (!actor) return renderEquipmentActorSelect(options);
  const selectedSlot = options.equipmentSlotId ?? "weapon";
  const choices = equipmentChoices(options, actor, selectedSlot);
  const selected = choices[0];
  return classicScene({ commandId: "equipment", title: "장비", testId: "status-menu-classic-equipment-detail", className: "status-menu-classic-equipment-scene", children: [
    descriptionStrip(selected?.description ?? "장비를 선택하면 능력치 변화가 표시됩니다."),
    equipmentActorStrip(options, actor),
    classicWindow("status-menu-classic-equipment-stats", statCompare({ options, actor, slot: selectedSlot, next: selected }), "status-menu-classic-equipment-stats"),
    classicWindow("status-menu-classic-equipment-slots", EQUIPMENT_SLOTS.map(([slot, label]) => slotButton({ options, actorId: actor.id, slot, label, selected: slot === selectedSlot })), "status-menu-classic-equipment-slots"),
    classicWindow("status-menu-classic-equipment-list", choices.length ? choices.map((equipment) => equipmentButton({ options, actor, equipment, slot: selectedSlot })) : [
      el("div", { class: "status-menu-classic-empty-selection", text: " " }),
    ], "status-menu-classic-equipment-list"),
  ] });
}

function renderEquipmentActorSelect(options: StatusMenuFunctionSceneOptions): HTMLElement {
  return classicScene({ commandId: "equipment", title: "장비", testId: "status-menu-classic-actor-select-equipment", className: "status-menu-classic-actor-select-scene", children: [
    classicWindow("status-menu-classic-menu-list", ["Items", "Skills", "Equipment", "Save", "Status", "Row", "Formation", "Wait ON", "To Title"].map((label) =>
      el("div", { class: label === "Equipment" ? "selected" : "", text: label })
    )),
    classicWindow("status-menu-classic-party-list status-menu-classic-actor-select-list", partyActors(options.project, options.session).map((actor) => actionButton({
      testId: `status-menu-equipment-actor-${actor.id}`,
      className: "status-menu-classic-actor-row",
      children: [actorFaceTile(options.project, actor), el("div", { class: "status-menu-classic-actor-copy", children: [
        el("span", { text: actor.name }),
        el("span", { text: `L ${actorLevel(options.session, actor)}  ${actorVitals(options.session, actor.id)}` }),
        el("span", { text: equipmentSummaryShort(options, actor.id) }),
      ] })],
      onClick: () => options.actions.onSelectEquipmentActor(actor.id),
    }))),
  ] });
}

function slotButton(button: { readonly options: StatusMenuFunctionSceneOptions; readonly actorId: string; readonly slot: keyof ActorInitialEquipment; readonly label: string; readonly selected: boolean }): HTMLElement {
  const { options, actorId, slot, label, selected } = button;
  const current = options.session.actorEquipment[actorId]?.[slot];
  const currentEquipment = equipmentRecord(options.project, current);
  return actionButton({ testId: `status-menu-equipment-slot-${slot}`, className: `status-menu-classic-equipment-slot${selected ? " selected" : ""}`, children: [
    el("span", { class: "status-menu-classic-equipment-slot-label", text: slot === "weapon" ? "무기" : label }),
    entryIcon(options.project, currentEquipment?.iconResourceId ?? currentEquipment?.imageResourceId, equipmentName(options.project, current)),
    el("span", { class: "status-menu-classic-equipment-slot-name", text: equipmentName(options.project, current) }),
  ], onClick: () => options.actions.onSelectEquipmentSlot(actorId, slot) });
}

function equipmentButton(button: { readonly options: StatusMenuFunctionSceneOptions; readonly actor: ActorRecord; readonly equipment: EquipmentRecord; readonly slot: keyof ActorInitialEquipment }): HTMLElement {
  const { options, actor, equipment, slot } = button;
  const current = equipmentStats(options.project, options.session.actorEquipment[actor.id]?.[slot]);
  return actionButton({ testId: `status-menu-equipment-item-${equipment.id}`, className: "status-menu-classic-equipment-item", children: [
    entryIcon(options.project, equipment.iconResourceId ?? equipment.imageResourceId, equipment.name),
    el("span", { text: equipment.name }),
    el("span", { class: "status-menu-entry-effect", text: compactStatLine(equipment.statBonuses), dataset: { testid: "status-menu-entry-effect" } }),
    el("span", { class: "status-menu-classic-equipment-count", text: String(options.session.inventory[equipment.id] ?? 0) }),
    el("span", { class: "status-menu-entry-performance", text: compactDiffLine(equipment.statBonuses, current), dataset: { testid: "status-menu-entry-performance" } }),
  ], onClick: () => options.actions.onEquipItem(actor.id, equipment.id), disabled: (options.session.inventory[equipment.id] ?? 0) <= 0 && options.session.actorEquipment[actor.id]?.[equipment.slot] !== equipment.id });
}

function equipmentActorStrip(options: StatusMenuFunctionSceneOptions, actor: ActorRecord): HTMLElement {
  const vitals = options.session.actorVitals[actor.id];
  return classicWindow("status-menu-classic-actor-strip status-menu-classic-equipment-actor-strip", [
    actorFaceTile(options.project, actor, "equipment"),
    el("span", { text: actor.name }),
    el("span", { text: `Lv ${actorLevel(options.session, actor)}` }),
    el("span", { text: className(options.project, actor) }),
    el("span", { text: vitals ? `HP ${vitals.hp} / ${vitals.maxHp}` : "HP 0 / 0" }),
    el("span", { text: vitals ? `MP ${vitals.mp} / ${vitals.maxMp}` : "MP 0 / 0" }),
  ], "status-menu-classic-actor-strip");
}

function statCompare(compare: { readonly options: StatusMenuFunctionSceneOptions; readonly actor: ActorRecord; readonly slot: keyof ActorInitialEquipment; readonly next: EquipmentRecord | undefined }): readonly HTMLElement[] {
  const { options, actor, slot, next } = compare;
  const current = totalEquipmentStats(options.project, options.session, actor.id);
  const currentSlot = equipmentStats(options.project, options.session.actorEquipment[actor.id]?.[slot]);
  const candidate = replaceSlotStats(current, currentSlot, next?.statBonuses);
  return STAT_LABELS.map(([key, label]) => el("div", {
    class: "status-menu-classic-label-value",
    children: [
      el("span", { text: label }),
      el("span", { text: `${current[key]} > ${candidate[key]}` }),
    ],
  }));
}

function replaceSlotStats(
  current: EquipmentStatBonuses,
  previous: EquipmentStatBonuses,
  next: EquipmentStatBonuses | undefined,
): EquipmentStatBonuses {
  const replacement = next ?? previous;
  return {
    attack: current.attack - previous.attack + replacement.attack,
    defense: current.defense - previous.defense + replacement.defense,
    mind: current.mind - previous.mind + replacement.mind,
    agility: current.agility - previous.agility + replacement.agility,
  };
}

function equipmentChoices(options: StatusMenuFunctionSceneOptions, actor: ActorRecord, slot: keyof ActorInitialEquipment): readonly EquipmentRecord[] {
  return options.project.database.equipment.filter((equipment) => equipment.slot === slot && canEquip(options.project, actor, equipment));
}

function equipmentRecord(project: StatusMenuFunctionSceneOptions["project"], equipmentId: string | undefined): EquipmentRecord | undefined {
  return project.database.equipment.find((record) => record.id === equipmentId);
}

function equipmentSummaryShort(options: StatusMenuFunctionSceneOptions, actorId: string): string {
  const equipment = options.session.actorEquipment[actorId] ?? {};
  return EQUIPMENT_SLOTS.slice(0, 3).map(([slot]) => equipmentName(options.project, equipment[slot])).join(" / ");
}

function compactStatLine(stats: EquipmentStatBonuses): string {
  return `A${signed(stats.attack)} D${signed(stats.defense)}`;
}

function compactDiffLine(next: EquipmentStatBonuses, current: EquipmentStatBonuses): string {
  return `A${signed(next.attack - current.attack)} D${signed(next.defense - current.defense)}`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}
