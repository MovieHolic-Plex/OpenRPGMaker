import { ACTOR_RATE_GRADES, stateRatePercentage } from "@/project/actorModel";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { charsetFrameSource, EASYRPG_CHARSET_ASSETS } from "@/assets/easyrpgRtp";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { ActorRateGrade, ClassBattleCommandKind, ClassRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { classCurveCards } from "./databaseClassCurveEditors";
import { renderClassExperiencePanel } from "./databaseClassExperienceCurveEditor";

const COMMAND_KINDS: readonly ClassBattleCommandKind[] = ["attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event"];
const COMMAND_KIND_LABELS: Record<ClassBattleCommandKind, string> = {
  attack: "공격",
  skill: "특수기능",
  skillSubset: "특수계열",
  defend: "방어",
  guard: "방어",
  item: "아이템",
  capture: "포획",
  escape: "도망",
  switch: "교체",
  event: "교체(구형)",
};
const FALLBACK_CLASS_COMMANDS: ClassRecord["battleCommands"] = [
  { id: "cmd_attack", name: "공격", kind: "attack" },
  { id: "cmd_skill", name: "기술", kind: "skill" },
  { id: "cmd_item", name: "아이템", kind: "item" },
  { id: "cmd_defend", name: "방어", kind: "defend" },
  { id: "cmd_escape", name: "도주", kind: "escape" },
];
const ELEMENT_RATE_LABELS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "sword", name: "검" },
  { id: "spear", name: "창" },
  { id: "hit", name: "타격" },
  { id: "bow", name: "활" },
  { id: "fire", name: "불" },
  { id: "ice", name: "얼음" },
  { id: "thunder", name: "번개" },
  { id: "water", name: "물" },
  { id: "earth", name: "대지" },
  { id: "wind", name: "바람" },
  { id: "holy", name: "성" },
];

export function renderClassRecordForm(form: HTMLElement, record: ClassRecord): void {
  const curveGrid = el("div", { class: "db-class-curves-grid" });
  const expPanel = el("div", { class: "db-class-exp-content" });
  const refreshCurves = (): void => curveGrid.replaceChildren(...classCurveCards(record, refreshCurves));
  const refreshExp = (): void => renderClassExperiencePanel(record, expPanel, refreshExp);
  refreshCurves();
  refreshExp();

  form.append(el("div", {
    class: "db-class-bm88-workbench",
    dataset: { testid: "db-classes-bm88-workbench" },
    children: [
      panel("이름", [nameInput(record)]),
      panel("애니메이션", [spritePreview(record), animationSelect(record)]),
      panel("능력치 곡선", [curveGrid]),
      panel("경험치 곡선", [expPanel]),
      panel("전투 명령", battleCommandControls(record)),
      panel("옵션", optionControls(record)),
      panel("스킬", [skillTable(record)]),
      panel("승급", promotionControls(record)),
      panel("상태 유효도", rateRows(record, "state")),
      panel("속성 유효도", rateRows(record, "element")),
      panel("장비", [equipmentSelect(record)]),
    ],
  }));
}

function nameInput(record: ClassRecord): HTMLElement {
  const input = el("input", {
    value: record.name,
    dataset: { testid: "db-field-name" },
    attrs: { maxlength: "12", type: "text" },
  }) as HTMLInputElement;
  input.addEventListener("input", () => updateDatabaseRecord("classes", record.id, { name: input.value }));
  return el("label", { class: "db-field db-class-name-field", children: [el("span", { text: "직업명" }), input] });
}

function spritePreview(record: ClassRecord): HTMLElement {
  const asset = EASYRPG_CHARSET_ASSETS[0];
  const url = resolveAssetResourceUrl(asset.id, { project: store.getCurrent() });
  const source = charsetFrameSource({ characterIndex: 0, direction: "down", pattern: 1 });
  const style = url
    ? [
      `--class-sprite-url:url("${url}")`,
      `--class-sprite-x:-${source.x * 2}px`,
      `--class-sprite-y:-${source.y * 2}px`,
    ].join(";")
    : "";
  return el("div", {
    class: "db-class-sprite-preview",
    attrs: { role: "img", "aria-label": `${record.name} 캐릭터 미리보기`, style },
    children: [el("span")],
  });
}

function animationSelect(record: ClassRecord): HTMLElement {
  return selectFromRecords("전투 애니메이션", "db-picker-class-animation", record.animationId ?? "", store.getCurrent().database.battleAnimations, (animationId) =>
    updateDatabaseRecord("classes", record.id, { animationId: animationId || undefined })
  );
}

