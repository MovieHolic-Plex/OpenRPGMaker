import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, M2CommandFields, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type RecordReference = { fields: M2CommandFields; list: readonly Command[]; index: number };

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

function* otherRecords(project: Project, commandId: string, editedList: readonly Command[], editedIndex: number): Generator<RecordReference> {
  let skipped = false;
  function* visit(commands: readonly Command[]): Generator<RecordReference> {
    for (const [index, command] of commands.entries()) {
      if (!skipped && commands === editedList && index === editedIndex) {
        skipped = true;
        continue;
      }
      if (command.kind === "m2Command" && command.commandId === commandId) yield { fields: command.fields, list: commands, index };
      for (const branch of nestedCommandLists(command)) yield* visit(branch);
    }
  }
  for (const commands of projectCommandLists(project)) {
    yield* visit(commands);
  }
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

function losesProducer(
  records: readonly RecordReference[],
  produces: (fields: M2CommandFields) => boolean,
  consumes: (fields: M2CommandFields) => boolean,
  editedList: readonly Command[],
  editedIndex: number,
): boolean {
  const writers = records.filter(record => produces(record.fields));
  return records.some(reader => consumes(reader.fields) && !writers.some(writer => {
    // The order is known only within this command list.
    if (reader.list === editedList && editedIndex < reader.index) {
      return writer.list === editedList && writer.index < reader.index;
    }
    return true;
  }));
}

/** An absent replacement means the selected row is being deleted. */
export function validateRecordEdit(
  project: Project, current: M2Command, next: M2CommandFields | undefined, editedList: readonly Command[], editedIndex: number,
): void {
  const previous = current.fields;
  const references = () => otherRecords(project, current.commandId, editedList, editedIndex);
  switch (current.commandId) {
    case "m2-208-quest-objective": {
      const quest = questId(previous);
      const objective = objectiveId(previous);
      if (!next) {
        if (!startsObjective(previous)) return;
        const matching = [...references()].filter(({ fields }) => questId(fields) === quest && objectiveId(fields) === objective);
        if (losesProducer(matching, startsObjective, fields => !startsObjective(fields), editedList, editedIndex)) {
          throw new PrimitiveError("다른 명령이 이 목표를 갱신합니다. 목표를 시작하는 마지막 명령을 지울 수 없습니다.");
        }
        return;
      }
      if (quest === questId(next) && objective === objectiveId(next)) return;
      for (const { fields: other } of references()) {
        if (questId(other) === quest && (quest !== questId(next) || objectiveId(other) === objective)) {
          throw new PrimitiveError("다른 명령도 이 퀘스트나 목표를 사용하고 있습니다. 이 줄만 이름표를 바꿀 수 없습니다.");
        }
      }
      return;
    }
    case "m2-222-high-score": {
      const key = scoreId(previous);
      if (!submitsScore(previous) || (next && submitsScore(next) && key === scoreId(next))) return;
      const matching = [...references()].filter(({ fields }) => scoreId(fields) === key);
      const usesScore = (fields: M2CommandFields) => !submitsScore(fields);
      if (losesProducer(matching, submitsScore, usesScore, editedList, editedIndex)) {
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
      const records = [...references()];
      // Adding a distinct explicit ID can also change the number assigned to a later automatic write.
      const downstream = records.filter(record => record.list !== editedList || record.index > editedIndex);
      if (changesWrites) {
        const automaticWriteChanged = (wasWrite && !key) || (willWrite && !nextKey);
        const automaticWriters = downstream.filter(({ fields }) => writesLine(fields) && !lineId(fields));
        const readers = automaticWriteChanged ? records : downstream;
        const affectsAutomaticRead = readers.some(reader => readsLine(reader.fields) && automaticLineId.test(lineId(reader.fields))
          && (automaticWriteChanged || automaticWriters.some(writer => writer.list !== reader.list || writer.index < reader.index)));
        if (affectsAutomaticRead) {
          throw new PrimitiveError("다른 명령이 자동으로 이름표가 붙는 일지 줄을 지우거나 다시 읽습니다. 이 줄의 이름표나 쓰기 동작을 바꿀 수 없습니다.");
        }
      }
      if (!key) return;
      const matching = records.filter(({ fields }) => lineId(fields) === key);
      if (wasWrite && changesWrites && losesProducer(matching, writesLine, readsLine, editedList, editedIndex)) {
        throw new PrimitiveError("다른 명령이 이 일지 줄을 지우거나 다시 읽습니다. 줄을 쓰는 마지막 명령을 바꿀 수 없습니다.");
      }
      if (removesErase && losesProducer(matching, fields => fields.action === "erase", fields => fields.action === "reread", editedList, editedIndex)) {
        throw new PrimitiveError("다른 명령이 이 일지 줄을 다시 읽습니다. 줄을 지우는 마지막 명령을 바꿀 수 없습니다.");
      }
    }
  }
}
