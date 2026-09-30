import random,sys
from PIL import Image
random.seed(3)
pan=[]
for x in 'ABC':
    im=Image.open(f'../w2-{x}.png').convert('RGB')
    m=Image.new('RGB',(16*6,16*5))
    for j in range(5):
        for i in range(6):
            k=random.choice([0,0,1,2])
            m.paste(im.crop((16*k,0,16*k+16,16)),(i*16,j*16))
    pan.append(m.resize((96*5,80*5),Image.NEAREST))
c=Image.new('RGB',(480*3+16,400),(30,30,30))
for i,p in enumerate(pan): c.paste(p,(i*488,0))
c.save('preview.png')
