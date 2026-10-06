import { createBlankProject } from "@/project/defaults/blankProject";
import { createMonsterKitTileset } from "@/project/defaults/monsterKit";
import monsterKitIndex from "@/assets/monsterKit/index.json";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";

/** A fresh canonical destination, before authored campaign maps replace the blank map. */
export function createExpeditionSeed(): Project {
  const project = createBlankProject();
  project.meta.title = "별빛섬 몬스터 원정";
  project.meta.author = "OPRN Studio";
  const blankTileset = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
  project.tilesets = { [blankTileset.id]: blankTileset };
  for (const sheet of monsterKitIndex) {
    const tileset = createMonsterKitTileset(sheet.textureKey);
    project.tilesets[tileset.id] = tileset;
  }
  return project;
}

export function serializeExpeditionSeed(): string {
  return serialize(createExpeditionSeed());
}
