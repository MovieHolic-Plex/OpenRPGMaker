import type { JsonSchema } from "@/editor/tools/types";
import { GOLD_MAX } from "@/project/economyValues";
import { normalizeCropRecord } from "@/project/farmModel";
import { SEASONS, type Season } from "@/project/gameTime";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { FARM_ANIMAL_FRIENDSHIP_MAX, FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX } from "@/project/p1FoundationRecords";
import { P2_COUNT_MAX } from "@/project/p2FoundationRecords";
import { SCHEDULE_SLOT_LIMIT } from "@/project/schedule";
import { MAX_LIFE_SKILL_LEVEL, normalizeLifeSkillRecord } from "@/project/skillModel";
import { SPATIAL_CAPACITY_MAX, SPATIAL_DEFINITION_LIMIT, SPATIAL_FOOTPRINT_AXIS_MAX, SPATIAL_ORIENTATIONS } from "@/project/spatialPlacements";
import type {
  CropRecord, Dir, FarmAnimalSpeciesRecord, FarmBuildingTypeRecord, FishSpeciesRecord,
  HomeDecorationTypeRecord, LifeSkillRecord, LifeSkillType, MonsterSpeciesRecord, Project, ScheduleRecord,
} from "@/project/types";
import { PrimitiveError } from "../../errors";

interface RecordTypes {
  monsterSpecies: MonsterSpeciesRecord;
  crops: CropRecord;
  lifeSkills: LifeSkillRecord;
  farmAnimalSpecies: FarmAnimalSpeciesRecord;
  fishSpecies: FishSpeciesRecord;
  farmBuildingTypes: FarmBuildingTypeRecord;
  homeDecorationTypes: HomeDecorationTypeRecord;
  schedules: ScheduleRecord;
}

export type Collection = keyof RecordTypes;
export type LifeFarmRecord = RecordTypes[Collection];

const text = (description: string, maxLength = 120): JsonSchema =>
  ({ type: "string", description, minLength: 1, maxLength, pattern: "\\S" });
const int = (description: string, minimum: number, maximum: number): JsonSchema =>
  ({ type: "integer", description, minimum, maximum });
const list = (description: string, items: JsonSchema, maxItems: number, minItems = 0): JsonSchema =>
  ({ type: "array", description, items, minItems, maxItems });

const fields = {
  name: text("자료집에 표시할 이름"),
  graphicResourceId: text("이미 등록된 그림 자료"),
  allowedMapIds: list("배치할 수 있는 맵 목록. 빈 목록은 모든 맵을 허용합니다.", text("기존 맵"), SPATIAL_DEFINITION_LIMIT),
  width: int("가로로 차지할 칸 수", 1, SPATIAL_FOOTPRINT_AXIS_MAX),
  height: int("세로로 차지할 칸 수", 1, SPATIAL_FOOTPRINT_AXIS_MAX),
};

export type EditArgs = Record<string, unknown> & {
  id?: string;
  name?: string;
  captureRate?: number;
  maxHp?: number;
  attack?: number;
  defense?: number;
  dexNote?: string;
  types?: string[];
  seedItemId?: string;
  harvestItemId?: string;
  harvestCount?: number;
  growthDays?: number;
  seasons?: Season[];
  regrowDays?: number;
  skillType?: LifeSkillType;
  maxLevel?: number;
  feedItemId?: string;
  productItemId?: string;
  productCount?: number;
  productEveryDays?: number;
  petFriendship?: number;
  itemId?: string;
  skillXp?: number;
  graphicResourceId?: string;
  width?: number;
  height?: number;
  capacity?: number;
  goldCost?: number;
  allowedMapIds?: string[];
  placementItemId?: string;
  blocksMovement?: boolean;
  allowedOrientations?: Dir[];
  slotLabels?: string[];
  activityLabel?: string;
  commonEventId?: string;
};

interface RecordDefinition {
  fields: Readonly<Record<string, JsonSchema>>;
  required: readonly string[];
  edit(args: EditArgs, prior: LifeFarmRecord | undefined, project: Project): LifeFarmRecord;
}

