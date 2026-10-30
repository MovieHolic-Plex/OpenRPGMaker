import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";

/** `battleProcessing` 단계에서 troop 을 가리키는 부분만 — 변수 선택이면 session 변수로 푼다. */
interface DuelStepRef {
  readonly canLose?: boolean;
  readonly troopId: string;
  readonly troopSource?: string;
  readonly troopVariableId?: string;
}

function lookupTroopId(project: Project, step: DuelStepRef, session: Pick<PlaySession, "variables"> | undefined): string | undefined {
  if (step.troopSource !== "variable") return step.troopId;
  const raw: unknown = step.troopVariableId ? session?.variables[step.troopVariableId] : undefined;
  const troops = project.database.troops;
  if (typeof raw === "string" && troops.some(troop => troop.id === raw.trim())) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const index = Math.trunc(raw);
    return (troops[index - 1] ?? troops[index]
      ?? troops.find(entry => entry.id.endsWith(String(index)) || entry.id === String(index)))?.id;
  }
  return undefined;
}

/**
 * 이 전투 단계에서 패배가 게임 오버로 이어지지 않는가.
 * 저작한 `canLose` 이거나, 적 그룹의 결투 규칙 `playerYieldAtPercent` 가 있으면 true —
 * 결투 패배(파티가 항복선 아래)는 어떤 canLose 에서도 게임 오버가 아니고 「전투 뒤」/패배 분기로 이어진다.
 */
export function battleStepCanLose(project: Project, step: DuelStepRef, session?: Pick<PlaySession, "variables">): boolean {
  if (step.canLose) return true;
  const troopId = lookupTroopId(project, step, session);
  if (!troopId) return false;
  return project.database.troops.find(troop => troop.id === troopId)?.duel?.playerYieldAtPercent !== undefined;
}
