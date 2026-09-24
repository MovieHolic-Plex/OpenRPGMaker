import { pixelArtWorldDoorCommands, pixelArtWorldDoorGraphic, type PixelArtWorldDoorPack } from '@/project/pixelArtWorldDoors';
import type { TilesetReferenceCategory } from '@/project/tilesetReferences';

/** Pixels come only from the verified user file; no source artwork is bundled. */
export function createPixelArtWorldDoorReferences(pack: PixelArtWorldDoorPack, source: HTMLImageElement, dataUrl: string, assetId: string): TilesetReferenceCategory {
  const images = [{ id: `${pack.id}-source`, name: pack.filename, caption: `원본 ${pack.columns}열×${pack.rows}행. 빈 프레임도 원래 위치에 보존됩니다.`, dataUrl }];
  const documents = [{ id: `${pack.id}-source`, name: '원본·프레임 사전', markdown: `# ${pack.name}\n\n${pack.credit}\n\n[제작자](${pack.sourcePage}) · [이용 조건](${pack.termsUrl})\n\nSHA-256: ${pack.sha256}\n\n원본 ${pack.width}×${pack.height}, 프레임 ${pack.frameWidth}×${pack.frameHeight}, ${pack.columns}열×${pack.rows}행. uploaded sprite ID: \`${assetId}\`.\n\n![원본](image:${pack.id}-source)\n\n전체 row-major 배열:\n\n\`\`\`json\n${JSON.stringify(Array.from({length:pack.rows},(_,r)=>Array.from({length:pack.columns},(_,c)=>r*pack.columns+c)))}\n\`\`\`\n\n전체 crop/알파 영역 사전(범위 x,y,x끝,y끝은 반열림):\n\n\`\`\`json\n${JSON.stringify(pack.frames,null,2)}\n\`\`\`\n\n빈 프레임: ${JSON.stringify(pack.emptyFrameIndices)}. 문 범위 밖/중복 제외: ${JSON.stringify('excludedFrames' in pack ? pack.excludedFrames : [])}. 빈 칸은 문 변형으로 선택하지 않습니다. 개방 배열에 지정된 프레임만 재생합니다. 정적 출입구/장식은 단일 프레임이며 행을 애니메이션으로 해석하지 않습니다. 행을 가로로 재생하면 서로 다른 문이 바뀌는 오류입니다.\n\n원본·가공 소재 재배포 금지. 공개 게임에는 Pixel Art World 크레딧. 사용자 로컬 원본에서만 그림을 생성합니다.\n\n${pack.notes.join('\n\n')}` }];
  for (const variant of pack.variants) {
    const isStatic = variant.openingFrames.length === 1;
    const steps = variant.openingFrames.length;
    const canvas = document.createElement('canvas'); canvas.width = Math.max(220, pack.frameWidth * steps); canvas.height = isStatic ? pack.frameHeight + 16 : pack.frameHeight * 2 + 32;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#50545b'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(isStatic ? 'STATIC: no opening animation' : 'OPEN sequence',4,12); if (!isStatic) ctx.fillText('WRONG: horizontal playback',4,pack.frameHeight+28);
    for (let step=0;step<steps;step++) {
      for (const [frame,y] of (isStatic ? [[variant.openingFrames[step],16]] : [[variant.openingFrames[step],16],[step % pack.columns,pack.frameHeight+32]])) {
        const rect=pack.frames[frame].sourceRect;
        ctx.drawImage(source,rect[0],rect[1],rect[2],rect[3],step*pack.frameWidth,y,pack.frameWidth,pack.frameHeight);
      }
    }
    const imageId=`${pack.id}-${variant.id}`;
    images.push({id:imageId,name:`${variant.name} · ${isStatic ? '정적 원본' : '열림·오류 비교'}.png`,caption:isStatic ? '정적 단일 프레임. 개방 애니메이션 없음. 회색은 투명 영역 진단 배경입니다.' : '위: 지정 배열의 닫힘→열림. 아래: 가로 방향 재생 오류. 회색은 투명 영역 진단 배경이며 게임 바닥이 아닙니다.',dataUrl:canvas.toDataURL('image/png')});
    const fragment={graphic:pixelArtWorldDoorGraphic(assetId,variant),animationType:'fixedGraphic',movement:{type:'fixed',speed:3,frequency:3},commands:pixelArtWorldDoorCommands(variant)};
    documents.push({id:imageId,name:variant.name,markdown:`# ${pack.name} · ${variant.name}\n\n![${isStatic ? '정적 원본' : '열림 및 잘못된 방향 비교'}](image:${imageId})\n\nsource column=${variant.sourceColumn}. openingFrames=${JSON.stringify(variant.openingFrames)}; closingFrames=${JSON.stringify(variant.closingFrames)}. ${isStatic ? "정적 그림입니다. 개방·닫기 명령은 비어 있으며 문을 여는 기능을 제공하지 않습니다." : `각 단계 ${variant.frameTimingMs}ms는 편집 예시이며 제작자 지정 속도가 아닙니다.`}\n\n프레임별 원본 전체 사각형:\n\n\`\`\`json\n${JSON.stringify(variant.openingFrames.map(i=>pack.frames[i].sourceRect))}\n\`\`\`\n\n이벤트 페이지에 적용할 **부분 예제**(완성 문 이벤트 아님):\n\n\`\`\`json\n${JSON.stringify(fragment,null,2)}\n\`\`\`\n\n닫기 명령 전체:\n\n\`\`\`json\n${JSON.stringify(pixelArtWorldDoorCommands(variant,'',true),null,2)}\n\`\`\`\n\n32px 맵·1×1 이벤트·scale1 기준 그림 좌상단은 (event.x*32+16-${pack.frameWidth/2}, event.y*32+32-${pack.frameHeight}). 원점은 프레임 바닥 중앙(0.5,1), 원본 여백을 잘라 재중앙 정렬하지 않습니다. footprint 폭을 늘리면 그림 중심도 바뀌므로 문 앞 타일과 다시 대조하세요. 특히 128px 짝수 폭 그림은 1×1 앵커에서 반 칸 어긋날 수 있습니다.\n\n페이지 조건/trigger/priority/충돌 범위/열린 상태의 통행/이동 목적지/닫힘 복귀는 저작자가 실제 공간에 맞게 추가해야 합니다. 위 setEventGraphicPattern은 그림만 바꾸며 통행을 열지 않습니다. 임의의 자동 반복 애니메이션을 등록하지 않습니다. 투명 개구부 뒤 실제 바닥·벽 받침도 따로 저작하세요.\n\n${pack.notes.join('\n\n')}`});
  }
  return {id:pack.id,name:pack.name,description:'문 물건 그래픽: 원본/열별 프레임/단발 명령 예제. 출입 이벤트·통행 자동 설치 없음.',documents,images};
}