function define<R extends LifeFarmRecord>(definition: {
  fields: Record<string, JsonSchema>;
  required: readonly string[];
  edit(args: EditArgs, prior: R | undefined, project: Project): R;
}): RecordDefinition {
  return {
    ...definition,
    edit(args, prior, project) {
      if (!prior) {
        for (const field of definition.required) {
          if (typeof args[field] !== "string" || !args[field].trim()) {
            throw new PrimitiveError(`다음 값이 필요해요. ${definition.fields[field].description}`);
          }
        }
      }
      if (args.name !== undefined && !args.name.trim()) throw new PrimitiveError("이름을 입력해 주세요.");
      // makePrimitive selects this row from the definition's own collection.
      return definition.edit(args, prior as R | undefined, project);
    },
  };
}

function growthStages(days: number, previous: CropRecord["stages"] | undefined): CropRecord["stages"] {
  if (!previous?.length) return [{ days }];
  if (days < previous.length) throw new PrimitiveError("성장 기간은 성장 단계 수보다 짧게 정할 수 없어요.");
  // Retain each earlier stage if the budget still leaves at least a day for each later stage.
  let left = days;
  return previous.map((stage, index) => {
    const laterStages = previous.length - index - 1;
    const duration = laterStages ? Math.min(stage.days, left - laterStages) : left;
    left -= duration;
    return duration === stage.days ? stage : { ...stage, days: duration };
  });
}

function footprint(args: EditArgs, previous?: { width: number; height: number }) {
  if (previous && args.width === undefined && args.height === undefined) return previous;
  return { ...previous, width: args.width ?? previous?.width ?? 1, height: args.height ?? previous?.height ?? 1 };
}

function animal(args: EditArgs, previous: FarmAnimalSpeciesRecord | undefined): FarmAnimalSpeciesRecord {
  return {
    ...previous,
    id: previous?.id ?? args.id!,
    name: args.name?.trim() ?? previous!.name,
    feedItemId: args.feedItemId ?? previous!.feedItemId,
    productItemId: args.productItemId ?? previous!.productItemId,
    productCount: args.productCount ?? previous?.productCount ?? 1,
    productEveryDays: args.productEveryDays ?? previous?.productEveryDays ?? 1,
    petFriendship: args.petFriendship ?? previous?.petFriendship ?? 10,
  };
}

