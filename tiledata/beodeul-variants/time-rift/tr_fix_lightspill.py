# 전수 감사 보정(2026-10-08, tiledata/beodeul-kits/audit_autotile.py) — autotile-lightspill 이음매 튐 없애기.
#   옛 판: tr_auto.lightspill_cell — 변마다 주기 4 잡음 윤곽 + 4x4 디더 점무늬만(속까지 구멍). 덩이 바깥 윤곽이 디더 점으로 정해져
#          칸 경계에서 윤곽이 5px 튀었다(seam 5, 게이트 3 초과). 둥근 정도는 이미 합격(bad 0.146).
#   새 판: 공용 깊이장 autotile_edge.edge_fields(정원 연못 윤곽: 큰 혹+잔 혹, 칸 끝은 얕게 모여 이웃 칸과 같은 높이로 이어진다,
#          볼록 모서리 반지름 7) 안을 옅은 빛 막(반투명 한 겹, 구멍 없음)으로 채우고 그 위에 같은 디더 빛 점무늬·빛 알갱이를 올린다.
#          윤곽 밖 1.5px 은 아주 옅은 디더 점(덩이 윤곽에 안 잡히는 알파)으로 빛이 번져 나간다.
#   tr_auto.lightspill_cell 이 이 함수를 부르므로 make_time_rift.py 를 다시 돌리면 지도·조각이 같이 새 판이 된다.
#   덮어쓰는 파일: parts/autotile-lightspill.png 하나(이름 그대로).
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from PIL import Image
from tr_base import GLOW, BAYER, _hash, sheet_from_cells
from autotile_edge import edge_fields


def lightspill_cell(n, G=None, seed=5, inset=2.6, jag=3.0, rad=7.0):
    G = G or GLOW['blue']
    m = edge_fields(n, inset=inset, jag=jag, rad=rad, seed=seed)[0]
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; b = BAYER[y % 4, x % 4]
            if v < -1.5: continue
            if v < 0:                                              # 윤곽 밖: 아주 옅게 번진 빛 점(알파 40 — 덩이 윤곽 밖)
                if b < .25 + .15 * v: a[y, x, :3] = G[3]; a[y, x, 3] = 40
                continue
            q = min(1.0, v / 6.0)
            k, al = 3, int(70 + 25 * q)                            # 빛 막: 구멍 없는 반투명 한 겹(가장자리 옅고 속으로 짙게)
            if b <= .12 + .40 * q:                                 # 디더 빛 점무늬(속으로 갈수록 촘촘)
                k = 4 if _hash(x, y, seed) > .55 else 3; al = int(100 + 50 * q)
            if _hash(x, y, seed + 7) > .965 and v > 1: k, al = 6, 220   # 빛 알갱이
            a[y, x, :3] = G[k]; a[y, x, 3] = al
    return Image.fromarray(a, 'RGBA')


def lightspill_sheet(color='blue', **kw):
    return sheet_from_cells([lightspill_cell(n, GLOW[color], **kw) for n in range(16)])


if __name__ == '__main__':
    out = os.path.join(HERE, 'parts', 'autotile-lightspill.png')
    lightspill_sheet().save(out); print('wrote', out)
