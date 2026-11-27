// 자료집을 한꺼번에 고치는 도구와, 다른 도구가 쓰지 못하던 자료집 칸의 작성 도구(2026-11-16 db-review 2단계).
//
// 왜: 「적 HP 를 전부 1.5배」「자료집을 전부 사이버펑크로」 같은 요청을 한 레코드씩 upsert 로 부르면 기본 자료집(적 106·스킬 1243·아이템 1000)에서
// 수백 번을 불러야 하고, 한 턴에 끝나지 않으면 모델은 남은 것을 모른 채 «다 했다» 고 쓴다. 이 파일의 bulk_edit_database 는
//   - 패치 여러 개를 한 번에(같은 upsert 도구를 레코드마다 그대로 돌린다 — 검사·정규화·참조 확인이 한 레코드 호출과 같다),
//   - 숫자 칸 하나에 대한 연산을 필터로 고른 레코드 전부에(곱하기·더하기·정하기, 반올림·하한·상한),
// 를 하고 결과에 «바꾼 것 · 못 바꾼 것(이유) · 아직 안 한 것(남은 수와 다음 호출)» 을 적는다. 상한에 닿아 멈추면 그렇다고 쓴다.
// 그리고 난이도·몬스터 합성·게임 오버 묶음·메뉴 모양·클릭 걷기·화면 배율·갤러리·스킬 트리·목록 순서 바꾸기는 쓰는 도구가 없었다 — 여기서 쓴다.
// 모델에게 가는 글(설명·결과)은 영어다.
import type { Project } from "@/project/types";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { DB_TOOLS } from "./dbTools";
import { DB_UPSERT_TOOLS } from "./dbUpsertEnvelope";
import { collectionRows, findRow, parseDeletableCollection, DELETABLE_DB_COLLECTIONS } from "./dbRecordDelete";
import { normalizeDifficulties, DIFFICULTY_LIMIT } from "@/project/difficulty";
import { normalizeMonsterFusions } from "@/project/monsterTrade";
import { normalizeGameOverSettings, type GameOverDefinition, type GameOverSettings } from "@/project/cinematicSettings";
import { MENU_SKINS } from "@/player/menuSkins/registry";
import { assertGrowthShape, growthIssues } from "@/project/growth/validation";
import { emptyGrowth, type GrowthDefinition } from "@/project/growth/types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** 한 호출이 고치는 레코드 수 상한 — 기본 자료집의 적 전부(106)·스킬 한 묶음이 한 번에 든다. 넘으면 남은 수와 다음 offset 을 적는다. */
export const BULK_MAX_RECORDS = 300;
/** 결과 글에 이름을 적는 실패 수. */
const SHOW_FAILS = 12;

/** bulk_edit_database 가 다루는 묶음 → 그 묶음의 upsert 도구(검사·정규화를 그대로 쓴다). */
const COLLECTION_TOOL: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(DB_UPSERT_TOOLS).map(([tool, spec]) => [spec.collection, tool]));
export const BULK_COLLECTIONS = Object.keys(COLLECTION_TOOL);

/** 점 경로 읽기·쓰기(stats.maxHp, rewards.gold). */
function readPath(rec: Obj, path: string): unknown {
  let cur: unknown = rec;
  for (const part of path.split(".")) { if (!isObj(cur)) return undefined; cur = cur[part]; }
  return cur;
}
function patchFor(path: string, value: unknown): Obj {
  const parts = path.split(".");
  const out: Obj = {};
  let cur = out;
  for (const [i, part] of parts.entries()) { if (i === parts.length - 1) cur[part] = value; else { cur[part] = {}; cur = cur[part] as Obj; } }
  return out;
}

