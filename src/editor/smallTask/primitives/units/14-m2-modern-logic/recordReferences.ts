import { withOpenEventDrafts } from "@/ai/smallTaskReferences";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { projectViewWithoutEventDrafts } from "@/project/eventDrafts";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, M2CommandFields, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type CommandListLocation = { root: readonly Command[]; parent?: CommandPosition };
type CommandPosition = { list: CommandListLocation; index: number };
type RecordReference = CommandPosition & { fields: M2CommandFields };

function* projectCommandLists(project: Project): Generator<readonly Command[]> {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) yield page.commands;
      // Call Map Event falls back to the top-level list when no page is active.
      if (!event.pages?.some(page => page.conditions.length === 0)) yield event.commands;
    }
  }
  for (const common of project.commonEvents) yield common.commands;
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) yield page.commands;
    for (const { commands } of troopAfterBattleLists(troop)) yield commands;
  }
}

function scanRecords(project: Project, commandId: string, editedList: readonly Command[], editedIndex: number, inserting: boolean) {
  let edited: CommandPosition | undefined;
  const records: RecordReference[] = [];
  function visit(commands: readonly Command[], list: CommandListLocation): void {
    const selected = commands === editedList && !edited;
    if (selected) edited = { list, index: editedIndex };
    for (const [index, command] of commands.entries()) {
      if (selected && !inserting && index === editedIndex) continue;
      if (command.kind === "m2Command" && command.commandId === commandId) {
        records.push({ fields: command.fields, list, index });
      }
      for (const branch of nestedCommandLists(command)) {
        visit(branch, { root: list.root, parent: { list, index } });
      }
    }
  }
  const seen = new Set<readonly Command[]>();
  for (const commands of projectCommandLists(project)) {
    if (seen.has(commands)) continue;
    seen.add(commands);
    visit(commands, { root: commands });
  }
  return { records, edited };
}

const questId = (fields: M2CommandFields) => String(fields.questId ?? "quest");
const objectiveId = (fields: M2CommandFields) => String(fields.objectiveId ?? "objective");
const startsObjective = (fields: M2CommandFields) => (fields.state ?? "start") === "start";
const scoreId = (fields: M2CommandFields) => String(fields.scoreId ?? "score") || "score";
const submitsScore = (fields: M2CommandFields) => fields.action === undefined || fields.action === "submit" || fields.action === "submitLow";
const journalText = (value: unknown) => typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
const lineId = (fields: M2CommandFields) => journalText(fields.lineId);
const writesLine = (fields: M2CommandFields) => fields.action !== "erase" && fields.action !== "reread" && journalText(fields.text) !== "";
const readsLine = (fields: M2CommandFields) => fields.action === "erase" || fields.action === "reread";
const automaticLineId = /^line-[1-9]\d*$/u;

// A writer can dominate a reader in its own list or before the ancestor command
// that enters its branch. Sibling branches and other event roots give no such guarantee.
function precedes(earlier: CommandPosition, later: CommandPosition): boolean {
  for (let position: CommandPosition | undefined = later; position; position = position.list.parent) {
    if (earlier.list === position.list) return earlier.index < position.index;
  }
  return false;
}

function losesProducer(
  records: readonly RecordReference[],
  produces: (fields: M2CommandFields) => boolean,
  consumes: (fields: M2CommandFields) => boolean,
  edited: CommandPosition,
): boolean {
  const writers = records.filter(record => produces(record.fields));
  return records.some(reader => consumes(reader.fields) && !precedes(reader, edited) && !writers.some(writer =>
    precedes(writer, reader)
    // For a reader in another event, retain a producer on the same path as the
    // one being removed, since the order between events is determined in play.
    || (reader.list.root !== edited.list.root && (writer.list === edited.list || precedes(writer, edited)))));
}

/** Missing current or next fields indicate insertion or deletion, respectively. */
export function validateRecordEdit(
  ctx: PrimitiveContext, commandId: string, editedList: readonly Command[], editedIndex: number,
  current: M2Command | undefined, next: M2CommandFields | undefined,
): void {
  if (ctx.target.kind !== "event" || !["m2-208-quest-objective", "m2-222-high-score", "m2-227-journal-line"].includes(commandId)) return;
  if (!current && commandId !== "m2-227-journal-line") return;
  const saved = projectViewWithoutEventDrafts(ctx.project);
  const working = withOpenEventDrafts(ctx.project, ctx.live, ctx.target);
  for (const project of new Set([saved, working])) {
    const { records, edited } = scanRecords(project, commandId, editedList, editedIndex, !current);
    if (edited) validateRecords(commandId, records, edited, current?.fields, next);
  }
}

