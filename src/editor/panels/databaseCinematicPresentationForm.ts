import { resolveCinematicPresentation, type CinematicPresentation, CINEMATIC_PRESENTATION_PRESETS } from '@/project/cinematicPresentation';
import type { DatabaseCinematicActions } from './databaseCinematicActions';
import { field } from './databaseControls';
import { el } from '@/util/dom';

/** Each event reads the latest record, preserving changes made by other controls. */
export function cinematicPresentationForm(options: {
  id: string; actions: DatabaseCinematicActions; usable: () => boolean; redraw: () => void;
}): HTMLElement {
  const { id, actions, usable, redraw } = options;
  const current = (): CinematicPresentation | undefined => actions.read()?.scenes.find(scene => scene.id === id)?.presentation;
  const value = current();
  const resolved = resolveCinematicPresentation(value ?? {});
  const content = el('div', { class: 'db-cinematic-presentation' });
  const patch = (group: 'text' | 'transition' | undefined, key: string, next: string | number): void => {
    if (!usable()) return;
    const saved = current() ?? { preset: 'subtitle' };
    actions.setPresentation(id, group ? { ...saved, [group]: { ...saved[group], [key]: next } } : { ...saved, [key]: next });
  };
  const select = (key: string, label: string, entries: readonly (readonly [string, string])[], selected: string, change: (value: string) => void): void => {
    const input = el('select', { dataset: { testid: `db-cinematic-${key}` }, children: entries.map(([value, text]) => el('option', { attrs: { value }, text })) });
    input.value = selected;
    input.addEventListener('change', () => { if (usable()) change(input.value); });
    content.append(field(label, input));
  };
  const names = { subtitle: '영화 자막', prologue: '서문 · 한 글자씩', chapter: '챕터 카드', memory: '회상 · 흐림에서 선명하게', credits: '크레딧 · 위로 흐르기' };
  select('presentation-preset', '연출 기본형', [['', '기존 연출'], ...CINEMATIC_PRESENTATION_PRESETS.map(key => [key, names[key]] as const)], value?.preset ?? (value ? 'subtitle' : ''), next => {
    actions.setPresentation(id, next ? { preset: next as CinematicPresentation['preset'] } : undefined);
    redraw();
  });
  if (!value) return content;
  select('text-animation', '글자 등장', [['none', '바로 표시'], ['fade', '페이드인'], ['rise', '아래에서 올라오기'], ['typewriter', '한 글자씩'], ['blur', '흐림에서 선명하게'], ['scroll', '위로 흐르기']], resolved.text.animation, next => patch('text', 'animation', next));
  select('text-layout', '글자 위치', [['center', '가운데'], ['bottom', '하단 자막'], ['left', '왼쪽 서문'], ['credits', '크레딧']], resolved.text.layout, next => patch('text', 'layout', next));
  select('text-font', '글꼴', [['serif', '명조'], ['sans', '고딕'], ['pixel', '도트']], resolved.text.font, next => patch('text', 'font', next));
  select('scene-enter', '장면 등장', [['cut', '바로 전환'], ['fade', '페이드인'], ['dissolve', '디졸브'], ['wipe', '왼쪽에서 열기'], ['iris', '원형으로 열기'], ['flash', '섬광']], resolved.transition.enter, next => patch('transition', 'enter', next));
  const number = (group: 'text' | 'transition' | undefined, key: string, label: string, saved: number, min: number, max: number): void => {
    const input = el('input', { attrs: { type: 'number', min: String(min), max: String(max), step: '1' }, value: saved, dataset: { testid: `db-cinematic-${group ?? 'scene'}-${key}` } });
    input.addEventListener('change', () => {
      if (input.value === '') return;
      const next = Number(input.value);
      if (Number.isSafeInteger(next) && next >= min && next <= max) patch(group, key, next);
      else input.value = String(saved);
    });
    content.append(field(label, input));
  };
  number('text', 'size', '글자 크기 (무대 px)', resolved.text.size, 8, 64);
  number('text', 'delayMs', '글자 등장 대기 (ms)', resolved.text.delayMs, 0, 10000);
  number('text', 'revealMs', '글자 등장 시간 (ms)', resolved.text.revealMs, 0, 10000);
  number('text', 'exitMs', '글자 페이드아웃 (ms)', resolved.text.exitMs, 0, 10000);
  number('transition', 'enterMs', '장면 등장 시간 (ms)', resolved.transition.enterMs, 0, 5000);
  number('transition', 'exitMs', '장면 페이드아웃 (ms)', resolved.transition.exitMs, 0, 5000);
  number(undefined, 'letterbox', '상하 검은 띠 (%)', resolved.letterbox, 0, 20);
  for (const [group, key, label, saved] of [['text', 'color', '글자 색', resolved.text.color], [undefined, 'backgroundColor', '배경 색', resolved.backgroundColor]] as const) {
    const input = el('input', { attrs: { type: 'color' }, value: saved, dataset: { testid: `db-cinematic-${key}` } });
    input.addEventListener('change', () => patch(group, key, input.value));
    content.append(field(label, input));
  }
  content.append(el('p', { class: 'db-cinematic-note', text: '등장·퇴장 시간은 장면 시간 안에 포함됩니다. 0ms 장면은 확인 입력을 기다립니다. 기본형을 바꾸면 글자·전환 세부 설정이 초기화됩니다.' }));
  return content;
}
