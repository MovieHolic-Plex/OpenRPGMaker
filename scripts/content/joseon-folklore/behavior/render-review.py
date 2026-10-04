"""Render real runtime traces beside unmodified repository source cells.
This is a behavior review board, not game artwork or a player screenshot.
"""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[4]
OWN=ROOT/'content-packs/joseon-folklore/behavior'
OUT=ROOT/'public/assets/joseon-folklore/behavior'
DATA=json.loads((OWN/'design.json').read_text())
RESULTS=json.loads((OWN/'smoke-results.json').read_text())
SOURCES=['boar-tusk','goblin-scout','ghost-pale','goblin-brute']
BG=(247,243,234,255);INK=(36,46,54,255)
fontpath='/usr/share/fonts/truetype/nanum/NanumGothic.ttf'
def font(n):return ImageFont.truetype(fontpath,n)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,obj): (OWN/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def timeline(draw,events,x,y,limit=10):
    actions=[]
    for e in events:
        if actions and e['actionId']==actions[-1]['actionId']:continue
        actions.append(e)
    for k,e in enumerate(actions[:limit]):
        xx=x+k*101
        kind=e['kind'];color={'basic':'#e6e0d2','prepare':'#ffe0a6','damage':'#c8dce3'}.get(kind,'#eee8dc')
        label={'basic':'기본','prepare':'예고','damage':'발동'}.get(kind,kind)
        draw.rectangle((xx,y,xx+91,y+59),fill=color,outline='#b8b5a9',width=1)
        draw.text((xx+8,y+6),f"T{e['turn']}",font=font(16),fill=INK)
        draw.text((xx+8,y+29),label,font=font(19),fill=INK)
        if kind=='damage' and e.get('amount') is not None:draw.text((xx+53,y+33),str(e['amount']),font=font(14),fill=INK)
    return actions
W,H=1400,1670
board=Image.new('RGBA',(W,H),BG);draw=ImageDraw.Draw(board)
draw.text((30,22),'조선 설화 · 행동 AI 파일럿 4종',font=font(32),fill=INK)
draw.text((30,67),'실제 엔진 메모리 실행 · 기술은 샘플 fixture · 기존 그림은 참고용 · 게임 화면/신규 몬스터 그림 아님',font=font(18),fill=INK)
draw.text((30,100),'T = 전투 차례 | 예고 = 피해 없음, 다음 자기 차례 발동 | 발동 숫자 = 방어 중 첫 표적 HP 피해',font=font(17),fill=INK)
provenance=[]
for i,pilot in enumerate(DATA['pilot']):
    y=145+i*305
    draw.line((30,y-6,W-30,y-6),fill='#c7c2b5',width=1)
    draw.text((30,y+2),pilot['name']+'  '+pilot['enemyId'],font=font(21),fill=INK)
    asset=ROOT/f'public/assets/generated/pixel-enemies/{SOURCES[i]}.png'
    source=Image.open(asset).convert('RGBA')
    assert source.size==(192,192)
    board.alpha_composite(source,(30,y+45))
    draw.text((30,y+242),'원본 3×3 · native 1배',font=font(16),fill=INK)
    draw.text((30,y+263),'기존 '+SOURCES[i],font=font(14),fill=INK)
    for n,flow in enumerate(['strict','gauge']):
        run=next(r for r in RESULTS['runs'] if r['enemyId']==pilot['enemyId'] and r['flow']==flow and not r['options'])
        draw.text((250,y+42+n*81),flow,font=font(16),fill=INK)
        timeline(draw,run['events'],325,y+32+n*81)
    req=DATA['skillRequirements'][i]
    cond=pilot['cycle'];desc=f"주기 {cond['start']} + {cond['interval']}n / 기술 우선순위 {pilot['conditions'][1]['priority']} / 모으기 {req['chargeTurns']} / 기본 1"
    if i==3:desc+=' / HP ≤40% 우선순위 95'
    draw.text((250,y+199),desc,font=font(17),fill=INK)
    response={
      0:'대응: 예고 중 부상자 회복 또는 방어. 예고 문장은 단일 표적을 알려 주지 않는다.',
      1:'대응: 짝수 주기 직전 방어/회복. 이번 기술에 별도 예고·불 약점·넘어짐 효과 없음.',
      2:'대응: 예고 중 회복/방어. 이번 곡성은 mind 기반 HP 피해이며 공포 상태를 발명하지 않음.',
      3:'대응: 전체 예고 때 파티 방어/회복. 40% 진입 전에 HP 정비; 낮은 HP에서도 예고 유지.'}[i]
    draw.text((250,y+231),response,font=font(17),fill=INK)
    checks=run['damageChecks'];draw.text((250,y+261),f"샘플 무방어 → 방어 피해: {checks[0]['open']} → {checks[0]['guard']} / 원본 L1 HP {checks[0]['level1Hp']}",font=font(17),fill=INK)
    code={'boar-tusk':'organic.py','goblin-scout':'humanoid.py','ghost-pale':'arcane.py','goblin-brute':'humanoid.py'}[SOURCES[i]]
    provenance.append(dict(pilotEnemyId=pilot['enemyId'],purpose='review only; not installed as joseon monster',
      originalPath=str(asset.relative_to(ROOT)),sha256=sha(asset),dimensions=list(source.size),cell=64,
      transform='none; original 192x192 pasted at native size; separate nearest review x2',
      repositoryAuthoringEntry='scripts/asset-gen/pixel-enemy/redraw/'+code,
      licenseNote='existing repository art; no new ownership claim or redistribution outside this repository'))
# A second original-grid board allows nearest-neighbor pose inspection without resampling blur.
zoom=Image.new('RGBA',(1600,475),BG);z=ImageDraw.Draw(zoom)
z.text((20,15),'기존 참고 그림 · 원본 9포즈 · nearest neighbor 2배',font=font(25),fill=INK)
for i,p in enumerate(provenance):
    im=Image.open(ROOT/p['originalPath']).convert('RGBA')
    zoom.alpha_composite(im.resize((384,384),Image.Resampling.NEAREST),(i*400+8,80))
    z.text((i*400+8,55),SOURCES[i],font=font(17),fill=INK)
low=next(r for r in RESULTS['runs'] if r['enemyId']==DATA['pilot'][3]['enemyId'] and r['flow']=='strict' and r['options'].get('hpCross'))
draw.line((30,1372,W-30,1372),fill='#c7c2b5')
draw.text((30,1388),'청동 HP 실제 변화: 플레이어 공격으로 640 → 438 → 236 (36.875%)',font=font(22),fill=INK)
timeline(draw,low['events'],325,1430)
draw.text((30,1505),'HP ≤40%: 주기 밖 T4에도 예고 선택 → T5 전체 발동. 능력치/면역/변신 효과는 없음.',font=font(19),fill=INK)
draw.text((30,1541),'집중 검사 12개: strict/gauge 각 4종 + HP 경계 진입 + 기술 누락 시 기본 공격.',font=font(19),fill=INK)
draw.text((30,1577),'우선순위는 효용과 합산됨. 저HP 마무리·봉인·기력·민첩이 실제 선택/응답 순서를 바꿀 수 있음.',font=font(17),fill=INK)
draw.text((30,1611),'주관 시각 검토와 사용자 승인 별개. 실제 기술/신규 도트/프로젝트 통합 검사는 감독자에게 남아 있음.',font=font(17),fill=INK)
OUT.mkdir(parents=True,exist_ok=True)
board.save(OUT/'pilot-review.png');zoom.save(OUT/'source-poses-nearest.png')
write('provenance.json',dict(author='GPT 6.1 sol high behavior worker (session-assigned role)',
    newWork='4 EnemyActionPattern tables; 15-species outline; focused runtime smoke; trace visualization',
    artGeneration='No image API or new monster drawing. Existing source art shown explicitly as review-only reference.',
    regenerations=['python3 scripts/content/joseon-folklore/behavior/author-pilot.py',
      'node scripts/content/joseon-folklore/behavior/run-smoke.mjs',
      'python3 scripts/content/joseon-folklore/behavior/render-review.py'],
    inputs=[dict(path='content-packs/joseon-folklore/CONTRACT.md',sha256=sha(ROOT/'content-packs/joseon-folklore/CONTRACT.md')),
      dict(path='content-packs/joseon-folklore/ids.json',sha256=sha(ROOT/'content-packs/joseon-folklore/ids.json')),
      dict(path=RESULTS['sourcePath'],sha256=sha(Path(RESULTS['sourcePath']))),
      *[dict(path=p,sha256=sha(ROOT/p)) for p in ['src/battle/runtime.ts','src/battle/combatConditions.ts','src/project/databaseEnemyTroopRecordModel.ts']]],
    sources=provenance,
    artifacts=[dict(path=str(p.relative_to(ROOT)),sha256=sha(p)) for p in [OWN/'data.json',OWN/'design.json',OWN/'smoke-results.json',OUT/'pilot-review.png',OUT/'source-poses-nearest.png']]))
print('saved pilot-review.png, source-poses-nearest.png, provenance.json')
