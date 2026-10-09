#!/usr/bin/env python3
"""EasyRPG RTP 학습용 확대 크롭 — 8×(또는 6×) 확대·칸 눈금·색인 라벨. 학습·비교 전용, 게임 소재로 쓰지 않는다.
출처: EasyRPG RTP (CC BY 4.0, vendor/easyrpg-rtp/AUTHORS.md) · Exterior.png 는 JasonPerry CC0.
실행: python3 make_crops.py  → 이 폴더에 *.png"""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT='/home/main/.herdr/worktrees/rpg-zzu/worktree-brave-stone-6ff0/public/assets/'
EX=ROOT+'easyrpg/chipset/Exterior.png'
CT=ROOT+'easyrpg-chipset-combined-town-transparent.png'
AC=ROOT+'easyrpg/charset/Actor1.png'
HERE=Path(__file__).parent
def crop(name,src,c0,r0,nc,nr,s,tw=16,th=16,bg=(255,0,255)):
    im=Image.open(src).convert('RGBA'); b=Image.new('RGBA',im.size,bg+(255,)); b.alpha_composite(im)
    c=b.crop((c0*tw,r0*th,(c0+nc)*tw,(r0+nr)*th)).resize((nc*tw*s,nr*th*s),Image.NEAREST)
    m=14; o=Image.new('RGB',(c.width+m,c.height+m),(30,30,30)); o.paste(c.convert('RGB'),(m,m)); d=ImageDraw.Draw(o)
    for i in range(nc+1):
        d.line([(m+i*tw*s,m),(m+i*tw*s,o.height)],fill=(255,255,0))
        if i<nc: d.text((m+i*tw*s+2,1),str(c0+i),fill=(255,255,255))
    for j in range(nr+1):
        d.line([(m,m+j*th*s),(o.width,m+j*th*s)],fill=(255,255,0))
        if j<nr: d.text((1,m+j*th*s+2),str(r0+j),fill=(255,255,255))
    o.save(HERE/name)
crop('01_roof-wall_ex_8x.png',EX,14,10,4,4,8)          # 크림 벽돌·회색 벽돌·빨강 기와 2줄 (기와 32px = 4주기)
crop('02_roof-wall_ct_8x.png',CT,14,10,4,4,8)          # RTP 판 같은 자리 (주황 기와)
crop('03_door-window_ct_8x.png',CT,24,2,6,4,8)         # 문 1×2, 창, 벽걸이
crop('04_ridge_upper_ct_8x.png',CT,24,10,5,3,8)        # 용마루 2×2 (상층 열 18~29 영역)
crop('05_ground-blobs_ex_8x.png',EX,0,13,6,3,8)        # 흙·모래 덩이(오토타일 견본) 3×3
crop('06_plaza_ex_8x.png',EX,9,5,3,3,8)                # 자갈 광장 3×3
crop('07_timber-house_ex_6x.png',EX,18,0,4,8,4)        # 통나무 벽·창·문틀
crop('08_props_ex_6x.png',EX,18,8,8,6,5)               # 나무·덤불·횃불·통·표지
crop('09_charset_8x.png',AC,0,0,3,1,8,tw=24,th=32)     # 캐릭터 24×32 3프레임
# 상·하층 지도(ct): 열 6~17 하층(초록 테두리) / 18~29 상층(파랑 테두리) / 0~5 자동타일
im=Image.open(CT).convert('RGBA'); b=Image.new('RGBA',im.size,(255,0,255,255)); b.alpha_composite(im)
b=b.resize((im.width*2,im.height*2),Image.NEAREST).convert('RGB'); d=ImageDraw.Draw(b)
for x0,x1,col in [(0,6,(255,200,0)),(6,18,(60,255,60)),(18,30,(60,140,255))]:
    d.rectangle([x0*32,0,x1*32-1,im.height*2-1],outline=col,width=3)
b.save(HERE/'10_layer-map_ct_2x.png')
print('ok')
