import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";

export const goblinId = "upload-monster-goblin";
export const slimeId = "upload-monster-slime";
export const monsterWriters = [
  { name: "upsert_enemy", args: (graphic: Record<string, unknown>) => ({ enemy: { id: "enemy_ai_test", name: "The Last Emperor", ...graphic } }) },
  { name: "define_monster_species", args: (graphic: Record<string, unknown>) => ({ species: { id: "species_ai_test", name: "The Last Emperor", graphic } }) },
  { name: "make_action_enemy", args: (graphic: Record<string, unknown>) => ({ enemyId: "enemy_ai_test", name: "The Last Emperor", actionProfile: { contactDamage: 3 }, ...graphic }) },
] as const;

export function monsterContext(): ToolContext {
  const project = createBlankProject();
  for (const [id, name] of [[goblinId, "Goblin"], [slimeId, "Slime"]]) {
    project.assets.uploaded[id] = { id, name, kind: "monster", dataUrl: "data:image/png;base64,", meta: {} };
  }
  Object.assign(project, { monsterMetadata: {
    [goblinId]: { tags: ["goblin", "green"], description: "fixture goblin appearance" },
    [slimeId]: { tags: ["slime", "blue"], description: "fixture slime appearance" },
  } });
  return { project };
}
