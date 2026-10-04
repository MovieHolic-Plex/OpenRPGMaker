#!/bin/bash
cd $(dirname $0)
for X in A B C; do python3 wv5_gen.py $X && ./run.sh big_tree $X | head -3; done
python3 - <<'PY'
from PIL import Image
ims=[]
for x in 'ABC':
    im=Image.open('../wv5-%s.png'%x).convert('RGBA'); bg=Image.new('RGBA',im.size,(70,150,60,255)); bg.alpha_composite(im); ims.append(bg.resize((im.width*10,im.height*10),Image.NEAREST))
o=Image.new('RGB',(sum(i.width for i in ims),ims[0].height))
x=0
for i in ims: o.paste(i,(x,0)); x+=i.width
o.save('/tmp/wv5/bt_abc.png')
PY
