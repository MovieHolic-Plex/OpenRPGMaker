"""미술관·갤러리 방 키트 — 벽에 거는 그림(초상·풍경·저주받은 초상 3프레임) · 진열장 · 흉상 받침 · 갑옷 · 차단 줄 · 관람 의자 · 항아리 받침."""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, run_module   # noqa: E402
from gmdraw import *                         # noqa: E402,F403

MODULE = 'int_gallery'
SP = 'gallery'


def frame(c, x, y, w, h, m='gold'):
    """두꺼운 금 액자(아래 테에 위에서 보이는 윗면 한 줄 + 벽에 지는 그림자)."""
    c.R(x + 1, y + 1, w, h, K('ink', 1))                                   # 벽에 지는 그림자(오른쪽 아래)
    c.R(x, y, w, h, K(m, 3))
    c.HL(x, y, w, K(m, 5)); c.VL(x, y, h, K(m, 5)); c.HL(x, y + h - 1, w, K(m, 1)); c.VL(x + w - 1, y, h, K(m, 1))
    c.HL(x + 1, y + 1, w - 2, K(m, 4)); c.VL(x + 1, y + 1, h - 2, K(m, 4)); c.HL(x + 2, y + h - 2, w - 4, K(m, 2))
    for k in range(x + 3, x + w - 3, 3): c.P(k, y + 1, K(m, 6))


def portrait(c, x, y, w, h, f=0):
    """어두운 배경 초상: 창백한 얼굴·검은 옷·흰 깃. f=1 이면 눈이 붉게 빛나고 2 면 고개를 돌린다."""
    c.R(x, y, w, h, K('violet', 1))
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if hsh(xx, yy, 7) < .1: c.P(xx, yy, K('violet', 2))
    cx = x + w // 2 + (1 if f == 2 else 0)
    c.poly([(x + 1, y + h), (cx - 4, y + h - 7), (cx + 4, y + h - 7), (x + w - 1, y + h)], K('ink', 2))
    c.HL(cx - 2, y + h - 7, 5, K('bone', 5))
    c.ellipse(cx, y + h - 11, 3, 3.6, K('bone', 4)); c.VL(cx + 2, y + h - 13, 4, K('bone', 3))
    c.HL(cx - 3, y + h - 15, 7, K('ink', 2)); c.P(cx - 3, y + h - 13, K('ink', 2))
    eye = K('velvet', 5) if f == 1 else K('ink', 1)
    c.P(cx - 1, y + h - 12, eye); c.P(cx + 1, y + h - 12, eye)


@REG.piece('gm-paint-portrait', '금 액자 초상화(귀부인)', 1, 2, ['S', 'S'], 'furniture', SP, role='prop', kind='wall_mounted',
           tags=['그림', '초상화', '액자', '벽'], desc='북벽에 거는 두꺼운 금 액자 속 창백한 귀부인 초상(어두운 배경, 흰 깃). 벽에 그림자가 진다.',
           rules='북벽 벽면에 건다(wallTop 1 — 북벽 1~2행). 2~3칸 간격으로 줄지어.')
def _portrait(c):
    frame(c, 1, 2, 13, 24); portrait(c, 4, 5, 7, 18)


@REG.piece('gm-paint-cursed', '저주받은 초상(눈이 붉게 빛남, 3프레임)', 1, 2, ['S', 'S'], 'furniture', SP, role='prop', kind='wall_mounted',
           frames=3, fps=1, tags=['그림', '초상화', '공포', '애니메이션'], desc='귀족 남자 초상: 가끔 눈이 붉게 빛나고 고개가 살짝 돌아간다(평소·붉은 눈·돌린 고개).',
           rules='북벽 벽면(wallTop 1). 갤러리·홀에 하나 — 공포 연출.')
def _cursed(c, f):
    frame(c, 1, 2, 13, 24, m='gold'); portrait(c, 4, 5, 7, 18, f=f)
    c.R(5, 5, 5, 3, K('ink', 1)); c.P(5, 8, K('ink', 1))


@REG.piece('gm-paint-landscape', '풍경화(폭풍 치는 고성)', 2, 1, ['SS'], 'furniture', SP, role='prop', kind='wall_mounted',
           tags=['그림', '풍경화', '액자', '벽'], desc='넓은 금 액자 풍경화: 달 뜬 폭풍 하늘 아래 언덕 위 검은 고성과 고사목.',
           rules='북벽 벽면(wallTop 2 — 벽면 중간). 2칸 폭.')
def _landscape(c):
    frame(c, 1, 1, 30, 14)
    for y in range(3, 13):
        for x in range(3, 29): c.P(x, y, K('slate', 3 if y < 6 else 2 if y < 9 else 1))
    c.ellipse(23, 5, 2, 2, K('bone', 6))
    c.poly([(3, 12), (10, 8), (18, 9), (28, 12)], K('ink', 2))
    c.R(9, 5, 3, 4, K('ink', 1)); c.R(13, 6, 2, 3, K('ink', 1)); c.P(10, 4, K('ink', 1)); c.P(10, 6, K('glow', 5))
    c.line(25, 12, 26, 8, K('ink', 1)); c.line(26, 9, 28, 7, K('ink', 1))


