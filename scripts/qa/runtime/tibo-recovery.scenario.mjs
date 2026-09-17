import fs from 'node:fs';
const projectFixture='recovered-assets/tibo-20260917/recovered-project.json';
const p=JSON.parse(fs.readFileSync(projectFixture));
export default {id:'tibo-recovery',projectFixture,beats:[
{id:'title',expect:{testidPresent:['title-screen']}},
{id:'restored-furniture',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:p.startMapId,...p.startPos,playerSpriteTextureLoaded:true},shot:true}
]};
