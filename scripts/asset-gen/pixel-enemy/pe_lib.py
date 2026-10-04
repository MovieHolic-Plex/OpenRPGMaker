"""Shared final-grid drawing and lossless review output for original monster art.
No sprite source is read except actor1-0, used ONLY on the QA comparison board.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[3]
NAMES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
BG = '#202840'

class Pen:
    def __init__(self, cell, colors):
        self.im = Image.new('RGBA',(cell,cell))
        self.d = ImageDraw.Draw(self.im)
        self.pal = {k:tuple(bytes.fromhex(v.lstrip('#')))+(255,) for k,v in colors.items()}
    def poly(self, points, color, edge=None):
        self.d.polygon(points, fill=self.pal[color], outline=self.pal[edge] if edge else None)
    def line(self, points, color, width=1):
        self.d.line(points, fill=self.pal[color], width=width)
    def box(self, rect, color): self.d.rectangle(rect, fill=self.pal[color])
    def grid(self, x, y, rows):
        for j,row in enumerate(rows):
            for i,c in enumerate(row):
                if c != '.': self.im.putpixel((x+i,y+j), self.pal[c])
    def stone(self, x, y, w, h, base='b', light='l'):
        self.poly([(x+2,y),(x+w-3,y),(x+w-1,y+2),(x+w-1,y+h-3),(x+w-3,y+h-1),(x+1,y+h-1),(x,y+h-3),(x,y+2)],base,'o')
        self.poly([(x+2,y+1),(x+w-4,y+1),(x+w-3,y+3),(x+3,y+4),(x+1,y+h-4),(x+1,y+3)],light)
        self.line([(x+w-2,y+4),(x+w-2,y+h-3),(x+w-4,y+h-2),(x+3,y+h-2)],'s')

def build(name, cell, colors, draw):
    frames = [draw(n).im for n in NAMES]
    sheet = Image.new('RGBA',(cell*3,cell*3))
    for i,im in enumerate(frames): sheet.paste(im,(i%3*cell,i//3*cell))
    out = ROOT/f'public/assets/generated/pixel-enemies/{name}.png'
    qa = ROOT/f'.omo/pixel-enemy-{name}'
    out.parent.mkdir(parents=True,exist_ok=True); qa.mkdir(parents=True,exist_ok=True)
    palette = {c for _,c in sheet.getcolors(cell*cell*9) if c[3]}
    assert len(palette)<=16 and set(sheet.getchannel('A').tobytes())=={0,255}
    report = {'name':name,'cell':cell,'colors':len(palette),'alpha':[0,255],'baseline':cell-4,'frames':{}}
    for n,im in zip(NAMES,frames):
        box=im.getbbox(); assert box and box[0]>0 and box[1]>0 and box[2]<cell and box[3]<=cell-3,(n,box)
        report['frames'][n]={'bbox':list(box),'size':[box[2]-box[0],box[3]-box[1]]}
    sheet.save(out)
    with Image.open(out) as saved: assert saved.tobytes()==sheet.tobytes()
    board = Image.new('RGBA',sheet.size,BG); board.alpha_composite(sheet)
    board=board.convert('RGB').resize((cell*12,cell*12),Image.Resampling.NEAREST)
    d=ImageDraw.Draw(board)
    for p in range(0,cell*12,cell*4):
        d.line((p,0,p,cell*12-1),fill='#586078'); d.line((0,p,cell*12-1,p),fill='#586078')
    for i,n in enumerate(NAMES):
        x,y=i%3*cell*4,i//3*cell*4
        d.text((x+8,y+8),n,fill='#d6cddc')
        d.line((x+4,y+(cell-3)*4,x+cell*4-5,y+(cell-3)*4),fill='#39465e')
    board.save(qa/'preview.png')
    # Preserve exact palette in GIF and verify decoded frames, no dithering.
    seq=[0,1,2,1,0,1,2,1,3,4,5,6,0,7,0,8]
    durations=[180]*8+[300,240,300,240,400,300,400,1100]
    gif=[]
    for i in seq:
        im=Image.new('RGBA',(cell,cell),BG); im.alpha_composite(frames[i])
        gif.append(im.convert('RGB').resize((cell*4,cell*4),Image.Resampling.NEAREST))
    gif[0].save(qa/'cycle.gif',save_all=True,append_images=gif[1:],duration=durations,loop=0,disposal=2,optimize=False)
    with Image.open(qa/'cycle.gif') as saved:
        decoded=[]
        for i in range(saved.n_frames):
            saved.seek(i)
            decoded.extend([saved.convert('RGB').tobytes()]*(saved.info['duration']//10))
        expected=[]
        for im,ms in zip(gif,durations): expected.extend([im.tobytes()]*(ms//10))
        assert decoded==expected
        strip=Image.new('RGB',(cell*4*4,cell*4),BG)
        for col,i in enumerate([8,9,10,11]): strip.paste(gif[i],(col*cell*4,0))
        strip.save(qa/'gif-keyframes.png')
    actor=Image.open(ROOT/'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0,0,48,48))
    scale=Image.new('RGBA',(48+cell,cell+8),BG)
    scale.alpha_composite(actor,(0,cell-48+8))
    scale.alpha_composite(frames[0],(48,8))
    scale=scale.convert('RGB').resize(((48+cell)*4,(cell+8)*4),Image.Resampling.NEAREST)
    d=ImageDraw.Draw(scale); d.text((8,8),'actor1-0 / 4x',fill='#d6cddc'); d.text((200,8),f'{name} / 4x',fill='#d6cddc')
    d.line((0,(cell+5)*4,scale.width,(cell+5)*4),fill='#8c9d85'); scale.save(qa/'scale.png')
    report['scale']={'actor_cell':48,'actor_bbox':list(actor.getbbox()),'same_scale':4}
    (qa/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(name, 'colors',len(palette),'idle',report['frames']['idle_a']['size'])