@REG.piece('gm-display-case', '유리 진열장(해골·보석 유물)', 2, 2, ['SS', 'SS'], 'furniture', SP, role='prop', kind='low_furniture',
           tags=['진열장', '유리장', '유물', '미술관'], desc='나무 받침 유리 진열장: 위에서 보이는 유리 뚜껑(빛 반사) 너머 붉은 천 위 해골·보석 목걸이·단검, 금 테.',
           rules='갤러리 가운데 줄로. 둘레를 한 칸 비워 관람 동선을 낸다.')
def _case(c):
    rows = pslab(c, 0, 2, 32, 16, 0, m='gold', t=4, inset=3)                     # 원근 금 테 윗면
    for r in range(2, 14):                                                        # 유리 뚜껑 너머 붉은 천 바닥(같은 원근)
        xl, xr = rows[r]
        for x in range(xl + 2, xr - 1): c.P(x, 2 + r, K('velvet', 2))
    c.ellipse(10, 9, 3, 2.4, K('bone', 5)); c.P(9, 9, K('ink', 1)); c.P(11, 9, K('ink', 1)); c.ellipse(11, 12, 3, 1, K('velvet', 1))   # 해골(위에서) + 그림자
    c.ellipse(19, 9, 3, 1.8, K('gold', 5), fill=False); c.P(19, 11, K('velvet', 5))
    c.line(23, 13, 26, 6, K('iron', 5)); c.R(22, 12, 3, 2, K('gold', 4))
    for r in range(2, 9):                                                         # 유리 반사(사선)
        xl, xr = rows[r]; c.P(xl + 3 + r, 2 + r, K('glass', 6)); c.P(xl + 4 + r, 2 + r, K('glass', 5)); c.P(xl + 14 + r, 2 + r, K('glass', 5))
    c.R(1, 18, 30, 11, K('wood', 2)); c.HL(1, 18, 30, K('wood', 1)); c.VL(1, 18, 11, K('wood', 3)); c.VL(30, 18, 11, K('wood', 1))
    c.R(5, 21, 22, 5, K('wood', 3)); c.HL(5, 21, 22, K('wood', 1))
    c.R(2, 29, 2, 3, K('wood', 1)); c.R(28, 29, 2, 3, K('wood', 1))
    finish(c)


@REG.piece('gm-bust-plinth', '대리석 흉상 받침', 1, 2, ['C', 'S'], 'furniture', SP, role='prop', kind='figure',
           tags=['흉상', '석상', '미술관'], desc='넓은 정사각 받침(윗면 8행, 흉상은 뒤쪽) 위 대리석 흉상(가슴·고개).', rules='갤러리 벽을 따라 2~3칸 간격.')
def _bust(c):
    st = 'bone'
    pslab(c, 0, 15, 16, 10, 7, m='wood', t=5, fb=2, inset=2)                     # 흑단 받침: 원근 윗면 10행 + 앞면(놋쇠 명판)
    c.R(6, 27, 4, 2, K('gold', 4))
    c.ellipse(9, 21, 4.5, 1.4, K('wood', 3))                                      # 흉상 그림자
    c.poly([(3, 19), (4, 15), (6, 13), (10, 13), (12, 15), (13, 19)], K(st, 4))   # 어깨·가슴(받침 뒤쪽)
    c.HL(4, 15, 8, K(st, 6)); c.HL(6, 14, 4, K(st, 6)); c.VL(12, 15, 4, K(st, 2)); c.HL(4, 19, 9, K(st, 2))
    c.R(7, 10, 3, 3, K(st, 3))
    c.ellipse(8, 6.5, 2.8, 3.4, K(st, 5)); c.HL(6, 3, 5, K(st, 6)); c.VL(10, 5, 4, K(st, 4)); c.VL(11, 6, 3, K(st, 3)); c.P(9, 8, K(st, 3))
    finish(c)


@REG.piece('gm-armor', '갑옷 한 벌(받침대·미늘창)', 1, 2, ['C', 'S'], 'furniture', SP, role='prop', kind='figure',
           tags=['갑옷', '기사', '미술관', '홀'], desc='받침대에 세운 강철 판금 갑옷: 투구 윗면·어깨받이 윗면이 밝다, 미늘창을 쥐었다, 둥근 나무 받침.',
           rules='홀·갤러리 벽을 따라. 공포 연출로 한 벌은 위치가 바뀐다.')
