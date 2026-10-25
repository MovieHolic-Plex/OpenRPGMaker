"""building-kit 버들항 기준 그림 — 공용 시트의 칸·키트, Actor1 프레임, 장면 바탕.

`dot.py` 는 화소 찍기(행 문자열)만 하고 **그림 파일을 읽지 않는다**. 그림 파일을 여는 코드는 이 파일에만 있다.
그래서 그리기 에이전트가 쓰는 `dot` 에는 참고 그림을 화소로 읽어 베끼는 헬퍼가 없다(트레이스 차단).
참고 그림은 샌드박스 `refs/` 의 PNG 로만 주고, 에이전트는 Read 로 눈으로 본다.
"""
import json
import os

import numpy as np
from PIL import Image

import dot

T = dot.T
Cv = dot.Cv
REPO = dot.REPO
SHEET = os.path.join(REPO, 'public', 'assets', 'beodeul-city', 'beodeul-city-chipset.png')
TILESET = os.path.join(REPO, 'src', 'assets', 'beodeulCityTileset.json')
ACTOR = os.path.join(REPO, 'public', 'assets', 'easyrpg', 'charset', 'Actor1.png')

_SHEET = None
_TILESET = None

def sheet_array():
    global _SHEET
    if _SHEET is None:
        _SHEET = np.array(Image.open(SHEET).convert('RGBA'))
    return _SHEET

def tileset():
    global _TILESET
    if _TILESET is None:
        _TILESET = json.load(open(TILESET, encoding='utf-8'))
    return _TILESET

def cell(idx):
    """공용 시트의 칸 번호(tilesPerRow 기준) → 16×16 Cv. -1 은 빈 칸."""
    if idx is None or idx < 0:
        return None
    a = sheet_array()
    per = tileset()['tilesPerRow']
    y, x = divmod(int(idx), per)
    c = Cv(T, T)
    c.a = a[y * T:y * T + T, x * T:x * T + T].copy()
    return c

def kit(kit_id):
    """버들항 키트(structureKits) 하나를 칸 번호대로 합성한다. 투명 배경."""
    k = next((x for x in tileset()['structureKits'] if x['id'] == kit_id), None)
    if k is None:
        raise SystemExit(f'버들항 키트 {kit_id} 가 없다')
    out = Cv(k['width'] * T, k['height'] * T)
    for j, row in enumerate(k['rows']):
        for key in ('tiles', 'upperTiles'):
            for i, idx in enumerate(row.get(key) or []):
                c = cell(idx)
                if c is not None:
                    out.paste(c, i * T, j * T)
    return out

def ref_name(ref):
    """시드 refs 항목의 파일 이름 줄기 — kit 이면 키트 id, file 이면 id(없으면 파일 이름)."""
    if ref.get('kit'):
        return ref['kit']
    return ref.get('id') or os.path.splitext(os.path.basename(ref['file']))[0]

def ref_image(ref):
    """시드 refs 항목 하나 → Cv. {'kit': id} 는 공용 시트 키트, {'file': 저장소 기준 PNG, 'crop': [x, y, w, h]?} 는
    버들항 계열 손 도트 그림(예: 설원 변형 부품·렌더 일부). 저장소 밖 경로는 받지 않는다."""
    if ref.get('kit'):
        return kit(ref['kit'])
    rel = ref.get('file') or ''
    root = os.path.realpath(REPO)
    path = os.path.realpath(os.path.join(root, rel))
    if not rel or os.path.isabs(rel) or not path.startswith(root + os.sep):
        raise SystemExit(f'기준 그림 file {rel!r}: 저장소 기준 상대 경로여야 한다')
    if not os.path.exists(path):
        raise SystemExit(f'기준 그림 file {rel} 이 없다')
    im = Image.open(path).convert('RGBA')
    if ref.get('crop'):
        x, y, w, h = ref['crop']
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > im.width or y + h > im.height:
            raise SystemExit(f'기준 그림 {rel}: crop {ref["crop"]} 이 그림 {im.width}×{im.height} 밖이다')
        im = im.crop((x, y, x + w, y + h))
    return Cv.of(im)

def actor1_frame(col=1, row=0, who=0):
    a = np.array(Image.open(ACTOR).convert('RGBA'))
    key = a[0, 0, :3].copy()
    a[(a[:, :, :3] == key).all(axis=2), 3] = 0
    bx, by = (who % 4) * 72, (who // 4) * 128
    return Image.fromarray(a[by + row * 32:by + row * 32 + 32, bx + col * 24:bx + col * 24 + 24], 'RGBA')

def ground_scene(width_cells, height_cells, theme, kind='grass'):
    """버들항 잔디·포석 위 장면 바탕(16px 칸). kind = grass | cobble."""
    body = dot.C(theme, kind, 3)
    shade = dot.C(theme, kind, 1)
    out = Cv(width_cells * T, height_cells * T)
    for y in range(height_cells):
        for x in range(width_cells):
            out.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = body + (255,)
    for y in range(0, height_cells * T, 7):
        for x in range((y * 3) % 11, width_cells * T, 13):
            out.a[y, x] = shade + (255,)
    return out
