import sys,base64,io,html; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import pa,pb,pc,zig,zig2
from sheet2 import lawn
from sheet2 import card, water
from PIL import Image
P={k:v for k,v in {**pa.P,**pb.P,**pc.P}.items() if k!='계단식 제단'}; WATER=pa.WATER|pb.WATER|pc.WATER; names=list(P)
def b64(im):
    b=io.BytesIO(); im.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
groups=[('고대 유적',range(1,8)),('물가',range(8,14)),('정글 식물·지형',range(14,19)),('야영·보상',range(19,26)),('이동',range(26,28)),('추가 — 유적·함정·생활·식물',range(28,28+len(pc.P)))]
notes={'이끼 돌바닥 A':'이어 까는 바닥 타일 (오른쪽: 3×2로 이어 붙임)','이끼 돌바닥 B':'A 와 섞어 까는 변형',
 '봉인된 석문 (벽)':'절벽·유적 벽에 붙이는 문','통나무 다리 (가로)':'가로로 이어 붙이는 1칸 조각','덩굴 흔들다리 (가로)':'가로로 이어 붙이는 1칸 조각',
 '세이브 크리스털':'저장 지점','야영 천막':'3×3칸, 칩셋과 같은 정면 시점','통나무 다리 (가로)':'칩셋 다리처럼 윗면 + 앞 단면, 오른쪽은 강을 건너는 모습','보물 상자 (열림)':'열린 뒤 모습','사다리':'벼랑에 세로로 붙임','가시 함정 (숨김)':'바닥 타일, 밟으면 솟음','대나무 울타리 (가로)':'가로로 이어 붙임','덩굴 커튼 (벼랑 끝)':'벼랑 벽 윗단에 덧붙임','압력판':'퍼즐용 바닥 타일'}
import os; OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'out'); os.makedirs(OUT,exist_ok=True)
out=[]
for gname,rg in groups:
    cells=[]
    for i in rg:
        n=names[i-1]; im=P[n]().img(); w,h=im.size; im.save(os.path.join(OUT,f'{i:02d}.png'))
        big=card(im,wat=n in WATER,S=4)[0]; extra=''
        if n.startswith('이끼 돌바닥'):
            t=Image.new('RGBA',(48,32))
            for x in range(0,48,16):
                for y in range(0,32,16): t.paste(im,(x,y))
            extra=f'<img class="px" src="{b64(t.resize((192,128),Image.NEAREST))}">'
        if n=='통나무 다리 (가로)':
            sc=Image.new('RGBA',(96,64))
            for x in range(0,96,16):
                for y in range(0,64,16): sc.paste(lawn if (x<16 or x>=80) else water,(x,y))
            for x in range(16,80,16): sc.alpha_composite(im,(x,24))
            extra=f'<img class="px" src="{b64(sc.resize((288,192),0))}">'
        elif n=='대나무 울타리 (가로)':
            t=Image.new('RGBA',(64,16))
            for x in range(0,64,16): t.paste(lawn,(x,0)); t.alpha_composite(im,(x,0))
            extra=f'<img class="px" src="{b64(t.resize((256,64),0))}">'
        elif '(가로)' in n:
            row=Image.new('RGBA',(64,32))
            for x in range(0,64,16):
                for y in (0,16): row.paste(water,(x,y))
            for x in range(0,64,16): row.alpha_composite(im,(x,8))
            extra=f'<img class="px" src="{b64(row.resize((256,128),Image.NEAREST))}">'
        cells.append(f'<div class="card"><div class="imgs"><img class="px" src="{b64(big)}"><div class="one"><img src="{b64(im)}"><span>1배</span></div>{extra}</div><b>{html.escape(n)}</b><small>{w//16}×{h//16}칸 ({w}×{h}px){" · "+html.escape(notes[n]) if n in notes else ""}</small></div>')
    out.append(f'<h2>{gname}</h2><div class="grid">{"".join(cells)}</div>')
kit_names={'face_L':'벽 왼끝','face_M':'벽','face_R':'벽 오른끝','foot_L':'밑단 왼끝','foot_M':'밑단','foot_R':'밑단 오른끝',
 'ledge_L':'층 턱 왼끝','ledge_M':'층 턱 (위층 벽 그늘)','ledge_open':'층 턱 (트임)','ledge_R':'층 턱 오른끝',
 'stair_L':'계단 왼 난간','stair_M':'계단','stair_R':'계단 오른 난간','stairfoot_L':'계단 끝 왼','stairfoot_M':'계단 끝','stairfoot_R':'계단 끝 오른',
 'floor_M':'테라스 바닥','floor_T':'바닥 뒤끝','floor_L':'바닥 왼끝','floor_R':'바닥 오른끝','floor_TL':'바닥 모서리','floor_s':'바닥(위층 그늘)','floor_w':'바닥(옆 그늘)','ledgeP_M':'바닥 앞끝','rooftop_M':'사당 지붕 윗면','door':'신전 문','roof_L':'지붕 왼끝','roof_M':'지붕','roof_R':'지붕 오른끝','roofc_L':'지붕(볏 밑) 왼','roofc_M':'지붕(볏 밑)','roofc_R':'지붕(볏 밑) 오른','column':'주랑 기둥','frieze_L':'문양 띠 왼끝','frieze_M':'문양 띠','frieze_R':'문양 띠 오른끝','panel':'움푹 판','panel_glyph':'움푹 판 (룬)','comb_L':'지붕 볏 왼','comb_M':'지붕 볏','comb_R':'지붕 볏 오른','combtop_L':'볏 꼭대기 왼','combtop_M':'볏 꼭대기 (보석)','combtop_R':'볏 꼭대기 오른'}
