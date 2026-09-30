#!/usr/bin/env python3
"""현대 계열(일본·강남·학원) 공통 「3판(style bible)」 팔레트 tiledata/atlas-pick/palette/modern3.pal 을 만든다.
  python3 scripts/content/atlas-pick/make_modern3_palette.py          # pal 쓰기 + 램프 검사(루마 간격·색 중복·색 수 상한)
  python3 scripts/content/atlas-pick/make_modern3_palette.py --print  # 램프별 hex 만 출력

근거 = tiledata/atlas-pick/modern-style-bible.md. jp2.pal 은 손으로 정한 25램프(단 수 3~8 제각각)였다.
modern3 는 **규칙으로 정한다**: 재료마다 (기준 색상 h0, 채도 s0, 명도 V 목록)만 손으로 정하고,
단마다 색상·채도가 이동하는 규칙은 아래 shift() 하나가 정한다.

  · 단 번호 t = -3 … +3 (7단 램프. 기본 단 t0 = 인덱스 3). 5단 램프는 t = -2 … +2.
  · 어두워질수록 색상이 청보라(258°)로 끌려가고 채도는 약간 올라간다(그림자 = 차갑고 탁하지 않게).
  · 밝아질수록 색상이 따뜻한 살구(48°) 쪽으로 조금 끌려가고 채도는 내려간다(빛 = 따뜻하게, 흰색에 가까워질수록 무채색).
  · 순검정·순백 없음. 최암 = sumi 램프(보라 검정), 최명 = shiro 램프 상단(보라 기운 흰색).
  · 램프 안 인접 단의 밝기(CIE L*) 차 ≥ MIN_DL — 한 화소 선이 읽히는 최소 간격. 넘지 못하면 이 스크립트가 실패한다.
참고 그림(구티크룸 오사카 시티, 상용·재배포 금지)에서는 색을 **눈으로 잰 경향**(차가운 청보라 회색 바탕, 어두운 쪽 h≈255~262,
따뜻한 색은 기와·붉은 벽·단풍·간판에만)만 배웠다. 어떤 hex 도 옮기지 않았다 — 아래 수치는 전부 우리가 정한 것이다."""
import colorsys, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

COOL, WARM = 258.0, 48.0        # 어두운 쪽 · 밝은 쪽 끌림 목표 색상(°)
MIN_DL = 4.0                    # 램프 안 인접 단 최소 L* 차
MAX_COLORS = 160                # 현대 계열 공통 색 상한(램프 색 수 합)

MAX_WARM, MAX_COOL = 24.0, 32.0  # 램프 끝 단의 색상 이동 상한(°). 이 이상 끌면 유리가 초록·보라로 튄다(실측: 1차 시도에서 conc 밝은 쪽이 민트색이 됐다)

def _wrap(d):
    return (d + 180) % 360 - 180

def _toward(h0, tgt, k, cap, prefer_up=False):
    d = _wrap(tgt - h0)
    if prefer_up and abs(d) > 150: d = abs(d)     # 반대편(±180)이면 보라·분홍 쪽(+)으로 간다 — 초록·청록 쪽 금지
    return max(-cap, min(cap, d * k))

def shift(h0, s0, vs, dark_k=0.5, warm_k=0.35):
    """(h0°, s0, V 목록) → hex 목록. 가운데 단이 기준(h0, s0). 어두운 쪽 → COOL, 밝은 쪽 → WARM."""
    n = len(vs); mid = n // 2; out = []
    dk = [1.0, 0.6, 0.3]; wk = [0.3, 0.6, 1.0]
    dk = dk[3 - mid:]; wk = wk[:mid] if mid == 3 else wk[3 - mid:]
    for i, v in enumerate(vs):
        if i < mid:
            k = dark_k * dk[i]; h = h0 + _toward(h0, COOL, k, MAX_COOL); s = s0 * (1 + 0.14 * (mid - i) / mid)
        elif i > mid:
            k = warm_k * wk[i - mid - 1]; h = h0 + _toward(h0, WARM, k, MAX_WARM, True); s = s0 * (1 - 0.34 * (i - mid) / mid)
        else:
            h, s = h0, s0
        r, g, b = colorsys.hsv_to_rgb((h % 360) / 360.0, max(0.0, min(1.0, s)), v)
        out.append('%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255)))
    return out

def lstar(hexs):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hexs[i:i + 2], 16) for i in (0, 2, 4))
    y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return 116 * (y ** (1 / 3)) - 16 if y > 0.008856 else 903.3 * y

