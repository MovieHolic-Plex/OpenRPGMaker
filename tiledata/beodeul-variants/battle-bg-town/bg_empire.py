# empire-city — 제국 도시 성채 앞 대로. 그림 함수 = src-empire-city 복사본(ec_build·ec_props·ec_ground).
# 원경: 그을음 낀 낮 하늘 띠·구름·굴뚝 연기, 성벽(위 철판·아래 마름돌, 진홍 걸개) 너머로 솟은 철판 성채 윗부분(첨탑·슬레이트 지붕).
# 뒷줄: 왼쪽 공장·굴뚝, 가운데 성문 탑, 오른쪽 장교 주택·감시 포탑. 바닥: 철판 대로(리벳 판) + 회색 판석 + 둥근 돌 보도(ec_ground.compose).
import os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-empire-city'))
import numpy as np
from PIL import Image
import bgcommon as B
import ec_build as EB, ec_props as EP, ec_ground as EG, ec_base as EBa

HB = 184           # 뒷줄 밑줄(성벽·집 바닥)

def make():
    im = B.new()
    B.sky(im, [(36, '#7b95ae'), (74, '#90a8bd'), (112, '#a6bccb'), (HB - 40, '#bacbd5')])
    cc = ('#e6eaec', '#c4ccd2', '#97a3ad')
    for (cx, cy, w, h, s) in ((60, 30, 80, 13, 61), (590, 22, 70, 12, 62), (250, 12, 50, 8, 63), (430, 40, 46, 8, 64)):
        B.cloud(im, cx, cy, w, h, s, cc)
    B.ridge(im, HB - 30, 18, ('#7c8c98', '#94a2ac', '#6e7e8a'), 71, step=4, period=(130, 53, 21))
    # 성채(성벽 뒤에서 윗부분만 보인다): 원래 240px — 성벽 앞면이 아랫부분을 가린다
    cit = EB.citadel()
    cx0 = 320 - cit.width // 2
    B.paste(im, cit.crop((0, 0, cit.width, 150)), cx0, 150 + 6)
    # 성벽 한 줄(4칸 조각 이어 붙임, 걸개 엇갈림)
    for i, x0 in enumerate(range(-24, 660, 64)):
        B.paste(im, EB.wall(4, seed=x0 + 40, banners=(1,) if i % 3 == 1 else ()), x0, HB - 4)
    # 바닥: 원 장소 compose — 칸 마스크(40x12): 0~1줄 둥근 돌 보도, 2~8줄 철판 대로, 9~ 회색 판석(앞 광장)
    Wc, Hc = 40, 12
    M = {k: np.zeros((Hc, Wc), bool) for k in ('plate', 'flag', 'cob', 'soot', 'dirt', 'lawn')}
    M['flag'][0:2, :] = True; M['plate'][2:9, :] = True; M['flag'][9:, :] = True
    g = np.array(EG.compose(Wc, Hc, M, seed=4).convert('RGB'))
    a = np.array(im); a[HB:, :, :3] = g[:360 - HB, :640]; im.paste(Image.fromarray(a, 'RGBA'))
    # 대로 연석(철판과 판석 사이 2px 턱) — 버들항 연석 규칙
    a = np.array(im)
    y_top, y_bot = HB + 32, HB + 9 * 16
    a[y_top, :, :3] = EBa.RAMP['gst'][5]; a[y_top + 1, :, :3] = EBa.RAMP['gst'][2]
    a[y_bot, :, :3] = EBa.RAMP['gst'][5]; a[y_bot + 1, :, :3] = EBa.RAMP['gst'][2]
    im.paste(Image.fromarray(a, 'RGBA'))
    # 뒷줄: 공장·굴뚝(왼쪽), 성문 탑(가운데), 주택·포탑(오른쪽)
    row = [(EB.factory(9, seed=1), -46), (EB.smokestack(seed=2), 96), (EB.gatehouse(), 264), (EB.turret(), 214), (EB.turret(flip=True), 378),
           (EB.house_tall(), 474), (EB.house_wide(), 520), (EB.house_tall(seed=3), 598)]
    for spr, x in row: B.cast_shadow(im, spr, x, HB, dx=-4, depth=6)
    for spr, x in row: B.paste(im, spr, x, HB)
    B.paste(im, EBa.smoke(20, 26, seed=1), 102, HB - 112 + 2)          # 굴뚝 머리 위 연기 한 줄기
    # 가장자리 소품(가운데 아래는 비운다)
    B.paste(im, EP.flagpole(seed=34), 82, 262); B.paste(im, EP.flagpole(seed=45), 574, 262)
    B.paste(im, EP.lamp_iron(seed=5), 40, 236); B.paste(im, EP.lamp_iron(seed=6), 592, 236)
    B.paste(im, EP.sandbags(3, seed=53), 2, 312); B.paste(im, EP.hedgehog(seed=1), 60, 330); B.paste(im, EP.barricade(seed=9), 20, 338)
    B.paste(im, EP.drums_fuel(seed=2), 600, 312); B.paste(im, EP.crates_stack(seed=3), 566, 338); B.paste(im, EP.ammo_boxes(seed=4), 604, 338)
    B.paste(im, EP.loudspeaker(seed=1), 2, 260); B.paste(im, EP.searchlight(seed=2, flip=True), 606, 280)
    return im

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'empire-city.png')
    B.finish(make()).save(out); print(out, B.check(out))
