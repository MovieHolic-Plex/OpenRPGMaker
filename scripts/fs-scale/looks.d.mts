import type { LookGame, LookShot, LookVerdict } from "./lookSimilarity.mjs";
export type LookCorpus = { measure: string; games: (LookGame & { project_sha?: string })[]; defaults: { title?: LookShot; start?: LookShot } };
export type LookEntry = { id: string; made_at: string; prompt_sha?: string; title: string; start?: string; project?: string };
export function fileSha(path: string): string;
export function buildCorpus(entries: LookEntry[], defaults?: { title?: string; start?: string }): LookCorpus;
export function judgeCorpus(corpus: LookCorpus, options?: { thresholds?: { zero: number; penalty: number; penaltyPoints: number; identical: number } }): ({ id: string; project_sha?: string } & LookVerdict)[];
