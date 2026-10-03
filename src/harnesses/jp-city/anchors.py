"""참고 그림 해석기 — 시드 `refs` 항목(문자열)을 (라벨, PIL 이미지, 주의 문구)로 바꾼다. 화소는 눈으로 배우는 용도이고 복사하지 않는다.

  anchor:이름        시드 최상위 `anchors` 표의 크롭(도시 화풍 목표 `tiledata/jp-city/districts/*.png` 의 한 구역)
  prop:이름          기존 시트(`tiledata/jp-city/sources/jp_shopstreet16.png`)의 소품·건물 조각(카탈로그 props) — 스타일 정합용 이웃. 화소 복사 금지
  cand:폴더          `tiledata/atlas-pick/candidates-jp/<폴더>` 의 사용자가 고른(없으면 -A) 후보. 옛 jp.pal 이라 **색·화소는 쓰지 말고 구조만**
  img:경로[@x0,y0,x1,y1]  저장소 안 임의 PNG(크롭 선택)
"""
import json, os, glob
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
JP = os.path.join(ROOT, 'tiledata/jp-city')
SRC_SHEET = os.path.join(JP, 'sources/jp_shopstreet16.png')
CATALOG = os.path.join(JP, 'sources/jp_shopstreet16.catalog.json')
CAND = os.path.join(ROOT, 'tiledata/atlas-pick/candidates-jp')
PICKS = os.path.join(ROOT, 'tiledata/atlas-pick/picks-jp.json')
_cache = {}


def _catalog():
    if 'cat' not in _cache: _cache['cat'] = json.load(open(CATALOG, encoding='utf-8'))
    return _cache['cat']


def _sheet():
    if 'sheet' not in _cache: _cache['sheet'] = Image.open(SRC_SHEET).convert('RGBA')
    return _cache['sheet']


def cell(idx):
    """소스 시트의 칸 번호 → 16x16 이미지(16열)."""
    x, y = (idx % 16) * 16, (idx // 16) * 16
    return _sheet().crop((x, y, x + 16, y + 16))


def cell_by_name(name):
    return cell(_catalog()['names'][name])


def prop_img(name):
    p = _catalog()['props'][name]; grid = p['cells']
    im = Image.new('RGBA', (len(grid[0]) * 16, len(grid) * 16), (0, 0, 0, 0))
    for j, row in enumerate(grid):
        for i, nm in enumerate(row):
            if nm and _catalog()['names'].get(nm) is not None: im.alpha_composite(cell_by_name(nm), (i * 16, j * 16))
    return im


def _crop(path, box):
    im = Image.open(path).convert('RGBA')
    return im.crop(tuple(int(v) for v in box.split(','))) if box else im


def cand_path(folder):
    picks = json.load(open(PICKS, encoding='utf-8')) if os.path.exists(PICKS) else {}
    ch = (picks.get(folder) or {}).get('choice')
    if ch and os.path.exists(os.path.join(CAND, folder, ch + '.png')): return os.path.join(CAND, folder, ch + '.png')
    for p in sorted(glob.glob(os.path.join(CAND, folder, '*-A.png'))):
        if not any(t in p for t in ('x4', 'ctx', 'walk', 'board', 'parts', 'seams', 'ex-')): return p
    return None


def resolve(ref, anchors):
    """-> (라벨, 이미지 또는 None, 주의 문구, 배율 권장). 해석 못 하면 이미지 None."""
    kind, _, rest = ref.partition(':')
    if kind == 'anchor':
        spec = anchors.get(rest)
        if not spec: return rest, None, '', 4
        f, _, box = spec.partition('@')
        return 'anchor-' + rest, _crop(os.path.join(JP, f), box), '도시 화풍 목표(지구 그림 크롭). 시점·마감·밀도·색 덩이를 눈으로 읽는다. 화소 복사 금지.', 4
    if kind == 'prop':
        try: return 'prop-' + rest, prop_img(rest), '기존 jp_city 시트의 이웃 조각(스타일 정합용). 화소 복사 금지.', 8
        except KeyError: return rest, None, '', 8
    if kind == 'cand':
        p = cand_path(rest)
        return ('cand-' + rest, Image.open(p).convert('RGBA'), '옛 후보(옛 jp.pal 색). **구조·비율만 참고, 색·화소는 쓰지 마라.**', 6) if p else (rest, None, '', 6)
    if kind == 'img':
        f, _, box = rest.partition('@'); p = os.path.join(ROOT, f)
        return 'img-' + os.path.splitext(os.path.basename(f))[0], (_crop(p, box) if os.path.exists(p) else None), '', 4
    return ref, None, '', 4
