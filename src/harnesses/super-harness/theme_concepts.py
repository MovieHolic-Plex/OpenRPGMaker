"""Concept art is a visual proposal, never a tile receipt or an implicit Allow."""
import hashlib
import json
from pathlib import Path
import shutil
import time
import store

CHECKS=('identity','projection','materials','scale')


def base(sid):
    if not isinstance(sid,str) or len(sid)!=20 or any(c not in '0123456789abcdef' for c in sid):raise ValueError('잘못된 시드')
    return Path(store.DATA)/'keyword-seeds'/sid/'theme'


def read(path,default=None):
    return json.loads(path.read_text()) if path.exists() else default


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2));temp.replace(path)


def require(sid):
    write(base(sid)/'concept-required.json',{'required':True})
    request(sid)


def request(sid,feedback=''):
    write(base(sid)/'concept-request.json',{'status':'requested','brief':str(base(sid)/'brief.json'),
         'purpose':'세계관 미술 방향 시안. 완성 타일로 사용하지 않는다.','feedback':feedback,
         'producer':'built-in image_gen','at':store.now()})


def submit(sid,image,prompt):
    root=base(sid);src=Path(image)
    from PIL import Image
    with Image.open(src) as im:
        im.verify()
    old=read(root/'concept-current.json',{})
    for name in ('concept-review.json','concept-decision.json'):
        if old and (root/name).exists():write(root/'concept-art'/f"{old['sha256']}-{name}",read(root/name))
    digest=sha(src);dest=root/'concept-art'/f'{digest}.png';dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,dest)
    value={'path':str(dest.relative_to(store.DATA)),'sha256':digest,'briefSha256':sha(root/'brief.json'),
           'prompt':prompt,'producer':'built-in image_gen','created':store.now()}
    write(root/'concept-art'/f'{digest}.json',value)
    write(root/'concept-current.json',value)
    import provider_retry
    for retry in provider_retry.rows("kind='theme-concept-review' AND tag=? AND status='pending'",(sid,)):
        previous=json.loads(retry['meta']).get('conceptImage',{})
        if previous.get('sha256')!=digest or previous.get('briefSha256')!=value['briefSha256']:
            with store.connect() as db:db.execute("UPDATE provider_retries SET status='cancelled' WHERE id=?",(retry['id'],))
    write(root/'concept-request.json',{'status':'delivered','sha256':digest})
    return value


def snapshot(sid):
    root=base(sid)
    if not read(root/'concept-required.json',{}).get('required'):return {'required':False,'approved':True}
    c=read(root/'concept-current.json',{});path=Path(store.DATA)/c.get('path','missing')
    valid=bool(c and root.resolve() in path.resolve().parents and path.is_file() and sha(path)==c['sha256']
               and (root/'brief.json').is_file() and c.get('briefSha256')==sha(root/'brief.json'))
    r=read(root/'concept-review.json',{});decision=read(root/'concept-decision.json',{})
    reviewed=bool(valid and r.get('sha256')==c['sha256'] and r.get('briefSha256')==c['briefSha256'])
    passed=reviewed and r.get('verdict')=='PASS' and all(r.get('checks',{}).get(k,{}).get('verdict')=='PASS' for k in CHECKS)
    choice=decision.get('decision') if valid and decision.get('sha256')==c['sha256'] and decision.get('briefSha256')==c['briefSha256'] else None
    approved=bool(passed and choice=='allow')
    reviewing=bool(store.jobs("kind='theme-concept-review' AND tag=? AND status='running'",(sid,)))
    label=('컨셉아트 승인 · 전용 칩 제작' if approved else '컨셉아트 수정 요청 전달됨' if choice=='deny' else
           '컨셉아트 검수 반려 · 수정 필요' if reviewed and not passed else '컨셉아트 확인 · Allow / Deny' if passed else
           ('컨셉아트 독립 시각 검수 중' if reviewing else '컨셉아트 독립 시각 검수 대기') if valid else '컨셉아트 생성 요청 · 그림 도착 대기')
    return dict(required=True,approved=approved,label=label,canAllow=bool(passed),decision=choice,
                image={k:c[k] for k in ('path','sha256','briefSha256')} if valid else None,
                reasons=r.get('reasons',[]) if reviewed else [],reviewed=reviewed)


