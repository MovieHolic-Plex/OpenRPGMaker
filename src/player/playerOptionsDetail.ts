import { getAudioEngine } from '@/player/audio';
import { getPlayerPreferences, updatePlayerPreferences, type PlayerPreferences } from '@/player/playerPreferences';
import type { StatusMenuDetail, StatusMenuDetailEntry } from '@/player/playerStatusMenuDetailTypes';

export function createPlayerOptionsDetail(onChanged?: (message?: string) => void): StatusMenuDetail {
  const prefs = getPlayerPreferences();
  const change = (patch: Partial<PlayerPreferences>) => {
    const saved = updatePlayerPreferences(patch);
    const next = getPlayerPreferences();
    const audio = getAudioEngine();
    audio.setVolume('bgm', next.bgm);
    audio.setVolume('se', next.se);
    onChanged?.(saved ? '이 기기에 설정을 저장했습니다.' : '현재 실행에 적용했습니다. 기기 저장소에 저장하지 못했습니다.');
  };
  const groupLabel = { bgm: '배경 음악', se: '효과음', voice: '대사 목소리' } as const;
  const entries: StatusMenuDetailEntry[] = (['bgm', 'se', 'voice'] as const).flatMap(group =>
    ([-1, 1] as const).map(delta => ({
      label: `${groupLabel[group]} ${delta < 0 ? '줄이기' : '늘리기'}`,
      value: `${Math.round(prefs[group] * 100)}%`,
      description: '10%씩 조절합니다. 0%는 음소거입니다.',
      testId: `player-option-${group}-${delta < 0 ? 'down' : 'up'}`,
      onActivate: () => change({ [group]: Math.round((prefs[group] + delta * 0.1) * 10) / 10 }),
    })));
  entries.push({
    label: '대사 속도', value: { slow: '느리게', normal: '보통', fast: '빠르게' }[prefs.textSpeed],
    description: '선택하면 보통 → 빠르게 → 느리게 순서로 바뀝니다.', testId: 'player-option-text-speed',
    onActivate: () => change({ textSpeed: prefs.textSpeed === 'normal' ? 'fast' : prefs.textSpeed === 'fast' ? 'slow' : 'normal' }),
  }, {
    label: '메뉴 움직임 줄이기', value: prefs.reduceMenuMotion ? '켜짐' : '꺼짐',
    description: 'ESC 메뉴 전환의 이동 효과를 줄입니다. 운영체제의 감소 설정도 존중합니다.',
    testId: 'player-option-menu-motion', onActivate: () => change({ reduceMenuMotion: !prefs.reduceMenuMotion }),
  });
  return { title: '설정', entries, hint: '이 기기에 저장 · 게임 저장 파일과 별개 · Enter 변경 · Esc 돌아가기' };
}
