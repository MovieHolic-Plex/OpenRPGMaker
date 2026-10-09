import { translateTiles } from '@/project/objectStamp';
import { createBeodeulDoorTileset, BEODEUL_DOOR_ID, BEODEUL_DOOR_TEXTURE } from '@/project/defaults/beodeulDoor';
import type { Command, EventPage, GameEvent } from '@/project/types';
import { ToolError, type ToolDefinition } from './types';

function transferPage(event: GameEvent): EventPage {
  if(event.pages?.length!==1 || event.pages[0].conditions.length || event.pages[0].trigger.kind!=='playerTouch')
    throw new ToolError('조건 없는 playerTouch 출입 페이지 한 장이 필요합니다. 기존 조건 페이지는 자동으로 고치지 않습니다.');
  const page=event.pages[0];
  if(page.commands.filter(c=>c.kind==='transfer').length!==1)
    throw new ToolError('페이지에 장소 이동 명령이 정확히 하나 있어야 합니다.');
  return page;
}

export const BEODEUL_DOOR_TOOLS: readonly ToolDefinition[] = [{
  name:'apply_beodeul_door_animation',mode:'write',domains:['event','tile'],preservesAuthoredRaster:true,
  description:'기존 버들항 살림집의 playerTouch 출입구에 공용 손 도트 문 8단계를 적용한다. 집 bd-house-h101_0의 5743/2333 문 전용(다른 문 그림은 거부). mapId,eventId를 주면 문 앞 이벤트 기준 위 2칸을 문 그림 원점으로 추론한다. 열기→기존 transfer→닫힘 복원. 양방향 짝이 있으면 귀환 후 닫기도 연결한다. 16px 칩셋에 안전하게 이식하며 원래 대사/명령과 통행을 보존한다. 반복 적용은 중복 명령을 만들지 않는다.',
  parameters:{type:'object',properties:{mapId:{type:'string'},eventId:{type:'string'},
    frameMs:{type:'integer',minimum:60,maximum:300,description:'단계 간격(ms), 기본 100'}},required:['mapId','eventId'],additionalProperties:false},
  run(project,args) {
    const map=project.maps[String(args.mapId)];
    if(!map) throw new ToolError('맵이 없습니다.');
    const event=map.events.find(e=>e.id===args.eventId);
    if(!event) throw new ToolError('출입 이벤트가 없습니다.');
    const page=transferPage(event);
    const target=project.tilesets[map.tilesetId];
    if(!target||target.tileSize!==16) throw new ToolError('16px 타일셋이 필요합니다.');
    const x=event.x,y=event.y-2;
    if(x<0||x>=map.width||y<0||y+1>=map.height) throw new ToolError('문 앞 이벤트 위 1×2칸이 맵 밖입니다.');
    const top=map.upperTiles[y*map.width+x],bottom=map.upperTiles[(y+1)*map.width+x];
    const already=page.commands.some(c=>c.kind==='changeTile'&&c.mapId===map.id&&c.x===x&&c.y===y
      &&target.tileGrafts?.some(g=>g.targetTile===c.tile&&g.sourceChipset===BEODEUL_DOOR_TEXTURE));
    const helperId=`ev_bd_door_restore_${event.id}`;
    const closeId=`ev_bd_door_close_${event.id}`;
    const transfer=page.commands.find(c=>c.kind==='transfer')! as Extract<Command,{kind:'transfer'}>;
    const destination=project.maps[transfer.mapId];
    if(!destination || destination.id===map.id) throw new ToolError('서로 다른 두 맵의 출입구가 필요합니다.');
    if(already && destination.events.some(e=>e.id===helperId)) return {summary:'이 출입구에는 공용 문 애니메이션이 이미 적용돼 있습니다.',data:{
      mapId:map.id,eventId:event.id,alreadyApplied:true,door:{x,y,width:1,height:2},slotsAdded:0,
      states:Array.from({length:8},(_,i)=>({stage:i,
        top:target.tileGrafts?.find(g=>g.sourceChipset===BEODEUL_DOOR_TEXTURE&&g.sourceTile===i)?.targetTile,
        bottom:target.tileGrafts?.find(g=>g.sourceChipset===BEODEUL_DOOR_TEXTURE&&g.sourceTile===i+8)?.targetTile}))}};
    const picture=(tile:number|undefined,sourceTile:number)=> tile===sourceTile&&target.image.id==='tex_beodeul_city'
      ||target.tileGrafts?.some(g=>g.targetTile===tile&&g.sourceChipset==='tex_beodeul_city'&&g.sourceTile===sourceTile);
    if(!already && (!picture(top,5743)||!picture(bottom,2333)))
      throw new ToolError('지원하는 살림집 문(5743/2333)이 아닙니다. 다른 문은 그 그림에 맞춘 열림 시트를 먼저 만들어야 합니다.');
    const returns=(destination?.events??[]).filter(e=>e.pages?.length===1&&e.pages[0].trigger.kind==='playerTouch'
      &&e.pages[0].commands.some(c=>c.kind==='transfer'&&c.mapId===map.id&&Math.abs(c.x-event.x)+Math.abs(c.y-event.y)<=2));
    const returnPage=returns.length===1 ? transferPage(returns[0]) : undefined;
    if(destination.events.some(e=>e.id===helperId)||map.events.some(e=>e.id===closeId))
      throw new ToolError('문 보조 이벤트 ID가 이미 사용 중입니다.');
    // Validate both endpoints before grafting or changing either command list.
    const source=project.tilesets[BEODEUL_DOOR_ID]??createBeodeulDoorTileset();
    const translated=translateTiles(source,target,Array.from({length:16},(_,i)=>i));
    project.tilesets[BEODEUL_DOOR_ID]??=source;
    const frameMs=Number(args.frameMs??100);
    const set=(i:number):Command[] => [
      {kind:'changeTile',mapId:map.id,layer:'upper',x,y,tile:translated.map.get(i)!},
      {kind:'changeTile',mapId:map.id,layer:'upper',x,y:y+1,tile:translated.map.get(i+8)!},
    ];
    const animate=(stages:number[]):Command[] => stages.flatMap(i=>[...set(i),{kind:'wait' as const,ms:frameMs}]);
    const opening=animate([1,2,3,4,5,6,7]);
    const closing=animate([6,5,4,3,2,1,0]);
    // Repair the earlier draft which placed commands after transfer. Ordinary map
    // interpreters end at transfer; destination auto events own the remaining work.
    const originalCommands=(commands:Command[],entry:boolean):Command[] => {
      if(!already) return commands;
      const result:Command[]=[];
      let afterTransfer=false;
      for(let i=0;i<commands.length;i++) {
        const a=commands[i],b=commands[i+1];
        const stage=a?.kind==='changeTile'&&b?.kind==='changeTile'
          &&a.mapId===map.id&&b.mapId===map.id&&a.layer==='upper'&&b.layer==='upper'
          &&a.x===x&&b.x===x&&a.y===y&&b.y===y+1
          ? Array.from({length:8},(_,j)=>j).find(j=>a.tile===translated.map.get(j)&&b.tile===translated.map.get(j+8)) : undefined;
        if(stage!==undefined) {
          i++;
          if((entry&&!afterTransfer&&stage>0||!entry&&afterTransfer&&stage<7)&&commands[i+1]?.kind==='wait') i++;
          continue;
        }
        if(a.kind==='transfer') afterTransfer=true;
        result.push(a);
      }
      return result;
    };
    const restoreSwitch=`sw_bd_door_restore_${event.id}`;
    const closeSwitch=`sw_bd_door_close_${event.id}`;
    const helper=(id:string,switchId:string,commands:Command[],hx:number,hy:number):GameEvent=>({
      id,x:hx,y:hy,trigger:{kind:'auto'},commands:[],pages:[{
        id:`${id}_page`,name:'문 상태 복원',conditions:[{kind:'switch',switchId,value:true}],
        graphic:{transparent:true},trigger:{kind:'auto'},priority:'below',overlapForbidden:false,
        animationType:'fixedGraphic',movement:{type:'fixed',speed:3,frequency:3},
        commands:[{kind:'setSwitch',switchId,value:false},...commands],
      }],
    });
    const addSwitch=(id:string,name:string)=>{if(!project.switches.some(s=>s.id===id)) project.switches.push({id,name});};
    addSwitch(restoreSwitch,'버들항 문: 입장 뒤 복원');
    destination.events.push(helper(helperId,restoreSwitch,set(0),transfer.x,transfer.y));
    const entryOriginal=originalCommands(page.commands,true);
    const at=entryOriginal.indexOf(transfer);
    page.commands=[...entryOriginal.slice(0,at),...opening,{kind:'setSwitch',switchId:restoreSwitch,value:true},transfer,...entryOriginal.slice(at+1)];
    if(returnPage) {
      const original=originalCommands(returnPage.commands,false);
      const index=original.findIndex(c=>c.kind==='transfer');
      const returnTransfer=original[index]! as Extract<Command,{kind:'transfer'}>;
      addSwitch(closeSwitch,'버들항 문: 귀환 뒤 닫기');
      map.events.push(helper(closeId,closeSwitch,closing,returnTransfer.x,returnTransfer.y));
      returnPage.commands=[...original.slice(0,index),...set(7),{kind:'setSwitch',switchId:closeSwitch,value:true},returnTransfer,...original.slice(index+1)];
    }
    // Closed pixels match the old door, but now use the same grafted state as resets.
    map.upperTiles[y*map.width+x]=translated.map.get(0)!;
    map.upperTiles[(y+1)*map.width+x]=translated.map.get(8)!;
    return {summary:`공용 문 8단계 적용: ${map.name??map.id} (${x},${y}) · 입장 열림${returnPage?' · 귀환 닫힘':''}`,
      data:{mapId:map.id,eventId:event.id,returnEventId:returns.length===1?returns[0].id:null,
        door:{x,y,width:1,height:2},frameMs,slotsAdded:translated.slotsAdded,
        states:Array.from({length:8},(_,i)=>({stage:i,top:translated.map.get(i),bottom:translated.map.get(i+8)}))},
      ...(!returnPage?{warnings:['유일한 귀환 출입구를 찾지 못해 입장 이벤트만 연결했습니다.']}:{}),};
  },
}];
