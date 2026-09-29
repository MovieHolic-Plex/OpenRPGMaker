
# b1 파티 시트 8장 확인판: 대기 a·windup·attack·hit·dead, 4배, 가로 1900 이하로 쪼갬 + 무대 합성판(아군 오른쪽 줄)
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path('.'); OUT=ROOT/'.omo/r2w5/b1'
BG=(0x20,0x28,0x40,255)
chips=[f'animal-{i}' for i in range(8)]
cols=['idle_a','windup','attack','hit','dead']; idx={'idle_a':0,'windup':3,'attack':5,'hit':7,'dead':8}
errs=[]
rows=[]
for ch in chips:
    sh=Image.open(ROOT/f'public/assets/generated/party-pixel/{ch}.png').convert('RGBA'); c=sh.width//3
    assert sh.size==(c*3,c*3) and c in (48,64)
    al=set(sh.getchannel('A').tobytes()); nc=len({p for p in sh.getdata() if p[3]})
    cells=[sh.crop((i%3*c,i//3*c,i%3*c+c,i//3*c+c)) for i in range(9)]
    if al-{0,255}: errs.append((ch,'alpha'))
    if nc>16: errs.append((ch,'colors',nc))
    if any(not x.getbbox() for x in cells): errs.append((ch,'empty'))
    for i in range(8):
        if cells[i].tobytes()==cells[i+1].tobytes(): errs.append((ch,'same',i))
    s=4 if c==48 else 3
    row=Image.new('RGBA',(len(cols)*(64*4+6),64*4+6),(12,14,24,255))
    for j,n in enumerate(cols):
        bg=Image.new('RGBA',(c,c),BG); bg.alpha_composite(cells[idx[n]])
        im=bg.resize((c*s,c*s),Image.NEAREST); row.paste(im,(j*(64*4+6)+3,3))
    rows.append(row); print(ch,c,'colors',nc)
print('errors',errs or 'none')
for part in range(0,8,4):
    sub=rows[part:part+4]; img=Image.new('RGBA',(sub[0].width,sum(r.height for r in sub)),(0,0,0,255))
    y=0
    for r in sub: img.paste(r,(0,y)); y+=r.height
    img.save(OUT/f'party-board-{part//4}.png'); print(img.size)
# 무대: 적(슬라임·늑대) 왼쪽, 동물 넷씩 오른쪽 2배
W,H=640,360
for part in range(2):
    st=Image.new('RGBA',(W,H),BG); st.alpha_composite(Image.new('RGBA',(W,80),(0x2a,0x34,0x52,255)),(0,280))
    for k,(en,y) in enumerate((('slime',230),('wolf-grey',300))):
        e=Image.open(ROOT/f'public/assets/generated/pixel-enemies/{en}.png').convert('RGBA').crop((0,0,48,48)).resize((96,96),Image.NEAREST)
        st.alpha_composite(e,(80+k*30,y-88))
    for k,ch in enumerate(chips[part*4:part*4+4]):
        sh=Image.open(ROOT/f'public/assets/generated/party-pixel/{ch}.png').convert('RGBA'); c=sh.width//3
        pose=[0,5,3,7][k]
        cell=sh.crop((pose%3*c,pose//3*c,pose%3*c+c,pose//3*c+c)).resize((c*2,c*2),Image.NEAREST)
        fx,fy=420+(k%2)*110,200+k*42
        st.alpha_composite(cell,(fx-c,fy-(c-4)*2))
    st.save(OUT/f'party-stage-{part}.png')

