import { readFileSync } from 'node:fs';
const i=process.argv.indexOf('--project');
if(i<0) throw new Error('Use --project with the canonical reloaded project');
const projectFixture=process.argv[i+1];
const project=JSON.parse(readFileSync(projectFixture,'utf8'));
const mapId=project.startMapId;
const route=(dir,n)=>Array.from({length:n},()=>({kind:'move',dir}));
const walk=(id,moves,x,y)=>({id,shot:true,ops:[{kind:'playerRoute',moves},{kind:'waitForPosition',mapId,x,y}],expect:{mapId,x,y,playerSpriteTextureLoaded:true}});
export default {id:'parking-approved',projectFixture,beats:[
  {id:'title',expect:{testidPresent:['title-screen']}},
  {id:'start',shot:true,ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId,x:1,y:4,playerSpriteTextureLoaded:true}},
  walk('between-bays',route('right',8),9,4),
  walk('vehicle-blocked',route('up',1),9,4),
  walk('empty-bay',route('down',1),9,5),
  walk('south-walkway',route('down',1),9,6),
  walk('behind-vehicle',[...route('left',8),...route('up',4),...route('right',8)],9,2),
  walk('north-wall-blocked',route('up',1),9,2),
  walk('return-to-entry',[...route('left',8),...route('down',2)],1,4),
]};
