import type { Project } from "@/project/types";

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
    event.x = x;
    event.y = y;
    moved.push(event.id);
  }
  return moved;
}
