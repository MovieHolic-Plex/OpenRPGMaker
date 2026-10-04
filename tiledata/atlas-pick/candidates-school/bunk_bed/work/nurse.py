import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)
P = lambda r, s: (r, s)

def bed(frame='vwhite', sheet=('vwhite', 5), sh_hi=6, sh_lo=3, pillow=('vwhite', 6), blanket='jersey', shade_right=False, wheels=False, iv=False, deep=False):
    c = C(16, 32)
    fx0, fx1 = 1, 14 if not iv else 12
    w = fx1 - fx0 + 1
    # 머리판
    c.rect(fx0, 0, w, 3, P(frame, 4)); c.hl(fx0, 0, w, P(frame, 6)); c.hl(fx0, 2, w, P(frame, 2)); c.px(fx0, 0, '.'); c.px(fx1, 0, '.')
    # 몸틀 옆 난간
    c.vl(fx0, 3, 24, P(frame, 5)); c.vl(fx1, 3, 24, P(frame, 1 if deep else 2))
    # 매트리스/시트
    c.rect(fx0 + 1, 3, w - 2, 24, sheet)
    c.vl(fx0 + 1, 3, 24, P(sheet[0], sheet[1] + 1 if sheet[1] < 6 else 6)); c.vl(fx1 - 1, 3, 24, P(sheet[0], sh_lo))
    # 베개 (맨 위 칸)
    px0 = fx0 + 2
    c.rect(px0, 4, w - 4, 5, pillow); c.hl(px0, 4, w - 4, P(pillow[0], min(6, pillow[1] + 1)) if pillow[1] < 6 else P(pillow[0], 6)); c.hl(px0, 8, w - 4, P(pillow[0], sh_lo)); c.vl(px0 + w - 5, 4, 5, P(pillow[0], sh_lo))
    c.px(px0, 4, '.') if False else None
    # 시트 접힘선 (위 3/4 지점)
    c.hl(fx0 + 1, 10, w - 2, P(sheet[0], sh_hi)); c.hl(fx0 + 1, 11, w - 2, P(sheet[0], sh_lo))
    # 담요(체육복 색) 접어 발치에
    b0, b1 = 19, 25
    c.rect(fx0 + 1, b0, w - 2, b1 - b0 + 1, P(blanket, 3)); c.hl(fx0 + 1, b0, w - 2, P(blanket, 5)); c.hl(fx0 + 1, b0 + 1, w - 2, P(blanket, 4)); c.hl(fx0 + 1, b1, w - 2, P(blanket, 1))
    c.vl(fx1 - 1, b0, b1 - b0 + 1, P(blanket, 2))
    # 발치 난간 & 다리
    c.rect(fx0, 27, w, 2, P(frame, 4)); c.hl(fx0, 27, w, P(frame, 6)); c.hl(fx0, 28, w, P(frame, 2 if not deep else 1))
    for x in (fx0, fx1 - 1):
        c.rect(x, 29, 2, 2, P('viron', 3)); c.px(x, 29, P('viron', 5)); c.vl(x + 1, 29, 2, P('viron', 1))
    if shade_right:
        for y in range(3, 27):
            for x in range(fx0 + w // 2 + 1, fx1):
                ch = c.get(x, y)
                # 오른쪽 절반을 한 단 어둡게
                pass
    return c, fx0, fx1

def fin(c, X, note, x0=1, x1=14):
    c.shadow(x0 + 1, 30, x1 - x0, 2)
    c.px(15, 31, '.') if False else None
    c.save(out('nurse_bed', X), note)
