// 던전 입구 → (층 계단) → 보스 앞까지 출하 플레이어로 실제 걷기(2026-10-22 assistant-dungeons). 경로: scripts/qa/dungeons/walk-route.mts.
//   node scripts/runtime-qa.mjs --scenario dungeon-walk --project <dir>/project.json --netns   (QA_RECORD_VIDEO=<dir> 로 영상)
import fs from 'node:fs';
import path from 'node:path';
const flag = process.argv.indexOf('--project');
const projectFixture = flag >= 0 ? process.argv[flag + 1] : 'output/dungeon-walk/project.json';
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), 'proof.json'), 'utf8'));
export default {
  id: 'dungeon-walk', projectFixture,
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: '00-start', note: '시작 칸(던전 입구)', shot: true, ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }], expect: { ...proof.start, playerSpriteTextureLoaded: true } },
    ...proof.segments.map((s, i) => ({
      id: `${String(i + 1).padStart(2, '0')}-${s.why.startsWith('계단') ? 'stair' : 'boss'}`, note: `${s.mapName}: ${s.why}까지 ${s.moves.length}걸음`, shot: true,
      ops: [{ kind: 'playerRoute', moves: s.moves }, { kind: 'waitForPosition', ...s.to, timeoutMs: 90000 }],
      expect: { ...s.to, playerSpriteTextureLoaded: true },
    })),
  ],
};
