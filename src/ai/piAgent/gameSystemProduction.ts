import type { Project } from '../../project/types';
import type { ToolResult } from '../../editor/tools/types';
/** Completion evidence from actual tools, independent of the assistant's final text. */
export class PiGameSystemProduction {
  requested = false;
  private read = false;
  private reviewed = '';
  private reviewIssues: string[] = [];
  record(name:string,result:ToolResult,p:Project):void {
    if(!result.ok)return;
    if(name==='read_game_systems')this.read=true;
    if(['configure_field_menu','configure_shop_presentation','set_sell_prices','configure_monster_campaign','configure_monster_system','compose_music','set_game_audio'].includes(name))this.requested=true;
    if(name==='review_game_systems'){
      this.reviewed=this.fingerprint(p);
      const issues=(result.data as {issues?:unknown})?.issues;
      this.reviewIssues=Array.isArray(issues)?issues.filter((x):x is string=>typeof x==='string'):[];
    }
  }
  private fingerprint(p:Project):string {
    const s=p.system;
    return JSON.stringify([s.battleParty,s.monsterBattleParty,s.monsterCollection,s.battleModel,s.battleUiStyle,s.menuUiStyle,s.fieldHud,p.meta.oprnFieldMenu,p.meta.oprnShopPreset,s.sellPrices,s.monsterCampaign,
      s.titleScreen?.musicResourceId,s.opening?.musicResourceId,s.defaultBgmResourceId,s.battleBgmResourceId,s.battleVictoryMeResourceId,s.battleDefeatSeResourceId,p.meta.oprnMenuSounds,
      Object.entries(p.meta.oprnMusicScores??{}).map(([id,v])=>[id,v.sha256,p.assets.uploaded[id]?.ref??p.assets.uploaded[id]?.dataUrl]),Object.entries(p.maps).map(([id,m])=>[id,m.bgm])]);
  }
  inspect(p:Project):string[]{
    if(!this.requested)return [];
    return [...(!this.read?['read_game_systems로 실제 설정을 먼저 확인하세요.']:[]),
      ...(this.reviewed!==this.fingerprint(p)?['마지막 시스템/음악 설정 뒤 review_game_systems로 실제 조합을 다시 검토하세요.']:this.reviewIssues)];
  }
}
