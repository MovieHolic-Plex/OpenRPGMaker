import type { ActorRecord, SkillRecord } from "@/project/types";
import type { StatusMenuFunctionSceneOptions } from "@/player/playerStatusMenuFunctionTypes";
import { EQUIPMENT_SLOTS, STAT_LABELS } from "@/player/playerStatusMenuFunctionTypes";
import { actorFaceTile, actionButton, classicScene, classicWindow, descriptionStrip } from "@/player/playerStatusMenuClassicDom";
import { actorLevel, className, equipmentName, learnedSkills, partyActors, rowLabel, totalEquipmentStats } from "@/player/playerStatusMenuFunctionData";
import { el } from "@/util/dom";

export function renderSkillScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const actors = partyActors(options.project, options.session);
  const actor = actors.find((record) => record.id === options.skillActorId);
  if (!actor) {
    return renderActorSelect({
      options,
      commandId: "skills",
      title: "스킬",
      testId: "status-menu-classic-actor-select-skills",
      rowPrefix: "status-menu-skill-actor",
      onSelect: options.actions.onSelectSkillActor,
    });
  }
  const skills = learnedSkills(options.project, options.session, actor);
  const selected = skills.find((skill) => skill.id === options.selectedSkillId) ?? skills[0];
  return classicScene({ commandId: "skills", title: "스킬", testId: "status-menu-classic-skill-detail", className: "status-menu-classic-skill-scene", children: [
    descriptionStrip(selected ? `${selected.description}  ${skillEffect(selected)}` : " "),
    actorStrip(options, actor),
    classicWindow("status-menu-classic-skill-list", skills.length
      ? skills.map((skill) => skillButton({ options, actor, skill, selected: selected?.id === skill.id }))
      : [el("div", { class: "status-menu-classic-empty-selection", text: " " })], "status-menu-classic-skill-list"),
  ] });
}

export function renderStatusScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const actor = partyActors(options.project, options.session)[0];
  if (!actor) return classicScene({ commandId: "status", title: "상태", testId: "status-menu-classic-status", className: "status-menu-classic-status-scene", children: [descriptionStrip("파티원이 없습니다.")] });
  const vitals = options.session.actorVitals[actor.id];
  const stats = totalEquipmentStats(options.project, options.session, actor.id);
  const equipment = options.session.actorEquipment[actor.id] ?? {};
  return classicScene({ commandId: "status", title: "상태", testId: "status-menu-classic-status", className: "status-menu-classic-status-scene", children: [
    classicWindow("status-menu-classic-status-left", [
      actorFaceTile(options.project, actor, "large"),
      labelValue("Name", actor.name),
      labelValue("Class", className(options.project, actor)),
      labelValue("Nickname", actor.nickname || "None"),
      labelValue("State", "Normal"),
      labelValue("Level", String(actorLevel(options.session, actor))),
      labelValue("Row", rowLabel(options.session.actorRows[actor.id])),
    ], "status-menu-classic-status-left"),
    classicWindow("status-menu-classic-status-vitals", [
      labelValue("HP", vitals ? `${vitals.hp}/ ${vitals.maxHp}` : "0/ 0"),
      labelValue("MP", vitals ? `${vitals.mp}/ ${vitals.maxMp}` : "0/ 0"),
      labelValue("E", "0/ 718"),
    ], "status-menu-classic-status-vitals"),
    classicWindow("status-menu-classic-status-stats", STAT_LABELS.map(([key, label]) => labelValue(label, String(stats[key])))),
    classicWindow("status-menu-classic-status-equipment", EQUIPMENT_SLOTS.map(([slot, label]) => labelValue(slot === "weapon" ? "Weapon" : label, equipmentName(options.project, equipment[slot]))), "status-menu-classic-status-equipment"),
  ] });
}

export function renderRowScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  return classicScene({ commandId: "row", title: "열", testId: "status-menu-classic-row", className: "status-menu-classic-row-scene", children: [
    descriptionStrip("Row: 전투에서 캐릭터의 전열/후열을 전환합니다. 전열은 앞줄, 후열은 뒷줄입니다."),
    classicWindow("status-menu-classic-party-list status-menu-classic-row-list", partyActors(options.project, options.session).map((actor) => actionButton({
      testId: `status-menu-row-${actor.id}`,
      className: "status-menu-classic-actor-row",
      children: [actorFaceTile(options.project, actor, "compact"), el("div", { class: "status-menu-classic-actor-copy", children: [
        el("span", { text: `${actor.name}  ${rowLabel(options.session.actorRows[actor.id])}` }),
      ] })],
      onClick: () => options.actions.onToggleRow(actor.id),
    }))),
  ] });
}

export function renderFormationScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const actors = partyActors(options.project, options.session);
  const selectedIndex = actors.findIndex((actor) => actor.id === options.formationActorId);
  const hint = selectedIndex >= 0
    ? `${actors[selectedIndex]?.name ?? ""}: 이동할 위치를 고르세요.`
    : "Formation / Order: 파티 순서를 바꿉니다. 먼저 캐릭터를 고르세요.";
  return classicScene({ commandId: "formation", title: "진형", testId: "status-menu-classic-formation", className: "status-menu-classic-formation-scene", children: [
    descriptionStrip(hint),
    classicWindow("status-menu-classic-party-list status-menu-classic-formation-list", actors.map((actor, index) => formationRow({ options, actor, index, selectedIndex }))),
  ] });
}

