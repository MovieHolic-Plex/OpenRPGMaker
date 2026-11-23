import type { Project } from "@/project/types";
import templateData from "./mapTemplates.json" with { type: "json" };
import { templateOverlap, type OverlapGrid } from "@/project/mapTemplateOverlap";

/** 길·던전 맵의 사람 옮기기(아래 표)는 견본 판을 보고 잰 자리다 — 생성기가 새로 짠 판(fieldGenerator)에서는 같은 좌표가 물가·구석일 수 있다(2026-11-23 해변 연구원이 막힌 칸에 섬). */
const FIELD_TEMPLATES: Readonly<Record<string, string>> = {
  river: "wild/river", meadow: "overworld/route", hideout: "dungeon/hideout", beach: "coast/beach", ice_cave: "dungeon/ice_cave", ruins: "dungeon/ruins", snow: "climate/ice_route",
};
const templates = templateData as unknown as Record<string, OverlapGrid>;

// Reviewed corridor repairs after making NPCs solid. Open-looking floor can
// still be an articulation point, an ice approach, or a portal bypass.
const RELOCATIONS = [
  ["home", "guide", 11, 10, 9, 12],
  ["lab", "rival", 10, 6, 12, 5],
  ["museum", "curator", 6, 5, 6, 4],
  ["river", "trainer_1", 10, 14, 8, 13],
  ["river", "trainer_2", 17, 22, 17, 19],
  ["meadow", "trainer_2", 17, 22, 17, 19],
  ["prism", "sign_mx_map_cave", 26, 10, 26, 9],
  ["home", "sign_mx_map_meadow", 10, 3, 9, 4],
  ["grove", "sign_mx_map_forest", 10, 3, 9, 4],
  ["harbor", "sign_mx_map_river", 16, 9, 21, 9],
  ["frost", "sign_mx_map_marsh", 16, 3, 12, 4],
  ["frost", "sign_mx_map_ice_cave", 17, 3, 17, 7],
  ["moon", "sign_mx_map_ruins", 10, 3, 9, 4],
  ["hideout", "company_0", 5, 12, 6, 11],
  ["beach", "researcher", 14, 30, 16, 32],
  ["ice_cave", "researcher", 4, 11, 8, 11],
  ["ruins", "sign_mx_map_summit", 12, 13, 13, 13],
  ["snow", "sign_mx_map_frost", 13, 3, 14, 3],
  ["snow", "trainer_1", 10, 10, 8, 7],
  ["ruins", "trail_sign", 6, 12, 5, 12],
] as const;

/** Idempotent: preserve any position already edited away from the old seed. */
export function repairExpeditionNpcLayout(project: Project): string[] {
  const moved: string[] = [];
  for (const [key, suffix, fromX, fromY, x, y] of RELOCATIONS) {
    const mapId = `mx_map_${key}`;
    const event = project.maps[mapId]?.events.find(entry => entry.id === `${mapId}_${suffix}`);
    if (!event || event.x !== fromX || event.y !== fromY) continue;
    const reviewed = FIELD_TEMPLATES[key] ? templates[FIELD_TEMPLATES[key]] : undefined;
    const map = project.maps[mapId]!;
    if (reviewed && templateOverlap({ width: map.width, height: map.height, lower: map.lowerTiles, tilesetId: map.tilesetId }, reviewed, 0).overlap < 0.85) continue;
    event.x = x;
    event.y = y;
    moved.push(event.id);
  }
  return moved;
}
