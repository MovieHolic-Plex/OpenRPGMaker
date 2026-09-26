# ~/claude-viz/paw-maps/*.png|json 으로 갤러리 HTML 을 만든다(저장소 밖). 원본 그림은 링크만, 썸네일은 같은 폴더.
import glob, json, os, re, collections
from PIL import Image
OUT = '/home/main/claude-viz/paw-maps'; HERE = os.path.dirname(os.path.abspath(__file__))
cat = json.load(open(HERE + '/catalog.json'))
maps = [json.load(open(j)) for j in sorted(glob.glob(OUT + '/m[0-9][0-9]_*.json'))]
os.makedirs(OUT + '/thumb', exist_ok=True)
for m in maps:
    im = Image.open(f"{OUT}/{m['id']}.png"); im.thumbnail((480, 480)); im.save(f"{OUT}/thumb/{m['id']}.png")
used = collections.Counter(s.split('#')[0] for m in maps for s in set(x.split('#')[0] for x in m['sheets']))
FAM = ['Asphalt','Concrete','Ditch','Dway','GBorder','GRoad','Grass','Ground','StFence','WallA','Moss','Undulation','SRoad','Kadan','Pool','Hatake']
fam = {f: sorted({s for s in used if re.match(rf'SA-{f}', s)}) for f in FAM}
def grp(n):
    p = cat['sheets'][n]['path']
    if p.startswith('by-source/'): return 'by-source/' + p.split('/')[2]
    if '/' not in p: return 'root ' + n.split('-')[0]
    return p.split('/')[0] + '/' + p.split('/')[1]
tot = collections.Counter(grp(n) for n in cat['sheets']); hit = collections.Counter(grp(n) for n in used if n in cat['sheets'])
KIND = {'exterior': '바깥', 'interior': '실내', 'dungeon': '던전', 'worldmap': '월드맵', 'event': '이벤트'}
cards = ''.join(f"""<figure><a href="paw-maps/{m['id']}.png" target="_blank"><img src="paw-maps/thumb/{m['id']}.png" alt="{m['title']}"></a>
<figcaption><b>{m['id'][:3]}</b> {m['title']} <span>{m['w']}×{m['h']} · {KIND.get(m.get('kind'), m.get('kind'))} · 시트 {len(set(x.split('#')[0] for x in m['sheets']))}</span></figcaption></figure>""" for m in maps)
rows = ''.join(f"<tr><td>{g}</td><td>{hit[g]}</td><td>{tot[g]}</td></tr>" for g in sorted(tot))
frows = ''.join(f"<tr><td>SA-{f}</td><td>{'✔' if fam[f] else '✘'}</td><td>{' '.join(x[3:-4] for x in fam[f])}</td></tr>" for f in FAM)
html = f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>PAW 맵 {len(maps)}개</title>
<style>body{{font-family:sans-serif;background:#1d1d1d;color:#eee;margin:16px}}.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}}
figure{{margin:0;background:#2a2a2a;padding:8px;border-radius:6px}}img{{width:100%;image-rendering:pixelated;display:block}}figcaption{{font-size:14px;margin-top:6px}}figcaption span{{color:#aaa;display:block;font-size:12px}}
table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:3px 8px;font-size:13px}}a{{color:#8cf}}</style>
<h1>PAW(ドット絵世界) 맵 {len(maps)}개</h1><p>썸네일을 누르면 원래 크기(1타일=32px)로 열립니다. 사용한 서로 다른 시트: <b>{len(used)}</b> / {len(cat['sheets'])}</p>
<div class=g>{cards}</div>
<h2>바깥 오토타일 계열</h2><table><tr><th>계열</th><th>사용</th><th>쓴 시트</th></tr>{frows}</table>
<h2>시트 묶음별 사용</h2><table><tr><th>묶음</th><th>사용</th><th>전체</th></tr>{rows}</table>"""
open('/home/main/claude-viz/paw-maps.html', 'w').write(html)
print('gallery', len(maps), 'maps', len(used), 'sheets', 'families', sum(1 for f in FAM if fam[f]), '/', len(FAM))
