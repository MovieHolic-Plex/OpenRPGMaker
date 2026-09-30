#!/bin/bash
cd $(dirname $0)/..; for X in "$@"; do python3 - <<PY
from PIL import Image
im=Image.open('wv5-$X.png').convert('RGBA'); bg=Image.new('RGBA',im.size,(70,150,60,255)); bg.alpha_composite(im); bg.resize((im.width*12,im.height*12),Image.NEAREST).save('/tmp/wv5/ts_$X.png')
PY
done
