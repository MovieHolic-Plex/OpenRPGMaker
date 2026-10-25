import sys
sys.path.insert(0,'src/harnesses/building-kit')
import massing as M
from PIL import Image
bid=sys.argv[1]; s=int(sys.argv[2]) if len(sys.argv)>2 else 6
rows,_=M.load(bid); im=M.image(rows)
bg=Image.new('RGBA',(im.width+8,im.height+8),(110,153,67,255)); bg.alpha_composite(im,(4,4))
bg.resize((bg.width*s,bg.height*s),Image.NEAREST).save(f'scripts/content/building-kit/massing/work/{bid}/peek.png')
