import sys
from PIL import Image
H='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/'
# usage: out.png bg slug ... ; 행=slug, 열=A B C. 투명은 bg 색 위에 x6 로 확대
out=sys.argv[1]; bg=tuple(int(v) for v in sys.argv[2].split(',')); slugs=sys.argv[3:]
rows=[]
for s in slugs:
    r=[]
    for X in 'ABC':
        im=Image.open(f'{H}{s}/hf5-{X}.png').convert('RGBA')
        b=Image.new('RGBA',im.size,bg+(255,)); b.alpha_composite(im)
        r.append(b.resize((im.width*6,im.height*6),Image.NEAREST))
    rows.append(r)
W=sum(i.width+8 for i in rows[0]); Ht=sum(r[0].height+8 for r in rows)
sh=Image.new('RGB',(max(sum(i.width+8 for i in r) for r in rows),Ht),(80,0,80)); y=0
for r in rows:
    x=0
    for i in r: sh.paste(i,(x,y)); x+=i.width+8
    y+=r[0].height+8
sh.save(out); print(sh.size)
