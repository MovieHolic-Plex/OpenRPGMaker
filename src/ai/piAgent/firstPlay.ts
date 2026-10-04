import type { GameEvent, Project } from '../../project/types';

/** A hard execution boundary, including discovery and unexposed-call fallback. */
export const FIRST_PLAY_TOOLS = [
  'find_tools', 'get_project_summary', 'get_map_region', 'find_events', 'get_event',
  'get_database_records', 'list_npc_graphics', 'list_resources', 'list_endings',
  'run_lint', 'check_reachability', 'find_switch_usage', 'upsert_event', 'place_npc',
  'define_ending', 'upsert_database_utility', 'upsert_actor', 'upsert_item',
  'upsert_enemy', 'upsert_troop', 'upsert_skill', 'upsert_class', 'upsert_common_event',
  'define_monster_species', 'give_starter_monsters', 'set_party',
] as const;

export interface FirstPlayEventRef {
  mapId: string;
  eventId: string;
  role: 'interaction' | 'progression' | 'resolution';
}
export interface FirstPlayReceipt {
  events: FirstPlayEventRef[];
  report: string;
}

export function firstPlayEvents(project: Project, receipt: FirstPlayReceipt): GameEvent[] {
  return receipt.events.map(ref => {
    const event = project.maps[ref.mapId]?.events.find(e => e.id === ref.eventId);
    if (!event) throw new Error(`핵심 이벤트가 없습니다: ${ref.mapId}/${ref.eventId}`);
    return event;
  });
}

function executable(event: GameEvent | undefined): unknown {
  if (!event) return undefined;
  return event.pages?.length ? event.pages.map(page => ({ conditions: page.conditions, trigger: page.trigger, commands: page.commands }))
    : { condition: event.condition, trigger: event.trigger, commands: event.commands };
}

/** Default seed completion, renaming, and empty/identical choices cannot certify authored play. */
export function inspectFirstPlay(base: Project, project: Project, receipt: FirstPlayReceipt): string[] {
  const issues: string[] = [];
  for (const role of ['interaction', 'resolution'] as const) {
    if (!receipt.events.some(ref => ref.role === role)) issues.push(`${role} 이벤트 근거가 없습니다.`);
  }
  for (const ref of receipt.events) {
    const event = project.maps[ref.mapId]?.events.find(e => e.id === ref.eventId);
    if (!event) { issues.push(`이벤트 없음: ${ref.mapId}/${ref.eventId}`); continue; }
    const original = base.maps[ref.mapId]?.events.find(e => e.id === ref.eventId);
    if (ref.role !== 'progression' && JSON.stringify(executable(event)) === JSON.stringify(executable(original))) {
      issues.push(`기본 샘플 명령이 그대로입니다: ${ref.eventId}`);
    }
    const commands = event.pages?.length ? event.pages.flatMap(page => page.commands) : event.commands;
    if (!commands.length) issues.push(`실행 명령이 없습니다: ${ref.eventId}`);
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const record = value as Record<string, unknown>;
      if (record.kind === 'choices') {
        const options = record.options as { text: string; branch: unknown[] }[];
        if (!Array.isArray(options) || options.length < 2 || options.some(option => !option?.text?.trim() || !Array.isArray(option.branch) || !option.branch.length)) {
          issues.push(`선택지/결과가 비어 있습니다: ${ref.eventId}`);
        } else if (new Set(options.map(option => JSON.stringify(option.branch))).size !== options.length) {
          issues.push(`서로 같은 선택 결과가 있습니다: ${ref.eventId}`);
        }
      }
      Object.values(record).forEach(visit);
    };
    visit(commands);
  }
  return issues;
}

export function firstPlaySignature(project: Project, receipt: FirstPlayReceipt): string {
  return JSON.stringify(firstPlayEvents(project, receipt));
}
