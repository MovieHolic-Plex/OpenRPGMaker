import type { Command, M2CommandFields, Project } from "@/project/types";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import { normalizeWeatherParams, parseWeather, weatherToRuntimeString } from "@/player/weather/weatherModel";

/**
 * 로드 시 1회 정규화: 은퇴한 m2 행을 같은 일을 하는 네이티브 명령으로 바꾼다.
 * - m2-209 Advanced Dialogue → text (emotion/autoAdvance 보존).
 * - 중복 명령 통합(2026-11-26): m2-050 날씨 효과 → setWeather, m2-054·055 애니메이션 표시 → showAnimation,
 *   m2-066 동영상 재생 → playMovie. 피커에 같은 명령이 두 번 보였고, 조수(small-task 별칭)는 이미 네이티브를 썼다.
 *   값 대응은 플레이어가 m2 행을 실행하던 방식(commandCatalog·m2Runtime)과 같다. 설계: btn-trim-r2 migration-design.md.
 *   플레이어는 m2 실행 경로를 그대로 두므로 이관 전에 내보낸 게임도 전처럼 돈다.
 */
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
  const merged = mergedNativeCommand(command.commandId, command.fields ?? {});
  if (merged) return merged;
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

function fieldText(fields: M2CommandFields, key: string, fallback: string): string {
  const value = fields[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function fieldNum(fields: M2CommandFields, key: string, fallback: number): number {
  const value = fields[key];
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function fieldFlag(fields: M2CommandFields, key: string, fallback: boolean): boolean {
  const value = fields[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

/** 중복 m2 행 → 네이티브. 대상이 아니면 undefined. */
function mergedNativeCommand(commandId: string, fields: M2CommandFields): Command | undefined {
  switch (commandId) {
    case "m2-050-set-weather-effects": {
      // m2Runtime: intensity 가 없으면 value 문자열 그대로, 있으면 (종류, 강도) 로 정규화한 뒤 parseWeather 로 읽었다.
      const raw = fields.value === undefined ? "none" : fieldText(fields, "value", "none");
      const screen = fields.intensity === undefined
        ? raw
        : weatherToRuntimeString(normalizeWeatherParams({ kind: parseWeather(raw).kind, intensity: fieldNum(fields, "intensity", 0.5) }));
      const weather = parseWeather(screen);
      const transitionMs = Math.max(0, Math.round(fieldNum(fields, "transitionMs", fieldNum(fields, "durationMs", 0))));
      return { kind: "setWeather", weather: weather.kind, intensity: weather.intensity, transitionMs };
    }
    case "m2-054-show-animation":
    case "m2-055-show-animation": {
      const target = fieldText(fields, "target", "player").trim();
      return {
        kind: "showAnimation",
        // "this-event" 는 실행 중인 이벤트 — 네이티브 { eventId: "" } 가 같은 뜻이다(playSceneMapAnimations).
        target: !target || target === "player" ? "player" : { eventId: target === "this-event" ? "" : target },
        animationId: fieldText(fields, "animationId", ""),
        wait: fieldFlag(fields, "wait", false),
      };
    }
    case "m2-066-play-movie":
      return {
        kind: "playMovie",
        resourceId: fields.resourceId !== undefined ? fieldText(fields, "resourceId", "") : fieldText(fields, "value", ""),
        wait: fieldFlag(fields, "wait", true),
        skippable: fieldFlag(fields, "skippable", true),
      };
    default:
      return undefined;
  }
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
