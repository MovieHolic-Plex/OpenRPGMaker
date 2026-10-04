import sys, json, glob
from PIL import Image, ImageDraw
sys.path.insert(0,'.')
from lib import CAND
S=int(sys.argv[1]); slugs=sys.argv[3:]; out=sys.argv[2]
ims=[]
for s in slugs:
    old=[p for p in sorted(glob.glob(f'{CAND}/{s}/*-A.png')) if 'v34' not in p and '-x4' not in p][0]
    ims.append((s,Image.open(old).convert('RGBA'),Image.open(f'{CAND}/{s}/v34-A.png').convert('RGBA')))
pad=6
W=sum(2*im.width*S+3*pad for _,im,_ in ims); H=max(im.height for _,im,_ in ims)*S+20
C=Image.new('RGBA',(W,H),(58,66,58,255)); d=ImageDraw.Draw(C); x=0
for s,a,b in ims:
    d.text((x+2,2),s,fill=(255,255,255,255))
    for im in (a,b):
        C.paste(im.resize((im.width*S,im.height*S),Image.NEAREST),(x+pad,16),im.resize((im.width*S,im.height*S),Image.NEAREST)); x+=im.width*S+pad
    x+=pad
C.save(out)
