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
ROUND = 'style-r1'
PIECE_SOURCE = {'roof.gable': 'ROOFS', 'wall.storey': 'WALLS', 'base.stone': 'BASES'}
ROOFS = F.ROOFS
WALLS = F.WALLS
BASES = F.BASES
LEGEND = F.LEGEND


def seed():
    return dot.seed(THEME)


def items():
    return {it['id']: it for it in seed()['items']}


def round_items():
    return seed()['rounds'][ROUND]['items']


def piece_rows(item_id, line):
    src = getattr(F, PIECE_SOURCE[item_id])
    return src[line]


def compose(item_id, line):
    it = items()[item_id]
    leg = dot.legend(THEME, **F.LEGEND[line])
    sheet = dot.Cv(it['size'][0] * dot.T, it['size'][1] * dot.T)
    rows_by_piece = piece_rows(item_id, line)
    for pc in it['pieces']:
        rows = rows_by_piece[pc['id']] if isinstance(rows_by_piece, dict) else rows_by_piece
        cv = dot.grid(rows, leg)
        sheet.paste(cv, pc['at'][0] * dot.T, pc['at'][1] * dot.T)
    return sheet.img()


def parts(line, overrides=None):
    out = {}
    for item_id in round_items():
        out[item_id] = {'item': items()[item_id], 'img': compose(item_id, line)}
    for item_id, im in (overrides or {}).items():
        out[item_id] = {'item': items()[item_id], 'img': im}
    return out


def buildings():
    return {b['id']: b for b in seed()['buildings']}
