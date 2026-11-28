import type { AuditEntry } from "@/ai/assistantSession";
import { piScopeMapIds } from "@/ai/threadHome";

export interface ConversationMapIndex {
  readonly viewedMapIds: readonly string[];
  readonly targetMapIds: readonly string[];
  readonly mapAttribution: "complete" | "partial" | "unknown";
  /** 대화의 집 맵(threadHomeMapId). null = 게임 전체. 처음 저장할 때 정하고 뒤 저장에서 바꾸지 않는다. 옛 기록엔 없다. */
  readonly homeMapId?: string | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === "string" && id.trim().length > 0);

export function isConversationMapIndex(value: unknown): value is ConversationMapIndex {
  return isObject(value) && isIds(value.viewedMapIds) && isIds(value.targetMapIds)
    && ["complete", "partial", "unknown"].includes(String(value.mapAttribution));
}

/** 저장된 집 맵. 아직 정하지 않았거나(옛 기록) 모양이 틀리면 undefined. */
export function storedHomeMapId(index: ConversationMapIndex | undefined): string | null | undefined {
  const value: unknown = index?.homeMapId;
  return value === null || (typeof value === "string" && value.trim().length > 0) ? value : undefined;
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
        for (const id of piScopeMapIds(entry.text) ?? []) add(targets, id);
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
