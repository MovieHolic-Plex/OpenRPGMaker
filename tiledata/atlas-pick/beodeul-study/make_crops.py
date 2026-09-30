#!/usr/bin/env python3
"""버들항(beodeul_city) 학습용 확대 크롭 — 학습·비교 전용 사본이며 게임 소재가 아니다.
원본: 브랜치 agent/beodeul-r4 의 tiledata/beodeul-city/ (git archive 로 /tmp/bd 에 푼 것). 손으로 찍은 자산이다.
캐릭터 프레임은 EasyRPG RTP Actor1(CC BY 4.0) — 크기 비교용.
실행: python3 make_crops.py [BD_DIR]"""
import sys, json
from pathlib import Path
from PIL import Image, ImageDraw
BD=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/bd/tiledata/beodeul-city')
AC='/home/main/.herdr/worktrees/rpg-zzu/worktree-brave-stone-6ff0/public/assets/easyrpg/charset/Actor1.png'
HERE=Path(__file__).parent
C6=Image.open(BD/'render/city6.png').convert('RGBA')
def grid(im,s,step=16,col=(255,255,0,90)):
    d=ImageDraw.Draw(im)
    for x in range(0,im.width,step*s): d.line([(x,0),(x,im.height)],fill=col)
    for y in range(0,im.height,step*s): d.line([(0,y),(im.width,y)],fill=col)
def crop(name,box,s,g=True):
    c=C6.crop(box).resize(((box[2]-box[0])*s,(box[3]-box[1])*s),Image.NEAREST).convert('RGBA')
    if g: grid(c,s)
    c.convert('RGB').save(HERE/name); return c
# 1. 작은 집(48x84) + 캐릭터 프레임 24x32 나란히 (크기 비교)
h=C6.crop((944-8,236-8,944+48+8,236+84+8)); s=6
a=h.resize((h.width*s,h.height*s),Image.NEAREST)
ch=Image.open(AC).convert('RGBA').crop((0,0,24,32)).resize((24*s,32*s),Image.NEAREST)
o=Image.new('RGBA',(a.width+ch.width+40,a.height),(255,0,255,255)); o.alpha_composite(a,(0,0)); o.alpha_composite(ch,(a.width+40,a.height-ch.height-8*s))
grid(o,s,col=(255,255,0,70)); o.convert('RGB').save(HERE/'01_small-house_with-hero_6x.png')
# 2. 가게집 96x92 (카페)
crop('02_shop-house_cafe_5x.png',(1104-16,548-8,1104+96+16,548+92+24),5)
# 3. 창고집 128x124
crop('03_wide-house_4x.png',(1488-16,756-8,1488+96+16,756+92+24),5)
# 4. 킷 lo/up + 걷기격자
def kit(n,s=4):
    j=json.load(open(BD/f'kits7/{n}.json')); w,hh=j['w'],j['h']
    out=Image.new('RGBA',(w*16*s*2+20,hh*16*s),(255,0,255,255))
    for k,sf in enumerate(['lo','up']):
        p=BD/f'kits7/{n}.{sf}.png'
        if p.exists():
            im=Image.open(p).convert('RGBA').resize((w*16*s,hh*16*s),Image.NEAREST); out.alpha_composite(im,(k*(w*16*s+20),0))
    d=ImageDraw.Draw(out)
    for y,row in enumerate(j['walk']):
        for x,ch in enumerate(row):
            if ch=='.': continue
            col={'C':(60,140,255,255),'X':(255,60,60,255),'F':(60,255,60,255),'S':(255,60,60,255)}[ch]
            for k in range(2):
                x0=k*(w*16*s+20)+x*16*s; y0=y*16*s
                d.text((x0+3,y0+3),ch,fill=col)
                d.rectangle([x0,y0,x0+16*s-1,y0+16*s-1],outline=col[:3]+(110,))
    out.convert('RGB').save(HERE/f'04_kit_{n}_lo-up_4x.png'); return j
kit('bd-manor-small')
# 5. 조각 킷 up 만
parts=['bd-mpart-roof-l','bd-mpart-roof-m','bd-mpart-roof-r','bd-mpart-door-bay','bd-mpart-bay-win-a-l','bd-mpart-bay-win-a-r','bd-mpart-chimney','bd-mpart-lamp-post']
ims=[]
for n in parts:
    p=BD/f'kits7/{n}.up.png'
    if p.exists(): ims.append((n,Image.open(p).convert('RGBA')))
s=5; W=sum(i.width*s+16 for _,i in ims); H=max(i.height*s for _,i in ims)
o=Image.new('RGBA',(W,H+14),(255,0,255,255)); x=0; d=ImageDraw.Draw(o)
for n,i in ims:
    o.alpha_composite(i.resize((i.width*s,i.height*s),Image.NEAREST),(x,14)); d.text((x,1),n.replace('bd-mpart-',''),fill=(255,255,255,255)); x+=i.width*s+16
grid(o,s,col=(255,255,0,50)); o.convert('RGB').save(HERE/'05_mparts_up_5x.png')
# 6. 대로 + 가로등 + 가로수 (연석·포석 오토타일)
crop('06_avenue-lamp-tree_5x.png',(1200-80,512-40,1200+120,512+130),4)
crop('07_street-autotile_4x.png',(320-64,480-16,320+128,480+112),5)
print('ok')
