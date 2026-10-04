#!/usr/bin/env python3
"""Bake a portable original-pose viewer. This is not the game runtime."""
from pathlib import Path
import base64,json
ROOT=Path(__file__).resolve().parents[1]
sheets=json.loads((ROOT/'sheets.json').read_text());data=json.loads((ROOT/'data.json').read_text())
rows=[]
for s in sheets:
    slug=s['resourceId'].removeprefix('jf-enemy-')
    e=next(e for e in data['enemies'] if e['monsterResourceId']==s['resourceId'])
    rows.append(dict(slug=slug,name=e['name'],cell=s['cell'],ms=s['idleFrameMs'],level=e['level'],
                     png='data:image/png;base64,'+base64.b64encode((ROOT/'assets'/f'{slug}.png').read_bytes()).decode()))
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>조선 설화 적 15종 · 원본 포즈</title>
<style>body{margin:0;background:#202938;color:#ece2c9;font:16px system-ui}header{padding:20px;position:sticky;top:0;background:#202938;z-index:2;border-bottom:1px solid #52606c}h1{font-size:22px;margin:0 0 8px}p{margin:6px 0}button,select{font:inherit;padding:6px;margin-right:6px;background:#eee5d3;color:#252b36;border:0;border-radius:3px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:20px}article{padding:12px;background:#303b49;border:1px solid #56606a}canvas{display:block;margin:auto;image-rendering:pixelated;background-color:#283342;background-image:conic-gradient(#34404f 25%,transparent 0 50%,#34404f 0 75%,transparent 0);background-size:24px 24px}h2{font-size:16px;margin:8px 0}.label{font-size:13px;color:#becbc8}</style>
<header><h1>조선 설화 적 15종 · 원본 9포즈</h1><p>일반12 / 보스3 · 오른쪽 → · native64/96 · 게임 통합 전 원본 칸 재생</p>
<select id="mode"><option value="idle">대기 a→b→c→b</option value="action">준비→이동→공격→회복</option><option value="all">9포즈 순서</option><option value="hit">피격</option><option value="dead">쓰러짐</option></select>
<button id="pause">정지</button><label>칸 <select id="frame">FRAME_OPTIONS</select></label><button id="bg">배경 변경</button></header><main id="grid"></main>
<script>const sprites=SPRITES_JSON;const poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'];
let mode='idle',paused=false,start=performance.now(),fixed=null;const cards=[];
for(const s of sprites){const a=document.createElement('article'),c=document.createElement('canvas');c.width=c.height=s.cell*2;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;const title=document.createElement('h2');title.textContent=s.name+' · Lv'+s.level;const note=document.createElement('div');note.className='label';a.append(c,title,note);document.getElementById('grid').append(a);const img=new Image();img.src=s.png;cards.push({s,c,ctx,img,note});}
const sequences={idle:[0,1,2,1],action:[0,3,4,5,6,0],all:[0,1,2,3,4,5,6,7,8],hit:[7],dead:[8]};
function draw(now){for(const card of cards){const {s,c,ctx,img,note}=card;const seq=sequences[mode],f=paused?(fixed??card.current??0):seq[Math.floor((now-start)/(mode==='idle'?s.ms:320))%seq.length];card.current=f;ctx.clearRect(0,0,c.width,c.height);if(img.complete&&img.naturalWidth)ctx.drawImage(img,(f%3)*s.cell,Math.floor(f/3)*s.cell,s.cell,s.cell,0,0,c.width,c.height);note.textContent=s.slug+' / '+s.cell+'px / '+poses[f];}requestAnimationFrame(draw);}requestAnimationFrame(draw);
document.getElementById('mode').onchange=e=>{mode=e.target.value;paused=false;fixed=null;document.getElementById('pause').textContent='정지';start=performance.now();};document.getElementById('pause').onclick=e=>{paused=!paused;fixed=null;e.target.textContent=paused?'재생':'정지';start=performance.now();};document.getElementById('frame').onchange=e=>{fixed=Number(e.target.value);paused=true;document.getElementById('pause').textContent='재생';};let bg=0;document.getElementById('bg').onclick=()=>{bg=(bg+1)%3;for(const {c} of cards){c.style.backgroundImage=bg===0?'':'none';c.style.backgroundColor=['#283342','#ece4d6','#11151c'][bg];}};
</script></html>'''
html=html.replace('SPRITES_JSON',json.dumps(rows,ensure_ascii=False)).replace('FRAME_OPTIONS',''.join(f'<option value="{i}">{p}</option>' for i,p in enumerate(['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'])))
(ROOT/'review/index.html').write_text(html)
print('portable original-pose viewer saved: review/index.html (15 species, embedded actual PNGs)')
