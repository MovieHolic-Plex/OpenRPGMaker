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

export function validateTrigger(label: string, value: unknown): void {
  const trigger = requireRecord(label, value);
  const kind = requireString(`${label}.kind`, trigger.kind);
  assert(
    ["action", "touch", "playerTouch", "eventTouch", "auto", "parallel"].includes(kind),
    `${label}: 알 수 없는 trigger.`
  );
}

export function validateAssetRef(label: string, value: unknown): AssetRef {
  const ref = requireRecord(label, value);
  const type = requireString(`${label}.type`, ref.type);
  assert(type === "bundled" || type === "uploaded", `${label}.type이 잘못되었습니다.`);
  requireString(`${label}.id`, ref.id);
  return { type, id: requireString(`${label}.id`, ref.id) };
}
