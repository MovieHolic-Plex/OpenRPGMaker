import type {Project} from '@/project/types';
import type {ToolResult} from '@/editor/tools/types';
/** Read actual layout before and after patrol edits. Tool safety is not playback proof. */
export class PiNpcLayoutProduction {
 private before=false;
 private requested=false;
 private reviewed='';
 record(name:string,result:ToolResult,p:Project):void {
  if(!result.ok)return;
  if(name==='read_npc_layout'){if(!this.requested)this.before=true;this.reviewed=this.fingerprint(p);}
  if(name==='configure_npc_patrol')this.requested=true;
 }
 private fingerprint(p:Project):string {return JSON.stringify(Object.values(p.maps).map(m=>[m.id,m.events.map(e=>[e.id,e.x,e.y,e.pages?.map(page=>[page.id,page.graphic,page.movement,page.priority,page.overlapForbidden])])]));}
 inspect(p:Project):string[]{return !this.requested?[]:[...(!this.before?['순찰 저작 전에 read_npc_layout으로 실제 NPC 배치를 읽으세요.']:[]),...(this.reviewed!==this.fingerprint(p)?['순찰 수정 뒤 read_npc_layout으로 위치·외형·이동·통행을 다시 확인하세요.']:[])];}
}
