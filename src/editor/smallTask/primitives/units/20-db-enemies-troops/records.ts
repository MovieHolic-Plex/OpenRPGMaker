import { classicEnemyFormation } from "@/battle/battlerPlacements";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
import type { JsonSchema } from "@/editor/tools/types";
import { FIELD_BATTLE_BACKGROUND_ID, normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeGlobalBattleCommands, normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import type {
  ClassBattleCommandKind, DatabaseBattleCommandRecord, DatabaseTerrainRecord, EnemyRecord,
  EnemyRewards, EnemyStats, Project, TroopMemberRecord, TroopRecord,
} from "@/project/types";
import { PrimitiveError } from "../../errors";
import { protectTroopTargets } from "./references";

type Args = Record<string, unknown>;
type Key = { id: string; name: string };

export const textField = (description: string): JsonSchema => ({ type: "string", minLength: 1, description });
const numberField = (description: string, minimum: number, maximum: number): JsonSchema =>
  ({ type: "integer", minimum, maximum, description });
const flag = (description: string): JsonSchema => ({ type: "boolean", description });

export function nonempty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new PrimitiveError("빈 이름이나 연결 대상은 사용할 수 없어요.");
  return trimmed;
}

function requireReference(rows: readonly { id: string }[], id: string, label: string): void {
  if (!rows.some(row => row.id === id)) throw new PrimitiveError(`연결할 ${label}을 찾을 수 없어요.`);
}

function requireResource(project: Project, id: string, kind: "monster" | "backdrop" | "sound", label: string): void {
  if (kind === "backdrop" && id === FIELD_BATTLE_BACKGROUND_ID && !Object.hasOwn(project.assets.uploaded, id)) return;
  if (!listDatabaseResourceOptions(kind, project).some(resource => resource.id === id)) {
    throw new PrimitiveError(`${label}에 쓸 소재를 찾을 수 없어요. 알맞은 종류의 소재를 골라 주세요.`);
  }
}

const statFields = {
  maxHp: numberField("최대 체력", 1, 99_999),
  maxMp: numberField("최대 마력", 0, 9_999),
  attack: numberField("공격력", 1, 999),
  defense: numberField("방어력", 1, 999),
  mind: numberField("정신력", 1, 999),
  agility: numberField("민첩성", 1, 999),
} satisfies Record<keyof EnemyStats, JsonSchema>;

const rewardFields = {
  exp: numberField("처치 보상 경험치", 0, 9_999_999),
  gold: numberField("처치 보상 돈", 0, 999_999),
  dropItemId: textField("처치 보상으로 떨어질 아이템의 식별자"),
  dropRatePercent: numberField("아이템이 떨어질 확률의 백분율", 0, 100),
} satisfies Partial<Record<keyof EnemyRewards, JsonSchema>>;

export const enemyFields = {
  ...statFields, ...rewardFields,
  monsterResourceId: textField("전투에 표시할 적 그림의 소재 식별자"),
  flying: flag("전투 중 공중에 떠 있는지 여부"),
  hideHp: flag("전투 중 체력을 숨길지 여부"),
};

function selectedFields<K extends string>(args: Args, fields: Record<K, JsonSchema>) {
  return Object.fromEntries(Object.keys(fields).filter(key => args[key] !== undefined).map(key => [key, args[key]]));
}

export function writeEnemy(project: Project, key: Key, args: Args, current?: EnemyRecord): EnemyRecord {
  const stats = selectedFields(args, statFields);
  const rewards = selectedFields(args, rewardFields);
  const dropItemId = args.dropItemId === undefined ? undefined : nonempty(args.dropItemId as string);
  const monsterResourceId = args.monsterResourceId === undefined ? undefined : nonempty(args.monsterResourceId as string);
  if (dropItemId !== undefined) requireReference(project.database.items, dropItemId, "아이템");
  if (monsterResourceId !== undefined) requireResource(project, monsterResourceId, "monster", "적 그림");
  if (current?.rewards.drops !== undefined && (dropItemId !== undefined || args.dropRatePercent !== undefined)) {
    throw new PrimitiveError("조건별 전리품을 쓰는 적은 전리품 목록에서 바꿔 주세요.");
  }
  const base = current ?? normalizeEnemyRecord(key);
  const patched = { ...base, ...key };
  if (Object.keys(stats).length) patched.stats = { ...base.stats, ...stats };
  if (Object.keys(rewards).length) {
    patched.rewards = { ...base.rewards, ...rewards, ...(dropItemId === undefined ? {} : { dropItemId }) };
  }
  if (monsterResourceId !== undefined) patched.monsterResourceId = monsterResourceId;
  if (args.flying !== undefined) patched.flying = args.flying as boolean;
  if (args.hideHp === true) patched.hideHp = true;
  if (args.hideHp === false) delete patched.hideHp;
  return patched;
}

