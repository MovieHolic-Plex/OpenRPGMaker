import type { Project } from '@/project/types';
import type { ToolResult } from '@/editor/tools/types';
import { monsterGameFingerprint, reviewMonsterGame } from '@/editor/tools/monsterGameReview';

/** Whole-game expectations are frozen by the host request, not final model prose. */
export class PiMonsterGameProduction {
  private built=false;
  private priorRead=false;
  private read='';
  private reviewed='';
  private openingReviewed='';
  private readonly viewed=new Map<string,string>();
  constructor(public requested=false) {}
  record(name:string,result:ToolResult,p:Project):void {
    if(!result.ok)return;
    if(name==='read_monster_game')this.read=monsterGameFingerprint(p);
    if(name==='build_monster_game') {this.requested=true;this.built=true;this.priorRead=!!this.read;}
    if(name==='review_opening')this.openingReviewed=JSON.stringify([p.system.opening,p.meta.oprnOpeningBook]);
    if(name==='review_monster_game')this.reviewed=monsterGameFingerprint(p);
  }
  saw(p:Project,id:string):void {this.viewed.set(id,JSON.stringify(p.assets.uploaded[id]??null));}
  inspect(p:Project):string[]{
    if(!this.requested)return [];
    const fingerprint=monsterGameFingerprint(p);
    return [...(!this.built?['build_monster_game로 전체 게임을 실제 생성 또는 보수하세요. 설정만으로 완료할 수 없습니다.']:[]),
      ...(!this.priorRead?['build_monster_game 전에 read_monster_game으로 기존 게임을 확인하세요.']:[]),
      ...(this.read!==fingerprint?['마지막 변경 뒤 read_monster_game으로 현재 전체 게임을 다시 읽으세요.']:[]),
      ...(this.reviewed!==fingerprint?['마지막 변경 뒤 review_monster_game으로 전체 게임을 검토하세요.']:[]),
      ...(this.openingReviewed!==JSON.stringify([p.system.opening,p.meta.oprnOpeningBook])?['마지막 변경 뒤 review_opening으로 실제 도입을 검토하세요.']:[]),
      ...[...new Set((p.system.opening?.scenes??[]).filter(s=>s.kind==='image').map(s=>s.resourceId))].filter((id):id is string=>!!id).filter(id=>this.viewed.get(id)!==JSON.stringify(p.assets.uploaded[id]??null)).map(id=>`show_opening_image로 실제 도입 그림을 확인하세요:${id}`),
      ...reviewMonsterGame(p).issues];
  }
}
