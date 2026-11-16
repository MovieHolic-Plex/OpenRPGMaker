// 자료집 레코드 지우기 · 복제 · 안 쓰는 레코드 찾기 — 조수 v2 가 부르는 도구의 몸통(모델이 읽는 글은 영어).
// 왜(2026-11-16 자료집 적대 리뷰 A F1 · F4 · B #1): 조수는 레코드를 지울 수 없었다(도구가 v2 풀 밖). 도구가 있어도 참조가 하나라도 있으면
// 첫 참조 한 줄로 거절해서 «외 9건» 을 찾아 끊을 길이 없었다. 오너 규칙은 «게임이 깨질 때만 거절» — 직업 배움표에 남은 지운 스킬은 게임을 깨므로
// 그냥 지우지 않고, 한 번에 끝내는 길을 준다: clearReferences:true 면 목록·사전·선택 칸의 참조를 함께 걷고 하나씩 보고한다.
// 걷을 수 없는 참조(배우의 직업 같은 필수 칸, 이벤트 명령·조건 안의 참조)는 경로째 적어 거절한다 — 지우면 이야기 흐름이 바뀌기 때문이다.
import type { Project } from "@/project/types";
import { ToolError } from "./types";
import { describeSite, isScriptSite, outsideRecord, referenceIndex, type RefSite } from "./dbReferenceIndex";
import { retroChoreographyIdForClone } from "@/assets/retroSkillCatalog";

/** 조수가 지우고 복제할 수 있는 자료집 묶음 — database 의 레코드 배열 전부와 공용 이벤트. */
export const DELETABLE_DB_COLLECTIONS = [
  "actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states", "battleAnimations",
  "elements", "terrains", "battleCommands", "equipmentSlots", "monsterSpecies", "crops", "lifeSkills",
  "farmAnimalSpecies", "fishSpecies", "farmBuildingTypes", "homeDecorationTypes", "schedules", "characterAppearances",
  "retroChoreographies", "commonEvents",
] as const;
export type DeletableCollection = (typeof DELETABLE_DB_COLLECTIONS)[number];

/** 엔진이 id 로 직접 찾는 레코드 — 지우면 전투·쓰러짐이 깨진다. */
const ENGINE_RECORDS: Readonly<Record<string, string>> = {
  state_death: "the engine applies state_death when a battler falls",
  skill_attack: "the engine uses skill_attack as the basic attack command",
};

type Row = { id: string; name?: string };

export function collectionRows(project: Project, collection: string): Row[] | undefined {
  if (collection === "commonEvents") return project.commonEvents as unknown as Row[];
  const list = (project.database as unknown as Record<string, unknown>)[collection];
  return Array.isArray(list) ? (list as Row[]) : undefined;
}
function ensureRows(project: Project, collection: string): Row[] {
  if (collection === "commonEvents") return project.commonEvents as unknown as Row[];
  const db = project.database as unknown as Record<string, unknown>;
  if (!Array.isArray(db[collection])) db[collection] = [];
  return db[collection] as Row[];
}
const rootOf = (collection: string): (string | number)[] => (collection === "commonEvents" ? ["commonEvents"] : ["database", collection]);

export function parseDeletableCollection(value: unknown): DeletableCollection {
  if ((DELETABLE_DB_COLLECTIONS as readonly string[]).includes(String(value))) return value as DeletableCollection;
  throw new ToolError(`Unknown collection ${JSON.stringify(value)}. Use one of: ${DELETABLE_DB_COLLECTIONS.join(", ")}.`, { code: "invalid-args" });
}

