// 명령 스키마 검사 — 에디터의 명령 카탈로그(`editor/eventCommands/schema`)를 정본으로 삼아
// 저장된 명령 하나하나를 재귀로 대조한다. 모르는 필드(예: changeParty 의 speciesId), 비어 있는 필수 참조,
// 없는 배우·아이템·적 그룹·맵·스위치 참조, 전부 빈 선택지 분기를 찾는다.

import "@/editor/eventCommands/schema/catalog";
import "@/editor/eventCommands/schema/catalogExtended";
import { commandSchemaFor, schemaBranchesOf } from "@/editor/eventCommands/schema/defineCommand";
import { visibleFields, type FieldSpec, type RecordSource } from "@/editor/eventCommands/schema/fieldTypes";
import { COMMAND_KINDS } from "@/project/commandKindRegistry";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { Project } from "@/project/types";
import { childLists, commandList, visitAllCommands, type CommandVisit, type RawCommand } from "./walk";
import type { Finding } from "./types";

const KNOWN_KINDS: ReadonlySet<string> = new Set(COMMAND_KINDS);

/**
 * 스키마 폼에는 없지만 런타임 타입(`project/types/events.ts`)에는 있는 필드. 폼이 전용 위젯으로
 * 다루거나 기본값을 두는 것들이다. 여기 없는 필드를 «모르는 필드» 로 본다.
 */
const EXTRA_FIELDS: Readonly<Record<string, readonly string[]>> = {
  text: ["emotion"],
  choices: ["prompt", "options", "cancelBehavior", "cancelBranch"],
  presentItem: ["prompt", "itemIds", "options", "otherwiseBranch", "cancelBranch", "consume"],
  fork: ["condition", "then", "else"],
  loop: ["body"],
  wait: ["variableId"],
  battleProcessing: ["victoryBranch", "defeatBranch", "escapeBranch"],
  promoteActor: ["successBranch", "failureBranch"],
  evolveMonster: ["successBranch", "failureBranch"],
  shop: ["itemIds", "shopUiPreset", "transactionBranch", "failedTransactionBranch", "branchOnTransaction", "branchOnFailedTransaction"],
  inn: ["notEnoughBranch", "branchOnNotEnoughGold"],
  moveEvent: ["route"],
  changeFace: ["appearanceId", "presentation"],
  addFollower: ["graphic"],
  ending: ["presentation"],
  m2Command: ["commandId", "fields"],
};

/** 레코드 참조 필드 → 프로젝트 안의 id 집합. 그림·소리처럼 자원 카탈로그를 봐야 하는 참조는 여기서 안 본다. */
function recordIds(project: Project, source: RecordSource, mapId: string | undefined): ReadonlySet<string> | null {
  const db = project.database;
  switch (source) {
    case "actor": return new Set(db.actors.map((record) => record.id));
    case "item": return new Set(db.items.map((record) => record.id));
    case "troop": return new Set(db.troops.map((record) => record.id));
    case "skill": return new Set(db.skills.map((record) => record.id));
    case "equipment": return new Set(db.equipment.map((record) => record.id));
    case "commonEvent": return new Set(project.commonEvents.map((record) => record.id));
    case "monsterSpecies": return new Set((db.monsterSpecies ?? []).map((record) => record.id));
    case "animation": return new Set(db.battleAnimations.map((record) => record.id));
    case "map": return new Set(Object.keys(project.maps));
    case "event": {
      const maps = mapId ? [project.maps[mapId]].filter(Boolean) : Object.values(project.maps);
      return new Set(maps.flatMap((map) => (map?.events ?? []).map((event) => event.id)));
    }
    default: return null;
  }
}

