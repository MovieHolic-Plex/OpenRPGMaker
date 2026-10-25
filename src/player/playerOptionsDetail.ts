import { getAudioEngine } from '@/player/audio';
import { getEffectiveReadingPreferences, getPlayerPreferences, setAuthoredPreferenceDefaults, updatePlayerPreferences, type PlayerPreferences } from '@/player/playerPreferences';
import { dialogueUiText } from '@/player/dialogueUiStrings';
import { resolveDialogueSystem, type DialogueSpeed } from '@/project/dialogueSystem';
import type { StatusMenuDetail, StatusMenuDetailEntry } from '@/player/playerStatusMenuDetailTypes';
import type { Project } from '@/project/types';
import { resolveTouchControls, type TouchStickMode } from '@/project/touchControls';

const NEXT_STICK: Record<TouchStickMode, TouchStickMode> = { auto: 'fixed', fixed: 'floating', floating: 'auto' };
const STICK_VALUE = { auto: 'value.stickAuto', fixed: 'value.stickFixed', floating: 'value.stickFloating' } as const;

/** 터치 UI 로 열린 플레이 화면인가(playSurface 가 data-touch-ui 를 단다). */
function touchUiActive(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.play-viewport[data-touch-ui="true"]') !== null;
}

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
  // classic 창 스킨은 그림이 창을 채워 투명도가 듣지 않는다 — 효과 없는 행은 보이지 않는다(적대 리뷰 D3).
  if (system && project?.system.dialogueStyle !== 'classic') {
    const index = OPACITY_STEPS.findIndex(step => Math.abs(step - effective.windowOpacity) < 0.05);
    entries.push({
      label: text('option.windowOpacity'), value: `${Math.round(effective.windowOpacity * 100)}%`,
      description: text('option.windowOpacityHint'), testId: 'player-option-window-opacity',
      onActivate: () => change({ windowOpacity: OPACITY_STEPS[(Math.max(0, index) + 1) % OPACITY_STEPS.length] }),
    });
  }
  entries.push({
    label: text('option.alwaysRun'), value: prefs.alwaysRun ? text('value.on') : text('value.off'),
    description: text('option.alwaysRunHint'), testId: 'player-option-always-run',
    onActivate: () => change({ alwaysRun: !prefs.alwaysRun }),
  });
  if (touchUiActive()) {
    const touch = resolveTouchControls(project?.system.touchControls, {
      ...(prefs.touchTapToMove !== undefined ? { tapToMove: prefs.touchTapToMove } : {}),
      ...(prefs.touchStick !== undefined ? { stick: prefs.touchStick } : {}),
      ...(prefs.touchHaptics !== undefined ? { haptics: prefs.touchHaptics } : {}),
    });
    entries.push({
      label: text('option.tapToMove'), value: touch.tapToMove ? text('value.on') : text('value.off'),
      description: text('option.tapToMoveHint'), testId: 'player-option-tap-to-move',
      onActivate: () => change({ touchTapToMove: !touch.tapToMove }),
    });
    entries.push({
      label: text('option.stick'), value: text(STICK_VALUE[touch.stick]),
      description: text('option.stickHint'), testId: 'player-option-stick',
      onActivate: () => change({ touchStick: NEXT_STICK[touch.stick] }),
    });
    entries.push({
      label: text('option.haptics'), value: touch.haptics ? text('value.on') : text('value.off'),
      description: text('option.hapticsHint'), testId: 'player-option-haptics',
      onActivate: () => change({ touchHaptics: !touch.haptics }),
    });
  }
  entries.push({
    label: text('option.menuMotion'), value: prefs.reduceMenuMotion ? text('value.on') : text('value.off'),
    description: text('option.menuMotionHint'),
    testId: 'player-option-menu-motion', onActivate: () => change({ reduceMenuMotion: !prefs.reduceMenuMotion }),
  });
  return { title: text('option.title'), entries, hint: text('option.footer') };
}