def action(body):
    sid=body['seed'];state=snapshot(sid);c=state.get('image')
    decision=body.get('decision')
    if not c or body.get('sha256')!=c['sha256'] or body.get('briefSha256')!=c['briefSha256'] or decision not in ('allow','deny'):raise ValueError('현재 컨셉아트를 확인해 주세요.')
    if decision=='allow' and not state['canAllow']:raise ValueError('독립 시각 검수가 먼저 필요합니다.')
    value=dict(c,decision=decision,at=store.now())
    write(base(sid)/'concept-decision.json',value)
    write(base(sid)/'concept-art'/f'decision-{time.time_ns()}.json',value)
    if decision=='deny':request(sid,'사용자가 이 시안을 반려했습니다. 기존 시안과 독립 검수 지적을 참고해 다른 방향을 제안합니다.')
    return {'ok':True,'seed':sid}


def tick(sh,sid):
    state=snapshot(sid)
    if not state['required'] or state['approved'] or state.get('reviewed') or not state.get('image') or state.get('decision')=='deny':return
    if store.jobs("kind='theme-concept-review' AND tag=? AND status='running'",(sid,)):return
    if any(m.get('kind')=='theme-concept-review' and m.get('themeSeed')==sid for m in sh.provider_retry.pending_meta()):return
    root=base(sid);candidate=state['image'];output=root/'concept-review.json'
    prompt=f'''실제 컨셉아트의 독립 시각 검수다. 반드시 이미지 {Path(store.DATA)/candidate['path']} 를 이미지 도구로 열어 본다.
공통 미술 기획 {root/'brief.json'} 와 비교하라. 완성 타일이나 게임 데모 검수가 아니라 미술 방향 검수다.
정체성(identity), 3/4 탑뷰·직교 축(projection), 공통 재질/색(materials), 사람 대비 크기(scale)를 판정한다.
후속 native 타일에서 확인할 픽셀 단위 정확성을 이 컨셉 그림에서 검증했다고 주장하지 않는다.
{output} 에 원자적으로 JSON 저장: {{"sha256":"{candidate['sha256']}","briefSha256":"{candidate['briefSha256']}","verdict":"PASS|FAIL","checks":{{각 체크명:{{"verdict":"PASS|FAIL","evidence":"그림에서 확인한 구체 근거"}}}},"reasons":["수정 지적"]}}.
체크 하나라도 FAIL이면 전체 FAIL. 결과를 승인하거나 그림을 수정하지 않는다.'''
    jid=sh.start_codex(None,'theme-concept-review',sid,prompt,str(output))
    sh.PROCS[jid][2].update(themeSeed=sid,conceptImage=candidate)
    write(Path(store.DATA)/'job-invocations'/f'{jid}.json',sh.PROCS[jid][2])


def on_result(meta,code,result):
    root=base(meta['themeSeed']);expected=meta['conceptImage']
    current=read(root/'concept-current.json',{})
    if any(current.get(k)!=expected[k] for k in ('sha256','briefSha256')):
        write(root/'concept-art'/f"{expected['sha256']}-superseded-review.json",result);return
    valid=isinstance(result,dict) and not code and all(result.get(k)==expected[k] for k in ('sha256','briefSha256'))
    if valid:
        checks=result.get('checks',{})
        valid=result.get('verdict') in ('PASS','FAIL') and all(checks.get(k,{}).get('verdict') in ('PASS','FAIL') and len(str(checks[k].get('evidence','')))>12 for k in CHECKS)
        if result.get('verdict')=='PASS':valid=valid and all(checks[k]['verdict']=='PASS' for k in CHECKS)
    if not valid:
        result=dict(expected,verdict='FAIL',checks={},reasons=['컨셉아트 검수 결과 형식 또는 근거 오류'])
    write(root/'concept-review.json',result)
    if result['verdict']=='FAIL':request(meta['themeSeed'],'; '.join(map(str,result.get('reasons',[]))))
