// editor/tools/bestiaryTools.ts
// 괴물 도감(일반 RPG, 2026-10-31) — define_bestiary_entry 로 항목 하나(적 묶음 + 칸 여러 개)를 짓고, list_bestiary 로 읽는다.
// 칸은 처음 만남(seen)·처음 처치(defeated)·약점 발견(weakness)·조건(condition)으로 열린다. 이벤트에서 직접 열고 싶은 칸은
// unlockSwitchId 를 주면 그 스위치가 켜질 때 열린다(이벤트에서 setSwitch 한 줄). 규칙은 project/bestiary.ts.
import { validateFieldMenu } from "@/project/fieldMenu";
import {
  BESTIARY_DEFAULT_TITLE,
  BESTIARY_SECTION_LIMIT,
  BESTIARY_UNLOCKS,
  BESTIARY_UNLOCK_LABELS,
  isBestiaryUnlock,
  normalizeBestiary,
  type BestiaryEntry,
  type BestiarySection,
} from "@/project/bestiary";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import type { Condition, Project } from "@/project/types";
import { ensureNamedSwitch } from "./flagHelpers";
import { CONDITION_SCHEMA } from "./schemaShapes";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const s = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

type SectionArg = { id?: unknown; title?: unknown; text?: unknown; unlock?: unknown; unlockWhen?: unknown; unlockSwitchId?: unknown };

/** 저작된 ESC 메뉴가 있으면 「도감」 항목을 넣는다(저장 앞). 없으면 기본 메뉴의 「기록」 묶음에 스스로 보인다. */
function ensureMenuEntry(p: Project, label: string): string {
  const menu = p.meta.oprnFieldMenu;
  if (!menu) return "기본 ESC 메뉴의 「기록」 묶음에 도감이 보입니다";
  if (menu.entries.some((entry) => entry.command === "bestiary")) return "ESC 메뉴에 도감 항목이 이미 있습니다";
  if (menu.entries.length >= 12) return "저작된 ESC 메뉴가 이미 12칸이라 도감 항목을 넣지 못했습니다 — configure_field_menu 로 한 칸 비우고 add:[{command:\"bestiary\"}]";
  const entries = [...menu.entries];
  const at = entries.findIndex((entry) => entry.command === "save" || entry.command === "to-title");
  entries.splice(at < 0 ? entries.length : at, 0, { command: "bestiary", label });
  const next = { ...menu, entries };
  validateFieldMenu(next);
  p.meta.oprnFieldMenu = next;
  return "저작된 ESC 메뉴에 도감 항목을 넣었습니다";
}

const SECTION_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", description: "칸 id(항목 안에서 겹치지 않게). 예: look, habit, weakness, lore" },
    title: { type: "string", description: "칸 제목. 예: 외형, 습성, 약점, 처치 기록" },
    text: { type: "string", description: "열렸을 때 보이는 글(400자 이하)" },
    unlock: {
      type: "string",
      enum: [...BESTIARY_UNLOCKS],
      description: "언제 열리나. seen=전투에서 처음 만나면(기본) · defeated=처음 쓰러뜨리면 · weakness=전투에서 약점을 하나라도 맞히면(약점 칸, 알아낸 약점이 함께 적힌다) · condition=unlockWhen 이 참이면(단서 스위치 등)",
    },
    unlockWhen: { ...CONDITION_SCHEMA, description: "unlock:condition 일 때의 조건. 단서 둘 다 = {kind:\"all\",conditions:[{kind:\"switch\",switchId:\"sw_clue_1\",value:true},{kind:\"switch\",switchId:\"sw_clue_2\",value:true}]}" },
    unlockSwitchId: { type: "string", description: "이 스위치가 켜지면 열린다(unlock:condition 을 대신 채운다). 없는 스위치면 만든다 — 증인 대사 끝에 setSwitch 로 켜면 「이벤트로 칸 열기」가 된다" },
  },
  required: ["id", "title", "text"],
  additionalProperties: false,
} as const;

