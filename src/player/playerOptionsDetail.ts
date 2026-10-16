import { getAudioEngine } from '@/player/audio';
import { getEffectiveReadingPreferences, getPlayerPreferences, setAuthoredPreferenceDefaults, updatePlayerPreferences, type PlayerPreferences } from '@/player/playerPreferences';
import { dialogueUiText } from '@/player/dialogueUiStrings';
import { resolveDialogueSystem, type DialogueSpeed } from '@/project/dialogueSystem';
import type { StatusMenuDetail, StatusMenuDetailEntry } from '@/player/playerStatusMenuDetailTypes';
import type { Project } from '@/project/types';

const NEXT_SPEED: Record<DialogueSpeed, DialogueSpeed> = { normal: 'fast', fast: 'slow', slow: 'normal' };
const OPACITY_STEPS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4] as const;

/**
 * 설정 화면. project 를 주고 그 게임에 대사 시스템(meta.oprnDialogueSystem·연애 기본 구성)이 있으면 오토 속도·스킵 범위·대사창 투명도가 더해지고
 * 글자가 저작한 언어로 나온다. 없으면 예전 화면 그대로다(옛 프로젝트 불변).
 */
export function createPlayerOptionsDetail(onChanged?: (message?: string) => void, project?: Project): StatusMenuDetail {
  const system = resolveDialogueSystem(project);
  setAuthoredPreferenceDefaults(system?.defaults);
  const text = (key: Parameters<typeof dialogueUiText>[1]) => dialogueUiText(system, key);
  const prefs = getPlayerPreferences();
  const effective = getEffectiveReadingPreferences(system?.defaults, prefs);
  const change = (patch: Partial<PlayerPreferences>) => {
    const saved = updatePlayerPreferences(patch);
    const next = getPlayerPreferences();
    const audio = getAudioEngine();
    audio.setVolume('bgm', next.bgm);
    audio.setVolume('se', next.se);
    onChanged?.(saved ? text('option.saved') : text('option.savedSession'));
  };
  const groupLabel = { bgm: text('option.bgm'), se: text('option.se'), voice: text('option.voice') } as const;
  const speedLabel = (speed: DialogueSpeed) => text(`value.${speed}`);
  const entries: StatusMenuDetailEntry[] = (['bgm', 'se', 'voice'] as const).flatMap(group =>
    ([-1, 1] as const).map(delta => ({
      label: `${groupLabel[group]} ${delta < 0 ? text('option.down') : text('option.up')}`,
      value: `${Math.round(prefs[group] * 100)}%`,
      description: text('option.volumeHint'),
      testId: `player-option-${group}-${delta < 0 ? 'down' : 'up'}`,
      onActivate: () => change({ [group]: Math.round((prefs[group] + delta * 0.1) * 10) / 10 }),
    })));
  entries.push({
    label: text('option.textSpeed'), value: speedLabel(effective.textSpeed),
    description: text('option.textSpeedHint'), testId: 'player-option-text-speed',
    onActivate: () => change({ textSpeed: NEXT_SPEED[effective.textSpeed] }),
  });
  if (system?.auto.enabled) {
    entries.push({
      label: text('option.autoSpeed'), value: speedLabel(effective.autoSpeed),
      description: text('option.autoSpeedHint'), testId: 'player-option-auto-speed',
      onActivate: () => change({ autoSpeed: NEXT_SPEED[effective.autoSpeed] }),
    });
  }
  if (system?.skip.enabled) {
    entries.push({
      label: text('option.skipScope'), value: effective.skipScope === 'read' ? text('value.scopeRead') : text('value.scopeAll'),
      description: text('option.skipScopeHint'), testId: 'player-option-skip-scope',
      onActivate: () => change({ skipScope: effective.skipScope === 'read' ? 'all' : 'read' }),
    });
  }
  if (system) {
    const index = OPACITY_STEPS.findIndex(step => Math.abs(step - effective.windowOpacity) < 0.05);
    entries.push({
      label: text('option.windowOpacity'), value: `${Math.round(effective.windowOpacity * 100)}%`,
      description: text('option.windowOpacityHint'), testId: 'player-option-window-opacity',
      onActivate: () => change({ windowOpacity: OPACITY_STEPS[(Math.max(0, index) + 1) % OPACITY_STEPS.length] }),
    });
  }
  entries.push({
    label: text('option.menuMotion'), value: prefs.reduceMenuMotion ? text('value.on') : text('value.off'),
    description: text('option.menuMotionHint'),
    testId: 'player-option-menu-motion', onActivate: () => change({ reduceMenuMotion: !prefs.reduceMenuMotion }),
  });
  return { title: text('option.title'), entries, hint: text('option.footer') };
}
