import type { Project } from "@/project/types";
export interface MapRunLockRegion {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export type MapRunClaim = { readonly ok: true; readonly release: () => void }
  | { readonly ok: false; readonly owner: string; readonly mapIds: readonly string[] | null };
export function normalizeMapRunRegion(region: { readonly mapId?: string; readonly x?: number; readonly y?: number; readonly width?: number; readonly height?: number; readonly w?: number; readonly h?: number } | null | undefined): MapRunLockRegion | null;
export function mapRunRegionsOverlap(a: MapRunLockRegion | null | undefined, b: MapRunLockRegion | null | undefined): boolean;
export function mapRunRegion(request: { readonly mode?: string; readonly region?: { readonly mapId?: string; readonly x?: number; readonly y?: number; readonly width?: number; readonly height?: number } | null }): MapRunLockRegion | null;
export function createMapRunLocks(): {
  acquire(projectKey: string | null, mapIds: readonly string[] | null, owner: string, independent?: readonly string[], region?: MapRunLockRegion | null): MapRunClaim;
  busy(): boolean;
  refreshBundles(projectKey: string | null, project: Pick<Project, "mapTree">): void;
  subscribe(listener: () => void): () => void;
};
export function mapRunBundleIds(project: Pick<Project, "mapTree">, mapIds: readonly string[], independent?: readonly string[]): string[];
export function independentMapRunRoots(project: Pick<Project, "mapTree">, mapIds: readonly string[]): string[];
export function mapRunScope(request: { readonly mode?: string; readonly mapIds: readonly string[]; readonly project: Pick<Project, "mapTree">; readonly scopeStrict?: boolean; readonly mapBundleMerge?: boolean; readonly region?: MapRunLockRegion | null }): string[] | null;
export function settleMapRuns<T>(runs: readonly Promise<T>[]): Promise<T[]>;
