import fs from 'node:fs';
const projectFixture='output/beodeul-small-village/reloaded-project.json';
const routes=JSON.parse(fs.readFileSync('output/beodeul-small-village/routes.json','utf8'));
export default {id:'beodeul-small-village',projectFixture,
 beats:[{id:'title',expect:{testidPresent:['title-screen']}},
 {id:'village-start',shot:true,note:'실제 조수가 저장한 5채 마을의 우물 마당',
 ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{...routes.start,playerSpriteTextureLoaded:true}},
 ...routes.stops.map(stop=>({id:stop.id,shot:true,note:stop.kit?`${stop.kit} 문 앞까지 포석 길로 걸어 이동`:'우물 마당으로 길을 따라 복귀',
 ops:[{kind:'playerRoute',moves:stop.moves},{kind:'waitForPosition',...stop.to,timeoutMs:30000}],expect:{...stop.to,playerSpriteTextureLoaded:true}}))]};
