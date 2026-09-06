export function npcMoveDurationMs(speed: number): number {
  const rank = clampSetting(speed);
  return Math.max(80, 640 - rank * 80);
}

export function npcMoveIntervalMs(frequency: number): number {
  const rank = clampSetting(frequency);
  return Math.max(80, 1040 - rank * 160);
}

export function clampSetting(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}
