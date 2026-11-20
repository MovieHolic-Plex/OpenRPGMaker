import { createSourceFile, forEachChild, isIdentifier, isStringLiteralLike, ScriptKind, ScriptTarget, type Node } from "typescript5";
import { referenceIndex, type RefSite } from "@/editor/tools/dbReferenceIndex";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { questDefId } from "@/project/quest/questDef";
import { forEachProjectScript } from "@/project/script/effects";
import type { GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";

type EventSelection = { readonly mapId: string; readonly eventId: string };
export interface SmallTaskDraftSource {
  readonly maps: Readonly<Record<string, { readonly events: readonly GameEvent[] }>>;
}

/** View open working events alongside the task's own changes, without publishing draft data. */
export function withOpenEventDrafts(project: Project, live?: SmallTaskDraftSource, target?: EventSelection): Project {
  if (!live || live === project) return project;
  let maps: Project["maps"] | undefined;
  for (const [mapId, map] of Object.entries(project.maps)) {
    const drafts = new Map(live.maps[mapId]?.events.filter(event => event.draft).map(event => [event.id, event]));
    if (!drafts.size) continue;
    const events = map.events.map(event => {
      const draft = drafts.get(event.id);
      drafts.delete(event.id);
      return target?.mapId === mapId && target.eventId === event.id ? event : draft ?? event;
    });
    const newDrafts = [...drafts.values()].filter(event => event.draft?.kind === "new" || event.draft?.conflict?.kind === "remote-delete");
    maps ??= { ...project.maps };
    maps[mapId] = { ...map, events: [...events, ...newDrafts] };
  }
  return maps ? { ...project, maps } : project;
}

export function scriptContainsLiteral(script: { readonly source: string; readonly compiled: string }, id: string, kind?: string): boolean {
  return [script.source, script.compiled].some((source, index) => {
    if (typeof source !== "string" || !source) return false;
    const file = createSourceFile("event", source, ScriptTarget.Latest, false, index === 0 ? ScriptKind.TS : ScriptKind.JS);
    let hasLiteral = false;
    let hasKind = kind === undefined;
    function visit(node: Node): true | undefined {
      if (isStringLiteralLike(node)) {
        hasLiteral ||= node.text === id;
        hasKind ||= node.text === kind;
      } else if (isIdentifier(node)) {
        hasKind ||= node.text === kind;
      }
      return hasLiteral && hasKind ? true : forEachChild(node, visit);
    }
    return visit(file) === true;
  });
}

function independentBattleCommand(project: Project, site: RefSite, catalog: NonNullable<Project["database"]["battleCommands"]>[number]): boolean {
  const [root, collection, rowIndex, field, commandIndex, key] = site.path;
  if (site.asKey || root !== "database" || typeof rowIndex !== "number") return false;
  const command = collection === "classes" && site.path.length === 6 && field === "battleCommands"
    && typeof commandIndex === "number" && key === "id"
    ? project.database.classes[rowIndex]?.battleCommands[commandIndex]
    : collection === "equipment" && site.path.length === 5 && field === "grantsCommand" && commandIndex === "id"
      ? project.database.equipment[rowIndex]?.grantsCommand
      : undefined;
  // Class and equipment records may store a complete command with the catalog ID.
  return Boolean(command?.name && command.kind
    && (catalog.skillId === undefined || command.skillId != null)
    && (catalog.skillSubsetName === undefined || command.skillSubsetName != null)
    && (catalog.commonEventId === undefined || command.commonEventId != null));
}

// Shared fields can address more than one collection, such as items and equipment in the inventory.
const COLLECTIONS_BY_ID_FIELD = new Map<string, readonly (keyof Project["database"])[]>([
  ["itemId", ["items", "equipment"]], ["stateId", ["states"]], ["skillId", ["skills", "lifeSkills"]],
  ["actorId", ["actors"]], ["classId", ["classes"]], ["troopId", ["troops"]],
  ["enemyId", ["enemies"]], ["elementId", ["elements"]],
]);

export function removedDatabaseReference(
  before: Project, after: Project, removed: readonly { readonly collection: keyof Project["database"]; readonly id: string }[],
  live?: SmallTaskDraftSource,
): boolean {
  if (!removed.length) return false;
  const ids = new Set(removed.map(row => row.id));
  // The index also descends into draft originals, branches, and saved script effects.
  const working = withOpenEventDrafts(after, live);
  const references = referenceIndex(working, ids);
  if (removed.some(({ collection, id }) => {
    const catalog = collection === "battleCommands" ? before.database.battleCommands?.find(row => row.id === id) : undefined;
    return references.get(id)?.some(site => {
      const { path, asKey } = site;
      if (!asKey && path[0] === "database" && path.length === 4 && path[3] === "id") return false;
      const field = path.at(-1);
      const referencedCollections = !asKey && typeof field === "string" ? COLLECTIONS_BY_ID_FIELD.get(field) : undefined;
      if (referencedCollections && !referencedCollections.includes(collection)) return false;
      return !catalog || !independentBattleCommand(working, site, catalog);
    });
  })) return true;

  // Older scripts, and fields of game.cmd the analyzer does not index, can still name a record literally.
  const namesRemoved = (script: { readonly source: string; readonly compiled: string }) =>
    [...ids].some(id => scriptContainsLiteral(script, id));
  if (working.scriptLibrary?.some(namesRemoved)) return true;
  let found = false;
  forEachProjectScript(working, script => { if (!found && namesRemoved(script)) found = true; });
  if (!found) {
    forEachProjectScript(projectViewWithoutEventDrafts(working), script => {
      if (!found && namesRemoved(script)) found = true;
    });
  }
  return found;
}

export function questDependsOnDraft(before: Project, after: Project, live?: SmallTaskDraftSource): boolean {
  if (jsonEqual(before.quests, after.quests)) return false;
  const originalQuests = new Map(before.quests?.map(quest => [questDefId(quest), quest]));
  const draftIds = new Map<string, Set<string>>();
  for (const project of [before, live]) {
    for (const [mapId, map] of Object.entries(project?.maps ?? {})) {
      for (const event of map.events) {
        if (event.draft?.kind !== "new" && event.draft?.conflict?.kind !== "remote-delete") continue;
        const ids = draftIds.get(mapId) ?? new Set();
        ids.add(event.id);
        draftIds.set(mapId, ids);
      }
    }
  }
  if (!draftIds.size) return false;
  function pointsToDraft(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    return (typeof row.mapId === "string" && typeof row.eventId === "string" && draftIds.get(row.mapId)?.has(row.eventId) === true)
      || Object.values(row).some(pointsToDraft);
  }
  return after.quests?.some(quest => !jsonEqual(quest, originalQuests.get(questDefId(quest))) && pointsToDraft(quest)) ?? false;
}
