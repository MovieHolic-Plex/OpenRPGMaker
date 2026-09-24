import { XP_AUTOTILE_MASKS, xpFullAutotileQuarters, xpAutotilePlacementExample, validateXpAutotilePlacementExample, xpAutotileGroup, type PixelArtWorldAutotilePack } from '@/project/pixelArtWorldAutotiles';
import type { TilesetReferenceCategory } from '@/project/tilesetReferences';
import type { TilesetDef } from '@/project/types';
import { tileLayerHome } from './tileLayerClassification';

export interface PixelArtWorldAutotileReferenceOptions {
  referenceBackingTile: number;
  referenceBackingLabel?: string;
}

export function drawXpAutotile(context: CanvasRenderingContext2D, source: CanvasImageSource, mask: number, x: number, y: number, frame = 0): void {
  for (const quarter of xpFullAutotileQuarters(mask)) {
    context.drawImage(source, frame * 96 + quarter.sx, quarter.sy, 16, 16, x + quarter.dx, y + quarter.dy, 16, 16);
  }
}

/** The sample backing is an actual opaque target tile, never invented source pixels. */
function sampleBacking(base?: { image: HTMLImageElement; tileset: TilesetDef }, options?: PixelArtWorldAutotileReferenceOptions): number | null {
  if (options) {
    const tile = options.referenceBackingTile;
    if (!base || !Number.isInteger(tile) || tile < 0 || tile >= base.tileset.count) throw new Error('참고 그림 받침은 대상 타일셋 안의 정수 타일 ID여야 합니다.');
    if (tileLayerHome(base.tileset, tile) !== 'lower') throw new Error('참고 그림 받침은 하위 레이어 타일이어야 합니다.');
    if (options.referenceBackingLabel !== undefined && (typeof options.referenceBackingLabel !== 'string' || !options.referenceBackingLabel.trim() || options.referenceBackingLabel.length > 160)) throw new Error('참고 그림 받침 이름은 1~160자로 입력하세요.');
  }
  if (!base) return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const first = options?.referenceBackingTile ?? 0;
  const end = options ? first + 1 : base.tileset.count;
  for (let tile = first; tile < end; tile++) {
    if (tileLayerHome(base.tileset, tile) !== 'lower') continue;
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(base.image, tile % base.tileset.tilesPerRow * 32, Math.floor(tile / base.tileset.tilesPerRow) * 32, 32, 32, 0, 0, 32, 32);
    const rgba = ctx.getImageData(0, 0, 32, 32).data;
    if (rgba.every((value, i) => i % 4 !== 3 || value === 255)) return tile;
  }
  if (options) throw new Error('참고 그림 받침의 32×32 픽셀이 모두 불투명해야 합니다.');
  return null;
}

