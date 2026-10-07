"""Repair requests from the review screen: memo -> agent redraw -> the SAME vision gate -> publish.

Deliberately a separate module. queue.py / visual_gate.py / native_author.py are hashed into
visual_gate.files_profile(); editing them invalidates every receipt. This service only edits
seed.json (one candidate entry), adds a new arch:review-<id>-r<n>.png and runs the existing
build/gate/publish stages as subprocesses. Nothing here writes a verdict or a human decision.

A failed repair restores the exact previous seed bytes and rebuilds the old draft, so the old
receipt verifies again and the candidate returns unchanged.
"""
import argparse, json, os, shutil, subprocess, sys, threading, time, traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import queue as review  # local queue.py (same import the review server uses)
from visual_gate import files_profile, ANCHORS

ROOT=review.ROOT;DATA=review.DATA;SEED=review.SOURCE/'seed.json'
ARCH=ROOT/'public/assets/beodeul-architecture'
RECORDS=review.SOURCE/'repairs'
JOBS=DATA/'repairs.json'
WORK=DATA/'repair-work'
CODEX=shutil.which('codex') or os.path.expanduser('~/.local/bin/codex')
MODEL=os.environ.get('BEODEUL_REPAIR_MODEL','gpt-6.1-sol')
EFFORT=os.environ.get('BEODEUL_REPAIR_EFFORT','high')
AGENT_TIMEOUT=int(os.environ.get('BEODEUL_REPAIR_AGENT_TIMEOUT',str(40*60)))
STAGE_TIMEOUT=int(os.environ.get('BEODEUL_REPAIR_STAGE_TIMEOUT',str(90*60)))
MAX_ATTEMPTS=2
JOB_LOCK=threading.RLock();WAKE=threading.Event()
ACTIVE=('queued','authoring','checking','building','gating','publishing')

def now():return time.strftime('%Y-%m-%dT%H:%M:%S%z')
def load_jobs():
    try:return json.loads(JOBS.read_text())
    except (OSError,ValueError):return []
def save_jobs(jobs):review.write_json(JOBS,jobs)
def update(job_id,**fields):
    with JOB_LOCK:
        jobs=load_jobs()
        for j in jobs:
            if j['job']==job_id:j.update(fields,updated=now())
        save_jobs(jobs)
def get(job_id):return next((j for j in load_jobs() if j['job']==job_id),None)

def read_seed():return SEED.read_bytes()
def write_seed(data):
    tmp=SEED.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(SEED)

