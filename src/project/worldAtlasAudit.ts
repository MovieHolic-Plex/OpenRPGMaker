import type { Project } from './types';
import type { WorldAtlas, WorldAtlasNode } from './worldAtlas';
import { canMove, isPassable } from './collision';

/** Structural + progression audit shared by the editor and headless authoring. */
export function inspectWorldAtlas(project: Project, atlas: WorldAtlas) {
  const issues: string[] = [];
  const switchIds = new Set(project.switches.map(s => s.id));
  const checkSwitch = (id: string) => { if (!switchIds.has(id)) issues.push(`없는 스위치: ${id}`); };
  for (const node of atlas.nodes) {
    const map = project.maps[node.mapId];
    if (!map) issues.push(`없는 맵: ${node.mapId}`);
    else if (node.entry.x >= map.width || node.entry.y >= map.height) issues.push(`맵 밖 입구: ${node.id}`);
    else if (!isPassable(project, map, node.entry.x, node.entry.y)) issues.push(`막힌 입구: ${node.id}`);
    checkSwitch(node.visitSwitchId); checkSwitch(node.clearSwitchId); node.grants.forEach(checkSwitch);
  }
  atlas.edges.flatMap(edge => edge.requires).forEach(checkSwitch);
  atlas.abilities.forEach(a => checkSwitch(a.switchId)); atlas.pins.forEach(pin => checkSwitch(pin.switchId));
  if (atlas.overviewMapId && !project.maps[atlas.overviewMapId]) issues.push('대륙 맵이 없습니다.');
  if(atlas.overviewMapId&&project.maps[atlas.overviewMapId]){
    const world=project.maps[atlas.overviewMapId]!,start=atlas.nodes.find(n=>n.id===atlas.startNodeId)?.worldEntrance;
    if(!start)issues.push('대륙 시작 입구가 없습니다.');
    else{
      const seen=new Set([start.y*world.width+start.x]),queue=[start];
      for(let i=0;i<queue.length;i++){const p=queue[i]!;for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const x=p.x+dx!,y=p.y+dy!,key=y*world.width+x;
        if(x<0||y<0||x>=world.width||y>=world.height||seen.has(key)||!canMove(project,world,p.x,p.y,x,y))continue;
        seen.add(key);queue.push({x,y});
      }}
      for(const node of atlas.nodes)if(!node.worldEntrance||!seen.has(node.worldEntrance.y*world.width+node.worldEntrance.x))issues.push('대륙에서 닿지 않는 거점: '+node.name);
    }
  }
  // Acquire only rewards that are themselves reachable. A key behind its own gate is a deadlock.
  const reached = new Set([atlas.startNodeId]); const acquired = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of atlas.nodes) if (reached.has(node.id)) {
      for (const id of [node.clearSwitchId, ...node.grants]) if (!acquired.has(id)) { acquired.add(id); changed = true; }
    }
    for (const edge of atlas.edges) if (edge.requires.every(id => acquired.has(id))) {
      if (reached.has(edge.from) && !reached.has(edge.to)) { reached.add(edge.to); changed = true; }
      if (!edge.oneWay && reached.has(edge.to) && !reached.has(edge.from)) { reached.add(edge.from); changed = true; }
    }
  }
  for (const node of atlas.nodes) if (!reached.has(node.id)) issues.push(`해금 순환/단절: ${node.name}`);
  if (atlas.structure === 'run-path') for (const edge of atlas.edges) {
    const from = atlas.nodes.find(n => n.id === edge.from)!, to = atlas.nodes.find(n => n.id === edge.to)!;
    if (!edge.oneWay || to.y >= from.y) issues.push(`런은 위층으로만 전진해야 합니다: ${edge.id}`);
  }
  const reachCache=new Map<string,Set<number>>();
  const reachable=(node:WorldAtlasNode)=>{
    const cached=reachCache.get(node.id);if(cached)return cached;
    const map=project.maps[node.mapId];const seen=new Set<number>();reachCache.set(node.id,seen);if(!map)return seen;
    seen.add(node.entry.y*map.width+node.entry.x);const queue=[node.entry];
    for(let i=0;i<queue.length;i++){const p=queue[i]!;for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const x=p.x+dx!,y=p.y+dy!,key=y*map.width+x;
      if(x<0||y<0||x>=map.width||y>=map.height||seen.has(key)||!canMove(project,map,p.x,p.y,x,y))continue;
      seen.add(key);queue.push({x,y});}}
    return seen;
  };
  const doorKeys=new Set<string>();
  for(const edge of atlas.edges)for(const [id,point,suffix,target]of[[edge.from,edge.fromExit,'_out',edge.to],[edge.to,edge.toExit,'_back',edge.from]] as const){
    if(!point)continue;const node=atlas.nodes.find(n=>n.id===id)!,map=project.maps[node.mapId];if(!map)continue;
    if(!reachable(node).has(point.y*map.width+point.x))issues.push(`닿지 않는 출입구: ${edge.id}${suffix}`);
    const key=`${map.id}:${point.x},${point.y}`;if(doorKeys.has(key))issues.push(`겹친 출입구: ${key}`);doorKeys.add(key);
    const e=map.events.find(e=>e.id===edge.id+suffix);
    if(!e||e.x!==point.x||e.y!==point.y)issues.push(`실제 문 좌표 불일치: ${edge.id}${suffix}`);
    const commands=e?.pages?.[0]?.commands??e?.commands??[];
    const transfers=(list:typeof commands):{mapId:string;x:number;y:number}[]=>list.flatMap(c=>c.kind==='transfer'?[c]:c.kind==='fork'?[...transfers(c.then),...transfers(c.else??[])]:[]);
    const transfer=transfers(commands).find(c=>c.mapId===atlas.nodes.find(n=>n.id===target)!.mapId);
    if(!transfer)issues.push(`실제 이동 누락: ${edge.id}${suffix}`);
    else{const dest=project.maps[transfer.mapId];if(!dest||!isPassable(project,dest,transfer.x,transfer.y))issues.push(`막힌 문 착지: ${edge.id}${suffix}`);
      if(dest?.events.some(e=>e.x===transfer.x&&e.y===transfer.y&&['touch','playerTouch'].includes(e.trigger.kind)))issues.push(`왕복 문 자동 재진입: ${edge.id}${suffix}`);}
  }
  for(const node of atlas.nodes){const map=project.maps[node.mapId];const goal=map?.events.find(e=>e.id===node.id+'_goal');
    if(!goal)issues.push(`관문 이벤트 누락: ${node.name}`);else if(!reachable(node).has(goal.y*map!.width+goal.x))issues.push(`관문에 닿지 않음: ${node.name}`);}
  return { ok: issues.length === 0, issues, nodes: atlas.nodes.length, edges: atlas.edges.length,
    reachableAfterUnlocks: reached.size, structure: atlas.structure };
}
