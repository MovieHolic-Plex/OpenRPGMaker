import type { Project } from './types';

export const WORLD_ATLAS_STRUCTURES = ['region-routes', 'scaled-world', 'field-overview', 'stage-nodes', 'room-network', 'run-path'] as const;
export type WorldAtlasStructure = typeof WORLD_ATLAS_STRUCTURES[number];
export const WORLD_ATLAS_CATALOG = [
  { id: 'region-routes', name: '지역 · 마을과 도로', inspiration: 'Pokémon', description: '지역 지도와 실제 마을·도로를 분리하고 출입구로 왕복합니다.' },
  { id: 'scaled-world', name: '축척 월드 · 대륙 걷기', inspiration: 'Final Fantasy VI', description: '작게 그린 대륙을 직접 걷고 거점의 실제 맵으로 들어갑니다.' },
  { id: 'field-overview', name: '필드 · 지형과 능력', inspiration: 'Zelda', description: '연속된 필드의 지형을 지도에 그대로 표시하고 능력으로 새 길을 엽니다.' },
  { id: 'stage-nodes', name: '스테이지 · 클리어와 비밀길', inspiration: 'Super Mario World', description: '코스를 클리어하면 다음 코스, 비밀 출구를 찾으면 지름길을 엽니다.' },
  { id: 'room-network', name: '방 · 발견과 재탐색', inspiration: 'Hollow Knight', description: '횡스크롤 방을 연결하고 발견한 방과 능력 관문, 지도 핀을 기록합니다.' },
  { id: 'run-path', name: '런 · 일방향 분기', inspiration: 'Slay the Spire', description: '전투·휴식·보물·상점을 선택하며 위층으로 전진합니다. 지나간 분기는 돌아가지 않습니다.' },
] as const;

export type AtlasPoint = { x: number; y: number };
export type AtlasNodeKind = 'town' | 'route' | 'field' | 'dungeon' | 'stage' | 'room' | 'battle' | 'elite' | 'camp' | 'treasure' | 'shop' | 'event' | 'boss';
export interface WorldAtlasNode {
  id: string; name: string; mapId: string; kind: AtlasNodeKind;
  /** Position and footprint in the atlas's own geographic coordinate system. */
  x: number; y: number; w: number; h: number;
  entry: AtlasPoint;
  visitSwitchId: string; clearSwitchId: string;
  grants: string[];
  /** Location in the walkable scaled overworld, when present. */
  worldEntrance?: AtlasPoint;
  /** Saved layout identity: deleting another room must not change this room's silhouette. */
  roomShape?: number;
}
export interface WorldAtlasEdge {
  id: string; from: string; to: string; requires: string[];
  oneWay: boolean; secret?: boolean;
  /** Real field doors; the overview and transfer events share these coordinates. */
  fromExit?: AtlasPoint; toExit?: AtlasPoint;
}
export interface WorldAtlas {
  version: 1; id: string; name: string; structure: WorldAtlasStructure;
  seed: number; width: number; height: number; startNodeId: string;
  nodes: WorldAtlasNode[]; edges: WorldAtlasEdge[];
  abilities: { switchId: string; name: string }[];
  overviewMapId?: string;
  /** Every pin is a regular persisted switch: no second runtime save format. */
  pins: { nodeId: string; switchId: string }[];
}
export interface AtlasState { switches: Record<string, boolean> }

export function worldAtlasForMap(project: Pick<Project, 'worldAtlases'>, mapId: string): WorldAtlas | undefined {
  return project.worldAtlases?.find(atlas => atlas.overviewMapId === mapId || atlas.nodes.some(node => node.mapId === mapId));
}
export function atlasNodeForMap(atlas: WorldAtlas, mapId: string): WorldAtlasNode | undefined {
  return atlas.nodes.find(node => node.mapId === mapId);
}
export function visitAtlasMap(project: Pick<Project, 'worldAtlases'>, state: AtlasState, mapId: string): void {
  const atlas = worldAtlasForMap(project, mapId);
  const node = atlas && atlasNodeForMap(atlas, mapId);
  if (node) state.switches[node.visitSwitchId] = true;
}
export function atlasGateNames(atlas: WorldAtlas, edge: WorldAtlasEdge, state: AtlasState): string[] {
  return edge.requires.filter(id => state.switches[id] !== true).map(id =>
    atlas.abilities.find(ability => ability.switchId === id)?.name
    ?? `${atlas.nodes.find(node => node.clearSwitchId === id)?.name ?? '관문'} 클리어`);
}
export function atlasTravelOptions(atlas: WorldAtlas, state: AtlasState, mapId: string) {
  const current = atlasNodeForMap(atlas, mapId);
  if (!current) return [];
  return atlas.edges.flatMap(edge => {
    const nextId = edge.from === current.id ? edge.to : !edge.oneWay && edge.to === current.id ? edge.from : undefined;
    if (!nextId) return [];
    const node = atlas.nodes.find(candidate => candidate.id === nextId)!;
    const missing = atlasGateNames(atlas, edge, state);
    // Consumed run choices remain visible on the map but can never be entered again.
    if (atlas.structure === 'run-path' && state.switches[node.visitSwitchId]) missing.push('이미 지나간 층');
    return [{ edge, node, available: missing.length === 0, missing }];
  });
}
export function atlasCanTravel(atlas: WorldAtlas, state: AtlasState, mapId: string, nodeId: string): boolean {
  return ['stage-nodes', 'run-path'].includes(atlas.structure)
    && atlasTravelOptions(atlas, state, mapId).some(option => option.node.id === nodeId && option.available);
}