def _armor(c):
    c.ellipse(8, 28, 6.5, 3, K('wood', 4)); c.ellipse(8, 29, 6.5, 2.5, K('wood', 2)); c.ellipse(8, 27.5, 5.5, 2, K('wood', 5))
    c.R(5, 18, 2, 10, K('iron', 4)); c.R(9, 18, 2, 10, K('iron', 3))
    c.R(4, 10, 8, 9, K('iron', 4)); c.VL(4, 10, 9, K('iron', 5)); c.VL(11, 10, 9, K('iron', 2)); c.HL(4, 14, 8, K('iron', 3))
    for x0 in (1, 11): c.R(x0, 8, 4, 4, K('iron', 4)); c.HL(x0, 8, 4, K('iron', 6))     # 어깨받이 윗면
    c.R(2, 12, 2, 6, K('iron', 3)); c.R(12, 12, 2, 6, K('iron', 2))
    c.R(5, 2, 6, 7, K('iron', 4)); c.HL(5, 2, 6, K('iron', 6)); c.HL(6, 1, 4, K('iron', 6)); c.HL(5, 5, 6, K('ink', 1)); c.VL(10, 3, 5, K('iron', 2))
    c.P(8, 0, K('velvet', 4))
    c.VL(14, 0, 28, K('wood', 3)); c.R(13, 0, 3, 4, K('iron', 5)); c.P(14, 0, K('iron', 6))
    finish(c)


@REG.piece('gm-stanchion', '관람 차단 줄(놋쇠 기둥 둘·붉은 줄)', 2, 1, ['SS'], 'furniture', SP, role='prop', kind='frame',
           tags=['차단줄', '미술관'], desc='둥근 받침 놋쇠 기둥 둘(위 공 꼭지 윗면) 사이에 처진 두꺼운 붉은 벨벳 줄.', rules='진열장·그림 앞 한 칸 띄워 가로로.')
def _stanchion(c):
    for x in (4, 27):
        c.ellipse(x, 13, 4.2, 2.6, K('gold', 1)); c.ellipse(x, 12.4, 4.2, 2.4, K('gold', 5)); c.ellipse(x - 1, 12, 2, 1, K('gold', 6))   # 둥근 받침 윗면
        c.R(x - 1, 4, 3, 8, K('gold', 3)); c.VL(x - 1, 4, 8, K('gold', 5)); c.VL(x + 1, 4, 8, K('gold', 2))
        c.ellipse(x, 4, 3.4, 2.4, K('gold', 2)); c.ellipse(x, 3.4, 3.4, 2.2, K('gold', 6)); c.P(x - 1, 3, K('bone', 6))   # 납작한 원반 갓 윗면
    for x in range(7, 25):
        y = 6 + int(math.sin((x - 7) / 18 * math.pi) * 3)
        c.P(x, y, K('velvet', 5)); c.P(x, y + 1, K('velvet', 3)); c.P(x, y + 2, K('velvet', 1))
    finish(c)


@REG.piece('gm-museum-bench', '관람 의자(가죽 등받이 없는 긴 의자)', 2, 1, ['SS'], 'furniture', SP, role='prop', kind='seat',
           tags=['의자', '벤치', '미술관'], desc='짙은 초록 가죽 쿠션 긴 의자(넓은 윗면·단추), 짧은 놋쇠 다리.', rules='갤러리 가운데, 그림을 바라보게.')
def _mbench(c):
    slab(c, 1, 3, 30, 7, 3, m='teal', t=4, fb=2, seams=0)
    for x in range(5, 28, 6): c.P(x, 6, K('teal', 2)); c.P(x + 3, 5, K('teal', 2))
    c.R(2, 13, 2, 3, K('gold', 3)); c.R(28, 13, 2, 3, K('gold', 2))
    finish(c)


@REG.piece('gm-vase-plinth', '받침 위 큰 도자기 항아리', 1, 2, ['C', 'S'], 'furniture', SP, role='prop', kind='container',
           tags=['항아리', '도자기', '미술관'], desc='네모 받침(윗면 보임) 위 청화 무늬 큰 도자기 항아리(아가리 속 어둠).', rules='갤러리 구석·문 양옆에 한 쌍.')
def _vase(c):
    slab(c, 2, 18, 12, 6, 8, m='wood', t=4, fb=2, seams=0)
    for y in range(7, 19):                                                       # 몸: 둥근 어깨 → 좁은 굽
        f = (y - 7) / 11; hw = 2.5 + math.sin(min(1, f * 1.25) * math.pi) * 3.6 if f < .8 else 3
        for x in range(int(round(8 - hw)), int(round(8 + hw))):
            u = (x - (8 - hw)) / (2 * hw); c.P(x, y, K('bone', 6 if u < .3 else 5 if u < .7 else 3))
    for x in range(3, 13): c.P(x, 12 + (x % 2), K('slate', 4))
    c.HL(4, 15, 8, K('slate', 3)); c.P(6, 10, K('slate', 4)); c.P(10, 10, K('slate', 4))
    c.ellipse(8, 4, 5.4, 4, K('bone', 6)); c.ellipse(8, 4, 5.4, 4, K('bone', 4), fill=False)   # 넓은 아가리 테(윗면)
    c.ellipse(8, 4.2, 3.8, 3, K('ink', 1)); c.HL(6, 2, 4, K('ink', 0))           # 아가리 속 어둠 6행
    finish(c)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
