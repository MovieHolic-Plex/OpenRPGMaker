"""Native-pixel drafts, adversarial vision admission, hash-bound human decisions.
No decision CLI and no automatic game installation.
"""
import argparse, hashlib, io, json, os, secrets, sqlite3, sys, threading, zipfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image, ImageDraw, ImageFont
from native_author import render_native

ROOT=Path(__file__).resolve().parents[4]
SOURCE=ROOT/'harness-data/beodeul-building-review'
DATA=Path(os.environ.get('BEODEUL_BUILDING_REVIEW_DATA',str(Path.home()/'.local/share/oprn/beodeul-building-review')))
LOCK=threading.RLock()
TOKEN=secrets.token_urlsafe(32)

def now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')
def sha(data): return hashlib.sha256(data).hexdigest()
def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
def db():
    DATA.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DATA/'review.sqlite',timeout=20);c.row_factory=sqlite3.Row
    c.execute('pragma journal_mode=wal')
    c.executescript('''create table if not exists candidates(id text primary key, position integer, sha text, meta text);
      create table if not exists decisions(seq integer primary key, item text, sha text, decision text, note text, at text);
      create table if not exists drafts(id text primary key, position integer, sha text, meta text);''')
    return c

def source():
    p=SOURCE/'pixels/panels.json'
    return json.loads((SOURCE/'seed.json').read_text()),json.loads(p.read_text())['panels'] if p.exists() else {}

def panel_image(name,palette,panels):
    p=panels[name];assert len(p['rows'])==p['height']
    image=Image.new('RGBA',(p['width'],p['height']))
    colors={k:tuple(bytes.fromhex(v.removeprefix('#')))+( (255,) if len(v)==7 else () ) for k,v in palette.items()}
    for y,row in enumerate(p['rows']):
        assert len(row)==p['width'],(name,y,len(row),p['width'])
        for x,s in enumerate(row):
            if s!='.':image.putpixel((x,y),colors[s])
    return image

def render(item,panels):
    if item.get('authoring')=='native-parts':return render_native(item)
    assert item['width']%16==item['height']%16==0
    image=Image.new('RGBA',(item['width'],item['height']))
    shadow=panel_image('shadow',item['palette'],panels)
    for part in item['details']:
        if part['panel']=='sill':image.alpha_composite(shadow,(part['x']+3,part['y']+2))
    for block in item['blocks']:
        tile=panel_image(block['panel'],item['palette'],panels)
        for dy,row in enumerate(block['rows']):
            for dx,s in enumerate(row):
                assert s in 'W.'
                if s=='W': image.alpha_composite(tile,(block['x']+dx*16,block['y']+dy*16))
    doors=[]
    for part in item['details']:
        p=panel_image(part['panel'],item['palette'],panels)
        if part.get('crop'):p=p.crop(tuple(part['crop']))
        # Repeat a hand-authored middle roofing strip, preserving both native caps.
        extension=part.get('extend',0)
        if extension:
            assert extension%16==0 and p.width==64
            expanded=Image.new('RGBA',(64+extension,p.height));expanded.paste(p.crop((0,0,32,p.height)),(0,0))
            for offset in range(0,extension,16):expanded.paste(p.crop((24,0,40,p.height)),(32+offset,0))
            expanded.paste(p.crop((32,0,64,p.height)),(32+extension,0));p=expanded
        assert part['x']>=0 and part['y']>=0 and part['x']+p.width<=image.width and part['y']+p.height<=image.height,(item['id'],part)
        image.alpha_composite(p,(part['x'],part['y']))
        if part['panel'] in ('door','cargo'): doors.append(dict(x=part['x'],y=part['y'],w=p.width,h=p.height))
    assert len(doors)==1 and doors[0]==item['entrance'],(item['id'],doors,item['entrance'])
    return image

def grass():
    atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
    n=737;return atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16))

def scene(item,image):
    # Reference is the preserved house and the selected warm yellow-green tree, at 1:1.
    house=Image.open(ROOT/'public/assets/beodeul-architecture/cream.png').convert('RGBA')
    tree=Image.open(ROOT/'public/assets/beodeul-warm-trees/tree-03a8f7.png').convert('RGBA')
    tree_shadow=Image.open(ROOT/'public/assets/beodeul-warm-trees/tree-03a8f7-shadow.png').convert('RGBA')
    ref_x=image.width+32;tree_x=ref_x+house.width+24
    width=tree_x+tree.width+16;height=max(image.height,house.height,tree.height)+48
    bg=Image.new('RGBA',(width,height));tile=grass()
    for y in range(0,height,16):
        for x in range(0,width,16):bg.paste(tile,(x,y))
    ground=height-24
    bg.alpha_composite(image,(12,ground-image.getbbox()[3]))
    bg.alpha_composite(house,(ref_x,ground-house.height))
    bg.alpha_composite(tree_shadow,(tree_x,ground-tree.height));bg.alpha_composite(tree,(tree_x,ground-tree.height))
    return bg

