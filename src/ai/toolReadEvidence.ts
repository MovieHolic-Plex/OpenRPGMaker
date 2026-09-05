import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import type { IntentDeclaration } from "./intentDeclaration";

type ReadContract = NonNullable<IntentDeclaration["readBeforeWrite"]>;
const RECORD_COLLECTIONS: Readonly<Record<string, string>> = {
  item: "items", enemy: "enemies", troop: "troops", actor: "actors", skill: "skills", equipment: "equipment",
};
const REFERENCE_COLLECTIONS: Readonly<Record<string, string>> = {
  itemId: "items", itemIds: "items", enemyId: "enemies", enemyIds: "enemies", troopId: "troops", troopIds: "troops",
  actorId: "actors", actorIds: "actors", partyActorIds: "actors", startActorIds: "actors", skillId: "skills", skillIds: "skills",
  equipmentId: "equipment", equipmentIds: "equipment",
};
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function fingerprint(value: unknown): string {
  const stable = (v: unknown): unknown => Array.isArray(v) ? v.map(stable) : record(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v;
  return JSON.stringify(stable(value));
}

/** Model-visible successful reads, scoped to one user request (including driver continuations).
 * Context summaries and successful writes are deliberately not lookup evidence.
 */
export class ToolReadEvidence {
  private contract: ReadContract | undefined;
  private summaryRead = false;
  private maps = new Set<string>();
  private events = new Set<string>();
  private collections = new Set<string>();
  private ids = new Map<string, Set<string>>();
  private fullRecords = new Map<string, string>();

  begin(contract: ReadContract | undefined): void {
    this.contract = contract;
    this.summaryRead = false;
    this.maps.clear();
    this.events.clear();
    this.collections.clear();
    this.ids.clear();
    this.fullRecords.clear();
  }

  requiredReadTools(): readonly string[] {
    if (!this.contract) return [];
    return [
      ...(this.contract.project ? ["get_project_summary", "get_map_region", "find_events"] : []),
      ...(this.contract.references || this.contract.collections.length ? ["get_database_records"] : []),
    ];
  }

  observe(name: string, args: Record<string, unknown>, result: ToolResult): void {
    if (!result.ok) return;
    if (name === "get_project_summary") this.summaryRead = true;
    if (name === "get_map_region" && typeof args.mapId === "string") this.maps.add(args.mapId);
    if ((name === "find_events" || name === "get_event") && typeof args.mapId === "string") this.events.add(args.mapId);
    if (name === "find_events" && args.mapId === undefined) this.events.add("*");
    if (name !== "get_database_records" || typeof args.collection !== "string") return;
    const data = record(result.data);
    if (!Array.isArray(data?.records)) return;
    const collection = args.collection;
    this.collections.add(collection);
    const seen = this.ids.get(collection) ?? new Set<string>();
    for (const value of data.records) {
      const entry = record(value);
      if (typeof entry?.id !== "string") continue;
      seen.add(entry.id);
      if (args.include === "full") this.fullRecords.set(`${collection}:${entry.id}`, fingerprint(entry));
    }
    this.ids.set(collection, seen);
  }

  beforeWrite(project: Project, name: string, args: Record<string, unknown>): ToolResult | null {
    const contract = this.contract;
    if (!contract) return null;
    const missing: string[] = [];
    if (contract.project) {
      if (!this.summaryRead) missing.push("get_project_summary");
      if (Object.keys(project.maps).length > 0 && this.maps.size === 0) missing.push("get_map_region (기존 맵)");
      if (Object.keys(project.maps).length > 0 && this.events.size === 0) missing.push("find_events (기존 이벤트)");
    }
    for (const collection of contract.collections) {
      if (!this.collections.has(collection)) missing.push(`get_database_records(collection:"${collection}")`);
    }
    const requireId = (collection: string, id: unknown): void => {
      if (typeof id === "string" && id && !this.ids.get(collection)?.has(id)) {
        missing.push(`get_database_records(collection:"${collection}", ids:["${id}"])`);
      }
    };
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const object = record(value);
      if (!object) return;
      for (const [key, child] of Object.entries(object)) {
        if (contract.project && key === "mapId" && typeof child === "string" && project.maps[child]) {
          if (!this.maps.has(child)) missing.push(`get_map_region(mapId:"${child}")`);
          if (!this.events.has(child) && !this.events.has("*")) missing.push(`find_events(mapId:"${child}")`);
        }
        if (contract.references && key === "inventory" && record(child)) {
          for (const id of Object.keys(child as Record<string, unknown>)) requireId("items", id);
        }
        const collection = REFERENCE_COLLECTIONS[key];
        if (contract.references && collection) {
          for (const id of Array.isArray(child) ? child : [child]) requireId(collection, id);
        }
        visit(child);
      }
    };
    visit(args);
    for (const [key, collection] of Object.entries(RECORD_COLLECTIONS)) {
      if (name !== `upsert_${key}`) continue;
      const patch = record(args[key]);
      const entries = (project.database as unknown as Record<string, unknown>)[collection];
      const existing = Array.isArray(entries) ? entries.find((value) => record(value)?.id === patch?.id) : undefined;
      if (existing && this.fullRecords.get(`${collection}:${patch?.id}`) !== fingerprint(existing)) {
        missing.push(`get_database_records(collection:"${collection}", ids:["${patch?.id}"], include:"full") (현재 값)`);
      }
    }
    if (missing.length === 0) return null;
    const summary = `조회 선행 조건 미충족: ${[...new Set(missing)].join("; ")}`
      + ". 조회를 성공시키고 반환된 값으로 다시 호출하세요. 프로젝트는 변경하지 않았습니다.";
    return { ok: false, summary, issues: [{ severity: "error", code: "read-before-write-required", message: summary }] };
  }
}
