import { derivePatternGrammar } from "@/editor/tools/v3/rmTypeExpander";
import type { CompiledTilesetKnowledge, TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";
import type { TilesetDef } from "@/project/types";

export type PersistTilesetKnowledgeInput = {
  readonly compiled: CompiledTilesetKnowledge;
  readonly description: string;
  readonly placementRules: string;
  readonly template: TilesetKnowledgeTemplate;
};

export function persistTilesetKnowledge(tileset: TilesetDef, input: PersistTilesetKnowledgeInput): void {
  const group = {
    ...input.compiled.group,
    description: input.description,
    placementRules: input.placementRules,
  };
  tileset.autotileGroups = (tileset.autotileGroups ?? []).filter((entry) => entry.id !== group.id);
  if (input.template === "water-autotile-3x3" || input.template === "one-way-path") {
    group.patternGrammar = derivePatternGrammar("autotile_3x3", group.tileIds, tileset, {
      groupId: group.id,
      name: group.name,
    });
  }
  const groups = tileset.tileGroups ?? [];
  const index = groups.findIndex((entry) => entry.id === group.id);
  tileset.tileGroups = index < 0
    ? [...groups, group]
    : groups.map((entry) => entry.id === group.id ? group : entry);
  for (const rule of input.compiled.rules) {
    tileset.passability[rule.tileId] = { ...rule.passage };
    tileset.priority[rule.tileId] = rule.layer;
  }
}