/** 필터 — 모두 맞아야 한다. ids·이름 일부·숫자 칸 범위. */
interface Filter { ids?: unknown; nameContains?: unknown; field?: unknown; min?: unknown; max?: unknown }
function matchesFilter(rec: Obj, f: Filter | undefined): boolean {
  if (!f) return true;
  if (Array.isArray(f.ids) && f.ids.length && !f.ids.map(String).includes(String(rec.id))) return false;
  if (typeof f.nameContains === "string" && f.nameContains && !String(rec.name ?? "").includes(f.nameContains)) return false;
  if (typeof f.field === "string" && f.field) {
    const v = readPath(rec, f.field);
    if (typeof v !== "number") return false;
    if (typeof f.min === "number" && v < f.min) return false;
    if (typeof f.max === "number" && v > f.max) return false;
  }
  return true;
}

interface Outcome { readonly id: string; readonly ok: boolean; readonly why?: string }

/** 레코드 하나를 그 묶음의 upsert 도구로 고친다(같은 draft 위에서). 실패는 이유를 돌려준다 — 다른 레코드는 계속한다. */
function applyOne(draft: Project, collection: string, patch: Obj): Outcome {
  const toolName = COLLECTION_TOOL[collection]!;
  const tool = DB_TOOLS.find((candidate) => candidate.name === toolName)!;
  const arg = DB_UPSERT_TOOLS[toolName]!.arg;
  const id = String(patch.id ?? "");
  // 없는 id 에 이름이 없으면 도구는 «새 레코드에 이름이 필요하다» 고 한국어로 거절한다 — 모델에게는 영어로 뜻을 적는다.
  const rowsNow = collectionRows(draft, collection);
  if (rowsNow && !rowsNow.some((r) => r.id === id) && typeof patch.name !== "string") return { id, ok: false, why: "no record with this id (to create one, include name)" };
  // 실패한 레코드가 반쯤 바뀐 채 남지 않게 — 도구는 draft 를 고치다 던질 수 있다. 그 묶음 목록만 되돌린다.
  const rows = collectionRows(draft, collection);
  const keep = rows ? structuredClone(rows) : undefined;
  // Upserts also write outside their list: upsert_skill creates the combo switch (comboSwitchId) before later checks can throw,
  // and item/skill/equipment/state upserts mark stand-in icons in meta. Roll those back too.
  const keepSwitches = structuredClone(draft.switches);
  const keepIcons = draft.meta.oprnPlaceholderIcons ? structuredClone(draft.meta.oprnPlaceholderIcons) : undefined;
  try {
    tool.run(draft, { [arg]: patch });
    return { id, ok: true };
  } catch (error) {
    if (rows && keep) rows.splice(0, rows.length, ...keep);
    draft.switches = keepSwitches;
    if (keepIcons) draft.meta.oprnPlaceholderIcons = keepIcons; else delete draft.meta.oprnPlaceholderIcons;
    return { id, ok: false, why: (error instanceof Error ? error.message : String(error)).split("\n")[0]!.slice(0, 160) };
  }
}

