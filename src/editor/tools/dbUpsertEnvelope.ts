// 자료집 upsert 도구(upsert_actor·class·skill·item·equipment·enemy·troop·state)를 감싸는 한 층 — 실행기(toolRunner)가 조수 호출에서 부른다.
// 왜(2026-11-16 db-review A F3 · B #5 #7 #11):
//  - 목록은 통째로 바뀐다(mergeRecordPatch). «직업에 스킬 하나 더» 를 그 하나만 담아 보내면 배움표 11개가 1개가 됐고 결과는 «수정» 한 줄이었다.
//    → listOps{add, remove} 로 목록 항목 하나를 더하고 뺀다. 목록이 줄면 결과 글이 «learnedSkills 11 → 1» 로 말한다.
//  - 레코드에 없는 칸(직업·상태의 description)은 호출 전체를 거절했다. 적·배우는 같은 칸을 조용히 버렸다 — 같은 입력에 두 동작.
//    → 모르는 칸은 빼고 나머지를 저장한 뒤 알린다(모든 레코드 종류가 같다). 게임은 깨지지 않으므로 거절하지 않는다.
//  - upsert 는 «만들거나 덮어쓴다». 예시 id(skill_fire 등)가 살아 있는 기본 레코드라 이름 하나 바꾸는 호출이 적 셋이 쓰는 기술을 고쳤고,
//    오타 id 는 조용히 새 레코드가 됐다. → 결과 글이 «새로 만들었다» / «기존 X(N곳이 씀)를 고쳤다» 를 가르고, 새 id 가 기존 id 와 가까우면 이름을 댄다.
import type { Project } from "@/project/types";
import type { JsonSchema } from "./types";
import { ToolError } from "./types";
import { referenceIndex, outsideRecord } from "./dbReferenceIndex";
import { nearestIds } from "./dbRecordDelete";
import { REPLACE_WHOLE } from "./mergeRecordPatch";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** 도구 이름 → (인자 칸, 자료집 묶음). 이 표의 도구만 감싼다. */
export const DB_UPSERT_TOOLS: Readonly<Record<string, { readonly arg: string; readonly collection: string }>> = {
  upsert_actor: { arg: "actor", collection: "actors" },
  upsert_class: { arg: "class", collection: "classes" },
  upsert_skill: { arg: "skill", collection: "skills" },
  upsert_item: { arg: "item", collection: "items" },
  upsert_equipment: { arg: "equipment", collection: "equipment" },
  upsert_enemy: { arg: "enemy", collection: "enemies" },
  upsert_troop: { arg: "troop", collection: "troops" },
  upsert_state: { arg: "state", collection: "states" },
};

/** 모든 자료집 upsert 에 붙는 목록 고치기 칸 — 스키마에 더한다. */
export const LIST_OPS_SCHEMA: JsonSchema = {
  type: "object",
  description: "Add or remove single entries of a list field; the other entries stay. add:{field:[entries…]} · remove:{field:[entries or their ids…]}. Example: {add:{learnedSkills:[{level:5, skillId:\"skill_x\"}]}, remove:{skillIds:[\"skill_y\"]}}",
  properties: {
    add: { type: "object", additionalProperties: true },
    remove: { type: "object", additionalProperties: true },
  },
  additionalProperties: false,
};

const itemKey = (entry: unknown): string => {
  if (!isObj(entry)) return JSON.stringify(entry);
  for (const k of ["skillId", "enemyId", "itemId", "stateId", "elementId", "id", "commandId", "classId", "actorId"]) if (typeof entry[k] === "string") return `${k}:${entry[k]}`;
  return JSON.stringify(entry);
};
/** 뺄 항목이 목록 항목과 맞나 — 같은 값, 같은 뜻 열쇠(skillId 등), 또는 그 id 문자열. */
const matches = (entry: unknown, want: unknown): boolean => {
  if (JSON.stringify(entry) === JSON.stringify(want)) return true;
  if (typeof want === "string") return isObj(entry) ? Object.entries(entry).some(([k, v]) => /Id$|^id$/u.test(k) && v === want) : entry === want;
  return isObj(want) && isObj(entry) && itemKey(want) === itemKey(entry) && Object.entries(want).every(([k, v]) => JSON.stringify(entry[k]) === JSON.stringify(v));
};

export interface EnvelopeIn { readonly args: Obj; readonly notes: string[]; readonly existing?: Obj; readonly id?: string; readonly collection: string; readonly arg: string }

/**
 * 실행 전: 모르는 칸을 빼고(알림), listOps 를 기존 목록 위에서 풀어 그 칸의 전체 목록으로 바꾼다. 거절은 listOps 가 목록이 아닌 칸을 가리킬 때뿐.
 * schema = 도구의 레코드 칸 스키마(properties).
 */
