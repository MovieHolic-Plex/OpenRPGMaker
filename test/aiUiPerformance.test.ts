import { Window } from 'happy-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createActivityTrace, recordActivityEvent } from '@/ai/activityTrace';
import { createActivityView } from '@/editor/panels/aiActivityView';
import { setActivityLevel } from '@/editor/panels/aiActivityPreference';
import { createTeamBoardState, reduceTeamBoard } from '@/ai/piAgent/teamBoardState';
import { createTeamTranscript } from '@/editor/panels/aiTeamTranscript';
import { createTeamWorkPane } from '@/editor/panels/aiTeamWorkPane';
import { createTeamBoard } from '@/editor/panels/aiTeamBoard';
import { createAiTeamSidebar } from '@/editor/panels/aiTeamSidebar';
import { createStudioShell } from '@/editor/panels/aiStudioShell';
import { publishTeamActivity } from '@/ai/piAgent/teamActivity';
import { createConversationLogHost } from '@/editor/panels/aiConversationLog';
import { activityEntryIndex } from '@/editor/panels/aiActivityIndex';
import { attachImage, releaseDetachedActivityImages } from '@/editor/panels/aiActivityMedia';
let window: Window;
beforeEach(() => {
  window = new Window();
  // A real window supplies add/removeEventListener for studio/modal lifecycle hooks.
  vi.stubGlobal('window', window);
  for (const key of ['document', 'Node', 'Element', 'HTMLElement', 'HTMLDetailsElement', 'Event', 'localStorage', 'MutationObserver'] as const) vi.stubGlobal(key, window[key]);
  setActivityLevel('brief');
});
afterEach(() => { publishTeamActivity(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function team() {
  let state = createTeamBoardState('team', '마을');
  for (let i = 0; i < 6; i++) state = reduceTeamBoard(state, { type: 'agent_spawn', agentId: 'a' + i, role: 'builder', mapId: 'm' + i, mapName: '장소' + i, task: '배정' + i, label: '팀원' + i });
  return state;
}
it('rolls a capped transcript without moving survivors and replaces only a completed tool', () => {
  const tx = createTeamTranscript(); document.body.append(tx.root);
  const rows = Array.from({ length: 200 }, (_, i) => ({ kind: 'tool' as const, id: 't' + i, name: 'paint_tiles', ok: null, summary: '' }));
  let agent = { ...team().agents[0]!, log: rows, droppedLog: 1 }; tx.update(agent);
  const list = tx.root.querySelector('.ai-team-tx-list')!;
  const survivor = list.children[1], unchanged = list.children[5];
  const inserts = vi.spyOn(list, 'insertBefore');
  agent = { ...agent, droppedLog: 2, log: [...rows.slice(1), { ...rows[0]!, id: 'next' }] }; tx.update(agent);
  expect(list.children).toHaveLength(200); expect(list.children[0]).toBe(survivor); expect(inserts).toHaveBeenCalledTimes(1);
  tx.update({ ...agent, log: agent.log.map((row, i) => i === 0 ? { ...row, ok: true, summary: '완료' } : row) });
  expect(list.children[0]).not.toBe(survivor); expect(list.children[4]).toBe(unchanged);
  expect(list.children[0]?.getAttribute('data-state')).toBe('ok'); expect(tx.root.textContent).toContain('이전 2행');
});
it('skips hidden transcript work and catches up when the fallback becomes visible', () => {
  const pane = createTeamWorkPane(), state = team(); pane.update(state);
  expect(pane.root.querySelector('.ai-team-tx-list')!.children).toHaveLength(0);
  const members = [...pane.root.querySelectorAll('.ai-team-work-member')]; pane.update({ ...state, report: '완료 보고' });
  expect([...pane.root.querySelectorAll('.ai-team-work-member')]).toEqual(members);
  pane.update({ ...state, trace: undefined }); expect(pane.root.querySelector('.ai-team-tx-task')?.textContent).toContain('배정5');
});
it('retains detached studio state and renders once when attached or updated', () => {
  const shell = createStudioShell({ onExit() {}, onFontZoom() {} });
  try {
    const state = team(); const create = vi.spyOn(document, 'createElement');
    publishTeamActivity(state); expect(create).not.toHaveBeenCalled(); create.mockRestore();
    const host = document.createElement('div'), log = document.createElement('div'), bar = document.createElement('div'); host.append(log, bar); document.body.append(host);
    shell.attach(host, { historyLogMount: log, commandBar: bar });
    expect(shell.root.querySelectorAll('[data-testid=lane-team-row]')).toHaveLength(6);
    (shell.root.querySelector('[data-testid=lane-team-row]') as HTMLElement).click();
    const work = shell.root.querySelector('[data-testid=ai-team-work]')!;
    const mutation = vi.spyOn(work, 'setAttribute'); publishTeamActivity({ ...state, report: '마지막 보고' });
    expect(work.textContent).toContain('마지막 보고');
    expect(mutation.mock.calls.filter(([key]) => key === 'data-phase')).toHaveLength(1);
    shell.detach(); publishTeamActivity({ ...state, report: '떨어진 뒤 보고' }); shell.attach(host, { historyLogMount: log, commandBar: bar });
    expect(work.textContent).toContain('떨어진 뒤 보고');
  } finally { shell.dispose(); }
});
it('retains member button identity and focus during text updates', () => {
  const sidebar = createAiTeamSidebar({ settings: document.createElement('div') }); document.body.append(sidebar.root);
  try {
    const state = team(); publishTeamActivity(state);
    const rows = [...sidebar.root.querySelectorAll<HTMLElement>('.ai-team-member')]; rows[0]!.focus();
    publishTeamActivity(reduceTeamBoard(state, { type: 'agent_event', agentId: 'a0', event: { type: 'execution_status', name: 'work.progress', summary: '새 진행' } }));
    expect(sidebar.root.querySelectorAll('.ai-team-member')[0]).toBe(rows[0]); expect(document.activeElement).toBe(rows[0]);
    expect(sidebar.root.querySelectorAll('.ai-team-member')[2]).toBe(rows[2]);
    expect(rows[0]!.textContent).toContain('새 진행');
  } finally { sidebar.dispose(); }
});
it('shares the media index without retaining pictures of entries dropped from a rolling trace', () => {
  const visual = { id: 'v', kind: 'map' as const, phase: 'draft' as const, title: '맵', target: 'm' };
  const trace = { ...createActivityTrace('test'), entries: [{ id: 'a', actor: 'a', kind: 'tool', name: 'paint_tiles', status: 'ok' as const, at: 1, summary: 'done', visuals: [visual] }] };
  const index = activityEntryIndex(trace); expect(activityEntryIndex({ ...trace })).toBe(index); expect(index.mediaByActor.get('a')).toEqual([visual]);
  expect(activityEntryIndex({ ...trace, entries: [] }).mediaByActor.has('a')).toBe(false);
});
it('preserves search, pagination, actor switching and unchanged rows', () => {
  setActivityLevel('trace'); const view = createActivityView({ archive: false }); document.body.append(view.root);
  let trace = createActivityTrace('test'); for (let i = 0; i < 110; i++) trace = recordActivityEvent(trace, { type: 'tool_end', id: 't' + i, name: 'get_event', ok: i % 3 !== 0, summary: '항목' + i }, i % 2 ? 'a' : 'b');
  view.update(trace); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(50);
  const last = view.root.querySelector('.ai-activity-entries')!.lastElementChild; view.update(trace); expect(view.root.querySelector('.ai-activity-entries')!.lastElementChild).toBe(last);
  [...view.root.querySelectorAll('button')].find(b => b.textContent === '이전 기록 50건 더 보기')!.click(); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(100);
  view.update(trace, 'a'); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(50);
  const input = view.root.querySelector('input')!; input.value = '항목109'; input.dispatchEvent(new Event('input')); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(1);
});
it('restores 200 messages with one height read and still scrolls a live append', () => {
  const log = document.createElement('div'); let reads = 0; Object.defineProperty(log, 'scrollHeight', { get() { reads++; return 900; } });
  const host = createConversationLogHost({ log, removeStartScreen() {} });
  host.renderConversationEntries(Array.from({ length: 200 }, (_, i) => ({ kind: 'assistant', text: '대답' + i, at: '2026-09-28' })));
  expect(reads).toBe(1); expect(log.querySelectorAll('.ai-command-row')).toHaveLength(200); expect(log.scrollTop).toBe(900);
  host.appendBubble('assistant', '다음'); expect(reads).toBe(2);
});
it('does not construct permanently hidden legacy board rows', () => {
  const state = team(), board = createTeamBoard(state); document.body.append(board.root); board.update(state);
  expect(board.root.querySelectorAll('.ai-team-agent')).toHaveLength(0); expect(board.root.querySelectorAll('.ai-activity-entry').length).toBeGreaterThan(0);
});
it('inspects only changed media subtrees and preserves images moved within the document', async () => {
  const RealURL = URL, revoke = vi.fn(); vi.stubGlobal('URL', Object.assign(class extends RealURL {}, { createObjectURL: () => 'blob:http://localhost/test', revokeObjectURL: revoke }));
  const surface = document.createElement('div'); document.body.append(surface); attachImage(surface, new Blob(['x']), 'picture');
  const image = surface.querySelector('img')!; let reads = 0;
  Object.defineProperty(image, 'isConnected', { get() { reads++; return document.body.contains(image); } }); Object.defineProperty(image, 'complete', { get() { return true; } });
  await new Promise(resolve => setTimeout(resolve, 5)); reads = 0;
  const text = document.createTextNode('unrelated'); document.body.append(text); text.remove(); await new Promise(resolve => setTimeout(resolve, 5)); expect(reads).toBe(0);
  surface.remove(); document.body.append(surface); await new Promise(resolve => setTimeout(resolve, 5)); expect(revoke).not.toHaveBeenCalled();
  surface.remove(); await new Promise(resolve => setTimeout(resolve, 5)); expect(revoke).toHaveBeenCalledOnce(); releaseDetachedActivityImages();
});