const bulkEditDatabase: ToolDefinition = {
  name: "bulk_edit_database",
  description:
    "Edit many database records in one call. Either patches (a list of {id, …fields} for one collection — each is merged like the collection's upsert tool, with the same checks) "
    + "or op (one numeric field on every record the filter picks: multiply / add / set, with round, min, max). One summary lists what changed, what failed and why, and what is left. "
    + `Up to ${BULK_MAX_RECORDS} records per call — if more match, the result says how many are left and the offset to pass next. Use this instead of many single upserts.`,
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      collection: { type: "string", enum: BULK_COLLECTIONS, description: "Which records." },
      patches: { type: "array", items: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: true }, description: "Per-record changes: [{id, name?, description?, stats:{…}, …}]. Fields as in the collection's upsert tool. New ids create records." },
      op: {
        type: "object",
        description: "Numeric change on every record the filter picks.",
        properties: {
          field: { type: "string", description: "Dot path of a number field, e.g. stats.maxHp, rewards.gold, price, power." },
          multiply: { type: "number" }, add: { type: "number" }, set: { type: "number" },
          round: { type: "string", enum: ["round", "floor", "ceil", "none"], description: "Default round (integers)." },
          min: { type: "number", description: "Lower clamp." }, max: { type: "number", description: "Upper clamp." },
        },
        required: ["field"],
        additionalProperties: false,
      },
      filter: {
        type: "object",
        description: "Which records op touches (all must match). Omit = every record in the collection.",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          nameContains: { type: "string" },
          field: { type: "string", description: "Number field to range-check." }, min: { type: "number" }, max: { type: "number" },
        },
        additionalProperties: false,
      },
      offset: { type: "integer", minimum: 0, description: "Skip this many matching records (continue a cut-off call)." },
      dryRun: { type: "boolean", description: "true = report what would change, save nothing." },
    },
    required: ["collection"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const collection = String(args.collection ?? "");
    if (!COLLECTION_TOOL[collection]) throw new ToolError(`bulk_edit_database: collection must be one of ${BULK_COLLECTIONS.join(", ")}.`, { code: "invalid-args" });
    const patches = Array.isArray(args.patches) ? (args.patches as unknown[]) : undefined;
    const op = isObj(args.op) ? (args.op as Obj) : undefined;
    if (!!patches === !!op) throw new ToolError("bulk_edit_database: send either patches or op (not both, not neither).", { code: "invalid-args" });
    const offset = typeof args.offset === "number" && args.offset > 0 ? Math.floor(args.offset) : 0;
    const dry = args.dryRun === true;
    const rows = (collectionRows(draft, collection) ?? []) as unknown as Obj[];

    // 할 일 목록: 패치 그대로, 또는 필터로 고른 레코드마다 숫자 칸 하나.
    let work: Obj[];
    let skipped: Outcome[] = [];
    if (patches) {
      const bad = patches.filter((p) => !isObj(p) || typeof (p as Obj).id !== "string" || !String((p as Obj).id).trim());
      if (bad.length) throw new ToolError(`bulk_edit_database: every patch needs a string id (${bad.length} without one).`, { code: "invalid-args" });
      work = patches as Obj[];
    } else {
      const field = String(op!.field ?? "");
      if (!field) throw new ToolError("bulk_edit_database: op.field is required.", { code: "invalid-args" });
      const ways = ["multiply", "add", "set"].filter((k) => typeof op![k] === "number");
      if (ways.length !== 1) throw new ToolError("bulk_edit_database: op needs exactly one of multiply, add, set (a number).", { code: "invalid-args" });
      const picked = rows.filter((r) => matchesFilter(r, isObj(args.filter) ? (args.filter as Filter) : undefined));
      const round = op!.round === "floor" ? Math.floor : op!.round === "ceil" ? Math.ceil : op!.round === "none" ? (n: number) => n : Math.round;
      work = [];
      for (const rec of picked) {
        const was = readPath(rec, field);
        if (typeof was !== "number") { skipped.push({ id: String(rec.id), ok: false, why: `${field} is not a number here` }); continue; }
        let next = ways[0] === "multiply" ? was * (op!.multiply as number) : ways[0] === "add" ? was + (op!.add as number) : (op!.set as number);
        next = round(next);
        if (typeof op!.min === "number") next = Math.max(op!.min, next);
        if (typeof op!.max === "number") next = Math.min(op!.max, next);
        if (next === was) continue;
        work.push({ id: rec.id, ...patchFor(field, next), __was: was, __now: next });
      }
      if (!picked.length) return { summary: `No ${collection} record matches the filter — nothing changed.`, data: { changed: 0, failed: 0, left: 0 } };
    }

    const slice = work.slice(offset, offset + BULK_MAX_RECORDS);
    const left = Math.max(0, work.length - offset - slice.length);
    const done: Outcome[] = [];
    const samples: string[] = [];
    for (const item of slice) {
      const { __was, __now, ...patch } = item;
      if (dry) { done.push({ id: String(patch.id), ok: true }); if (samples.length < 6 && __was !== undefined) samples.push(`${String(patch.id)} ${String(__was)}→${String(__now)}`); continue; }
      const out = applyOne(draft, collection, patch);
      done.push(out);
      if (out.ok && samples.length < 6 && __was !== undefined) samples.push(`${out.id} ${String(__was)}→${String(__now)}`);
    }
    const ok = done.filter((d) => d.ok);
    const failed = [...done.filter((d) => !d.ok), ...skipped];
    const parts = [
      `${dry ? "(dry run — nothing saved) Would change" : "Changed"} ${ok.length} of ${rows.length} ${collection} record(s)${op ? ` (${String(op.field)})` : ""}${samples.length ? `, e.g. ${samples.join(", ")}` : ""}.`,
      failed.length ? `NOT CHANGED ${failed.length}: ${failed.slice(0, SHOW_FAILS).map((f) => `${f.id} (${f.why})`).join("; ")}${failed.length > SHOW_FAILS ? `; +${failed.length - SHOW_FAILS} more` : ""}.` : "",
      left ? `NOT FINISHED: ${left} more record(s) match — call again with the same arguments and offset:${offset + slice.length}.` : "",
    ].filter(Boolean);
    if (!ok.length && failed.length && !dry) throw new ToolError(parts.join(" "), { code: "bulk-nothing-changed" });
    return {
      summary: parts.join(" "),
      data: { collection, changed: ok.length, failed: failed.map((f) => ({ id: f.id, why: f.why })), left, ...(left ? { nextOffset: offset + slice.length } : {}), ids: ok.map((d) => d.id).slice(0, 400) },
      ...(failed.length ? { warnings: [`${failed.length} record(s) not changed — see the summary.`] } : {}),
    };
  },
};