def snapshot():
    active_ids={item['id'] for item in source()[0]['candidates']}
    with db() as c:
        items=[]
        for row in c.execute('select * from candidates order by position'):
            if row['id'] not in active_ids:continue
            from visual_gate import verify_receipt
            if not verify_receipt(DATA,row['id'],row['sha']):continue
            item=json.loads(row['meta']);last=c.execute('select * from decisions where item=? and sha=? order by seq desc limit 1',(row['id'],row['sha'])).fetchone()
            item.update(sha=row['sha'],decision=last['decision'] if last else 'pending',note=last['note'] if last else '',decidedAt=last['at'] if last else None)
            items.append(item)
        counts={k:sum(i['decision']==k for i in items) for k in ('allow','deny','pending')}
        drafts=c.execute('select count(*) from drafts').fetchone()[0]
        return dict(schema='beodeul-building-review/2',items=items,counts=counts,draftCount=drafts,previousRejected=source()[0]['previousRejected'])

def build(only=None):
    seed,panels=source();(DATA/'staging').mkdir(parents=True,exist_ok=True)
    if only and not any(item['id']==only for item in seed['candidates']):raise ValueError('모르는 후보: '+only)
    images=[]
    with LOCK,db() as c:
        for index,item in enumerate(seed['candidates']):
            if only and item['id']!=only:continue
            image=render(item,panels);directory=DATA/'staging'/item['id'];directory.mkdir(exist_ok=True)
            buffer=io.BytesIO();image.save(buffer,format='PNG');raw=buffer.getvalue();digest=sha(raw)
            (directory/(digest+'.png')).write_bytes(raw)
            context=scene(item,image);context.save(directory/(digest+'-scene.png'))
            # Fully resolved row grids remain inspectable without a procedural drawing program.
            color_list=sorted(set(image.getdata()))
            symbols=['p'+str(i) for i in range(len(color_list))];lookup={color:symbols[i] for i,color in enumerate(color_list)}
            pixel_source={'width':image.width,'height':image.height,'palette':{lookup[color]:'#'+bytes(color).hex() for color in color_list},'rows':[[lookup[image.getpixel((x,y))] for x in range(image.width)] for y in range(image.height)],'assembly':item}
            write_json(directory/(digest+'.pixels.json'),pixel_source)
            meta={**item,'position':index,'image':'/images/'+item['id']+'/'+digest+'.png','scene':'/images/'+item['id']+'/'+digest+'-scene.png','pixels':'/images/'+item['id']+'/'+digest+'.pixels.json'}
            c.execute('insert into drafts values(?,?,?,?) on conflict(id) do update set position=excluded.position,sha=excluded.sha,meta=excluded.meta',(item['id'],index,digest,json.dumps(meta,ensure_ascii=False)))
            images.append((item,image));c.commit()
    evidence=ROOT/'verify-shots/beodeul-building-review';evidence.mkdir(exist_ok=True,parents=True)
    board=Image.new('RGB',(1200,max(320,320*((len(images)+4)//5))),'#8dae59');draw=ImageDraw.Draw(board)
    for n,(item,image) in enumerate(images):
        x=(n%5)*240;y=(n//5)*320
        board.paste(image,(x+(240-image.width)//2,y+260-image.getbbox()[3]),image)
        draw.text((x+8,y+290),item['id'],fill='#25302b')
    board.save(evidence/'staging-native.png')
    write_json(evidence/'build-proof.json',{'privateDrafts':len(images),'installed':False,'published':len(snapshot()['items'])})
    print(json.dumps({'staged':len(images),'published':len(snapshot()['items'])},ensure_ascii=False))

def validate():
    seed,panels=source();report=[]
    active={i['id'] for i in seed['candidates']}
    with db() as c:items=[{**json.loads(r['meta']),'sha':r['sha']} for r in c.execute('select * from drafts order by position') if r['id'] in active]
    assert {i['id'] for i in items}=={i['id'] for i in seed['candidates']},'Missing drafts: an empty or partial build is not valid.'
    for item in items:
        image=render(next(i for i in seed['candidates'] if i['id']==item['id']),panels)
        file=DATA/'staging'/item['id']/(item['sha']+'.png')
        assert sha(file.read_bytes())==item['sha']
        assert Image.open(file).convert('RGBA').tobytes()==image.tobytes()
        assert image.getbbox() is not None
        report.append({'id':item['id'],'sourceMatches':True,'entranceMetadataPresent':True,'sha':item['sha']})
    write_json(ROOT/'verify-shots/beodeul-building-review/validation.json',{'candidates':report,'visualApproval':'requires-vision-gate-and-human-decision'})
    print(json.dumps({'candidates':len(report),'sourceMatches':True,'visualApproval':'requires-vision-gate-and-human-decision'}))

def export_pack():
    selected=[i for i in snapshot()['items'] if i['decision']=='allow']
    if not selected:raise ValueError('허용한 후보가 없습니다.')
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json',json.dumps({'schema':'beodeul-allowed-candidates/1','installed':False,'candidates':selected},ensure_ascii=False,indent=2))
        z.write(SOURCE/'seed.json','source/native-recipes.json')
        for item in selected:
            for suffix in ('.png','.pixels.json','-scene.png'):
                z.write(DATA/'items'/item['id']/(item['sha']+suffix),item['id']+'/'+item['id']+suffix)
    return buffer.getvalue()

class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):pass
    def reply(self,status,data,mime='application/json; charset=utf-8',headers=None):
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        if headers:
            for k,v in headers.items():self.send_header(k,v)
        self.end_headers();self.wfile.write(data)
    def js(self,status,data):self.reply(status,json.dumps(data,ensure_ascii=False).encode())
    def do_GET(self):
        path=urlsplit(self.path).path
        try:
            if path=='/':return self.reply(200,(ROOT/'src/harnesses/beodeul-building-review/web/index.html').read_bytes(),'text/html; charset=utf-8')
            if path=='/api/state':return self.js(200,{**snapshot(),'token':TOKEN})
            if path=='/api/export':return self.reply(200,export_pack(),'application/zip',{'Content-Disposition':'attachment; filename="beodeul-allowed.zip"'})
            if path=='/grass.png':
                buf=io.BytesIO();grass().save(buf,format='PNG');return self.reply(200,buf.getvalue(),'image/png')
            if path.startswith('/images/'):
                parts=path.removeprefix('/images/').split('/')
                published=next((i for i in snapshot()['items'] if i['id']==parts[0]),None)
                if not published or len(parts)!=2 or not parts[1].startswith(published['sha']):return self.js(404,{'error':'검증되지 않은 그림'})
                file=(DATA/'items'/path.removeprefix('/images/')).resolve()
                if not file.is_relative_to((DATA/'items').resolve()) or file.suffix not in ('.png','.json'):return self.js(404,{'error':'not found'})
                return self.reply(200,file.read_bytes(),'image/png' if file.suffix=='.png' else 'application/json')
            return self.js(404,{'error':'not found'})
        except (ValueError,FileNotFoundError) as e:return self.js(409 if isinstance(e,ValueError) else 404,{'error':str(e)})
    def do_POST(self):
        if self.path!='/api/decision':return self.js(404,{'error':'not found'})
        if self.headers.get('X-Review-Token')!=TOKEN:return self.js(403,{'error':'화면에서 다시 시도해 주세요.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=16384:raise ValueError('요청 크기 오류')
            data=json.loads(self.rfile.read(size));decision=data.get('decision');note=data.get('note','')
            if decision not in ('allow','deny','pending') or not isinstance(note,str) or len(note)>4000:raise ValueError('결정/메모 오류')
            with LOCK,db() as c:
                current=next((i for i in snapshot()['items'] if i['id']==data.get('id')),None)
                if not current or current['sha']!=data.get('sha'):return self.js(409,{'error':'그림이 변경됐습니다. 새로고침 후 다시 검수해 주세요.'})
                c.execute('insert into decisions(item,sha,decision,note,at) values(?,?,?,?,?)',(data['id'],current['sha'],decision,note,now()));c.commit()
                write_json(DATA/'decisions.json',snapshot())
            return self.js(200,snapshot())
        except (ValueError,TypeError,json.JSONDecodeError) as e:return self.js(400,{'error':str(e)})
        except Exception:return self.js(500,{'error':'저장하지 못했습니다. 다시 시도해 주세요.'})

def main():
    parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['build','validate','gate','publish','produce','serve','status','export']);parser.add_argument('--port',type=int,default=18317);parser.add_argument('--host',default='0.0.0.0');parser.add_argument('--only');args=parser.parse_args()
    if args.stage=='build':build(args.only)
    elif args.stage=='validate':validate()
    elif args.stage in ('gate','publish','produce'):
        from visual_gate import run_gate,publish
        if args.stage=='produce':build(args.only);validate()
        if args.stage in ('gate','produce'):run_gate(DATA)
        if args.stage in ('publish','produce'):publish(DATA)
    elif args.stage=='status':print(json.dumps(snapshot(),ensure_ascii=False,indent=2))
    elif args.stage=='export':
        target=DATA/'beodeul-allowed.zip';target.write_bytes(export_pack());print(target)
    else:
        print(f'http://mdc-server:{args.port}/ — decisions {DATA}/review.sqlite',flush=True)
        ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
if __name__=='__main__':main()
