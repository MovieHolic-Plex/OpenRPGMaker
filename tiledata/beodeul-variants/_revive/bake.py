# 웨이브 장소 되살리기 3단계 — 원본 그림을 16px 칸으로 잘라 공용 번들 칩셋 beodeul_wave_places 와 장소 맵(등록 장소 스냅숏)을 굽는다.
#   python3 bake.py            → public/assets/beodeul-wave-places/*.png, src/assets/beodeulWavePlaces{Sheet,Tileset}.json,
#                                src/project/regionReferences/beodeul-wave-places.json, public/assets/region-references/bd-wave-*.png,
#                                tiledata/beodeul-variants/_revive/out/report.json
# 칸 규칙: 아래층 = 원본 칸 그대로(불투명). 위층 = 키 큰 물체 화소만(layers.py). 걷는 칸의 위층 = ★(사람 위), 막힌 칸의 위층 = 막힌 물체(y 정렬).
# 통행 = 스크립트 장면 상태(빙하기 설원은 원본 분할)에서 4방향. 같은 그림·층·통행인 칸은 한 칸을 같이 쓴다.
import os, sys, json, hashlib
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import layers as L

COLS = 128
TS_ID, TEX = 'beodeul_wave_places', 'tex_beodeul_wave_places'
# (장소 id, 원본 장소, 이름, 자를 줄 [y0,y1), 설명)
MAPS = [
    ('bd-wave-ash-plain', 'volcano-field', '재의 들판', (31, 52), 'ash'),
    ('bd-wave-volcano-field', 'volcano-field', '화산 지대 필드', (0, 52), None),
    ('bd-wave-ruined-village', 'ruined-village', '폐허 마을 (새벽샘 터)', (0, 48), None),
    ('bd-wave-ice-age-field', 'ice-age-field', '빙하기 설원 (얼음 호수)', (0, 52), None),
    ('bd-wave-mountain-fortress', 'mountain-fortress', '산악 요새 (관문 요새)', (0, 56), None),
]

def remove_lava_pool(O, y0, y1):
    """재의 들판: 들판에 남은 작은 용암 웅덩이 칸을 옆 잿빛 칸 그림으로 덮는다(「용암 뺌」). 칸 단위 복사 — 새 그림 없음."""
    H, W = (y1 - y0), O.shape[1] // 16
    def hot(cy, cx):
        c = O[(y0 + cy) * 16:(y0 + cy + 1) * 16, cx * 16:(cx + 1) * 16, :3].astype(int)
        return int(((c[..., 0] > 200) & (c[..., 1] > 60) & (c[..., 1] < 170) & (c[..., 2] < 90)).sum())
    fixed = []
    for cy in range(H):
        for cx in range(W):
            if hot(cy, cx) >= 6:
                for dx in (-4, 4, -5, 5, -6, 6):
                    sx = cx + dx
                    if 0 <= sx < W and hot(cy, sx) == 0:
                        O[(y0 + cy) * 16:(y0 + cy + 1) * 16, cx * 16:(cx + 1) * 16] = O[(y0 + cy) * 16:(y0 + cy + 1) * 16, sx * 16:(sx + 1) * 16]
                        fixed.append((cx, cy)); break
    return fixed