function validateRecords(
  commandId: string, records: readonly RecordReference[], edited: CommandPosition,
  current: M2CommandFields | undefined, next: M2CommandFields | undefined,
): void {
  const previous = current ?? {};
  switch (commandId) {
    case "m2-208-quest-objective": {
      const quest = questId(previous);
      const objective = objectiveId(previous);
      if (!next) {
        if (!startsObjective(previous)) return;
        const matching = records.filter(({ fields }) => questId(fields) === quest && objectiveId(fields) === objective);
        if (losesProducer(matching, startsObjective, fields => !startsObjective(fields), edited)) {
          throw new PrimitiveError("다른 명령이 이 목표를 갱신합니다. 목표를 시작하는 마지막 명령을 지울 수 없습니다.");
        }
        return;
      }
      if (quest === questId(next) && objective === objectiveId(next)) return;
      for (const { fields: other } of records) {
        if (questId(other) === quest && (quest !== questId(next) || objectiveId(other) === objective)) {
          throw new PrimitiveError("다른 명령도 이 퀘스트나 목표를 사용하고 있습니다. 이 줄만 이름표를 바꿀 수 없습니다.");
        }
      }
      return;
    }
    case "m2-222-high-score": {
      const key = scoreId(previous);
      if (!submitsScore(previous) || (next && submitsScore(next) && key === scoreId(next))) return;
      const matching = records.filter(({ fields }) => scoreId(fields) === key);
      const usesScore = (fields: M2CommandFields) => !submitsScore(fields);
      if (losesProducer(matching, submitsScore, usesScore, edited)) {
        throw new PrimitiveError("다른 명령이 이 점수표를 사용합니다. 점수를 올리는 마지막 명령을 바꿀 수 없습니다.");
      }
      return;
    }
    case "m2-227-journal-line": {
      const key = lineId(previous);
      const wasWrite = writesLine(previous);
      const wasErase = previous.action === "erase";
      const nextKey = next ? lineId(next) : "";
      const willWrite = next !== undefined && writesLine(next);
      const changesWrites = wasWrite !== willWrite || (wasWrite && key !== nextKey);
      const removesErase = wasErase && (key !== nextKey || next?.action !== "erase");
      if (!changesWrites && !removesErase) return;
      // Adding a distinct explicit ID can also change the number assigned to a later automatic write.
      const downstream = records.filter(record => !precedes(record, edited));
      if (changesWrites) {
        const automaticWriteChanged = (wasWrite && !key) || (willWrite && !nextKey);
        const automaticWriters = downstream.filter(({ fields }) => writesLine(fields) && !lineId(fields));
        const readers = automaticWriteChanged && current ? records : downstream;
        const affectsAutomaticRead = readers.some(reader => readsLine(reader.fields) && automaticLineId.test(lineId(reader.fields))
          && (automaticWriteChanged || automaticWriters.some(writer => !precedes(reader, writer))));
        if (affectsAutomaticRead) {
          throw new PrimitiveError("다른 명령이 자동으로 이름표가 붙는 일지 줄을 지우거나 다시 읽습니다. 이 위치의 쓰기 동작을 추가하거나 바꿀 수 없습니다.");
        }
      }
      if (!key) return;
      const matching = records.filter(({ fields }) => lineId(fields) === key);
      if (wasWrite && changesWrites && losesProducer(matching, writesLine, readsLine, edited)) {
        throw new PrimitiveError("다른 명령이 이 일지 줄을 지우거나 다시 읽습니다. 줄을 쓰는 마지막 명령을 바꿀 수 없습니다.");
      }
      if (removesErase && losesProducer(matching, fields => fields.action === "erase", fields => fields.action === "reread", edited)) {
        throw new PrimitiveError("다른 명령이 이 일지 줄을 다시 읽습니다. 줄을 지우는 마지막 명령을 바꿀 수 없습니다.");
      }
    }
  }
}
