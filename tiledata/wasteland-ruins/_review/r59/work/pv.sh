#!/bin/bash
# usage: pv.sh <outdir>
cd /home/main/z-project/rpg-zzu-village-art/tiledata/wasteland-ruins/_review/r59 && python3 preview.py "$1" 2>&1 | tail -6 && python3 -c "
import numpy as np; from PIL import Image; from facts import facts
for k in 'abcde':
  a=np.array(Image.open('$1/slab-%s-4x.png'%k).convert('RGBA'))[::4,::4]
  print(k, facts(a))
"
