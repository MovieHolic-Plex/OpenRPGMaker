// project/localization.ts
// 게임 콘텐츠 다국어(Localization) 추출 · RFC 4180 CSV 입출력 · 번들 적용 · 런타임 프로젝트 번역 뷰.
// 에디터·AI·하네스 모듈을 import 하지 않으므로 출하 플레이어와 편집기 양쪽에서 순수하게 사용할 수 있다.
import { isQuestGraphDef, isStepQuestDef } from "@/project/quest/questDef";
import type { Command, Project, ProjectLocalizationTable } from "@/project/types";

export type LocalizationCategory =
  | "meta"
  | "map"
  | "database"
  | "quest"
  | "dialogue"
  | "choice"
  | "commonEvent";

export interface LocalizationEntry {
  readonly key: string;
  readonly category: LocalizationCategory;
  readonly source: string;
  readonly context?: string;
}

export interface ParsedLocalizationCsvRow {
  readonly key: string;
  readonly category?: string;
  readonly context?: string;
  readonly source?: string;
  readonly translation: string;
}

/**
 * 프로젝트의 모든 번역 가능 콘텐츠 문자열을 안정적이고 결정론적인 키로 추출한다.
 * 포함 대상: 게임 제목/타이틀 설정, 맵 이름, DB 레코드(액터·직업·스킬·아이템·장비·적·상태),
 * 퀘스트, 맵 이벤트 대사(text speaker/body)·선택지(choices prompt/options)·엔딩, 공통 이벤트.
 */
export function extractProjectStrings(project: Project): LocalizationEntry[] {
  const entries: LocalizationEntry[] = [];
  const push = (
    key: string,
    category: LocalizationCategory,
    value: string | undefined,
    context?: string,
  ): void => {
    if (typeof value !== "string" || value.length === 0) return;
    entries.push({ key, category, source: value, ...(context ? { context } : {}) });
  };

  // 1. 메타 / 타이틀
  push("meta.title", "meta", project.meta?.title, "Game title");
  push("system.titleScreen.title", "meta", project.system?.titleScreen?.title, "Title screen title");
  push("system.titleScreen.logoSubtitle", "meta", project.system?.titleScreen?.logoSubtitle, "Title screen subtitle");

  // 2. 데이터베이스 레코드
  const db = project.database;
  if (db) {
    for (const actor of db.actors ?? []) {
      push(`db.actor.${actor.id}.name`, "database", actor.name, "Actor name");
      push(`db.actor.${actor.id}.nickname`, "database", actor.nickname, "Actor nickname");
    }
    for (const cls of db.classes ?? []) {
      push(`db.class.${cls.id}.name`, "database", cls.name, "Class name");
    }
    for (const skill of db.skills ?? []) {
      push(`db.skill.${skill.id}.name`, "database", skill.name, "Skill name");
      push(`db.skill.${skill.id}.description`, "database", skill.description, "Skill description");
    }
    for (const item of db.items ?? []) {
      push(`db.item.${item.id}.name`, "database", item.name, "Item name");
      push(`db.item.${item.id}.description`, "database", item.description, "Item description");
    }
    for (const equip of db.equipment ?? []) {
      push(`db.equipment.${equip.id}.name`, "database", equip.name, "Equipment name");
      push(`db.equipment.${equip.id}.description`, "database", equip.description, "Equipment description");
    }
    for (const enemy of db.enemies ?? []) {
      push(`db.enemy.${enemy.id}.name`, "database", enemy.name, "Enemy name");
    }
    for (const state of db.states ?? []) {
      push(`db.state.${state.id}.name`, "database", state.name, "State name");
    }
  }

  // 3. 퀘스트
  for (const quest of project.quests ?? []) {
    if (isQuestGraphDef(quest)) {
      push(`quest.${quest.id}.title`, "quest", quest.title, "Quest title");
      push(`quest.${quest.id}.summary`, "quest", quest.summary, "Quest summary");
      for (const node of quest.nodes ?? []) {
        push(`quest.${quest.id}.node.${node.id}.description`, "quest", node.description, "Quest node");
      }
    } else if (isStepQuestDef(quest)) {
      push(`quest.${quest.key}.title`, "quest", quest.title, "Quest title");
      push(`quest.${quest.key}.summary`, "quest", quest.summary, "Quest summary");
      for (const [idx, step] of (quest.steps ?? []).entries()) {
        push(`quest.${quest.key}.step.${idx}.label`, "quest", step.label, "Quest step");
      }
      if (quest.dialogue) {
        for (const field of ["offer", "accepted", "declined", "reminder", "completed", "afterComplete"] as const) {
          push(`quest.${quest.key}.dialogue.${field}`, "quest", quest.dialogue[field], `Quest dialogue (${field})`);
        }
      }
      for (const [idx, gate] of (quest.gates ?? []).entries()) {
        push(`quest.${quest.key}.gate.${idx}.lockedText`, "quest", gate.lockedText, "Quest gate");
      }
    }
  }

  // 4. 맵 이름 및 이벤트 대사/선택지 (mapId 오름차순으로 결정론적 순서 보장)
  const mapIds = Object.keys(project.maps ?? {}).sort();
  for (const mapId of mapIds) {
    const map = project.maps[mapId];
    if (!map) continue;
    push(`map.${mapId}.name`, "map", map.name, "Map name");
    for (const event of map.events ?? []) {
      const pages = event.pages && event.pages.length > 0
        ? event.pages
        : event.commands && event.commands.length > 0
          ? [{ commands: event.commands }]
          : [];
      for (const [pageIdx, page] of pages.entries()) {
        walkCommandsExtract(
          page.commands ?? [],
          `map.${mapId}.ev.${event.id}.p${pageIdx}`,
          "dialogue",
          entries,
        );
      }
    }
  }

  // 5. 공통 이벤트
  for (const common of project.commonEvents ?? []) {
    walkCommandsExtract(
      common.commands ?? [],
      `common.${common.id}`,
      "commonEvent",
      entries,
    );
  }

  return entries;
}

