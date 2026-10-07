import fs from 'node:fs';
const routes=JSON.parse(fs.readFileSync('output/beodeul-village50/routes.json','utf8'));
export default {id:'beodeul-village50',projectFixture:'output/beodeul-village50/reloaded-project.json',
 beats:[{id:'title',expect:{testidPresent:['title-screen']}},
 {id:'village-start',shot:true,note:'SQLite 재로드한 황록 마을 50×50 우물 마당',
 ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{...routes.start,playerSpriteTextureLoaded:true}},
 ...routes.stops.map(stop=>({id:stop.id,shot:true,note:`${stop.id}까지 실제 큰길/흙 골목/다리로 도보 이동`,
 ops:[{kind:'playerRoute',moves:stop.moves},{kind:'waitForPosition',...stop.to,timeoutMs:30000}],
 expect:{...stop.to,playerSpriteTextureLoaded:true}}))]};
