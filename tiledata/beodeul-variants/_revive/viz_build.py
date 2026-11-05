import json, base64, os, io, glob, html
from PIL import Image
W='/home/main/z-project/rpg-zzu-fs2-revive'
R=json.load(open(W+'/tiledata/beodeul-variants/_revive/out/report.json'))
ORIG={'volcano-field':'volcano-field-0.png','ruined-village':'ruin-village-0.png','ice-age-field':'ice-age-field-0.png','mountain-fortress':'mountain-fort-0.png'}
PLAN={'bd-wave-ash-plain':'volcano-field-0','bd-wave-volcano-field':'volcano-field-0','bd-wave-ruined-village':'ruin-village-0','bd-wave-ice-age-field':'ice-age-field-0','bd-wave-mountain-fortress':'mountain-fort-0'}
def uri(path):
    return 'data:image/png;base64,'+base64.b64encode(open(path,'rb').read()).decode()
vids=json.load(open(W+'/verify-shots/beodeul-wave-places/runtime/report.json')) if os.path.exists(W+'/verify-shots/beodeul-wave-places/runtime/report.json') else {}
gate=open('/tmp/fs2rev/gate-summary.txt').read() if os.path.exists('/tmp/fs2rev/gate-summary.txt') else '(관문 판정 진행 중)'
out=['<!doctype html><meta charset=utf-8><title>폴른 스타 2막 장소 되살리기</title><style>body{background:#16171c;color:#dde;font:15px sans-serif;margin:20px}img,video{image-rendering:pixelated;max-width:100%}h2{border-bottom:1px solid #444;margin-top:40px}.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}figure{margin:0}figcaption{color:#aab;font-size:13px}pre{background:#222;padding:10px;white-space:pre-wrap;font-size:12px}</style>',
     '<h1>폴른 스타 2막 — 계획 그림 장소 넷 되살리기</h1>',
     '<p>원본 그림(웨이브 페이지에서 뽑은 무손실 PNG)을 16px 칸으로 잘라 새 공용 칩셋 <code>beodeul_wave_places</code> 와 등록 장소 <code>bd-wave-*</code> 로 만들었다. 칸으로 다시 짠 맵을 겹쳐 그리면 원본과 화소 차이 0. 영상은 SQLite 에 저장·재로드한 프로젝트를 출하 플레이어(player.html)로 1배속 걸은 것.</p>']
for mid,v in R.items():
    if mid.startswith('_'): continue
    key=mid.replace('-','_')
    out.append(f"<h2>{html.escape(v['name'])} <small>({mid}, {v['size'][0]}×{v['size'][1]}칸)</small></h2>")
    out.append(f"<p>원본과 화소 차이 <b>{v['pixelDiffVsOriginal']}</b> · 걷는 칸 {v['walkable']} · 입구에서 닿는 칸 {v['reached']} · 위층(물체 윗부분) 칸 {v['upperCells']}</p>")
    mp4='/home/main/claude-viz/fs2-revive-'+key+'.mp4'
    if os.path.exists(mp4):
        out.append(f"<video controls loop muted autoplay playsinline src='fs2-revive-{key}.mp4' width=960></video><p><small>1배속 걷기 영상(출하 플레이어)</small></p>")
    else:
        out.append("<p><i>걷기 영상: 녹화 대기 중(공용 QA 잠금 대기)</i></p>")
    out.append('<div class=row>')
    if mid in PLAN: out.append(f"<figure><img src='{uri('/home/main/ref/wave-places/'+PLAN[mid]+'.png')}'><figcaption>원본 참고 그림(계획 페이지에 실린 그림의 무손실 원본)</figcaption></figure>")
    out.append(f"<figure><img src='{uri(W+'/public/assets/region-references/'+mid+'.png')}'><figcaption>되살린 맵(칸으로 다시 짠 그림, 1배)</figcaption></figure>")
    out.append('</div>')
out.append('<h2>3/4 관문 (object-gate)</h2><pre>'+html.escape(gate)+'</pre>')
open('/home/main/claude-viz/fs2-revive.html','w').write('\n'.join(out))
print('ok')
