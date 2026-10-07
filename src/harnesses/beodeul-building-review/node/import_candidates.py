"""Put pictures from another tileset's authoring into a profile's review queue (profiles with "gate": false).

Their authoring (hand pixels, jp_city/joseon/... harnesses) stays where it is; this only hands finished building pictures to
the shared review screen, decisions, install and store publishing. A human decides every picture — there is no machine gate.
Not signed.

  python3 import_candidates.py --profile <id> manifest.json

manifest.json: {"candidates":[{"id","name","role","image":"path.png","entrance":{"x","y","w","h"},
                              "scene":"optional.png","description":"","material":"","round":1}]}
Re-importing the same id with a changed picture gives a new hash, so an old decision no longer applies.
"""
import argparse, hashlib, json, os, sqlite3, sys
from pathlib import Path
from PIL import Image
from profiles import load_profile

ROOT=Path(__file__).resolve().parents[4]

def sha(b):return hashlib.sha256(b).hexdigest()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--profile',required=True);ap.add_argument('manifest');a=ap.parse_args()
    P=load_profile(a.profile)
    if P.get('gate',True):raise SystemExit(f'profile {a.profile} has a machine gate; its candidates come from its own seed (queue.py build/produce), not an import.')
    data=P['data'];data.mkdir(parents=True,exist_ok=True)
    manifest=json.loads(Path(a.manifest).read_text());base=Path(a.manifest).resolve().parent
    c=sqlite3.connect(data/'review.sqlite')
    c.executescript('''create table if not exists candidates(id text primary key, position integer, sha text, meta text);
      create table if not exists decisions(seq integer primary key, item text, sha text, decision text, note text, at text);
      create table if not exists drafts(id text primary key, position integer, sha text, meta text);''')
    start=c.execute('select coalesce(max(position),-1)+1 from candidates').fetchone()[0];done=[]
    for k,item in enumerate(manifest['candidates']):
        for key in ('id','name','role','image'):
            if key not in item:raise SystemExit(f"{item.get('id','?')}: missing {key}")
        raw=(base/item['image']).read_bytes();im=Image.open(base/item['image']).convert('RGBA')
        if im.width%16 or im.height%16:raise SystemExit(f"{item['id']}: size {im.size} is not a multiple of 16")
        e=item.get('entrance')   # buildings only; props have none
        if e:assert 0<=e['x']and e['x']+e['w']<=im.width and 0<=e['y']and e['y']+e['h']<=im.height,f"{item['id']}: entrance outside the picture"
        digest=sha(raw);folder=data/'items'/item['id'];folder.mkdir(parents=True,exist_ok=True)
        (folder/(digest+'.png')).write_bytes(raw)
        if item.get('scene'):(folder/(digest+'-scene.png')).write_bytes((base/item['scene']).read_bytes())
        else:
            scene=Image.new('RGBA',(im.width+32,im.height+32),(136,177,77,255));scene.alpha_composite(im,(16,16));scene.save(folder/(digest+'-scene.png'))
        colors=sorted(set(im.getdata()));names={col:'p'+str(i) for i,col in enumerate(colors)}
        (folder/(digest+'.pixels.json')).write_text(json.dumps({'width':im.width,'height':im.height,'palette':{names[col]:'#'+bytes(col).hex() for col in colors},
            'rows':[[names[im.getpixel((x,y))] for x in range(im.width)] for y in range(im.height)],'assembly':{'source':'imported','id':item['id']}},ensure_ascii=False))
        existing=c.execute('select position from candidates where id=?',(item['id'],)).fetchone()
        meta={**{k:v for k,v in item.items() if k not in ('image','scene')},'width':im.width,'height':im.height,'silhouette':item.get('silhouette') or item['name'],
              'round':item.get('round',1),'position':existing[0] if existing else start+k,
              'image':f"/images/{item['id']}/{digest}.png",'scene':f"/images/{item['id']}/{digest}-scene.png",'pixels':f"/images/{item['id']}/{digest}.pixels.json"}
        c.execute('insert into candidates values(?,?,?,?) on conflict(id) do update set sha=excluded.sha,meta=excluded.meta',(item['id'],meta['position'],digest,json.dumps(meta,ensure_ascii=False)))
        done.append(dict(id=item['id'],sha=digest[:12],size=[im.width,im.height]))
    c.commit();c.close();print(json.dumps({'profile':a.profile,'imported':done},ensure_ascii=False))
if __name__=='__main__':main()
