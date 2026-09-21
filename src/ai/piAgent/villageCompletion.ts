import { collectPendingNpcs } from "@/ai/npcCast";
import { isRecord } from "@/ai/session/unknownValue";
import { evaluateVillageLook } from "@/editor/tools/villageEvaluate";
import type { Project } from "@/project/types";
import type { PiToolCallRecord } from "./toolAdapter";

/** Successful author_village calls own this check; unrelated/user-authored NPCs do not. */
export interface PiVillageCompletion {
  readonly mapIds: readonly string[];
  readonly issues: readonly string[];
}

export function authoredVillageMapId(record: PiToolCallRecord): string | undefined {
  if (record.name !== "author_village" || !record.result.ok) return undefined;
  const data = record.result.data;
  if (!isRecord(data) || !isRecord(data.village)) return undefined;
  return typeof data.village.exteriorMapId === "string" ? data.village.exteriorMapId : undefined;
}

function pendingResidents(project: Project, baseline: Project, mapIds: readonly string[], residentIds?: readonly string[]) {
  // placeVillageNpcs/uniqueEventId owns ev_village_*. Visible door sprites are not residents.
  return collectPendingNpcs(project, baseline, mapIds).filter(npc => residentIds ? residentIds.includes(npc.eventId) : npc.eventId.startsWith("ev_village_"));
}

/** Always inspect the final project, not a cached evaluation from before the last edit. */
export function inspectPiVillageCompletion(project: Project, baseline: Project, ids: Iterable<string>): PiVillageCompletion {
  const mapIds = [...new Set(ids)];
  const issues: string[] = [];
  for (const mapId of mapIds) {
    try {
      const look = evaluateVillageLook({ project, mapId });
      if (!look.ok) issues.push(`${mapId}: 마을 룩 평가 미통과 — ${look.issues.join("; ")}`);
    } catch (error) {
      issues.push(`${mapId}: 마을 룩 평가 불가 — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const npc of pendingResidents(project, baseline, mapIds)) {
    issues.push(`${npc.mapId}/${npc.eventId}: 대사 없는 페이지 ${npc.pages.map(page => page.pageId).join(", ")}`);
  }
  return { mapIds, issues };
}

export function piVillageRepairPrompt(project: Project, baseline: Project, completion: PiVillageCompletion, residentIds?: readonly string[]): string {
  // Bound prompt size without dropping issues from the actual completion decision.
  return "[마을 완료 검사] 아직 완료되지 않았다. 아래 누락을 보충한 뒤 결과를 다시 보고하라. "
    + "대사는 consult_writer가 제공되면 도움을 받고 author_npc_cast로 적용한다. "
    + "기존 사용자 NPC는 바꾸지 않는다. find_tools로 현재 수정 도구를 찾고, 사용자 범위·DB 설계서를 유지하라. "
    + "룩 평가를 통과하려고 고정 설계서나 사용자 요청을 바꾸거나 맵 전체를 무단 재시공하지 마라. "
    + "그 조건에서 고칠 수 없으면 미완료 사유를 보고하라.\n"
    + JSON.stringify({ issues: completion.issues, pendingResidents: pendingResidents(project, baseline, completion.mapIds, residentIds) }).slice(0, 16000);
}
