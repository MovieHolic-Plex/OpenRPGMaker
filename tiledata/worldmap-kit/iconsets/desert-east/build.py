#!/usr/bin/env python3
"""사막·동양풍 아이콘 세트 재생성.  python3 build.py
산출: sheet.png · manifest.json · stats.md · sheet-check.json · preview/*.png
렌더러(lib/)는 이 폴더 안 복사본만 쓴다. 지형 비교용 원본 월드 칩셋은 저장소의 public/assets/easyrpg-chipset-world.png.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'lib'))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import oblique as ob  # noqa: E402
import east  # noqa: E402,F401  (재질·결 등록)
import scenes_a  # noqa: E402
import scenes_b  # noqa: E402
from show import on_ground, zoom  # noqa: E402

REG = {}
REG.update(scenes_a.ICONS)
REG.update(scenes_b.ICONS)

KEY = (255, 103, 139)
SHADOW = (254, 103, 139)

# (role, 이름, 함수 이름, 칸(w,h), 설명)
ORDER = [
    ('capital', '궁성 도시', 'capital', (6, 6), '이중 성벽, 사방 문루(겹처마 기와), 안뜰의 큰 전각과 기와집'),
    ('fort_city', '읍성', 'fort_city', (4, 4), '성벽 둘러친 읍성, 문루 하나, 안에 관아'),
    ('harbor_city', '항구 읍성', 'harbor_city', (5, 4), '바다 쪽이 열린 항구 읍성, 나무 부두와 삼각돛배'),
    ('castle', '산성 누각', 'castle', (3, 3), '흙 언덕 위 석축 성벽과 3층 누각'),
    ('castle', '산성 요새', 'castle_b', (3, 3), '석축 성벽·문루·양 망루·장대'),
    ('large_town', '기와집 마을', 'large_town', (3, 3), '기와집 여섯 채(일부 2층), 담장·장독'),
    ('large_town', '오아시스 마을', 'large_town_b', (3, 3), '평지붕 흙집·돔 사원·미나렛·야자'),
    ('village', '초가 촌락', 'village', (2, 2), '흙벽 + 짚 우진각 지붕 세 채, 장독'),
    ('village', '사막 흙벽 마을', 'village_b', (2, 2), '평지붕 흙집·돔·야자'),
    ('camp', '게르 야영', 'camp', (2, 2), '흰 펠트 게르 둘과 모닥불'),
    ('camp', '검은 천막 야영', 'camp_b', (2, 2), '짙은 갈색 원뿔 천막 셋과 깃대'),
    ('tower_small', '3층 전탑', 'tower_small', (1, 2), '벽돌 3층 탑, 층마다 기와 처마'),
    ('tower_great', '9층 팔각탑', 'tower_great', (2, 4), '9층 팔각 전탑, 층마다 처마 윗면'),
    ('cave', '석굴 사원', 'cave', (2, 2), '사암 절벽에 판 석굴, 입구 위 기와 처마'),
    ('ruin', '무너진 석탑', 'ruin', (2, 2), '층이 떨어져 나간 석탑 밑동과 흩어진 석재'),
    ('ruin_city', '모래에 묻힌 성채', 'ruin_city', (4, 3), '부서진 성벽·문루 잔해를 모래 언덕이 덮음'),
    ('shrine', '대사원', 'shrine', (3, 3), '높은 기단·계단·2층 전각(옥색 기와)'),
    ('landmark_nature', '신목', 'landmark_nature', (3, 3), '붉은 금줄을 두른 거목'),
    ('landmark_nature', '사막 바오바브', 'landmark_baobab', (3, 3), '불룩한 줄기와 납작한 수관'),
    ('circle', '석등과 선돌', 'circle', (2, 2), '선돌 셋과 석등'),
    ('volcano', '화산 제단', 'volcano', (2, 2), '잘린 화구의 붉은 용암 + 비탈 아래 작은 제단'),
    ('floating', '신선의 섬', 'floating', (5, 4), '구름 위에 뜬 섬, 옥색 기와 전각 하나'),
]

SHEET_COLS = 32


def pack(items):
    """높이 큰 순 선반 배치. 반환 [(col,row)], 시트 칸(w,h)."""
    order = sorted(range(len(items)), key=lambda i: (-items[i][1], -items[i][0]))
    pos = [None] * len(items)
    x = y = rowh = 0
    for i in order:
        w, h = items[i]
        if x + w > SHEET_COLS:
            x, y, rowh = 0, y + rowh, 0
        pos[i] = (x, y)
        x += w
        rowh = max(rowh, h)
    return pos, y + rowh


def orig_colors():
    im = Image.open(HERE.parents[3] / 'public/assets/easyrpg-chipset-world.png').convert('RGB')
    return set(map(tuple, np.array(im).reshape(-1, 3).tolist())), im


def main():
    orig, chip = orig_colors()
    arrs, stats = [], []
    for role, name, fn, cells, desc in ORDER:
        a, st = REG[fn]()
        h, w = a.shape[:2]
        assert (w // 16, h // 16) == cells and w % 16 == 0 and h % 16 == 0, (fn, a.shape, cells)
        arrs.append(a)
        stats.append(st)
    pos, sh = pack([o[3] for o in ORDER])
    sheet = np.zeros((sh * 16, SHEET_COLS * 16, 3), np.uint8)
    sheet[:] = KEY
    icons = []
    for (role, name, fn, cells, desc), a, (c, r) in zip(ORDER, arrs, pos):
        sheet[r * 16:r * 16 + a.shape[0], c * 16:c * 16 + a.shape[1]] = a
        icons.append({'role': role, 'name': name, 'id': fn, 'cells': list(cells), 'col': c, 'row': r, 'desc': desc})
    Image.fromarray(sheet).save(HERE / 'sheet.png')

    used = set(map(tuple, sheet.reshape(-1, 3).tolist())) - {KEY, SHADOW}
    new = sorted(used - orig)
    extra = ['%02x%02x%02x' % c for c in new]
    manifest = {
        'id': 'desert-east', 'name': '사막·동양풍', 'tile': 16, 'key': list(KEY), 'shadow_key': list(SHADOW),
        'sheet': 'sheet.png', 'extra_colors': extra, 'icons': icons,
        'license': {'note': '지형 팔레트는 EasyRPG World.png(CC BY 4.0)의 색만 쓴다. 그림은 이 폴더의 build.py 가 투영 렌더러(lib/oblique.py)로 직접 만든 것이며 생성 이미지·트레이싱이 없다.'},
    }
    (HERE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    (HERE / 'sheet-check.json').write_text(json.dumps({
        'sheet_colors': len(used), 'original_world_colors_used': len(used & orig), 'new_colors': extra,
        'new_color_count': len(new), 'limit': 12, 'ok': len(new) <= 12,
    }, ensure_ascii=False, indent=1) + '\n')

    lines = ['# 면 픽셀 통계 (투영 렌더러가 센 값)', '',
             '렌더러가 화면 픽셀마다 광선을 쏴 맞은 면의 법선으로 분류한다(윗면 = 법선 z>.5, 오른쪽 = x>.3, 왼쪽 = x<-.3, 나머지 = 앞면).',
             '손으로 윗면을 그리지 않으므로 이 값은 규칙의 결과이지 그림 솜씨가 아니다. 판정(✓/✗)은 criteria.md 에 눈으로 적는다.', '',
             '| 아이콘 | 칸 | 윗면 px | 앞면 px | 오른쪽면 px | 왼쪽(곡면) px | 윗/앞 | 오른쪽/앞 |', '|---|---|---|---|---|---|---|---|']
    for (role, name, fn, cells, desc), st in zip(ORDER, stats):
        al = st['all']
        f = max(al['front'], 1)
        lines.append(f"| {fn} ({name}) | {cells[0]}x{cells[1]} | {al['top']} | {al['front']} | {al['right']} | {al['left']} | {al['top'] / f:.2f} | {al['right'] / f:.2f} |")
    lines += ['', f'새 색 {len(new)}개 (한도 12): ' + (', '.join('#' + e for e in extra) or '없음 — 전부 원본 월드 칩셋 색')]
    (HERE / 'stats.md').write_text('\n'.join(lines) + '\n')

    # ── 미리보기 ──
    pv = HERE / 'preview'
    pv.mkdir(exist_ok=True)
    Image.fromarray(on_ground(sheet)).resize((sheet.shape[1] * 4, sheet.shape[0] * 4), Image.NEAREST).save(pv / 'sheet-4x-on-grass.png')
    cards = []
    for (role, name, fn, cells, desc), a in zip(ORDER, arrs):
        g = zoom(on_ground(a), 8)
        c = Image.new('RGB', (max(g.width, 200), g.height + 22), (30, 30, 34))
        ImageDraw.Draw(c).text((4, 4), f'{role} / {fn}  {cells[0]}x{cells[1]}', fill=(230, 230, 230))
        c.paste(g, (0, 22))
        cards.append((fn, c))
        c.save(pv / f'{fn}-8x.png')
    W = 1900
    x = y = rh = 0
    pl = []
    for fn, c in cards:
        if x + c.width > W:
            x, y, rh = 0, y + rh + 8, 0
        pl.append((x, y, c))
        x += c.width + 8
        rh = max(rh, c.height)
    big = Image.new('RGB', (W, y + rh), (30, 30, 34))
    for x, y, c in pl:
        big.paste(c, (x, y))
    big.save(pv / 'catalog-8x.png')

    # ── 지도 맥락(원본 월드 칩셋 지형 위, 12x9칸 2배) ──
    def tile(x, y):
        return chip.crop((x, y, x + 16, y + 16))
    grass = [tile(32, 144), tile(32, 160), tile(48, 144)]
    sand = [tile(x, y) for (x, y) in ((152, 24), (156, 28), (160, 32), (152, 32), (156, 36), (160, 28), (152, 40), (160, 40))]
    dirt = [tile(x, y) for (x, y) in ((104, 24), (108, 28), (112, 32), (104, 36))]
    rng = np.random.RandomState(4)

    def terrain(cols, rows, kind):
        im = Image.new('RGB', (cols * 16, rows * 16))
        for ty in range(rows):
            for tx in range(cols):
                if kind == 'grass':
                    t = grass[rng.randint(3)]
                elif kind == 'sand':
                    t = sand[rng.randint(8)]
                elif kind == 'dirt':
                    t = dirt[rng.randint(4)]
                else:
                    t = sand[rng.randint(8)] if tx < cols // 2 else grass[rng.randint(3)]
                im.paste(t, (tx * 16, ty * 16))
        return im

    def put(base, a, cx, cy):
        g = on_ground_tex(base, a, cx * 16, cy * 16)
        return g

    def on_ground_tex(base, a, px, py):
        b = np.array(base)
        h, w = a.shape[:2]
        reg = b[py:py + h, px:px + w]
        key = np.all(a == np.array(KEY, np.uint8), -1)[:reg.shape[0], :reg.shape[1]]
        shd = np.all(a == np.array(SHADOW, np.uint8), -1)[:reg.shape[0], :reg.shape[1]]
        ar = a[:reg.shape[0], :reg.shape[1]]
        reg[shd] = (reg[shd] * np.array([.64, .70, .82])).astype(np.uint8)
        m = ~key & ~shd
        reg[m] = ar[m]
        return Image.fromarray(b)

    A = dict(zip([o[2] for o in ORDER], arrs))
    scenes = {
        'ctx-grass': ('grass', [('village', 1, 5), ('tower_small', 5, 6), ('large_town', 7, 4), ('camp', 3, 0), ('shrine', 0, 0), ('cave', 10, 1)]),
        'ctx-sand': ('sand', [('village_b', 1, 5), ('large_town_b', 3, 3), ('camp_b', 7, 6), ('landmark_baobab', 6, 0), ('ruin', 0, 1), ('circle', 10, 5)]),
        'ctx-mix': ('mix', [('fort_city', 1, 3), ('tower_great', 7, 1), ('volcano', 9, 6), ('landmark_nature', 4, 5), ('castle', 8, 3)]),
        'ctx-capital': ('mix', [('capital', 3, 3)]),
        'ctx-coast': ('grass', [('harbor_city', 1, 3), ('ruin_city', 6, 0), ('floating', 6, 5)]),
    }
    outs = []
    for key, (kind, items) in scenes.items():
        cols, rows = (12, 9) if key != 'ctx-capital' else (12, 11)
        base = terrain(cols, rows, kind)
        for fn, cx, cy in items:
            base = put(base, A[fn], cx, cy)
        base.resize((base.width * 2, base.height * 2), Image.NEAREST).save(pv / f'{key}-2x.png')
        base.save(pv / f'{key}-1x.png')
        outs.append(key)
    # 한 장에 모은 전체 한 지도
    big_map = terrain(34, 20, 'mix')
    layout = [('capital', 1, 0), ('fort_city', 8, 1), ('harbor_city', 13, 2), ('castle', 18, 0), ('large_town', 21, 1), ('floating', 25, 0),
              ('village', 1, 10), ('camp', 4, 11), ('tower_small', 7, 11), ('tower_great', 9, 9), ('cave', 12, 11), ('ruin', 15, 11),
              ('ruin_city', 18, 9), ('shrine', 23, 8), ('landmark_nature', 27, 9), ('circle', 31, 11), ('volcano', 31, 8),
              ('village_b', 4, 15), ('large_town_b', 7, 15), ('camp_b', 11, 16), ('landmark_baobab', 14, 15), ('castle_b', 18, 15)]
    for fn, cx, cy in layout:
        big_map = put(big_map, A[fn], cx, cy)
    big_map.save(pv / 'ctx-all-1x.png')
    big_map.resize((big_map.width * 2, big_map.height * 2), Image.NEAREST).save(pv / 'ctx-all-2x.png')
    print('sheet', sheet.shape[1] // 16, 'x', sh, 'cells; icons', len(icons), 'new colors', len(new), extra)


if __name__ == '__main__':
    main()