/** 항목의 열쇠 — 전투 명령·배움표·행동 같은 목록 항목을 id 로 가리킨다. */
const entryKey = (entry: unknown): string => {
  if (!isObj(entry)) return String(entry);
  for (const k of ["id", "skillId", "itemId", "enemyId", "stateId", "commandId", "actorId", "classId"]) if (typeof entry[k] === "string") return entry[k] as string;
  return JSON.stringify(entry);
};

/**
 * 목록 순서 바꾸기. 자료집 목록(편집기 목록·상점 기본 순서) 또는 레코드 안의 목록 칸(직업의 battleCommands — 배우가 전투에서 보는 메뉴 순서,
 * 배움표, 적 행동…). 2026-11-16: database.battleCommands 의 순서는 전투 메뉴가 아니다 — 메뉴는 직업의 battleCommands(또는 배우의 battleCommandIds)를 따른다.
 */
const reorderDatabaseRecords: ToolDefinition = {
  name: "reorder_database_records",
  description:
    "Change the order of a database list. Without recordId: the records of one collection (editor list order). With recordId + field: the entries of a list inside that record — "
    + "the battle menu a character sees follows its class's battleCommands (collection:'classes', recordId:<class id>, field:'battleCommands'; an actor with its own battleCommandIds uses that list on 'actors'), not the order of the battleCommands collection. "
    + "order = ids in the new order (entries left out follow in their old order), or move:{id, to} puts one at list number «to» (1 = first). allRecords:true applies the same order to that field in every record of the collection.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      collection: { type: "string", enum: [...DELETABLE_DB_COLLECTIONS] },
      recordId: { type: "string", description: "Reorder a list field inside this record instead of the collection itself." },
      field: { type: "string", description: "The list field inside the record, e.g. battleCommands, learnedSkills, actions." },
      allRecords: { type: "boolean", description: "With field: reorder that field in every record of the collection (e.g. every class's battle menu)." },
      order: { type: "array", items: { type: "string" }, description: "Ids in the new order (the rest follow in their old order)." },
      move: { type: "object", properties: { id: { type: "string" }, to: { type: "integer", minimum: 1 } }, required: ["id", "to"], additionalProperties: false },
    },
    required: ["collection"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const collection = parseDeletableCollection(args.collection);
    const rows = collectionRows(draft, collection);
    if (!rows?.length) throw new ToolError(`${collection} is empty — nothing to reorder.`, { code: "invalid-args" });
    const order = Array.isArray(args.order) ? (args.order as unknown[]).map(String) : [];
    const move = isObj(args.move) ? (args.move as Obj) : undefined;
    if (!order.length && !move) throw new ToolError("Send order:[ids] or move:{id, to}.", { code: "invalid-args" });
    /** list 를 새 순서로. key = 항목 열쇠. 없는 id 는 거절. */
    const reorder = <T>(list: T[], key: (x: T) => string, label: string): T[] => {
      if (order.length) {
        const front = order.map((id): T => { const at = list.findIndex((x) => key(x) === id); if (at < 0) throw new ToolError(`${label}: no entry ${id}. Entries: ${list.map(key).slice(0, 20).join(", ")}.`, { code: "invalid-args" }); return list[at]!; });
        if (new Set(front).size !== front.length) throw new ToolError("order lists the same entry twice.", { code: "invalid-args" });
        return [...front, ...list.filter((x) => !front.includes(x))];
      }
      const at = list.findIndex((x) => key(x) === String(move!.id));
      if (at < 0) throw new ToolError(`${label}: no entry ${String(move!.id)}. Entries: ${list.map(key).slice(0, 20).join(", ")}.`, { code: "invalid-args" });
      const next = list.filter((_, i) => i !== at);
      next.splice(Math.max(1, Math.min(list.length, Number(move!.to))) - 1, 0, list[at]!);
      return next;
    };
    const field = typeof args.field === "string" ? args.field.trim() : "";
    if (field) {
      const targets = args.allRecords === true ? rows : [findRow(rows, collection, args.recordId).row];
      const done: string[] = [];
      for (const rec of targets as unknown as Obj[]) {
        const list = rec[field];
        if (!Array.isArray(list)) { if (args.allRecords === true) continue; throw new ToolError(`${collection} ${String(rec.id)} has no list field «${field}».`, { code: "invalid-args" }); }
        if (args.allRecords === true && order.some((id) => !list.some((x) => entryKey(x) === id))) continue;
        rec[field] = reorder(list, entryKey, `${collection} ${String(rec.id)}.${field}`);
        done.push(String(rec.id));
      }
      if (!done.length) throw new ToolError(`No ${collection} record has all of ${order.join(", ")} in «${field}».`, { code: "invalid-args" });
      const first = (targets as unknown as Obj[]).find((r) => r.id === done[0])!;
      return { summary: `Reordered ${field} in ${done.length} ${collection} record(s)${done.length <= 5 ? ` (${done.join(", ")})` : ""}. ${done[0]}.${field} now: ${(first[field] as unknown[]).map((x) => { const name = isObj(x) && typeof x.name === "string" ? ` «${x.name}»` : ""; return `${entryKey(x)}${name}`; }).join(", ")}.`, data: { collection, field, records: done } };
    }
    const before = rows.map((r) => r.id);
    const next = reorder(rows, (r) => r.id, collection);
    rows.splice(0, rows.length, ...next);
    const moved = rows.filter((r, i) => before[i] !== r.id).length;
    return { summary: `Reordered ${collection}: ${moved} position(s) changed. Now: ${rows.slice(0, 12).map((r, i) => `#${i + 1} ${r.id}${r.name ? ` «${r.name}»` : ""}`).join(", ")}${rows.length > 12 ? ` … (${rows.length})` : ""}.`, data: { collection, order: rows.map((r) => r.id) } };
  },
};