function parseSection(draft: Project, entryId: string, raw: SectionArg, index: number, warnings: string[]): BestiarySection {
  const id = s(raw.id);
  const title = s(raw.title);
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!id || !title || !text) throw new ToolError(`sections[${index}]: id·title·text 가 모두 필요합니다.`, { code: "invalid-args" });
  if (text.length > 400) throw new ToolError(`sections[${index}]: text 는 400자 이하입니다(지금 ${text.length}자).`, { code: "invalid-args" });
  if (raw.unlock !== undefined && !isBestiaryUnlock(raw.unlock)) throw new ToolError(`sections[${index}].unlock 은 ${BESTIARY_UNLOCKS.join("|")} 중 하나입니다.`, { code: "invalid-args" });
  const switchId = s(raw.unlockSwitchId);
  let unlock = (raw.unlock as BestiarySection["unlock"]) ?? (switchId || raw.unlockWhen !== undefined ? "condition" : "seen");
  let unlockWhen: Condition | undefined;
  if (switchId) {
    if (raw.unlockWhen !== undefined) throw new ToolError(`sections[${index}]: unlockSwitchId 와 unlockWhen 은 하나만 줍니다.`, { code: "invalid-args" });
    if (unlock !== "condition") throw new ToolError(`sections[${index}]: unlockSwitchId 는 unlock:condition 칸에만 씁니다.`, { code: "invalid-args" });
    if (!draft.switches.some((entry) => entry.id === switchId)) ensureNamedSwitch(draft, switchId, `도감 ${entryId}·${title}`);
    unlockWhen = { kind: "switch", switchId, value: true };
  } else if (raw.unlockWhen !== undefined) {
    try {
      validateConditionShape(`sections[${index}].unlockWhen`, raw.unlockWhen);
    } catch (error) {
      throw new ToolError(`${String(error)} — unlockWhen 은 이벤트 페이지 조건과 같은 모양입니다.`, { code: "invalid-args" });
    }
    unlockWhen = structuredClone(raw.unlockWhen) as Condition;
    unlock = "condition";
  }
  if (unlock === "condition" && !unlockWhen) throw new ToolError(`sections[${index}]: unlock:condition 칸에는 unlockWhen 또는 unlockSwitchId 가 필요합니다.`, { code: "invalid-args" });
  if (unlock !== "condition" && unlockWhen) warnings.push(`sections[${index}]: unlock:${unlock} 칸이라 unlockWhen 은 쓰이지 않습니다`);
  return { id, title, text, ...(unlock !== "seen" ? { unlock } : {}), ...(unlock === "condition" && unlockWhen ? { unlockWhen } : {}) };
}

function entryRow(project: Project, entry: BestiaryEntry) {
  return {
    id: entry.id,
    name: entry.name,
    enemyIds: entry.enemyIds,
    enemyNames: entry.enemyIds.map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.name ?? `(없음 ${id})`),
    ...(entry.pictureResourceId ? { pictureResourceId: entry.pictureResourceId } : {}),
    sections: entry.sections.map((section) => ({
      id: section.id,
      title: section.title,
      unlock: section.unlock ?? "seen",
      unlockLabel: BESTIARY_UNLOCK_LABELS[section.unlock ?? "seen"],
      ...(section.unlockWhen ? { unlockWhen: section.unlockWhen } : {}),
      text: section.text,
    })),
  };
}

