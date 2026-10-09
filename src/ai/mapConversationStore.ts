import type { AuditEntry } from "@/ai/assistantSession";

export interface ConversationMapIndex {
  readonly viewedMapIds: readonly string[];
  readonly targetMapIds: readonly string[];
  readonly mapAttribution: "complete" | "partial" | "unknown";
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === "string" && id.trim().length > 0);

export function isConversationMapIndex(value: unknown): value is ConversationMapIndex {
  return isObject(value) && isIds(value.viewedMapIds) && isIds(value.targetMapIds)
    && ["complete", "partial", "unknown"].includes(String(value.mapAttribution));
}

/** Only structured context and known proposal endpoint fields; never names, prose or arbitrary recursion. */
export function indexConversationMaps(entries: readonly AuditEntry[], previous?: ConversationMapIndex): ConversationMapIndex {
  const viewed = new Set(previous?.viewedMapIds);
  const targets = new Set(previous?.targetMapIds);
  let partial = previous?.mapAttribution === "partial";
  const add = (set: Set<string>, value: unknown) => {
    if (typeof value === "string" && value.trim()) set.add(value);
  };
  const target = (args: Record<string, unknown>) => {
    if (args._truncated || args._unserializable) partial = true;
    for (const endpoint of [args, args.a, args.b]) {
      if (!isObject(endpoint)) continue;
      add(targets, endpoint.mapId);
      add(targets, endpoint.toMapId);
    }
  };
  for (const entry of entries) {
    switch (entry.kind) {
      case "user":
        if (!entry.context) partial = true;
        else add(viewed, entry.context.mapId);
        break;
      case "tool": target(entry.args); break;
      case "assistant":
        for (const call of entry.toolCalls ?? []) {
          try {
            const args: unknown = JSON.parse(call.args);
            if (isObject(args)) target(args);
            else partial = true;
          } catch { partial = true; } // Truncated legacy arguments are evidence of missing provenance.
        }
        break;
      case "status":
        if (entry.text.startsWith("[conversation-trimmed]")) partial = true;
        break;
    }
  }
  return {
    viewedMapIds: [...viewed].sort(), targetMapIds: [...targets].sort(),
    mapAttribution: viewed.size + targets.size === 0 ? "unknown" : partial ? "partial" : "complete",
  };
}

export function conversationTranscriptCompacted(entries: readonly AuditEntry[]): boolean {
  return entries.some(entry => {
    switch (entry.kind) {
      case "status": return entry.text.startsWith("[conversation-trimmed]");
      case "tool": return entry.args._truncated === true || entry.args._unserializable === true;
      case "assistant": return (entry.toolCalls ?? []).some(call => {
        try { JSON.parse(call.args); return false; } catch { return true; }
      });
      case "user": return false;
    }
  });
}