/** 난이도 목록 — 새 게임에서 고르고, 적 HP·공격·경험치·골드·조우율에 배율을 곱한다. */
const setDifficulties: ToolDefinition = {
  name: "set_difficulties",
  description:
    `Set the game's difficulty list (up to ${DIFFICULTY_LIMIT}). With 2+ rows New Game asks which one; each row multiplies enemy HP/attack, EXP, gold and encounter rate (1 = unchanged, 0.1–10). `
    + "Events can switch it (setDifficulty) and test it (condition kind:difficulty). difficulties:[] removes difficulty. Sends the whole list.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      difficulties: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" },
            enemyHpRate: { type: "number" }, enemyAttackRate: { type: "number" }, expRate: { type: "number" }, goldRate: { type: "number" }, encounterRate: { type: "number" },
          },
          required: ["id", "name"],
          additionalProperties: false,
        },
      },
      defaultDifficultyId: { type: "string", description: "Difficulty a new game starts on (default: first row)." },
    },
    required: ["difficulties"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const raw = Array.isArray(args.difficulties) ? args.difficulties : [];
    const rows = normalizeDifficulties(raw as never);
    if (raw.length && (!rows || rows.length < raw.length)) throw new ToolError(`Some difficulty rows were invalid or duplicated (kept ${rows?.length ?? 0} of ${raw.length}). Each needs a unique id and a name.`, { code: "invalid-args" });
    if (rows) draft.system.difficulties = rows; else delete draft.system.difficulties;
    const def = typeof args.defaultDifficultyId === "string" ? args.defaultDifficultyId.trim() : "";
    if (def && !rows?.some((r) => r.id === def)) throw new ToolError(`defaultDifficultyId ${def} is not in the list.`, { code: "invalid-args" });
    if (def) draft.system.defaultDifficultyId = def; else if (!rows || (draft.system.defaultDifficultyId && !rows.some((r) => r.id === draft.system.defaultDifficultyId))) delete draft.system.defaultDifficultyId;
    return { summary: rows ? `Difficulties: ${rows.map((r) => `${r.id} «${r.name}»`).join(", ")}${def ? ` (new game starts on ${def})` : ""}.` : "Difficulty removed (no choice at New Game).", data: { difficulties: rows ?? [] } };
  },
};

