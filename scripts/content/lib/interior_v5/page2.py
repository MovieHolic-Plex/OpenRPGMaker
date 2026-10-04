import sys,base64,io,os,json; sys.path.insert(0,'/tmp/j8v5')
import rooms2, ko, cat, anim
from surf import OBJ
from PIL import Image
def u(im):
    b=io.BytesIO(); im.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def uf(p,mime): return f'data:{mime};base64,'+base64.b64encode(open(p,'rb').read()).decode()
meta=json.load(open('/tmp/j8v5/interior-meta.json'))
uniq=sum(1 for k in OBJ if ':' not in k)
h=f'''<!doctype html><meta charset=utf-8><title>실내 v3 — 여러 방·탁상 배치·애니메이션·AI 메타데이터</title><style>body{{background:#16161a;color:#ddd;font:14px/1.6 system-ui;margin:24px;max-width:1900px}}img{{image-rendering:pixelated;display:block;margin:6px 0 20px}}h2{{margin-top:34px}}pre{{background:#22222a;padding:10px;overflow:auto;max-height:420px;font-size:12px}}.grid{{display:flex;flex-wrap:wrap;gap:18px}}.grid div{{text-align:center}}</style>
<h1>실내 v3 — 여러 방·탁상 배치·애니메이션·AI 메타데이터</h1>
<p>① 방마다 뒷방·곁방·칸막이·어긋난 벽선으로 구조를 나눴다(ㅁ자 한 칸 금지). ② 책상·식탁·카운터·협탁·제단 윗면에 물건을 <b>올려</b> 둔다 — 가구마다 윗면 좌표(surface)가 있고 물건은 그 안에만 놓인다. ③ 벽난로·용광로·빵 화덕·화덕·수조·가마솥·촛대·벽등은 4프레임 애니메이션. ④ 모든 칩({len(meta['objects'])}개 + 탁상 물건 {len(meta['goods'])}개)에 설명·연관·배치 규칙·칸별 통행·아틀라스 좌표를 담은 메타데이터와 실내 10곳의 정답 배열을 만들었다: <a href="interior-meta.json" style="color:#9cf">interior-meta.json</a> · <a href="interior-atlas.png" style="color:#9cf">interior-atlas.png</a></p>
<h2>실내 10곳 (2배, 움직임)</h2>'''
for k,r in rooms2.R.items():
    h+=f'<h3>{r["name"]}</h3><img src="{uf(f"/tmp/j8v5/v3_{k}.webp","image/webp")}">'
h+='<h2>애니메이션 기물 (4배)</h2><div class=grid>'
for k in anim.ANIM:
    f=OBJ[k][1](); fr=[i.resize((i.width*4,i.height*4),Image.NEAREST) for i in f.frames]
    bg=[]
    for i in fr:
        b=Image.new('RGBA',i.size,(58,48,40,255)); b.alpha_composite(i); bg.append(b.convert('RGB'))
    out=f'/tmp/j8v5/_a.webp'; bg[0].save(out,save_all=True,append_images=bg[1:],duration=180,loop=0,lossless=True)
    h+=f'<div><img src="{uf(out,"image/webp")}"><span>{ko.ko(k)}</span></div>'
h+='</div><h2>메타데이터 발췌</h2><pre>'
ex=[o for o in meta['objects'] if o['id'] in ('desk','forge','counter 3','crate:tomato')]+[meta['goods'][0]]
h+=json.dumps(ex,ensure_ascii=False,indent=1).replace('<','&lt;')+'</pre><pre>'+json.dumps(meta['rooms'][0],ensure_ascii=False,indent=1)[:3000].replace('<','&lt;')+' …</pre>'
h+=f'<h2>아틀라스 (2배) — 모든 칩, 16px 격자, 애니메이션 프레임은 오른쪽으로</h2><img src="{u(Image.open("/tmp/j8v5/interior-atlas.png").resize((1280,Image.open("/tmp/j8v5/interior-atlas.png").height*2),Image.NEAREST))}">'
open(os.path.expanduser('~/claude-viz/interior-v3.html'),'w').write(h)