type ActorSelectOptions = {
  readonly options: StatusMenuFunctionSceneOptions;
  readonly commandId: "skills" | "equipment";
  readonly title: string;
  readonly testId: string;
  readonly rowPrefix: string;
  readonly onSelect: (actorId: string) => void;
};

function renderActorSelect(select: ActorSelectOptions): HTMLElement {
  const { options, commandId, title, testId, rowPrefix, onSelect } = select;
  return classicScene({ commandId, title, testId, className: "status-menu-classic-actor-select-scene", children: [
    classicWindow("status-menu-classic-menu-list", ["Items", "Skills", "Equipment", "Save", "Status", "Row", "Formation", "Wait ON", "To Title"].map((label) =>
      el("div", { class: label === title || label === "Skills" && title === "스킬" || label === "Equipment" && title === "장비" ? "selected" : "", text: label })
    )),
    classicWindow("status-menu-classic-party-list status-menu-classic-actor-select-list", partyActors(options.project, options.session).map((actor) => actionButton({
      testId: `${rowPrefix}-${actor.id}`,
      className: "status-menu-classic-actor-row",
      children: [actorFaceTile(options.project, actor, "select"), actorSummary(options, actor)],
      onClick: () => onSelect(actor.id),
    }))),
  ] });
}

export function actorStrip(options: StatusMenuFunctionSceneOptions, actor: ActorRecord): HTMLElement {
  const vitals = options.session.actorVitals[actor.id];
  return classicWindow("status-menu-classic-actor-strip", [
    el("span", { text: actor.name }),
    el("span", { text: `L ${actorLevel(options.session, actor)}` }),
    el("span", { text: "Normal" }),
    el("span", { text: vitals ? `HP ${vitals.hp}/ ${vitals.maxHp}` : "HP 0/ 0" }),
    el("span", { text: vitals ? `MP ${vitals.mp}/ ${vitals.maxMp}` : "MP 0/ 0" }),
  ], "status-menu-classic-actor-strip");
}

function actorSummary(options: StatusMenuFunctionSceneOptions, actor: ActorRecord): HTMLElement {
  const vitals = options.session.actorVitals[actor.id];
  return el("div", { class: "status-menu-classic-actor-copy", children: [
    el("span", { text: actor.name }),
    el("span", { text: `${className(options.project, actor)}  L ${actorLevel(options.session, actor)}  ${rowLabel(options.session.actorRows[actor.id])}` }),
    el("span", { text: vitals ? `HP ${vitals.hp}/${vitals.maxHp}   MP ${vitals.mp}/${vitals.maxMp}` : "HP 0/0   MP 0/0" }),
  ] });
}

function skillButton(button: { readonly options: StatusMenuFunctionSceneOptions; readonly actor: ActorRecord; readonly skill: SkillRecord; readonly selected: boolean }): HTMLElement {
  const { options, actor, skill, selected } = button;
  return actionButton({ testId: `status-menu-skill-${actor.id}-${skill.id}`, className: `status-menu-classic-skill-row${selected ? " selected" : ""}`, children: [
    el("span", { text: skill.name }),
    el("span", { text: `MP ${skill.mpCost.flat}` }),
    el("span", { class: "status-menu-entry-effect", text: skillEffect(skill), dataset: { testid: "status-menu-entry-effect" } }),
    el("span", { class: "status-menu-entry-performance", text: `위력 ${skill.power} / 성공 ${skill.successRate}%`, dataset: { testid: "status-menu-entry-performance" } }),
  ], onClick: () => options.actions.onSelectSkill(skill.id) });
}

function formationRow(row: { readonly options: StatusMenuFunctionSceneOptions; readonly actor: ActorRecord; readonly index: number; readonly selectedIndex: number }): HTMLElement {
  const { options, actor, index, selectedIndex } = row;
  const isSelected = index === selectedIndex;
  const targetIndex = selectedIndex >= 0 && index !== selectedIndex ? index : undefined;
  return actionButton({ testId: `status-menu-formation-actor-${actor.id}`, className: `status-menu-classic-formation-row${isSelected ? " selected" : ""}`, children: [
    actorFaceTile(options.project, actor, "compact"),
    el("span", { text: `${index + 1}. ${actor.name}` }),
    el("span", { class: "status-menu-classic-formation-note", text: formationRowNote(index, selectedIndex) }),
  ], onClick: () => {
    if (targetIndex !== undefined && options.formationActorId) {
      options.actions.onMoveFormationActor(options.formationActorId, targetIndex);
      return;
    }
    options.actions.onSelectFormationActor(actor.id);
  } });
}

function formationRowNote(index: number, selectedIndex: number): string {
  if (selectedIndex < 0) return "선택";
  if (index === selectedIndex) return "이동 중";
  if (index < selectedIndex) return "위로";
  if (index > selectedIndex) return "아래로";
  return " ";
}

function labelValue(label: string, value: string): HTMLElement {
  return el("div", { class: "status-menu-classic-label-value", children: [el("span", { text: label }), el("span", { text: value })] });
}

function skillEffect(skill: SkillRecord): string {
  const kind = skill.effect.kind === "healing" ? "회복" : skill.effect.kind === "damage" ? "공격" : "보조";
  return `${kind} / 명중 ${skill.hitRate}%`;
}
