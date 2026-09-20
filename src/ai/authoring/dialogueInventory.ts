import type { Command, Project } from '@/project/types';
import { nestedCommandLists } from '@/project/authoredCommandIndex';

export interface DialogueRow {
  id: string;
  mapId: string;
  eventId: string;
  pageId: string;
  location: string;
  path: string;
  speaker: string;
  kind: 'text' | 'prompt' | 'choice';
  text: string;
}
/** Only canonical pages, never the legacy event.commands mirror when pages exist. */
export function collectDialogue(project: Project): DialogueRow[] {
  const rows: DialogueRow[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events) {
    const pages = event.pages?.length ? event.pages : [{ id: '', name: '기본', commands: event.commands }];
    for (const [pageIndex, page] of pages.entries()) {
      const location = `${map.name} / ${event.name} / ${pageIndex + 1}. ${page.name ?? page.id}`;
      const add = (path: string, kind: DialogueRow['kind'], text: string, speaker = '') => rows.push({
        id: JSON.stringify([map.id, event.id, page.id, path]), mapId: map.id, eventId: event.id, pageId: page.id,
        location, path, speaker, kind, text,
      });
      const walk = (commands: readonly Command[], prefix: string): void => {
        commands.forEach((command, index) => {
          const path = `${prefix}${index + 1}`;
          if (command.kind === 'text') add(path, 'text', command.body, command.speaker ?? '');
          if (command.kind === 'choices') {
            if (command.prompt !== undefined) add(`${path}.prompt`, 'prompt', command.prompt);
            command.options.forEach((option, i) => add(`${path}.option${i + 1}`, 'choice', option.text));
          }
          nestedCommandLists(command).forEach((branch, branchIndex) => walk(branch, `${path}.branch${branchIndex + 1}.`));
        });
      };
      walk(page.commands ?? [], '');
    }
  }
  return rows;
}
export interface DialogueFinding { rowId: string; quote: string; message: string; source: 'structure' | 'llm' }
export function checkDialogueStructure(rows: readonly DialogueRow[], maxChars: number): DialogueFinding[] {
  return rows.flatMap(row => {
    const messages: string[] = [];
    if (!row.text.trim()) messages.push('비어 있는 대사/선택지입니다.');
    if ([...row.text].length > maxChars) messages.push(`설정한 ${maxChars}자 기준을 초과했습니다 (${[...row.text].length}자).`);
    if (row.text !== row.text.trim()) messages.push('앞뒤에 공백이 있습니다.');
    return messages.map(message => ({ rowId: row.id, quote: row.text, message, source: 'structure' as const }));
  });
}
/** A model finding is displayed only when its source id and exact nonempty quote match. */
export function parseDialogueFindings(text: string, rows: readonly DialogueRow[]): DialogueFinding[] {
  const data: unknown = JSON.parse(text.replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, ''));
  if (!data || typeof data !== 'object' || !Array.isArray((data as { findings?: unknown }).findings)) throw new Error('LLM 검토 응답에 findings 배열이 없습니다.');
  return (data as { findings: unknown[] }).findings.map(value => {
    const item = value as Record<string, unknown> | null;
    const row = rows.find(row => row.id === item?.rowId);
    if (!row || typeof item?.quote !== 'string' || !item.quote || !row.text.includes(item.quote)
      || typeof item.message !== 'string' || !item.message.trim()) throw new Error('LLM 검토 응답의 원문 인용 또는 출처가 일치하지 않습니다. 다시 검토하세요.');
    return { rowId: row.id, quote: item.quote, message: item.message, source: 'llm' as const };
  });
}