ov_names={'banner':'깃발 (1×2)','bigserpent_L':'깃털 뱀 머리 (2×2)','bigserpent_R':'깃털 뱀 머리 (2×2, 반전)','moss_drape':'턱 이끼 A','moss_drape2':'턱 이끼 B','moss_drape3':'턱 이끼 C','moss_patch2':'벽 이끼 B','vine2':'덩굴 B','moss_patch':'벽 이끼','vine':'덩굴','brazier':'화로','serpent_L':'뱀 머리 (왼)','serpent_R':'뱀 머리 (오른)'}
kc=[]
zig.T.update(zig2.T); zig.O.update(zig2.O)
for k,n in kit_names.items():
    kc.append(f'<div class="kc"><img class="px" src="{b64(zig.T[k].resize((64,64),0))}"><small>{n}</small></div>')
for k,n in ov_names.items():
    o=zig.O[k]; bg=Image.new('RGBA',o.size)
    for yy in range(0,o.height,16):
        for xx in range(0,o.width,16): bg.paste(lawn,(xx,yy))
    bg.alpha_composite(o)
    kc.append(f'<div class="kc ov"><img class="px" src="{b64(bg.resize((o.width*4,o.height*4),0))}"><small>{n} · 덧붙임</small></div>')
ex=[]
for title,kw,S in (('대신전 21×28칸 — 4층',dict(n=4,summit_w=9,summit_d=7),3),('중신전 17×21칸 — 3층',dict(n=3,summit_w=9,summit_d=7,seed=4),3)):
    g,ov,W,H=zig2.build(**kw); im=zig2.render(g,ov,W,H,lawn)
    ex.append(f'<div class="card"><img class="px" src="{b64(im.resize((im.width*S,im.height*S),0))}"><b>{title}</b><small>층마다 걸어 다닐 돌바닥 테라스 + 앞쪽에만 보이는 짧은 벽. 꼭대기는 사당 앞 광장(제단·화로). 위층은 오른쪽·아래로 그림자를 떨군다.</small></div>')
kit_html=f'<h2>조립식 대신전 (지구라트)</h2><p>탑다운에서 걸어 다닐 수 있게 조립했다: 각 층의 윗면이 테라스 바닥이고, 벽은 테라스 앞끝에 1~3줄만 보인다. 옆·뒤 가장자리는 윤곽선만. 모두 16px 칸 조각이며 층 수·폭·광장 깊이는 인자로 바뀐다.</p><div class="grid">{"".join(ex)}</div><h3>조각</h3><div class="kit">{"".join(kc)}</div>'
out.insert(0,kit_html)
doc=f'''<!doctype html><meta charset="utf-8"><title>정글 기물 도트 시안 v6</title>
<style>body{{background:#1b1c1f;color:#e6e6e6;font:14px system-ui,sans-serif;margin:24px}}
h1{{font-size:20px}}h2{{font-size:16px;border-bottom:1px solid #444;padding-bottom:4px;margin-top:28px}}
.grid{{display:flex;flex-wrap:wrap;gap:16px}}.kit{{display:flex;flex-wrap:wrap;gap:10px}}.kc{{display:flex;flex-direction:column;align-items:center;gap:3px;background:#26282c;padding:6px;border-radius:4px;width:92px;text-align:center}}.kc img{{image-rendering:pixelated}}h3{{font-size:14px;color:#ccc}}.card{{background:#26282c;border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:4px}}
.imgs{{display:flex;gap:10px;align-items:flex-end}}img.px,.one img{{image-rendering:pixelated}}
.one{{display:flex;flex-direction:column;align-items:center;gap:2px;color:#999;font-size:11px}}small{{color:#aaa}}p{{color:#bbb;max-width:900px}}</style>
<h1>정글 바이옴 기물 — 도트 시안 v6</h1>
<p>맵에는 배치하지 않았다. 기존 정글 칩셋 화풍(재질 결·6단 명암·어두운 윤곽·겹침 윤곽)에 맞춰 다시 찍었다.
각 카드: 칩셋 잔디(물가 기물은 물) 위 4배 확대 + 실제 크기. 1칸 = 16px.</p>
{"".join(out)}'''
open(os.environ.get('PX_PAGE',os.path.expanduser('~/claude-viz/jungle-objects.html')),'w').write(doc); print(len(doc)//1024,'KB')