const positionFields = {
  x: numberField("전투 화면 가로 위치", 0, 150),
  y: numberField("전투 화면 세로 위치", 0, 240),
  hidden: flag("전투 시작 때 이 적을 숨길지 여부"),
};
const memberSchema = {
  type: "object", additionalProperties: false, required: ["enemyId"],
  properties: { enemyId: textField("자료집에 있는 적의 식별자"), ...positionFields },
} satisfies JsonSchema;

export const troopFields = {
  members: {
    type: "array", minItems: 1, maxItems: 64, description: "새 무리의 구성 또는 현재 명단을 대체할 구성, 같은 적도 여러 번 지정 가능",
    items: memberSchema,
  },
  autoAlign: flag("전투 화면에서 적을 자동으로 배치할지 여부"),
  uncapturable: flag("이 전투에서는 적을 포획할 수 없게 할지 여부"),
} satisfies Record<string, JsonSchema>;
export const troopUpdateFields = {
  ...troopFields,
  members: { ...troopFields.members, minItems: 0, description: "현재 명단을 대체할 구성, 빈 목록으로 명단 비우기" },
  memberNumber: numberField("위치나 숨김을 바꿀 적의 순서, 첫 번째는 1", 1, 64),
  ...positionFields,
};

function editMembers(project: Project, args: Args, current?: TroopRecord): TroopMemberRecord[] | undefined {
  const positions = selectedFields(args, positionFields);
  const hasPositionEdit = args.memberNumber !== undefined || Object.keys(positions).length > 0;
  if (hasPositionEdit && (args.memberNumber === undefined || !Object.keys(positions).length || args.members !== undefined)) {
    throw new PrimitiveError("명단을 바꾸거나, 한 마리의 순서와 바꿀 위치 또는 숨김을 지정해 주세요.");
  }
  if (args.members === undefined && !hasPositionEdit) return undefined;

  const old = current && (current.members?.length ? current.members : current.enemyIds.map<TroopMemberRecord>((enemyId, i) => ({
    enemyId, ...classicEnemyFormation(i), hidden: false,
  })));
  if (hasPositionEdit) {
    const index = (args.memberNumber as number) - 1;
    if (!old?.[index]) throw new PrimitiveError("무리에서 그 순서의 적을 찾을 수 없어요.");
    return old.map((member, i) => i === index ? { ...member, ...positions } : member);
  }

  const requested = (args.members as TroopMemberRecord[]).map(member => ({ ...member, enemyId: nonempty(member.enemyId) }));
  const sameFormation = old?.length === requested.length && old.every((member, i) => member.enemyId === requested[i]?.enemyId);
  if (!sameFormation && old?.some(member => member.partOf !== undefined || member.partTag !== undefined)) {
    throw new PrimitiveError("본체와 부위가 연결된 무리는 기존 명단에서 위치나 숨김만 바꿀 수 있어요.");
  }
  const enemyIds = new Set(project.database.enemies.map(enemy => enemy.id));
  if (requested.some(member => !enemyIds.has(member.enemyId))) throw new PrimitiveError("무리에 넣을 적을 찾을 수 없어요.");
  const replacement = requested.map((member, index) => {
    const previous = old?.[index];
    const matching = previous?.enemyId === member.enemyId ? previous : undefined;
    return {
      ...matching,
      enemyId: member.enemyId,
      x: member.x ?? matching?.x ?? Math.min(320, 104 + index * 56),
      y: member.y ?? matching?.y ?? 96,
      hidden: member.hidden ?? matching?.hidden ?? false,
    };
  });
  if (current && old && !sameFormation) protectTroopTargets(project, current, old, replacement);
  return replacement;
}

export function writeTroop(project: Project, key: Key, args: Args, current?: TroopRecord): TroopRecord {
  const positioned = args.x !== undefined || args.y !== undefined
    || (args.members as Partial<TroopMemberRecord>[] | undefined)?.some(member => member.x !== undefined || member.y !== undefined);
  if (positioned && args.autoAlign === true) throw new PrimitiveError("자동 배치와 직접 지정한 위치 중 하나를 골라 주세요.");
  const base = current ?? normalizeTroopRecord(key);
  const members = editMembers(project, args, current);
  return {
    ...base, ...key,
    ...(members ? { members, enemyIds: members.map(member => member.enemyId) } : {}),
    autoAlign: (args.autoAlign as boolean | undefined) ?? (positioned ? false : base.autoAlign),
    ...(args.uncapturable === undefined ? {} : { uncapturable: args.uncapturable as boolean }),
  };
}

const vehicleFields = {
  boat: flag("작은 배가 지나갈 수 있는지 여부"),
  ship: flag("큰 배가 지나갈 수 있는지 여부"),
  airshipLand: flag("비공정이 착륙할 수 있는지 여부"),
  raft: flag("뗏목이 지나갈 수 있는지 여부"),
  chocobo: flag("걷는 탈것의 기존 통행 규칙에 이 지형을 추가로 허용할지 여부"),
  cart: flag("광산 수레의 기존 통행 규칙에 이 지형을 추가로 허용할지 여부"),
};
export const terrainFields = {
  damage: numberField("한 칸을 걸을 때 받는 피해", 0, 9_999),
  encounterRatePercent: numberField("기본 전투 조우율에 곱할 백분율", 0, 500),
  characterDisplay: { type: "string", enum: ["normal", "transparent"], description: "이 지형에서 캐릭터 보이기 또는 숨기기" },
  battleBackgroundResourceId: textField("전투 배경 그림의 소재 식별자"),
  footstepSoundResourceId: textField("발소리의 소재 식별자"),
  climbable: flag("옆보기에서 사다리처럼 오를 수 있는지 여부"),
  ...vehicleFields,
} satisfies Record<string, JsonSchema>;

