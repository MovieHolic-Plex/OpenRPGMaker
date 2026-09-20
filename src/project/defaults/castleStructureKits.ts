import type { SectionStructureKitDef } from '../types';
import { CASTLE_MEASURED_PARTS } from './castleMeasuredParts';

/** Only complete, measured original-atlas objects. Boats/crops are separate packs. */
export function createCastleStructureKits(): SectionStructureKitDef[] {
  return CASTLE_MEASURED_PARTS.map(part=>{
    const [sx,sy,width,height]=part.rect;
    return {
      id:`castle-measured-${part.id}`,name:part.name,kind:'section',width,height,
      rows:Array.from({length:height},(_,y)=>{
        const cells=Array.from({length:width},(_,x)=>
          part.id==='clock-tree' && x>=4 && y<2 ? -1 : (sy+y)*32+sx+x);
        return part.layer==='lower' ? {tiles:cells,upperTiles:Array(width).fill(-1)}
          : {tiles:Array(width).fill(-1),upperTiles:cells};
      }),
      learnedFrom:'db-authored',
      ai:{description:`Castle2 원본의 완성 부품 (${sx},${sy},${width},${height}), 16px 단위`,
        placementRules: part.id==='paving' || part.id==='roof'
          ? '늘릴 때 2칸 테두리를 한 번만 유지하고 내부 2×2만 반복. 지붕은 지상 통로가 아님.'
          : part.id==='gate' || part.id==='door'
            ? '문 전체를 배치. 외관만으로 통행을 열지 말고 별도 입구/전송을 저작.'
            : '전체 크기 유지. 덧그림 아래 지형 보존. 빈 모서리는 점유하지 않음.',
        role:part.layer==='lower'?'terrain':'prop',layerHome:part.layer,
        repeatability:'fixed',origin:'ai',confidence:'high',tags:['성채','실측']},
    };
  });
}