function battleCommandControls(record: ClassRecord): HTMLElement[] {
  const commands = classCommandsWithChange(record);
  const rows = commands.map((command, index) => {
    const name = el("input", {
      value: command.name,
      dataset: index === 0 ? { testid: "db-field-class-command-name" } : undefined,
      attrs: { type: "text" },
    }) as HTMLInputElement;
    const kind = kindSelect(command.kind, index === 0 ? "db-field-class-command-kind" : undefined);
    const subset = el("input", {
      value: command.skillSubsetName ?? "",
      dataset: index === 0 ? { testid: "db-field-class-command-subset" } : undefined,
      attrs: { type: "text", placeholder: "스킬 그룹" },
    }) as HTMLInputElement;
    const skill = recordSelect(command.skillId ?? "", store.getCurrent().database.skills, index === 0 ? "db-picker-class-command-skill" : undefined);
    if (command.id !== "cmd_change") {
      const apply = (): void => updateDatabaseRecord("classes", record.id, {
        battleCommands: replaceClassCommand(record, index, {
          ...command,
          name: name.value,
          kind: readCommandKind(kind.value),
          skillSubsetName: subset.value || undefined,
          skillId: skill.value || undefined,
        }),
      });
      name.addEventListener("input", apply);
      kind.addEventListener("change", apply);
      subset.addEventListener("input", apply);
      skill.addEventListener("change", apply);
    } else {
      name.readOnly = true;
      kind.disabled = true;
      subset.readOnly = true;
      skill.disabled = true;
    }
    return el("div", { class: "db-class-command-row", children: [name, kind, subset, skill] });
  });
  return [el("button", { class: "db-class-set-button", text: "설정", attrs: { type: "button", title: "명령 순서 편집 (준비 중)" }, on: { click: () => toast("전투 명령 순서 편집은 준비 중입니다. 각 행에서 직접 이름과 종류를 편집하세요.", "info") } }), el("div", { class: "db-class-command-rows", children: rows })];
}

function optionControls(record: ClassRecord): HTMLElement[] {
  return [
    checkboxField(record, "dualWield", "양손 무기", "db-field-class-option-dualWield"),
    checkboxField(record, "fixedEquipment", "장비 고정", "db-field-class-option-fixedEquipment"),
    checkboxField(record, "autoBattle", "자동 전투", "db-field-class-option-autoBattle"),
    checkboxField(record, "mightyGuard", "강력 방어", "db-field-class-option-mightyGuard"),
  ];
}

function skillTable(record: ClassRecord): HTMLElement {
  const skills = store.getCurrent().database.skills;
  const rows = record.learnedSkills.length > 0 ? record.learnedSkills : [{ level: 1, skillId: "" }];
  const body = rows.map((entry, index) => {
    const level = el("input", {
      value: entry.level,
      dataset: index === 0 ? { testid: "db-field-class-skill-level" } : undefined,
      attrs: { min: "1", max: "99", type: "number" },
    }) as HTMLInputElement;
    const skill = recordSelect(entry.skillId, skills, index === 0 ? "db-picker-class-skill" : undefined);
    const saveSkill = (): void => {
      const nextSkill = { ...entry, level: numericValue(level, 1), skillId: skill.value };
      updateDatabaseRecord("classes", record.id, { learnedSkills: index === 0 ? [nextSkill] : replaceSkill(record, index, nextSkill) });
    };
    level.addEventListener("input", saveSkill);
    level.addEventListener("change", saveSkill);
    skill.addEventListener("input", saveSkill);
    skill.addEventListener("change", saveSkill);
    return el("div", { class: "db-class-skill-table-row", children: [level, skill] });
  });
  const fillerRows = Array.from({ length: Math.max(0, 12 - body.length) }, () =>
    el("div", { class: "db-class-skill-table-row db-class-skill-table-row-empty", children: [el("span"), el("span")] })
  );
  body.push(...fillerRows);
  return el("div", {
    class: "db-class-skill-table",
    children: [el("div", { class: "db-class-skill-table-head", children: [el("span", { text: "레벨" }), el("span", { text: "스킬" })] }), ...body],
  });
}