const SOURCE_LABEL: Partial<Record<RecordSource, string>> = {
  actor: "배우", item: "아이템", troop: "적 그룹", skill: "스킬", equipment: "장비", commonEvent: "공통 이벤트",
  monsterSpecies: "몬스터 종", animation: "전투 애니메이션", map: "맵", event: "이벤트",
};
/** 없는 참조가 곧 진행 불가·런타임 오류가 되는 참조. 나머지는 경고로 낸다. */
const BLOCKING_SOURCES: ReadonlySet<RecordSource> = new Set(["actor", "troop", "map", "commonEvent", "item"]);
/** 대상 없음(«파티 전체» 등)을 뜻하는 관례값. */
const WILDCARD_IDS: ReadonlySet<string> = new Set(["party", "all", "0", ""]);

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function knownFieldsFor(kind: string, fields: Readonly<Record<string, FieldSpec>>, command: RawCommand): Set<string> {
  const known = new Set<string>(["kind", ...Object.keys(fields), ...(EXTRA_FIELDS[kind] ?? [])]);
  for (const [key, spec] of Object.entries(fields)) {
    if (spec.type === "mapPoint") { known.add("x"); known.add("y"); known.add(spec.mapField); known.delete(key); }
  }
  for (const branch of schemaBranchesOf({ ...command, kind, branchOnResult: true } as { kind: string })) known.add(branch.key);
  return known;
}

/** 필드 이름이 다른 명령에서 온 것처럼 보이면 알려 준다(예: giveMonster 의 speciesId 를 changeParty 에). */
function borrowedFrom(key: string): string | null {
  for (const kind of COMMAND_KINDS) {
    const schema = commandSchemaFor(kind);
    if (schema && key in schema.fields) return kind;
  }
  return null;
}

function checkOne(project: Project, entry: CommandVisit, findings: Finding[]): void {
  const { command, where } = entry;
  const kind = typeof command.kind === "string" ? command.kind : "";
  if (!kind || !KNOWN_KINDS.has(kind)) {
    findings.push({ severity: "blocker", code: "command-unknown-kind", message: `알 수 없는 명령 종류 ${JSON.stringify(command.kind)} — 런타임이 실행하지 않습니다.`, where });
    return;
  }
  const schema = commandSchemaFor(kind);
  if (schema) {
    const known = knownFieldsFor(kind, schema.fields, command);
    for (const key of Object.keys(command)) {
      if (known.has(key)) continue;
      const donor = borrowedFrom(key);
      findings.push({
        severity: "warning", code: "command-unknown-field",
        message: `${schema.label}(${kind}) 명령에 모르는 필드 \`${key}\`${donor && donor !== kind ? ` — ${donor} 명령의 필드입니다` : ""}. 런타임은 이 값을 무시합니다.`,
        where,
      });
    }
    for (const [key, spec] of visibleFields(schema.fields, command)) {
      const value = command[key];
      if (spec.type === "record") {
        if (isEmpty(value)) {
          if (spec.optional || spec.allowEmpty) continue;
          const ids = recordIds(project, spec.source, where.mapId);
          if (!ids) continue;
          findings.push({
            severity: "blocker", code: "command-missing-required",
            message: `${schema.label}(${kind}) 명령의 필수 참조 \`${key}\`(${spec.label})가 비어 있습니다${Object.keys(command).some(k => !known.has(k)) ? " — 대신 모르는 필드가 들어 있습니다" : ""}.`,
            where,
          });
          continue;
        }
        if (typeof value !== "string" || WILDCARD_IDS.has(value)) continue;
        const ids = recordIds(project, spec.source, where.mapId);
        if (ids && !ids.has(value)) {
          findings.push({
            severity: BLOCKING_SOURCES.has(spec.source) ? "blocker" : "warning", code: "command-missing-reference",
            message: `${schema.label}(${kind}) 명령이 없는 ${SOURCE_LABEL[spec.source] ?? spec.source} \`${value}\`를 가리킵니다(${key}).`,
            where,
          });
        }
      } else if (spec.type === "switch" || spec.type === "variable") {
        if (isEmpty(value)) {
          if (!spec.optional) findings.push({ severity: "warning", code: "command-missing-required", message: `${schema.label}(${kind}) 명령의 ${spec.type === "switch" ? "스위치" : "변수"} \`${key}\`가 비어 있습니다.`, where });
          continue;
        }
        const ids = spec.type === "switch" ? project.switches.map((s) => s.id) : project.variables.map((v) => v.id);
        if (typeof value === "string" && !ids.includes(value)) {
          findings.push({ severity: "warning", code: "command-undeclared-flag", message: `${schema.label}(${kind}) 명령이 선언되지 않은 ${spec.type === "switch" ? "스위치" : "변수"} \`${value}\`를 씁니다.`, where });
        }
      } else if (spec.type === "enum" && value !== undefined && !spec.choices.some((choice) => choice.value === value || choice.value === String(value))) {
        findings.push({
          severity: kind === "changeParty" && key === "action" ? "blocker" : "warning", code: "command-invalid-enum",
          message: `${schema.label}(${kind}) 명령의 \`${key}\` 값 ${JSON.stringify(value)} 은 허용값(${spec.choices.map((c) => c.value).join("/")})이 아닙니다.`,
          where,
        });
      }
    }
  }
  checkBranches(kind, command, entry, findings);
}

