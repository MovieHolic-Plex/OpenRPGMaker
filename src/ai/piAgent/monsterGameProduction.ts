import type { Project } from '@/project/types';
import type { ToolResult } from '@/editor/tools/types';
import { monsterGameFingerprint, reviewMonsterGame } from '@/editor/tools/monsterGameReview';
import { parseMonsterCampaignScale } from './monsterGameRequest';

/** Whole-game expectations are frozen by the host request, not final model prose. */
export class PiMonsterGameProduction {
  private built=false;
  private priorRead=false;
  private read='';
  private reviewed='';
  private openingReviewed='';
  private readonly viewed=new Map<string,string>();
  private readonly scale:ReturnType<typeof parseMonsterCampaignScale>;
  constructor(public requested=false,task='') {this.scale=parseMonsterCampaignScale(task);}
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
    // 요청이 말한 규모는 만든 결과로 확인한다 — 「체육관 3개」를 8관 기본 캠페인으로 바꿔 치우고 완료하지 못하게.
    const campaign=p.system.monsterCampaign;
    const scaleIssues=[
      ...(this.scale.gymCount!==undefined&&campaign&&campaign.badges.length!==this.scale.gymCount?[`요청은 체육관 ${this.scale.gymCount}개인데 캠페인 배지는 ${campaign.badges.length}개입니다 — create 라면 build_monster_game 에 gymCount:${this.scale.gymCount} 를, 이미 지은 캠페인이면 configure_monster_campaign 의 badgeCount:${this.scale.gymCount} 를 쓰세요.`]:[]),
      ...(this.scale.speciesCount!==undefined&&campaign&&this.scale.speciesCount<=60&&campaign.speciesIds.length!==this.scale.speciesCount?[`요청은 도감 ${this.scale.speciesCount}종인데 캠페인 도감은 ${campaign.speciesIds.length}종입니다 — build_monster_game 의 speciesCount:${this.scale.speciesCount}.`]:[]),
    ];
    return [...(!this.built?['build_monster_game로 전체 게임을 실제 생성 또는 보수하세요. 설정만으로 완료할 수 없습니다.']:[]),
      ...(!this.priorRead?['build_monster_game 전에 read_monster_game으로 기존 게임을 확인하세요.']:[]),
      ...(this.read!==fingerprint?['마지막 변경 뒤 read_monster_game으로 현재 전체 게임을 다시 읽으세요.']:[]),
      ...(this.reviewed!==fingerprint?['마지막 변경 뒤 review_monster_game으로 전체 게임을 검토하세요.']:[]),
      ...(this.openingReviewed!==JSON.stringify([p.system.opening,p.meta.oprnOpeningBook])?['마지막 변경 뒤 review_opening으로 실제 도입을 검토하세요.']:[]),
      ...[...new Set((p.system.opening?.scenes??[]).filter(s=>s.kind==='image').map(s=>s.resourceId))].filter((id):id is string=>!!id).filter(id=>this.viewed.get(id)!==JSON.stringify(p.assets.uploaded[id]??null)).map(id=>`show_opening_image로 실제 도입 그림을 확인하세요:${id}`),
      ...scaleIssues,
      ...reviewMonsterGame(p).issues];
  }
}
