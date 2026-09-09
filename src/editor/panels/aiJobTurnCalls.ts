// editor/panels/aiJobTurnCalls.ts
// 큐 경로의 터미널 payload(`AiJobResult.payload`)에 실린 turn 의 쓰기 호출을 UI 가 읽을 수 있는
// 모양으로 옮긴다. **새 DTO 가 아니다** — 실행기(executors/assistantJob.ts)가 그대로 직렬화한
// TurnResult 의 `proposedCalls` 를 읽기 전용으로 다시 세울 뿐이고, 모양이 아닌 항목은 버린다.
//
// 왜 필요한가: 큐 경로의 적용 결과 카드(변경 카드)와 완성도 린트는 「어떤 쓰기가 있었나」를
// 알아야 한다. 캐스팅(`as ProposedCall[]`)으로 통과시키면 실행기 밖에서 만들어진 payload 가
// UI 를 통째로 죽일 수 있으므로, 필요한 필드만 확인해서 옮긴다.
import type { ProposedCall } from "@/ai/assistantSession";
import type { JsonObject, JsonValue } from "@/ai/jobs/contracts";
import type { ChangeSummary } from "@/editor/tools/types";

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** ChangeSummary 의 수치/불리언/경고 축만 옮긴다 — 없는 축은 0/false 로 채운다(요약의 기본값). */
function changeSummary(value: JsonValue | undefined): ChangeSummary | undefined {
  if (!isJsonObject(value)) return undefined;
  const count = (key: string): number => {
    const raw = value[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  };
  const flag = (key: string): boolean => value[key] === true;
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    tilesChanged: count("tilesChanged"),
    eventsAdded: count("eventsAdded"),
    eventsModified: count("eventsModified"),
    eventsRemoved: count("eventsRemoved"),
    mapsAdded: count("mapsAdded"),
    mapsRemoved: count("mapsRemoved"),
    dbRecordsChanged: count("dbRecordsChanged"),
    tilesetsChanged: count("tilesetsChanged"),
    switchesAdded: count("switchesAdded"),
    variablesAdded: count("variablesAdded"),
    worldEntitiesAdded: count("worldEntitiesAdded"),
    worldEntitiesModified: count("worldEntitiesModified"),
    palettePresetsAdded: count("palettePresetsAdded"),
    palettePresetsModified: count("palettePresetsModified"),
    endingsChanged: count("endingsChanged"),
    sessionChanged: flag("sessionChanged"),
    systemChanged: flag("systemChanged"),
    warnings: [...warnings],
    ...(typeof value.mapPropertiesChanged === "number" ? { mapPropertiesChanged: count("mapPropertiesChanged") } : {}),
  };
}

/**
 * 터미널 payload 의 `proposedCalls` — 이름이 없거나 객체가 아닌 항목은 버린다.
 * 여기서 만든 값은 표시·린트 전용이다: 다시 실행되지 않는다(적용은 결과 스냅샷이 한다).
 */
export function parseTurnProposedCalls(payload: JsonObject): ProposedCall[] {
  const raw = payload.proposedCalls;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): ProposedCall[] => {
    if (!isJsonObject(entry) || typeof entry.name !== "string") return [];
    const args: Record<string, unknown> = {};
    if (isJsonObject(entry.args)) for (const [key, value] of Object.entries(entry.args)) args[key] = value;
    const summary = typeof entry.summary === "string" ? entry.summary : "";
    const result = isJsonObject(entry.result) ? entry.result : null;
    const diff = changeSummary(result?.diff);
    return [{
      name: entry.name,
      args,
      summary,
      destructive: entry.destructive === true,
      result: {
        ok: result ? result.ok !== false : true,
        summary: typeof result?.summary === "string" ? result.summary : summary,
        ...(diff ? { diff } : {}),
        ...(result && result.data !== undefined ? { data: result.data } : {}),
      },
      ...(typeof entry.requiresApproval === "boolean" ? { requiresApproval: entry.requiresApproval } : {}),
      ...(typeof entry.approvalWarning === "string" ? { approvalWarning: entry.approvalWarning } : {}),
      ...(typeof entry.reason === "string" ? { reason: entry.reason } : {}),
    }];
  });
}