function checkBranches(kind: string, command: RawCommand, entry: CommandVisit, findings: Finding[]): void {
  const { where } = entry;
  if (kind === "choices") {
    const options = Array.isArray(command.options) ? command.options : [];
    if (options.length === 0) {
      findings.push({ severity: "blocker", code: "choice-no-options", message: "선택지 명령에 보기가 하나도 없습니다.", where });
      return;
    }
    const missing = options.map((option, index) => ({ option: option as Record<string, unknown>, index }))
      .filter(({ option }) => !option || !Array.isArray(option.branch));
    for (const { option, index } of missing) {
      const alias = option && typeof option === "object" ? Object.keys(option).filter((key) => key !== "text" && key !== "branch") : [];
      findings.push({
        severity: "blocker", code: "choice-branch-missing",
        message: `선택지 ${index + 1}번에 \`branch\` 가 없습니다${alias.length ? ` (대신 ${alias.map((k) => `\`${k}\``).join(", ")})` : ""} — 골라도 아무 일도 일어나지 않습니다.`,
        where,
      });
    }
    const allEmpty = options.every((option) => commandList((option as Record<string, unknown> | null)?.branch).length === 0)
      && commandList(command.cancelBranch).length === 0;
    if (allEmpty && missing.length < options.length) {
      findings.push({ severity: "blocker", code: "choice-all-empty", message: `선택지 ${options.length}개의 분기가 전부 비어 있습니다 — 무엇을 골라도 아무 일도 일어나지 않습니다.`, where });
    }
  }
  if (kind === "battleProcessing" && command.branchOnResult === true && commandList(command.victoryBranch).length === 0) {
    findings.push({ severity: "warning", code: "battle-empty-victory", message: "전투가 결과로 분기하지만 승리 분기가 비어 있습니다.", where });
  }
  if (kind === "fork" && commandList(command.then).length === 0 && commandList(command.else).length === 0) {
    findings.push({ severity: "warning", code: "fork-empty", message: "조건 분기의 양쪽이 모두 비어 있습니다.", where });
  }
  if (kind === "loop" && commandList(command.body).length === 0) {
    findings.push({ severity: "warning", code: "loop-empty", message: "반복 명령의 본문이 비어 있습니다.", where });
  }
  // 알려진 분기 키 밖에 명령 배열을 품은 필드(예: fork 의 `branch`)도 잡는다 — 런타임이 실행하지 않는다.
  const walked = new Set(childLists(command).map((child) => child.key.split(/[.[]/u)[0]));
  for (const [key, value] of Object.entries(command)) {
    if (walked.has(key) || key === "options" || !Array.isArray(value) || value.length === 0) continue;
    if (value.every((item) => item && typeof item === "object" && typeof (item as { kind?: unknown }).kind === "string")) {
      findings.push({ severity: "blocker", code: "command-orphan-branch", message: `${kind} 명령의 \`${key}\` 에 명령 ${value.length}개가 있지만 런타임은 이 키를 실행하지 않습니다.`, where });
    }
  }
}

export function checkCommands(project: Project): Finding[] {
  const findings: Finding[] = [];
  visitAllCommands(project, (entry) => checkOne(project, entry, findings));
  // 에디터 저장 검증기의 참조 검사 — 같은 결함을 다른 말로 한 번 더 말할 수 있지만, 이쪽에만 있는 검사도 있다.
  for (const issue of collectProjectReferenceIssues(project)) {
    findings.push({ severity: "warning", code: "reference-validator", message: `참조 검증기: ${issue}` });
  }
  return findings;
}
