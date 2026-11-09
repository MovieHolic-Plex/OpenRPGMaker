export type FsScaleComponent = { id: string; reference: number; weight: number; reason: string };
export type FsScaleWeights = { version: number; name: string; components: FsScaleComponent[] } & Record<string, unknown>;
export type FsScaleRaw = Record<string, number>;
export type FsScaleResult = {
  score: number;
  raw: FsScaleRaw;
  components: { id: string; value: number; reference: number; ratio: number; weight: number; points: number }[];
};
export const DEFAULT_WEIGHTS_PATH: string;
export function loadWeights(path?: string): FsScaleWeights;
export function measure(doc: unknown, baseline?: unknown): FsScaleRaw;
export function scoreProject(doc: unknown, options?: { weights?: FsScaleWeights; baseline?: unknown }): FsScaleResult;
export function countedContent(doc: unknown): { countedMaps: { id: string; map: unknown }[]; events: { event: unknown; mapId: string }[]; commonEvents: unknown[] };
