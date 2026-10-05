import type { Project } from './types';
import { WORLD_ATLAS_CATALOG, type WorldAtlasStructure } from './worldAtlas';

/** The original terrain kit stays separate from the six atlas navigation structures. */
export type WorldmapMode = 'default' | WorldAtlasStructure;
export const WORLD_MAP_MODES = [
  {
    id: 'default',
    name: '기본 · 기존 대륙 월드맵',
    description: '기존 월드맵 생성기로 대륙·바다·산맥·거점을 만듭니다. 세계관을 고르고 지형을 편집할 수 있습니다.',
  },
  ...WORLD_ATLAS_CATALOG,
] as const;

export function preferredWorldmapMode(project?: { system?: Pick<Project['system'], 'genre'> }): WorldmapMode {
  return project?.system?.genre === 'monster-collect' ? 'region-routes' : 'default';
}

/** Both the human creation dialog and the assistant use the same creation entry points. */
export function worldmapAuthoringRequest(mode: WorldmapMode, id: string, name: string, seed: number, theme = 'fantasy') {
  return mode === 'default'
    ? { toolName: 'edit_world_terrain', args: { newMapId: id, name, theme, ops: [] } }
    : { toolName: 'author_worldmap_structure', args: { id, structure: mode, name, seed } };
}
