import type { Command, Project } from "@/project/types";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";

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
      } else if (cmd.kind === "presentItem") {
        for (const option of cmd.options) walk(option.branch);
        walk(cmd.otherwiseBranch);
        walk(cmd.cancelBranch);
      } else if (cmd.kind === "fork") {
        walk(cmd.then);
        walk(cmd.else);
      } else if (cmd.kind === "loop") {
        walk(cmd.body);
      } else if (cmd.kind === "shop") {
        walk(cmd.transactionBranch);
        walk(cmd.failedTransactionBranch);
      } else if (cmd.kind === "inn") {
        walk(cmd.notEnoughBranch);
      } else if (cmd.kind === "battleProcessing") {
        walk(cmd.victoryBranch);
        walk(cmd.defeatBranch);
        walk(cmd.escapeBranch);
      } else if (cmd.kind === "tacticsBattle") {
        walk(cmd.victoryBranch);
        walk(cmd.defeatBranch);
      } else if (cmd.kind === "promoteActor") {
        walk(cmd.successBranch);
        walk(cmd.failureBranch);
      } else if (cmd.kind === "evolveMonster") {
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
    for (const list of troopAfterBattleLists(troop)) walk(list.commands);
  }
  return changed;
}

/** 레거시 text 명령의 본문을 읽는다. DB에 남은 구 모양({kind:"text", lines:[...]})도
 * 빈 문자열 대신 실제 대사로 돌려준다 — 렌더가 `body.replace` 에서 터지지 않게. */
export function textBodyOf(command: { readonly kind: string } & Record<string, unknown>): string {
  if (typeof command.body === "string") return command.body;
  if (typeof command.text === "string") return command.text;
  if (Array.isArray(command.lines)) {
    return command.lines.filter((line): line is string => typeof line === "string").join("\n");
  }
  const dialogue = command.dialogue;
  if (dialogue && typeof dialogue === "object" && "lines" in dialogue && Array.isArray(dialogue.lines)) {
    return dialogue.lines.filter((line): line is string => typeof line === "string").join("\n");
  }
  return "";
}

function rewriteCommand(command: Command): Command {
  if (command.kind === "text") return normalizeLegacyTextLines(command);
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

/** 구 저장본 text 명령({kind:"text", lines:["..."]})을 현행 모양(body)으로 고친다.
 * 로드 시 1회 정규화 — 고친 뒤에는 렌더·검증·저장이 전부 body 경로를 탄다. */
function normalizeLegacyTextLines(command: Extract<Command, { kind: "text" }>): Command {
  if (typeof command.body === "string") return command;
  const raw = command as unknown as Record<string, unknown>;
  const nested = raw.dialogue && typeof raw.dialogue === "object" && "lines" in raw.dialogue && Array.isArray(raw.dialogue.lines);
  if (typeof raw.text !== "string" && !Array.isArray(raw.lines) && !nested) return command;
  const { lines: _lines, text: _text, ...kept } = raw;
  // Retain unrelated dialogue metadata; only its legacy body alias is removed.
  if (nested) {
    const { lines: _nestedLines, ...metadata } = raw.dialogue as Record<string, unknown>;
    if (Object.keys(metadata).length) kept.dialogue = metadata;
    else delete kept.dialogue;
  }
  return { ...kept, kind: "text", body: textBodyOf(command) } as Command;
}