def palette_pool(current):
    # Colors an honest redraw may use: the candidate itself, the preserved anchors, the city sheet and
    # every approved architecture sheet. A new shader/gradient would introduce colors outside this.
    pool=set(current.getdata())
    for p in [*ANCHORS,ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png',*sorted(ARCH.glob('*.png'))]:
        try:pool.update(Image.open(p).convert('RGBA').getdata())
        except OSError:pass
    return pool

def stage(args,log,env_extra=None):
    with open(log,'a') as out:
        out.write(f'\n$ queue.py {" ".join(args)}  [{now()}]\n');out.flush()
        r=subprocess.run([sys.executable,'-u',str(HERE/'queue.py'),*args],cwd=ROOT,stdout=out,stderr=subprocess.STDOUT,timeout=STAGE_TIMEOUT,env={**os.environ,'BEODEUL_BUILDING_REVIEW_DATA':str(DATA),**(env_extra or {})})
    return r.returncode

def qa_issues(id):
    out=[]
    for name in ['visualqa-rejected.json','visualqa-proof.json']:
        try:d=json.loads((ROOT/'verify-shots/beodeul-building-review'/name).read_text())
        except (OSError,ValueError):continue
        if name=='visualqa-rejected.json' and id in d.get('failed',[]):r=d['reviews'][id];out.append({'role':d.get('stage'),'scores':r['scores'],'issues':r['issues'],'observations':r.get('observations','')})
        for r in d.get('results',[]):
            if r['id']==id and not r['passed']:
                for role in ['texture','structure']:
                    if r[role]['verdict']!='PASS':out.append({'role':role,'scores':r[role]['scores'],'issues':r[role]['issues'],'observations':r[role].get('observations','')})
    return out

PROMPT='''너는 버들항(로마풍 항구 도시) 16px RPG 건물 도트를 고치는 작업자다. 사람이 검수 화면에서 이 건물을 거절하고 아래 메모를 남겼다. 메모를 반영해 건물을 다시 그려라.

## 건물
- id: {id} · 이름: {name} · 용도: {role} · 현재 크기 {w}×{h}px
- 현재 그림: `current.png` (1배), `current-4x.png` (4배 최근접), `scene.png` (원본 집·나무 옆 1배). 첨부 이미지와 같다.
- 현재 시드 항목: `entry.json`

## 사람의 수정 메모 (이것이 이번 작업의 목표다)
{memo}
{feedback}
## 화풍 계약 (어기면 검사에서 떨어진다)
- 원본 버들항 도트를 1:1로 옮겨 조립한다. 원본: `{arch}/*.png`(cream·brick·stone·ochre·church 와 승인된 review-*), 도시 시트 `{root}/public/assets/beodeul-city/beodeul-city-chipset.png` + `{root}/src/assets/beodeulCityTileset.json` 의 structureKits. 불러오기 도우미 `{node}/native_author.py` 의 `native(key)`, 조립 예시 `{node}/author_round7.py`(part/grid/wall).
- 이미지 생성 서비스·절차적 질감·그라데이션·흐림·축소 금지. 원본 사각형을 좌표로 잘라 붙이고, 필요한 곳만 원본 색으로 픽셀을 명시해 고친다. 원본에 없는 색은 쓰지 않는다(검사기가 막는다).
- 3/4 탑뷰: 지붕 윗면과 남쪽 정면이 보인다. 측면은 필수가 아니다. 왼쪽 위 광원.
- 기와·회벽·돌 입자의 밀도와 외곽선 굵기를 원본과 같게. 지붕과 벽 사이가 뜨거나 끊기면 안 된다. 바닥에 닿아야 한다.
- 실제 문은 정확히 하나. 위층 문·뒤채 문·두 번째 나무문 금지. 창은 여러 개 괜찮다. 한 건물 안 벽 재질은 일관되게.
- 크기는 가로·세로 모두 16의 배수, 최대 256. 맨 아래 16px 줄에 건물이 닿아야 한다. 바깥은 완전 투명(알파 0).
- 메모와 관계없는 부분은 지금 그림을 그대로 둔다.

## 할 일 (이 폴더 안에서만 쓴다. 저장소 파일은 읽기만 한다)
1. `author.py` 를 써서 실행해 `candidate.png` 를 만든다(RGBA). 재실행하면 같은 그림이 나와야 한다.
2. `result.json` 을 쓴다: {{"name": 이름(필요하면 변경), "description": 한국어 한두 문장(무엇을 고쳤는지 포함), "silhouette": 짧은 형태 설명, "entrance": {{"x":..,"y":..,"w":16,"h":32}}(문 위치, 그림 안), "changes": "메모를 어떻게 반영했는지"}}
3. `candidate.png` 를 4배로 키워 직접 열어 보고, 위 계약을 스스로 적대적으로 검사한 뒤 끝낸다. 통과했다고 주장하지 말고 무엇을 확인했는지만 적는다.
'''

def prepare(job,attempt,feedback,previous=None):
    work=WORK/f"{job['job']}-a{attempt}";work.mkdir(parents=True,exist_ok=True)
    src=DATA/'items'/job['id']/(job['fromSha']+'.png')
    if not src.exists():raise RuntimeError('원래 그림 파일이 없습니다: '+str(src))
    cur=Image.open(src).convert('RGBA');cur.save(work/'current.png');cur.resize((cur.width*4,cur.height*4),Image.Resampling.NEAREST).save(work/'current-4x.png')
    scene=DATA/'items'/job['id']/(job['fromSha']+'-scene.png')
    if scene.exists():shutil.copyfile(scene,work/'scene.png')
    entry=next(c for c in json.loads(job['seedBefore'])['candidates'] if c['id']==job['id'])
    review.write_json(work/'entry.json',entry)
    if previous and previous.exists():
        prev=Image.open(previous).convert('RGBA');prev.save(work/'previous-attempt.png');prev.resize((prev.width*4,prev.height*4),Image.Resampling.NEAREST).save(work/'previous-attempt-4x.png')
    fb=''
    if feedback:fb='\n## 직전 시도(`previous-attempt.png`, 4배 `previous-attempt-4x.png`)는 떨어졌다. 아래 지적을 모두 고쳐라. 그 그림에서 이어 고쳐도 되고 current.png 에서 다시 시작해도 된다 (좌표는 1배 기준)\n'+json.dumps(feedback,ensure_ascii=False,indent=1)+'\n'
    prompt=PROMPT.format(id=job['id'],name=entry['name'],role=entry.get('role',''),w=cur.width,h=cur.height,memo=job['memo'].strip(),feedback=fb,arch=ARCH,root=ROOT,node=HERE)
    (work/'prompt.md').write_text(prompt)
    return work,cur,entry

def run_agent(job,work):
    images=[f for f in ['current-4x.png','scene.png','previous-attempt-4x.png'] if (work/f).exists()]
    fake=os.environ.get('BEODEUL_REPAIR_AGENT_CMD')  # QA only: a stand-in agent script run inside the work dir
    cmd=[sys.executable,fake] if fake else [CODEX,'exec','-m',MODEL,'-c',f'model_reasoning_effort="{EFFORT}"','--skip-git-repo-check','--ephemeral','-s','workspace-write','-C',str(work)]
    if not fake:
        for i in images:cmd+=['-i',str(work/i)]
        cmd+=['-']
    with open(work/'agent.log','w') as out:
        r=subprocess.run(cmd,input=(work/'prompt.md').read_bytes(),stdout=out,stderr=subprocess.STDOUT,timeout=AGENT_TIMEOUT,cwd=work)
    if r.returncode!=0:raise RuntimeError(f'작업자 실패(exit {r.returncode}) · 로그 {work/"agent.log"}')

def check(work,cur):
    p=work/'candidate.png'
    if not p.exists():raise RuntimeError('작업자가 candidate.png 를 만들지 않았습니다.')
    im=Image.open(p).convert('RGBA')
    if im.width%16 or im.height%16 or not 16<=im.width<=256 or not 16<=im.height<=256:raise RuntimeError(f'크기 계약 위반 {im.size}')
    if im.size==cur.size and im.tobytes()==cur.tobytes():raise RuntimeError('그림이 바뀌지 않았습니다.')
    if any(0<px[3]<255 for px in im.getdata()):raise RuntimeError('반투명 픽셀이 있습니다.')
    pool=palette_pool(cur);bad={px for px in im.getdata() if px[3] and px not in pool}
    if bad:raise RuntimeError(f'원본에 없는 색 {len(bad)}개 (예: {sorted(bad)[:3]})')
    box=im.getbbox()
    if box is None or box[3]<=im.height-16:raise RuntimeError('맨 아래 16px 줄이 비었습니다.')
    try:result=json.loads((work/'result.json').read_text())
    except (OSError,ValueError):raise RuntimeError('result.json 이 없거나 깨졌습니다.')
    e=result.get('entrance') or {}
    if not all(isinstance(e.get(k),int) for k in 'xywh') or e['x']<0 or e['y']<0 or e['x']+e['w']>im.width or e['y']+e['h']>im.height or not im.crop((e['x'],e['y'],e['x']+e['w'],e['y']+e['h'])).getbbox():raise RuntimeError('entrance 가 그림 밖이거나 비었습니다.')
    return im,result

def install(job,attempt,work,im,result,entry):
    rev=1
    while (ARCH/f"review-{job['id']}-r{rev}.png").exists():rev+=1
    key=f"review-{job['id']}-r{rev}";png=ARCH/(key+'.png');im.save(png)
    digest=review.sha(png.read_bytes())
    record=RECORDS/job['id']/f'r{rev}';record.mkdir(parents=True,exist_ok=True)
    for f in ['author.py','result.json','prompt.md']:
        if (work/f).exists():shutil.copyfile(work/f,record/f)
    review.write_json(record/'request.json',{'job':job['job'],'fromSha':job['fromSha'],'memo':job['memo'],'attempt':attempt,'png':str(png.relative_to(ROOT)),'pngSha':digest,'model':MODEL,'effort':EFFORT})
    seed=json.loads(job['seedBefore'])
    for c in seed['candidates']:
        if c['id']!=job['id']:continue
        c.update(width=im.width,height=im.height,authoring='native-parts',components=[{'source':'arch:'+key,'rect':[0,0,im.width,im.height],'at':[0,0],'replace':False}],
                 entrance={k:result['entrance'][k] for k in 'xywh'},nativeAssetHashes={key:digest},source=f'repair/{key}')
        for k in ['name','description','silhouette']:
            if isinstance(result.get(k),str) and result[k].strip():c[k]=result[k].strip()
        c['repairs']=[*c.get('repairs',[]),{'rev':rev,'fromSha':job['fromSha'],'memo':job['memo'],'record':str(record.relative_to(ROOT))}]
    write_seed(seed);return key,png

def revert(job,why):
    try:
        SEED.write_bytes(job['seedBefore'].encode())
        log=job['log'];stage(['build','--only',job['id']],log)
        alive=any(i['id']==job['id'] and i['sha']==job['fromSha'] for i in review.snapshot()['items'])
        update(job['job'],status='failed',message=why+(' · 원래 그림으로 되돌림' if alive else ' · 되돌렸지만 원래 후보가 아직 안 보입니다(로그 확인)'),restored=alive)
    except Exception as e:
        update(job['job'],status='failed',message=f'{why} · 되돌리기 실패: {e}',restored=False)

def process(job):
    profile=files_profile();feedback=None;previous=None
    update(job['job'],seedBefore=read_seed().decode(),started=now());job=get(job['job'])
    for attempt in range(1,MAX_ATTEMPTS+1):
        update(job['job'],status='authoring',attempt=attempt,message=f'메모 반영해 다시 그리는 중 ({attempt}/{MAX_ATTEMPTS})')
        work,cur,entry=prepare(job,attempt,feedback,previous);previous=work/'candidate.png'
        try:
            run_agent(job,work);update(job['job'],status='checking',message='파일 계약 확인 중');im,result=check(work,cur)
        except (RuntimeError,subprocess.TimeoutExpired) as e:
            if attempt<MAX_ATTEMPTS:feedback=[{'role':'contract','issues':[{'code':'CONTRACT','x':0,'y':0,'reason':str(e)}]}];continue
            SEED.write_bytes(job['seedBefore'].encode());update(job['job'],status='failed',message=str(e),restored=True);return
        if files_profile()!=profile:raise RuntimeError('검사 코드가 바뀌었습니다. 중단합니다.')
        key,png=install(job,attempt,work,im,result,entry)
        update(job['job'],status='building',message='초안 굽기',candidateKey=key,changes=result.get('changes',''))
        if stage(['build','--only',job['id']],job['log']) or stage(['validate'],job['log']):revert(job,'초안 굽기/계약 확인 실패');return
        update(job['job'],status='gating',message='독립 Visual QA 검사 중 (수십 분 걸릴 수 있음)')
        if stage(['gate'],job['log'])!=0:
            issues=qa_issues(job['id'])
            if attempt<MAX_ATTEMPTS and issues:feedback=issues;SEED.write_bytes(job['seedBefore'].encode());update(job['job'],lastIssues=issues);continue
            revert(job,'Visual QA 탈락' if issues else 'Visual QA 실행 실패');update(job['job'],lastIssues=issues);return
        update(job['job'],status='publishing',message='공개 중')
        if stage(['publish'],job['log'])!=0:revert(job,'공개 차단');return
        new=next((i for i in review.snapshot()['items'] if i['id']==job['id']),None)
        if not new or new['sha']==job['fromSha']:revert(job,'공개 뒤 새 그림이 보이지 않음');return
        update(job['job'],status='done',newSha=new['sha'],message='검사 통과 · 검수 대기에 올라감',ended=now());return

def worker():
    while True:
        WAKE.wait(5);WAKE.clear()
        with JOB_LOCK:job=next((j for j in load_jobs() if j['status']=='queued'),None)
        if not job:continue
        try:process(job)
        except Exception as e:
            traceback.print_exc();j=get(job['job'])
            if j and j.get('seedBefore'):revert(j,f'오류: {e}')
            else:update(job['job'],status='failed',message=f'오류: {e}')
        WAKE.set()

def recover():
    # A job interrupted by a restart must not leave a half-installed recipe behind.
    for j in load_jobs():
        if j['status'] in ACTIVE and j['status']!='queued':
            if j.get('seedBefore'):revert(j,'서비스 재시작으로 중단')
            else:update(j['job'],status='failed',message='서비스 재시작으로 중단')

def public(j):return {k:v for k,v in j.items() if k not in ('seedBefore',)}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type')
    def js(self,status,data):
        raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.cors()
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_OPTIONS(self):self.send_response(204);self.cors();self.end_headers()
    def do_GET(self):
        if urlsplit(self.path).path=='/api/repairs':return self.js(200,{'jobs':[public(j) for j in load_jobs()][-60:],'model':MODEL})
        return self.js(404,{'error':'not found'})
    def do_POST(self):
        path=urlsplit(self.path).path
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=16384:raise ValueError('요청 크기 오류')
            data=json.loads(self.rfile.read(size))
            if path=='/api/dismiss':
                with JOB_LOCK:
                    jobs=load_jobs();jobs=[j for j in jobs if not (j['job']==data.get('job') and j['status'] not in ACTIVE)];save_jobs(jobs)
                return self.js(200,{'jobs':[public(j) for j in jobs][-60:]})
            if path!='/api/repair':return self.js(404,{'error':'not found'})
            id,sha,memo=data.get('id'),data.get('sha'),data.get('memo','')
            if not isinstance(memo,str) or not memo.strip() or len(memo)>4000:raise ValueError('수정 메모를 적어 주세요.')
            item=next((i for i in review.snapshot()['items'] if i['id']==id),None)
            if not item or item['sha']!=sha:return self.js(409,{'error':'그림이 바뀌었습니다. 새로고침 후 다시 요청해 주세요.'})
            with JOB_LOCK:
                jobs=load_jobs()
                if any(j['id']==id and j['status'] in ACTIVE for j in jobs):return self.js(409,{'error':'이 건물은 이미 수정 중입니다.'})
                job_id=time.strftime('%Y%m%dT%H%M%S')+'-'+id;WORK.mkdir(parents=True,exist_ok=True)
                jobs.append({'job':job_id,'id':id,'name':item['name'],'fromSha':sha,'fromImage':item['image'],'memo':memo.strip(),'status':'queued','message':'대기열','created':now(),'updated':now(),'log':str(WORK/(job_id+'.log'))});save_jobs(jobs)
            WAKE.set();return self.js(200,{'jobs':[public(j) for j in load_jobs()][-60:]})
        except (ValueError,TypeError,json.JSONDecodeError) as e:return self.js(400,{'error':str(e)})

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--port',type=int,default=18322);ap.add_argument('--host',default='0.0.0.0');a=ap.parse_args()
    recover();threading.Thread(target=worker,daemon=True).start()
    print(f'repair service http://mdc-server:{a.port}/api/repairs — jobs {JOBS}',flush=True)
    ThreadingHTTPServer((a.host,a.port),Handler).serve_forever()
if __name__=='__main__':main()