const defineBestiaryEntry: ToolDefinition = {
  name: "define_bestiary_entry",
  mode: "write",
  domains: ["database", "system"],
  description:
    "괴물 도감(일반 RPG — 사냥꾼·퇴마·몬스터 헌터)의 항목 하나를 만들거나 고친다. 도감을 켜고 ESC 메뉴에 「도감」을 넣는다. " +
    "항목 = 괴물 이름 + 묶이는 적 레코드(enemyIds, 보스판·변종을 함께) + 칸 여러 개(외형·습성·약점·처치 기록). 칸마다 언제 열리는지 정한다: " +
    "seen(처음 만나면, 기본) · defeated(처음 쓰러뜨리면) · weakness(전투에서 약점을 맞히면 — 알아낸 약점이 그 칸에 자동으로 적힌다) · condition(unlockWhen 조건, 예: 단서 스위치 둘 다). " +
    "증인 대사로 칸을 열려면 unlockSwitchId 를 주고 그 대사 끝에 setSwitch 를 넣는다. 잠긴 칸은 메뉴에서 「???」로 보이고, 새 칸이 열리면 화면 구석에 「도감에 적었다」 한 줄이 뜬다. " +
    "만남·처치·약점은 세이브에 남는다. 같은 id 로 다시 부르면 그 항목을 통째로 바꾼다(sections 를 다 준다). " +
    "도감을 일지 줄·퀘스트·설정집(upsert_world_codex, 플레이어가 못 본다)으로 흉내내지 말고 이 도구를 쓴다. 몬스터 수집(포켓몬류) 도감은 이 도구가 아니다. " +
    "remove:true 는 그 항목을 지운다. 먼저 get_database_records(enemies) 로 적 id 를 확인한다.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "항목 id. 예: bst_drowner" },
      name: { type: "string", description: "도감에 보이는 괴물 이름(적 레코드 이름과 달라도 된다). 예: 익사귀" },
      enemyIds: { type: "array", items: { type: "string" }, description: "이 항목으로 묶이는 적 레코드 id(1개 이상). 그중 하나라도 만나면·쓰러뜨리면·약점을 맞히면 센다" },
      pictureResourceId: { type: "string", description: "상세 그림. 생략 = 첫 적의 전투 그림" },
      sections: { type: "array", items: SECTION_SCHEMA, description: `칸(1~${BESTIARY_SECTION_LIMIT}개). 위에서부터 메뉴 순서` },
      title: { type: "string", description: "도감 메뉴 이름·제목(12자 이하). 기본 「도감」. 예: 괴물 기록" },
      remove: { type: "boolean", description: "이 id 의 항목을 지운다" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    id: "bst_drowner",
    name: "익사귀",
    enemyIds: ["enemy_ghoul_grave"],
    sections: [
      { id: "look", title: "외형", text: "물에 불은 살, 입에서 늪물을 흘린다.", unlock: "seen" },
      { id: "habit", title: "습성", text: "밤에만 물에서 나온다. 낮에는 진흙 속에서 잔다.", unlockWhen: { kind: "all", conditions: [{ kind: "switch", switchId: "sw_hc_clue_a_1", value: true }, { kind: "switch", switchId: "sw_hc_clue_a_2", value: true }] } },
      { id: "weakness", title: "약점", text: "불을 싫어한다. 은을 바른 칼이 잘 든다.", unlock: "weakness" },
      { id: "kill", title: "처치 기록", text: "늪 마을 사람들이 다시 물을 길으러 나온다.", unlock: "defeated" },
    ],
  },
  run(draft, args): ToolExecResult {
    const id = s(args.id);
    if (!id) throw new ToolError("id 가 필요합니다.", { code: "invalid-args" });
    const current = normalizeBestiary(draft.system.bestiary) ?? { enabled: true, entries: [] };
    if (args.remove === true) {
      const entries = current.entries.filter((entry) => entry.id !== id);
      if (entries.length === current.entries.length) throw new ToolError(`도감 항목 ${id} 가 없습니다.`, { code: "invalid-args" });
      draft.system.bestiary = { ...current, entries };
      return { summary: `도감 항목 ${id} 를 지웠습니다(남은 항목 ${entries.length}).`, data: { removed: id, remaining: entries.length } };
    }
    const warnings: string[] = [];
    const name = s(args.name);
    if (!name) throw new ToolError("name 이 필요합니다.", { code: "invalid-args" });
    const enemyIds = [...new Set((Array.isArray(args.enemyIds) ? args.enemyIds : []).map(s).filter(Boolean))];
    if (enemyIds.length === 0) throw new ToolError("enemyIds 에 적 레코드 id 를 하나 이상 줍니다(get_database_records enemies).", { code: "invalid-args" });
    const missing = enemyIds.filter((enemyId) => !draft.database.enemies.some((enemy) => enemy.id === enemyId));
    if (missing.length) throw new ToolError(`없는 적 레코드: ${missing.join(", ")} — get_database_records(enemies) 로 id 를 확인하세요.`, { code: "invalid-args" });
    const rawSections = Array.isArray(args.sections) ? (args.sections as SectionArg[]) : [];
    if (rawSections.length === 0 || rawSections.length > BESTIARY_SECTION_LIMIT) throw new ToolError(`sections 는 1~${BESTIARY_SECTION_LIMIT}개입니다.`, { code: "invalid-args" });
    const sections = rawSections.map((raw, index) => parseSection(draft, id, raw ?? {}, index, warnings));
    const dup = sections.find((section, index) => sections.findIndex((other) => other.id === section.id) !== index);
    if (dup) throw new ToolError(`칸 id ${dup.id} 가 겹칩니다.`, { code: "invalid-args" });
    if (!sections.some((section) => section.unlock === "weakness")) warnings.push("약점 칸(unlock:weakness)이 없습니다 — 전투에서 알아낸 약점은 상세 아래 「전투에서 알아낸 것」 줄로만 보입니다");
    const picture = s(args.pictureResourceId);
    const entry: BestiaryEntry = { id, name, enemyIds, ...(picture ? { pictureResourceId: picture } : {}), sections };
    const others = current.entries.filter((row) => row.id !== id);
    const replaced = others.length !== current.entries.length;
    const index = current.entries.findIndex((row) => row.id === id);
    const entries = replaced ? current.entries.map((row) => (row.id === id ? entry : row)) : [...others, entry];
    for (const enemyId of enemyIds) {
      const other = entries.find((row) => row.id !== id && row.enemyIds.includes(enemyId));
      if (other) warnings.push(`적 ${enemyId} 는 항목 ${other.id} 에도 묶여 있습니다 — 한 번 만나면 두 항목이 같이 열립니다`);
    }
    const title = s(args.title).slice(0, 12) || current.title;
    const next = normalizeBestiary({ enabled: true, ...(title ? { title } : {}), entries });
    if (!next) throw new ToolError("도감 설정을 만들지 못했습니다.", { code: "invalid-args" });
    draft.system.bestiary = next;
    const menuNotice = ensureMenuEntry(draft, title || BESTIARY_DEFAULT_TITLE);
    // 약점 칸은 전투의 「약점 발견」 기록(knownWeaknesses)을 읽는다 — 그 기록은 revealWeakness 와 무관하게 늘 쌓인다.
    if (draft.system.battleStaging?.revealWeakness === "never") warnings.push("전투 설정 revealWeakness:never 라 대상 고르기에는 약점이 안 보입니다. 도감의 약점 칸은 그대로 열립니다");
    const switches = sections.flatMap((section) => (section.unlockWhen?.kind === "switch" ? [section.unlockWhen.switchId] : []));
    return {
      summary:
        `도감 항목 「${name}」(${enemyIds.length}종 적, 칸 ${sections.length}개: ${sections.map((section) => `${section.title}=${BESTIARY_UNLOCK_LABELS[section.unlock ?? "seen"]}`).join(", ")})을 ${replaced ? "바꿨습니다" : "더했습니다"}` +
        ` — 도감 항목 ${next.entries.length}개. ${menuNotice}.` +
        (switches.length ? ` 조건 칸 스위치: ${switches.join(", ")}(이벤트에서 켜면 열린다).` : "") +
        (warnings.length ? ` 주의: ${warnings.join("; ")}.` : ""),
      data: { entry: entryRow(draft, entry), position: replaced ? index : next.entries.length - 1, entryCount: next.entries.length, warnings },
    };
  },
};

