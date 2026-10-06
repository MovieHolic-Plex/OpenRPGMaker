from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,argparse,hashlib
p=argparse.ArgumentParser();p.add_argument('--pose',default='idle_a');p.add_argument('monsters',nargs='*');args=p.parse_args()
plan=json.loads(Path('harness-data/battle-monster/fifty-monsters-plan.json').read_text());ids=args.monsters or plan['pilot'];rows=[r for r in plan['roster'] if r['id'] in ids]
font=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf',20);small=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf',14)
auditpath=Path('qa-runs/battle-monster-fifty-wave/batch-audit.json');audit=json.loads(auditpath.read_text()) if auditpath.exists() else {};passed={r['key']:r['binding'] for r in audit.get('items',[]) if r['passed']}
width=432;board=Image.new('RGB',(width*min(3,len(rows)),420*((len(rows)+2)//3)),'#E6E9DF');draw=ImageDraw.Draw(board);human=Image.open('qa-runs/harnesses/battle-monster/wandering-swordsman/eyes-right-v4/preview/suite/portrait.png').convert('RGBA').resize((128,128),Image.Resampling.NEAREST);proof=[]
for i,row in enumerate(rows):
 x=(i%3)*width;y=(i//3)*420;draw.text((x+16,y+44),str(row['cell'])+'px 원본 / '+args.pose,font=small,fill='#53675E')
 candidates=[Path('qa-runs/harnesses/battle-monster')/row['id']/plan['candidate'],Path('qa-runs/battle-monster-fifty-wave/candidates')/row['id']/plan['candidate'],Path('qa-runs/battle-monster-fifty-early-wave/candidates')/row['id']/plan['candidate'],Path('qa-runs/battle-monster-fifty-human-wave/candidates')/row['id']/plan['candidate']];posefolder='poses' if args.pose in ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'] else 'actions';d=next((q for q in candidates if (q/'source'/posefolder/(args.pose+'.pxgrid')).exists()),None)
 if d is None:raise SystemExit("Requested native pose is not written yet: "+row["id"]+"/"+args.pose)
 currentcheck=d/'check-suite.json';binding=json.loads(currentcheck.read_text()).get('binding') if currentcheck.exists() else None;currentpass=bool(binding and passed.get(row['id']+'/'+plan['candidate'])==binding);draw.text((x+16,y+14),row['name']+(' · 현재 통과' if currentpass else ' · 제작 중'),font=font,fill='#2C453D')
 path=d/'source'/('poses' if args.pose in ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'] else 'actions')/(args.pose+'.pxgrid')
 if not path.exists():raise SystemExit("Native pose moved during capture; retry its published source: "+str(path))
 palette=json.loads((d/'source/palette.json').read_text());text=path.read_text();lines=text.splitlines();cell=row['cell'];assert len(lines)==cell and all(len(t)==cell for t in lines)
 colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()};colors['.']=(0,0,0,0);im=Image.new('RGBA',(cell,cell));im.putdata([colors[c] for line in lines for c in line]);im=im.resize((cell*2,cell*2),Image.Resampling.NEAREST);floor=y+350;board.paste(im,(x+12,floor-cell*2),im);board.paste(human,(x+286,floor-128),human)
 count=len(list((d/'source/poses').glob('*.pxgrid')))+len(list((d/'source/actions').glob('*.pxgrid')));draw.text((x+16,y+373),'검객과 동일2배 / 현재 원본 '+str(count)+'/18자세',font=small,fill='#53675E');proof.append({'monster':row['id'],'source':str(path),'sha256':hashlib.sha256(text.encode()).hexdigest(),'cell':cell,'pose':args.pose,'writtenGridCount':count,'currentPackAuditPassed':currentpass,'auditAt':audit.get('at'),'binding':binding,'entireGoalCompleteClaim':False})
root=Path('verify-shots/battle-monster-fifty');root.mkdir(exist_ok=True);name='progress-'+args.pose+'-'+'-'.join(ids);board.save(root/(name+'.png'));(root/(name+'.json')).write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');print(root/(name+'.png'))
