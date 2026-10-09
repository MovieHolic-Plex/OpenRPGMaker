# 버들항 웨이브 4 — 귀족 저택 + 예술 도시(mansion-art-city). 다시 돌리면 같은 그림이 나온다.
#   python3 make_mansion-art-city.py   → parts/, partmeta.json, parts.md, render-1x/2x.png, grid.json, compare-ref.png, check-autotile.png
#   (보정 패스 2026-10-08: mc_fix.py — 연못·꽃밭·낙엽 오토타일, 헤링본·테두리 띠·로터리 벽돌, 슬레이트·구리 지붕. compare-ref 는 _qa/before-render-1x.png 와 비교)
# 한 렌더에 두 판: 위 = 야외(64×38: 저택 영지 + 예술 거리 + 큰길), 아래 = 저택 1층 실내(46×24: 대홀·응접실·서재·식당·그림 복도).
import os, sys, json
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
assert OUT.endswith('mansion-art-city')
from mc_base import *
import mc_parts as MPT
import mc_omap as OM, mc_imap as IM

PARTS = MPT.build_all(); META = MPT.META; KEEP = MPT.KEEP


def S_out():
    S = dict(PARTS)
    for k, v in KEEP.items(): S[k] = v
    return S


def save_parts():
    pdir = os.path.join(OUT, 'parts'); os.makedirs(pdir, exist_ok=True)
    for f in os.listdir(pdir):
        if f.endswith('.png') and f[:-4] not in PARTS: os.remove(os.path.join(pdir, f))
    for n, im in PARTS.items(): im.save(os.path.join(pdir, n + '.png'))
    json.dump(META, open(os.path.join(OUT, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
    cnt = {}
    for n in MPT.ORDER: cnt[META[n]['kind']] = cnt.get(META[n]['kind'], 0) + 1
    with open(os.path.join(OUT, 'parts.md'), 'w') as f:
        f.write('# 저택·예술 도시 (mansion-art-city) — 새 조각\n\n버들항 파이프라인(city_v6: 칩셋 팔레트·pz.C 볼륨 화가·pz.fin 윤곽·회벽 집 블록·ph2 지붕)으로 새로 그린 조각만 적는다. '
                '기존 버들항·극장 그림(지도에 함께 쓴 대리석 기둥·샹들리에·종려 화분·벽등·그랜드 피아노·진홍 깔개·칩셋 나무)은 다시 내보내지 않는다. 칸 = 16px.\n\n')
        for n in MPT.ORDER:
            im = PARTS[n]; m = META[n]
            f.write('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸\n' % (n, im.width, im.height, m['ko'], m['desc'], im.width // T, im.height // T))
        f.write('\n합계 **%d** 종 (%s).\n' % (len(MPT.ORDER), ', '.join('%s %d' % kv for kv in sorted(cnt.items()))))
    return cnt


if __name__ == '__main__':
    cnt = save_parts(); print('parts', len(PARTS), cnt)
    S = S_out(); S['bust_pedestal_in'] = PARTS['bust_pedestal']
    om, omarks = OM.build(S)
    oimg = om.render()
    print('outdoor BAD', om.BAD)
    oimg.save(os.path.join(OUT, '_qa', 'out1x.png'))
    im_, imarks, ibad = IM.build(S)
    iimg = im_.render()
    print('indoor BAD', ibad)
    import mc_finish
    mc_finish.finish(OUT, om, omarks, oimg, im_, imarks, iimg, PARTS)
    print('compare', mc_finish.compare_fix(OUT, PARTS))
    import mc_fix as FX                                                         # 보정 패스: 새 오토타일 이음매 시험
    print('check-autotile', FX.check_autotile(os.path.join(OUT, 'check-autotile.png'),
          [(n, PARTS[n]) for n in ('autotile-garden-pond', 'autotile-flowerbed-red', 'autotile-flowerbed-yellow', 'autotile-flowerbed-white', 'autotile-leaf-litter')]))
