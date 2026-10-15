import type { ProjectWorld, WorldEntity, WorldEntityType } from "./types";
import { aiVisibleEntities } from "./visibility";

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

export interface WorldDigestSelection {
  /** 다이제스트에 실제로 실린 카드(우선순위 순). */
  readonly included: readonly WorldEntity[];
  /** 예산 때문에 빠진 카드 수 — AI 비공개 카드는 세지 않는다(애초에 후보가 아니다). */
  readonly omitted: number;
  readonly text: string;
}

/**
 * 다이제스트 본체. `buildWorldDigest` 는 이 함수의 text 일 뿐이고, 「AI가 읽는 것」 패널도 이 함수를 그대로 부른다
 * (실린 카드 목록을 따로 계산하면 화면과 프롬프트가 어긋난다).
 */
export function selectWorldDigest(world: ProjectWorld, options: WorldDigestOptions): WorldDigestSelection {
  const maxTokens = Math.max(0, Math.floor(options.maxTokens));
  // 이 다이제스트는 모델 입력이다 — AI 비공개 카드는 여기서 빠진다(visibility.ts).
  const ordered = aiVisibleEntities(world.entities)
    .map((entity, index) => ({ entity, index }))
    .sort((left, right) => ENTITY_TYPE_PRIORITY[left.entity.type] - ENTITY_TYPE_PRIORITY[right.entity.type] || left.index - right.index)
    .map(({ entity }) => ({ entity, line: digestLine(entity) }));

  if (ordered.length === 0) return { included: [], omitted: 0, text: "세계관 없음" };

  const full = ordered.map((entry) => entry.line).join("\n");
  if (estimateWorldTokens(full) <= maxTokens) return { included: ordered.map((entry) => entry.entity), omitted: 0, text: full };

  const included: typeof ordered = [];
  for (const entry of ordered) {
    const remainingAfterCandidate = ordered.length - included.length - 1;
    const candidateLines = [...included.map((item) => item.line), entry.line];
    if (remainingAfterCandidate > 0) candidateLines.push(omittedLine(remainingAfterCandidate));
    if (estimateWorldTokens(candidateLines.join("\n")) > maxTokens) break;
    included.push(entry);
  }

  const omitted = ordered.length - included.length;
  const entities = included.map((item) => item.entity);
  if (omitted === 0) return { included: entities, omitted, text: included.map((item) => item.line).join("\n") };
  const marker = omittedLine(omitted);
  if (included.length === 0) return { included: entities, omitted, text: marker };
  return { included: entities, omitted, text: [...included.map((item) => item.line), marker].join("\n") };
}

export function buildWorldDigest(world: ProjectWorld, options: WorldDigestOptions): string {
  return selectWorldDigest(world, options).text;
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

export function estimateWorldTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