# 이름: (한국어 재료, h0, s0, V 목록[, dark_k, warm_k])
SPEC = {
    # ── 바닥 ──
    'yoru':   ('아스팔트(차도)',              250, .17, [.15, .20, .26, .32, .39, .46, .53]),
    'hodo':   ('보도 블록·연석·콘크리트 바닥', 238, .14, [.32, .40, .48, .56, .64, .72, .80]),
    # ── 벽·지붕·금속 ──
    'conc':   ('밝은 콘크리트·흰 타일 벽',     228, .12, [.36, .46, .57, .68, .78, .87, .95]),
    'tairu':  ('푸른 타일 벽',                 212, .30, [.24, .32, .40, .49, .58, .68, .78]),
    'ita':    ('널판(목재 외장)·문·간판판',     28, .34, [.20, .27, .35, .44, .53, .63, .73]),
    'garasu': ('유리 커튼월·쇼윈도',           200, .45, [.22, .32, .42, .53, .64, .75, .88]),
    'kawara': ('기와(테라코타)',                14, .58, [.24, .32, .42, .52, .62, .72, .82], 0.25, 0.30),
    'renga':  ('붉은 벽·벽돌',                   6, .50, [.20, .28, .37, .47, .57, .67, .77], 0.25, 0.30),
    'tekko':  ('철·실외기·난간·창틀',          242, .13, [.18, .26, .35, .45, .55, .66, .77]),
    # ── 식물 ──
    'ki':     ('가로수 잎',                    130, .48, [.12, .20, .29, .39, .50, .62, .75], 0.30, 0.30),
    # ── 5단 램프 ──
    'mado':   ('불 켜진 창',                    44, .55, [.32, .52, .72, .88, .98], 0.20, 0.10),
    'kinari': ('크림 띠·가드레일',              52, .22, [.42, .58, .74, .88, .97], 0.30, 0.10),
    'shiro':  ('흰 페인트·횡단보도',           250, .07, [.50, .68, .84, .94, .99], 0.40, 0.10),
    # ── 간판·신호·차체(작은 덩이 전용 채도색) ──
    'aka':    ('빨강(간판·차양·단풍)',         355, .80, [.30, .50, .70, .86, .97], 0.15, 0.20),
    'daidai': ('주황',                          22, .80, [.34, .54, .76, .92, 1.0], 0.20, 0.15),
    'kii':    ('노랑(보도 블록·표지)',          48, .86, [.34, .56, .78, .94, 1.0], 0.20, 0.05),
    'midori': ('초록(편의점·신호)',            150, .70, [.24, .42, .60, .78, .94], 0.30, 0.20),
    'sora':   ('하늘·파랑(간판)',              200, .76, [.28, .46, .66, .84, .97], 0.30, 0.20),
    'pinku':  ('분홍',                         330, .56, [.32, .50, .70, .86, .98], 0.25, 0.20),
    # ── 강남·학원 전용 재료 ──
    'soil':   ('흙·화단·운동장',                 26, .46, [.20, .30, .41, .53, .65], 0.30, 0.25),
    'yuka':   ('교실 마루·체육관 바닥·코르크',   32, .48, [.36, .50, .63, .76, .88], 0.30, 0.30),
    'kokuban':('칠판(짙은 초록)·게시판',        160, .34, [.14, .22, .31, .41, .52], 0.40, 0.20),
    'lino':   ('리놀륨·복도 바닥·식판',         148, .20, [.32, .42, .53, .64, .75], 0.40, 0.25),
    'murasaki':('보라(유니폼·매트·간판)',        292, .50, [.26, .42, .58, .74, .90], 0.20, 0.20),
    'kon':    ('감색(교복·남색 간판·藍)',       228, .62, [.24, .36, .50, .66, .82], 0.25, 0.25),
    # ── 네온(밝은 심지 → 번짐) 3단 ──
    'neonP':  ('네온 분홍',                    322, .70, [.62, .88, 1.0], 0.0, 0.0),
    'neonC':  ('네온 청록',                    186, .70, [.62, .88, 1.0], 0.0, 0.0),
    # ── 윤곽 ──
    'sumi':   ('윤곽·깊은 그늘(보라 검정)',    262, .52, [.10, .15, .22], 0.0, 0.0),
}

def build():
    ramps = {}
    for name, sp in SPEC.items():
        _, h0, s0, vs = sp[:4]; dk, wk = (sp[4], sp[5]) if len(sp) > 4 else (0.5, 0.35)
        ramps[name] = shift(h0, s0, vs, dk, wk)
    return ramps

def check(ramps):
    bad = []; seen = {}
    for n, r in ramps.items():
        for i in range(len(r) - 1):
            d = lstar(r[i + 1]) - lstar(r[i])
            if d < MIN_DL and n not in ('neonP', 'neonC', 'sumi'): bad.append('%s %d→%d ΔL*=%.1f' % (n, i, i + 1, d))
        for h in r:
            if h in seen: bad.append('중복 %s: %s·%s' % (h, seen[h], n))
            seen[h] = n
    tot = sum(len(r) for r in ramps.values())
    if tot > MAX_COLORS: bad.append('색 %d > 상한 %d' % (tot, MAX_COLORS))
    return bad, tot

def main():
    ramps = build()
    if '--print' in sys.argv:
        for n, r in ramps.items(): print('%-7s' % n, ' '.join(r))
        return
    bad, tot = check(ramps)
    if bad:
        print('램프 검사 실패:'); [print('  ' + b) for b in bad]; sys.exit(1)
    out = ['// 현대 계열 공통 3판(style bible) 팔레트 — 재료마다 기준색 + 규칙(어두운 쪽 청보라 · 밝은 쪽 살구빛)으로 낸 램프. 근거 tiledata/atlas-pick/modern-style-bible.md',
           '// 이 파일은 scripts/content/atlas-pick/make_modern3_palette.py 가 만든다. 손으로 색을 더하지 마라(modern3_check.py 가 이 밖의 색을 불합격시킨다).',
           '// 7단 램프 t=-3…+3(0 = 가장 어두움, 3 = 기본 t0). 5단 t=-2…+2. 반투명 없음: 그림자는 같은 램프의 낮은 단으로 굽는다.', '']
    for name, r in ramps.items():
        out.append('// %s' % SPEC[name][0])
        out.append('@rampc %-7s ' % name + ' '.join('#' + h for h in r))
    out += ['', '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    p = os.path.join(PAL_DIR, 'modern3.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, '램프 %d · 색 %d(상한 %d)' % (len(ramps), tot, MAX_COLORS))

if __name__ == '__main__':
    main()
