import { createLogger } from '@/util/logger';

export const INSPECTION_COMMANDS = ['inspector', 'ruleAudit', 'history'] as const;
export type InspectionCommand = typeof INSPECTION_COMMANDS[number];
// 핀은 모드별이 아니라 사용자별 하나 — 표준/전문가 capability를 합치면서
// 모드 키(`:<mode>`)를 떼었다. 기존 모드별 값은 읽지 않고 버린다(핀은 재고정 가능).
export const SIDEBAR_PINS_KEY = 'oprn:sidebar-inspection-pins';
let sessionPins: readonly InspectionCommand[] | null = null;
const log = createLogger('sidebar-pins');

export function inspectionPins(): readonly InspectionCommand[] {
  if (sessionPins) return sessionPins;
  let pins: readonly InspectionCommand[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY) ?? '[]');
    if (Array.isArray(parsed)) pins = INSPECTION_COMMANDS.filter(id => parsed.includes(id));
  } catch (error) {
    log.warn('Sidebar pins could not be loaded; using session defaults', { error });
  }
  sessionPins = pins;
  return pins;
}

export function toggleInspectionPin(id: InspectionCommand): void {
  const current = inspectionPins();
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  sessionPins = next;
  try {
    localStorage.setItem(SIDEBAR_PINS_KEY, JSON.stringify(next));
  } catch (error) {
    log.warn('Sidebar pins are remembered for this session only', { error });
  }
}

export function resetInspectionPinsForTests(): void { sessionPins = null; }
