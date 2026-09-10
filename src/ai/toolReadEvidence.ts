import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import type { IntentDeclaration } from "./intentDeclaration";
import type { ChatMessage } from "./llmClient";
import { MonsterAppearanceEvidence, MONSTER_READ_TOOLS } from "./monsterAppearanceEvidence";

type ReadContract = NonNullable<IntentDeclaration["readBeforeWrite"]>;
type PendingRead = {
  readonly toolCallId: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly result: ToolResult;
};
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
  private readonly monsterAppearances = new MonsterAppearanceEvidence();
  private contract: ReadContract | undefined;
  private summaryRead = false;
  private maps = new Set<string>();
  private events = new Set<string>();
  private collections = new Set<string>();
  private ids = new Map<string, Set<string>>();
  private fullRecords = new Map<string, string>();
  private pending = new Map<string, PendingRead>();

  begin(contract: ReadContract | undefined): void {
    this.contract = contract;
    this.monsterAppearances.clear();
    this.summaryRead = false;
    this.maps.clear();
    this.events.clear();
    this.collections.clear();
    this.ids.clear();
    this.fullRecords.clear();
    this.pending.clear();
  }

  /** Execution is not delivery. Capture exact data before later draft edits can change it. */
  queue(read: PendingRead): void {
    if (MONSTER_READ_TOOLS.some(tool => tool === read.name)) {
      this.monsterAppearances.executed(read.toolCallId, read.result);
      return;
    }
    if (!read.result.ok || !["get_project_summary", "get_map_region", "find_events", "get_event", "get_database_records"].includes(read.name)) return;
    this.pending.set(read.toolCallId, structuredClone(read));
  }

  /** Only call for the actual writer request after it returns, before executing its response. */
  observeDelivered(messages: readonly ChatMessage[]): void {
    this.monsterAppearances.observeRequest(messages);
    for (const message of messages) {
      if (message.role !== "tool" || message.tool_call_id === undefined || typeof message.content !== "string") continue;
      const read = this.pending.get(message.tool_call_id);
      if (!read || message.name !== read.name) continue;
      let delivered: unknown;
      try {
        delivered = JSON.parse(message.content);
      } catch {
        // Truncated/rewritten history is not a receipt; leave the read uncredited.
        continue;
      }
      const result = record(delivered);
      if (result?.ok !== true || result.summary !== read.result.summary
        || fingerprint(result.data) !== fingerprint(read.result.data)) continue;
      this.observe(read.name, read.args, read.result);
      this.pending.delete(message.tool_call_id);
    }
  }

  requiredReadTools(): readonly string[] {
    if (!this.contract) return MONSTER_READ_TOOLS;
    return [
      ...MONSTER_READ_TOOLS,
      ...(this.contract.project ? ["get_project_summary", "get_map_region", "find_events"] : []),
      ...(this.contract.references || this.contract.collections.length ? ["get_database_records"] : []),
    ];
  }

  observe(name: string, args: Record<string, unknown>, result: ToolResult): void {
    this.monsterAppearances.observe(name, args, result);
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
    const appearance = this.monsterAppearances.beforeWrite(project, name, args);
    if (appearance) return appearance;
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
    // 순서 규칙을 반드시 실어 보낸다. 읽기 크레딧은 **모델에게 전달된 뒤**에만 적립되므로
    // (observeDelivered), 조회와 쓰기를 한 응답에 함께 담으면 조회가 성공해도 이 게이트는 100%
    // 실패한다. 이 문장이 없던 동안 모델은 같은 조회를 반복 성공시키며 같은 실패를 반복했다.
    const summary = `조회 선행 조건 미충족: ${[...new Set(missing)].join("; ")}`
      + ". 조회를 성공시키고 **다음 응답에서** 반환된 값으로 다시 호출하세요"
      + " — 조회와 쓰기를 같은 응답에 함께 담으면 조회 결과가 아직 전달되지 않아 반드시 실패합니다."
      + " 프로젝트는 변경하지 않았습니다.";
    return { ok: false, summary, issues: [{ severity: "error", code: "read-before-write-required", message: summary }] };
  }
}
