import type {
  BattleAnimationCell,
  BattleAnimationFlash,
  BattleAnimationFrame,
  BattleAnimationPosition,
  BattleAnimationRecord,
  BattleAnimationScope,
  BattleAnimationScreenShake,
  BattleAnimationSheet,
  BattleAnimationTiming,
  BattleAnimationTone,
} from "@/project/types";

const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
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
  };
}

function normalizeAnimationSheet(sheet: Partial<BattleAnimationSheet> | undefined): BattleAnimationSheet {
  return {
    frameWidth: clampInteger(sheet?.frameWidth ?? DEFAULT_ANIMATION_SHEET.frameWidth, 1, 640),
    frameHeight: clampInteger(sheet?.frameHeight ?? DEFAULT_ANIMATION_SHEET.frameHeight, 1, 640),
    columns: clampInteger(sheet?.columns ?? DEFAULT_ANIMATION_SHEET.columns, 1, 20),
  };
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