function equipmentSelect(record: ClassRecord): HTMLElement {
  return selectFromRecords("허용 장비", "db-picker-class-equipment", record.equipmentPermissions.equipmentIds[0] ?? "", store.getCurrent().database.equipment, (equipmentId) =>
    updateDatabaseRecord("classes", record.id, { equipmentPermissions: { ...record.equipmentPermissions, equipmentIds: equipmentId ? [equipmentId] : [] } })
  );
}

function promotionControls(record: ClassRecord): HTMLElement[] {
  const promotions = record.promotions?.length ? record.promotions : [{ toClassId: "", requires: {} }];
  const rows = promotions.map((promotion, index) => {
    const project = store.getCurrent();
    const toClass = recordSelect(promotion.toClassId, project.database.classes, index === 0 ? "db-picker-class-promotion-to" : undefined);
    const level = numberInput(promotion.requires.level, "레벨", index === 0 ? "db-field-class-promotion-level" : undefined);
    const switchId = recordSelect(promotion.requires.switchId ?? "", storyFlagRecords("switch"), index === 0 ? "db-picker-class-promotion-switch" : undefined);
    const itemId = recordSelect(promotion.requires.itemId ?? "", project.database.items, index === 0 ? "db-picker-class-promotion-item" : undefined);
    const variableId = recordSelect(promotion.requires.variableId ?? "", storyFlagRecords("variable"), index === 0 ? "db-picker-class-promotion-variable" : undefined);
    const atLeast = numberInput(promotion.requires.atLeast, "이상", index === 0 ? "db-field-class-promotion-at-least" : undefined);
    const remove = el("button", { class: "db-class-set-button", text: "삭제", attrs: { type: "button" } });
    const apply = (): void => savePromotion(record, index, {
      toClassId: toClass.value,
      requires: {
        level: optionalNumber(level),
        switchId: switchId.value || undefined,
        itemId: itemId.value || undefined,
        variableId: variableId.value || undefined,
        atLeast: optionalNumber(atLeast),
      },
    });
    for (const input of [toClass, level, switchId, itemId, variableId, atLeast]) {
      input.addEventListener("change", apply);
      input.addEventListener("input", apply);
    }
    remove.addEventListener("click", () => {
      const next = [...(currentClass(record).promotions ?? [])];
      next.splice(index, 1);
      updateDatabaseRecord("classes", record.id, { promotions: next });
    });
    return el("div", {
      class: "db-class-command-row",
      children: [toClass, level, switchId, itemId, variableId, atLeast, remove],
    });
  });
  const add = el("button", {
    class: "db-class-set-button",
    text: "승급 추가",
    attrs: { type: "button" },
    on: {
      click: () => updateDatabaseRecord("classes", record.id, {
        promotions: [...(currentClass(record).promotions ?? []), { toClassId: firstPromotionTarget(record), requires: {} }],
      }),
    },
  });
  return [add, el("div", { class: "db-class-command-rows", children: rows })];
}

function savePromotion(record: ClassRecord, index: number, promotion: NonNullable<ClassRecord["promotions"]>[number]): void {
  const source = currentClass(record).promotions ?? [];
  const next = [...source];
  if (!promotion.toClassId) next.splice(index, 1);
  else next[index] = promotion;
  updateDatabaseRecord("classes", record.id, { promotions: next });
}

function currentClass(record: ClassRecord): ClassRecord {
  return store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? record;
}

function firstPromotionTarget(record: ClassRecord): string {
  return store.getCurrent().database.classes.find((entry) => entry.id !== record.id)?.id ?? "";
}

function numberInput(value: number | undefined, title: string, testid?: string): HTMLInputElement {
  return el("input", {
    value: value ?? "",
    dataset: testid ? { testid } : undefined,
    attrs: { type: "number", min: "0", title, placeholder: title },
  }) as HTMLInputElement;
}

function optionalNumber(input: HTMLInputElement): number | undefined {
  return input.value.trim().length > 0 && Number.isFinite(input.valueAsNumber) ? Math.trunc(input.valueAsNumber) : undefined;
}

function rateRows(record: ClassRecord, kind: "state" | "element"): HTMLElement[] {
  const source = kind === "state" ? [{ id: "state_death", name: "전투불능" }, ...store.getCurrent().database.states] : ELEMENT_RATE_LABELS;
  return source.map((entry) => {
    const rates = kind === "state" ? record.stateRates : record.elementRates;
    const value = rates[entry.id] ?? "C";
    const testid = kind === "state" ? `db-picker-class-state-rate-${entry.id}` : `db-picker-class-element-rate-${entry.id}`;
    const select = gradeSelect(value, testid);
    select.addEventListener("change", () => updateRate(record, kind, entry.id, select.value));
    const label = kind === "state" ? `${entry.name} ${stateRatePercentage(value)}%` : entry.name;
    return el("label", { class: "db-class-rate-row", children: [select, el("span", { text: label })] });
  });
}

