import type { Project } from "@/project/types";

export interface ProjectSuggestion {
  id: string;
  fingerprint: string;
  title: string;
  evidence: string;
  request: string;
  mapId: string;
  x?: number;
  y?: number;
}

/** Facts only: suggestions never assert that an intentionally empty field is a defect. */
export function inspectProjectSuggestions(project: Project, mapId: string): ProjectSuggestion[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const result: ProjectSuggestion[] = [];
  const add = (id: string, title: string, evidence: string, request: string, facts: unknown, point?: { x: number; y: number }) => {
    result.push({ id, title, evidence, request: `「${map.name}」맵에서 ${request} 다른 내용은 유지해줘.`, mapId,
      fingerprint: JSON.stringify([map.name, facts]), ...point });
  };
  // Traverse nested conditional/choice commands as data, without interpreting or executing them.
  let visited = 0;
  for (const event of map.events) {
    const visit = (value: unknown, path: string): void => {
      if (++visited > 10000 || !value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach((v, i) => visit(v, path + "." + i)); return; }
      const c = value as Record<string, unknown>;
      const who = event.name || "이벤트";
      if (c.kind === "shop" && Array.isArray(c.itemIds) && c.itemIds.length === 0
        && !(Array.isArray(c.stock) && c.stock.length) && !(Array.isArray(c.cartLines) && c.cartLines.length)
        && !c.shopServiceKind && project.database.items.length) {
        add("shop:" + event.id + path, "상점에 판매할 물건을 연결할까요?",
          `${who}의 판매 목록이 비어 있고, DB에 물건 ${project.database.items.length}개가 있어요. 판매 전용이 아닌 상점이라면 그대로 둬도 돼요.`,
          `이벤트 「${who}」(${event.id})의 빈 판매 목록에 넣을 물건을 DB에서 골라 제안해줘.`,
          [event, project.database.items.map(i => [i.id, i.name])], { x: event.x, y: event.y });
      }
      if (c.kind === "transfer" && typeof c.mapId === "string" && !project.maps[c.mapId]) {
        add("transfer:" + event.id + path, "이동할 맵을 다시 연결할까요?",
          `${who}가 가리키는 목적지 맵이 현재 프로젝트에 없어요.`,
          `이벤트 「${who}」(${event.id})의 없는 이동 목적지를 확인하고 연결할 맵을 제안해줘.`,
          [event, Object.keys(project.maps)], { x: event.x, y: event.y });
      }
      for (const [key, child] of Object.entries(c)) if (child && typeof child === "object") visit(child, path + "." + key);
    };
    visit(event.pages?.length ? event.pages : event.commands, "");
  }
  if ((map.encounterRate ?? 0) > 0 && !map.troopIds?.length && !map.encounterTable?.length && project.database.troops.length) {
    add("encounters", "걸을 때 만날 적을 골라볼까요?",
      `이 맵은 적 만나기가 켜져 있지만 목록이 비어 있어요. DB에 적 그룹 ${project.database.troops.length}개가 있어요.`,
      "맵 분위기에 맞는 적 그룹을 DB에서 골라 적 만나기 목록에 넣을 구성을 제안해줘.",
      [map.encounterRate, project.database.troops.map(t => [t.id, t.name])]);
  }
  return result.slice(0, 12);
}

/** Model selects grounded candidates; unrecognized/free-form claims are never rendered. */
export function selectProjectSuggestions(text: string, candidates: readonly ProjectSuggestion[]): ProjectSuggestion[] {
  try {
    const ids: unknown = JSON.parse(text.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, ""));
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids)].flatMap(id => candidates.filter(c => c.id === id)).slice(0, 3);
  } catch { return []; }
}
