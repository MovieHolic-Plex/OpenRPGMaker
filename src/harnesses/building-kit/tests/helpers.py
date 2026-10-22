"""고정 후보 행 문자열을 시드 항목 그림으로 합치는 시험 도우미. 모델 호출은 없다."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
HARNESS = os.path.dirname(HERE)
sys.path.insert(0, HARNESS)
sys.path.insert(0, HERE)

import dot  # noqa: E402
import fixtures as F  # noqa: E402

THEME = 'fantasy-kingdom'
ROUND = 'style-r3'
ROOFS = F.ROOFS
ROOFS_TALL = F.ROOFS_TALL
WALLS = F.WALLS
BANDS = F.BANDS
BASES = F.BASES
LEGEND = F.LEGEND


def seed():
    return dot.seed(THEME)


def items():
    return {it['id']: it for it in seed()['items']}


def round_items():
    return seed()['rounds'][ROUND]['items']


def piece_rows(item_id, line):
    """항목 id + 줄 → 조각 id 별 행 목록(지붕·벽) 또는 단일 행 목록(층 띠·기단)."""
    if item_id in ('gable.front', 'gable.step'):
        return F.gable_set(line, item_id)
    if item_id == 'roof.gf.slope':
        return F.gf_slope(line)
    if item_id == 'roof.gf.back':
        return F.gf_back(line)
    if item_id == 'roof.lean.side':
        return F.lean(line)
    if item_id == 'roof.lean.left':
        return {role: [r[::-1] for r in rows] for role, rows in F.lean(line).items()}
    if item_id == 'extra.chimney':
        return F.chimney(line)
    if item_id in F.ROOF_CELLS:
        return F.roof(line, item_id)
    if item_id in F.WALL_MATS:
        return {role: F.wall(line, item_id, role) for role in 'lmwdr'}
    if item_id.startswith('band.'):
        return F.band(line)
    if item_id.startswith('base.'):
        return F.base(line)
    raise KeyError(item_id)


def compose(item_id, line):
    it = items()[item_id]
    leg = dot.legend(THEME, **F.LEGEND[line])
    sheet = dot.Cv(it['size'][0] * dot.T, it['size'][1] * dot.T)
    rows_by_piece = piece_rows(item_id, line)
    for pc in it['pieces']:
        rows = rows_by_piece[pc['id']] if isinstance(rows_by_piece, dict) else rows_by_piece
        if not rows:
            continue
        cv = dot.grid(rows, leg)
        sheet.paste(cv, pc['at'][0] * dot.T, pc['at'][1] * dot.T)
    return sheet.img()


def parts(line, overrides=None, extra=()):
    out = {}
    for item_id in list(round_items()) + [i for i in extra if i not in round_items()]:
        out[item_id] = {'item': items()[item_id], 'img': compose(item_id, line)}
    for item_id, im in (overrides or {}).items():
        out[item_id] = {'item': items()[item_id], 'img': im}
    return out


def buildings():
    return {b['id']: b for b in seed()['buildings'] if b['id'] in seed()['rounds'][ROUND].get('buildings', [])}

def round_buildings(rid=ROUND):
    ids = seed()['rounds'][rid].get('buildings')
    return {b['id']: b for b in seed()['buildings'] if not ids or b['id'] in ids}


ROUND_MODULE = '''import os
import sys

sys.path.insert(0, os.environ['BK_TESTS_DIR'])
sys.path.insert(0, os.environ['BK_HARNESS_DIR'])
import dot
import helpers as H

ROUND = {round!r}
WAVE = 'style'
NOTES = {{}}


def _c(item, line):
    def fn():
        return dot.Cv.of(H.compose(item, line)), {{'note': line}}
    return fn


CANDIDATES = {{item: {{line: _c(item, line) for line in 'ABC'}} for item in H.round_items()}}
'''


def install_round(data_dir, theme=THEME, rid=ROUND):
    """시험용 판 모듈을 data_dir 안에 쓰고 seed 의 rounds.<rid>.module 을 그 절대 경로로 바꿔 끼운다."""
    import json
    os.environ['BK_TESTS_DIR'] = HERE
    os.environ['BK_HARNESS_DIR'] = HARNESS
    path = os.path.join(data_dir, theme, f'round_{rid}.py')
    open(path, 'w', encoding='utf-8').write(ROUND_MODULE.format(round=rid))
    seed_path = os.path.join(data_dir, theme, 'seed.json')
    s = json.load(open(seed_path, encoding='utf-8'))
    s['rounds'][rid]['module'] = path
    json.dump(s, open(seed_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return path
