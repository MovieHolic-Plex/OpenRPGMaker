import { projectCommonEventReferenceMessage } from "@/editor/databaseReferences";
import { newCommand, newM2Command } from "@/editor/eventCommandFactory";
import { displayText } from "@/editor/smallTask/target";
import { visitProjectCommands } from "@/editor/tools/commandTraversal";
import { assertPartyActorReferences } from "@/editor/tools/partyActorReferences";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { equipmentSlots } from "@/project/equipmentSlots";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { eventDisplayName } from "@/project/eventDisplayName";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "@/project/factions";
import { EventCommandEditError } from "@/project/eventCommands/singleCommandOps";
import { validateCommands } from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { Command, EventPage, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError } from "../../errors";

export function quotedName(name: string, fallback: string): string {
  const label = displayText(name, "").replace(/[{}[\]「」]/gu, "").trim();
  if (!label) return fallback;
  return `「${label.length > 25 ? label.slice(0, 24) + "…" : label}」`;
}

export function refuseReferencedRemoval(project: Project, id: string): void {
  const callers = new Set<string>();
  const scan = (source: Project) => visitProjectCommands(source, ({ command, location }) => {
    if (command.kind !== "callCommonEvent" || command.commonEventId !== id) return;
    switch (location.kind) {
      case "commonEvent":
        callers.add(`공용 이벤트 ${quotedName(location.commonEventName === location.commonEventId ? "" : location.commonEventName, "이름 없음")}`);
        break;
      case "troopPage": {
        const troop = quotedName(location.troopName === location.troopId ? "" : location.troopName, "이름 없음");
        const page = quotedName(location.pageName === location.pageId ? "" : location.pageName, "전투 페이지");
        callers.add(`적 그룹 ${troop}의 ${page}`);
        break;
      }
      default: {
        const map = source.maps[location.mapId];
        const event = map?.events.find(row => row.id === location.eventId);
        const name = event ? eventDisplayName(event) : "";
        const mapName = quotedName(location.mapName === location.mapId ? "" : location.mapName, "맵");
        const owner = quotedName(name === location.eventId ? "" : name, "이름 없는 이벤트");
        const page = location.kind === "eventPage" && location.pageName !== location.pageId
          ? quotedName(location.pageName, "") : "";
        callers.add(`${mapName}의 ${owner}${page ? ` ${page} 페이지` : ""}`);
      }
    }
  });
  scan(project);
  const committed = projectViewWithoutEventDrafts(project);
  if (committed !== project) scan(committed);
  if (callers.size) {
    throw new PrimitiveError(`${[...callers].join(", ")}에서 호출 중이라 공용 이벤트를 지울 수 없습니다.`);
  }
  const reference = projectCommonEventReferenceMessage(project, id);
  if (reference) throw new PrimitiveError(displayText(reference, "아직 쓰는 곳이 있어 공용 이벤트를 지울 수 없습니다."));
}

export function editCommands(edit: () => EventPage): EventPage {
  try {
    return edit();
  } catch (error) {
    if (!(error instanceof EventCommandEditError)) throw error;
    throw new PrimitiveError(/^[가-힣0-9 .]+$/u.test(error.message) ? error.message : "명령에 필요한 값과 형식을 확인해 주세요.");
  }
}

export function commandForInsert(input: Command): Command {
  if (!COMMAND_KINDS.includes(input.kind)) throw new PrimitiveError("추가할 명령의 종류를 확인해 주세요.");
  if (input.kind === "m2Command") {
    if (!input.commandId) throw new PrimitiveError("추가할 기타 명령을 골라 주세요.");
    const defaults = newM2Command(input.commandId);
    const fields = input.fields;
    if (fields === undefined) return defaults;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      throw new PrimitiveError("명령에 필요한 값과 형식을 확인해 주세요.");
    }
    return { ...defaults, ...input, fields: { ...defaults.fields, ...fields } };
  }
  let defaults = newCommand(input.kind);
  if (defaults.kind === "fork") defaults = { ...defaults, then: [] };
  if (defaults.kind === "loop") defaults = { ...defaults, body: [] };
  if (defaults.kind === "ending") defaults = { ...defaults, title: "끝", message: "플레이해 주셔서 감사합니다." };
  return { ...defaults, ...input } as Command;
}

export function validateSingleInsert(command: Command): void {
  if (nestedCommandLists(command).some(branch => branch.length)) {
    throw new PrimitiveError("분기 안의 명령은 해당 줄을 골라 따로 넣어 주세요.");
  }
}

function ids(records: readonly { readonly id: string }[] = []): Set<string> {
  return new Set(records.map(record => record.id));
}

export function validateCommandReferences(project: Project, command: Command): void {
  const db = project.database;
  try {
    validateCommands([command], {
      appearanceIds: ids(db.characterAppearances),
      actorIds: ids(db.actors),
      classIds: ids(db.classes),
      enemyIds: ids(db.enemies),
      itemIds: ids(db.items),
      equipmentIds: ids(db.equipment),
      equipmentSlotIds: ids(equipmentSlots(project)),
      skillIds: ids(db.skills),
      animationIds: ids(db.battleAnimations),
      switchIds: ids(project.switches),
      variableIds: ids(project.variables),
      commonEventIds: ids(project.commonEvents),
      scheduleIds: ids(db.schedules),
      endingIds: ids(project.endings),
      gameOverIds: ids(project.system.gameOvers),
      mapIds: new Set(Object.keys(project.maps)),
      troopIds: ids(db.troops),
      speciesIds: ids(db.monsterSpecies),
      resourceIds: collectResourceIds(project),
      factionIds: new Set([PLAYER_FACTION_ID, DEFAULT_ENEMY_FACTION_ID, ...(project.factions?.defs ?? []).map(row => row.id)]),
    });
  } catch {
    throw new PrimitiveError("명령이 가리키는 대상을 찾을 수 없습니다.");
  }
  try {
    const checked = structuredClone(command);
    assertPartyActorReferences(project, [checked], "명령");
    if (jsonEqual(checked, command)) return;
  } catch {
    throw new PrimitiveError("파티에 넣거나 뺄 배우를 찾을 수 없습니다.");
  }
  throw new PrimitiveError("파티에 넣거나 뺄 배우를 골라 주세요.");
}
