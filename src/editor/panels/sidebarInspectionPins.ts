import { getEditorUiMode, type EditorUiMode } from '@/editor/editorUiMode';
import { createLogger } from '@/util/logger';

export const INSPECTION_COMMANDS = ['inspector', 'ruleAudit', 'history'] as const;
export type InspectionCommand = typeof INSPECTION_COMMANDS[number];
export const SIDEBAR_PINS_KEY = 'oprn:sidebar-inspection-pins:';
const sessionPins = new Map<EditorUiMode, readonly InspectionCommand[]>();
const log = createLogger('sidebar-pins');

export function inspectionPins(): readonly InspectionCommand[] {
  const mode = getEditorUiMode();
  const cached = sessionPins.get(mode);
  if (cached) return cached;
  let pins: readonly InspectionCommand[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SIDEBAR_PINS_KEY + mode) ?? '[]');
    if (Array.isArray(parsed)) pins = INSPECTION_COMMANDS.filter(id => parsed.includes(id));
  } catch (error) {
    log.warn('Sidebar pins could not be loaded; using session defaults', { error });
  }
  sessionPins.set(mode, pins);
  return pins;
}

export function toggleInspectionPin(id: InspectionCommand): void {
  const current = inspectionPins();
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  const mode = getEditorUiMode();
  sessionPins.set(mode, next);
  try {
    localStorage.setItem(SIDEBAR_PINS_KEY + mode, JSON.stringify(next));
  } catch (error) {
    log.warn('Sidebar pins are remembered for this session only', { error });
  }
}

export function resetInspectionPinsForTests(): void { sessionPins.clear(); }
