import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, M2CommandFields, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

type M2Command = Extract<Command, { kind: "m2Command" }>;

function* projectCommandLists(project: Project): Generator<readonly Command[]> {
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (event.pages?.length) {
        for (const page of event.pages) yield page.commands;
      } else {
        yield event.commands;
      }
    }
  }
  for (const common of project.commonEvents) yield common.commands;
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) yield page.commands;
    for (const { commands } of troopAfterBattleLists(troop)) yield commands;
  }
}

function* otherRecords(project: Project, commandId: string, editedList: readonly Command[], editedIndex: number): Generator<M2CommandFields> {
  let skipped = false;
  function* visit(commands: readonly Command[]): Generator<M2CommandFields> {
    for (const [index, command] of commands.entries()) {
      if (!skipped && commands === editedList && index === editedIndex) {
        skipped = true;
        continue;
      }
      if (command.kind === "m2Command" && command.commandId === commandId) yield command.fields;
      for (const branch of nestedCommandLists(command)) yield* visit(branch);
    }
  }
  for (const commands of projectCommandLists(project)) {
    yield* visit(commands);
  }
}

const questId = (fields: M2CommandFields) => String(fields.questId ?? "quest");
const objectiveId = (fields: M2CommandFields) => String(fields.objectiveId ?? "objective");
const scoreId = (fields: M2CommandFields) => String(fields.scoreId ?? "score") || "score";
const submitsScore = (fields: M2CommandFields) => fields.action === undefined || fields.action === "submit" || fields.action === "submitLow";
const journalText = (value: unknown) => typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
const lineId = (fields: M2CommandFields) => journalText(fields.lineId);
const writesLine = (fields: M2CommandFields) => fields.action !== "erase" && fields.action !== "reread" && journalText(fields.text) !== "";

/** Record keys are shared by commands in different pages and command lists. */
export function validateRecordEdit(
  project: Project, current: M2Command, next: M2CommandFields, editedList: readonly Command[], editedIndex: number,
): void {
  const previous = current.fields;
  const references = () => otherRecords(project, current.commandId, editedList, editedIndex);
  switch (current.commandId) {
    case "m2-208-quest-objective": {
      const quest = questId(previous);
      const objective = objectiveId(previous);
      if (quest === questId(next) && objective === objectiveId(next)) return;
      for (const other of references()) {
        if (questId(other) === quest && (quest !== questId(next) || objectiveId(other) === objective)) {
          throw new PrimitiveError("다른 명령도 이 퀘스트나 목표를 사용하고 있습니다. 이 줄만 이름표를 바꿀 수 없습니다.");
        }
      }
      return;
    }
    case "m2-222-high-score": {
      const key = scoreId(previous);
      if (!submitsScore(previous) || (submitsScore(next) && key === scoreId(next))) return;
      const matching = [...references()].filter(other => scoreId(other) === key);
      if (matching.length && !matching.some(submitsScore)) {
        throw new PrimitiveError("다른 명령이 이 점수표를 사용합니다. 점수를 올리는 마지막 명령을 바꿀 수 없습니다.");
      }
      return;
    }
    case "m2-227-journal-line": {
      const key = lineId(previous);
      const wasWrite = writesLine(previous);
      const wasErase = previous.action === "erase";
      const sameKey = key === lineId(next);
      const removesWrite = wasWrite && (!sameKey || !writesLine(next));
      const removesErase = wasErase && (!sameKey || next.action !== "erase");
      if (!key || (!removesWrite && !removesErase)) return;
      const matching = [...references()].filter(other => lineId(other) === key);
      if (removesWrite && matching.some(other => other.action === "erase" || other.action === "reread") && !matching.some(writesLine)) {
        throw new PrimitiveError("다른 명령이 이 일지 줄을 지우거나 다시 읽습니다. 줄을 쓰는 마지막 명령을 바꿀 수 없습니다.");
      }
      if (removesErase && matching.some(other => other.action === "reread") && !matching.some(other => other.action === "erase")) {
        throw new PrimitiveError("다른 명령이 이 일지 줄을 다시 읽습니다. 줄을 지우는 마지막 명령을 바꿀 수 없습니다.");
      }
    }
  }
}
