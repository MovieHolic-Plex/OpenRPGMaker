// 명작 공백 #1·#24(2026-09-27) — 미니게임 키트와 순간이동 메뉴의 인터프리터 쪽.
//
// Key Poll·High Score 는 즉시 끝나는 기록 명령이다. Timed Choice·QTE·Teleport Menu 는 플레이어 UI 가
// 필요한 일시정지(StepResult)를 내고, 결과는 resume 값(숫자)으로 돌아온다.
import type { M2CommandFields } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { fieldBoolean, fieldNumber, fieldString } from "./m2RuntimeFields";
import { teleportationAllowed, teleportMenuEntries, type TeleportPoint } from "@/project/teleportPoints";

/** 방향 코드(RM 넘버패드 관례). 0 = 안 누름. */
export const HELD_DIR_CODES = { none: 0, down: 2, left: 4, right: 6, up: 8 } as const;

export function applyKeyPoll(session: PlaySessionLike, fields: M2CommandFields): void {
  const held = session.heldInput ?? { dir: 0, confirm: false, cancel: false, dash: false };
  const dirVariableId = fieldString(fields, "dirVariableId", "");
  if (dirVariableId) session.variables[dirVariableId] = held.dir;
  const confirm = fieldString(fields, "confirmSwitchId", "");
  if (confirm) session.switches[confirm] = held.confirm;
  const cancel = fieldString(fields, "cancelSwitchId", "");
  if (cancel) session.switches[cancel] = held.cancel;
  const dash = fieldString(fields, "dashSwitchId", "");
  if (dash) session.switches[dash] = held.dash;
}

export function applyHighScore(session: PlaySessionLike, fields: M2CommandFields): void {
  const scoreId = fieldString(fields, "scoreId", "score") || "score";
  const action = fieldString(fields, "action", "submit");
  session.highScores ??= {};
  const best = session.highScores[scoreId];
  const recordSwitch = fieldString(fields, "recordSwitchId", "");
  if (recordSwitch) session.switches[recordSwitch] = false;
  if (action === "reset") {
    delete session.highScores[scoreId];
  } else if (action === "submit" || action === "submitLow") {
    const value = session.variables[fieldString(fields, "valueVariableId", "")] ?? 0;
    const better = best === undefined || (action === "submit" ? value > best : value < best);
    if (better) {
      session.highScores[scoreId] = value;
      if (recordSwitch) session.switches[recordSwitch] = true;
    }
  }
  const resultVariableId = fieldString(fields, "resultVariableId", "");
  if (resultVariableId) session.variables[resultVariableId] = session.highScores[scoreId] ?? 0;
}

export type TimedChoiceStep = { kind: "timedChoice"; prompt?: string; options: string[]; timeLimitMs: number };
export type QuickTimeStep = { kind: "quickTimeEvent"; mode: "sequence" | "mash"; keys: string[]; windowMs: number };
export type TeleportMenuStep = { kind: "teleportMenu"; prompt?: string; entries: { label: string; point: TeleportPoint }[]; transfer: boolean };

export function timedChoiceStep(fields: M2CommandFields): TimedChoiceStep {
  const options = fieldString(fields, "options", "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  return {
    kind: "timedChoice",
    ...(fieldString(fields, "prompt", "") ? { prompt: fieldString(fields, "prompt", "") } : {}),
    options: options.length > 0 ? options : ["예", "아니오"],
    timeLimitMs: clamp(fieldNumber(fields, "timeLimitMs", 3000), 500, 60000),
  };
}

export const QTE_KEYS = ["up", "down", "left", "right", "z", "x"] as const;

export function quickTimeStep(fields: M2CommandFields): QuickTimeStep {
  const mode = fieldString(fields, "mode", "sequence") === "mash" ? "mash" : "sequence";
  const keys = fieldString(fields, "keys", "z")
    .split(/[\s,]+/)
    .map((key) => key.trim().toLowerCase())
    .filter((key): key is (typeof QTE_KEYS)[number] => (QTE_KEYS as readonly string[]).includes(key))
    .slice(0, 12);
  return { kind: "quickTimeEvent", mode, keys: keys.length > 0 ? keys : ["z"], windowMs: clamp(fieldNumber(fields, "windowMs", 1200), 200, 20000) };
}

export function teleportMenuStep(session: PlaySessionLike, fields: M2CommandFields, maps: Readonly<Record<string, { readonly name?: string }>>): TeleportMenuStep | "forbidden" {
  if (!teleportationAllowed(session)) return "forbidden";
  return {
    kind: "teleportMenu",
    ...(fieldString(fields, "prompt", "") ? { prompt: fieldString(fields, "prompt", "") } : {}),
    entries: teleportMenuEntries(session, maps).map((entry) => ({ label: entry.label, point: entry.point })),
    transfer: fieldBoolean(fields, "transfer", true),
  };
}

/** 판정: 순서 입력 결과를 1/0 으로. 플레이어 UI 와 테스트가 같은 함수를 쓴다. */
export function judgeQuickTime(step: QuickTimeStep, pressed: readonly string[]): number {
  if (step.mode === "mash") return pressed.length;
  if (pressed.length < step.keys.length) return 0;
  return step.keys.every((key, index) => pressed[index] === key) ? 1 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(Number.isFinite(value) ? value : min)));
}
