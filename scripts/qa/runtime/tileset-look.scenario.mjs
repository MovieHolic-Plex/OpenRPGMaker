// 게임 겉모습(tileset.look)이 출하 플레이어에서 그려지는가 — 바닥·길 재질과 나무 수종 그림이 겹친 마을 한 장(2026-11-12 버들항 겉모습).
// 픽스처: 겉모습을 고른 마을 프로젝트(serialize 한 project.json). 만들기: bun scripts/content/beodeul-variety/lookFixture.mts <폴더>
//   node scripts/runtime-qa.mjs --scenario tileset-look --project <폴더>/project.json --netns
const flag = process.argv.indexOf('--project');
const projectFixture = flag >= 0 ? process.argv[flag + 1] : 'output/tileset-look/project.json';
export default {
  id: 'tileset-look', projectFixture,
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: '00-village', note: '겉모습을 고른 마을 — 바닥·길·나무가 원래 그림이 아니어야 한다', shot: true, ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }], expect: { playerSpriteTextureLoaded: true } },
  ],
};