export function createPixelArtWorldAutotileReferences(pack: PixelArtWorldAutotilePack, image: HTMLImageElement, sourceDataUrl: string, offset: number, tilesetId: string,
  tileIds = XP_AUTOTILE_MASKS.map((_, i) => offset + i), base?: { image: HTMLImageElement; tileset: TilesetDef }, options?: PixelArtWorldAutotileReferenceOptions): TilesetReferenceCategory {
  const atlas = document.createElement('canvas'); atlas.width = 256 * pack.frames; atlas.height = 192;
  const ctx = atlas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  for (let frame = 0; frame < pack.frames; frame++) XP_AUTOTILE_MASKS.forEach((mask, i) => drawXpAutotile(ctx, image, mask, frame * 256 + i % 8 * 32, Math.floor(i / 8) * 32, frame));
  const example = xpAutotilePlacementExample(pack, tileIds);
  const backingTile = sampleBacking(base, options);
  const template = pack.id === 'paw-groundbase01';
  const templateNotice = '편집 템플릿: 불투명 청록색 바깥 영역과 투명 중심이 포함돼 있다. 받침만 추가해도 완성 지형이 되지 않는다. 정상 완성 장면으로 사용하지 않는다.';
  const backingDescription = options
    ? `명시한 받침: ${options.referenceBackingLabel?.trim() ?? '사용자 지정'} (tile=${backingTile}). 실제 하위 타일과 불투명 픽셀을 확인했다. 장면 용도·통행 적합성은 저자가 별도로 판단한다.`
    : `진단용 받침: ${backingTile ?? '미확보'}. 대상 시트의 첫 불투명 lower 타일을 골랐을 뿐이며, 이 용도의 정상 받침으로 승인한 것이 아니다. ${pack.underlay} 용도·통행 적합성을 확인해 명시적으로 선택해야 한다.`;
  const comparisonTitle = template ? '원본 템플릿 배치 / 의도적 오류' : options ? '지정 받침 조립 / 의도적 오류' : '임시 받침 조립 진단 / 의도적 오류';
  // Backing is part of the complete sample arrays, including around the footprint.
  if (backingTile !== null) example.lowerTiles = example.lowerTiles.map(tile => tile < 0 ? backingTile : tile);
  const layer = pack.defaultLayer === 'lower' ? 'lowerTiles' : 'upperTiles';
  const other = pack.defaultLayer === 'lower' ? 'upperTiles' : 'lowerTiles';
  const bad = { ...example, lowerTiles: [...example.lowerTiles], upperTiles: [...example.upperTiles] };
  const occupied = example[layer].flatMap((tile, i) => tileIds.includes(tile) ? [i] : []);
  const [corner, moved, removed] = occupied;
  bad[layer][corner] = tileIds[XP_AUTOTILE_MASKS.indexOf(255)];
  bad[other][moved] = bad[layer][moved]; bad[layer][moved] = layer === 'lowerTiles' ? (backingTile ?? -1) : -1;
  bad[layer][removed] = layer === 'lowerTiles' ? (backingTile ?? -1) : -1;
  const errors = validateXpAutotilePlacementExample(pack, tileIds, bad, backingTile);
  const comparison = document.createElement('canvas'); comparison.width = example.width * 64 + 8; comparison.height = example.height * 32;
  const compare = comparison.getContext('2d')!; compare.imageSmoothingEnabled = false;
  const draw = (map: typeof example, ox: number) => {
    for (const values of [map.lowerTiles, map.upperTiles]) values.forEach((tile, i) => {
      if (tile < 0) return;
      const x = ox + i % map.width * 32, y = Math.floor(i / map.width) * 32;
      const variant = tileIds.indexOf(tile);
      if (variant >= 0) drawXpAutotile(compare, image, XP_AUTOTILE_MASKS[variant], x, y);
      else if (base) compare.drawImage(base.image, tile % base.tileset.tilesPerRow * 32, Math.floor(tile / base.tileset.tilesPerRow) * 32, 32, 32, x, y, 32, 32);
    });
  };
  draw(example, 0); draw(bad, example.width * 32 + 8);
  const dictionary = XP_AUTOTILE_MASKS.map((mask, i) => ({ tile: tileIds[i], mask, frames: Array.from({ length: pack.frames }, (_, frame) => ({ tile: tileIds[i] + frame, quarters: xpFullAutotileQuarters(mask).map(q => ({ ...q, sx: q.sx + frame * 96, width: 16, height: 16 })) })) }));
  const json = (value: unknown) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
  return {
    id: pack.id, name: `${template ? '편집 템플릿 · ' : ''}${pack.name} · ${pack.placement === 'lower-autoshape' ? '자동 연결' : '수동 조립'}`,
    description: `${template ? templateNotice + ' ' : ''}${pack.sourceWidth}×128 XP, ${pack.frames}프레임, 47마스크. ${pack.defaultLayer}/${pack.passage}. ${pack.shapePolicy}.`,
    images: [
      { id: 'source', name: pack.filename, caption: `사용자가 가져온 실제 ${pack.sourceWidth}×128 원본. ${pack.frames}개의 가로 96×128 프레임.`, dataUrl: sourceDataUrl },
      { id: 'variants', name: 'variants.png', caption: `프레임별 8열×6행 실제 합성 47종, 마지막 공백 제외. ${pack.frames} 패널은 시간 순서. 타일 ID는 사전을 따른다.`, dataUrl: atlas.toDataURL('image/png') },
      { id: 'comparison', name: 'connections-comparison.png', caption: `왼쪽/오른쪽: ${comparisonTitle}. 32px 실물. ${backingDescription} ${template ? templateNotice : ''}`, dataUrl: comparison.toDataURL('image/png') },
    ],
    documents: [
      { id: 'read-first', name: '먼저 읽기.md', markdown: [
        `# ${pack.name}\n\ntilesetId: ${tilesetId}\n\n${pack.description}${template ? '\n\n' + templateNotice : ''}`,
        `원본: ${pack.filename}, ${pack.sourceWidth}×128px XP. SHA-256: ${pack.sha256}. 확인일 ${pack.checkedAt}.`,
        `[제작자](${pack.sourcePage}) · [이용 조건](${pack.termsUrl})\n\n${pack.credit}\n\n원본/가공 소재를 재배포하지 않는다. 첨부 그림은 사용자 원본에서 로컬 생성했다.`,
        `## 참고 그림 받침\n\n${backingDescription}${pack.referenceExample ? "\n\n"+pack.referenceExample.purpose : ""}`,
        ...(pack.archiveSources ? ["## 사용자 ZIP 원본\n\n공식 ZIP을 사용자가 내려받아 아래 member PNG를 추출한다. 앱은 ZIP/PNG를 자동 다운로드하지 않는다.\n\n"+json(pack.archiveSources)] : []),
        `## 레이어·통행·지형\n\n홈=${pack.defaultLayer}, 통행=${pack.passage}, 용도=${pack.surface}, 지형 태그=0(중립; 물 피해·수영 등 효과 없음). 받침=${pack.underlay}. 투명 여부와 홈 레이어는 별개다. ${pack.restrictions.join(' ')}`,
        `## 저작 순서\n\n1. 모든 MD/실물 그림을 읽는다.\n2. 용도와 통행 영역, 받침을 정한다.\n3. ${pack.placement === 'lower-autoshape' ? 'lower에 같은 그룹을 칠하면 8방향 자동 성형한다.' : '전체 배열의 마스크 사전으로 수동 배치한다. 자동 성형 그룹은 등록하지 않는다.'}\n4. ${pack.shapePolicy === 'rectangle' ? '최소 2×2 직사각형만 사용한다. 띠/구멍/분기는 금지한다.' : '외딴 점·얇은 선·볼록/오목 모서리의 모든 쿼터를 사용한다. 최소 1×1.'}\n5. upper 배치는 기존 lower 받침을 보존한다. 필요한 바탕이 없으면 저작을 중단하고 먼저 바닥/벽/지붕을 확보한다.\n6. 문/전면 벽/접근칸/이벤트는 별도로 저작한다. 원본 12칸을 완성 타일처럼 복사하지 않는다.`,
        '마스크: N=1,E=2,S=4,W=8,NE=16,SE=32,SW=64,NW=128. 대각은 양쪽 직교가 연결된 경우만 유효. 맵 밖은 비연결. 서로 다른 재료를 자동 연결하지 않는다.',
        `## 애니메이션\n\n${pack.frames === 4 ? `각 마스크의 baseTile부터 4개 가로 연속 프레임. 원본 순서 0→1→2→3 반복, ${pack.fps}fps는 편집기 기본 선택이며 제작자 지정 속도가 아니다. 반복된 원본 프레임도 제거하지 않는다. animationStrips를 보존해야 런타임에서 움직인다.` : '정적 원본. 애니메이션 스트립을 만들지 않는다.'}`,
        '![원본](image:source)\n\n![모든 프레임/변형](image:variants)',
      ].join('\n\n') },
      { id: 'dictionary', name: '쿼터와 변형 사전.md', markdown: ['# 현재 아틀라스의 정확한 사전',
        '좌표는 원본 PNG의 0기준 픽셀. NW/NE/SW/SE 각각 16×16. 확대·회전·반전 없음. frame별 sx에 96px 간격이 포함돼 있다. 행 정렬 공백은 소재가 아니다. 이 ID를 다른 타일셋에 적용하지 않는다.', `\`\`\`json\n${JSON.stringify(dictionary)}\n\`\`\``,
        '## 256입력 → 배치할 baseTile', json(xpAutotileGroup(pack, offset, tileIds).variantMap),
        '수동 그룹에도 위 매핑으로 전체 배열을 만들 수 있으나 upper 붓 자동 성형 기능을 의미하지 않는다.',
        '## 판본 별칭(같은 SHA만 허용)', json(pack.aliases),
      ].join('\n\n') },
      { id: 'examples', name: template ? '편집 템플릿 배열과 오류.md' : '조립 배열과 오류.md', markdown: [
        `# ${template ? '편집 템플릿 — ' : ''}${pack.referenceExample ? '용도별 작은 고정 조립' : pack.shapePolicy === 'rectangle' ? '직사각형 조립' : '직사각형·구멍·외딴 점·얇은 선·분기'} 전체 배열`,
        `원점=(0,0). ${pack.defaultLayer}에 소재를 배치한다. -1은 이 예제가 점유하지 않는 칸. 기존 바닥을 지우라는 뜻이 아니다. ${backingDescription} ${template ? templateNotice : ''} 받침 미확보 상태는 완성 장면으로 사용하지 않는다.`,
        json(example), `![${comparisonTitle}](image:comparison)`, '## 의도적으로 잘못 놓은 전체 배열', json(bad),
        '## 정확한 배열 대조로 확인한 오류 좌표', json(errors),
        '이 자료는 지정 마스크/레이어 배열과 실제 쿼터 그림을 연결한다. 방/건물의 미학, 다른 소재와의 접합, 통행 경로, 문 이벤트 실행, AI 성공률을 검증하지 않는다. 직사각형 제한 소재는 47종 전부가 보기 좋은 구조임을 주장하지 않는다.',
      ].join('\n\n') },
    ],
  };
}
