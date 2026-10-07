// game-concepts 데이터 폴더. 후보·그림·검사·사람 선택은 저장소 밖(GC_HARNESS_DATA)에 둔다 — 큰 생성 원본을 커밋하지 않는다.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { normalizeGameConcept, type ConceptTag, type GameConcept } from "../../../concepts/format";

export const DATA_DIR = resolve(process.env.GC_HARNESS_DATA ?? join(homedir(), "oprn-harness-data", "game-concepts"));
export const SEED_PATH = resolve("harness-data/game-concepts/seed.json");

export const paths = {
  candidates: join(DATA_DIR, "candidates"),
  images: join(DATA_DIR, "images"),
  checks: join(DATA_DIR, "checks"),
  logs: join(DATA_DIR, "logs"),
  decisions: join(DATA_DIR, "decisions.json"),
  published: join(DATA_DIR, "published.json"),
};

export type Seed = {
  version: 1;
  targets: Partial<Record<ConceptTag, number>>;
  examples: string[];
  presetGuide: Record<string, string>;
  tilesetHints: Record<string, string>;
  rules: string[];
};
export type Verdict = "accept" | "reject";
export type Decision = { verdict: Verdict; imageSha: string; at: string };
export type CheckResult = { imageSha: string; ok: boolean; findings: string[]; at: string };

export function ensureDirs(): void {
  for (const dir of [paths.candidates, paths.images, paths.checks, paths.logs]) mkdirSync(dir, { recursive: true });
}

export function readSeed(): Seed {
  return JSON.parse(readFileSync(SEED_PATH, "utf8")) as Seed;
}

/** 임시 파일에 쓰고 rename — 중간에 죽어도 반쯤 쓴 JSON 이 남지 않는다. */
export function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, path);
}

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function listCandidates(): GameConcept[] {
  if (!existsSync(paths.candidates)) return [];
  return readdirSync(paths.candidates).filter((name) => name.endsWith(".json")).sort().map((name) => {
    return normalizeGameConcept(JSON.parse(readFileSync(join(paths.candidates, name), "utf8")));
  });
}

export function saveCandidate(concept: GameConcept): void {
  writeJsonAtomic(join(paths.candidates, `${concept.slug}.json`), concept);
}

export const imagePath = (slug: string, size: "full" | "card"): string => join(paths.images, `${slug}.${size}.webp`);

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** 판정이 묶이는 그림 해시 = 큰 그림의 sha256. 그림이 없으면 null. */
export function currentImageSha(slug: string): string | null {
  const full = imagePath(slug, "full");
  return existsSync(full) ? sha256File(full) : null;
}

export function readDecisions(): Record<string, Decision> {
  return readJson<Record<string, Decision>>(paths.decisions, {});
}

export function writeDecision(slug: string, verdict: Verdict, imageSha: string): Decision {
  const decisions = readDecisions();
  const decision = { verdict, imageSha, at: new Date().toISOString() };
  decisions[slug] = decision;
  writeJsonAtomic(paths.decisions, decisions);
  return decision;
}

export function readCheck(slug: string): CheckResult | null {
  return readJson<CheckResult | null>(join(paths.checks, `${slug}.json`), null);
}

export function writeCheck(slug: string, result: CheckResult): void {
  writeJsonAtomic(join(paths.checks, `${slug}.json`), result);
}

/** 사람이 받았고, 그 판정이 지금 그림에 대한 것인 후보. */
export function acceptedCandidates(): GameConcept[] {
  const decisions = readDecisions();
  return listCandidates().filter((concept) => {
    const decision = decisions[concept.slug];
    return decision?.verdict === "accept" && decision.imageSha === currentImageSha(concept.slug);
  });
}

/** 분류(첫 태그)마다 하나씩 번갈아 고른다 — 피드 첫 쪽이 한 분류로 몰리지 않게. */
export function roundRobinByTag(concepts: readonly GameConcept[]): GameConcept[] {
  const groups = new Map<string, GameConcept[]>();
  for (const concept of concepts) {
    const key = concept.tags[0]!;
    groups.set(key, [...(groups.get(key) ?? []), concept]);
  }
  const queues = [...groups.values()];
  const out: GameConcept[] = [];
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) out.push(next);
    }
  }
  return out;
}

export function log(name: string, line: string): void {
  mkdirSync(paths.logs, { recursive: true });
  writeFileSync(join(paths.logs, `${name}.log`), `${new Date().toISOString()} ${line}\n`, { flag: "a" });
}

/** 동시에 limit 개씩 돈다. */
export async function pool<T>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) await work(items[index]!, index);
  }));
}
