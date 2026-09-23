// 명령 필드 표기 흔들림(op ↔ action)을 정본으로 되돌린다.
//
// 모델은 수치 명령(changeGold/changeItem/changeExp …)의 `op:"+="` 를 파티 편성에도 그대로 썼다
// (2026-09-23 도그푸딩: `{kind:"changeParty",actorId,op:"+="}`). 스키마는 `action:"add"|"remove"` 라
// 검증기는 배우만 보고 통과시켰고, 런타임은 action 이 "add" 가 아니면 **제외**로 처리해 동료가
// 합류하지 않았다. 반대 방향(수치 명령에 action:"add")도 같은 뿌리라 함께 정리한다.
//
// 뜻이 하나로 정해지는 표기만 옮긴다. 정해지지 않으면 그대로 두고 호출자(도구 검증)가 거부한다.

import type { Command } from "@/project/types";
import { nestedCommandLists } from "@/project/authoredCommandIndex";

type RecordValue = Record<string, unknown>;

const ADD_WORDS = new Set(["add", "join", "+", "+=", "합류", "추가", "gain", "increase"]);
const REMOVE_WORDS = new Set(["remove", "leave", "-", "-=", "이탈", "제외", "lose", "decrease"]);

const AMOUNT_OP_KINDS = new Set([
  "changeGold", "changeItem", "changeExp", "changeLevel", "changeActorHp", "changeActorMp", "changeLifeSkillExp",
]);

function direction(value: unknown): "add" | "remove" | undefined {
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  if (ADD_WORDS.has(word)) return "add";
  if (REMOVE_WORDS.has(word)) return "remove";
  return undefined;
}

/** 명령 하나(중첩 분기 제외)를 제자리에서 고친다. 무엇을 고쳤는지 문장으로 돌려준다. */
export function canonicalizeCommandFieldAlias(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const command = raw as RecordValue;
  if (command.kind === "changeParty") {
    if (command.action === "add" || command.action === "remove") {
      if ("op" in command) { delete command.op; return `changeParty.op 는 쓰이지 않아 지웠습니다(action:"${command.action}" 유지).`; }
      return undefined;
    }
    const resolved = direction(command.action) ?? direction(command.op) ?? direction(command.mode) ?? direction(command.type);
    if (!resolved) return undefined;
    const from = command.action !== undefined ? `action:${JSON.stringify(command.action)}` : command.op !== undefined ? `op:${JSON.stringify(command.op)}` : "별칭";
    delete command.op; delete command.mode; delete command.type;
    command.action = resolved;
    return `changeParty ${from} 를 action:"${resolved}"(${resolved === "add" ? "합류" : "이탈"}) 로 고쳤습니다.`;
  }
  if (typeof command.kind === "string" && AMOUNT_OP_KINDS.has(command.kind) && typeof command.op !== "string") {
    const resolved = direction(command.action);
    if (!resolved) return undefined;
    delete command.action;
    command.op = resolved === "add" ? "+=" : "-=";
    return `${command.kind} action 을 op:"${command.op}" 로 고쳤습니다.`;
  }
  return undefined;
}

/** 명령 목록과 모든 중첩 분기를 제자리에서 고친다. */
export function canonicalizeCommandFieldAliases(commands: readonly unknown[] | undefined, onFix?: (message: string) => void): void {
  if (!Array.isArray(commands)) return;
  for (const command of commands) {
    const fixed = canonicalizeCommandFieldAlias(command);
    if (fixed) onFix?.(fixed);
    if (command && typeof command === "object" && typeof (command as RecordValue).kind === "string") {
      let branches: readonly (readonly Command[])[] = [];
      try { branches = nestedCommandLists(command as Command); } catch { branches = []; }
      for (const branch of branches) canonicalizeCommandFieldAliases(branch as readonly unknown[], onFix);
    }
  }
}
