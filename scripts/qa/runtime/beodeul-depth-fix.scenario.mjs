import fs from 'node:fs';
const routes=JSON.parse(fs.readFileSync('output/beodeul-depth-fix/routes.json','utf8'));
export default {id:'beodeul-depth-fix',projectFixture:'output/beodeul-depth-fix/reloaded-project.json',
 beats:[{id:'title',expect:{testidPresent:['title-screen']}},
 {id:'village-start',shot:true,note:'SQLite 재로드한 숲 깊이·연결 울타리·돌벽 통일을 보정한 민가 5채와 성당',
 ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{...routes.start,playerSpriteTextureLoaded:true}},
 ...routes.stops.map(stop=>({id:stop.id,shot:true,note:stop.kit?`${stop.kit}의 문 앞까지 길로 도보 이동`:'우물 마당으로 도보 복귀',
 ops:[{kind:'playerRoute',moves:stop.moves},{kind:'waitForPosition',...stop.to,timeoutMs:30000}],expect:{...stop.to,playerSpriteTextureLoaded:true}}))]};
