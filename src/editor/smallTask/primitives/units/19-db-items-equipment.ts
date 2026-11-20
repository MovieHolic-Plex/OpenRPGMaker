import ts from "typescript5";
import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { gen1CanonicalTypeForId, gen1ElementIdForCanonical } from "@/battle/typeChart";
import { clampElementListCount } from "@/editor/databaseElementList";
import { displayText } from "@/editor/smallTask/target";
import { outsideRecord, referenceIndex } from "@/editor/tools/dbReferenceIndex";
import type { JsonSchema } from "@/editor/tools/types";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { normalizeItemRecord, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { normalizeElementRecords } from "@/project/databaseUtilityRecordModel";
import { canEquip, effectiveActorEquipment, equipmentSlotAccepts, transitionActorEquipment } from "@/project/equipmentRules";
import {
  BUILTIN_EQUIPMENT_SLOTS, equipmentSlotRemovalBlocker, equipsAsSlot, hasEquipmentSlot, isEquipmentSlotId,
  removeEquipmentSlot, upsertEquipmentSlot,
} from "@/project/equipmentSlots";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { dynamicRefKinds, forEachProjectScript, scriptCommandEffects } from "@/project/script/effects";
import type { ScriptModule } from "@/project/script/types";
import type { ActorRecord, Command, ItemRecord, EquipmentRecord, DatabaseElementRecord, EquipmentSlotRecord, Project } from "@/project/types";
import { genId } from "@/util/id";
import { roJosa } from "@/util/josa";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";

export const UNIT = "19-db-items-equipment";

type Records = {
  items: ItemRecord;
  equipment: EquipmentRecord;
  equipmentSlots: EquipmentSlotRecord;
  elements: DatabaseElementRecord;
};
type Collection = keyof Records;
type Args = Record<string, unknown>;
type Edit = "create" | "update" | "delete";
type ItemArgs = Partial<Pick<ItemRecord, "name" | "description" | "price" | "type" | "scope" | "occasion" | "consumable" | "skillId" | "switchId">> & {
  hpRecovery?: number;
  mpRecovery?: number;
};
type EquipmentArgs = Partial<Pick<EquipmentRecord, "name" | "description" | "price" | "slot" | "twoHanded" | "cursed" | "attackElementIds" | "usableAsItemSkillId">> &
  Partial<EquipmentRecord["statBonuses"]>;
type SlotArgs = { label?: string; equipsAs?: string | null };
type ElementArgs = Partial<Pick<DatabaseElementRecord, "name" | "kind">>;

const labels: Readonly<Record<string, string>> = { ...DATABASE_AREA_LABELS, equipmentSlots: "장비 칸" };
const nameField = { type: "string", description: "이름", minLength: 1 } as const;
const descriptionField = { type: "string", description: "게임에서 보여 줄 설명" } as const;
const integer = (description: string, minimum: number, maximum: number): JsonSchema =>
  ({ type: "integer", description, minimum, maximum });
const priceField = integer("가격", 0, 999999);
const hpField = integer("약의 체력 고정 회복량", 0, 999);
const idField = (description: string): JsonSchema => ({ type: "string", description, minLength: 1 });

const itemFields = {
  name: nameField,
  description: descriptionField,
  price: priceField,
  type: { type: "string", enum: ["normalGoods", "medicine", "book", "seed", "special", "switch"],
    description: "일반품, 약, 책, 씨앗, 특수품, 스위치 작동 도구 중 하나" },
  scope: { type: "string", enum: ["none", "ally", "allAllies", "enemy"],
    description: "사용 대상 없음, 아군 한 명, 모든 아군, 적 한 명 중 하나" },
  occasion: { type: "string", enum: ["always", "battle", "field", "never"],
    description: "사용 가능 시점은 항상, 전투, 필드, 사용 불가 중 하나" },
  consumable: { type: "boolean", description: "쓸 때 수량을 줄일지 여부" },
  hpRecovery: hpField,
  mpRecovery: integer("약의 마력 고정 회복량", 0, 999),
  skillId: idField("특수품이 발동하거나 책이 가르치는 기존 기술의 식별자"),
  switchId: idField("스위치 작동 도구가 켜는 기존 스위치의 식별자"),
} satisfies Record<string, JsonSchema>;

const equipmentFields = {
  name: nameField,
  description: descriptionField,
  price: priceField,
  slot: idField("장비를 착용할 기존 칸의 식별자"),
  attack: integer("공격력 보정", -9999, 9999),
  defense: integer("방어력 보정", -9999, 9999),
  mind: integer("마법 능력치 보정", -9999, 9999),
  agility: integer("민첩성 보정", -9999, 9999),
  twoHanded: { type: "boolean", description: "두 손으로 드는 무기인지 여부" },
  cursed: { type: "boolean", description: "장착 후 벗기 어려운 저주 장비인지 여부" },
  attackElementIds: { type: "array", items: idField("기존 속성의 식별자"), description: "공격 속성 목록 전체. 비우려면 빈 목록" },
  usableAsItemSkillId: idField("도구처럼 사용할 때 발동하는 기존 기술의 식별자"),
} satisfies Record<string, JsonSchema>;

const slotFields = {
  label: nameField,
  equipsAs: { type: ["string", "null"], minLength: 1,
    description: "이 칸에서 함께 받는 기존 장비 칸의 식별자. 연결을 해제할 때는 null" },
} satisfies Record<string, JsonSchema>;

const elementFields = {
  name: nameField,
  kind: { type: "string", enum: ["physical", "magical"], description: "물리 방어력과 마법 방어력 중 어느 쪽을 적용할지 지정" },
} satisfies Record<string, JsonSchema>;

function targetId(ctx: PrimitiveContext, collection: Collection): string {
  const { target } = ctx;
  if (target.kind !== "dbEntry" || target.collection !== collection) {
    throw new PrimitiveError("범위 밖의 자료집 항목이에요.");
  }
  return target.id;
}

function rows<C extends Collection>(project: Project, collection: C): readonly Records[C][] {
  return (project.database[collection] ?? []) as Records[C][];
}

function selected<C extends Collection>(ctx: PrimitiveContext, collection: C): Records[C] {
  const id = targetId(ctx, collection);
  const matches = rows(ctx.project, collection).filter(row => row.id === id);
  if (matches.length > 1) throw new PrimitiveError("같은 식별자를 쓰는 항목이 여러 개 있어 선택한 항목을 구분할 수 없어요.");
  const record = matches[0] ?? (collection === "equipmentSlots" ? BUILTIN_EQUIPMENT_SLOTS.find(slot => slot.id === id) : undefined);
  if (!record) throw new PrimitiveError("선택한 자료집 항목을 찾을 수 없어요.");
  return record as Records[C];
}

function setRows<C extends Collection>(project: Project, collection: C, next: Records[C][]): Project {
  return { ...project, database: { ...project.database, [collection]: next } };
}

const prefixes: Record<Collection, string> = {
  items: "item_small", equipment: "equip_small", equipmentSlots: "slot_small", elements: "element_small",
};

function newId(project: Project, collection: Collection): string {
  // Published saves can still refer to IDs of records that have since been deleted.
  let id: string;
  do {
    id = genId(prefixes[collection]);
  } while (referenceIndex(project, new Set([id])).has(id));
  return id;
}

function scopeFor(ctx: PrimitiveContext, collection: Collection, edit: Edit, args: Args): SmallTaskScope {
  const record = selected(ctx, collection);
  const { id } = record;
  const implicitSlot = collection === "equipmentSlots" && edit === "update"
    && BUILTIN_EQUIPMENT_SLOTS.some(slot => slot.id === id)
    && !rows(ctx.project, collection).some(slot => slot.id === id);
  const createsRow = edit === "create" || (implicitSlot && typeof args.label === "string" && args.label.trim() !== nameOf(record));
  return {
    kind: "dbEntries",
    entries: edit === "create" || implicitSlot ? [] : [{ collection, id }],
    ...(createsRow ? { create: { collection, max: 1 } } : {}),
    ...(edit === "delete" ? { remove: true } : {}),
  };
}

function nameOf(record: Records[Collection]): string {
  return "label" in record ? record.label : record.name;
}

function requireName(value: string): string {
  const name = value.trim();
  if (!/[^\s\p{Cc}\p{Cf}]/u.test(name)) throw new PrimitiveError("이름을 입력해 주세요.");
  return name;
}

function visibleName(name: string, fallback: string, id?: string): string {
  const visible = displayText(name.trim().toLowerCase() === id?.toLowerCase() ? "" : name, fallback)
    .replace(/[{}\[\]「」\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").trim();
  const safe = visible || fallback;
  return safe.length > 24 ? safe.slice(0, 23) + "…" : safe;
}

function requireReference(id: string | undefined, exists: (id: string) => boolean, reason: string): void {
  if (id !== undefined && !exists(id)) throw new PrimitiveError(reason);
}

function patchItem(project: Project, record: ItemRecord, args: ItemArgs): ItemRecord {
  const { hpRecovery, mpRecovery, name, occasion, skillId, ...fields } = args;
  const type = fields.type ?? record.type;
  requireReference(skillId, id => project.database.skills.some(skill => skill.id === id), "연결할 기술을 찾을 수 없어요.");
  requireReference(fields.switchId, id => project.switches.some(switchDef => switchDef.id === id), "연결할 스위치를 찾을 수 없어요.");
  if ((hpRecovery !== undefined || mpRecovery !== undefined) && type !== "medicine") {
    throw new PrimitiveError("회복량은 종류가 ‘약’인 아이템에서 설정할 수 있어요.");
  }
  if (fields.switchId !== undefined && type !== "switch") {
    throw new PrimitiveError("스위치는 종류가 ‘스위치 작동 도구’인 아이템에 연결할 수 있어요.");
  }
  if (skillId !== undefined && type !== "book" && (type !== "special" || record.captureProfile || record.careProfile)) {
    throw new PrimitiveError("기술은 책이나 사용 시 기술을 발동하는 특수품에 연결할 수 있어요.");
  }
  return {
    ...record, ...fields,
    ...(name !== undefined ? { name: requireName(name) } : {}),
    ...(skillId !== undefined ? type === "book"
      ? { learnedSkillId: skillId }
      : { activateSkillId: skillId } : {}),
    ...(hpRecovery !== undefined ? { hpRecovery: { ...record.hpRecovery, flat: hpRecovery } } : {}),
    ...(mpRecovery !== undefined ? { mpRecovery: { ...record.mpRecovery, flat: mpRecovery } } : {}),
    ...(occasion !== undefined ? {
      occasion, occasionField: occasion === "always" || occasion === "field",
      occasionBattle: occasion === "always" || occasion === "battle",
      onlyUsableInMenu: occasion === "field",
    } : {}),
  };
}

function patchEquipment(project: Project, record: EquipmentRecord, args: EquipmentArgs): EquipmentRecord {
  const { name, attack, defense, mind, agility, attackElementIds, ...fields } = args;
  requireReference(fields.slot, id => hasEquipmentSlot(project, id), "착용할 장비 칸을 찾을 수 없어요.");
  requireReference(fields.usableAsItemSkillId, id => project.database.skills.some(skill => skill.id === id), "연결할 기술을 찾을 수 없어요.");
  for (const id of attackElementIds ?? []) {
    if (!project.database.elements?.some(element => element.id === id) && !project.system.typeChart?.types.includes(id)) {
      throw new PrimitiveError("공격에 연결할 속성을 찾을 수 없어요.");
    }
  }
  const next = {
    ...record, ...fields,
    ...(name !== undefined ? { name: requireName(name) } : {}),
    ...(attackElementIds !== undefined ? { attackElementIds: [...new Set(attackElementIds)] } : {}),
    ...(attack !== undefined || defense !== undefined || mind !== undefined || agility !== undefined ? {
      statBonuses: {
        attack: attack ?? record.statBonuses.attack, defense: defense ?? record.statBonuses.defense,
        mind: mind ?? record.statBonuses.mind, agility: agility ?? record.statBonuses.agility,
      },
    } : {}),
  };
  if (next.slot !== "weapon") {
    if (fields.twoHanded === true) throw new PrimitiveError("양손 장비는 무기 칸에만 둘 수 있어요.");
    if (fields.slot !== undefined) next.twoHanded = false;
  }
  return next;
}

function patchSlot(project: Project, id: string, args: SlotArgs, current?: EquipmentSlotRecord): Project {
  const { equipsAs } = args;
  if (!isEquipmentSlotId(id)) throw new PrimitiveError("선택한 장비 칸을 읽을 수 없어요.");
  if (typeof equipsAs === "string") {
    if (BUILTIN_EQUIPMENT_SLOTS.some(slot => slot.id === id)) {
      throw new PrimitiveError("기본 장비 칸은 다른 칸의 장비를 함께 받을 수 없어요.");
    }
    if (equipsAs === id) throw new PrimitiveError("장비 칸을 자기 자신에 연결할 수 없어요.");
    requireReference(equipsAs, slot => hasEquipmentSlot(project, slot), "연결할 장비 칸을 찾을 수 없어요.");
  }
  const label = args.label === undefined && current ? current.label : requireName(args.label ?? "");
  const connection = equipsAs === undefined ? current?.equipsAs : equipsAs ?? undefined;
  if (current && label === current.label && connection === current.equipsAs) return project;
  const next = { ...project, database: { ...project.database } };
  upsertEquipmentSlot(next, { id, label, equipsAs });
  return next;
}

function writeRecord(ctx: PrimitiveContext, collection: Collection, edit: "create" | "update", args: Args): Project {
  const { project } = ctx;
  const selection = selected(ctx, collection);
  const current = edit === "update" ? selection : undefined;
  const id = current?.id ?? newId(project, collection);
  const name = current ? nameOf(current) : "";
  let next: Project;
  if (collection === "equipmentSlots") {
    next = patchSlot(project, id, args, current as EquipmentSlotRecord | undefined);
  } else {
    let record: Records[typeof collection];
    switch (collection) {
      case "items": {
        const fields = args as ItemArgs;
        const type = fields.type ?? (fields.switchId !== undefined ? "switch"
          : fields.skillId !== undefined ? "special"
          : fields.hpRecovery !== undefined || fields.mpRecovery !== undefined ? "medicine" : "normalGoods");
        record = patchItem(project, (current as ItemRecord | undefined)
          ?? normalizeItemRecord({ id, name, occasion: "always", type, scope: type === "switch" ? "none" : "ally" }), fields);
        break;
      }
      case "equipment":
        record = patchEquipment(project, (current as EquipmentRecord | undefined)
          ?? normalizeEquipmentRecord({ id, name }), args);
        break;
      case "elements": {
        const fields = args as ElementArgs;
        const count = rows(project, collection).length + 1;
        if (!current && count !== clampElementListCount(count)) {
          throw new PrimitiveError("속성은 최대 99개까지 만들 수 있어요.");
        }
        const element = (current as DatabaseElementRecord | undefined)
          ?? normalizeElementRecords([{ id, name: requireName(fields.name ?? name), kind: fields.kind }])[0];
        record = { ...element, ...fields, ...(fields.name !== undefined ? { name: requireName(fields.name) } : {}) };
        break;
      }
    }
    const prior = rows(project, collection);
    next = setRows(project, collection, current ? prior.map(row => row.id === id ? record : row) : [...prior, record]);
  }
  if (next === project) return project;
  if (collection === "elements" && edit === "update" && args.name !== undefined && project.system.battleModel === "gen1"
    && gen1CanonicalTypeForId(project, id) !== gen1CanonicalTypeForId(next, id)) {
    throw new PrimitiveError("이 이름으로 바꾸면 몬스터 전투에서 속성의 판정이 달라져요.");
  }
  if (edit === "update" && ((collection === "equipment" && (args.slot !== undefined || args.twoHanded !== undefined))
    || (collection === "equipmentSlots" && args.equipsAs !== undefined))) {
    validateInitialEquipment(project, next);
    validateEventEquipment(project, next, collection, id);
    if (mayBreakScriptEquipment(project, next, collection, id)) {
      forEachAuthoredScript(project, script => {
        if (mayRunEventCommand(script)) {
          throw new PrimitiveError("스크립트가 실행하는 이벤트 명령의 장비 착용을 확인할 수 없어요.");
        }
      });
    }
  }
  validateReferences(project, next);
  return next;
}

function validateInitialEquipment(before: Project, after: Project): void {
  const oldEquipment = new Map(before.database.equipment.map(record => [record.id, record]));
  for (const actor of after.database.actors) {
    const previous = effectiveActorEquipment(before, actor, actor.initialEquipment);
    const next = effectiveActorEquipment(after, actor, actor.initialEquipment);
    for (const [slot, id] of Object.entries(previous)) {
      // 양손 무기가 방패 칸에 표시되는 것은 시작 장비를 하나 더 착용한 것이 아니다.
      if (id === next[slot] || (id && slot === "shield" && previous.weapon === id && oldEquipment.get(id)?.twoHanded)) continue;
      throw new PrimitiveError("이렇게 바꾸면 주인공의 시작 장비를 착용할 수 없어요.");
    }
  }
}

type EquipCommand = Extract<Command, { kind: "changeEquipment" }>;

function newlyBlockedByOffhand(before: Project, after: Project, actor: ActorRecord, classId: string, equipmentId: string): boolean {
  return before.database.equipment.some(offhand => {
    if (!offhand.cursed && !offhand.effectFlags.fixedEquipment) return false;
    if (!equipmentSlotAccepts(before, actor, "shield", offhand, classId)) return false;
    if (actor.initialEquipment.shield !== offhand.id && !canEquip(before, actor, offhand, classId)) return false;
    const input = {
      actorId: actor.id, classId, equipment: { shield: offhand.id },
      inventory: { [equipmentId]: 1 }, slot: "weapon", equipmentId,
    } as const;
    if (transitionActorEquipment({ ...input, project: before }).kind !== "accepted") return false;
    const result = transitionActorEquipment({ ...input, project: after });
    return result.kind === "rejected" && (result.reason === "cursedEquipment" || result.reason === "fixedEquipment");
  });
}

function validateEventEquipment(before: Project, after: Project, collection: "equipment" | "equipmentSlots", id: string): void {
  const field = collection === "equipment" ? "equipmentId" : "slot";
  for (const { path, asKey } of referenceIndex(before, new Set([id])).get(id) ?? []) {
    if (asKey || path.at(-1) !== field) continue;
    const owner = path.slice(0, -1).reduce<unknown>((node, key) =>
      node && typeof node === "object" ? Reflect.get(node, key) : undefined, before) as EquipCommand | undefined;
    if (owner?.kind !== "changeEquipment" || !owner.equipmentId) continue;
    const actor = before.database.actors.find(record => record.id === owner.actorId);
    const previous = before.database.equipment.find(record => record.id === owner.equipmentId);
    const next = after.database.equipment.find(record => record.id === owner.equipmentId);
    if (!actor || !previous || !next) continue;
    const becomingTwoHanded = !previous.twoHanded && next.twoHanded;
    // Class changes can enable a different off-hand item or dual wielding.
    const classes = new Set([actor.classId]);
    if (owner.slot === "weapon" && becomingTwoHanded) {
      for (const job of before.database.classes) classes.add(job.id);
    } else if (owner.slot === "shield") {
      for (const job of before.database.classes) if (job.options.dualWield) classes.add(job.id);
    }
    for (const classId of classes) {
      if (!equipmentSlotAccepts(before, actor, owner.slot, previous, classId)) continue;
      if (!equipmentSlotAccepts(after, actor, owner.slot, next, classId)
        || (becomingTwoHanded && owner.slot !== "weapon")) {
        throw new PrimitiveError("이렇게 바꾸면 기존 이벤트에서 장비를 지정한 칸에 착용할 수 없어요.");
      }
      if (becomingTwoHanded && newlyBlockedByOffhand(before, after, actor, classId, next.id)) {
        throw new PrimitiveError("이렇게 바꾸면 기존 이벤트에서 벗을 수 없는 보조 장비 때문에 양손 무기를 착용할 수 없어요.");
      }
    }
  }
}

function validateReferences(before: Project, after: Project): void {
  const prior = new Set(collectProjectReferenceIssues(before, { databaseOnly: true }));
  if (collectProjectReferenceIssues(after, { databaseOnly: true }).some(issue => !prior.has(issue))) {
    throw new PrimitiveError("연결된 자료집 항목을 확인해 주세요.");
  }
}

function mayBreakScriptEquipment(before: Project, after: Project, collection: "equipment" | "equipmentSlots", id: string): boolean {
  if (collection === "equipmentSlots") {
    const prior = equipsAsSlot(before, id);
    return prior !== undefined && prior !== equipsAsSlot(after, id);
  }
  const prior = before.database.equipment.find(record => record.id === id)!;
  const next = after.database.equipment.find(record => record.id === id)!;
  return prior.slot !== next.slot || (!prior.twoHanded && next.twoHanded);
}

type AuthoredScript = Pick<ScriptModule, "source" | "compiled" | "effects">;

function forEachAuthoredScript(project: Project, visit: (script: AuthoredScript) => void): void {
  forEachProjectScript(project, visit);
  for (const script of project.scriptLibrary ?? []) visit(script);
}

function hasCommandApiReference(source: string): boolean {
  if (!/\b(?:cmd|game)\b/u.test(source)) return false;
  const file = ts.createSourceFile("equipment-reference.ts", source, ts.ScriptTarget.ES2022);
  function visit(node: ts.Node): true | undefined {
    if (ts.isIdentifier(node) && node.text === "cmd") return true;
    if (ts.isElementAccessExpression(node)) {
      let receiver: ts.Expression = node.expression;
      while (ts.isParenthesizedExpression(receiver) || ts.isAsExpression(receiver) || ts.isTypeAssertionExpression(receiver)
        || ts.isNonNullExpression(receiver) || ts.isSatisfiesExpression(receiver)) receiver = receiver.expression;
      if (ts.isIdentifier(receiver) && receiver.text === "game"
        && (!ts.isStringLiteralLike(node.argumentExpression) || node.argumentExpression.text === "cmd")) return true;
    }
    return ts.forEachChild(node, visit);
  }
  return visit(file) === true;
}

function mayRunEventCommand(script: AuthoredScript, dynamic = scriptCommandEffects(script).dynamic): boolean {
  // Saved effects can omit computed API names and fields inside command objects.
  return dynamic.some(({ api }) => api === "*" || api === "cmd" || api.startsWith("cmd."))
    || hasCommandApiReference(script.source) || hasCommandApiReference(script.compiled);
}

function checkScriptReferences(project: Project, collection: Collection, id: string): void {
  const literal = new RegExp(`(["'\x60])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "u");
  forEachAuthoredScript(project, script => {
    if (literal.test(script.source) || literal.test(script.compiled)) {
      throw new PrimitiveError("스크립트에서 사용 중인 항목은 지울 수 없어요.");
    }
    if (collection === "elements") return;
    const dynamic = scriptCommandEffects(script).dynamic;
    if (mayRunEventCommand(script, dynamic)) {
      throw new PrimitiveError("스크립트가 실행하는 이벤트 명령에서 이 항목을 쓰는지 확인할 수 없어요.");
    }
    // Items and equipment share the inventory addressed by the item script API.
    if (collection !== "equipmentSlots" && dynamic.some(({ api }) =>
      dynamicRefKinds(api).some(ref => ref.kind === "item"))) {
      throw new PrimitiveError("실행할 때 아이템을 고르는 스크립트가 있어 이 항목을 지워도 되는지 확인할 수 없어요.");
    }
  });
}

function deleteRecord(ctx: PrimitiveContext, collection: Collection): Project {
  const { project } = ctx;
  const { id } = selected(ctx, collection);
  const prior = rows(project, collection);
  if (collection === "equipmentSlots" && equipmentSlotRemovalBlocker(project, id) === "builtin") {
    throw new PrimitiveError("기본 장비 칸은 지울 수 없어요.");
  }
  // 빈 속성 목록은 저장본을 읽을 때 기본 속성으로 채워진다.
  if (collection === "elements" && prior.length === 1) {
    throw new PrimitiveError("속성은 한 개 이상 남아 있어야 해요.");
  }
  const index = prior.findIndex(row => row.id === id);
  const sites = outsideRecord(referenceIndex(project, new Set([id])).get(id) ?? [], ["database", collection, index]);
  if (sites.length) throw new PrimitiveError("다른 곳에서 사용 중인 항목은 지울 수 없어요.");
  if (collection === "elements" && project.system.battleModel === "gen1") {
    const type = gen1CanonicalTypeForId(project, id);
    if (type && gen1ElementIdForCanonical(project, type) === id) {
      throw new PrimitiveError("몬스터 전투에서 기본 판정에 쓰는 속성은 지울 수 없어요.");
    }
  }
  checkScriptReferences(project, collection, id);

  if (collection === "equipmentSlots") {
    const next = { ...project, database: { ...project.database } };
    if (!removeEquipmentSlot(next, id)) throw new PrimitiveError("다른 곳에서 사용 중인 장비 칸은 지울 수 없어요.");
    return next;
  }
  return setRows(project, collection, rows(project, collection).filter(row => row.id !== id));
}

const actionTitle = { create: "추가", update: "수정", delete: "삭제" } as const;
const actionSentence = { create: "추가해요", update: "고쳐요", delete: "지워요" } as const;
const objectArgs = (properties: Record<string, JsonSchema>, required: readonly string[] = []): JsonSchema =>
  ({ type: "object", properties, required, additionalProperties: false });

function requestedValue(args: Args): string {
  if (typeof args.attack === "number") return `공격력을 ${args.attack}에 맞춰요`;
  if (typeof args.defense === "number") return `방어력을 ${args.defense}에 맞춰요`;
  if (typeof args.hpRecovery === "number") return `체력 회복량을 ${args.hpRecovery}에 맞춰요`;
  if (typeof args.price === "number") return `가격을 ${args.price}에 맞춰요`;
  return "";
}

function crud(collection: Collection, edit: Edit, fields: Record<string, JsonSchema>): SmallTaskPrimitive {
  const label = labels[collection];
  return {
    id: `db.${collection}.${edit}`,
    unit: UNIT,
    title: `${label} ${actionTitle[edit]}`,
    covers: { collections: [collection] },
    targets: ["dbEntry"],
    args: objectArgs(edit === "delete" ? {} : fields, edit === "create" ? [collection === "equipmentSlots" ? "label" : "name"] : []),
    scope: (ctx, args) => scopeFor(ctx, collection, edit, args),
    describe: (ctx, args) => {
      const value = requestedValue(args);
      if (edit === "create") {
        const name = visibleName(String(args.name ?? args.label), "새 항목");
        return value
          ? `${label}에 「${name}」 항목을 추가하고 ${value}.`
          : `${label}에 「${name}」 항목을 추가해요.`;
      }
      const record = selected(ctx, collection);
      const name = visibleName(nameOf(record), "선택한 항목", record.id);
      const rename = args.name ?? args.label;
      if (edit === "update" && value && Object.keys(args).length === 1) return `${label} 「${name}」 항목의 ${value}.`;
      if (edit === "update" && typeof rename === "string" && Object.keys(args).length === 1) {
        const nextName = visibleName(rename, "새 이름", record.id);
        return `${label} 「${name}」 항목의 이름을 「${nextName}」${roJosa(nextName)} 바꿔요.`;
      }
      return `${label} 「${name}」 항목을 ${actionSentence[edit]}.`;
    },
    apply: (ctx, args) => {
      if (edit === "delete") return deleteRecord(ctx, collection);
      if (edit === "update" && Object.keys(args).length === 0) throw new PrimitiveError("바꿀 내용을 알려 주세요.");
      return writeRecord(ctx, collection, edit, args);
    },
  };
}

function itemValue(field: "price" | "hpRecovery", label: string, schema: JsonSchema): SmallTaskPrimitive {
  return {
    id: `db.items.${field}.set`,
    unit: UNIT,
    title: `아이템 ${label} 설정`,
    covers: { collections: ["items"] },
    targets: ["dbEntry"],
    args: objectArgs({ [field]: schema }, [field]),
    scope: (ctx, args) => scopeFor(ctx, "items", "update", args),
    describe: (ctx, args) => {
      const item = selected(ctx, "items");
      return `「${visibleName(item.name, "선택한 아이템", item.id)}」 아이템의 ${label}을 ${args[field]}에 맞춰요.`;
    },
    apply: (ctx, args) => writeRecord(ctx, "items", "update", args),
  };
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  crud("items", "create", itemFields),
  crud("items", "update", itemFields),
  crud("items", "delete", itemFields),
  crud("equipment", "create", equipmentFields),
  crud("equipment", "update", equipmentFields),
  crud("equipment", "delete", equipmentFields),
  crud("equipmentSlots", "create", slotFields),
  crud("equipmentSlots", "update", slotFields),
  crud("equipmentSlots", "delete", slotFields),
  crud("elements", "create", elementFields),
  crud("elements", "update", elementFields),
  crud("elements", "delete", elementFields),
  itemValue("price", "가격", priceField),
  itemValue("hpRecovery", "체력 고정 회복량", hpField),
];
