"""Full AI review boards from REAL skill source and engine traces, no invented art/effects."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[4];OWN=ROOT/'content-packs/joseon-folklore/behavior';OUT=ROOT/'public/assets/joseon-folklore/behavior'
design=json.loads((OWN/'design.json').read_text());results=json.loads((OWN/'smoke-results.json').read_text())
fontPath='/usr/share/fonts/truetype/nanum/NanumGothic.ttf'
def font(n):return ImageFont.truetype(fontPath,n)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
COL='#253640';BG='#f7f3ea'
def wrapped(draw,text,x,y,width,size=16):
    line='';f=font(size)
    for ch in text:
        if draw.textlength(line+ch,font=f)>width:
            draw.text((x,y),line,font=f,fill=COL);y+=size+7;line=ch
        else:line+=ch
    if line:draw.text((x,y),line,font=f,fill=COL);y+=size+7
    return y
skills={s['id']:s for s in json.loads((OWN/'skills-source.json').read_text())['records']['skills']}
usedImages=[]
def cond(c):
 k=c['kind']
 if k=='turn':return f"차례 {c['start']}+{c['interval']}n"
 if k in ('hp','mp'):return f"{k.upper()} {c['minPercent']}~{c['maxPercent']}%"
 if k=='allies':return f"살아 있는 다른 동료 {c['min']}~{c['max']}명"
 if k=='status':return c['stateId']+' '+('있음' if c['present'] else '없음')
 return k

def timeline(draw,record,flow,mode,x,y):
 run=next((r for r in results['runs'] if r['enemyId']==record['enemyId'] and r['flow']==flow and r['mode']==mode),None)
 draw.text((x,y+19),flow+(' 낮은HP' if mode=='low' else ''),font=font(15),fill=COL)
 if not run:
  draw.text((x+105,y+18),'실제 기술 source 미저장 · 실행 검사 보류',font=font(18),fill='#904943');return
 actions=[]
 for e in run['events']:
  if actions and e['actionId']==actions[-1]['actionId']:continue
  actions.append(e)
 for i,e in enumerate(actions[:10]):
  xx=x+105+i*101;kind=e['kind'];id=e.get('skillId')
  label='기본' if kind=='basic' else '예고' if kind=='prepare' else '발동'
  if id and kind!='prepare' and skills.get(id,{}).get('effect',{}).get('kind')=='support':label='상태'
  color={'기본':'#e6e0d2','예고':'#ffe0a6','발동':'#c8dce3','상태':'#dacde8'}[label]
  draw.rectangle((xx,y,xx+91,y+64),fill=color,outline='#b8b5a9')
  draw.text((xx+6,y+4),f"T{e['turn']}",font=font(14),fill=COL)
  draw.text((xx+6,y+25),label,font=font(17),fill=COL)
  name=skills.get(id,{}).get('name','')
  if name:draw.text((xx+5,y+48),name[:7],font=font(11),fill=COL)

def imageSource(record,im,x,y):
 path=ROOT.parent/'rpg-zzu-codex-joseon-dialogue-codex-jf-content-jf-monsters/content-packs/joseon-folklore/monsters/assets'/f"{record['slug']}.png"
 if path.exists():
  source=Image.open(path).convert('RGBA');cell=source.width//3
  # Native crop, nearest enlargement. Original reviewed whole sheets remain external read-only.
  cellIm=source.crop((0,0,cell,cell));scale=1 if cell>=96 else 2
  im.alpha_composite(cellIm.resize((cell*scale,cell*scale),Image.Resampling.NEAREST),(x,y))
  usedImages.append({'path':str(path),'sha256':sha(path),'role':'actual monsters source; review-only idle crop','nativeCell':cell,'reviewScale':scale})
  return True
 return False

def header(im,title):
 d=ImageDraw.Draw(im);d.text((25,17),title,font=font(29),fill=COL)
 d.text((25,59),'실제 skills·monsters 레코드 · 실제 엔진 메모리 실행 · MP0 네 종은 양성 검사에서만 MP 보충 · 게임 화면 아님',font=font(17),fill=COL)
 d.text((25,88),'T=전투 차례 / 첫 strict 행동은 설정 전 예약될 수 있음 / 예고는 실제 chargeTurns만 / 사용자 승인 아님',font=font(16),fill=COL)
 return d
OUT.mkdir(parents=True,exist_ok=True)
artifacts=[]
for page in range(2):
 im=Image.new('RGBA',(1450,1815),BG);d=header(im,f'조선 설화 · 일반 행동 AI {page*6+1}–{page*6+6} / 12')
 for j,r in enumerate(design['roster'][page*6:page*6+6]):
  y=125+j*275;d.line((25,y-3,1425,y-3),fill='#c7c2b5')
  d.text((25,y+3),r['name']+' · Lv'+str(r['recommendedLevel']),font=font(22),fill=COL)
  present=imageSource(r,im,25,y+44)
  if not present:d.text((25,y+80),'그림 미등록',font=font(15),fill='#756c60')
  d.text((180,y+6),r['enemyId'],font=font(16),fill=COL)
  timeline(d,r,'strict','on',200,y+34);timeline(d,r,'gauge','on',200,y+109)
  desc=' / '.join(f"{cond(a['condition'])} · P{a['priority']}" for a in r['actions'][1:])+' / 기본 always P1'
  yy=wrapped(d,desc,180,y+186,1230,15)
  effect=' | '.join((s['name']+': '+s['scope']+' / '+s['effect']['kind']+' / 기력'+str(s['mpCost']['flat'])+' / 모으기'+str(s['chargeTurns'])) if s['sourcePresent'] else s['skillId']+' source 미저장' for s in r['skillContracts'])
  yy=wrapped(d,effect,180,yy,1230,15)
  wrapped(d,'대응: '+r['playerResponse'],180,yy,1230,14)
 d.text((25,1755),'정본 MP0: 들쥐·멧돼지·박쥐·짚도깨비는 기술 선택 불가. 원본 능력치 실행도 별도로 확인; root의 통합 조정 필요.',font=font(16),fill='#904943')
 d.text((25,1783),f"실행 {len(results['runs'])}개 / 누락 실제기술 {len(results['missingIds'])}개 / full AI 검사 {'완료' if results['ok'] else '보류'} / 사용자 승인 별개",font=font(17),fill=COL)
 path=OUT/f'full-normals-{page+1}.png';im.save(path);artifacts.append(path)
im=Image.new('RGBA',(1450,1810),BG);d=header(im,'조선 설화 · 보스 3종 · 예고와 HP 변화')
for j,r in enumerate(design['roster'][12:]):
 y=125+j*550;d.line((25,y-3,1425,y-3),fill='#c7c2b5')
 d.text((25,y+4),r['name']+' · Lv'+str(r['recommendedLevel'])+' · HP 경계 '+str(r['hpThreshold'])+'%',font=font(23),fill=COL)
 if not imageSource(r,im,25,y+60):d.text((25,y+96),'그림 미등록',font=font(15),fill='#756c60')
 for n,(flow,mode) in enumerate([('strict','high'),('gauge','high'),('strict','low'),('gauge','low')]):timeline(d,r,flow,mode,200,y+42+n*76)
 yy=wrapped(d,' / '.join(f"{cond(a['condition'])} · P{a['priority']}" for a in r['actions'][1:])+' / 기본 always P1',25,y+359,1400,16)
 yy=wrapped(d,'대응: '+r['playerResponse'],25,yy+5,1400,16)
 yy=wrapped(d,'전체 피해 예고 = 실제 청동강타 / allEnemies / 기력0 / chargeTurns1. 한의울음도 모으기1 후 전체 귀봉50%이며 HP 피해는 없음. 동일 기술명 그대로 재사용.',25,yy+5,1400,16)
 wrapped(d,'HP 구간이 바꾸는 것은 기술 선택 빈도이다. 변신·면역·새 능력치 연출은 없음. 기본/충전/기력/상태 조건을 실제 엔진으로 검사한다.',25,yy,1400,15)
path=OUT/'full-bosses.png';im.save(path);artifacts.append(path)
provenance={'phase':'full','author':'behavior worker; source-bound AI data, probe and visualization code',
 'regenerate':['python3 scripts/content/joseon-folklore/behavior/author-full.py','node scripts/content/joseon-folklore/behavior/run-smoke.mjs','python3 scripts/content/joseon-folklore/behavior/render-review.py'],
 'skillsSource':design['skillSource'],'skillsAreInvented':False,'art':'No new monster drawing/image API. Existing monsters role original sheets read only; native crop + nearest scaling for behavior board.',
 'images':list({p['path']:p for p in usedImages}.values()),
 'inputs':[{'path':p,'sha256':sha(ROOT/p)} for p in ['content-packs/joseon-folklore/CONTRACT.md','content-packs/joseon-folklore/ids.json','src/battle/runtime.ts','src/battle/combatConditions.ts','src/project/databaseEnemyTroopRecordModel.ts']],
 'artifacts':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in [OWN/'data.json',OWN/'design.json',OWN/'skills-source.json',OWN/'monsters-source.json',OWN/'smoke-results.json',*artifacts]]}
(OWN/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
print('saved 3 full review PNGs; real missing sources remain clearly marked; provenance hashes saved')
