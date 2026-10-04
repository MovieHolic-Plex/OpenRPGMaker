import type { Project } from "@/project/types";
export type MapRunClaim = { readonly ok: true; readonly release: () => void }
  | { readonly ok: false; readonly owner: string; readonly mapIds: readonly string[] | null };
export function createMapRunLocks(): {
  acquire(projectKey: string | null, mapIds: readonly string[] | null, owner: string): MapRunClaim;
  busy(): boolean;
  refreshBundles(projectKey: string | null, project: Pick<Project, "mapTree">): void;
  subscribe(listener: () => void): () => void;
};
export function mapRunBundleIds(project: Pick<Project, "mapTree">, mapIds: readonly string[]): string[];
export function independentMapRunRoots(project: Pick<Project, "mapTree">, mapIds: readonly string[]): string[];
export function mapRunScope(request: { readonly mode?: string; readonly mapIds: readonly string[]; readonly project: Pick<Project, "mapTree">; readonly scopeStrict?: boolean; readonly mapBundleMerge?: boolean }): string[] | null;
export function settleMapRuns<T>(runs: readonly Promise<T>[]): Promise<T[]>;
