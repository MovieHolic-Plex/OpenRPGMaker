#!/bin/bash
cd $(dirname $0)
for X in A B C; do python3 wv5_gen.py $X && ./run.sh trees_scatter $X | head -2; done; ./view.sh A B C
python3 -c "
from PIL import Image
ims=[Image.open('/tmp/wv5/ts_%s.png'%x) for x in 'ABC']
o=Image.new('RGB',(ims[0].width,sum(i.height for i in ims)))
y=0
for i in ims: o.paste(i,(0,y)); y+=i.height
o.save('/tmp/wv5/ts_abc.png')"
