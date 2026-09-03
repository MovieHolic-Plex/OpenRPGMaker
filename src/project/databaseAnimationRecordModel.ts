import type {
  BattleAnimationCell,
  BattleAnimationFlash,
  BattleAnimationFollowUp,
  BattleAnimationFrame,
  BattleAnimationPosition,
  BattleAnimationRecord,
  BattleAnimationScope,
  BattleAnimationScreenShake,
  BattleAnimationSheet,
  BattleAnimationTiming,
  BattleAnimationTone,
} from "@/project/types";

const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5, assetScale: 2 };
/** 시트 배율 허용 범위. 0.125 = 1536px 시트가 192 논리 px, 8 = 24px 시트가 192 논리 px. */
const MIN_ASSET_SCALE = 0.125;
const MAX_ASSET_SCALE = 8;
const DEFAULT_ANIMATION_TONE: BattleAnimationTone = { red: 255, green: 255, blue: 255, gray: 0 };

export function normalizeBattleAnimationRecord(record: Partial<BattleAnimationRecord> & Pick<BattleAnimationRecord, "id" | "name">): BattleAnimationRecord {
  return {
    id: record.id,
    name: record.name,
    resourceId: cleanOptionalId(record.resourceId),
    sheet: normalizeAnimationSheet(record.sheet),
    scope: isBattleAnimationScope(record.scope) ? record.scope : "singleTarget",
    position: isBattleAnimationPosition(record.position) ? record.position : "center",
    large: record.large ?? false,
    frames: normalizeAnimationFrames(record.frames),
    timings: normalizeAnimationTimings(record.timings),
    followUps: normalizeFollowUps(record.id, record.followUps),
  };
}

/** 자기 자신·빈 id 는 버린다(자기 참조는 무한 사슬). startFrame 은 0 이상 정수. */
function normalizeFollowUps(selfId: string, followUps: readonly Partial<BattleAnimationFollowUp>[] | undefined): BattleAnimationFollowUp[] {
  return (followUps ?? []).flatMap((entry) => {
    const animationId = cleanOptionalId(entry.animationId);
    if (!animationId || animationId === selfId) return [];
    return [{ animationId, startFrame: clampInteger(entry.startFrame ?? 0, 0, 999) }];
  });
}

function normalizeAnimationSheet(sheet: Partial<BattleAnimationSheet> | undefined): BattleAnimationSheet {
  return {
    frameWidth: clampInteger(sheet?.frameWidth ?? DEFAULT_ANIMATION_SHEET.frameWidth, 1, 640),
    frameHeight: clampInteger(sheet?.frameHeight ?? DEFAULT_ANIMATION_SHEET.frameHeight, 1, 640),
    columns: clampInteger(sheet?.columns ?? DEFAULT_ANIMATION_SHEET.columns, 1, 20),
    assetScale: normalizeAssetScale(sheet?.assetScale),
  };
}

/** 없거나 수가 아니면 320 시대 기본값(2). 있으면 범위 안으로 접는다 — 소수를 보존해야 하므로 정수 clamp 를 쓰지 않는다. */
function normalizeAssetScale(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return DEFAULT_ANIMATION_SHEET.assetScale!;
  return Math.min(MAX_ASSET_SCALE, Math.max(MIN_ASSET_SCALE, value));
}

function normalizeAnimationFrames(frames: readonly Partial<BattleAnimationFrame>[] | undefined): BattleAnimationFrame[] {
  const source = frames?.length ? frames : [{ cells: [defaultAnimationCell()] }];
  return source.map((frame) => ({ cells: normalizeAnimationCells(frame.cells) }));
}

function normalizeAnimationCells(cells: readonly Partial<BattleAnimationCell>[] | undefined): BattleAnimationCell[] {
  const source = cells?.length ? cells : [defaultAnimationCell()];
  return source.map((cell) => ({
    pattern: clampInteger(cell.pattern ?? 0, 0, 999),
    x: clampInteger(cell.x ?? 0, -999, 999),
    y: clampInteger(cell.y ?? 0, -999, 999),
    zoom: clampInteger(cell.zoom ?? 100, 1, 800),
    opacity: clampInteger(cell.opacity ?? 255, 0, 255),
    visible: cell.visible ?? true,
    tone: cell.tone ? normalizeAnimationTone(cell.tone) : undefined,
  }));
}

function normalizeAnimationTimings(timings: readonly Partial<BattleAnimationTiming>[] | undefined): BattleAnimationTiming[] {
  return (timings ?? []).map((timing) => ({
    frameIndex: clampInteger(timing.frameIndex ?? 0, 0, 999),
    soundResourceId: cleanOptionalId(timing.soundResourceId),
    flash: normalizeAnimationFlash(timing.flash),
    screenShake: normalizeAnimationScreenShake(timing.screenShake),
  }));
}

function normalizeAnimationFlash(flash: Partial<BattleAnimationFlash> | undefined): BattleAnimationFlash | undefined {
  if (!flash) return undefined;
  return {
    target: flash.target === "screen" ? "screen" : "target",
    color: normalizeAnimationTone(flash.color),
    durationFrames: clampInteger(flash.durationFrames ?? 4, 1, 999),
  };
}

function normalizeAnimationScreenShake(shake: Partial<BattleAnimationScreenShake> | undefined): BattleAnimationScreenShake | undefined {
  if (!shake) return undefined;
  return {
    power: clampInteger(shake.power ?? 3, 1, 9),
    speed: clampInteger(shake.speed ?? 5, 1, 9),
    durationFrames: clampInteger(shake.durationFrames ?? 8, 1, 999),
  };
}

function normalizeAnimationTone(tone: Partial<BattleAnimationTone> | undefined): BattleAnimationTone {
  return {
    red: clampInteger(tone?.red ?? DEFAULT_ANIMATION_TONE.red, 0, 255),
    green: clampInteger(tone?.green ?? DEFAULT_ANIMATION_TONE.green, 0, 255),
    blue: clampInteger(tone?.blue ?? DEFAULT_ANIMATION_TONE.blue, 0, 255),
    gray: clampInteger(tone?.gray ?? DEFAULT_ANIMATION_TONE.gray, 0, 255),
  };
}

function defaultAnimationCell(): BattleAnimationCell {
  return { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true };
}

function cleanOptionalId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isBattleAnimationScope(value: unknown): value is BattleAnimationScope {
  return value === "singleTarget" || value === "allTargets" || value === "screen";
}

function isBattleAnimationPosition(value: unknown): value is BattleAnimationPosition {
  return value === "head" || value === "center" || value === "feet" || value === "screen";
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
