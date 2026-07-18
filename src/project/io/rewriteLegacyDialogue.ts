import type { Command, Project } from "@/project/types";

/** m2-209 Advanced Dialogue → native text (emotion/autoAdvance 보존). 로드 시 1회 정규화. */
export function rewriteLegacyAdvancedDialogueInProject(project: Project): boolean {
  let changed = false;
  const walk = (commands: Command[] | undefined): void => {
    if (!commands) return;
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      const next = rewriteCommand(cmd);
      if (next !== cmd) {
        commands[i] = next;
        changed = true;
      }
      if (cmd.kind === "choices") {
        for (const option of cmd.options) walk(option.branch);
        walk(cmd.cancelBranch);
      } else if (cmd.kind === "fork") {
        walk(cmd.then);
        walk(cmd.else);
      } else if (cmd.kind === "loop") {
        walk(cmd.body);
      } else if (cmd.kind === "shop") {
        walk(cmd.transactionBranch);
      } else if (cmd.kind === "inn") {
        walk(cmd.notEnoughBranch);
      } else if (cmd.kind === "battleProcessing") {
        walk(cmd.defeatBranch);
        walk(cmd.escapeBranch);
      } else if (cmd.kind === "promoteActor") {
        walk(cmd.successBranch);
        walk(cmd.failureBranch);
      }
    }
  };

  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      walk(event.commands);
      for (const page of event.pages ?? []) walk(page.commands);
    }
  }
  for (const common of project.commonEvents ?? []) walk(common.commands);
  for (const troop of project.database.troops ?? []) {
    for (const page of troop.battleEventPages ?? []) walk(page.commands);
  }
  return changed;
}

function rewriteCommand(command: Command): Command {
  if (command.kind !== "m2Command") return command;
  if (command.commandId !== "m2-209-advanced-dialogue") return command;
  const fields = command.fields ?? {};
  const speaker = String(fields.speaker ?? "").trim();
  const body = String(fields.body ?? "");
  const emotion = String(fields.emotion ?? "neutral").trim();
  const autoAdvance =
    fields.autoAdvance === true ||
    fields.autoAdvance === "true" ||
    fields.autoAdvance === 1 ||
    fields.autoAdvance === "1";
  return {
    kind: "text",
    body,
    ...(speaker ? { speaker } : {}),
    ...(emotion && emotion !== "neutral" ? { emotion } : {}),
    ...(autoAdvance ? { autoAdvance: true } : {}),
  };
}
