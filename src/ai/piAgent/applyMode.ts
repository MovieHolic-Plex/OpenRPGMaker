/** User approval policy; independent of model/effort/team selection. */
export const PI_APPLY_MODES = [
  { id: "yolo", label: "YOLO", description: "검수·승인 없이 가능한 변경을 즉시 반영합니다." },
  { id: "auto", label: "AUTO MODE", description: "실시간 반영 후 AI가 검수·수정합니다. 해결하지 못한 문제는 보고합니다." },
  { id: "default", label: "DEFAULT", description: "실시간 반영하되 대규모 삭제와 작업 문제는 확인합니다." },
  { id: "review", label: "검토 후 적용", description: "전체 초안을 확인하고 한 번에 적용합니다." },
  { id: "step", label: "단계별 적용", description: "의미 있는 작업 단계마다 확인·적용한 뒤 이어갑니다." },
] as const;
export type PiApplyMode = typeof PI_APPLY_MODES[number]["id"];
export const DEFAULT_PI_APPLY: PiApplyMode = "default";
export function normalizePiApplyMode(value: unknown): PiApplyMode {
  return PI_APPLY_MODES.some(mode => mode.id === value) ? value as PiApplyMode : DEFAULT_PI_APPLY;
}
export function isLiveApplyMode(mode: PiApplyMode): boolean {
  return mode === "yolo" || mode === "auto" || mode === "default";
}
