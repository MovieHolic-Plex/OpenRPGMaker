import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dc_inner import *
ims=[SAMPLES['dc_cellar'],SAMPLES['dc_plate'],SAMPLES['dc_court'],face_sample(),ceiling_sample(),outer_face_sample(),sand_spill_sheet(),brass_rail_sheet()]
# tile check: 3x3 of each sample
W=1400
o=Image.new('RGBA',(W,200),(40,40,48,255)); x=0
for i,im in enumerate(ims):
    if i<3:
        t=Image.new('RGBA',(96,96))
        for a in (0,48):
            for b in (0,48): t.alpha_composite(im,(a,b))
        im=t
    if i>=6:
        bg=Image.new('RGBA',(64,64))
        for a in range(0,64,48):
            for b in range(0,64,48): bg.alpha_composite(SAMPLES['dc_cellar'],(a,b))
        bg.alpha_composite(im); im=bg
    o.alpha_composite(im.resize((im.width*2,im.height*2),Image.NEAREST),(x,0)); x+=im.width*2+10
o.save('_qa/i1.png')