const listBestiary: ToolDefinition = {
  name: "list_bestiary",
  mode: "read",
  domains: ["database", "system"],
  description: "괴물 도감 설정을 읽는다 — 켜짐, 제목, 항목마다 묶인 적·칸(제목·여는 방법·조건·글). 도감에 아직 없는 적 레코드 목록도 준다. define_bestiary_entry 전에 읽는다.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  run(project): ToolExecResult {
    const config = normalizeBestiary(project.system.bestiary);
    const entries = (config?.entries ?? []).map((entry) => entryRow(project, entry));
    const covered = new Set(entries.flatMap((entry) => entry.enemyIds));
    const uncovered = project.database.enemies.filter((enemy) => !covered.has(enemy.id)).map((enemy) => ({ id: enemy.id, name: enemy.name }));
    return {
      summary: config
        ? `괴물 도감 「${config.title ?? BESTIARY_DEFAULT_TITLE}」 ${config.enabled ? "켜짐" : "꺼짐"} — 항목 ${entries.length}개, 도감에 없는 적 ${uncovered.length}종.`
        : `괴물 도감이 아직 없습니다 — 적 ${uncovered.length}종. define_bestiary_entry 로 첫 항목을 만들면 켜집니다.`,
      data: { enabled: config?.enabled ?? false, title: config?.title ?? BESTIARY_DEFAULT_TITLE, entries, uncoveredEnemies: uncovered.slice(0, 80) },
    };
  },
};

export const BESTIARY_TOOLS: readonly ToolDefinition[] = [defineBestiaryEntry, listBestiary];
