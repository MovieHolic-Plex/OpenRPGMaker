import { withOpenEventDrafts } from "@/ai/smallTaskReferences";
import type { SmallTaskScope } from "@/ai/smallTaskScope";
import { outsideRecord, referenceIndex, type RefSite } from "@/editor/tools/dbReferenceIndex";
import type { JsonSchema } from "@/editor/tools/types";
import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { terrainTagAt } from "@/project/terrainAt";
import type { Project } from "@/project/types";
import { displayText } from "../../target";
import { PrimitiveError } from "../errors";
import type { PrimitiveContext, SmallTaskPrimitive } from "../types";
import {
  battleCommandFields, enemyFields, nonempty, terrainFields, textField, troopFields, troopUpdateFields,
  writeBattleCommand, writeEnemy, writeTerrain, writeTroop,
} from "./20-db-enemies-troops/records";
import { battleCommandSlotIds, troopHasEncounter } from "./20-db-enemies-troops/references";

export const UNIT = "20-db-enemies-troops";

type Collection = "enemies" | "troops" | "terrains" | "battleCommands";
type Row<C extends Collection> = NonNullable<Project["database"][C]>[number];
type Args = Record<string, unknown>;
type Action = "create" | "update" | "delete";

interface CollectionOptions<C extends Collection> {
  collection: C;
  label?: string;
  idPrefix: string;
  fields: Record<string, JsonSchema>;
  updateFields?: Record<string, JsonSchema>;
  createRequired?: readonly string[];
  write: (project: Project, key: { id: string; name: string }, args: Args, current?: Row<C>) => Row<C>;
}

function selectedRow<C extends Collection>(ctx: PrimitiveContext, collection: C) {
  if (ctx.target.kind !== "dbEntry" || ctx.target.collection !== collection) {
    throw new PrimitiveError("범위 밖 자료집 항목이에요.");
  }
  const id = ctx.target.id;
  const rows = (ctx.project.database[collection] ?? []) as readonly Row<C>[];
  const index = rows.findIndex(row => row.id === id);
  const row = rows[index];
  if (!row) throw new PrimitiveError("선택한 자료집 항목을 찾을 수 없어요.");
  return { rows, index, row };
}

function freshId(ctx: PrimitiveContext, rows: readonly { id: string }[], prefix: string, collection: Collection): string {
  const project = withOpenEventDrafts(ctx.project, ctx.live);
  const used = new Set(rows.map(row => row.id));
  const slots = collection === "battleCommands" ? battleCommandSlotIds(project) : undefined;
  for (let number = 1; ; number += 1) {
    const id = `${prefix}_small_${number}`;
    if (!used.has(id) && !slots?.has(id) && !referenceIndex(project, new Set([id])).has(id)) return id;
  }
}

function independentCommandCopy(project: Project, site: RefSite, catalogIndex: number): boolean {
  const [root, collection, rowIndex, field, commandIndex, key] = site.path;
  if (site.asKey || root !== "database" || typeof rowIndex !== "number") return false;
  // 직업과 장비에 저장된 명령은 카탈로그에서 값을 상속할 때만 삭제의 영향을 받는다.
  const command = collection === "classes" && site.path.length === 6 && field === "battleCommands"
    && typeof commandIndex === "number" && key === "id"
    ? project.database.classes[rowIndex]?.battleCommands[commandIndex]
    : collection === "equipment" && site.path.length === 5 && field === "grantsCommand" && commandIndex === "id"
      ? project.database.equipment[rowIndex]?.grantsCommand
      : undefined;
  const catalog = project.database.battleCommands?.[catalogIndex];
  return Boolean(command?.name && command.kind && catalog
    && (catalog.skillId === undefined || command.skillId != null)
    && (catalog.skillSubsetName === undefined || command.skillSubsetName != null)
    && (catalog.commonEventId === undefined || command.commonEventId != null));
}

function validateDelete({ project, live }: PrimitiveContext, collection: Collection, id: string, index: number, count: number): void {
  const uses = outsideRecord(referenceIndex(project, new Set([id])).get(id) ?? [], ["database", collection, index]);
  if (uses.some(site => collection !== "battleCommands" || !independentCommandCopy(project, site, index))
    || (collection === "battleCommands" && battleCommandSlotIds(project, live).has(id))) {
    throw new PrimitiveError("다른 항목에서 사용 중이에요. 연결을 먼저 해제해 주세요.");
  }
  if ((collection === "terrains" || collection === "battleCommands") && count === 1) {
    throw new PrimitiveError("마지막 항목을 지우면 기본 목록이 다시 생겨요. 목록에 한 항목을 남겨 주세요.");
  }
  if (collection !== "terrains") return;
  // 지형 태그는 1부터 세는 목록 위치다. 이후 행을 가리키는 태그도 보호한다.
  const atOrAfter = (tag: number | undefined) => tag !== undefined && Math.trunc(tag) > index && Math.trunc(tag) <= count;
  const changesTile = Object.values(project.tilesets).some(tileset =>
    tileset.tileMeta?.some(meta => atOrAfter(meta?.terrainTag)) ||
    tileset.terrain?.some((tag, tileIndex) => atOrAfter(tileset.tileMeta?.[tileIndex]?.terrainTag ?? tag)),
  );
  if (changesTile) throw new PrimitiveError("지우면 타일에 연결된 지형이 달라져요. 지형 연결을 먼저 정리해 주세요.");
}

