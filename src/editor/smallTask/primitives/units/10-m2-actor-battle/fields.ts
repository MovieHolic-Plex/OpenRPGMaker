import { BATTLE_SCENERY_CATALOG, battleSceneryStill } from "@/assets/battleSceneryCatalog";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { resolveFacesetFaceAssetUrl } from "@/assets/generatedAssetResourceResolver";
import type { JsonSchema } from "@/editor/tools/types";
import { parseActorGraphicOverride } from "@/project/actorGraphicOverride";
import { FIELD_BATTLE_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { M2CommandFields, Project, ResourceKind } from "@/project/types";
import { PrimitiveError } from "../../errors";

type RecordName = { id: string; name: string };
type Reference = (project: Project, fields: M2CommandFields) => void;

export type Row = {
  title: string;
  properties: Record<string, JsonSchema>;
  required?: readonly string[];
  defaults?: M2CommandFields;
  prepare?: (fields: M2CommandFields, patch: M2CommandFields) => void;
  references?: readonly Reference[];
  detail?: (project: Project, fields: M2CommandFields) => string | undefined;
};

const text = (description: string, minLength = 1): JsonSchema => ({ type: "string", minLength, description });
const integer = (description: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const choices = (description: string, ...values: string[]): JsonSchema => ({ type: "string", enum: values, description });

const actor = text("바꿀 주인공의 자료집 항목입니다. 파티 전체는 party로 고릅니다.");
const enemy = text("적 자료집 항목 또는 전투 배치 번호입니다. 첫 번째 적은 enemy-1입니다.");
const allEnemies = { ...enemy, description: enemy.description + " 모든 적은 all로 고릅니다." };
const operation = choices("값을 맞추려면 set, 더하려면 add, 빼려면 remove를 고릅니다.", "set", "add", "remove");
const stateOperation = choices("상태를 붙이려면 add, 해제하려면 remove를 고릅니다.", "add", "remove");
const amount = integer("변화량입니다.", 0);
const count = integer("더할 행동 횟수입니다.", 1);
const sourceFields = {
  valueSource: choices("고정 숫자는 number, 변수에서 읽으려면 variable을 고릅니다.", "number", "variable"),
  valueVariableId: text("변수에서 읽을 때 사용할 변수입니다. 고정 숫자라면 비울 수 있습니다.", 0),
};
const note = text("편집기에서 이 명령을 설명할 메모입니다.", 0);
const field = (fields: M2CommandFields, key: string) => String(fields[key] ?? "");

function actorReference(project: Project, fields: M2CommandFields): void {
  const target = field(fields, "target");
  const id = target === "actor" ? field(fields, "actorId") : target;
  if (target !== "actor" && ["", "party", "all"].includes(id)) return;
  requireRecord(project.database.actors, id, "주인공");
}

function enemyReference(allowAll: boolean): Reference {
  return (project, fields) => {
    const id = field(fields, "target");
    if (allowAll && id === "all") return;
    if (project.database.enemies.some(enemy => enemy.id === id)) return;
    const slot = /^enemy-([1-9]\d*)$/u.exec(id);
    if (slot && project.database.troops.some(troop => (troop.members?.length || troop.enemyIds?.length || 0) >= Number(slot[1]))) return;
    throw new PrimitiveError("적을 찾을 수 없어요.");
  };
}

function requireRecord(records: readonly { id: string }[], id: string, title: string): void {
  if (!records.some(record => record.id === id)) throw new PrimitiveError(`${title} 항목을 찾을 수 없어요.`);
}

function variableReference(project: Project, fields: M2CommandFields): void {
  const id = field(fields, "valueVariableId");
  if (fields.valueSource === "variable" || id) requireRecord(project.variables, id, "변수");
}

function battleCommandReference(project: Project, fields: M2CommandFields): void {
  const ids = field(fields, "operation") === "set" && field(fields, "slots")
    ? field(fields, "slots").split(",").map(entry => entry.trim()).filter(Boolean)
    : [field(fields, "value")];
  for (const id of ids) requireRecord(project.database.battleCommands ?? [], id, "전투 명령");
}

function resourceName(project: Project, id: string, kind: ResourceKind | "battleback"): string | undefined {
  const allowedKinds = kind === "battleback" ? ["backdrop", "picture"] : [kind];
  const profiles = project.resourceProfiles.filter(profile => profile.assetId === id && allowedKinds.includes(profile.kind));
  const uploaded = Object.hasOwn(project.assets.uploaded, id) ? project.assets.uploaded[id] : undefined;
  if (uploaded && (allowedKinds.includes(uploaded.kind) || (kind === "charset" && uploaded.kind === "sprite"))) {
    return uploaded.name;
  }
  if (profiles.length) return profiles[0]!.name;
  if (kind === "charset") {
    const sheet = EASYRPG_RTP_ASSETS.find(asset => asset.category === "charset" && asset.id === id);
    if (sheet) return sheet.name;
    if (Object.hasOwn(project.assets.sprites, id) || findCharsetSemantic(id, 0)) return "걷기 그림";
  }
  if (kind === "faceset" && typeof resolveFacesetFaceAssetUrl(id) === "string") return "얼굴 그림";
  if (kind === "battleback") {
    const biome = BATTLE_SCENERY_CATALOG.find(entry => entry.resourceId === id)?.biome;
    if (biome) return { plains: "풀밭", forest: "숲", cave: "동굴", snow: "설원", desert: "사막" }[biome];
    const still = battleSceneryStill(id);
    if (still) return still.ko;
    if (id === FIELD_BATTLE_BACKGROUND_ID) return "현재 맵";
    if (id.startsWith("battle-skin-") && collectResourceIds(project).has(id)) return "전투 배경";
  }
  return undefined;
}

function resourceReference(kind: "charset" | "faceset" | "battleback", key = "value"): Reference {
  return (project, fields) => {
    const value = field(fields, key);
    const id = kind === "charset" ? parseActorGraphicOverride(value).resourceId : value;
    if (kind !== "battleback" && id === "") return;
    if (resourceName(project, id, kind) === undefined) throw new PrimitiveError("고른 그림을 찾을 수 없어요.");
  };
}

const stateReference: Reference = (project, fields) => requireRecord(project.database.states, field(fields, "value"), "상태");
const classReference: Reference = (project, fields) => requireRecord(project.database.classes, field(fields, "value"), "직업");
const battlePageReference: Reference = (project, fields) => {
  const id = field(fields, "target");
  if (!id || !project.database.troops.some(troop => troop.battleEventPages?.some(page => page.id === id))) {
    throw new PrimitiveError("전투 이벤트 페이지를 찾을 수 없어요.");
  }
};

function nameOf(records: readonly RecordName[], id: string): string | undefined {
  const name = records.find(record => record.id === id)?.name;
  return name === id ? undefined : name;
}

function prepareNumberSource(fields: M2CommandFields, patch: M2CommandFields): void {
  if (patch.valueSource === "number") {
    if (patch.valueVariableId) throw new PrimitiveError("고정 숫자로 바꿀 때는 변수를 비워 주세요.");
    fields.valueVariableId = "";
  } else if (patch.valueVariableId) {
    fields.valueSource = "variable";
  }
}

function prepareName(fields: M2CommandFields): void {
  if (!field(fields, "value").trim()) throw new PrimitiveError("바꿀 이름을 입력해 주세요.");
}

function prepareGraphic(fields: M2CommandFields, patch: M2CommandFields): void {
  const graphic = parseActorGraphicOverride(field(fields, "value"));
  if (graphic.characterIndex > 7) throw new PrimitiveError("그림 속 인물 칸은 첫 칸부터 여덟째 칸까지 고를 수 있어요.");
  if (patch.value !== undefined && patch.characterIndex === undefined && fields.characterIndex !== undefined) {
    fields.characterIndex = graphic.characterIndex;
  }
}

function prepareBattleCommands(fields: M2CommandFields, patch: M2CommandFields): void {
  // 전투 명령 교체 목록이 남아 있으면 단일 명령의 새 값보다 먼저 쓰인다.
  if (patch.value !== undefined) delete fields.slots;
}

function useCatalogNumericText(fields: M2CommandFields): void {
  // 카탈로그 형식 검사와 같은 문자열을 저장한다. 기존 런타임은 숫자와 문자열을 모두 읽는다.
  if (typeof fields.value === "number") fields.value = String(fields.value);
}

const stateName: Row["detail"] = (project, fields) => nameOf(project.database.states, field(fields, "value"));
const className: Row["detail"] = (project, fields) => nameOf(project.database.classes, field(fields, "value"));
const name: Row["detail"] = (_project, fields) => field(fields, "value");
const labelFor = (key: string, labels: Readonly<Record<string, string>>): Row["detail"] =>
  (_project, fields) => labels[field(fields, key)];
const parameters = { maxHp: "최대 체력", maxMp: "최대 마력", attack: "공격력", defense: "방어력", mind: "정신력", agility: "민첩성" };

export const ROWS: Readonly<Record<number, Row>> = {
  14: {
    title: "능력치 변경",
    properties: {
      target: actor, parameter: choices("바꿀 능력치입니다. 최대 체력·최대 마력·공격력·방어력·정신력·민첩성 중에 고릅니다.", ...Object.keys(parameters)),
      operation, value: amount, ...sourceFields,
    },
    prepare: prepareNumberSource, references: [actorReference, variableReference],
    detail: labelFor("parameter", parameters),
  },
  19: {
    title: "상태 변경",
    properties: { target: actor, operation: stateOperation, value: text("붙이거나 해제할 상태 자료집 항목입니다.") },
    required: ["value"], references: [actorReference, stateReference], detail: stateName,
  },
  21: {
    title: "피해와 회복",
    properties: { target: actor, operation: choices("피해는 add, 회복은 remove를 고릅니다.", "add", "remove"), value: amount, ...sourceFields },
    prepare: prepareNumberSource, references: [actorReference, variableReference], detail: labelFor("operation", { add: "피해", remove: "회복" }),
  },
  22: {
    title: "주인공 이름 변경",
    properties: { target: actor, value: text("바꿀 이름입니다.") },
    required: ["value"], prepare: prepareName, references: [actorReference], detail: name,
  },
  23: {
    title: "주인공 별명 변경",
    properties: { target: actor, value: text("바꿀 별명입니다. 별명을 지우려면 빈 글을 입력합니다.", 0) },
    required: ["value"], references: [actorReference], detail: name,
  },
  24: {
    title: "주인공 모습 변경",
    properties: {
      target: actor, value: text("걷기 그림 리소스 또는 그림 검색 결과입니다. 원래 모습으로 되돌리려면 비웁니다.", 0),
      characterIndex: integer("시트 안의 인물 칸입니다. 첫 칸은 0입니다.", 0, 7),
    },
    required: ["value"], prepare: prepareGraphic, references: [actorReference, resourceReference("charset")],
    detail: (project, fields) => resourceName(project, parseActorGraphicOverride(field(fields, "value")).resourceId, "charset"),
  },
  25: {
    title: "주인공 얼굴 변경",
    properties: { target: actor, value: text("얼굴 그림 리소스입니다. 원래 얼굴로 되돌리려면 비웁니다.", 0) },
    required: ["value"], references: [actorReference, resourceReference("faceset")],
    detail: (project, fields) => resourceName(project, field(fields, "value"), "faceset"),
  },
  91: {
    title: "주인공 직업 변경",
    properties: { target: actor, value: text("바꿀 직업 자료집 항목입니다.") },
    required: ["value"], references: [actorReference, classReference], detail: className,
  },
  92: {
    title: "주인공 전투 명령 변경",
    properties: { target: actor, operation, value: text("전투 메뉴에 넣거나 뺄 명령 자료집 항목입니다.") },
    required: ["value"], defaults: { operation: "add" }, prepare: prepareBattleCommands, references: [actorReference, battleCommandReference],
    detail: (project, fields) => nameOf(project.database.battleCommands ?? [], field(fields, "value")),
  },
  98: {
    title: "적 체력 변경", properties: { target: allEnemies, operation, value: amount },
    required: ["target", "value"], prepare: useCatalogNumericText, references: [enemyReference(true)],
  },
  99: {
    title: "적 마력 변경", properties: { target: allEnemies, operation, value: amount },
    required: ["target", "value"], prepare: useCatalogNumericText, references: [enemyReference(true)],
  },
  100: {
    title: "적 상태 변경", properties: { target: allEnemies, operation: stateOperation, value: text("붙이거나 해제할 상태 자료집 항목입니다.") },
    required: ["target", "value"], defaults: { operation: "add" }, references: [enemyReference(true), stateReference], detail: stateName,
  },
  101: {
    title: "적 출현", properties: { target: enemy },
    required: ["target"], references: [enemyReference(false)],
    detail: (project, fields) => nameOf(project.database.enemies, field(fields, "target")),
  },
  102: {
    title: "전투 배경 변경", properties: { resourceId: text("전투 화면에 보여 줄 배경 리소스입니다.") },
    required: ["resourceId"], references: [resourceReference("battleback", "resourceId")],
    detail: (project, fields) => resourceName(project, field(fields, "resourceId"), "battleback"),
  },
  104: {
    title: "전투 이벤트 호출", properties: { target: text("같은 적 그룹에서 호출할 전투 이벤트 페이지입니다.") },
    required: ["target"], references: [battlePageReference],
  },
  105: { title: "전투 중단", properties: { note } },
  107: { title: "강제 도주", properties: { note } },
  108: {
    title: "행동 횟수 추가",
    properties: { target: text("행동을 더 할 주인공 항목입니다. 비우면 지금 행동하는 주인공에게 적용합니다.", 0), value: count },
    defaults: { value: "1" }, prepare: useCatalogNumericText,
    references: [(project, fields) => {
      if (fields.target) requireRecord(project.database.actors, field(fields, "target"), "주인공");
    }],
  },
  218: {
    title: "적 이동",
    properties: { target: enemy, x: integer("전투장의 가로 위치입니다.", 0, 320), y: integer("전투장의 세로 위치입니다.", 0, 240),
      durationMs: integer("이동에 걸리는 시간입니다. 단위는 밀리초입니다.", 0, 5000) },
    references: [enemyReference(false)],
  },
};

export function validateFields(project: Project, row: Row, fields: M2CommandFields, patch: M2CommandFields): void {
  row.prepare?.(fields, patch);
  for (const validate of row.references ?? []) validate(project, fields);
}
