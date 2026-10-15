import type { WorldEntity } from "@/project/world/types";

// 연결 속성의 이름 → id 해석. DOM·에디터 상태를 끌어오지 않는 순수 모듈이다(헤드리스에서도 돈다).

/** 같은 이름이 둘 이상이면 「이름 · id」 로 구분해 자동 완성에 올린다. */
export function relationTargetLabels(targets: readonly WorldEntity[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const entity of targets) counts.set(entity.name, (counts.get(entity.name) ?? 0) + 1);
  return new Map(targets.map((entity) => [
    entity.id,
    !entity.name.trim() ? entity.id : (counts.get(entity.name) ?? 0) > 1 ? `${entity.name} · ${entity.id}` : entity.name,
  ]));
}

export type RelationTargetResolution = { readonly kind: "found"; readonly id: string } | { readonly kind: "ambiguous" } | { readonly kind: "none" };

/** 입력 → 문서 id. id 그대로, 자동 완성 표시 이름, 이름(대소문자 무시), 이름의 유일한 부분 일치 순으로 찾는다. */
export function resolveRelationTarget(input: string, targets: readonly WorldEntity[], labels: ReadonlyMap<string, string>): RelationTargetResolution {
  const text = input.trim();
  if (!text) return { kind: "none" };
  const byId = targets.find((entity) => entity.id === text);
  if (byId) return { kind: "found", id: byId.id };
  const byLabel = targets.filter((entity) => labels.get(entity.id) === text);
  if (byLabel.length === 1) return { kind: "found", id: byLabel[0]!.id };
  const lower = text.toLowerCase();
  for (const match of [
    targets.filter((entity) => entity.name.trim().toLowerCase() === lower),
    targets.filter((entity) => entity.name.toLowerCase().includes(lower)),
  ]) {
    if (match.length === 1) return { kind: "found", id: match[0]!.id };
    if (match.length > 1) return { kind: "ambiguous" };
  }
  return { kind: "none" };
}
