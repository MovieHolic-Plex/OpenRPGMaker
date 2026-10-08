import type { Project } from '@/project/types';

/** Image delivery proves coverage of a version, never artistic acceptance. */
export class PiMapVisualCoverage {
  private readonly views = new Map<string, { signature: string; rects: {x:number;y:number;w:number;h:number}[] }>();
  private signature(project: Project, id: string): string {
    const map = project.maps[id];
    if (!map) return '';
    const { events, name: _name, bgm: _bgm, ...geometry } = map;
    const tileset = project.tilesets[map.tilesetId];
    return JSON.stringify({ geometry, events: events.map(e => ({x:e.x,y:e.y,pages:e.pages.map(p=>({graphic:p.graphic,conditions:p.conditions}))})),
      tileset, asset: tileset?.image.type === 'uploaded' ? project.assets.uploaded[tileset.image.id] : undefined });
  }
  record(project: Project, data: unknown): void {
    const r = data as {mapId?:string;x?:number;y?:number;w?:number;h?:number} | undefined;
    if (!r?.mapId || !project.maps[r.mapId] || ![r.x,r.y,r.w,r.h].every(Number.isInteger) || r.w! <= 0 || r.h! <= 0) return;
    const signature = this.signature(project,r.mapId);
    const previous = this.views.get(r.mapId);
    const rects = previous?.signature === signature ? previous.rects : [];
    rects.push({x:r.x!,y:r.y!,w:r.w!,h:r.h!});
    this.views.set(r.mapId,{signature,rects});
  }
  inspect(project: Project, base: Project): {mapId:string;problems:string[]}[] {
    const issues: {mapId:string;problems:string[]}[] = [];
    for (const map of Object.values(project.maps)) {
      const signature = this.signature(project,map.id);
      if (signature === this.signature(base,map.id)) continue;
      const view = this.views.get(map.id);
      if (!view || view.signature !== signature) {
        issues.push({mapId:map.id,problems:['최종 변경 뒤 실제 맵 이미지를 전달하지 않았습니다. 전체 show_map_region을 호출하세요.']}); continue;
      }
      let covered = 0;
      for (let y=0;y<map.height;y++) {
        const spans = view.rects.filter(r=>y>=r.y&&y<r.y+r.h).map(r=>[Math.max(0,r.x),Math.min(map.width,r.x+r.w)]).filter(r=>r[1]!>r[0]!).sort((a,b)=>a[0]!-b[0]!);
        let end=0;
        for(const [left,right] of spans) { covered += Math.max(0,right!-Math.max(end,left!)); end=Math.max(end,right!); }
      }
      if (covered < map.width*map.height) issues.push({mapId:map.id,problems:[`최종 맵 이미지 범위 ${covered}/${map.width*map.height}칸. 전체 show_map_region이 필요합니다.`]});
    }
    return issues;
  }
}
