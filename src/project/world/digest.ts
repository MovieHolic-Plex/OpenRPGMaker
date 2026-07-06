import type { ProjectWorld, WorldEntity, WorldEntityType } from "./types";

export interface WorldDigestOptions {
  readonly maxTokens: number;
}

const ENTITY_TYPE_PRIORITY: Record<WorldEntityType, number> = {
  guideline: 0,
  faction: 1,
  character: 2,
  place: 3,
  event: 4,
  item: 5,
  concept: 6,
};

export function buildWorldDigest(world: ProjectWorld, options: WorldDigestOptions): string {
  const maxTokens = Math.max(0, Math.floor(options.maxTokens));
  const ordered = world.entities
    .map((entity, index) => ({ entity, index }))
    .sort((left, right) => ENTITY_TYPE_PRIORITY[left.entity.type] - ENTITY_TYPE_PRIORITY[right.entity.type] || left.index - right.index)
    .map(({ entity }) => digestLine(entity));

  if (ordered.length === 0) return "세계관 없음";

  const full = ordered.join("\n");
  if (estimateTokens(full) <= maxTokens) return full;

  const included: string[] = [];
  for (const line of ordered) {
    const remainingAfterCandidate = ordered.length - included.length - 1;
    const candidateLines = [...included, line];
    if (remainingAfterCandidate > 0) candidateLines.push(omittedLine(remainingAfterCandidate));
    if (estimateTokens(candidateLines.join("\n")) > maxTokens) break;
    included.push(line);
  }

  const omitted = ordered.length - included.length;
  if (omitted === 0) return included.join("\n");
  const marker = omittedLine(omitted);
  if (included.length === 0) return marker;
  return [...included, marker].join("\n");
}

function digestLine(entity: WorldEntity): string {
  return `[${entity.type}] ${compact(entity.name)}: ${compact(entity.summary)}`;
}

function omittedLine(count: number): string {
  return `…외 ${count}개`;
}

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
