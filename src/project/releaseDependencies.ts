/** Versioned wire API shared by the producer and operator-retained collector. */
export const RELEASE_COLLECTOR_FILE = "dependency-collector.js";
export interface ReleaseDependency {
  readonly path: string;
  readonly dataUrl?: string;
}
export type ReleaseDependencyCollector = (projectJson: string) => readonly ReleaseDependency[];
