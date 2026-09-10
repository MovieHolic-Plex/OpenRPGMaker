import type { AssetRef, MapTreeNode } from "../types";
import { assert, requireArray, requireNumber, requireRecord, requireString } from "./guards";

export function validateMapTree(
  label: string,
  value: unknown,
  knownMapIds: ReadonlySet<string>
): MapTreeNode {
  const node = requireRecord(label, value);
  const rawMapId = requireString(`${label}.mapId`, node.mapId);
  const fallbackMapId = knownMapIds.values().next().value as string | undefined;
  const mapId = knownMapIds.has(rawMapId) ? rawMapId : fallbackMapId;
  assert(mapId !== undefined, `${label}: 유효한 맵이 없습니다.`);
  const children = requireArray(`${label}.children`, node.children).map((child, index) =>
    validateMapTree(`${label}.children[${index}]`, child, knownMapIds)
  ).filter((child) => knownMapIds.has(child.mapId));
  return { mapId, children };
}

export function requirePosition(label: string, value: unknown): void {
  const position = requireRecord(label, value);
  requireNumber(`${label}.x`, position.x);
  requireNumber(`${label}.y`, position.y);
}

const TRIGGER_KINDS = ["action", "touch", "playerTouch", "eventTouch", "auto", "parallel", "locationTransition"] as const;
const LOCATION_TRANSITIONS = ["enter", "leave"] as const;

export function validateTrigger(label: string, value: unknown): void {
  const trigger = requireRecord(label, value);
  const kind = requireString(`${label}.kind`, trigger.kind);
  // 유효 목록을 함께 준다 — 모델이 "autorun" 처럼 그럴듯한 값을 발명했을 때 고칠 단서가 필요하다
  // (2026-08-23 실측: `알 수 없는 trigger.` 만 돌려주자 같은 인자를 3회 재전송).
  assert(
    TRIGGER_KINDS.includes(kind as (typeof TRIGGER_KINDS)[number]),
    `${label}: 알 수 없는 trigger "${kind}". 허용: ${TRIGGER_KINDS.join(", ")} (자동 실행은 "auto").`,
  );
  if (kind !== "locationTransition") return;
  // 구역 드나듦은 트리거 중 유일하게 매개변수가 있다. 로케이션 ID 의 **실재 여부는 검사하지
  // 않는다** — 삭제된 구역을 가리키는 저장본이 로드를 막아 버리면 사용자가 고칠 수단이 사라진다.
  // 그 상태는 `insideLocation` 과 똑같이 projectLint 의 `map-location-missing-ref` 가 올린다.
  requireString(`${label}.locationId`, trigger.locationId);
  const transition = requireString(`${label}.transition`, trigger.transition);
  assert(
    LOCATION_TRANSITIONS.includes(transition as (typeof LOCATION_TRANSITIONS)[number]),
    `${label}: 알 수 없는 transition "${transition}". 허용: ${LOCATION_TRANSITIONS.join(", ")}.`,
  );
}

export function validateAssetRef(label: string, value: unknown): AssetRef {
  const ref = requireRecord(label, value);
  const type = requireString(`${label}.type`, ref.type);
  assert(type === "bundled" || type === "uploaded", `${label}.type이 잘못되었습니다.`);
  requireString(`${label}.id`, ref.id);
  return { type, id: requireString(`${label}.id`, ref.id) };
}
