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

const CHOICE_BRANCH_ALIASES = ["commands", "then", "actions"] as const;

function direction(value: unknown): "add" | "remove" | undefined {
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  if (ADD_WORDS.has(word)) return "add";
  if (REMOVE_WORDS.has(word)) return "remove";
  return undefined;
}

// 동료 합류를 몬스터 지급(giveMonster)처럼 `speciesId`+`level` 로 쓴 사례(2026-09-24 등대지기 3차:
// `{kind:"changeParty",speciesId:"actor_scout",level:1,action:"add"}`) — actorId 가 비어 런타임 파티에
// null 이 들어가고 보스전이 「Missing actor: undefined」로 멈췄다. changeParty 가 가리킬 수 있는 것은 배우뿐이라
// actorId 가 없을 때 별칭 하나의 문자열을 actorId 로 옮긴다. 그 값이 실제 배우인지는 DB 를 아는 호출자
// (도구의 assertPartyActorReferences, 런타임 changeParty)가 판정한다.
const PARTY_ACTOR_ALIASES = ["speciesId", "actor", "characterId", "memberId", "partyMemberId"] as const;
const PARTY_STRAY_FIELDS = ["level", "nickname"] as const;

function canonicalizePartyActorAlias(command: RecordValue): string | undefined {
  const fixes: string[] = [];
  if (typeof command.actorId !== "string" || !command.actorId.trim()) {
    const aliases = PARTY_ACTOR_ALIASES.filter(key => typeof command[key] === "string" && (command[key] as string).trim());
    if (aliases.length === 1) {
      const alias = aliases[0]!;
      command.actorId = (command[alias] as string).trim();
      delete command[alias];
      fixes.push(`changeParty.${alias} 를 actorId:${JSON.stringify(command.actorId)} 로 옮겼습니다(파티 편성은 배우만 받는다).`);
    }
  }
  const stray = PARTY_STRAY_FIELDS.filter(key => key in command);
  if (stray.length > 0 && typeof command.actorId === "string") {
    for (const key of stray) delete command[key];
    fixes.push(`changeParty 에 쓰이지 않는 ${stray.join("·")} 를 지웠습니다.`);
  }
  return fixes.length > 0 ? fixes.join(" ") : undefined;
}

function joinFixes(...fixes: (string | undefined)[]): string | undefined {
  const present = fixes.filter((fix): fix is string => Boolean(fix));
  return present.length > 0 ? present.join(" ") : undefined;
}

/** 명령 하나(중첩 분기 제외)를 제자리에서 고친다. 무엇을 고쳤는지 문장으로 돌려준다. */
export function canonicalizeCommandFieldAlias(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const command = raw as RecordValue;
  if (command.kind === "changeParty") {
    const actorFix = canonicalizePartyActorAlias(command);
    if (command.action === "add" || command.action === "remove") {
      if ("op" in command) { delete command.op; return joinFixes(actorFix, `changeParty.op 는 쓰이지 않아 지웠습니다(action:"${command.action}" 유지).`); }
      return actorFix;
    }
    const resolved = direction(command.action) ?? direction(command.op) ?? direction(command.mode) ?? direction(command.type);
    if (!resolved) return actorFix;
    const from = command.action !== undefined ? `action:${JSON.stringify(command.action)}` : command.op !== undefined ? `op:${JSON.stringify(command.op)}` : "별칭";
    delete command.op; delete command.mode; delete command.type;
    command.action = resolved;
    return joinFixes(actorFix, `changeParty ${from} 를 action:"${resolved}"(${resolved === "add" ? "합류" : "이탈"}) 로 고쳤습니다.`);
  }
  if (command.kind === "choices" && Array.isArray(command.options)) {
    // 네이티브 선택지 분기는 `branch` 다. SimplePage 선택지(`commands`)나 fork(`then`) 표기가 섞이면
    // 분기가 비거나 검증에서 거부됐다. branch 가 비어 있고 별칭 하나에만 명령이 있으면 옮긴다.
    const moved: string[] = [];
    for (const [index, rawOption] of command.options.entries()) {
      if (rawOption === null || typeof rawOption !== "object" || Array.isArray(rawOption)) continue;
      const option = rawOption as RecordValue;
      if (Array.isArray(option.branch) && option.branch.length > 0) continue;
      const aliases = CHOICE_BRANCH_ALIASES.filter(key => Array.isArray(option[key]) && (option[key] as unknown[]).length > 0);
      if (aliases.length !== 1) continue;
      const alias = aliases[0]!;
      option.branch = option[alias];
      delete option[alias];
      moved.push(`options[${index}].${alias}`);
    }
    return moved.length > 0 ? `choices ${moved.join(", ")} 를 branch 로 옮겼습니다(선택지 분기의 정본 키는 branch).` : undefined;
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