function walkCommandsExtract(
  commands: readonly Command[],
  prefix: string,
  defaultCategory: LocalizationCategory,
  out: LocalizationEntry[],
): void {
  const push = (key: string, category: LocalizationCategory, value: string | undefined, context?: string): void => {
    if (typeof value !== "string" || value.length === 0) return;
    out.push({ key, category, source: value, ...(context ? { context } : {}) });
  };

  for (const [index, command] of commands.entries()) {
    const path = `${prefix}.c${index}`;
    switch (command.kind) {
      case "text":
        if (command.speaker && command.speaker.trim().length > 0) {
          push(`${path}.speaker`, defaultCategory, command.speaker, "Speaker");
        }
        push(`${path}.body`, defaultCategory, command.body, command.speaker ? `Dialogue (${command.speaker})` : "Dialogue");
        break;
      case "choices":
        if (command.prompt && command.prompt.trim().length > 0) {
          push(`${path}.prompt`, "choice", command.prompt, "Choice prompt");
        }
        for (const [optIdx, option] of (command.options ?? []).entries()) {
          push(`${path}.opt.${optIdx}`, "choice", option.text, `Choice option ${optIdx + 1}`);
          if (option.disabledText && option.disabledText.trim().length > 0) {
            push(`${path}.opt.${optIdx}.disabled`, "choice", option.disabledText, `Choice disabled reason ${optIdx + 1}`);
          }
          if (option.branch?.length) {
            walkCommandsExtract(option.branch, `${path}.opt${optIdx}`, defaultCategory, out);
          }
        }
        if (command.cancelBranch?.length) {
          walkCommandsExtract(command.cancelBranch, `${path}.cancel`, defaultCategory, out);
        }
        break;
      case "fork":
        if (command.then?.length) walkCommandsExtract(command.then, `${path}.then`, defaultCategory, out);
        if (command.else?.length) walkCommandsExtract(command.else, `${path}.else`, defaultCategory, out);
        break;
      case "loop":
        if (command.body?.length) walkCommandsExtract(command.body, `${path}.loop`, defaultCategory, out);
        break;
      case "presentItem":
        if (command.prompt && command.prompt.trim().length > 0) {
          push(`${path}.prompt`, "choice", command.prompt, "Present item prompt");
        }
        for (const [optIdx, option] of (command.options ?? []).entries()) {
          if (option.branch?.length) walkCommandsExtract(option.branch, `${path}.opt${optIdx}`, defaultCategory, out);
        }
        if (command.otherwiseBranch?.length) walkCommandsExtract(command.otherwiseBranch, `${path}.other`, defaultCategory, out);
        if (command.cancelBranch?.length) walkCommandsExtract(command.cancelBranch, `${path}.cancel`, defaultCategory, out);
        break;
      case "battleProcessing":
        if (command.victoryBranch?.length) walkCommandsExtract(command.victoryBranch, `${path}.victory`, defaultCategory, out);
        if (command.defeatBranch?.length) walkCommandsExtract(command.defeatBranch, `${path}.defeat`, defaultCategory, out);
        if (command.escapeBranch?.length) walkCommandsExtract(command.escapeBranch, `${path}.escape`, defaultCategory, out);
        break;
      case "tacticsBattle":
        if (command.victoryBranch?.length) walkCommandsExtract(command.victoryBranch, `${path}.victory`, defaultCategory, out);
        if (command.defeatBranch?.length) walkCommandsExtract(command.defeatBranch, `${path}.defeat`, defaultCategory, out);
        break;
      case "promoteActor":
      case "evolveMonster":
        if (command.successBranch?.length) walkCommandsExtract(command.successBranch, `${path}.success`, defaultCategory, out);
        if (command.failureBranch?.length) walkCommandsExtract(command.failureBranch, `${path}.failure`, defaultCategory, out);
        break;
      case "shop":
        if (command.title && command.title.trim().length > 0) {
          push(`${path}.title`, defaultCategory, command.title, "Shop title");
        }
        if (command.transactionBranch?.length) walkCommandsExtract(command.transactionBranch, `${path}.tx`, defaultCategory, out);
        if (command.failedTransactionBranch?.length) walkCommandsExtract(command.failedTransactionBranch, `${path}.txFail`, defaultCategory, out);
        break;
      case "inn":
        if (command.note && command.note.trim().length > 0) push(`${path}.note`, defaultCategory, command.note, "Inn greeting");
        if (command.question && command.question.trim().length > 0) push(`${path}.question`, defaultCategory, command.question, "Inn question");
        if (command.notEnoughBranch?.length) walkCommandsExtract(command.notEnoughBranch, `${path}.noGold`, defaultCategory, out);
        break;
      case "ending":
        push(`${path}.title`, defaultCategory, command.title, "Ending title");
        push(`${path}.message`, defaultCategory, command.message, "Ending message");
        break;
      default:
        break;
    }
  }
}

