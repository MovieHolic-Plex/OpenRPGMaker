// Common learning material for the coordinate-independent worldmap atlas.
import { buildWorldmap } from '../lib/worldmapBuild.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
const result = await buildWorldmap({ theme: 'fantasy', terrain: { base: 'shared-v9', ops: [] } });
if (!result.ok || !result.tilemap) throw Error(result.error || 'Material atlas missing');
const p = result.tilemap, tileSize = 16, cols = p.tilesPerRow;
const sheet = PNG.sync.read(Buffer.from(p.imageDataUrl.split(',')[1], 'base64'));
const image = (width, height) => new PNG({ width, height });
function cell(out, tile, x, y, scale = 1) {
  for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
    const from = ((Math.floor(tile / cols) * 16 + dy) * sheet.width + tile % cols * 16 + dx) * 4;
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const to = ((y + dy * scale + sy) * out.width + x + dx * scale + sx) * 4;
      sheet.data.copy(out.data, to, from, from + 4);
    }
  }
}
const dir = 'public/assets/worldmap-icons-references', source = 'tiledata/worldmap-kit/selected/materials';
await mkdir(dir, { recursive: true }); await mkdir(source, { recursive: true });
const atlas = image(8 * 64, Math.ceil(p.groups.length / 8) * 64);
p.groups.forEach((g, i) => cell(atlas, g.representative, i % 8 * 64, Math.floor(i / 8) * 64, 4));
await writeFile(`${dir}/materials.png`, PNG.sync.write(atlas));
// An actual 3x2 grass neighborhood, with a deliberately wrong sea tile next to it.
const g = p.groups.find(g => g.name === '초원');
const center = p.lowerTiles.findIndex(t => t === g.representative);
const x = Math.min(result.world.width - 3, center % result.world.width), y = Math.min(result.world.height - 2, Math.floor(center / result.world.width));
const rows = Array.from({ length: 2 }, (_, dy) => Array.from({ length: 3 }, (_, dx) => p.lowerTiles[(y + dy) * result.world.width + x + dx]));
const bad = structuredClone(rows); bad[0][0] = p.groups.find(g => g.name === '바다').representative;
if (bad[0][0] === rows[0][0]) throw Error('Error example must differ');
const comparison = image(624, 192);
for (const [n, a] of [rows, bad].entries()) a.forEach((row, dy) => row.forEach((t, dx) => cell(comparison, t, n * 336 + dx * 96, dy * 96, 6)));
await writeFile(`${dir}/material-example.png`, PNG.sync.write(comparison));
const inventory = p.groups.map((g, i) => ({ number: i + 1, name: g.name, representative: g.representative,
  sourceCell: { x: g.representative % cols, y: Math.floor(g.representative / cols) }, pixel: { x: g.representative % cols * 16, y: Math.floor(g.representative / cols) * 16 },
  variants: g.tiles, material: p.tiles[g.representative] }));
const markdown = `# 세계 지도 지형 재료와 지도 배열\n\nworldmap_<mapId>, family=worldmap-kit, 16px, uploaded worldmap_<mapId>_materials, 12열. 지도 그림은 picture worldmap_<mapId>_image이며 팔레트가 아니다. 여기 번호는 fantasy/shared-v9/ops=[] 표본이다. 다른 판본에서는 inspect_tileset의 현재 tileGroups와 tileMeta를 읽는다. 아래 material.key는 픽셀·통행·지형 이름의 SHA256이다. 번호나 대표 그림을 다른 지도에 그대로 복사하지 않는다.\n\n## 저작 순서와 레이어\n\n1. read_world_terrain으로 좌표·장소·여정을 읽고 edit_world_terrain으로 대륙·해안·강·길·숲을 함께 생성한다. 큰 형상은 ops로 바꾼다.\n2. 바닥은 lowerTiles, upperTiles는 사람 선택 거점의 전체 배열이다. 바닥의 숲·산·길은 이미 합성된 칸이다. 대표 재료는 반복할 수 있지만 해안·모서리를 자동 연결하는 오토타일은 아니다. 경계는 캔버스 스포이트로 원본 변형을 가져온다.\n3. 거점은 wmi-fantasy/desert-east/modern-sf의 전체 사전과 그림을 읽은 뒤 stamp_worldmap_icon으로 찍는다. 아래 타일 -1은 기존 지형 보존이다. 회전·늘리기·부품 재조립 금지. 건물·가구·울타리·실내 부품은 이 지형 사전에 없다. 실내는 atlas_biome_interior, 던전은 atlas_biome_dungeon의 현재 참고문서를 읽는다.\n4. 생성된 거점은 ★로 기존 world.walk를 따른다. 사람이 새로 찍은 거점은 아이콘의 밑줄/입구 통행 계약을 따른다. 투명성과 통행을 혼동하지 않는다. 문 그림과 전이 이벤트는 별개다.\n5. 재생성은 기준 배열과 손 편집을 비교한다. 새 atlas에 같은 material.key가 없는 손 편집은 실패하며 저장하지 않는다. 별도 mapId로 생성한다.\n\n## 전체 지형 사전\n\n![사전 순서대로 8열, 각 칸 4배 nearest](image:wmi-materials-sheet)\n\n${inventory.map(g => '### ' + g.number + '. ' + g.name + '\n\n```json\n' + JSON.stringify(g) + '\n```').join('\n\n')}\n\n## 실제 조립 예제와 오류\n\n입력: fantasy/shared-v9, 원점 (${x},${y}), 폭3 높이2. 원본 48×32 픽셀을 6배 nearest로 확대한 그림이다. 위층은 비워 지형만 보인다. 왼쪽은 실제 배열, 오른쪽은 첫 칸을 바다로 바꾼 STORED_WORLD_TILE_MISMATCH, 실제 맵 좌표 (${x},${y}). 준비 스크립트가 배열 불일치를 검출한다. 실행 중 일반 지형 붓이 이 편집을 금지한다는 뜻은 아니다.\n\n\`\`\`json\n${JSON.stringify({ origin: { x, y }, lower: rows, upper: [[-1,-1,-1],[-1,-1,-1]], errorLower: bad }, null, 2)}\n\`\`\`\n\n![왼쪽 정상, 오른쪽 잘못된 바다 한 칸](image:wmi-materials-example)\n\n범위: 준비 단계의 배열/원본 좌표 검사와 실제 도구 변환의 픽셀/네 방향 통행/SQLite 재로드를 확인한다. 이벤트 실행, 미적 품질, 다른 모델 성공률을 대신 보증하지 않는다.\n`;
await writeFile(`${source}/README.md`, markdown);
await writeFile('src/assets/worldmapMaterialReferences.json', JSON.stringify([{ id: 'wmi-materials', name: '월드맵 · 지형 재료', description: '지도 좌표와 재사용 재료의 분리·전체 사전·실제 배열', documents: [{ id: 'wmi-materials-contract', name: '지형 사전·레이어·정상/오류', markdown }], images: [{ id: 'wmi-materials-sheet', name: '실제 대표 지형', caption: '8열, 사전 순서, nearest 4배', dataUrl: '/assets/worldmap-icons-references/materials.png' }, { id: 'wmi-materials-example', name: '실제 지형 배열 정상/오류', caption: '왼쪽 정상, 오른쪽 첫 칸을 바다로 변경', dataUrl: '/assets/worldmap-icons-references/material-example.png' }] }], null, 2) + '\n');
console.log(`Common materials: ${p.groups.length} groups, ${p.tiles.length} variants; example (${x},${y})`);
