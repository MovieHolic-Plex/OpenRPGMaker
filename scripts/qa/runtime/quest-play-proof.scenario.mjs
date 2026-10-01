import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import library from './quest-library.scenario.mjs';

// Replay the already compiled quest events. Filter only the log metadata so the
// three played quests fit in the actual player menu; event pages are unchanged.
const project = JSON.parse(await readFile(library.projectFixture, 'utf8'));
project.quests = project.quests.filter(q => ['delivery', 'escort', 'puzzle_choice'].includes(q.presetId));
const projectFixture = resolve('output/evidence/quest-library/play-proof.json');
await writeFile(projectFixture, JSON.stringify(project));

const key = key => ({ kind: 'key', key });
const visible = testid => ({ kind: 'waitForVisible', testid });
const dismiss = { kind: 'pressUntil', key: 'Enter', testid: 'dialogue-box', state: 'absent', timeoutMs: 250, maxPresses: 20 };
// Finish the current typewriter page through the shipped confirm key, before
// waiting for the window fade. No text injection or artificial completion flags.
const readDialogue = [{ kind: 'waitFor', testid: 'dialogue-box', state: 'present' }, key('Enter'), visible('dialogue-box')];
const textByBeat = {
  'delivery-hand-over': '물건을 잘 받았습니다.',
  'delivery-report': '의뢰 완료! 100G를 받았습니다.',
  'delivery-repeat-report': '고맙습니다.',
  'escort-arrival': '덕분에 무사히 도착했어요.',
  'escort-report': '의뢰 완료! 100G를 받았습니다.',
  'puzzle-wrong-answer': '다시 생각해 보세요.',
  'puzzle-report': '의뢰 완료! 100G를 받았습니다.',
};
const beats = library.beats.map(beat => {
  const expectedText = textByBeat[beat.id];
  if (!expectedText) return { ...beat };
  const ops = beat.ops.flatMap(op => op.kind === 'waitForVisible' && op.testid === 'dialogue-box' ? readDialogue : [op]);
  return { ...beat, ops, shot: true, expect: { ...beat.expect, visibleText: { 'dialogue-box': expectedText } } };
});
// Keep the actual clue and correct-answer dialogues visible before dismissing.
for (const [id, expectedText] of [['puzzle-clue', '표식에는 푸른색이라고 적혀 있다.'], ['puzzle-correct-answer', '정답입니다.']]) {
  const index = beats.findIndex(beat => beat.id === id);
  const beat = beats[index];
  beats[index] = { ...beat, id: `${id}-dialogue`, ops: beat.ops.slice(0, -1).flatMap(op => op.kind === 'waitForVisible' && op.testid === 'dialogue-box' ? readDialogue : [op]), expect: { gold: 200, visibleText: { 'dialogue-box': expectedText } }, shot: true };
  beats.splice(index + 1, 0, { ...beat, ops: [dismiss], shot: false });
}
beats.push({
  id: 'reward-total', note: '실제 게임 메뉴에 표시된 누적 보상 300G',
  ops: [dismiss, key('Escape'), visible('status-menu-gold')],
  expect: { gold: 300, visibleText: { 'status-menu-gold': '300' }, switches: { sw_library_delivery_done: true, sw_library_escort_done: true, sw_library_puzzle_choice_done: true } }, shot: true,
});
beats.push({
  id: 'delivery-quest-log', note: '게임 의뢰 목록의 배달 완료 상태',
  ops: [
    { kind: 'key', key: 'ArrowDown', times: 4 }, key('Enter'), visible('status-menu-group-command-quests'),
    key('ArrowDown'), key('Enter'), visible('status-menu-quest-state-library_delivery')],
  expect: { gold: 300, visibleText: {
    'status-menu-quest-state-library_delivery': '완료 (1/1)',
  }, switches: { sw_library_delivery_done: true, sw_library_escort_done: true, sw_library_puzzle_choice_done: true } }, shot: true,
});
beats.push({ id: 'escort-quest-log', note: '목록을 실제 키로 내려 동행 완료 상태 확인', ops: [key('ArrowDown'), visible('status-menu-quest-state-library_escort')], expect: { gold: 300, visibleText: { 'status-menu-quest-state-library_escort': '완료 (1/1)' } }, shot: true });
beats.push({ id: 'puzzle-quest-log', note: '목록을 실제 키로 내려 수수께끼의 두 단계 완료 상태 확인', ops: [key('ArrowDown'), key('ArrowDown'), visible('status-menu-quest-state-library_puzzle_choice')], expect: { gold: 300, visibleText: { 'status-menu-quest-state-library_puzzle_choice': '완료 (2/2)' } }, shot: true });
export default { ...library, id: 'quest-play-proof', projectFixture, beats };
