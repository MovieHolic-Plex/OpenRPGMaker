// Actual AI-authored QA event, exported from the dedicated SQLite host.
export default {
  id: 'interview-handoff',
  projectFixture: 'output/qa/interview-e2e/runtime-project.json',
  beats: [
    {
      id: 'title', note: '저장된 AI 타이틀이 내보내기 플레이어에서 열린다',
      expect: { testidPresent: ['title-screen'] }, shot: true,
    },
    {
      id: 'opening', note: '새 게임에서 시네마틱 오프닝으로 들어간다',
      // The authored title sequence intentionally consumes its first input.
      ops: [
        { kind: 'key', key: 'Enter' },
        { kind: 'waitForAttr', testid: 'title-screen', attr: 'data-seq-state', value: 'done' },
        { kind: 'key', key: 'Enter' },
        { kind: 'waitFor', testid: 'cinematic-sequence', state: 'present' },
      ],
      expect: { testidPresent: ['cinematic-sequence'] }, shot: true,
    },
    {
      id: 'field', note: '오프닝 건너뛰기 → 실제 시작 맵과 스프라이트',
      ops: [{ kind: 'key', key: 'Escape' }, { kind: 'waitForRuntime' }],
      expect: { mapId: 'map_blank_start', x: 10, y: 8, playerSpriteTextureLoaded: true, testidAbsent: ['cinematic-sequence'] },
      shot: true,
    },
    {
      id: 'neighbor', note: 'AI가 저장한 이웃 NPC 첫 대사를 읽는다',
      ops: [{ kind: 'face', dir: 'right' }, { kind: 'action' }, { kind: 'waitFor', testid: 'dialogue-box', state: 'present' }],
      expect: { testidPresent: ['dialogue-box'] }, shot: true,
    },
    {
      id: 'choices', note: '첫 대사를 넘기면 두 선택지가 표시된다',
      ops: [{ kind: 'pressUntil', key: 'Enter', testid: 'runtime-choices', state: 'present', timeoutMs: 1000, maxPresses: 4 }],
      expect: { testidPresent: ['runtime-choices'], visibleText: { 'runtime-choices': '반갑게 인사한다' } }, shot: true,
    },
  ],
};
