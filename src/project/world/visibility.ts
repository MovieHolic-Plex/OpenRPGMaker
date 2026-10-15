import type { ProjectWorld, WorldEntity } from "./types";

/**
 * 카드 단위 AI 공개 범위의 **유일한 판정 지점**.
 *
 * 모델로 가는 경로(조수 시스템 프롬프트 위키 블록·`read_project_wiki`·`get_original_context`·
 * `read_authoring_preset`·독립 검수 변경 목록·NPC 대사 작성기 다이제스트·위키 추출기 입력)는
 * 세계 카드를 읽기 전에 반드시 이 함수들을 거친다. 새 경로를 만들면 같은 함수를 부르고
 * `test/worldCardVisibility.test.ts` 의 전수 목록에 한 줄을 더한다.
 *
 * 게임 런타임(player)·에디터 화면은 이 필터를 거치지 않는다 — 작가는 숨긴 카드를 늘 본다.
 */
export function isAiHiddenEntity(entity: Pick<WorldEntity, "visibility">): boolean {
  return entity.visibility === "ai-hidden";
}

export function aiVisibleEntities<T extends Pick<WorldEntity, "visibility">>(entities: readonly T[]): readonly T[] {
  return entities.some(isAiHiddenEntity) ? entities.filter((entity) => !isAiHiddenEntity(entity)) : entities;
}

/**
 * 숨긴 카드와 그 카드에 닿는 관계(관계는 상대 id·메모로 숨긴 카드를 드러낸다)를 뺀 세계.
 * 숨긴 카드가 없으면 같은 객체를 돌려준다(저장 바이트·참조 동일).
 */
export function aiVisibleWorld(world: ProjectWorld): ProjectWorld;
export function aiVisibleWorld(world: ProjectWorld | undefined): ProjectWorld | undefined;
export function aiVisibleWorld(world: ProjectWorld | undefined): ProjectWorld | undefined {
  if (!world || !world.entities.some(isAiHiddenEntity)) return world;
  const hidden = new Set(world.entities.filter(isAiHiddenEntity).map((entity) => entity.id));
  return {
    ...world,
    entities: world.entities.filter((entity) => !hidden.has(entity.id)),
    relations: world.relations.filter((relation) => !hidden.has(relation.a) && !hidden.has(relation.b)),
  };
}
