"""Native integer-pixel authoring. No external images, resampling or palette fitting."""
from PIL import Image, ImageDraw
from pathlib import Path
import hashlib

class Pixels:
    def __init__(self, size, palette):
        self.image=Image.new('RGBA',size,(0,0,0,0)); self.palette=palette
        self.draw=ImageDraw.Draw(self.image)
    def color(self,key):
        return tuple(bytes.fromhex(self.palette[key].lstrip('#')))+(255,)
    def dot(self,x,y,key):
        assert isinstance(x,int) and isinstance(y,int)
        assert 0<=x<self.image.width and 0<=y<self.image.height,(x,y)
        self.image.putpixel((x,y),self.color(key))
    def line(self,xy,key,width=1):self.draw.line(xy,fill=self.color(key),width=width)
    def rect(self,xy,key):self.draw.rectangle(xy,fill=self.color(key))
    def poly(self,xy,key):self.draw.polygon(xy,fill=self.color(key))
    def ellipse(self,xy,key):self.draw.ellipse(xy,fill=self.color(key))
    def stamp(self,x,y,rows):
        width=max(map(len,rows))
        assert all(len(row)==width for row in rows)
        for yy,row in enumerate(rows):
            for xx,c in enumerate(row):
                if c!='.':self.dot(x+xx,y+yy,c)
    def save(self,path):
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        self.image.save(path)

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
