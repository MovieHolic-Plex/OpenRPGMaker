import { APPLY_SMALL_TASK_PRIMITIVE, LIST_SMALL_TASK_PRIMITIVES } from "@/editor/tools/smallTaskPrimitiveTools";
import { DB_UPSERT_TOOLS } from "@/editor/tools/dbUpsertEnvelope";
import type { SmallTaskTarget } from "./target";

const primitiveTools = [LIST_SMALL_TASK_PRIMITIVES, APPLY_SMALL_TASK_PRIMITIVE];
const eventTools = ["get_event", "get_map_region", "patch_event_page", "event_command_assist"];
export function smallTaskTools(target: SmallTaskTarget): string[] {
  if (target.kind === "dbEntry") return [...primitiveTools, "get_database_records",
    ...Object.keys(DB_UPSERT_TOOLS).filter(name => DB_UPSERT_TOOLS[name].collection === target.collection)];
  const common = [...primitiveTools, ...eventTools, "get_database_records", "list_resources"];
  if (target.kind === "event") return target.pageId ? common : [...common, "upsert_event", "move_event"];
  return [...common, "find_events", "place_npc", "upsert_event", "move_event", "paint_tiles", "set_map_properties"];
}

export const SMALL_TASK_SCOPE_REFUSAL = "선택한 대상만 고칠 수 있어요.";
export function smallTaskRefusal(target: SmallTaskTarget, name: string, args: Record<string, unknown>): string | null {
  if (!smallTaskTools(target).includes(name)) return SMALL_TASK_SCOPE_REFUSAL;
  if (args.mapId !== undefined && (target.kind === "dbEntry" || args.mapId !== target.mapId)) return SMALL_TASK_SCOPE_REFUSAL;
  if (target.kind === "dbEntry") {
    if (args.eventId !== undefined) return SMALL_TASK_SCOPE_REFUSAL;
    const write = DB_UPSERT_TOOLS[name];
    if (!write) return null;
    const record = args[write.arg] as { id?: unknown } | undefined;
    return record?.id === target.id && (args.collection === undefined || args.collection === target.collection)
      && (args.id === undefined || args.id === target.id) ? null : SMALL_TASK_SCOPE_REFUSAL;
  }
  if (target.kind === "event") {
    if (args.eventId !== undefined && args.eventId !== target.eventId) return SMALL_TASK_SCOPE_REFUSAL;
    if (name === "upsert_event" && (args.event as { id?: unknown } | undefined)?.id !== target.eventId) return SMALL_TASK_SCOPE_REFUSAL;
    if (target.pageId && (name === "patch_event_page" || name === "event_command_assist") && args.pageId !== target.pageId) return SMALL_TASK_SCOPE_REFUSAL;
  }
  return null;
}
