// village-art 걷기 영상: 실조수(대용) 시험이 저장·재로드한 프로젝트 JSON 으로 출하 플레이어(player.html)를 띄워 마당/폐허 길을 1배로 걷는다.
// 준비: node scripts/qa/village-art-walk-prep.mjs <reloaded.json> <yard|wasteland> → output/va-walk/<kit>.json + <kit>.route.json
// 실행: VA_WALK=<kit> QA_RECORD_VIDEO=output/va-walk/video-<kit> npm run qa:runtime -- --scenario scripts/qa/runtime/village-art-walk.scenario.mjs --netns
import fs from 'node:fs';
const kit = process.env.VA_WALK ?? 'yard';
const route = JSON.parse(fs.readFileSync(`output/va-walk/${kit}.route.json`, 'utf8'));
const hold = (dir, ms) => ({ kind: 'hold', dir, ms });
export default {
  id: `village-art-walk-${kit}`,
  projectFixture: `output/va-walk/${kit}.json`,
  viewport: { width: 960, height: 720 },
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'start', shot: true, note: '저장·재로드한 마을 시작', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }], expect: { playerSpriteTextureLoaded: true } },
    { id: 'at-yard', shot: true, note: route.note, ops: [{ kind: 'teleport', mapId: route.mapId, x: route.x, y: route.y }, { kind: 'waitForPosition', mapId: route.mapId, x: route.x, y: route.y, timeoutMs: 20000 }] },
    ...route.legs.map(([dir, ms], i) => ({ id: `walk-${i + 1}-${dir}`, shot: true, note: `${dir} 로 ${ms}ms 걷기`, ops: [hold(dir, ms)], expect: { playerSpriteTextureLoaded: true } })),
  ],
};
