"""jp_shopstreet16 시트(PNG)·카탈로그(JSON)를 굽는다 — 원본 export2.py 의 이식본.
  python3 bake_source.py [--no-people]        # 기본이 --no-people (행인 Actor1 은 번들 제외, 자리는 빈 칸으로 유지)
출력: jpenv.OUT (기본 tiledata/jp-city/sources, JPCITY_OUT 으로 바꿈)."""
import sys, json
import jpenv
if '--people' in sys.argv: sys.exit('--people 은 지원하지 않는다: Actor1 행인은 번들에서 제외했다(출처·라이선스 불확실).')
import build_tokyo as B
import numpy as np
from PIL import Image
from modern_style_bible_proof import RAMPS, rgb

COLS = 16
def export(extra_recipes=None):
    n = len(B.CELLS); rows = (n + COLS - 1) // COLS
    sheet = np.zeros((rows * 16, COLS * 16, 4), np.uint8)
    for i, (nm, a) in enumerate(B.CELLS):
        r, c = divmod(i, COLS); sheet[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16] = a
    Image.fromarray(sheet).save(f'{B.OUT}/jp_shopstreet16.png', optimize=False)
    names = {k: v for k, v in B.NAMES.items() if not k.startswith('_chk')}
    rec = {**B.CANON, **B.NEW, **B.NEW3, **B.NEW4, **B.NEW5, **(extra_recipes or {})}
    pr = json.load(open(jpenv.PEOPLE_RESERVE))
    cat = {'id': 'jp_shopstreet16', 'title': '일본 상가 거리 16px (잡거빌딩·가게·거리·소품)', 'tileSize': 16, 'view': '3/4 정면, 빛은 왼쪽 위',
           'palette': 'modern3 (tiledata/atlas-pick/palette/modern3.pal) — 새 색 0', 'origin': '손 도트(코드로 그림). 외부 소재 없음. 글자는 jiskan16(퍼블릭 도메인) 구운 글리프(tiledata/jp-city/glyphs.json).',
           'sheet': {'file': 'jp_shopstreet16.png', 'cols': COLS, 'count': n}, 'names': names, 'bands': B.BAND, 'decos': B.DECO, 'street': B.STREET, 'props': B.PROP,
           'walkLegend': {'F': '걸음(문 앞 접근 칸 포함)', 'C': '걸어 지나감(위층 — 사람 위에 그림)', 'S': '막힘(건물 아래 두 줄·소품 밑동)', 'X': '막힘'},
           'recipes': rec, 'lRecipes': B.LSPEC, 'doorDefault': B.DOOR_DEFAULT,
           'people': {'excluded': True, 'note': '원본의 행인 person.0~39(Actor1) 은 번들에서 제외. 그 칸 자리는 빈(투명) 칸으로 유지해 이후 칸 번호가 원본과 같다.',
                      'reservedStart': pr['start'], 'reservedCells': pr['cells']}}
    json.dump(cat, open(f'{B.OUT}/jp_shopstreet16.catalog.json', 'w'), ensure_ascii=False, indent=1)
    pal = {rgb(h) for r in RAMPS.values() for h in r}
    used = {tuple(int(v) for v in p[:3]) for p in sheet.reshape(-1, 4) if p[3]}
    partial = int(((sheet[..., 3] > 0) & (sheet[..., 3] < 255)).sum())
    return n, len(used - pal), partial
if __name__ == '__main__':
    print(export())
