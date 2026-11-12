"""sf_station v3 — Fable 5.2 medium 한 방 다시 그리기(2026-11-12). 같은 id·크기·칸·통행으로 옛 조각(v2, Opus)의 그림만 바꾼다.

그림은 코드가 아니라 PNG 다: tiledata/sf-station/redraw/pieces/<id>.png (그린 과정·프롬프트·조립기는 scripts/content/sf-station/redraw/, 모델 답은 tiledata/sf-station/redraw/units/).
이 모듈은 sf_all.MODS 의 맨 끝에서 불려, PNG 가 있는 조각의 draw 를 «그 PNG 를 그대로 찍기» 로 바꾼다. PNG 가 없는 조각은 옛 그림 그대로다.
새 조각 4개(terminal·alarm·supply-capsule·toilet)는 같은 날 오너가 승인한 Fable 기물(면제 묶음 fable-oneshot-2026-11-12)이다.
관문: 이 그림들은 3/4 관문을 통과하지 않았다 — 오너 면제(fable-redraw-sf_station-2026-11-12)로만 번들에 들어간다(sf_core.status_of).
"""
import os
import numpy as np
from PIL import Image
import sf_core as C

DIR = os.path.join(C.OUT, 'redraw', 'pieces')
REDRAWN = set()

# 구운 팔레트 v4(역할별 48색, CONTRACT §6·§9) — 이름은 추가만. 값의 근거·역할·그린 색→구운 색 옮김 표는 redraw/sfr_palette.py.
# 밤 거리의 땅·건물과 승무원 선실 바닥은 옛 시트의 밝기 범위다(버들항 띠는 낮의 마른 땅에만 쓴다).
PALETTE_V3 = {
 'ink': '071528 1c2230',
 'g_deck': '3b475e 4f5f7a 5b6c88 667896', 'g_tile': 'a0a9b4 b4bcc6 c3cad2', 'g_road': '1a1a22 26262f 34343f 44444f', 'g_dust': '5a5a64 70707c 888894 a2a2ae', 'g_carpet': '131a30 1b2542 253256 264268',
 's_hull': '2e384c 3b475e 4f5f7a 667896 8396b2 a3b4cb', 's_white': '59626f 7c8693 a0a9b4 c3cad2', 's_dark': '26262f 34343f 44444f', 's_night': '131a30 1b2542 253256', 's_violet': '1c1040 2c1a66 40288c',
 's_glass': '264268 365c88 4c7aa8', 's_rust': '66301a 8a4626 b85a1c',
 'a_cyan': '12687e 2cb0cc a0ecf6', 'a_orange': 'b85a1c f09a40', 'a_yellow': 'd9bc2c ffee86', 'a_magenta': '861a76 d63cbe ff9eea', 'a_violet': '5a3cb4 9c84f0', 'a_green': '1e6c32 44b45c', 'a_glow': 'ffffff',
}
for _n, _v in PALETTE_V3.items():
    C.RAMPS.setdefault(_n, C._h(_v))
C.ALLOWED |= {c for n in PALETTE_V3 for c in C.RAMPS[n]}


def _paste(path):
    def draw(c):
        a = np.array(Image.open(path).convert('RGBA'))
        assert a.shape[:2] == (c.h, c.w), (path, a.shape, c.w, c.h)
        c.a[:] = a
    return draw


def _load():
    if not os.path.isdir(DIR): return
    for f in sorted(os.listdir(DIR)):
        if not f.endswith('.png'): continue
        pid = f[:-4]
        p = C.PIECES.get(pid)
        if p is None: continue
        p['draw'] = _paste(os.path.join(DIR, f)); p['frames'] = 1; REDRAWN.add(pid)
    C.KEEP_OL.update(REDRAWN)          # 윤곽 재칠(selout) 없이 화소 그대로


# 같은 날 승인된 Fable 기물 4개 — 새 조각(키트 sf-terminal 등). 칸 번호는 핀 끝에 덧붙는다.
NEW = [
 ('terminal', '단말기(시안 화면이 달린 기둥형 조작 단말)', 1, 2, 'box', 'interior', [(0, 1)], ['단말기', '장치'], '서 있는 조작 단말기. 아래 칸만 막힘.'),
 ('alarm', '경보기(위험 띠 기둥 위 주황 경광등)', 1, 2, 'other', 'interior', [(0, 1)], ['경보기', '장치'], '경보 기둥. 아래 칸만 막힘.'),
 ('supply-capsule', '보급 캡슐(흰 둥근 캡슐 + 주황 띠 + 착륙 다리)', 2, 2, 'box', 'outdoor', [(0, 1), (1, 1)], ['보급', '캡슐', '상자'], '떨어진 보급 캡슐. 아래 줄이 막힘.'),
 ('toilet', '변기(흰 타원 변기 + 물탱크)', 1, 1, 'seat', 'interior', [(0, 0)], ['변기', '위생'], '위생실 변기.'),
]
for _id, _name, _w, _h, _kind, _group, _solid, _tags, _desc in NEW:
    _path = os.path.join(DIR, _id + '.png')
    if os.path.exists(_path) and _id not in C.PIECES:
        C.piece(_id, _name, _w, _h, _kind, group=_group, solid=_solid, tags=_tags, desc=_desc)(_paste(_path))
_load()
