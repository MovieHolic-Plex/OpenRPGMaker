"""The triangular front wall under the stone roof, separate from roof tiles."""
from PIL import Image, ImageDraw

def gable_mask(original):
 mask=Image.new('L',original.size)
 ImageDraw.Draw(mask).polygon([(31,39),(59,61),(4,61)],fill=255)
 # Include the native stair-step plaster edge, which isn't an exact mathematical triangle.
 for y in range(38,63):
  for x in range(original.width):
   r,g,b,a=original.getpixel((x,y))
   if a and r>140 and g>120 and 0<=r-g<35 and 0<=g-b<40:mask.putpixel((x,y),255)
 return mask

def refine_stone_gable(im,original):
 mask=gable_mask(original)
 # Native facade masonry, with a continuous phase across the whole gable.
 # Cover the old plaster flecks, timber centre post and off-centre window together.
 masonry=im.crop((0,68,16,80))
 for y in range(38,63):
  for x in range(im.width):
   if not mask.getpixel((x,y)):continue
   color=masonry.getpixel((x%16,(y-68)%12))
   # Keep the facade's stone colours/joints, but reduce the fleck contrast on this small wall.
   color=tuple(round(v*.60+base*.40) for v,base in zip(color[:3],(173,155,137)))+(color[3],)
   if not mask.getpixel((x,max(0,y-1))):
    color=tuple(round(v*.82) for v in color[:3])+(color[3],)
   im.putpixel((x,y),color)
 # A single round aperture centred on the roof ridge. No beam crosses the glass.
 d=ImageDraw.Draw(im)
 d.ellipse((26,48,36,58),fill='#bba68e')
 d.ellipse((27,49,35,57),fill='#504842')
 d.ellipse((28,50,34,56),fill='#567b7b')
 d.arc((28,50,34,56),270,90,fill='#37545b')
 d.line((29,51,30,51),fill='#9eb3a6')
 return mask