export const records = {
  monsterSpecies: define<MonsterSpeciesRecord>({
    required: ["name"],
    fields: {
      name: fields.name,
      captureRate: { type: "number", description: "포획 확률. 절반은 0.5로 표현합니다.", minimum: 0, maximum: 1 },
      maxHp: int("기본 최대 체력", 1, 99999),
      attack: int("기본 공격력", 1, 999),
      defense: int("기본 방어력", 1, 999),
      dexNote: text("도감에 표시할 설명", 200),
      types: list("종의 속성 목록을 바꿉니다. 빈 목록은 속성을 지웁니다.", text("기존 상성표의 속성"), 2),
    },
    edit(args, previous, project) {
      if (args.types?.some(type => !project.system.typeChart?.types.includes(type))) {
        throw new PrimitiveError("상성표에 없는 속성이 있어요.");
      }
      const { maxHp, attack, defense, captureRate, dexNote, types } = args;
      const campaignNote = project.system.monsterCampaign?.speciesNotes[previous?.id ?? args.id!];
      if (dexNote !== undefined && campaignNote && dexNote.trim() !== campaignNote) {
        throw new PrimitiveError("도감에 원정에서 정한 설명이 먼저 표시돼요. 원정의 도감 설명을 바꿔 주세요.");
      }
      const name = args.name?.trim() ?? previous!.name;
      const base = previous ?? normalizeMonsterSpeciesRecord({ id: args.id!, name });
      const editStats = maxHp !== undefined || attack !== undefined || defense !== undefined;
      const baseStats = editStats ? {
        ...base.baseStats,
        maxHp: maxHp ?? base.baseStats.maxHp,
        attack: attack ?? base.baseStats.attack,
        defense: defense ?? base.baseStats.defense,
      } : base.baseStats;
      return {
        ...base, name, baseStats,
        ...(captureRate !== undefined ? { captureRate } : {}),
        ...(dexNote !== undefined ? { dexNote: dexNote.trim() } : {}),
        ...(types !== undefined ? { types: types.length ? [...new Set(types)] : undefined } : {}),
      };
    },
  }),
  crops: define<CropRecord>({
    required: ["name", "seedItemId", "harvestItemId"],
    fields: {
      name: fields.name,
      seedItemId: text("심을 때 쓰는 기존 씨앗 아이템"),
      harvestItemId: text("수확할 때 받는 기존 아이템"),
      harvestCount: int("한 번에 거두는 수량", 1, 9999),
      growthDays: int("심은 뒤 다 자랄 때까지 필요한 전체 일수", 1, 3650),
      seasons: list("작물이 자랄 계절을 하나 이상 고릅니다.", { type: "string", enum: SEASONS }, 4, 1),
      regrowDays: int("수확한 뒤 다시 자라는 데 걸리는 일수. 한 번만 수확하려면 0을 씁니다.", 0, 3650),
    },
    edit(args, previous, project) {
      const name = args.name?.trim() ?? previous!.name;
      const base = previous ?? normalizeCropRecord({
        id: args.id!, name, seedItemId: args.seedItemId, harvestItemId: args.harvestItemId,
        seasons: [...SEASONS],
      });
      const { regrowDays, growthDays, seasons } = args;
      // Planting resolves a seed item to the first matching crop.
      const seedItemId = args.seedItemId ?? base.seedItemId;
      if (seedItemId !== previous?.seedItemId && project.database.crops?.some(crop => crop.seedItemId === seedItemId)) {
        throw new PrimitiveError("이 씨앗은 이미 다른 작물에 연결되어 있어요. 다른 씨앗을 골라 주세요.");
      }
      const next = {
        ...base,
        name,
        seedItemId,
        harvestItemId: args.harvestItemId ?? base.harvestItemId,
        harvestCount: args.harvestCount ?? base.harvestCount,
        stages: growthDays === undefined ? base.stages : growthStages(growthDays, previous?.stages),
        seasons: seasons === undefined ? base.seasons : [...new Set(seasons)],
      };
      if (regrowDays === 0) delete next.regrow;
      else if (regrowDays !== undefined) next.regrow = { days: regrowDays };
      return next;
    },
  }),
  lifeSkills: define<LifeSkillRecord>({
    required: ["name"],
    fields: {
      name: fields.name,
      skillType: { type: "string", enum: ["farming", "mining", "foraging", "fishing", "combat"], description: "농사, 채광, 채집, 낚시, 전투 중 한 종류" },
      maxLevel: int("올릴 수 있는 최고 레벨", 1, MAX_LIFE_SKILL_LEVEL),
    },
    edit(args, previous) {
      if (args.maxLevel !== undefined && previous?.levelUpRewards.some(reward => reward.level > args.maxLevel!)) {
        throw new PrimitiveError("기존 보상을 받을 수 있는 레벨을 남겨 주세요.");
      }
      const name = args.name?.trim() ?? previous!.name;
      const base = previous ?? normalizeLifeSkillRecord({ id: args.id!, name });
      return { ...base, name, skillType: args.skillType ?? base.skillType, maxLevel: args.maxLevel ?? base.maxLevel };
    },
  }),
  farmAnimalSpecies: define<FarmAnimalSpeciesRecord>({
    required: ["name", "feedItemId", "productItemId"],
    fields: {
      name: fields.name,
      feedItemId: text("먹이로 쓰는 기존 아이템"),
      productItemId: text("가축이 생산하는 기존 아이템"),
      productCount: int("한 번에 생산하는 수량", 1, ITEM_QUANTITY_MAX),
      productEveryDays: int("생산 주기(일)", 1, FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX),
      petFriendship: int("쓰다듬을 때 오르는 친밀도", 0, FARM_ANIMAL_FRIENDSHIP_MAX),
    },
    edit: animal,
  }),
  fishSpecies: define<FishSpeciesRecord>({
    required: ["name", "itemId"],
    fields: {
      name: fields.name,
      itemId: text("낚았을 때 받는 기존 아이템"),
      skillXp: int("낚았을 때 얻는 낚시 경험치", 0, P2_COUNT_MAX),
    },
    edit(args, previous) {
      return {
        ...previous,
        id: previous?.id ?? args.id!,
        name: args.name?.trim() ?? previous!.name,
        itemId: args.itemId ?? previous!.itemId,
        ...(args.skillXp !== undefined ? { skillXp: args.skillXp } : {}),
      };
    },
  }),
  farmBuildingTypes: define<FarmBuildingTypeRecord>({
    required: ["name", "graphicResourceId"],
    fields: {
      name: fields.name,
      graphicResourceId: fields.graphicResourceId,
      width: fields.width,
      height: fields.height,
      capacity: int("처음 지은 건물에 있는 일반 시설 자리 수", 1, SPATIAL_CAPACITY_MAX),
      goldCost: int("처음 지을 때 드는 골드", 0, GOLD_MAX),
      allowedMapIds: fields.allowedMapIds,
    },
    edit(args, previous) {
      const first = previous?.levels[0];
      const levels = [{
        ...first,
        level: 1,
        graphicResourceId: args.graphicResourceId ?? first!.graphicResourceId,
        footprint: footprint(args, first?.footprint),
        capacity: args.capacity ?? first?.capacity ?? 1,
        ...(args.goldCost !== undefined ? { cost: { ...first?.cost, gold: args.goldCost } } : {}),
      }, ...(previous?.levels.slice(1) ?? [])];
      return {
        ...previous,
        id: previous?.id ?? args.id!,
        name: args.name?.trim() ?? previous!.name,
        levels,
        ...(args.allowedMapIds !== undefined ? { allowedMapIds: [...args.allowedMapIds] } : {}),
      };
    },
  }),
  homeDecorationTypes: define<HomeDecorationTypeRecord>({
    required: ["name", "placementItemId", "graphicResourceId"],
    fields: {
      name: fields.name,
      placementItemId: text("집 장식을 놓을 때 쓰는 기존 아이템"),
      graphicResourceId: fields.graphicResourceId,
      width: fields.width,
      height: fields.height,
      blocksMovement: { type: "boolean", description: "장식이 놓인 칸을 지나갈 수 없게 할지 여부" },
      allowedOrientations: list("놓을 수 있는 방향을 고릅니다.", {
        type: "string", enum: SPATIAL_ORIENTATIONS, description: "아래, 왼쪽, 오른쪽, 위",
      }, 4, 1),
      allowedMapIds: fields.allowedMapIds,
    },
    edit(args, previous) {
      return {
        ...previous,
        id: previous?.id ?? args.id!,
        name: args.name?.trim() ?? previous!.name,
        placementItemId: args.placementItemId ?? previous!.placementItemId,
        graphicResourceId: args.graphicResourceId ?? previous!.graphicResourceId,
        footprint: footprint(args, previous?.footprint),
        blocksMovement: args.blocksMovement ?? previous?.blocksMovement ?? false,
        allowedOrientations: args.allowedOrientations ? [...args.allowedOrientations] : previous?.allowedOrientations ?? ["down"],
        ...(args.allowedMapIds !== undefined ? { allowedMapIds: [...args.allowedMapIds] } : {}),
      };
    },
  }),
  schedules: define<ScheduleRecord>({
    required: ["name"],
    fields: {
      name: text("일정표의 제목"),
      slotLabels: list("일정 칸 이름을 표시 순서대로 적습니다. 사용 중인 일정표에는 칸이 하나 이상 필요합니다.",
        text("시간이나 요일을 나타내는 일정 칸 이름"), SCHEDULE_SLOT_LIMIT),
      activityLabel: text("추가할 활동 이름"),
      commonEventId: text("새 활동을 고르면 실행할 기존 공용 이벤트"),
    },
    edit(args, previous) {
      const { activityLabel, commonEventId, slotLabels } = args;
      const activities = previous?.activities ?? [];
      if ((activityLabel === undefined) !== (commonEventId === undefined)) {
        throw new PrimitiveError("활동 이름과 실행할 공용 이벤트를 함께 골라 주세요.");
      }
      let nextActivities = activities;
      if (activityLabel !== undefined && commonEventId !== undefined) {
        let number = activities.length + 1;
        while (activities.some(activity => activity.id === `activity_${number}`)) number++;
        nextActivities = [...activities, {
          id: `activity_${number}`, label: activityLabel.trim(), description: "", commonEventId,
        }];
      }
      return {
        ...previous,
        id: previous?.id ?? args.id!,
        title: args.name?.trim() ?? previous!.title,
        slots: slotLabels?.map(label => ({ label: label.trim() })) ?? previous?.slots ?? [{ label: "1" }, { label: "2" }],
        activities: nextActivities,
      };
    },
  }),
} satisfies Record<Collection, RecordDefinition>;
