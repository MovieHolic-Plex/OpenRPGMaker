export const WORLD_GRAPH_ROLES = ["town", "field", "dungeon", "interior"] as const;
export type WorldGraphRole = (typeof WORLD_GRAPH_ROLES)[number];

export const WORLD_GRAPH_SIDES = ["north", "south", "east", "west"] as const;
export type WorldGraphSide = (typeof WORLD_GRAPH_SIDES)[number];

export const WORLD_GRAPH_EDGE_KINDS = ["transfer", "adjacent"] as const;
export type WorldGraphEdgeKind = (typeof WORLD_GRAPH_EDGE_KINDS)[number];

export interface WorldGraphRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface WorldGraphSideRef {
  readonly side: WorldGraphSide;
}

export interface WorldGraphPoint {
  readonly x: number;
  readonly y: number;
}

export type WorldGraphBoundary = WorldGraphRect | WorldGraphSideRef;
export type WorldGraphEntry = WorldGraphPoint | WorldGraphRect | WorldGraphSideRef;

export interface WorldGraphNode {
  readonly mapId: string;
  readonly role: WorldGraphRole;
  readonly label?: string;
}

export interface WorldGraphFromEndpoint {
  readonly mapId: string;
  readonly exit?: WorldGraphBoundary;
}

export interface WorldGraphToEndpoint {
  readonly mapId: string;
  readonly entry?: WorldGraphEntry;
}

export interface WorldGraphEdge {
  readonly from: WorldGraphFromEndpoint;
  readonly to: WorldGraphToEndpoint;
  readonly kind: WorldGraphEdgeKind;
}

export interface WorldGraph {
  readonly nodes: readonly WorldGraphNode[];
  readonly edges: readonly WorldGraphEdge[];
}
