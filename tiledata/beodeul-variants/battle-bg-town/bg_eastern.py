# eastern-castle — 동양풍 성 앞 자갈 마당. 그림 함수 = src-eastern-castle 복사본(ek_build·ek_props·ek_ground).
# 원경: 맑은 낮 하늘 띠·구름·먼 푸른 산. 천수각(겹지붕·회벽·창)이 바깥 성벽 위로 솟고, 성벽 = 석축(이시가키) 위 흰 회벽 담(도베이),
# 양 끝 망루(야구라). 그 앞 해자(버들항 운하 물 그림) + 돌 둑. 바닥: 흰 자갈 마당(ek_ground.compose 'suna'). 가장자리: 소나무·석등·고마이누·술통·볏섬.
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-eastern-castle'))
import numpy as np
from PIL import Image
import bgcommon as B
import ek_build as KB, ek_props as KP, ek_ground as KG

def I(x): return x if isinstance(x, Image.Image) else (x['im'] if isinstance(x, dict) else (x.img() if hasattr(x, 'img') else x))

WALLTOP = 150      # 담 밑줄(석축 윗면)
MOAT0, MOAT1 = 168, 180   # 해자 물
GY = 186           # 자갈 마당 시작

def make():
    im = B.new()
    B.sky(im, [(36, '#5f9bcc'), (74, '#79b0da'), (110, '#97c6e4'), (MOAT0, '#b9dcec')])
    for (cx, cy, w, h, s) in ((84, 30, 74, 13, 101), (560, 40, 86, 15, 102), (440, 14, 40, 8, 103), (190, 70, 40, 8, 104)):
        B.cloud(im, cx, cy, w, h, s)
    B.ridge(im, WALLTOP - 6, 52, ('#7d9fb2', '#97b8c8', '#6d90a3'), 111, step=4, period=(170, 71, 29))
    B.ridge(im, WALLTOP - 4, 22, ('#4b7a62', '#5f9274', '#3f6a54'), 112, step=3, period=(80, 33, 13))
    # 천수각(바깥 담 뒤 — 석축 아랫부분은 담이 가린다)
    ten = I(KB.tenshu())
    B.paste(im, ten.crop((0, 0, ten.width, 150)), 320 - ten.width // 2, WALLTOP + 2)
    # 석축(이시가키) 띠: 담 밑 ~ 해자
    stone = I(KB.ishigaki_wall(4, 2, seed=3))
    for x0 in range(0, 640, stone.width):
        B.paste(im, I(KB.ishigaki_wall(4, 2, seed=x0 // 64)), x0, MOAT0 + 4)
    # 흰 회벽 담(도베이) 한 줄 + 양 끝 망루
    for i, x0 in enumerate(range(-16, 660, 64)):
        B.paste(im, I(KB.dobei(4, seed=i)), x0, WALLTOP + 6)
    B.paste(im, I(KB.yagura(seed=1)), -12, WALLTOP + 6); B.paste(im, I(KB.yagura(seed=2, flip_=True)), 572, WALLTOP + 6)
    # 해자: 버들항 운하·항구 물 그림 띠(src-beodeul 사본) + 물가 그늘 한 줄
    wat = np.array(Image.open(os.path.join(HERE, 'src-beodeul', 'sprites', 'water_crop.png')).convert('RGB'))
    a = np.array(im)
    a[MOAT0 + 4:GY, :, :3] = wat[8:8 + GY - MOAT0 - 4, 100:740]
    a[MOAT0 + 4, :, :3] = (a[MOAT0 + 4, :, :3].astype(int) * 0.6).astype(np.uint8)
    im.paste(Image.fromarray(a, 'RGBA'))
    # 바닥: 원 장소 compose — 0줄 판석 둑(돌), 1~ 흰 자갈
    Wc, Hc = 40, 11
    keys = ('dirt', 'suna', 'raked', 'flag', 'tatami', 'board', 'ceil', 'void')
    M = {k: np.zeros((Hc, Wc), bool) for k in keys}
    M['flag'][0, :] = True; M['suna'][1:, :] = True
    M['suna'][2:9, 7:33] = False; M['raked'][2:9, 7:33] = True        # 가운데 갈퀴 무늬 모래(마당 가운데, 낮고 고른 결)
    g = np.array(KG.compose(Wc, Hc, M, np.zeros((Hc, Wc), bool), seed=4).convert('RGB'))
    a = np.array(im); a[GY:, :, :3] = g[:360 - GY, :640]
    a[GY, :, :3] = KG.STa[5]; a[GY + 1, :, :3] = KG.STa[4]       # 둑 갓돌 윗모
    im.paste(Image.fromarray(a, 'RGBA'))
    # 갈퀴 모래 바닥의 자갈 연석(원 장소 autotile-sunabed, 위1·오른2·아래4·왼8)
    sb = KG.autotile_sunabed(); R = M['raked']
    for cy in range(Hc):
        for cx in range(Wc):
            if not R[cy, cx]: continue
            n = sum(b for (dx, dy, b) in ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)) if 0 <= cy + dy < Hc and 0 <= cx + dx < Wc and R[cy + dy, cx + dx])
            im.alpha_composite(sb.crop((n % 4 * 16, n // 4 * 16, n % 4 * 16 + 16, n // 4 * 16 + 16)), (cx * 16, GY + cy * 16))
    # 가장자리 소품
    B.paste(im, I(KP.matsu(seed=1)), -14, 262); B.paste(im, I(KP.matsu(seed=2, flip_=True)), 590, 320)
    B.paste(im, I(KP.toro(seed=1)), 96, 236); B.paste(im, I(KP.toro(seed=2)), 568, 236)
    B.paste(im, I(KP.komainu(seed=1)), 72, 218); B.paste(im, I(KP.komainu(seed=1, flip_=True)), 586, 216)
    B.paste(im, I(KP.taru(seed=1)), 8, 330); B.paste(im, I(KP.taru(seed=2)), 26, 338); B.paste(im, I(KP.tawara(seed=1)), 600, 338)
    B.paste(im, I(KP.garden_rock(seed=1)), 60, 338); B.paste(im, I(KP.azalea(seed=1)), 584, 252); B.paste(im, I(KP.azalea(seed=2)), 40, 292)
    return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'eastern-castle.png')
    B.finish(make()).save(out); print(out, B.check(out))
