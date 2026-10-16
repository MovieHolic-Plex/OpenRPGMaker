import type { Project } from '../../project/types';
import type { ToolResult } from '../../editor/tools/types';
/** 게임 시스템(상점·ESC 메뉴·몬스터·음악·대사 읽기 보조 등) 요청으로 보고 시스템 도구를 처음부터 선언하게 하는 낱말(한·영·일·중). */
export const GAME_SYSTEM_REQUEST_PATTERN = /시스템|상점|shop|메뉴|esc|포켓몬|몬스터|음악|작곡|\bost\b|\bbgm\b|백로그|오토|스킵|대사 기록|미연시|backlog|visual.?novel|auto.?(?:play|advance)|\bskip\b|(?:message|dialogue|dialog) (?:log|history)|バックログ|オート|スキップ|回顾|回顧|自动播放|自動播放|跳过|跳過|对话记录|對話記錄/iu;

/** Completion evidence from actual tools, independent of the assistant's final text. */
export class PiGameSystemProduction {
  requested = false;
  private read = false;
  private reviewed = '';
  private reviewIssues: string[] = [];
  record(name:string,result:ToolResult,p:Project):void {
    if(!result.ok)return;
    if(name==='read_game_systems')this.read=true;
    if(['configure_monster_style','build_monster_game','configure_field_menu','set_dialogue_system','configure_shop_presentation','set_sell_prices','configure_monster_campaign','configure_monster_system','compose_music','set_game_audio'].includes(name))this.requested=true;
    if(name==='review_game_systems'){
      this.reviewed=this.fingerprint(p);
      const issues=(result.data as {issues?:unknown})?.issues;
      this.reviewIssues=Array.isArray(issues)?issues.filter((x):x is string=>typeof x==='string'):[];
    }
  }
  private fingerprint(p:Project):string {
    const s=p.system;
    return JSON.stringify([p.meta.oprnMonsterStyle,s.playResolution,s.cameraZoom,s.battleParty,s.monsterBattleParty,s.monsterCollection,s.battleModel,s.battleUiStyle,s.menuUiStyle,s.fieldHud,p.meta.oprnFieldMenu,p.meta.oprnDialogueSystem,p.meta.oprnShopPreset,s.sellPrices,s.monsterCampaign,
      s.titleScreen?.musicResourceId,s.opening?.musicResourceId,s.defaultBgmResourceId,s.battleBgmResourceId,s.battleVictoryMeResourceId,s.battleDefeatSeResourceId,p.meta.oprnMenuSounds,
      Object.entries(p.meta.oprnMusicScores??{}).map(([id,v])=>[id,v.sha256,p.assets.uploaded[id]?.ref??p.assets.uploaded[id]?.dataUrl]),Object.entries(p.maps).map(([id,m])=>[id,m.bgm])]);
  }
  inspect(p:Project):string[]{
    if(!this.requested)return [];
    return [...(!this.read?['read_game_systems로 실제 설정을 먼저 확인하세요.']:[]),
      ...(this.reviewed!==this.fingerprint(p)?['마지막 시스템/음악 설정 뒤 review_game_systems로 실제 조합을 다시 검토하세요.']:this.reviewIssues)];
  }
}