def main():
    tiles = [np.zeros((16, 16, 4), np.uint8)]           # 0 = 빈 칸
    meta = [('lower', (True, True, True, True), 'empty', '')]
    index = {}
    def tile_of(px, layer, flags, place, kind):
        key = hashlib.sha1(px.tobytes()).hexdigest() + layer + ''.join('1' if f else '0' for f in flags)
        t = index.get(key)
        if t is None:
            t = len(tiles); index[key] = t; tiles.append(px.copy()); meta.append((layer, tuple(bool(f) for f in flags), place, kind))
        return t
    built = {}; report = {}
    cache = {}
    for mid, place, name, (y0, y1), mode in MAPS:
        if place not in cache: cache[place] = L.build(place)
        r = cache[place]
        O = r['O'].copy(); walk, up, flags = r['walk'], r['up'], r['flags'].copy()
        fixed = []   # 작은 용암 웅덩이(3×2)는 원본 그대로 둔다 — 칸 복사로 덮으면 불씨가 남아 깨져 보였다(r1). 용암 강은 자르기로 뺐다.
        W = O.shape[1] // 16; H = y1 - y0
        for (cx, cy) in fixed: up[(y0 + cy) * 16:(y0 + cy + 1) * 16, cx * 16:(cx + 1) * 16] = False
        if y0 > 0: flags[y0, :, 0] = walk[y0, :]          # 잘린 북쪽 끝 = 출구로 열어 둔다
        lower, upper = [], []
        for cy in range(H):
            y = y0 + cy
            for x in range(W):
                cell = O[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16].copy(); cell[..., 3] = 255
                f = tuple(flags[y, x]) if walk[y, x] else (False,) * 4
                lower.append(tile_of(cell, 'lower', f, place, 'ground'))
                m = up[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
                if m.sum() >= 4:
                    u = np.zeros((16, 16, 4), np.uint8); u[m] = cell[m]
                    upper.append(tile_of(u, 'upper', (True,) * 4 if walk[y, x] else (False,) * 4, place, 'star' if walk[y, x] else 'object'))
                else:
                    upper.append(-1)
        entry = r['st']['entry']; ex, ey = entry[0], entry[1] - y0
        if not (0 <= ey < H):                                # 잘린 맵: 남쪽 끝 걷는 칸 중 원래 입구에 가까운 칸
            ey = H - 1
        seen = L.reach(r, entry) if y0 == 0 else None
        marks = {k: [v[0], v[1] - y0] for k, v in r['st']['marks'].items() if y0 <= v[1] < y1}
        # 입구에서 걸어 닿는 칸(잘린 맵 안, 4방향 통행 그대로)
        from collections import deque
        fl = flags[y0:y1]; wk = walk[y0:y1]
        start = (ex, ey) if wk[ey, ex] else next(((x, ey) for d in range(W) for x in (ex - d, ex + d) if 0 <= x < W and wk[ey, x]), (ex, ey))
        seen = {start}; q = deque([start])
        while q:
            x, y = q.popleft()
            for k, (dx, dy) in enumerate(((0, -1), (0, 1), (-1, 0), (1, 0))):
                nx, ny = x + dx, y + dy
                if fl[y, x, k] and 0 <= nx < W and 0 <= ny < H and wk[ny, nx] and (nx, ny) not in seen: seen.add((nx, ny)); q.append((nx, ny))
        ex, ey = start
        built[mid] = dict(reached=len(seen), name=name, place=place, W=W, H=H, lower=lower, upper=upper, y0=y0, entry=[ex, ey], marks=marks, fixed=fixed,
                          walkable=int(walk[y0:y1].sum()))
        report[mid] = dict(name=name, place=place, size=[W, H], walkable=int(walk[y0:y1].sum()), upperCells=sum(1 for t in upper if t >= 0),
                           lavaCellsCovered=len(fixed), entry=[ex, ey], reached=len(seen))
        print(mid, W, H, 'walk', report[mid]['walkable'], 'upper cells', report[mid]['upperCells'], 'tiles so far', len(tiles))
    # ---- 시트
    n = len(tiles); rows = (n + COLS - 1) // COLS
    sheet = np.zeros((rows * 16, COLS * 16, 4), np.uint8)
    for i, t in enumerate(tiles): sheet[(i // COLS) * 16:(i // COLS + 1) * 16, (i % COLS) * 16:(i % COLS + 1) * 16] = t
    os.makedirs(os.path.join(ROOT, 'public/assets/beodeul-wave-places'), exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(ROOT, 'public/assets/beodeul-wave-places/beodeul-wave-places-chipset.png'), optimize=True)
    KO = {'volcano-field': '화산 지대 필드', 'ruined-village': '폐허 마을', 'ice-age-field': '빙하기 설원', 'mountain-fortress': '산악 요새', 'empty': '빈 칸'}
    OPEN = dict(up=True, down=True, left=True, right=True)
    passability, priority, tileMeta = [], [], []
    for (layer, f, place, kind) in meta:
        passability.append(dict(up=f[0], down=f[1], left=f[2], right=f[3]))
        priority.append(layer)
        if place == 'empty':
            tileMeta.append(dict(label='', description='', source='bundled-default')); continue
        walkable = any(f)
        passage = 'star' if (layer == 'upper' and walkable) else ('passable' if walkable else 'solid')
        # 칸이 1만 5천이라 짧게(모든 프로젝트에 실린다): 장소·층·통행만
        tileMeta.append(dict(label=f'웨이브 장소 · {KO[place]}', description='', defaultLayer=layer, passage=passage, source='bundled-default'))
    tileset = dict(name='버들항 웨이브 장소 (원본 그림 칸)', tileSize=16, passability=passability, priority=priority, terrain=[0] * n,
                   tileMeta=tileMeta, tileGroups=[], autotileGroups=[], animationStrips=[], structureKits=[])
    json.dump(dict(count=n, tilesPerRow=COLS, tileSize=16, rows=rows), open(os.path.join(ROOT, 'src/assets/beodeulWavePlacesSheet.json'), 'w'))
    json.dump(tileset, open(os.path.join(ROOT, 'src/assets/beodeulWavePlacesTileset.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    # ---- 장소 스냅숏(조선 장소와 같은 여러 맵 한 파일 형식)
    tsdef = dict(id=TS_ID, name=tileset['name'], image=dict(type='bundled', id=TEX), kind='custom', family='oprn-atlas-wave',
                 tileSize=16, tilesPerRow=COLS, count=n, passability=passability, priority=priority, terrain=[0] * n)
    maps = {}
    os.makedirs(os.path.join(ROOT, 'public/assets/region-references'), exist_ok=True)
    for mid, b in built.items():
        N = b['W'] * b['H']
        maps[mid] = dict(id=mid, name=b['name'], width=b['W'], height=b['H'], tilesetId=TS_ID, tileSize=16,
                         lowerTiles=b['lower'], lowerOverlayTiles=[-1] * N, upperTiles=b['upper'], upperOverlayTiles=[-1] * N, events=[])
        # 미리보기 = 칸으로 다시 짠 그림(위층 포함) — 원본과 화소 대조
        prev = np.zeros((b['H'] * 16, b['W'] * 16, 4), np.uint8)
        for i, (lo, upt) in enumerate(zip(b['lower'], b['upper'])):
            x, y = i % b['W'], i // b['W']
            c = tiles[lo].copy()
            if upt >= 0:
                u = tiles[upt]; m = u[..., 3] > 0; c[m] = u[m]
            prev[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = c
        Image.fromarray(prev[..., :3]).save(os.path.join(ROOT, f'public/assets/region-references/{mid}.png'), optimize=True)
        src = np.array(Image.open(os.path.join(HERE, 'orig', cache[b['place']]['st']['orig'])).convert('RGB'))[b['y0'] * 16:(b['y0'] + b['H']) * 16]
        diff = (prev[..., :3] != src).any(2)
        report[mid]['pixelDiffVsOriginal'] = int(diff.sum())
        report[mid]['pixelDiffCellsVsOriginal'] = int(diff.reshape(b['H'], 16, b['W'], 16).any(axis=(1, 3)).sum())
        report[mid]['marks'] = b['marks']
    json.dump(dict(maps=maps, tilesets={TS_ID: tsdef}), open(os.path.join(ROOT, 'src/project/regionReferences/beodeul-wave-places.json'), 'w'),
              ensure_ascii=False, separators=(',', ':'))
    write_references(built, report, n)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    report['_sheet'] = dict(count=n, rows=rows, cols=COLS)
    json.dump(report, open(os.path.join(HERE, 'out', 'report.json'), 'w'), ensure_ascii=False, indent=1)
    print('sheet', n, 'tiles', rows, 'rows')
    for k, v in report.items():
        if not k.startswith('_'): print(k, 'diff px', v['pixelDiffVsOriginal'], 'cells', v['pixelDiffCellsVsOriginal'], 'lava cover', v['lavaCellsCovered'])

DESC = {
    'bd-wave-ash-plain': ('natural', '화산 지대 필드의 남쪽 재 평원만 자른 들판(용암 강 남쪽, 용암 강·신전·분화구 없음). 그을린 고목 숲·짐승 뼈·주상절리·흑요석·유황 분기공 벌판, 잿빛 오솔길이 남쪽 입구에서 북쪽 끝(출구)까지 이어진다.',
                          '북쪽 끝 줄은 잘린 가장자리라 출구 이벤트를 놓을 자리다. 동쪽 가운데 작은 용암 웅덩이(3×2)는 원본 그대로 남았다(막힘).'),
    'bd-wave-volcano-field': ('natural', '화산 지대 필드 전체: 남쪽 입구 → 재 평원 → 현무암 다리로 용암 강 건넘 → 절벽 돌계단 → 화산 신전 입구, 곁길 징검돌 → 화산 동굴 입구.',
                              '신전 문·동굴 입구는 그림뿐 — 이동 이벤트를 따로 놓는다.'),
    'bd-wave-ruined-village': ('settlement', '불타고 버려진 마을: 무너진 예배당과 종탑, 판석 광장(마른 우물·찢긴 천막 가판·넘어진 수레), 반쯤 무너진 집 여섯, 묘지와 지하 묘소 입구, 말라 죽은 밭과 허수아비, 남쪽 문기둥.',
                               '집·예배당 문은 그림뿐(실내 맵 없음). 주민·까마귀 이벤트는 없다.'),
    'bd-wave-ice-age-field': ('natural', '빙하기 설원: 북쪽 빙벽과 얼음 굴 입구·언 폭포·얼음 속 짐승 그림자, 가운데 언 호수와 물길(얼음 다리로 건넘), 서쪽 눈 전나무 숲·설동, 남쪽 모피 천막 야영지(모닥불·움막·엄니 문), 동쪽 거대 짐승 뼈 벌판.',
                              '얼음 굴 입구·설동은 그림뿐. 물체 통행은 원본 그림을 물체/땅으로 나눠 밑동 칸을 막은 것이라 스크립트 판보다 거칠다.'),
    'bd-wave-mountain-fortress': ('facility', '산악 요새 정문 앞: 남쪽 산길 입구 → 지그재그 오르막(돌계단 둘) → 골짜기 위 도개교 → 성벽 성문 통로 → 앞뜰(대장간·창고 마당) → 거대 석문. 서·동 갈래 출구.',
                                  '석문·대장간은 그림뿐 — 요새 안 맵 이동 이벤트를 따로 놓는다.'),
}

def write_references(built, report, n):
    docs, images, places = [], [], []
    lines = ['# 버들항 웨이브 장소 — 원본 그림 칸 (먼저 읽는다)', '',
             f'tilesetId `{TS_ID}` · 시트 `public/assets/beodeul-wave-places/beodeul-wave-places-chipset.png`(텍스처 `{TEX}`, **{n}칸**, 16px, 한 줄 {COLS}칸). 계열 `oprn-atlas-wave` — 버들항 도시(beodeul_city) 칸 번호와 섞지 않는다.',
             '', '이 칩셋은 낱칸을 골라 까는 재료가 아니다. 2026-10 장르 웨이브에서 손 도트로 그린 장소의 **원본 그림을 칸으로 자른 것**이고, 칸 하나하나가 그 장소의 한 자리다.',
             '장소를 쓰려면 `import_region_reference({id})` 로 맵을 통째로 가져온다. 가져온 뒤 이벤트(문·출구·NPC·적)를 놓는다. 그림을 고치려면 칸을 지우지 말고 위층에 다른 칩셋 물건을 얹지도 말 것(칩셋이 다르다).',
             '', '## 칸 규칙', '- 아래층 = 원본 칸 그대로(불투명). 위층 = 키 큰 물체(나무 수관·건물·바위 기둥)의 화소만.',
             '- 걷는 칸의 위층 = ★(사람 위에 그려진다 — 수관 밑을 지나면 가려진다). 막힌 칸의 위층 = 막힌 물체(y 정렬).',
             '- 통행은 칸마다 4방향. 단(높이)이 다른 칸 사이는 계단 칸으로만 오르내린다. 맵 가장자리는 열려 있다(출구 자리).', '', '## 장소']
    for mid, b in built.items():
        kind, body, lim = DESC[mid]
        rp = report[mid]
        lines.append(f"- `{mid}` {b['name']} {b['W']}×{b['H']} — {body} 입구 칸 ({b['entry'][0]},{b['entry'][1]}), 걷는 칸 {rp['walkable']}, 입구에서 닿는 칸 {rp['reached']}.")
        images.append(dict(id=f'{mid}-map', name=f'{mid}.png', caption=f"{b['name']} — 칸으로 다시 짠 그림(원본과 화소 차이 {rp['pixelDiffVsOriginal']}).", dataUrl=f'/assets/region-references/{mid}.png'))
        places.append(dict(id=mid, name=b['name'], kind='completed-place', placeKind=kind, revision=1, x=0, y=0, width=b['W'], height=b['H'], tilesetId=TS_ID,
            preview=f'/assets/region-references/{mid}.png', tilesetPreview='/assets/beodeul-wave-places/beodeul-wave-places-chipset.png',
            sourceProjectId='oprn-bundled-beodeul-wave-places', sourceMapId=mid, snapshotProjectId=f'oprn-place-{mid}-v1',
            rules=[f"버들항 장르 웨이브(2026-10-08) 손 도트 장소의 원본 그림을 16px 칸으로 자른 맵. 칩셋 `{TS_ID}`(계열 oprn-atlas-wave), 칸 {b['W']}×{b['H']}.", body,
                   f"입구 칸 ({b['entry'][0]},{b['entry'][1]}). 걷는 칸 {rp['walkable']}, 입구에서 4방향 통행으로 닿는 칸 {rp['reached']}.",
                   '아래층 = 원본 칸, 위층 = 키 큰 물체 화소(걷는 칸은 ★). 겹쳐 그리면 원본 그림과 화소 0 차이.'],
            limitations=lim + ' 이벤트·적·BGM 은 없다. 새 맵을 이 칩셋 낱칸으로 짓는 재료가 아니다.'))
    docs.append(dict(id='bd-wave-howto', name='버들항 웨이브 장소 · 쓰는 법(먼저 읽는다)', markdown='\n'.join(lines) + '\n'))
    refs = [dict(id='bd-wave-places', name='beodeul_wave_places · 웨이브 장소 원본 그림 칸', description='화산 지대 필드·재의 들판·폐허 마을·빙하기 설원·산악 요새 — import_region_reference 로 통째로 가져오는 장소 맵.',
                 documents=docs, images=images)]
    json.dump(refs, open(os.path.join(ROOT, 'src/assets/beodeulWavePlacesReferences.json'), 'w'), ensure_ascii=False, indent=1)
    ts = ('// tiledata/beodeul-variants/_revive/bake.py 가 쓴다(손으로 고치지 말 것). 버들항 웨이브 장소 — 원본 그림 칸으로 되살린 장소 맵.\n'
          '// 스냅숏 src/project/regionReferences/beodeul-wave-places.json(여러 맵 한 파일).\n'
          'export const BEODEUL_WAVE_PLACE_REFERENCES = ' + json.dumps(places, ensure_ascii=False, indent=2) + ';\n')
    open(os.path.join(ROOT, 'src/project/beodeulWavePlaceReferences.ts'), 'w').write(ts)

if __name__ == '__main__':
    main()