/** 몬스터 합성 표. */
const setMonsterFusions: ToolDefinition = {
  name: "set_monster_fusions",
  description: "Set the monster fusion table (fuseMonsters): each row says species A + species B → result species (order of A/B does not matter). Sends the whole table; [] removes it.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      fusions: { type: "array", items: { type: "object", properties: { speciesA: { type: "string" }, speciesB: { type: "string" }, resultSpeciesId: { type: "string" } }, required: ["speciesA", "speciesB", "resultSpeciesId"], additionalProperties: false } },
    },
    required: ["fusions"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const raw = Array.isArray(args.fusions) ? args.fusions : [];
    const known = new Set((draft.database.monsterSpecies ?? []).map((s) => s.id));
    const unknown = [...new Set((raw as Obj[]).flatMap((r) => [r.speciesA, r.speciesB, r.resultSpeciesId].map(String)).filter((id) => !known.has(id)))];
    if (unknown.length) throw new ToolError(`Unknown monster species: ${unknown.slice(0, 8).join(", ")}. Known: ${[...known].slice(0, 12).join(", ")}.`, { code: "invalid-args" });
    const rows = normalizeMonsterFusions(raw as never);
    if (rows) draft.system.monsterFusions = rows; else delete draft.system.monsterFusions;
    return { summary: rows ? `Fusion table: ${rows.length} row(s).` : "Fusion table removed.", data: { fusions: rows ?? [] } };
  },
};

const gameOverSettingsSchema: JsonSchema = {
  type: "object",
  properties: {
    presentation: { type: "string", enum: ["classic", "horror", "blackout"] },
    outcome: { type: "string", enum: ["menu", "recover"] },
    title: { type: "string" }, message: { type: "string" }, retryLabel: { type: "string" }, titleLabel: { type: "string" },
    goldLossPercent: { type: "integer", minimum: 0, maximum: 100 },
    recovery: { type: "object", properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["mapId", "x", "y"], additionalProperties: false },
    backgroundResourceId: { type: "string" },
  },
  additionalProperties: false,
};

