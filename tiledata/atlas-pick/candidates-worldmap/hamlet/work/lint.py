import sys,os,numpy as np
from PIL import Image
sys.path.insert(0,'scripts/content/pixel-harness')
import pxlint
a=np.array(Image.open(sys.argv[1]).convert('RGBA'))
r=pxlint.lint_array(a,16,None,'object',pxlint.load_stats(),keep_defects=True)
print(r['pass'],r.get('failed'))
for k,v in r.items():
    if k not in ('pass','failed'): print(k, str(v)[:400])
