import type { SectionStructureKitDef } from "../../src/project/types";

/** Read visible facade geometry from the baked tiles, without trusting the plan. */
export function reviewHouseRoofDepth(kit:SectionStructureKitDef) {
  const facades:{x:number;y:number;width:number}[]=[];
  for(let y=0;y<kit.height;y++)for(let x=0;x<kit.width;x++) {
    if(kit.rows[y]!.tiles[x]!==15)continue;
    let end=x+1;
    while(kit.rows[y]!.tiles[end]===16)end++;
    if(kit.rows[y]!.tiles[end]===17 && end-x>=2)facades.push({x,y,width:end-x+1});
  }
  const issues:string[]=[];
  for(let i=1;i<facades.length;i++) {
    const facade=facades[i]!,eave=kit.rows[facade.y-1];
    const left=eave?.upperTiles?.[facade.x],right=eave?.upperTiles?.[facade.x+facade.width-1];
    if(![384,386].includes(left ?? -1))issues.push(`층 경계 y=${facade.y}: 왼쪽 처마 모서리 없음`);
    if(![385,387].includes(right ?? -1))issues.push(`층 경계 y=${facade.y}: 오른쪽 처마 모서리 없음`);
    // The top dormer retains the reviewed 2-storey design. Additional tiers need
    // a trim column AND a visible slope column on each side of the upper building.
    if(i>=2) {
      const above=facades[i-1]!;
      if(above.x-facade.x<2)issues.push(`층 경계 y=${facade.y}: 왼쪽 경사면 폭 부족`);
      if(facade.x+facade.width-above.x-above.width<2)issues.push(`층 경계 y=${facade.y}: 오른쪽 경사면 폭 부족`);
    }
  }
  return {kitId:kit.id,visibleFloors:facades.length,facades,issues};
}