function validateTerrainAppend(project: Project, tag: number): void {
  const changesMap = Object.values(project.maps).some(map => map.lowerTiles.some((tile, index) =>
    terrainTagAt(project, { mapId: map.id, x: index % map.width, y: Math.floor(index / map.width) }, tile) === tag,
  ));
  if (changesMap) {
    throw new PrimitiveError("추가하면 배치된 타일에 새 지형 효과가 적용돼요. 지형 태그를 먼저 정리해 주세요.");
  }
}

const actions = [
  { action: "create", title: "추가", verb: "추가했어요" },
  { action: "update", title: "수정", verb: "수정했어요" },
  { action: "delete", title: "삭제", verb: "삭제했어요" },
] as const;

function describeRow(label: string, verb: string, current: { id: string; name: string }, name?: string): string {
  const raw = name ?? current.name;
  const visible = displayText(raw === current.id ? "" : raw.replace(/[{}\[\]「」]/gu, ""), "");
  const short = visible.length > 40 ? `${visible.slice(0, 39)}…` : visible;
  return short ? `${label} 「${short}」 항목을 ${verb}.` : `${label} 항목을 ${verb}.`;
}

function scopeFor<C extends Collection>(ctx: PrimitiveContext, collection: C, action: Action): SmallTaskScope {
  const { row } = selectedRow(ctx, collection);
  return action === "create"
    ? { kind: "dbEntries", entries: [], create: { collection, max: 1 } }
    : { kind: "dbEntries", entries: [{ collection, id: row.id }], ...(action === "delete" ? { remove: true as const } : {}) };
}

function defineCollection<C extends Collection>(options: CollectionOptions<C>): SmallTaskPrimitive[] {
  const { collection, fields } = options;
  const label = options.label ?? DATABASE_AREA_LABELS[collection];
  const updateFields = options.updateFields ?? fields;
  return actions.map(({ action, title, verb }) => ({
    id: `db.${collection}.${action}`,
    unit: UNIT,
    title: `${label} ${title}`,
    covers: { collections: [collection] },
    targets: ["dbEntry"],
    args: {
      type: "object",
      additionalProperties: false,
      properties: action === "delete" ? {} : {
        name: textField("자료집에 표시할 이름"),
        ...(action === "update" ? updateFields : fields),
      },
      required: action === "create" ? ["name", ...(options.createRequired ?? [])] : [],
    },
    scope(ctx) {
      return scopeFor(ctx, collection, action);
    },
    describe(ctx, args) {
      const { row } = selectedRow(ctx, collection);
      return describeRow(label, verb, row, args.name as string | undefined);
    },
    apply(ctx, args) {
      const { rows, index, row } = selectedRow(ctx, collection);
      let edited: readonly Row<C>[];
      if (action === "delete") {
        validateDelete(ctx, collection, row.id, index, rows.length);
        edited = rows.filter((_, i) => i !== index);
      } else {
        if (action === "update" && !Object.keys(args).length) throw new PrimitiveError("바꿀 값을 넣어 주세요.");
        const name = args.name === undefined ? row.name : nonempty(args.name as string);
        const id = action === "create" ? freshId(ctx, rows, options.idPrefix, collection) : row.id;
        if (action === "update" && collection === "troops" && Array.isArray(args.members) && !args.members.length
          && troopHasEncounter(ctx.project, id, ctx.live)) {
          throw new PrimitiveError("전투에서 사용 중인 무리에는 적을 한 마리 이상 남겨 주세요.");
        }
        const record = options.write(ctx.project, { id, name }, args, action === "update" ? row : undefined);
        if (action === "create" && collection === "terrains") validateTerrainAppend(ctx.project, rows.length + 1);
        edited = action === "create" ? [...rows, record] : rows.map((entry, i) => i === index ? record : entry);
      }
      return { ...ctx.project, database: { ...ctx.project.database, [collection]: edited } };
    },
  }));
}

export const PRIMITIVES: readonly SmallTaskPrimitive[] = [
  ...defineCollection({ collection: "enemies", idPrefix: "enemy", fields: enemyFields, write: writeEnemy }),
  ...defineCollection({
    collection: "troops", label: "적 무리", idPrefix: "troop",
    fields: troopFields, updateFields: troopUpdateFields, createRequired: ["members"], write: writeTroop,
  }),
  ...defineCollection({ collection: "terrains", idPrefix: "terrain", fields: terrainFields, write: writeTerrain }),
  ...defineCollection({
    collection: "battleCommands", label: "전투 명령", idPrefix: "cmd", fields: battleCommandFields, write: writeBattleCommand,
  }),
];
