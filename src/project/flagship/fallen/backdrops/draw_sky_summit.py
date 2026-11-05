# 하늘탑 꼭대기 전투 배경(320x180 격자, 2배 저장) — 코드 손 도트. 2026-10-31 battle-backdrop 생성 경로가 이미지 서버 429 로 막혀 손으로 그렸다.
# 다시 그리기: 이 폴더에서 python3 draw_sky_summit.py → stored.png·sky-summit.json 을 다시 쓴다.
from PIL import Image
import random
random.seed(7)
W,H=320,180
im=Image.new('RGB',(W,H))
px=im.load()
def hx(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))
sky=[hx(c) for c in ['#0c0d1a','#0f101e','#1a1538','#1d2d58','#27395b']]
# sky bands with 2px checker dither at boundaries
bands=[0,14,28,42,54]
for y in range(0,76):
  bi=max(i for i,b in enumerate(bands) if y>=b)
  for x in range(W):
    c=sky[bi]
    if bi+1<len(bands) and y>=bands[bi+1]-3 and (x+y)%2==0: c=sky[bi+1]
    px[x,y]=c
# stars
for _ in range(70):
  x,y=random.randrange(W),random.randrange(0,58)
  px[x,y]=hx(random.choice(['#c8d0e8','#8a96c0','#e8e4d0']))
for (x,y) in [(30,10),(250,18),(205,6),(90,30),(290,40)]:
  for dx,dy in [(0,0),(1,0),(-1,0),(0,1),(0,-1)]: px[x+dx,y+dy]=hx('#e8ecf8') if (dx,dy)==(0,0) else hx('#8a96c0')
# distant snowy peaks far below, seen between merlons (night-tinted)
ridge=[]
import math
for x in range(W):
  h=58-10*abs(math.sin(x/37.0))-6*abs(math.sin(x/13.0+1.3))+random.choice([0,0,1])
  ridge.append(int(h))
for x in range(W):
  for y in range(ridge[x],76):
    c=hx('#8a96c0') if y<ridge[x]+2 else hx('#4a5a88') if y<ridge[x]+4 and (x+y)%2==0 else hx('#27395b')
    if y>=66: c=hx('#1d2d58') if (x+y)%2 else hx('#27395b')
    px[x,y]=c
# back wall with crenellations
stone=[hx(c) for c in ['#3d4147','#454a52','#4f5560','#2c3038','#24282f']]
wall_top=60
merlon_w,gap_w=22,14
for x in range(W):
  m=(x+6)%(merlon_w+gap_w)<merlon_w
  top=58 if m else 68
  for y in range(top,100):
    # bricks 16x8, offset rows
    row=(y-58)//8; off=(row%2)*8
    bx=(x+off)%16; by=(y-58)%8
    c=stone[0] if (row+((x+off)//16))%3 else stone[1]
    if by==0 or bx==0: c=stone[3]
    elif by==1: c=stone[2]
    px[x,y]=c
  # merlon caps highlight
  if m: px[x,58]=stone[2]
  # shadow at wall base
for x in range(W):
  for y in range(94,100): 
    if (x+y)%2==0 or y>=97: px[x,y]=stone[4]
# lens of the tower at centre: golden glowing cylinder
cx=160
gold=[hx(c) for c in ['#f0c040','#c89020','#8a5a18','#fff0a0']]
for y in range(30,96):
  for x in range(cx-16,cx+17):
    d=abs(x-cx)
    if y<36:
      if d<=12-(36-y): px[x,y]=hx('#b83028') if d<10-(36-y) else hx('#7a1c1c')
      continue
    if d<=14:
      c=gold[0] if d<6 else gold[1] if d<11 else gold[2]
      if (y-36)%10==0 or (d in (5,10) ): c=gold[2]
      if d<3 and 44<y<70: c=gold[3]
      px[x,y]=c
# plinth
for y in range(92,100):
  for x in range(cx-22,cx+23): px[x,y]=hx('#6a707a') if y<94 else hx('#4f5560')
# glow halo dither around lens
for y in range(24,100):
  for x in range(cx-34,cx+35):
    d=((x-cx)**2*0.6+(y-62)**2)**0.5
    p=px[x,y]
    if d<34 and p in (stone[0],stone[1]) and (d<22 or (x+y)%2==0): px[x,y]=hx('#5a5048')
    elif d<34 and p==stone[2] and d<26: px[x,y]=hx('#7a6a50')
# floor flagstones
floor=[hx(c) for c in ['#4f5560','#494e57','#31353b','#5a5f68']]
for y in range(100,H):
  rowh=10 if y<130 else 12
  r=(y-100)//rowh if y<130 else 3+(y-130)//12
  y0=100+r*10 if r<3 else 130+(r-3)*12
  off=(r%2)*12
  for x in range(W):
    bx=(x+off)%24
    c=floor[0] if (r+(x+off)//24)%4 else floor[1]
    if y==y0 or bx==0: c=floor[2]
    elif y==y0+1: c=floor[3]
    px[x,y]=c
# warm lens light pool on floor
for y in range(100,140):
  for x in range(cx-60,cx+61):
    d=((x-cx)**2/3600+((y-100)**2)/1600)
    if d<1 and px[x,y] in (floor[0],floor[1]) and (d<0.45 or (x+y)%2==0): px[x,y]=hx('#625a4c')
for y in range(150,H):
  for x in range(W):
    if (x+y)%2==0 and (y>165 or x<20 or x>W-21) and px[x,y] in (floor[0],floor[1]): px[x,y]=floor[2] if y>172 else hx('#3d4147')
im.save('./native.png')
im.resize((640,360),Image.NEAREST).save('./stored.png')

import base64, json, hashlib, os
_b = open('./stored.png', 'rb').read()
json.dump({"resource": {"id": "battle_backdrop_fs2_sky_summit", "name": "전투 배경 · 하늘탑 꼭대기(밤)", "kind": "backdrop",
           "dataUrl": "data:image/png;base64," + base64.b64encode(_b).decode()},
           "pixelSha256": hashlib.sha256(im.tobytes()).hexdigest()}, open('./sky-summit.json', 'w'), ensure_ascii=False)
os.remove('./native.png')