export function beforeDbUpsert(project: Project, tool: string, rawArgs: Obj, recordSchema: JsonSchema | undefined): EnvelopeIn | undefined {
  const spec = DB_UPSERT_TOOLS[tool];
  if (!spec) return undefined;
  const notes: string[] = [];
  const args: Obj = { ...rawArgs };
  const patch: Obj = isObj(args[spec.arg]) ? { ...(args[spec.arg] as Obj) } : {};
  const list = ((project.database as unknown as Obj)[spec.collection] ?? []) as Obj[];
  const id = typeof patch.id === "string" ? patch.id : undefined;
  const existing = id ? list.find((r) => r.id === id) : undefined;
  const known = new Set(Object.keys(recordSchema?.properties ?? {}));
  // 모르는 칸 — 직업·상태의 description 처럼 레코드 종류에 없는 칸. 빼고 알린다(전에는 호출 전체가 거절됐다).
  if (known.size) {
    const unknown = Object.keys(patch).filter((k) => !known.has(k));
    if (unknown.length) {
      for (const k of unknown) delete patch[k];
      notes.push(`NOT SAVED — ${spec.collection} records have no field ${unknown.map((k) => `«${k}»`).join(", ")} (the editor shows none for this kind); the other fields were saved.`);
    }
  }
  const ops = isObj(args.listOps) ? (args.listOps as Obj) : undefined;
  delete args.listOps;
  if (ops) {
    for (const [mode, fields] of Object.entries(ops)) {
      if (!isObj(fields)) continue;
      for (const [field, entries] of Object.entries(fields)) {
        const props = recordSchema?.properties?.[field];
        if (!props || (props.type !== "array" && props.type !== "object")) throw new ToolError(`listOps.${mode}.${field}: ${spec.collection} has no list field «${field}». List fields: ${[...known].filter((k) => recordSchema?.properties?.[k]?.type === "array").join(", ")}.`, { code: "invalid-args" });
        const want = Array.isArray(entries) ? entries : [entries];
        if (props.type === "object") {
          // 사전 칸(stateRates·elementRates·initialEquipment): add 는 {열쇠:값} 병합, remove 는 열쇠 목록.
          const base: Obj = { ...((isObj(patch[field]) ? patch[field] : existing?.[field]) as Obj ?? {}) };
          if (mode === "add") for (const e of want) if (isObj(e)) Object.assign(base, e);
          if (mode === "remove") { for (const e of want) delete base[String(e)]; base[REPLACE_WHOLE] = true; }
          patch[field] = base;
          continue;
        }
        const base = [...((Array.isArray(patch[field]) ? patch[field] : existing?.[field]) as unknown[] ?? [])];
        if (mode === "add") for (const e of want) { const at = base.findIndex((x) => itemKey(x) === itemKey(e) && itemKey(e) !== JSON.stringify(e)); if (at >= 0) base[at] = e; else base.push(e); }
        if (mode === "remove") {
          const missing = want.filter((w) => !base.some((x) => matches(x, w)));
          if (missing.length) notes.push(`listOps.remove.${field}: ${missing.map((m) => JSON.stringify(m)).join(", ")} was not in the list.`);
          for (const w of want) { const at = base.findIndex((x) => matches(x, w)); if (at >= 0) base.splice(at, 1); }
        }
        patch[field] = base;
      }
    }
  }
  args[spec.arg] = patch;
  return { args, notes, ...(existing ? { existing } : {}), ...(id ? { id } : {}), collection: spec.collection, arg: spec.arg };
}

/** 실행 뒤: 새로 만들었나·고쳤나, 줄어든 목록, 그 레코드를 쓰는 곳 수, 가까운 기존 id. 결과 요약 앞에 붙일 영어 한 줄과 경고 줄. */
export function afterDbUpsert(before: Project, after: Project, env: EnvelopeIn): { head: string; warnings: string[] } {
  const listAfter = ((after.database as unknown as Obj)[env.collection] ?? []) as Obj[];
  const listBefore = ((before.database as unknown as Obj)[env.collection] ?? []) as Obj[];
  const id = env.id ?? (listAfter.length > listBefore.length ? String(listAfter[listAfter.length - 1]?.id ?? "") : "");
  const now = listAfter.find((r) => r.id === id);
  const warnings = [...env.notes];
  if (!env.existing) {
    const near = id ? nearestIds(listBefore as { id: string; name?: string }[], id) : "";
    return { head: `Created new ${env.collection} record ${id}${now?.name ? ` «${String(now.name)}»` : ""}.`, warnings: [...warnings, ...(near ? [`${id} is a new id.${near} If you meant one of those, the change went to a new record instead — fix it with that id and delete ${id}.`] : [])] };
  }
  const shrunk: string[] = [];
  for (const [k, v] of Object.entries(env.existing)) {
    const after2 = now?.[k];
    if (Array.isArray(v) && Array.isArray(after2) && after2.length < v.length) shrunk.push(`${k} ${v.length} → ${after2.length}`);
  }
  const index = id ? outsideRecord(referenceIndex(after, new Set([id])).get(id) ?? [], ["database", env.collection, listAfter.findIndex((r) => r.id === id)]) : [];
  const users = new Set(index.map((s) => s.path.slice(0, 3).join("."))).size;
  const head = `Modified existing ${env.collection} record ${id}${now?.name ? ` «${String(now.name)}»` : ""}${users ? ` (used by ${users} other record/place${users > 1 ? "s" : ""} — the change applies there too)` : ""}.`;
  if (shrunk.length) warnings.push(`LIST SHRANK — ${shrunk.join(", ")}. A sent list replaces the whole stored list. If you meant to add or remove one entry, call again with listOps:{add:{field:[…]}} or listOps:{remove:{field:[…]}} and the full list you meant to keep.`);
  return { head, warnings };
}
