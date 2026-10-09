import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); bg = Image.new('RGBA', im.size, (70,70,78,255)); bg.alpha_composite(im)
bg.resize((im.width*int(sys.argv[3]) if len(sys.argv)>3 else im.width*8, im.height*(int(sys.argv[3]) if len(sys.argv)>3 else 8)), Image.NEAREST).save(sys.argv[2])
