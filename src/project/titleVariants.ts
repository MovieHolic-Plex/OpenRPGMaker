// 타이틀 변형 — 본 엔딩·클리어 수·마지막 저장 맵에 따라 타이틀 배경/음악을 바꾼다.
//
// 판정 입력(클리어 기록의 endingIds, 최근 저장의 mapId)은 플레이어가 저장소에서 읽어 넘긴다.
// 이 파일은 저장소를 모르는 순수 함수만 둔다(newGamePlus.ts 와 같은 경계).
import type { TitleScreenSettings, TitleScreenVariant, TitleScreenVariantWhen } from "@/project/types";

export const TITLE_VARIANT_LIMIT = 8;

export type TitleVariantContext = {
  /** 클리어 기록에 남은 엔딩 id(서로 다름). 없으면 빈 배열. */
  readonly endingIds?: readonly string[];
  /** 가장 최근 저장(수동·자동 중 savedAt 이 늦은 것)의 맵. */
  readonly lastSaveMapId?: string;
};

export function normalizeTitleScreenVariants(value: readonly unknown[] | undefined): TitleScreenVariant[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: TitleScreenVariant[] = [];
  for (const raw of value) {
    if (rows.length >= TITLE_VARIANT_LIMIT) break;
    if (!raw || typeof raw !== "object") continue;
    const record = raw as { when?: unknown; backgroundResourceId?: unknown; musicResourceId?: unknown };
    const when = normalizeTitleVariantWhen(record.when);
    if (!when) continue;
    const backgroundResourceId = cleanId(record.backgroundResourceId);
    const musicResourceId = cleanId(record.musicResourceId);
    rows.push({
      when,
      ...(backgroundResourceId ? { backgroundResourceId } : {}),
      ...(musicResourceId ? { musicResourceId } : {}),
    });
  }
  return rows.length > 0 ? rows : undefined;
}

function normalizeTitleVariantWhen(value: unknown): TitleScreenVariantWhen | undefined {
  if (!value || typeof value !== "object") return undefined;
  const when = value as { kind?: unknown; endingId?: unknown; atLeast?: unknown; mapId?: unknown };
  if (when.kind === "endingSeen") {
    const endingId = cleanId(when.endingId);
    return endingId ? { kind: "endingSeen", endingId } : undefined;
  }
  if (when.kind === "clearCount") {
    const atLeast = typeof when.atLeast === "number" && Number.isFinite(when.atLeast) ? Math.max(1, Math.min(99, Math.trunc(when.atLeast))) : 1;
    return { kind: "clearCount", atLeast };
  }
  if (when.kind === "saveMapId") {
    const mapId = cleanId(when.mapId);
    return mapId ? { kind: "saveMapId", mapId } : undefined;
  }
  return undefined;
}

function cleanId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function titleVariantMatches(when: TitleScreenVariantWhen, context: TitleVariantContext): boolean {
  switch (when.kind) {
    case "endingSeen":
      return (context.endingIds ?? []).includes(when.endingId);
    case "clearCount":
      return new Set(context.endingIds ?? []).size >= when.atLeast;
    case "saveMapId":
      return context.lastSaveMapId === when.mapId;
  }
}

/** 위에서부터 처음 맞는 변형. 없으면 undefined. */
export function resolveTitleVariant(settings: Pick<TitleScreenSettings, "variants">, context: TitleVariantContext): TitleScreenVariant | undefined {
  return (settings.variants ?? []).find((variant) => titleVariantMatches(variant.when, context));
}

/** 변형을 입힌 타이틀 설정(배경·음악만 바뀐다). 맞는 변형이 없으면 원본 그대로 돌려준다. */
export function applyTitleVariant<T extends TitleScreenSettings>(settings: T, context: TitleVariantContext): T {
  const variant = resolveTitleVariant(settings, context);
  if (!variant) return settings;
  return {
    ...settings,
    ...(variant.backgroundResourceId ? { backgroundResourceId: variant.backgroundResourceId } : {}),
    ...(variant.musicResourceId ? { musicResourceId: variant.musicResourceId } : {}),
  };
}
