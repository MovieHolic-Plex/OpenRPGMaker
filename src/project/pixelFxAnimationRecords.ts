// pixelfx 효과를 트는 전투 애니메이션 레코드(BattleAnimationRecord.pixelFx) 찾기·만들기 — 편집기 고르기 창과 조수 도구 공용.
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizePixelFxSpec, pixelFxAnimationId, pixelFxRenderKey } from "@/project/pixelFxSpec";
import type { BattleAnimationPosition, BattleAnimationRecord, BattleAnimationScope, PixelFxSpec } from "@/project/types";

/**
 * 이 효과를 트는 전투 애니메이션 레코드를 찾거나 만든다(제자리 수정, 편집기·조수 공용). 같은 그림(pixelFxRenderKey)·
 * 배율·속도·밀기를 가진 레코드가 있으면 그것을 쓰고, 없으면 anim_pfx_* 를 새로 넣는다. 돌려주는 값은 레코드 id.
 */
export function upsertPixelFxAnimationRecord(
  records: BattleAnimationRecord[],
  rawSpec: PixelFxSpec,
  options: { readonly name?: string; readonly position?: BattleAnimationPosition; readonly scope?: BattleAnimationScope } = {},
): string | undefined {
  const spec = normalizePixelFxSpec(rawSpec);
  if (!spec) return undefined;
  const same = (other: PixelFxSpec | undefined): boolean => Boolean(other)
    && pixelFxRenderKey(other!) === pixelFxRenderKey(spec)
    && (other!.scale ?? 1) === (spec.scale ?? 1) && (other!.speed ?? 1) === (spec.speed ?? 1)
    && (other!.offsetX ?? 0) === (spec.offsetX ?? 0) && (other!.offsetY ?? 0) === (spec.offsetY ?? 0);
  const existing = records.find((record) => same(record.pixelFx)
    && (!options.position || record.position === options.position) && (!options.scope || record.scope === options.scope));
  if (existing) {
    if (options.name && existing.name !== options.name && existing.name.startsWith("pixelfx ")) existing.name = options.name;
    return existing.id;
  }
  const base = pixelFxAnimationId(spec.effectId);
  let id = base;
  for (let n = 2; records.some((record) => record.id === id); n += 1) id = `${base}_${n}`;
  records.push(normalizeBattleAnimationRecord({
    id,
    name: options.name?.trim() || `pixelfx ${spec.effectId}`,
    scope: options.scope ?? "singleTarget",
    position: options.position ?? "feet",
    pixelFx: spec,
  }));
  return id;
}
