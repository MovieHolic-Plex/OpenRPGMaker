import type { Project } from "@/project/types";

/** References inside nested branches, common events, battle pages and epilogues. */
export function gameOverReferenceCounts(project: Project): Map<string, number> {
  const counts = new Map<string, number>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const entry of value) visit(entry); return; }
    const record = value as Record<string, unknown>;
    if ((record.kind === "gameOver" || record.kind === "killPlayer") && typeof record.gameOverId === "string") {
      counts.set(record.gameOverId, (counts.get(record.gameOverId) ?? 0) + 1);
    }
    for (const child of Object.values(record)) visit(child);
  };
  for (const map of Object.values(project.maps)) for (const event of map.events) visit(event.pages?.length ? event.pages : event.commands);
  visit(project.commonEvents);
  visit(project.database.troops);
  visit(project.endings);
  return counts;
}

export function gameOverName(project: Project, id?: string): string {
  return id ? project.system.gameOvers?.find(row => row.id === id)?.name ?? `없는 게임 오버 (${id})` : "프로젝트 기본값";
}