export function writeTerrain(project: Project, key: Key, args: Args, current?: DatabaseTerrainRecord): DatabaseTerrainRecord {
  const battleBackgroundResourceId = args.battleBackgroundResourceId === undefined ? undefined : nonempty(args.battleBackgroundResourceId as string);
  const footstepSoundResourceId = args.footstepSoundResourceId === undefined ? undefined : nonempty(args.footstepSoundResourceId as string);
  if (battleBackgroundResourceId !== undefined) requireResource(project, battleBackgroundResourceId, "backdrop", "전투 배경");
  if (footstepSoundResourceId !== undefined) requireResource(project, footstepSoundResourceId, "sound", "발소리");
  const base = current ?? normalizeTerrainRecords([key])[0]!;
  const passage = selectedFields(args, vehicleFields);
  const { damage, encounterRatePercent, characterDisplay } = args as Partial<DatabaseTerrainRecord>;
  const edited = {
    ...base, ...key,
    damage: damage ?? base.damage,
    encounterRatePercent: encounterRatePercent ?? base.encounterRatePercent,
    characterDisplay: characterDisplay ?? base.characterDisplay,
    ...(battleBackgroundResourceId === undefined ? {} : { battleBackgroundResourceId }),
    ...(footstepSoundResourceId === undefined ? {} : { footstepSoundResourceId }),
  };
  if (Object.keys(passage).length) {
    edited.vehiclePassage = { ...base.vehiclePassage, ...passage };
    if (args.chocobo === false) delete edited.vehiclePassage.chocobo;
    if (args.cart === false) delete edited.vehiclePassage.cart;
  }
  if (args.climbable === true) edited.climbable = true;
  if (args.climbable === false) delete edited.climbable;
  return edited;
}

const battleKinds: readonly ClassBattleCommandKind[] = [
  "attack", "skill", "skillSubset", "defend", "guard", "item", "capture", "escape", "switch", "event", "commonEvent",
];
export const battleCommandFields = {
  kind: {
    type: "string", enum: battleKinds,
    description: "동작 종류. 순서대로 공격, 기술, 기술 계열, 방어, 옛 방어, 아이템, 포획, 도망, 교체, 옛 교체, 공통 이벤트",
  },
  skillId: textField("명령이 직접 사용할 기술의 식별자"),
  skillSubsetName: textField("열어 줄 기술 계열의 이름"),
  commonEventId: textField("전투에서 실행할 공통 이벤트의 식별자"),
} satisfies Record<string, JsonSchema>;

export function writeBattleCommand(project: Project, key: Key, args: Args, current?: DatabaseBattleCommandRecord): DatabaseBattleCommandRecord {
  const base = current ?? normalizeGlobalBattleCommands([key])[0]!;
  const kind = (args.kind as ClassBattleCommandKind | undefined) ?? base.kind;
  const edited = { ...base, ...key, kind };
  if (kind !== base.kind) {
    delete edited.skillId;
    delete edited.skillSubsetName;
    delete edited.commonEventId;
  }
  if (args.skillId !== undefined) {
    if (kind !== "skill") throw new PrimitiveError("기술 연결은 기술 명령에서만 설정할 수 있어요.");
    const id = nonempty(args.skillId as string);
    requireReference(project.database.skills, id, "기술");
    edited.skillId = id;
  }
  if (args.skillSubsetName !== undefined) {
    if (kind !== "skillSubset") throw new PrimitiveError("기술 계열은 계열 명령에서만 설정할 수 있어요.");
    edited.skillSubsetName = nonempty(args.skillSubsetName as string);
  }
  if (args.commonEventId !== undefined) {
    if (kind !== "commonEvent") throw new PrimitiveError("공통 이벤트는 공통 이벤트 명령에서만 연결할 수 있어요.");
    const id = nonempty(args.commonEventId as string);
    if (!project.commonEvents.some(event => event.id === id)) throw new PrimitiveError("연결할 공통 이벤트를 찾을 수 없어요.");
    edited.commonEventId = id;
  }
  if (kind === "commonEvent" && (args.kind !== undefined || args.commonEventId !== undefined) && !edited.commonEventId) {
    throw new PrimitiveError("명령에서 실행할 공통 이벤트를 골라 주세요.");
  }
  if (kind === "skillSubset" && (args.kind !== undefined || args.skillSubsetName !== undefined) && !edited.skillSubsetName) {
    throw new PrimitiveError("명령에서 열 기술 계열 이름을 넣어 주세요.");
  }
  return edited;
}