/** RFC 4180 CSV 필드 이스케이프. 쉼표·따옴표·개행이 있으면 큰따옴표로 감싸고 내부 따옴표는 이중화한다. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }
  return value;
}

/**
 * 추출한 문자열 목록을 RFC 4180 호환 CSV 로 직렬화한다.
 * 열 구성: key,category,context,source,<translationColumn>
 */
export function exportLocalizationCsv(
  entries: readonly LocalizationEntry[],
  translations?: Readonly<Record<string, string>>,
  translationColumn = "translation",
): string {
  const header = ["key", "category", "context", "source", translationColumn].map(escapeCsvField).join(",");
  const rows = entries.map((entry) => {
    const translated = translations?.[entry.key] ?? "";
    return [
      entry.key,
      entry.category,
      entry.context ?? "",
      entry.source,
      translated,
    ].map(escapeCsvField).join(",");
  });
  return [header, ...rows].join("\r\n");
}

/** RFC 4180 상태 머신 CSV 파서. 멀티라인·큰따옴표 이스케이프("")·쉼표를 손실 없이 복원한다. */
function parseRawCsvRecords(input: string): string[][] {
  const text = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i += 1;
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (inQuotes || field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

/** CSV 문자열을 구조화 행 목록으로 파싱한다. */
export function parseLocalizationCsvRows(csv: string): ParsedLocalizationCsvRow[] {
  const records = parseRawCsvRecords(csv);
  if (records.length === 0) return [];
  const header = records[0]!.map((col) => col.trim().toLowerCase());
  const keyIndex = header.indexOf("key");
  if (keyIndex < 0) {
    // 헤더 없는 2열 CSV(key,translation) 폴백
    return records
      .filter((cols) => (cols[0] ?? "").trim().length > 0)
      .map((cols) => ({ key: (cols[0] ?? "").trim(), translation: cols[1] ?? "" }));
  }
  const categoryIndex = header.indexOf("category");
  const contextIndex = header.indexOf("context");
  const sourceIndex = header.indexOf("source");
  let translationIndex = header.indexOf("translation");
  if (translationIndex < 0) {
    // 마지막 열이 key/category/context/source 가 아니면 언어 코드 열(예: en, ja, zh)로 간주한다.
    const metaIndices = new Set([keyIndex, categoryIndex, contextIndex, sourceIndex]);
    for (let idx = header.length - 1; idx >= 0; idx -= 1) {
      if (!metaIndices.has(idx)) {
        translationIndex = idx;
        break;
      }
    }
  }
  if (translationIndex < 0) return [];

  const rows: ParsedLocalizationCsvRow[] = [];
  for (let r = 1; r < records.length; r += 1) {
    const cols = records[r]!;
    const key = (cols[keyIndex] ?? "").trim();
    if (!key) continue;
    rows.push({
      key,
      ...(categoryIndex >= 0 ? { category: cols[categoryIndex] ?? "" } : {}),
      ...(contextIndex >= 0 ? { context: cols[contextIndex] ?? "" } : {}),
      ...(sourceIndex >= 0 ? { source: cols[sourceIndex] ?? "" } : {}),
      translation: cols[translationIndex] ?? "",
    });
  }
  return rows;
}

/**
 * RFC 4180 CSV 문자열에서 `{ [key]: translation }` 번역 테이블을 파싱한다.
 * 빈 번역 셀은 건너뛰어 원문 폴백이 자연스럽게 동작하도록 한다.
 */
export function parseLocalizationCsv(csv: string): ProjectLocalizationTable {
  const table: ProjectLocalizationTable = {};
  for (const row of parseLocalizationCsvRows(csv)) {
    if (row.translation.length > 0) {
      table[row.key] = row.translation;
    }
  }
  return table;
}

function normalizeLocaleKey(locale: string): string {
  return locale.trim().toLowerCase().replace(/_/gu, "-");
}

function resolveLocalizationTable(
  project: Pick<Project, "meta"> | null | undefined,
  locale: string,
): Readonly<Record<string, string>> | undefined {
  const map = project?.meta?.localizations;
  if (!map) return undefined;
  const normalized = normalizeLocaleKey(locale);
  if (Object.hasOwn(map, locale)) return map[locale];
  if (Object.hasOwn(map, normalized)) return map[normalized];
  const base = normalized.split("-")[0] ?? normalized;
  if (Object.hasOwn(map, base)) return map[base];
  for (const [k, table] of Object.entries(map)) {
    if (normalizeLocaleKey(k) === normalized || normalizeLocaleKey(k) === base) return table;
  }
  return undefined;
}

/**
 * 프로젝트의 `meta.localizations[locale]` 에 번역 번들을 병합한 새 프로젝트 사본을 반환한다(순수 함수).
 */
export function applyLocalizationBundle(
  project: Project,
  locale: string,
  table: Readonly<Record<string, string>>,
): Project {
  const key = normalizeLocaleKey(locale);
  if (!key) return project;
  const existing = project.meta.localizations?.[key] ?? {};
  const nextTable: ProjectLocalizationTable = { ...existing };
  for (const [entryKey, value] of Object.entries(table)) {
    if (typeof value === "string" && value.length > 0) {
      nextTable[entryKey] = value;
    }
  }
  return {
    ...project,
    meta: {
      ...project.meta,
      localizations: {
        ...(project.meta.localizations ?? {}),
        [key]: nextTable,
      },
    },
  };
}

/** 런타임에서 단일 키의 번역문을 조회한다. 없거나 비어 있으면 fallback 을 반환한다. */
export function lookupLocalizedText(
  project: Pick<Project, "meta"> | null | undefined,
  locale: string,
  key: string,
  fallback: string,
): string {
  const table = resolveLocalizationTable(project, locale);
  const translated = table?.[key];
  return typeof translated === "string" && translated.length > 0 ? translated : fallback;
}

/** 프로젝트에 등록된 로컬라이징 언어 코드 목록을 반환한다. */
export function listProjectLocales(project: Pick<Project, "meta"> | null | undefined): string[] {
  return Object.keys(project?.meta?.localizations ?? {}).sort();
}

/**
 * 런타임에서 플레이어가 언어를 바꿀 때 프로젝트 복사본에 해당 로캘의 번역을 일괄 적용하는 순수 함수.
 * 원본 project 는 절대 변경하지 않는다. 해당 로캘의 번역 테이블이 비어 있으면 얕은/깊은 사본 없이 원본 복제본을 돌려준다.
 */
export function translateProjectContent(project: Project, locale: string): Project {
  const table = resolveLocalizationTable(project, locale);
  const translated = structuredClone(project);
  if (!table || Object.keys(table).length === 0) return translated;

  const pick = (key: string, current: string): string => {
    const value = table[key];
    return typeof value === "string" && value.length > 0 ? value : current;
  };
  const pickOptional = (key: string, current: string | undefined): string | undefined => {
    const value = table[key];
    return typeof value === "string" && value.length > 0 ? value : current;
  };

  // 1. 메타 / 타이틀
  translated.meta.title = pick("meta.title", translated.meta.title);
  if (translated.system?.titleScreen) {
    translated.system.titleScreen.title = pick("system.titleScreen.title", translated.system.titleScreen.title);
    if (translated.system.titleScreen.logoSubtitle !== undefined || table["system.titleScreen.logoSubtitle"]) {
      translated.system.titleScreen.logoSubtitle = pickOptional(
        "system.titleScreen.logoSubtitle",
        translated.system.titleScreen.logoSubtitle,
      );
    }
  }

  // 2. 데이터베이스 레코드
  const db = translated.database;
  if (db) {
    for (const actor of db.actors ?? []) {
      actor.name = pick(`db.actor.${actor.id}.name`, actor.name);
      actor.nickname = pick(`db.actor.${actor.id}.nickname`, actor.nickname);
    }
    for (const cls of db.classes ?? []) {
      cls.name = pick(`db.class.${cls.id}.name`, cls.name);
    }
    for (const skill of db.skills ?? []) {
      skill.name = pick(`db.skill.${skill.id}.name`, skill.name);
      skill.description = pick(`db.skill.${skill.id}.description`, skill.description);
    }
    for (const item of db.items ?? []) {
      item.name = pick(`db.item.${item.id}.name`, item.name);
      item.description = pick(`db.item.${item.id}.description`, item.description);
    }
    for (const equip of db.equipment ?? []) {
      equip.name = pick(`db.equipment.${equip.id}.name`, equip.name);
      equip.description = pick(`db.equipment.${equip.id}.description`, equip.description);
    }
    for (const enemy of db.enemies ?? []) {
      enemy.name = pick(`db.enemy.${enemy.id}.name`, enemy.name);
    }
    for (const state of db.states ?? []) {
      state.name = pick(`db.state.${state.id}.name`, state.name);
    }
  }

  // 3. 퀘스트
  if (translated.quests) {
    translated.quests = translated.quests.map((quest) => {
      if (isQuestGraphDef(quest)) {
        return {
          ...quest,
          title: pick(`quest.${quest.id}.title`, quest.title),
          ...(quest.summary !== undefined ? { summary: pick(`quest.${quest.id}.summary`, quest.summary) } : {}),
          nodes: quest.nodes.map((node) => ({
            ...node,
            description: pick(`quest.${quest.id}.node.${node.id}.description`, node.description),
          })),
        };
      }
      if (isStepQuestDef(quest)) {
        const nextDialogue = quest.dialogue
          ? {
              ...quest.dialogue,
              ...(quest.dialogue.offer !== undefined ? { offer: pick(`quest.${quest.key}.dialogue.offer`, quest.dialogue.offer) } : {}),
              ...(quest.dialogue.accepted !== undefined ? { accepted: pick(`quest.${quest.key}.dialogue.accepted`, quest.dialogue.accepted) } : {}),
              ...(quest.dialogue.declined !== undefined ? { declined: pick(`quest.${quest.key}.dialogue.declined`, quest.dialogue.declined) } : {}),
              ...(quest.dialogue.reminder !== undefined ? { reminder: pick(`quest.${quest.key}.dialogue.reminder`, quest.dialogue.reminder) } : {}),
              ...(quest.dialogue.completed !== undefined ? { completed: pick(`quest.${quest.key}.dialogue.completed`, quest.dialogue.completed) } : {}),
              ...(quest.dialogue.afterComplete !== undefined ? { afterComplete: pick(`quest.${quest.key}.dialogue.afterComplete`, quest.dialogue.afterComplete) } : {}),
            }
          : undefined;
        return {
          ...quest,
          title: pick(`quest.${quest.key}.title`, quest.title),
          summary: pick(`quest.${quest.key}.summary`, quest.summary),
          steps: quest.steps.map((step, idx) =>
            step.label !== undefined
              ? { ...step, label: pick(`quest.${quest.key}.step.${idx}.label`, step.label) }
              : step,
          ),
          ...(nextDialogue ? { dialogue: nextDialogue } : {}),
          ...(quest.gates
            ? {
                gates: quest.gates.map((gate, idx) => ({
                  ...gate,
                  lockedText: pick(`quest.${quest.key}.gate.${idx}.lockedText`, gate.lockedText),
                })),
              }
            : {}),
        };
      }
      return quest;
    });
  }

  // 4. 맵 이름 및 이벤트 명령
  for (const [mapId, map] of Object.entries(translated.maps ?? {})) {
    map.name = pick(`map.${mapId}.name`, map.name);
    for (const event of map.events ?? []) {
      if (event.pages && event.pages.length > 0) {
        for (const [pageIdx, page] of event.pages.entries()) {
          applyCommandsTranslation(page.commands ?? [], `map.${mapId}.ev.${event.id}.p${pageIdx}`, table);
        }
      } else if (event.commands && event.commands.length > 0) {
        applyCommandsTranslation(event.commands, `map.${mapId}.ev.${event.id}.p0`, table);
      }
    }
  }

  // 5. 공통 이벤트
  for (const common of translated.commonEvents ?? []) {
    applyCommandsTranslation(common.commands ?? [], `common.${common.id}`, table);
  }

  return translated;
}

function applyCommandsTranslation(
  commands: Command[],
  prefix: string,
  table: Readonly<Record<string, string>>,
): void {
  const pick = (key: string, current: string): string => {
    const value = table[key];
    return typeof value === "string" && value.length > 0 ? value : current;
  };
  const pickOptional = (key: string, current: string | undefined): string | undefined => {
    const value = table[key];
    return typeof value === "string" && value.length > 0 ? value : current;
  };

  for (const [index, command] of commands.entries()) {
    const path = `${prefix}.c${index}`;
    switch (command.kind) {
      case "text":
        if (command.speaker !== undefined) command.speaker = pickOptional(`${path}.speaker`, command.speaker);
        command.body = pick(`${path}.body`, command.body);
        break;
      case "choices":
        if (command.prompt !== undefined) command.prompt = pickOptional(`${path}.prompt`, command.prompt);
        for (const [optIdx, option] of (command.options ?? []).entries()) {
          option.text = pick(`${path}.opt.${optIdx}`, option.text);
          if (option.disabledText !== undefined) {
            option.disabledText = pickOptional(`${path}.opt.${optIdx}.disabled`, option.disabledText);
          }
          if (option.branch?.length) applyCommandsTranslation(option.branch, `${path}.opt${optIdx}`, table);
        }
        if (command.cancelBranch?.length) applyCommandsTranslation(command.cancelBranch, `${path}.cancel`, table);
        break;
      case "fork":
        if (command.then?.length) applyCommandsTranslation(command.then, `${path}.then`, table);
        if (command.else?.length) applyCommandsTranslation(command.else, `${path}.else`, table);
        break;
      case "loop":
        if (command.body?.length) applyCommandsTranslation(command.body, `${path}.loop`, table);
        break;
      case "presentItem":
        if (command.prompt !== undefined) command.prompt = pickOptional(`${path}.prompt`, command.prompt);
        for (const [optIdx, option] of (command.options ?? []).entries()) {
          if (option.branch?.length) applyCommandsTranslation(option.branch, `${path}.opt${optIdx}`, table);
        }
        if (command.otherwiseBranch?.length) applyCommandsTranslation(command.otherwiseBranch, `${path}.other`, table);
        if (command.cancelBranch?.length) applyCommandsTranslation(command.cancelBranch, `${path}.cancel`, table);
        break;
      case "battleProcessing":
        if (command.victoryBranch?.length) applyCommandsTranslation(command.victoryBranch, `${path}.victory`, table);
        if (command.defeatBranch?.length) applyCommandsTranslation(command.defeatBranch, `${path}.defeat`, table);
        if (command.escapeBranch?.length) applyCommandsTranslation(command.escapeBranch, `${path}.escape`, table);
        break;
      case "tacticsBattle":
        if (command.victoryBranch?.length) applyCommandsTranslation(command.victoryBranch, `${path}.victory`, table);
        if (command.defeatBranch?.length) applyCommandsTranslation(command.defeatBranch, `${path}.defeat`, table);
        break;
      case "promoteActor":
      case "evolveMonster":
        if (command.successBranch?.length) applyCommandsTranslation(command.successBranch, `${path}.success`, table);
        if (command.failureBranch?.length) applyCommandsTranslation(command.failureBranch, `${path}.failure`, table);
        break;
      case "shop":
        if (command.title !== undefined) command.title = pickOptional(`${path}.title`, command.title);
        if (command.transactionBranch?.length) applyCommandsTranslation(command.transactionBranch, `${path}.tx`, table);
        if (command.failedTransactionBranch?.length) applyCommandsTranslation(command.failedTransactionBranch, `${path}.txFail`, table);
        break;
      case "inn":
        if (command.note !== undefined) command.note = pickOptional(`${path}.note`, command.note);
        if (command.question !== undefined) command.question = pickOptional(`${path}.question`, command.question);
        if (command.notEnoughBranch?.length) applyCommandsTranslation(command.notEnoughBranch, `${path}.noGold`, table);
        break;
      case "ending":
        command.title = pick(`${path}.title`, command.title);
        command.message = pick(`${path}.message`, command.message);
        break;
      default:
        break;
    }
  }
}
