// Rasak 굽기 결과(manifest + atlas) → OPRN 타일셋·자산. publish-study-project.mjs(새 연구 프로젝트)와
// apply-assistant-pack.mts add(기존 연구 프로젝트에 새 묶음 추가)가 같이 쓴다. 그림은 저장소 밖에서만 읽는다.
import { PNG } from 'pngjs';

// Heuristic passage until per-tile flags are authored: water and walls block, floors pass,
// objects block when they cover most of the cell. Documented in tiledata/rasak-fantasy/README.md.
export function passageOf(entry, coverage, entries = [], covers = []) {
  if (!entry || entry.empty) return 'passable';
  if (entry.slot === 'composite')
    return entry.partTiles.some((t) => passageOf(entries[t], covers[t]) === 'solid') ? 'solid' : 'passable';
  if (entry.slot === 'A1') return 'solid';
  if (entry.slot === 'A3' || entry.slot === 'A4') return 'solid';
  if (entry.slot === 'A2' || entry.slot === 'A5' || entry.slot === 'shadow') return 'passable';
  return coverage > 0.5 ? 'solid' : 'passable';
}

/** 칸마다 불투명(알파 > 200) 픽셀 비율. */
export function atlasCoverage(manifest, atlasBytes) {
  const png = PNG.sync.read(atlasBytes);
  return manifest.entries.map((_, i) => {
    const tx = (i % manifest.tilesPerRow) * 48, ty = Math.floor(i / manifest.tilesPerRow) * 48;
    if (ty + 48 > png.height) return 0;
    let n = 0;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (png.data[((ty + y) * png.width + tx + x) * 4 + 3] > 200) n++;
    return n / 2304;
  });
}

export function tilesetFor(manifest, atlasBytes, coverage) {
  const assetId = `${manifest.bundle}_image`;
  const cells = manifest.entries.map((e, i) => ({ e, passage: passageOf(e, coverage[i], manifest.entries, coverage) }));
  const asset = { id: assetId, name: manifest.name, kind: 'tileset', dataUrl: 'data:image/png;base64,' + atlasBytes.toString('base64'),
    meta: { tileSize: manifest.tileSize, width: manifest.tilesPerRow * manifest.tileSize, height: Math.ceil(manifest.count / manifest.tilesPerRow) * manifest.tileSize } };
  const isUpper = (e) => !!e && (e.slot === 'composite' ? e.layer === 'upper' : /^[B-E]$|^X\d+$/.test(e.slot));
  const tileset = {
    id: manifest.bundle, name: manifest.name, image: { type: 'uploaded', id: assetId }, kind: 'custom',
    // 칩셋 계열(tilesetFamily): Rasak 묶음끼리는 같은 그림체라 조수가 말없이 오가도 된다.
    family: 'rasak-fantasy',
    tileSize: manifest.tileSize, tilesPerRow: manifest.tilesPerRow, count: manifest.count,
    passability: cells.map(({ passage }) => { const p = passage === 'passable'; return { up: p, down: p, left: p, right: p }; }),
    priority: cells.map(({ e }) => (isUpper(e) ? 'upper' : 'lower')),
    terrain: cells.map(() => 0),
    animationStrips: manifest.animationStrips,
    tileMeta: cells.map(({ e, passage }, tile) => ({
      label: !e ? `빈칸 ${tile}` : e.slot === 'composite' ? `프리뷰 합성 ${e.layer} ${tile}` : e.slot === 'shadow' ? `MZ 그림자 ${e.bits}` : e.n !== undefined ? `${e.slot} ${e.n}` : `${e.slot} kind ${e.kind} shape ${e.shape}${e.frame ? ` f${e.frame}` : ''}`,
      description: !e ? '' : e.slot === 'composite'
        ? `프리뷰 재현용 합성 칸(OPRN 은 칸당 2층). 구성 atlas ${e.partTiles.join('+')} · MZ ${e.parts.map((p) => p ?? '그림자').join('+')}`
        : `Rasak ${manifest.bundle} · MZ tileId ${e.mzTileId ?? '-'} · 원본 ${manifest.sections.find((s) => s.slot === e.slot)?.file ?? '합성 그림자'}`,
      defaultLayer: isUpper(e) ? 'upper' : 'lower', passage, source: 'imported',
    })),
    tileGroups: [],
  };
  return { asset, tileset };
}
