import { getMapEditHistoryChanges, getMapEditHistoryEntries, peekPreviousProject } from "@/editor/mapEditHistory";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { Project } from "@/project/types";
import type { PiAgentRequest } from "@/ai/piAgent/protocol";

function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" ? value : undefined;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 1) throw new ToolError("1 이상의 정수를 입력하세요.", { code: "invalid-args" });
  return Math.trunc(value);
}

export function replaceProjectContents(target: Project, source: Project): void {
  for (const key of Object.keys(target)) Reflect.deleteProperty(target, key);
  Object.assign(target, structuredClone(source));
}

export type ClientEditHistoryEntry = NonNullable<PiAgentRequest["editHistory"]>[number];

// Pi 워커는 편집기의 히스토리 스택이 없는 별도 프로세스다. 요청이 실어 보낸 목록을 여기 두면 두 도구가 편집기가 본 기록으로 답한다.
// null = 편집기 안(스택을 직접 읽는다), 배열 = 워커(목록으로 답하고 되돌림은 편집기가 끝에 실행한다).
let clientHistory: readonly ClientEditHistoryEntry[] | null = null;
export function setClientEditHistory(entries: readonly ClientEditHistoryEntry[] | null): void {
  clientHistory = entries;
}

const revertLastEdit: ToolDefinition = {
  name: "revert_last_edit",
  description:
    "최근 편집 히스토리의 이전 상태로 되돌린다. 사용자가 '되돌려/취소/이전으로/undo'라고 하면 이 툴을 호출하라. 절대 clear_region 등으로 직접 지우지 말 것.",
  mode: "write",
  // 이전 스냅샷을 그대로 복원한다 — 칩셋이 업로드 타일셋에서 돌아가는 것도 되돌리기의 일부다.
  allowsTilesetChange: true,
  parameters: {
    type: "object",
    properties: {
      steps: { type: "integer", description: "몇 단계 전 스냅샷으로 되돌릴지(기본 1)" },
    },
  },
  run(draft, args): ToolExecResult {
    const steps = positiveInteger(optionalNumber(args, "steps"), 1);
    if (clientHistory) {
      const target = clientHistory.find((entry) => entry.steps === steps);
      if (!target) throw new ToolError("되돌릴 이전 상태가 없습니다", { code: "history-empty" });
      // 초안은 그대로 둔다 — 편집기가 이 실행이 끝난 뒤 실제 되돌리기를 한다(data.clientUndo).
      return { summary: `직전 변경을 되돌립니다 — ${target.label}`, data: { clientUndo: steps, label: target.label } };
    }
    const previous = peekPreviousProject(steps);
    if (!previous) throw new ToolError("되돌릴 이전 상태가 없습니다", { code: "history-empty" });
    const label = getMapEditHistoryEntries()[steps - 1]?.label ?? "편집";
    replaceProjectContents(draft, previous);
    return { summary: `직전 변경을 되돌립니다 — ${label}` };
  },
};

const listEditHistory: ToolDefinition = {
  name: "list_edit_history",
  description: "편집 히스토리의 라벨, 맵, 순서를 조회한다. 가까운 항목에는 changes(바뀐 타일 칸 좌표 tileCells·총수 tileCellCount, 추가·삭제·변경된 이벤트 id)가 실려 있어 「방금 뭘 바꿨나·어떤 타일을 고쳤나」에도 이 도구로 답한다. 되돌릴 수 있는 작업을 사용자에게 설명하거나 되돌릴 지점을 확인할 때 사용한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "이 맵에 관련된 기록만 볼 때 지정" },
      limit: { type: "integer", description: "최대 반환 개수(기본 10)" },
    },
  },
  run(_project, args): ToolExecResult {
    const mapId = optionalString(args, "mapId");
    const limit = positiveInteger(optionalNumber(args, "limit"), 10);
    const local = () => {
      const changes = getMapEditHistoryChanges(5);
      return getMapEditHistoryEntries().map((entry) => {
        const mine = changes.filter((change) => change.steps === entry.steps).map(({ steps: _steps, ...rest }) => rest);
        return mine.length ? { ...entry, changes: mine } : entry;
      });
    };
    const entries = (clientHistory ?? local())
      .filter((entry) => mapId === undefined || entry.mapId === mapId)
      .slice(0, limit);
    return {
      summary: entries.length > 0 ? `편집 기록 ${entries.length}건` : "편집 기록이 없습니다",
      data: { entries },
    };
  },
};

export const HISTORY_TOOLS: readonly ToolDefinition[] = [revertLastEdit, listEditHistory];