/** 게임 오버 묶음 — 이름 붙은 게임 오버 여럿(이벤트 전투가 id 로 고른다)과 기본. set_game_over 는 기본 하나만 쓴다. */
const setGameOverLibrary: ToolDefinition = {
  name: "set_game_over_library",
  description:
    "Set named game-over definitions (several defeat screens that battles/events pick by id) and which one is the default. set_game_over edits only the single default screen; this writes the whole list. gameOvers:[] removes the list.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      gameOvers: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, settings: gameOverSettingsSchema }, required: ["id", "name", "settings"], additionalProperties: false } },
      defaultGameOverId: { type: "string" },
    },
    required: ["gameOvers"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const raw = Array.isArray(args.gameOvers) ? (args.gameOvers as Obj[]) : [];
    const ids = new Set<string>();
    const rows: GameOverDefinition[] = raw.map((r) => {
      const id = String(r.id ?? "").trim();
      if (!id || ids.has(id)) throw new ToolError(`Game-over ids must be unique and non-empty (${JSON.stringify(r.id)}).`, { code: "invalid-args" });
      ids.add(id);
      const settings = normalizeGameOverSettings((isObj(r.settings) ? r.settings : {}) as GameOverSettings);
      if (settings.recovery && !draft.maps[settings.recovery.mapId]) throw new ToolError(`${id}: recovery map ${settings.recovery.mapId} does not exist.`, { code: "invalid-args" });
      return { id, name: String(r.name ?? id).trim() || id, settings };
    });
    const def = typeof args.defaultGameOverId === "string" ? args.defaultGameOverId.trim() : "";
    if (def && !ids.has(def)) throw new ToolError(`defaultGameOverId ${def} is not in the list.`, { code: "invalid-args" });
    if (rows.length) draft.system.gameOvers = rows; else delete draft.system.gameOvers;
    const sys = draft.system as unknown as Obj;
    if (def) sys.defaultGameOverId = def; else if (!rows.length || !ids.has(String(sys.defaultGameOverId ?? ""))) delete sys.defaultGameOverId;
    return { summary: rows.length ? `Game-over list: ${rows.map((r) => r.id).join(", ")}${def ? ` (default ${def})` : ""}.` : "Game-over list removed (the single default screen from set_game_over stays).", data: { gameOvers: rows } };
  },
};

/** 화면·메뉴 설정 — 메뉴 모양, 클릭 걷기, 화면 배율, 갤러리. set_project_settings 에 없던 칸. */
const setPlaySettings: ToolDefinition = {
  name: "set_play_settings",
  description:
    "Set play-screen options that set_project_settings does not cover: menuUiStyle (ESC menu design), pointerMovement (click/tap a tile to walk there), "
    + "playSurfaceScale (adaptive = responsive integer pixel viewport with zero letterbox, integer = fixed whole-number zoom with borders, fit = fill the window), "
    + "portraitLayout (ds = top 55% portrait camera + bottom 45% UI/pad deck, fullbleed = 100% portrait world + translucent floating UI), "
    + "gallery (menu entry for unlocked pictures: enabled, label). Only the fields you send change.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      menuUiStyle: { type: "string", enum: Object.keys(MENU_SKINS) },
      pointerMovement: { type: "boolean" },
      playSurfaceScale: { type: "string", enum: ["adaptive", "integer", "fit"] },
      portraitLayout: { type: "string", enum: ["ds", "fullbleed"] },
      gallery: { type: "object", properties: { enabled: { type: "boolean" }, label: { type: "string" } }, required: ["enabled"], additionalProperties: false },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const changed: string[] = [];
    const sys = draft.system;
    if (typeof args.menuUiStyle === "string") { sys.menuUiStyle = args.menuUiStyle as typeof sys.menuUiStyle; changed.push(`menuUiStyle=${args.menuUiStyle}`); }
    if (typeof args.pointerMovement === "boolean") { if (args.pointerMovement) sys.pointerMovement = true; else delete sys.pointerMovement; changed.push(`pointerMovement=${args.pointerMovement}`); }
    if (args.playSurfaceScale === "adaptive" || args.playSurfaceScale === "integer" || args.playSurfaceScale === "fit") { sys.playSurfaceScale = args.playSurfaceScale; changed.push(`playSurfaceScale=${args.playSurfaceScale}`); }
    if (args.portraitLayout === "ds" || args.portraitLayout === "fullbleed") {
      if (args.portraitLayout === "ds") delete sys.portraitLayout;
      else sys.portraitLayout = args.portraitLayout;
      changed.push(`portraitLayout=${args.portraitLayout}`);
    }
    if (isObj(args.gallery)) {
      const label = typeof args.gallery.label === "string" ? args.gallery.label.trim() : "";
      sys.gallery = { enabled: args.gallery.enabled === true, ...(label ? { label } : {}) };
      changed.push(`gallery=${sys.gallery.enabled ? "on" : "off"}${label ? ` «${label}»` : ""}`);
    }
    if (!changed.length) throw new ToolError("Send at least one of menuUiStyle, pointerMovement, playSurfaceScale, portraitLayout, gallery.", { code: "invalid-args" });
    return { summary: `Play settings: ${changed.join(", ")}.`, data: { changed } };
  },
};