/** Strict authored contract. Invalid external documents fail load instead of opening gates silently. */
export function normalizeWorldAtlases(value: unknown): WorldAtlas[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('worldAtlases must be an array of at most 64 atlases');
  const result = structuredClone(value) as WorldAtlas[];
  const ids = new Set<string>();
  const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 240;
  const point = (p: AtlasPoint | undefined) => !!p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0;
  const kinds: AtlasNodeKind[] = ['town','route','field','dungeon','stage','room','battle','elite','camp','treasure','shop','event','boss'];
  const strings = (v: unknown) => Array.isArray(v) && v.every(str);
  for (const atlas of result) {
    if (!atlas || atlas.version !== 1 || !str(atlas.id) || ids.has(atlas.id) || !str(atlas.name)
      || !WORLD_ATLAS_STRUCTURES.includes(atlas.structure) || !Number.isInteger(atlas.seed)
      || !Number.isFinite(atlas.width) || atlas.width < 1 || atlas.width > 4096
      || !Number.isFinite(atlas.height) || atlas.height < 1 || atlas.height > 4096
      || !Array.isArray(atlas.nodes) || atlas.nodes.length < 2 || atlas.nodes.length > 256
      || !Array.isArray(atlas.edges) || atlas.edges.length > 1024
      || !Array.isArray(atlas.abilities) || !Array.isArray(atlas.pins)) throw new Error('Invalid world atlas');
    ids.add(atlas.id);
    const nodes = new Set<string>();
    for (const node of atlas.nodes) {
      if (!node || !str(node.id) || nodes.has(node.id) || !str(node.name) || !str(node.mapId)
        || !kinds.includes(node.kind) || !point(node.entry) || !str(node.visitSwitchId) || !str(node.clearSwitchId) || !strings(node.grants)
        || ![node.x,node.y,node.w,node.h].every(Number.isFinite) || node.x < 0 || node.y < 0 || node.w <= 0 || node.h <= 0
        || node.x + node.w > atlas.width || node.y + node.h > atlas.height
        || (node.worldEntrance !== undefined && !point(node.worldEntrance))
        || (node.roomShape !== undefined && (!Number.isInteger(node.roomShape) || node.roomShape < 0 || node.roomShape > 9))) throw new Error('Invalid world atlas node');
      nodes.add(node.id);
    }
    if (!nodes.has(atlas.startNodeId)) throw new Error('Invalid world atlas start');
    const edges = new Set<string>();
    for (const edge of atlas.edges) {
      if (!edge || !str(edge.id) || edges.has(edge.id) || !nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to
        || typeof edge.oneWay !== 'boolean' || !strings(edge.requires)
        || (edge.secret !== undefined && typeof edge.secret !== 'boolean')
        || (edge.fromExit !== undefined && !point(edge.fromExit)) || (edge.toExit !== undefined && !point(edge.toExit))) throw new Error('Invalid world atlas edge');
      edges.add(edge.id);
    }
    if (atlas.overviewMapId !== undefined && !str(atlas.overviewMapId)) throw new Error('Invalid world atlas overworld');
    for (const ability of atlas.abilities) if (!ability || !str(ability.switchId) || !str(ability.name)) throw new Error('Invalid world atlas ability');
    for (const pin of atlas.pins) if (!pin || !nodes.has(pin.nodeId) || !str(pin.switchId)) throw new Error('Invalid world atlas pin');
  }
  return result;
}
