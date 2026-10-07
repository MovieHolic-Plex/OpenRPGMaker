import fs from 'node:fs';
const routes=JSON.parse(fs.readFileSync('output/beodeul-gable-fix/routes.json','utf8'));
const stop=routes.stops[2];
export default {id:'beodeul-gable-fix',projectFixture:'output/beodeul-gable-fix/reloaded-project.json',
 beats:[{id:'title',expect:{testidPresent:['title-screen']}},
 {id:'village-start',shot:true,note:'SQLite 재로드 — 이전 기와 복원과 돌집 박공 벽 정리',
 ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{...routes.start,playerSpriteTextureLoaded:true}},
 {id:'stone-gable',shot:true,note:'지적된 stone 집 문앞 — 박공 벽/중앙 원형창과 기존 기와 확인',
 ops:[{kind:'playerRoute',moves:routes.stops.slice(0,3).flatMap(s=>s.moves)},{kind:'waitForPosition',...stop.to,timeoutMs:30000}],
 expect:{...stop.to,playerSpriteTextureLoaded:true}}]};
