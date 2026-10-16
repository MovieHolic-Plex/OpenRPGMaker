"""현대 연애물 인물 칩용 베이스 분할 SPECS(2026-10-16). partedit.SPECS 에 추가만 한다 — partedit.py 는 건드리지 않는다.
키 = 'Sheet:n'. 눈~턱 얼굴 상자(방향별, up=None) · 상의 시작 줄 · 허리 줄 · 신발 줄 · 맨살 글자. hands 는 앵커 표 생성에만 쓰인다(이번 작업은 장비 없음).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import partedit as P  # noqa: E402


def hands(down_l, down_r, right_near, left_near):
    return {'down': {'vl': down_l, 'vr': down_r}, 'up': {'vl': down_l, 'vr': down_r},
            'right': {'near': right_near}, 'left': {'near': left_near}}


NEW = {
    'Actor4:1': dict(face={'down': (9, 15, 14, 18), 'right': (12, 15, 17, 18), 'left': (6, 15, 10, 18), 'up': None},
                     t_start=18, waist=25, shoe_top=29, skin='Bxq',
                     hands=hands([(5, 24), (6, 24)], [(17, 24), (18, 24)], [(8, 24), (9, 24)], [(14, 24), (15, 24)])),
    'Actor4:0': dict(face={'down': (9, 15, 14, 17), 'right': (13, 15, 16, 17), 'left': (7, 15, 10, 17), 'up': None},
                     t_start=18, waist=25, shoe_top=28, skin='Ay',
                     hands=hands([(5, 24), (6, 24)], [(17, 24), (18, 24)], [(8, 24), (9, 24)], [(14, 24), (15, 24)])),
    'People1:1': dict(face={'down': (8, 16, 15, 19), 'right': (12, 16, 16, 19), 'left': (7, 16, 10, 19), 'up': None},
                      t_start=20, waist=25, shoe_top=29, skin='vwt',
                      hands=hands([(6, 25), (7, 25)], [(16, 25), (17, 25)], [(9, 25), (10, 25)], [(13, 25), (14, 25)])),
    'People1:5': dict(face={'down': (8, 14, 15, 18), 'right': (11, 14, 16, 18), 'left': (7, 14, 12, 18), 'up': None},
                      t_start=19, waist=25, shoe_top=29, skin='vyr',
                      hands=hands([(5, 23), (5, 24)], [(18, 23), (18, 24)], [(8, 23), (9, 23)], [(14, 23), (15, 23)])),
    'People5:5': dict(face={'down': (9, 14, 14, 17), 'right': (12, 14, 16, 17), 'left': (7, 14, 11, 17), 'up': None},
                      t_start=18, waist=25, shoe_top=31, skin='uvwx',
                      hands=hands([(5, 24), (6, 24)], [(17, 24), (18, 24)], [(8, 24), (9, 24)], [(14, 24), (15, 24)])),
    'People4:1': dict(face={'down': (7, 15, 16, 19), 'right': (11, 15, 16, 19), 'left': (7, 15, 13, 19), 'up': None},
                      t_start=20, waist=25, shoe_top=29, skin='swy',
                      hands=hands([(6, 24), (7, 24)], [(16, 24), (17, 24)], [(9, 24), (10, 24)], [(13, 24), (14, 24)])),
}
for _k, _v in NEW.items():
    P.SPECS.setdefault(_k, _v)


# ── 2차(2026-10-16): 몸 베이스 확장용 자동 분할. head_skin 으로 얼굴 상자를 뽑고 마스크 시트를 눈으로 확인한 뒤 OVERRIDE 로 보정한다.
def auto_spec(key, skin=None, waist=25, shoe_top=29, ytweak=0):
    import harness as H
    pal, fr = H.base_of(key)
    sk = set(skin) if skin is not None else {c for c, v in pal.items() if v and P.skin_like(v)}
    face = {}
    for d in ('down', 'right', 'left'):
        rows = fr[(d, 1)]
        top = min(P.opaque_rows(rows))
        b = P.head_skin(pal, rows, top, skin_letters=sk)
        face[d] = (b[0], b[1] + ytweak, b[2], b[3]) if b else None
    face['up'] = None
    t_start = max(b[3] for b in face.values() if b) + 1
    def ext(y):
        r = P.row_extent(fr[('down', 1)], y)
        return r
    r24 = ext(24) or (6, 17)
    hands_ = hands([(r24[0], 24), (r24[0] + 1, 24)], [(r24[1] - 1, 24), (r24[1], 24)],
                   [(P.row_extent(fr[('right', 1)], 24) or (8, 15))[0] + 1, 24], [(P.row_extent(fr[('left', 1)], 24) or (8, 15))[1] - 1, 24])
    return dict(face=face, t_start=t_start, waist=waist, shoe_top=shoe_top, skin=''.join(sorted(sk)), hands=hands_)


AUTO_BASES = {'Actor2:1': dict(skin='uw'), 'Actor2:0': dict(skin='qr'), 'Actor4:6': dict(skin='vyq'),
              'Actor4:3': dict(skin='ptw'), 'People5:1': dict(), 'Actor3:3': dict(skin='ru')}
# 눈으로 본 얼굴 상자(눈~턱 전부). t_start 는 상자 아래 줄 +1 로 다시 계산한다.
OVERRIDE_FACE = {
    'Actor2:1': {'down': (7, 13, 16, 17), 'right': (11, 13, 16, 17), 'left': (7, 13, 12, 17)},
    'Actor2:0': {'down': (7, 12, 16, 17), 'right': (11, 12, 16, 17), 'left': (7, 12, 12, 17)},
    'Actor4:6': {'down': (8, 12, 15, 18), 'right': (11, 12, 17, 18), 'left': (7, 12, 12, 18)},
    'Actor4:3': {'down': (8, 12, 16, 18), 'right': (11, 12, 17, 18), 'left': (7, 12, 12, 18)},
    'People5:1': {'down': (7, 14, 16, 19), 'right': (10, 14, 16, 19), 'left': (7, 14, 13, 19)},
    'Actor3:3': {'down': (8, 13, 16, 18), 'right': (10, 13, 16, 18), 'left': (7, 13, 12, 18)},
}
for _k, _kw in AUTO_BASES.items():
    if _k not in P.SPECS:
        _sp = auto_spec(_k, **_kw)
        _sp['face'].update(OVERRIDE_FACE[_k])
        _sp['t_start'] = max(b[3] for b in _sp['face'].values() if b) + 1
        P.SPECS[_k] = _sp
