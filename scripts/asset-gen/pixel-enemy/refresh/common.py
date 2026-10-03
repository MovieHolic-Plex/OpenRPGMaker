"""Native-grid drawing/output helpers for the hand pixel monster refresh.

Only review images are resized. Source cells are drawn at their final resolution.
"""
import sys, json, hashlib, math
from pathlib import Path
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
BG = '#202c39'

class Canvas:
    def __init__(self, cell, palette):
        self.cell = cell
        self.palette = {k: ('#'+v if len(v)==6 else v) for k,v in palette.items()}
        self.im = Image.new('RGBA',(cell,cell))
        self.d = ImageDraw.Draw(self.im)
    def color(self, key): return self.palette.get(key,key)
    def poly(self, pts, color, outline=None):
        self.d.polygon([(round(x),round(y)) for x,y in pts],fill=self.color(color),outline=self.color(outline) if outline else None)
    def line(self, pts, color, width=1):
        self.d.line([(round(x),round(y)) for x,y in pts],fill=self.color(color),width=width)
    def box(self, rect, color, outline=None):
        self.d.rectangle(tuple(round(n) for n in rect),fill=self.color(color),outline=self.color(outline) if outline else None)
    def oval(self, rect, color, outline=None):
        self.d.ellipse(tuple(round(n) for n in rect),fill=self.color(color),outline=self.color(outline) if outline else None)
    def pixel(self,x,y,color): self.d.point((round(x),round(y)),fill=self.color(color))

def entries(group=None):
    values=json.loads((HERE/'manifest.json').read_text())
    return [v for v in values if group is None or v['group']==group]

def review_board(frames,cell,scale=3):
    pitch=cell*scale; im=Image.new('RGB',(pitch*3,(pitch+18)*3),BG)
    d=ImageDraw.Draw(im)
    for i,f in enumerate(frames):
        native=Image.new('RGBA',(cell,cell),BG); native.alpha_composite(f)
        x=i%3*pitch; y=i//3*(pitch+18)
        im.paste(native.convert('RGB').resize((pitch,pitch),Image.Resampling.NEAREST),(x,y))
        d.text((x+5,y+pitch+3),POSES[i],fill='#dce4dc')
    return im

def export_frames(entry,frames):
    cell=entry['cell']; slug=entry['slug']
    assert len(frames)==9
    assert all(f.mode=='RGBA' and f.size==(cell,cell) for f in frames),(slug,'cell')
    sheet=Image.new('RGBA',(cell*3,cell*3))
    hashes=[]; boxes=[]
    for i,f in enumerate(frames):
        box=f.getbbox(); assert box and box[0]>0 and box[1]>0 and box[2]<cell and box[3]<=cell-3,(slug,POSES[i],box)
        hashes.append(hashlib.sha256(f.tobytes()).hexdigest()); boxes.append(list(box))
        sheet.alpha_composite(f,(i%3*cell,i//3*cell))
    assert len(set(hashes))==9,(slug,'duplicate pose')
    colors=set(c for count,c in sheet.getcolors(cell*cell*9) if c[3])
    alpha=sorted(set(sheet.getchannel('A').tobytes()))
    assert len(colors)<=32 and alpha==[0,255],(slug,'palette',len(colors),alpha)
    target=ROOT/'public'/entry['path']; target.parent.mkdir(parents=True,exist_ok=True); sheet.save(target)
    with Image.open(target) as reload: assert reload.convert('RGBA').tobytes()==sheet.tobytes()
    portrait=ROOT/'public/assets/generated/pixel-enemy-portraits'/target.name
    portrait.parent.mkdir(parents=True,exist_ok=True); frames[0].save(portrait)
    with Image.open(portrait) as reload: assert reload.convert('RGBA').tobytes()==frames[0].tobytes()
    source=ROOT/'tiledata/monster-refresh'/slug; source.mkdir(parents=True,exist_ok=True)
    for name,f in zip(POSES,frames): f.save(source/(name+'.png'))
    qa=ROOT/'verify-shots/monster-refresh'/entry['group']; qa.mkdir(parents=True,exist_ok=True)
    review_board(frames,cell,2).save(qa/(slug+'-poses.png'))
    timeline=[0,1,2,1,3,4,5,6,0,7,8]
    cycle=[]
    for i in timeline:
        bg=Image.new('RGBA',(cell,cell),BG); bg.alpha_composite(frames[i])
        out=bg.convert('RGB').resize((cell*4,cell*4),Image.Resampling.NEAREST)
        cycle.append(out)
    cycle[0].save(qa/(slug+'-cycle.gif'),save_all=True,append_images=cycle[1:],duration=[180]*4+[300,200,380,260,180,420,1000],loop=0,disposal=2,optimize=False)
    return dict(slug=slug,group=entry['group'],cell=cell,colors=len(colors),alpha=alpha,beforeSha256=entry['beforeSha256'],sha256=hashlib.sha256(target.read_bytes()).hexdigest(),frames={p:dict(bbox=b,sha256=h) for p,b,h in zip(POSES,boxes,hashes)})

def run_group(group,draw):
    reports=[]; cards=[]
    for entry in entries(group):
        frames=[draw(entry['slug'],pose,entry['cell']) for pose in POSES]
        reports.append(export_frames(entry,frames)); cards.append((entry,frames[0]))
        print(entry['slug'],reports[-1]['colors'],flush=True)
    qa=ROOT/'verify-shots/monster-refresh'/group; qa.mkdir(parents=True,exist_ok=True)
    for page in range(0,len(cards),16):
        batch=cards[page:page+16]; im=Image.new('RGB',(4*208,math.ceil(len(batch)/4)*220),BG); d=ImageDraw.Draw(im)
        for j,(entry,f) in enumerate(batch):
            cell=entry['cell']; native=Image.new('RGBA',(cell,cell),BG); native.alpha_composite(f)
            x=j%4*208+(208-cell*2)//2; y=j//4*220+192-cell*2
            im.paste(native.convert('RGB').resize((cell*2,cell*2),Image.Resampling.NEAREST),(x,y))
            d.text((j%4*208+6,j//4*220+200),entry['slug'],fill='#dce4dc')
        im.save(qa/('contact-'+str(page//16+1)+'.png'))
    (qa/'report.json').write_text(json.dumps(reports,indent=2)+'\n')
    return reports