/** 레코드 찾기 — id, 없으면 이름(하나뿐일 때), 없으면 «3번»(UI 의 1부터 세는 자리). 못 찾으면 가까운 것을 적어 거절. */
export function findRow(rows: readonly Row[], collection: string, ref: unknown): { index: number; row: Row; how?: string } {
  const key = String(ref ?? "").trim();
  const byId = rows.findIndex((r) => r.id === key);
  if (byId >= 0) return { index: byId, row: rows[byId]! };
  const named = rows.flatMap((r, i) => (r.name === key ? [i] : []));
  if (named.length === 1) return { index: named[0]!, row: rows[named[0]!]!, how: `«${key}» is a name — its id is ${rows[named[0]!]!.id}` };
  if (named.length > 1) throw new ToolError(`${named.length} ${collection} records are named «${key}»: ${named.slice(0, 6).map((i) => `${rows[i]!.id} (#${i + 1})`).join(", ")}. Pass the id.`, { code: "database-record-ambiguous" });
  const no = /^#?0*(\d+)$/u.exec(key);
  if (no) { const i = Number(no[1]) - 1; if (rows[i]) return { index: i, row: rows[i]!, how: `#${i + 1} in the list is ${rows[i]!.id} «${rows[i]!.name ?? ""}»` }; }
  throw new ToolError(`No ${collection} record "${key}".${nearestIds(rows, key)} Read ids with get_database_records{collection:"${collection}", query:"…"}.`, { code: "database-record-not-found" });
}

/** 가까운 id 두셋(같은 낱말 조각·접두) — 오타 알림. */
export function nearestIds(rows: readonly Row[], key: string): string {
  const parts = key.toLowerCase().split(/[_\s-]+/u).filter((p) => p.length >= 3);
  const scored = rows.map((r) => ({ r, s: parts.filter((p) => r.id.toLowerCase().includes(p) || (r.name ?? "").toLowerCase().includes(p)).length + (r.id.toLowerCase().startsWith(key.toLowerCase().slice(0, 6)) ? 0.5 : 0) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
  return scored.length ? ` Nearest: ${scored.map((x) => `${x.r.id} «${x.r.name ?? ""}»`).join(", ")}.` : "";
}

const getAt = (root: unknown, path: readonly (string | number)[]): unknown => path.reduce<unknown>((cur, part) => (cur as Record<string | number, unknown> | undefined)?.[part], root);

interface Plan { readonly site: RefSite; readonly how: "remove-entry" | "remove-key" | "unset"; readonly holder: (string | number)[]; readonly key: string | number }

/**
 * 참조 하나를 걷는 법 — 목록이면 그 항목(객체 항목이면 항목째), 사전 열쇠면 열쇠, 선택 칸이면 그 칸.
 * 필수 칸(배우의 직업 등)·이벤트 명령 안은 걷지 않는다(undefined).
 */
function planClear(project: Project, site: RefSite): Plan | undefined {
  if (isScriptSite(site)) return undefined;
  const p = site.path;
  if (site.asKey) return { site, how: "remove-key", holder: p.slice(0, -1) as (string | number)[], key: p[p.length - 1]! };
  // 목록 안의 문자열 값: [..., list, i]
  const last = p[p.length - 1]!;
  if (typeof last === "number") return { site, how: "remove-entry", holder: p.slice(0, -1) as (string | number)[], key: last };
  // 목록 안 객체의 칸: [..., list, i, field] — 그 칸이 항목의 뜻(skillId·enemyId·itemId·stateId)이면 항목째 뺀다.
  // 자료집 묶음 자체(database.<묶음>[i] · commonEvents[i])는 레코드 목록이다 — 그 칸을 이유로 레코드를 통째로 빼지 않는다.
  const parent = p[p.length - 2];
  const listPath = p.slice(0, -2);
  const recordList = (listPath.length === 2 && listPath[0] === "database") || (listPath.length === 1 && listPath[0] === "commonEvents");
  if (typeof parent === "number" && !recordList && Array.isArray(getAt(project, listPath))) return { site, how: "remove-entry", holder: p.slice(0, -2) as (string | number)[], key: parent };
  // 객체의 칸: 배우의 직업(classId)·적 그룹의 적 같은 뼈대는 빼면 레코드가 깨진다.
  if (last === "classId" || last === "enemyId" || last === "id") return undefined;
  return { site, how: "unset", holder: p.slice(0, -1) as (string | number)[], key: last };
}

function applyClears(project: Project, plans: readonly Plan[]): void {
  // 같은 목록에서 뒤 항목부터 빼야 앞 자리가 밀리지 않는다.
  const sorted = [...plans].sort((a, b) => (typeof b.key === "number" && typeof a.key === "number" ? b.key - a.key : 0));
  const done = new Set<string>();
  for (const plan of sorted) {
    const id = `${plan.holder.join(".")}#${String(plan.key)}`;
    if (done.has(id)) continue;
    done.add(id);
    const holder = getAt(project, plan.holder);
    if (plan.how === "remove-entry" && Array.isArray(holder) && typeof plan.key === "number") holder.splice(plan.key, 1);
    else if (holder && typeof holder === "object") delete (holder as Record<string | number, unknown>)[plan.key];
  }
}

export interface DeleteOutcome { readonly summary: string; readonly warnings: string[]; readonly data: Record<string, unknown> }

/** 레코드 하나를 지운다. clear=true 면 걷을 수 있는 참조를 함께 걷는다. 거절 글은 모든 참조와 그것을 걷는 한 번의 호출을 적는다. */
export function deleteDatabaseRecord(project: Project, collectionArg: unknown, ref: unknown, clear: boolean): DeleteOutcome {
  const collection = parseDeletableCollection(collectionArg);
  const rows = collectionRows(project, collection) ?? [];
  const { index, row, how } = findRow(rows, collection, ref);
  const engine = ENGINE_RECORDS[row.id];
  if (engine) throw new ToolError(`${row.id} cannot be deleted: ${engine}. Rename or edit it instead.`, { code: "database-record-required" });
  const sites = outsideRecord(referenceIndex(project, new Set([row.id])).get(row.id) ?? [], [...rootOf(collection), index]);
  const plans = sites.map((site) => ({ site, plan: planClear(project, site) }));
  const blocked = plans.filter((x) => !x.plan);
  const clearable = plans.filter((x): x is { site: RefSite; plan: Plan } => !!x.plan);
  const label = `${collection} ${row.id}${row.name ? ` «${row.name}»` : ""}`;
  const list = (xs: readonly { site: RefSite }[], n = 12) => `${xs.slice(0, n).map((x) => `- ${describeSite(project, x.site)}`).join("\n")}${xs.length > n ? `\n- … +${xs.length - n} more` : ""}`;
  if (blocked.length) {
    throw new ToolError(
      `Not deleted: ${label} is used in ${sites.length} place(s); ${blocked.length} cannot be cleared automatically (a required field, or an event command/condition — removing it would change the story):\n${list(blocked)}\n`
      + `Change those first (point them at another record), then call delete_database_record again${clearable.length ? ` with clearReferences:true (it also removes the other ${clearable.length} list/optional reference(s))` : ""}.`,
      { code: "database-record-in-use" },
    );
  }
  if (clearable.length && !clear) {
    throw new ToolError(
      `Not deleted: ${label} is still used in ${clearable.length} place(s):\n${list(clearable)}\n`
      + `Deleting it would leave those pointing at nothing. To delete it and remove these references in one step call delete_database_record{collection:"${collection}", id:"${row.id}", clearReferences:true} — the result lists each one removed. Or point them at another record first.`,
      { code: "database-record-in-use" },
    );
  }
  // 글은 걷기 전에 만든다 — 걷은 뒤에는 목록 자리가 밀려 다른 레코드 이름이 나온다.
  const removed = clearable.map((x) => describeSite(project, x.site));
  applyClears(project, clearable.map((x) => x.plan));
  const now = ensureRows(project, collection);
  const at = now.findIndex((r) => r.id === row.id);
  if (at >= 0) now.splice(at, 1);
  // 적 그룹에 적이 하나도 안 남으면 그 전투는 열리지 않는다 — 게임이 깨지는 경우라 거절한다(초안은 버려진다).
  const emptied = project.database.troops.filter((t) => (t.members?.length ?? 0) === 0 && t.enemyIds.length === 0);
  if (emptied.length) throw new ToolError(`Not deleted: removing ${label} would leave troop(s) ${emptied.map((t) => `${t.id} «${t.name}»`).join(", ")} with no enemies, and that battle could not start. Give those troops another enemy with upsert_troop (or delete the troops) first.`, { code: "database-record-in-use" });
  return {
    summary: `Deleted ${label}${clearable.length ? ` and removed ${clearable.length} reference(s) to it` : ""}.`,
    warnings: [...(how ? [how] : []), ...(removed.length ? [`Removed references: ${removed.slice(0, 20).join(" · ")}${removed.length > 20 ? ` · +${removed.length - 20} more` : ""}`] : [])],
    data: { collection, id: row.id, removedReferences: removed },
  };
}

/** 레코드 하나를 복제한다(새 id 를 주지 않으면 빈 id 를 만든다). */
export function duplicateDatabaseRecord(project: Project, collectionArg: unknown, ref: unknown, newIdArg: unknown, name: unknown): DeleteOutcome {
  const collection = parseDeletableCollection(collectionArg);
  const rows = ensureRows(project, collection);
  const { row, how } = findRow(rows, collection, ref);
  let newId = typeof newIdArg === "string" && newIdArg.trim() ? newIdArg.trim() : "";
  if (newId && rows.some((r) => r.id === newId)) throw new ToolError(`${newId} already exists in ${collection}. Pick a new id (or omit newId for a free one).`, { code: "database-record-exists" });
  if (!newId) { let n = 2; while (rows.some((r) => r.id === `${row.id}_${n}`)) n += 1; newId = `${row.id}_${n}`; }
  const copy = structuredClone(row) as Row;
  copy.id = newId;
  // 기본 직업·몬스터 계약으로 연출을 고르던 스킬은 새 id 로 그 계약을 잃는다 — 빌려 쓰던 연출 id 를 적어 둔다.
  if (collection === "skills") { const borrowed = retroChoreographyIdForClone(row as never); if (borrowed) (copy as { retroChoreographyId?: string }).retroChoreographyId = borrowed; }
  if ("name" in row) copy.name = typeof name === "string" && name.trim() ? name.trim() : `${row.name ?? row.id} copy`;
  rows.push(copy);
  return { summary: `Duplicated ${collection} ${row.id} as ${newId}${copy.name ? ` «${copy.name}»` : ""} (#${rows.length} in the list).`, warnings: how ? [how] : [], data: { collection, record: copy } };
}

/** 어디에서도 가리키지 않는 레코드(자기 자리 밖 참조 0) — 묶음마다. 엔진이 쓰는 레코드·시작 파티는 뺀다. */
export function unusedRecords(project: Project, collections: readonly DeletableCollection[]): Map<DeletableCollection, Row[]> {
  // 시작 파티·지금 파티의 배우는 프로젝트가 id 로 들고 있다(색인이 본다). 여기서는 색인만 믿는다.
  const ids = new Set<string>();
  for (const c of collections) for (const r of collectionRows(project, c) ?? []) ids.add(r.id);
  const index = referenceIndex(project, ids);
  const out = new Map<DeletableCollection, Row[]>();
  for (const c of collections) {
    const rows = collectionRows(project, c) ?? [];
    out.set(c, rows.filter((r, i) => !ENGINE_RECORDS[r.id] && outsideRecord(index.get(r.id) ?? [], [...rootOf(c), i]).length === 0));
  }
  return out;
}