/** 스킬 트리(성장 포인트) — 트리 하나를 id 로 넣거나 바꾸거나 지운다. */
const upsertSkillTree: ToolDefinition = {
  name: "upsert_skill_tree",
  description:
    "Create, replace or delete one skill tree (growth points spent on nodes). tree = {id, name, description, classIds ([] = every class), allowReset, nodes:[{id, name, description, x, y, cost, maxRank, level, prerequisites:[node ids], effect:{kind:'skill', skillId} (maxRank 1) | {kind:'parameter', parameter, amount}}]}. "
    + "delete:true with tree.id removes it. points sets initialPoints / pointsPerLevel for the whole growth system.",
  mode: "write",
  domains: ["database"],
  parameters: {
    type: "object",
    properties: {
      tree: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: true },
      delete: { type: "boolean" },
      points: { type: "object", properties: { initialPoints: { type: "integer", minimum: 0 }, pointsPerLevel: { type: "integer", minimum: 0 } }, additionalProperties: false },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const growth: GrowthDefinition = structuredClone(draft.growth ?? emptyGrowth());
    const tree = isObj(args.tree) ? (args.tree as Obj) : undefined;
    const id = tree ? String(tree.id ?? "").trim() : "";
    let what = "";
    if (args.delete === true) {
      if (!id) throw new ToolError("delete needs tree.id.", { code: "invalid-args" });
      const before = growth.skillTrees.length;
      growth.skillTrees = growth.skillTrees.filter((t) => t.id !== id);
      if (growth.skillTrees.length === before) throw new ToolError(`No skill tree ${id}. Trees: ${growth.skillTrees.map((t) => t.id).join(", ") || "none"}.`, { code: "invalid-args" });
      what = `deleted tree ${id}`;
    } else if (tree) {
      const old = growth.skillTrees.find((t) => t.id === id);
      const next = { name: old?.name ?? id, description: old?.description ?? "", classIds: old?.classIds ?? [], allowReset: old?.allowReset ?? true, nodes: old?.nodes ?? [], ...old, ...tree, id } as GrowthDefinition["skillTrees"][number];
      growth.skillTrees = old ? growth.skillTrees.map((t) => (t.id === id ? next : t)) : [...growth.skillTrees, next];
      what = `${old ? "updated" : "created"} tree ${id} (${next.nodes.length} node(s))`;
    }
    if (isObj(args.points)) {
      if (typeof args.points.initialPoints === "number") growth.initialPoints = args.points.initialPoints;
      if (typeof args.points.pointsPerLevel === "number") growth.pointsPerLevel = args.points.pointsPerLevel;
      what = `${what ? `${what}; ` : ""}points ${growth.initialPoints} + ${growth.pointsPerLevel}/level`;
    }
    if (!what) throw new ToolError("Send tree, tree+delete, or points.", { code: "invalid-args" });
    try { assertGrowthShape(growth); } catch (error) { throw new ToolError(`Skill tree not saved: ${error instanceof Error ? error.message : String(error)}`, { code: "invalid-args" }); }
    draft.growth = growth;
    const issues = growthIssues(draft);
    return { summary: `Skill trees: ${what}. Trees now: ${growth.skillTrees.map((t) => t.id).join(", ") || "none"}.`, data: { trees: growth.skillTrees.map((t) => ({ id: t.id, nodes: t.nodes.length })) }, ...(issues.length ? { warnings: issues.slice(0, 8) } : {}) };
  },
};

export const DB_BULK_TOOLS: readonly ToolDefinition[] = [bulkEditDatabase, reorderDatabaseRecords, setDifficulties, setMonsterFusions, setGameOverLibrary, setPlaySettings, upsertSkillTree];