function updateRate(record: ClassRecord, kind: "state" | "element", id: string, value: string): void {
  const grade = ACTOR_RATE_GRADES.find((entry) => entry === value);
  if (!grade) return;
  const current = store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? record;
  if (kind === "state") updateDatabaseRecord("classes", record.id, { stateRates: { ...current.stateRates, [id]: grade } });
  else updateDatabaseRecord("classes", record.id, { elementRates: { ...current.elementRates, [id]: grade } });
}

function checkboxField(record: ClassRecord, key: keyof ClassRecord["options"], label: string, testid: string): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = record.options[key];
  input.addEventListener("change", () => {
    const current = store.getCurrent().database.classes.find((entry) => entry.id === record.id) ?? record;
    updateDatabaseRecord("classes", record.id, { options: { ...current.options, [key]: input.checked } });
  });
  return el("label", { class: "actor-check", children: [input, el("span", { text: label })] });
}

function panel(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function selectFromRecords(label: string, testid: string, value: string, records: readonly { readonly id: string; readonly name: string }[], onChange: (value: string) => void): HTMLElement {
  const select = recordSelect(value, records, testid);
  select.addEventListener("change", () => onChange(select.value));
  return el("label", { class: "db-field", children: [el("span", { text: label }), select] });
}

function recordSelect(value: string, records: readonly { readonly id: string; readonly name: string }[], testid?: string): HTMLSelectElement {
  const select = el("select", { dataset: testid ? { testid } : undefined }) as HTMLSelectElement;
  select.append(el("option", { text: "(없음)", attrs: { value: "" } }));
  records.forEach((record) => select.append(el("option", { text: record.name, attrs: { value: record.id } })));
  select.value = value;
  return select;
}

function storyFlagRecords(kind: "switch" | "variable"): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  const records = kind === "switch" ? project.switches : project.variables;
  return records.map((record, index) => ({ id: record.id, name: storyFlagOptionLabel(project, kind, record, index) }));
}

function kindSelect(value: ClassBattleCommandKind, testid?: string): HTMLSelectElement {
  const select = el("select", { dataset: testid ? { testid } : undefined }) as HTMLSelectElement;
  COMMAND_KINDS.forEach((kind) => select.append(el("option", { text: COMMAND_KIND_LABELS[kind], attrs: { value: kind } })));
  select.value = value;
  return select;
}

function gradeSelect(value: ActorRateGrade, testid: string): HTMLSelectElement {
  const select = el("select", { dataset: { testid } }) as HTMLSelectElement;
  ACTOR_RATE_GRADES.forEach((grade) => select.append(el("option", { text: grade, attrs: { value: grade } })));
  select.value = value;
  return select;
}

function classCommandsWithChange(record: ClassRecord): ClassRecord["battleCommands"] {
  const source = record.battleCommands.length > 0 ? record.battleCommands : FALLBACK_CLASS_COMMANDS;
  const editable = source.filter((command) => command.id !== "cmd_change").slice(0, 6);
  return [...editable, { id: "cmd_change", name: "교체", kind: "switch" }];
}

function replaceClassCommand(record: ClassRecord, index: number, command: ClassRecord["battleCommands"][number]): ClassRecord["battleCommands"] {
  return classCommandsWithChange(record).map((entry, entryIndex) => (entryIndex === index ? command : entry));
}

function replaceSkill(record: ClassRecord, index: number, skill: ClassRecord["learnedSkills"][number]): ClassRecord["learnedSkills"] {
  const skills = record.learnedSkills.length > 0 ? record.learnedSkills : [{ level: 1, skillId: "" }];
  return skills.map((entry, entryIndex) => (entryIndex === index ? skill : entry));
}

function readCommandKind(value: string): ClassBattleCommandKind {
  return COMMAND_KINDS.find((kind) => kind === value) ?? "attack";
}

function numericValue(input: HTMLInputElement, fallback: number): number {
  return Number.isFinite(input.valueAsNumber) ? Math.trunc(input.valueAsNumber) : fallback;
}
