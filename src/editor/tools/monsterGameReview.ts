import type { Project } from '@/project/types';
import { isEmeraldMonsterStyle } from '@/project/emeraldMonsterStyle';
import { collectorFieldMenu } from '@/project/fieldMenu';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { isPassableLanding } from '@/project/collision';

export function monsterGameFingerprint(p: Project): string {
  // No image bytes in the receipt; refs identify durable bytes, inline data is hashed.
  let hash = 2166136261;
  const add = (text: string) => { for (let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619); };
  add(JSON.stringify([p.meta,p.system,p.startMapId,p.startPos,p.maps,p.mapConnections,p.database,p.switches,p.variables]));
  for (const [id,asset] of Object.entries(p.assets.uploaded)) { add(id);add(JSON.stringify(asset)); }
  return (hash>>>0).toString(16);
}

/** Actual complete authored inventory, never a model supplied success flag. */
export function reviewMonsterGame(p: Project) {
  const issues: string[] = [], campaign=p.system.monsterCampaign;
  const maps=Object.values(p.maps), species=p.database.monsterSpecies??[];
  const roster=campaign?.speciesIds.map(id=>species.find(s=>s.id===id))??[];
  const allCommands: Record<string,unknown>[]=[];
  const walk=(value: unknown):void=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=='object')return;const r=value as Record<string,unknown>;if(typeof r.kind==='string')allCommands.push(r);Object.values(r).forEach(walk);};
  for(const map of maps)for(const event of map.events)walk(event.pages??event.commands);
  const commands=(kind:string)=>allCommands.filter(c=>c.kind===kind);
  const known=(id:unknown)=>typeof id==='string'&&!!(p.assets.uploaded[id]?.ref||p.assets.uploaded[id]?.dataUrl||resolveAssetResourceUrl(id,{project:p}));
  if(p.system.playResolution?.width!==480||p.system.playResolution?.height!==320||p.system.cameraZoom!==2)issues.push('에메랄드15×10칸 화면은480×320/카메라2배여야 합니다.');
  if(!isEmeraldMonsterStyle(p))issues.push('에메랄드 참고 프로필이 적용되지 않았습니다.');
  if(!campaign)issues.push('실제 몬스터 캠페인 정의가 없습니다.');
  if(maps.length<72)issues.push(`전체 캠페인은 최소72맵이 필요합니다(현재${maps.length}).`);
  if(roster.length<60||new Set(campaign?.speciesIds).size!==roster.length)issues.push(`도감에 고유60종이 필요합니다(현재${roster.length}).`);
  const missing=roster.flatMap((s,i)=>!s?[campaign!.speciesIds[i]!]:!known(s.graphic.monsterResourceId)||!known(s.graphic.backResourceId)||!s.types?.length||!s.skillsByLevel?.length||!campaign?.speciesNotes[s.id]?[s.id]:[]);
  const skillIds=new Set(p.database.skills.map(s=>s.id));
  const speciesIds=new Set(species.map(s=>s.id));
  for(const s of roster)if(s){
    if((s.skillsByLevel??[]).some(move=>!skillIds.has(move.skillId)))issues.push(`기술 참조 오류:${s.id}`);
    if((s.evolutions??[]).some(e=>!speciesIds.has(e.toSpeciesId)))issues.push(`진화 참조 오류:${s.id}`);
    if(!Number.isFinite(s.captureRate)||s.captureRate<=0)issues.push(`포획률 누락:${s.id}`);
    for(const move of s.skillsByLevel??[]){const skill=p.database.skills.find(k=>k.id===move.skillId);if(skill&&(!skill.maxPp||skill.maxPp<1))issues.push(`기술PP 누락:${skill.id}`);}
  }
  if(missing.length)issues.push(`종별 정면/뒷면·타입·기술·생태 연결 누락: ${missing.join(', ')}`);
  if((campaign?.badges.length??0)<8)issues.push('체육관 배지8개가 필요합니다.');
  const switchIds=new Set(p.switches.map(s=>s.id));
  for(const b of campaign?.badges??[])if(!p.maps[b.cityMapId]||!switchIds.has(b.switchId))issues.push(`배지 참조 오류:${b.id}`);
  for(const o of campaign?.objectives??[])if(!switchIds.has(o.switchId)||o.requiresSwitchId&&!switchIds.has(o.requiresSwitchId))issues.push(`목표 참조 오류:${o.id}`);
  if(!(campaign?.objectives.length))issues.push('스토리·리그·엔딩 진행 목표가 없습니다.');
  if(!(p.system.monsterCollection&&(p.system.battleParty==='monsters'||p.system.monsterBattleParty===true)&&p.system.battleModel==='gen1'))issues.push('포획·실제 몬스터 파티·gen1 규칙을 함께 설정하세요.');
  const menu=p.meta.oprnFieldMenu?.entries.map(e=>e.command)??[];
  if(collectorFieldMenu().entries.some(e=>!menu.includes(e.command)))issues.push('도감/동료/가방/수첩/지도/배지/저장/설정 메뉴 연결이 필요합니다.');
  if(p.meta.oprnShopPreset!=='collector'||p.system.dialogueStyle!=='handheld'||p.system.battleUiStyle!=='pokemon')issues.push('상점·대화·전투 표현이 에메랄드 프로필과 일치하지 않습니다.');
  if(!commands('giveMonster').length||!commands('choices').length)issues.push('실제 스타터 선택/지급 이벤트가 없습니다.');
  if(!commands('shop').length||!commands('recoverAll').length)issues.push('실제 상점과 회복 센터 이벤트가 필요합니다.');
  if(!commands('battleProcessing').length||!maps.some(m=>(m.encounterRate??0)>0&&!!(m.encounterTable?.length||m.troopIds?.length)))issues.push('트레이너 전투와 야생 조우가 필요합니다.');
  if(!commands('ending').length&&!commands('triggerEnding').length)issues.push('실제 엔딩 명령이 없습니다.');
  const transfers=commands('transfer');
  const graph=new Map<string,Set<string>>();
  for(const map of maps){const targets=new Set<string>();const visit=(v:unknown):void=>{if(Array.isArray(v)){v.forEach(visit);return;}if(!v||typeof v!=='object')return;const r=v as Record<string,unknown>;if(r.kind==='transfer'&&typeof r.mapId==='string')targets.add(r.mapId);Object.values(r).forEach(visit);};for(const e of map.events)visit(e.pages??e.commands);graph.set(map.id,targets);}
  const reached=new Set<string>([p.startMapId]);const queue=[p.startMapId];for(let i=0;i<queue.length;i++)for(const target of graph.get(queue[i]!)??[])if(!reached.has(target)){reached.add(target);queue.push(target);}
  const disconnected=maps.filter(m=>!reached.has(m.id)).map(m=>m.id);if(disconnected.length)issues.push(`시작부터 연결되지 않은 맵:${disconnected.join(', ')}`);
  for(const c of transfers)if(typeof c.mapId!=='string'||!p.maps[c.mapId])issues.push(`출입구 대상 맵이 없습니다:${String(c.mapId)}`);
  if(transfers.length<142)issues.push(`전체 맵 연결이 부족합니다(현재${transfers.length}, 기준142방향).`);
  const start=p.maps[p.startMapId];if(!start||!isPassableLanding(p,start,p.startPos.x,p.startPos.y))issues.push('저작 시작 위치가 통행 가능한 실제 맵 칸이 아닙니다.');
  const opening=p.system.opening;if(!opening?.enabled||!opening.scenes.length)issues.push('교수·몬스터 소개와 플레이 진입 오프닝이 필요합니다.');
  if(opening?.scenes.some(scene=>scene.kind==='video'||scene.durationMs!==0))issues.push('에메랄드 교수 소개는 Enter 확인 페이지로 이어져야 합니다. 기존 오프닝 교체가 요청된 경우 replaceOpening:true로 보수하세요.');
  if(!p.meta.oprnOpeningBook?.portraitResourceId||!known(p.meta.oprnOpeningBook.portraitResourceId))issues.push('실제 교수 초상 그림이 소개에 연결되지 않았습니다.');
  for(const scene of opening?.scenes??[])if(scene.kind==='image'&&!known(scene.resourceId))issues.push(`오프닝 실제 그림이 없습니다:${scene.id}`);
  if(!opening?.musicResourceId||!known(opening.musicResourceId))issues.push('실제 오프닝 음악이 연결되지 않았습니다.');
  return {reference:p.meta.oprnMonsterStyle??null,resolution:p.system.playResolution??null,cameraZoom:p.system.cameraZoom??1,campaignId:campaign?.id??null,maps:maps.length,species:roster.length,badges:campaign?.badges.length??0,objectives:campaign?.objectives.length??0,transfers:transfers.length,trainerBattles:commands('battleProcessing').length,shops:commands('shop').length,missingSpecies:missing,start:{mapId:p.startMapId,...p.startPos},issues,verificationScope:'authored structure/resources only',playbackVerified:false as const};
}
