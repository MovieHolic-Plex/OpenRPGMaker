import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { findBundledImageAsset } from "@/assets/bundled";
import { FARMING_CROP_SPRITE_ASSETS } from "@/assets/farmingSprites";
import { displayText } from "@/editor/smallTask/target";
import { outsideRecord, referenceIndex } from "@/editor/tools/dbReferenceIndex";
import type { JsonSchema } from "@/editor/tools/types";
import { resolveSpatialGraphicTexture } from "@/player/eventSpriteResources";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { committedEventView, projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { validateDatabase } from "@/project/io/shapeDatabaseFields";
import { stripWildNamePrefix } from "@/project/monsterCollection";
import { forEachProjectScript } from "@/project/script/effects";
import type { Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import { records, type Collection, type EditArgs, type LifeFarmRecord } from "./21-db-life-farm/records";

export const UNIT = "21-db-life-farm";

const labels: Readonly<Record<string, string>> = {
  ...DATABASE_AREA_LABELS,
  homeDecorationTypes: "집 장식",
  schedules: "일정표",
};

const idSchema: JsonSchema = {
  type: "string",
  description: "새 항목의 고유 ID. 영문자로 시작하고 영문자, 숫자, 밑줄, 붙임표를 쓸 수 있습니다.",
  minLength: 1,
  maxLength: 120,
  pattern: "^[A-Za-z][A-Za-z0-9_-]*$",
};

function selectedCollection(ctx: PrimitiveContext, collection: Collection, create: boolean) {
  if (ctx.target.kind !== "dbEntry" || ctx.target.collection !== collection) {
    throw new PrimitiveError(`범위 밖입니다. 자료집의 「${labels[collection]}」에서 작업할 항목을 골라 주세요.`);
  }
  const rows = ctx.project.database[collection] ?? [];
  const index = !rows.length && create ? 0 : selectedIndex(rows, ctx.target.id);
  return { rows, index: create ? rows.length : index, id: ctx.target.id };
}

function selectedIndex(rows: readonly LifeFarmRecord[], id: string) {
  const index = rows.findIndex(row => row.id === id);
  if (index < 0) throw new PrimitiveError("선택한 자료집 항목을 찾을 수 없어요.");
  if (rows.some((row, at) => at !== index && row.id === id)) {
    throw new PrimitiveError("선택한 자료집 항목을 하나로 구별할 수 없어요.");
  }
  return index;
}

function checkFishingSkill(before: Project, after: Project) {
  const spots = before.system.fishing?.spots;
  if (!spots?.length) return;
  const oldSkill = before.database.lifeSkills?.find(skill => skill.skillType === "fishing");
  const newSkill = after.database.lifeSkills?.find(skill => skill.skillType === "fishing");
  const usesXp = before.system.skillSystem?.enabled === true;
  const xpFishIds = (project: Project) => new Set((project.database.fishSpecies ?? [])
    .filter(fish => (fish.skillXp ?? 0) > 0).map(fish => fish.id));
  const oldXp = xpFishIds(before);
  const newXp = xpFishIds(after);
  for (const spot of spots) {
    for (const rule of spot.catches) {
      const minLevel = rule.minSkillLevel ?? 0;
      const needsXp = usesXp && newXp.has(rule.fishId);
      const usedOldSkill = oldSkill && (minLevel > 0 || usesXp && oldXp.has(rule.fishId));
      if ((usedOldSkill && oldSkill.id !== newSkill?.id) || (needsXp && !newSkill && !oldXp.has(rule.fishId))
        || (minLevel > (newSkill?.maxLevel ?? 0) && minLevel <= (oldSkill?.maxLevel ?? 0))) {
        throw new PrimitiveError("이대로 바꾸면 낚시터 설정에 필요한 낚시 스킬이나 레벨이 부족해져요. 낚시터 설정을 확인해 주세요.");
      }
    }
  }
}

function isSpatialGraphic(project: Project, resourceId: string) {
  if (Object.hasOwn(Object.prototype, resourceId)) return false;
  // The overlay also accepts raw texture IDs for preloaded images.
  return Boolean(resolveSpatialGraphicTexture(project, resourceId) || findBundledImageAsset(resourceId)
    || FARMING_CROP_SPRITE_ASSETS.some(asset => asset.id === resourceId));
}

function checkResult(before: Project, after: Project, collection: Collection, args: EditArgs) {
  // Validate the edited collection using the same shape contract used when loading a project.
  try {
    validateDatabase({
      actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [],
      troops: [], states: [], battleAnimations: [],
      [collection]: after.database[collection],
    });
  } catch {
    throw new PrimitiveError("자료집에 저장할 수 없는 값이에요. 입력한 값과 항목 수를 확인해 주세요.");
  }

  if (args.graphicResourceId !== undefined && !isSpatialGraphic(before, args.graphicResourceId)) {
    throw new PrimitiveError("맵에 놓을 수 있는 그림을 찾지 못했어요. 건물이나 장식에 쓸 그림을 골라 주세요.");
  }

  const changesFootprintOrMap = args.width !== undefined || args.height !== undefined || args.allowedMapIds !== undefined;
  const checkPlacements = (collection === "farmBuildingTypes" && changesFootprintOrMap)
    || (collection === "homeDecorationTypes" && (changesFootprintOrMap || args.allowedOrientations !== undefined));
  const options = { databaseOnly: !checkPlacements };
  const issues = collectProjectReferenceIssues(after, options);
  if (!issues.length) return;
  const existing = new Set(collectProjectReferenceIssues(before, options));
  const added = issues.filter(issue => !existing.has(issue));
  if (added.some(issue => /^session\.(farmBuilding|homeDecoration)Placements\[/u.test(issue))) {
    throw new PrimitiveError("이 값으로 바꾸면 게임 시작 시 이미 배치한 건물이나 장식을 그대로 놓을 수 없어요.");
  }
  if (added.length) {
    throw new PrimitiveError("연결할 자료를 찾지 못했어요. 아이템이나 그림처럼 함께 쓰는 자료를 확인해 주세요.");
  }
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

function scriptMentionsRecord(project: Project, collection: Collection, ids: ReadonlySet<string>): boolean {
  const literal = new RegExp("([\"'`])(?:" + [...ids].map(escapePattern).join("|") + ")\\1", "u");
  // game.cmd can build identifiers at runtime. Its effect index does not cover every command's fields.
  const canUseCommand = collection === "monsterSpecies" || collection === "lifeSkills" || collection === "schedules";
  const mentionsText = (text: string) => literal.test(text) || (canUseCommand && /\bcmd\b/u.test(text));
  const mentions = (script: { source: string; compiled: string }) =>
    mentionsText(script.source) || mentionsText(script.compiled);
  if (project.scriptLibrary?.some(mentions)) return true;
  let found = false;
  const scan = (snapshot: Project) => {
    forEachProjectScript(snapshot, script => { if (!found && mentions(script)) found = true; });
  };
  scan(project);
  if (!found) {
    const saved = projectViewWithoutEventDrafts(project);
    if (saved !== project) scan(saved);
  }
  return found;
}

function hasRecordReference(project: Project, collection: Collection, index: number, ids: ReadonlySet<string>) {
  const recordPath = ["database", collection, index] as const;
  return [...referenceIndex(project, ids).values()].some(sites => outsideRecord(sites, recordPath).some(({ path }) => {
    const [root, mapId, events, eventIndex, draft, original] = path;
    if (root !== "maps" || events !== "events" || draft !== "draft" || original !== "original") return true;
    const event = project.maps[String(mapId)]?.events[Number(eventIndex)];
    return event !== undefined && committedEventView(event) !== null;
  }));
}

function authoredName(record: LifeFarmRecord) {
  return "title" in record ? record.title : record.name;
}

function hasCopiedName(project: Project, record: LifeFarmRecord, collection: Collection) {
  const name = authoredName(record).trim();
  if (!name) return false;
  const boundary = "[^\\p{L}\\p{N}_]";
  const pattern = new RegExp(`(?:^|${boundary})${escapePattern(name)}(?:으로|에서|에게|처럼|까지|이|가|은|는|을|를|과|와|로|도|만)?(?=$|${boundary})`, "u");
  const hasText = (value: unknown, display = false): boolean => {
    if (typeof value === "string") return display && pattern.test(value);
    if (Array.isArray(value)) return value.some(entry => hasText(entry, display));
    return !!value && typeof value === "object" && Object.entries(value).some(([key, entry]) =>
      key !== "draft" && hasText(entry, NAME_REFERENCE_TEXT_KEYS.has(key)));
  };
  const saved = projectViewWithoutEventDrafts(project);
  const eventsMentionName = (snapshot: Project) => Object.values(snapshot.maps).some(map => hasText(map.events));
  if (eventsMentionName(project) || (saved !== project && eventsMentionName(saved))
    || hasText(project.commonEvents) || hasText(project.database.troops) || hasText(project.endings)) return true;
  if (collection === "farmAnimalSpecies") {
    return project.session.farmAnimals?.some(animal => animal.speciesId === record.id && animal.name === name) ?? false;
  }
  if (collection !== "monsterSpecies") return false;
  const enemies = project.database.enemies.filter(enemy => (enemy.speciesId ?? enemy.id) === record.id);
  if (enemies.some(enemy => stripWildNamePrefix(enemy.name) === name)) return true;
  const enemyIds = new Set(enemies.map(enemy => enemy.id));
  if (project.database.troops.some(troop => pattern.test(troop.name)
    && (troop.enemyIds.some(id => enemyIds.has(id)) || troop.members?.some(member => enemyIds.has(member.enemyId))))) return true;
  return Object.values(project.system.monsterCampaign?.speciesNotes ?? {}).some(note => pattern.test(note));
}

const NAME_REFERENCE_TEXT_KEYS = new Set(["body", "speaker", "text", "message", "label", "dexNote", "summary", "description"]);

type Operation = "create" | "update" | "delete";
const actions = {
  create: { title: "추가", sentence: "추가해요" },
  update: { title: "수정", sentence: "수정해요" },
  delete: { title: "삭제", sentence: "삭제해요" },
};

function previewName(record: LifeFarmRecord): string {
  const source = authoredName(record);
  return displayText(source === record.id ? "" : source, "선택 항목")
    .replace(/[.!?…。！？{}\[\]「」]/gu, " ").replace(/\s+/gu, " ").trim()
    .slice(0, 46).trim() || "선택 항목";
}

function makePrimitive(collection: Collection, operation: Operation, shortcut?: {
  id: string;
  title: string;
  field: "growthDays" | "goldCost";
  suffix: (value: number) => string;
}): SmallTaskPrimitive {
  const record = records[collection];
  const create = operation === "create";
  const remove = operation === "delete";
  const label = labels[collection];
  const action = actions[operation];
  const properties = shortcut ? { [shortcut.field]: record.fields[shortcut.field]! }
    : create ? { id: idSchema, ...record.fields } : remove ? {} : record.fields;

  function edit(ctx: PrimitiveContext, args: EditArgs) {
    const { rows, index } = selectedCollection(ctx, collection, create);
    if (create && (!args.id || Object.hasOwn(Object.prototype, args.id))) {
      throw new PrimitiveError("새 항목에 다른 ID를 입력해 주세요.");
    }
    if (create && rows.some(row => row.id === args.id)) {
      throw new PrimitiveError("같은 ID를 쓰는 항목이 이미 있어요. 새 항목에 다른 ID를 입력해 주세요.");
    }

    const previous = rows[index];
    if (remove) return { rows, index, previous: previous!, next: undefined };
    const next = record.edit(args, previous, ctx.project);
    if (previous && jsonEqual(previous, next)) throw new PrimitiveError("선택한 항목에 바뀌는 값이 없어요.");
    return { rows, index, previous, next };
  }

  return {
    id: `db.${collection}.${shortcut?.id ?? operation}`,
    unit: UNIT,
    title: shortcut?.title ?? `${label} ${action.title}`,
    covers: { collections: [collection] },
    targets: ["dbEntry"],
    args: {
      type: "object",
      properties,
      required: shortcut ? [shortcut.field] : create ? ["id", ...record.required] : [],
      additionalProperties: false,
    },
    scope(ctx): SmallTaskScope {
      const { id } = selectedCollection(ctx, collection, create);
      return create ? { kind: "dbEntries", entries: [], create: { collection, max: 1 } } : {
        kind: "dbEntries", entries: [{ collection, id }], ...(remove ? { remove: true } : {}),
      };
    },
    describe(ctx, args) {
      const { previous, next } = edit(ctx, args);
      if (shortcut) return `「${previewName(next!)}」 ${shortcut.suffix(Number(args[shortcut.field]))}`;
      return `${label} 「${previewName(next ?? previous!)}」 항목을 ${action.sentence}.`;
    },
    apply(ctx, args) {
      const { rows, index, previous, next } = edit(ctx, args);
      if (remove) {
        const id = previous!.id;
        const ids = new Set([id]);
        if (collection === "monsterSpecies") {
          // The journal writes these switch IDs when the player sees or catches this species.
          ids.add(`mx_seen_${id}`);
          ids.add(`mx_caught_${id}`);
        }
        if (hasRecordReference(ctx.project, collection, index, ids)) {
          throw new PrimitiveError("이 항목을 쓰는 곳이 있어 삭제할 수 없어요.");
        }
        if (scriptMentionsRecord(ctx.project, collection, ids)) {
          throw new PrimitiveError("스크립트에서 이 항목을 쓰고 있을 수 있어요. 스크립트의 연결을 확인해 주세요.");
        }
      }
      if (previous && next && "slots" in previous && "slots" in next && previous.slots.length && !next.slots.length) {
        const ids = new Set([previous.id]);
        if (hasRecordReference(ctx.project, collection, index, ids) || scriptMentionsRecord(ctx.project, collection, ids)) {
          throw new PrimitiveError("이 일정표를 쓰는 곳이 있어요. 일정 칸을 하나 이상 남겨 주세요.");
        }
      }
      if (previous && (!next || authoredName(previous) !== authoredName(next)) && hasCopiedName(ctx.project, previous, collection)) {
        throw new PrimitiveError("기존 이름을 쓰는 곳이 있어요. 대사나 연결된 자료에서 이 이름을 확인해 주세요.");
      }
      const updated = [...rows];
      if (next) updated[index] = next;
      else updated.splice(index, 1);
      const after = { ...ctx.project, database: { ...ctx.project.database, [collection]: updated } };
      if (collection === "lifeSkills" || collection === "fishSpecies") checkFishingSkill(ctx.project, after);
      if (!remove) checkResult(ctx.project, after, collection, args);
      return after;
    },
  };
}

const collections = Object.keys(records) as Collection[];

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...collections.flatMap(collection => (["create", "update", "delete"] as const)
    .map(operation => makePrimitive(collection, operation))),
  makePrimitive("crops", "update", {
    id: "growthDays.set",
    title: "작물 성장 기간 설정",
    field: "growthDays",
    suffix: value => `성장 기간을 ${value}일로 바꿔요.`,
  }),
  makePrimitive("farmBuildingTypes", "update", {
    id: "goldCost.set",
    title: "농장 건물 건설비 설정",
    field: "goldCost",
    suffix: value => `처음 짓는 데 드는 비용을 ${value}골드로 바꿔요.`,
  }),
];
