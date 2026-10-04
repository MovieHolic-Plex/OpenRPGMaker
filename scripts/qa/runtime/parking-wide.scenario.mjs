import {readFileSync} from 'node:fs';
const i=process.argv.indexOf('--project');
if(i<0)throw Error('--project must be the canonical reload');
const projectFixture=process.argv[i+1], project=JSON.parse(readFileSync(projectFixture,'utf8'));
const mapId=project.startMapId;
const route=(dir,n)=>Array.from({length:n},()=>({kind:'move',dir}));
const walk=(id,moves,x,y)=>({id,shot:true,ops:[{kind:'playerRoute',moves},{kind:'waitForPosition',mapId,x,y}],expect:{mapId,x,y,playerSpriteTextureLoaded:true}});
export default {id:'parking-wide',projectFixture,beats:[
 {id:'title',expect:{testidPresent:['title-screen']}},
 {id:'start',shot:true,ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId,x:4,y:16,playerSpriteTextureLoaded:true}},
 walk('west-bank-behind',[...route('up',14),...route('right',5)],9,2),
 walk('west-car-blocked',route('down',1),9,2),
 walk('north-wall-blocked',[...route('left',5),...route('up',1)],4,2),
 walk('cross-aisle',[...route('down',14),...route('right',12)],16,16),
 walk('east-bank-behind',[...route('up',8),...route('right',5)],21,8),
 walk('east-car-blocked',route('down',1),21,8),
 walk('return-to-exit',[...route('left',5),...route('down',8),...route('left',16)],0,16),
]};
