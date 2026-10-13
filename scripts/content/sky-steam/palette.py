"""sky_steam 공용 팔레트 — 하늘섬(A)·증기 산업도시(B)가 같이 쓴다. 이름·순서를 바꾸지 말 것(추가만).
램프 = 9단(t=-4 가장 어둡게 … +4 가장 밝게), 핵심 5색(어두움→밝음)을 사이 보간. K(name, t) 로 꺼낸다.
근거: tiledata/worldmap-kit/iconsets/steampunk(놋쇠·검댕 벽돌·마석 보라·구리·철) + 하늘 파랑·구름 흰색(새 색).
"""
from __future__ import annotations

def _h(s): return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

def _ramp(keys):
    k = [_h(x) for x in keys]; out = []
    for i in range(9):
        p = i / 8 * (len(k) - 1); a = int(p); b = min(a + 1, len(k) - 1); f = p - a
        out.append(tuple(round(k[a][c] + (k[b][c] - k[a][c]) * f) for c in range(3)))
    return out

KEYS = {
    # 월드맵 steampunk 에서 온 재질
    'brass':  ('3a2a10', '6e5018', 'a47a26', 'd2a640', 'f2d479'),
    'soot':   ('1e1a1a', '3c2e2a', '5e4640', '7e5e52', 'a08272'),     # 검댕 벽돌
    'magi':   ('241038', '4a2478', '7a48b4', 'a674dc', 'd8b6f6'),     # 마석 보라
    'copper': ('3a1c10', '74381c', 'b0582c', 'd88848', 'f2b878'),
    'iron':   ('16181c', '33383e', '565c64', '838b92', 'b8bfc4'),
    # 새 색: 하늘·구름
    'sky':    ('2c5a9c', '4c82c8', '7ab0e4', 'a6d0f0', 'd4ecfa'),
    'cloud':  ('7c8cb4', 'a4b2d0', 'c8d2e6', 'e6ecf6', 'fcfeff'),
    # 섬 지형·목재·천
    'grass':  ('1c3a1c', '34602a', '5a8c3a', '88b84c', 'bcdc74'),
    'rock':   ('24222a', '45424e', '6a6674', '948f9c', 'bfbac4'),
    'earth':  ('2a1c14', '4a3222', '6e4c32', '92704a', 'b89468'),
    'wood':   ('2c1c10', '56361c', '84582c', 'b08040', 'd8aa66'),
    'canvas': ('6a5a46', '958568', 'bfae8a', 'ddd0b0', 'f4ecd2'),
    'red':    ('3a0e0e', '701c1c', 'a82c28', 'd45848', 'f08c74'),   # 깃발·지붕 포인트
}
RAMPS = {n: _ramp(k) for n, k in KEYS.items()}
OL = (14, 12, 22)          # 윤곽선(거의 검정 보라)
CLEAR = (0, 0, 0, 0)

def K(name, t=0):
    """램프에서 (r,g,b). t=-4..4 (범위 밖은 끝으로)."""
    return RAMPS[name][max(-4, min(4, t)) + 4]

def all_colors():
    s = {OL}
    for r in RAMPS.values(): s.update(r)
    return sorted(s)
