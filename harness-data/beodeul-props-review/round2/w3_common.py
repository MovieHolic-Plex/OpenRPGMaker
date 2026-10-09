from PIL import Image
import os
R1='round1/'; R2='round2/'
GRASS=(86,160,52,255)
def load(p): return Image.open(p).convert('RGBA')
def compare(orig,res,out,s=4):
    h=max(orig.height,res.height); w=orig.width+res.width+4
    bg=Image.new('RGBA',(w,h),GRASS)
    bg.alpha_composite(orig,(0,h-orig.height)); bg.alpha_composite(res,(orig.width+4,h-res.height))
    bg=bg.resize((w*s,h*s),Image.NEAREST); bg.save(out)
def sheet(ims,out,s=8):
    w=sum(i.width+2 for i in ims); h=max(i.height for i in ims)
    bg=Image.new('RGBA',(w,h),GRASS); x=0
    for i in ims: bg.alpha_composite(i,(x,h-i.height)); x+=i.width+2
    bg.resize((w*s,h*s),Image.NEAREST).save(out)
def dump(im):
    pal={}
    for y in range(im.height):
        row=''
        for x in range(im.width):
            p=im.getpixel((x,y))
            if p[3]==0: row+='.'; continue
            if p not in pal: pal[p]=chr(ord('a')+len(pal)) if len(pal)<26 else chr(ord('A')+len(pal)-26)
            row+=pal[p]
        print('%2d %s'%(y,row))
    for p,c in pal.items(): print(c,p)
