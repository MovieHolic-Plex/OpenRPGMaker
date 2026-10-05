"""Theme-owned art direction and fail-closed dedicated asset coverage."""
import hashlib
import json
import re
from pathlib import Path
import time
import store

FAMILIES = ['architecture','surfaces','furniture','nature','characters','creatures','vehicles','effects']
CHECKS = ['identity','coverage','consistency','production']


def read(path, default=None):
    try:return json.loads(Path(path).read_text())
    except FileNotFoundError:return default


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def token(value):return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def folder(sid):return Path(store.DATA)/'keyword-seeds'/sid/'theme'


def write(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2));tmp.replace(path)


def policy(cid):
    c=store.concept(cid)
    if not c or not str(c.get('source','')).startswith('keyword:'):return None
    sid=c['source'].split(':',1)[1]
    return read(folder(sid)/'policy.json')


def configure(sid, reason):
    with store.connect() as db:
        seed=db.execute('SELECT keyword FROM keyword_seeds WHERE id=?',(sid,)).fetchone()
    if not seed:raise ValueError('기존 키워드가 필요합니다.')
    value=dict(version=1,seed=sid,keyword=seed[0],mode='dedicated',packId='theme-'+sid,
               families=FAMILIES,reuseExceptions=[],reason=reason,
               rules=['거의 모든 시각 세트를 테마 전용으로 새로 제작한다.',
                      '세계관 시대 분류는 기술 라우팅일 뿐 시각적 대체 허가가 아니다.',
                      '기존 엔진·렌더러·하네스는 재사용하되 기존 그림·팔레트는 자동 채택하지 않는다.',
                      '건축·표면·가구·식생·인물·생물·탈것·효과를 하나의 공통 미술 기준으로 묶는다.',
                      '기존 자산은 운영자가 기록한 개별 해시 예외 승인만 재사용한다.',
                      '핵심 재료가 없으면 공간 조립을 시작하지 않는다.'])
    if read(folder(sid)/'policy.json')!=value:write(folder(sid)/'state.json',{})
    write(folder(sid)/'policy.json',value)
    store.log(None,'테마 전용 제작 정책: '+seed[0])
    return value


def context(cid):
    p=policy(cid)
    if not p:return None
    base=folder(p['seed']);brief=read(base/'brief.json');review=read(base/'review.json',{})
    state=read(base/'state.json',{})
    valid=bool(state.get('stage')=='ready' and brief and brief.get('policyHash')==token(p)
               and cid in {s['concept'] for s in brief.get('spaces',[])}
               and review.get('briefSha256')==sha(base/'brief.json') and review.get('verdict')=='PASS'
               and all(review.get('checks',{}).get(k,{}).get('verdict')=='PASS' for k in CHECKS))
    return dict(policy=p,policyHash=token(p),briefPath=str(base/'brief.json'),ready=valid,
                briefSha256=sha(base/'brief.json') if valid else None,
                label='전용 세트 공통 미술 기획·검수 중' if not valid else '전용 세트 제작 · 기존 그림 자동 대체 금지')


def ensure(c):
    ctx=context(c['id'])
    if not ctx or c['stage'] in ('done','discarded'):return True
    if store.jobs("concept=? AND status='running'",(c['id'],)):return False
    marker=Path(store.DATA)/'concepts'/c['id']/'theme-applied.json'
    if not ctx['ready']:
        if c['stage']!='theme-wait':store.update_concept(c['id'],stage='theme-wait',status='queued',note=ctx['label'])
        return False
    binding={k:ctx[k] for k in ('policyHash','briefSha256')}
    if read(marker)!=binding or c['stage']=='theme-wait':
        write(marker,binding)
        # Old images, decisions and quality revision counts remain as history.
        store.update_concept(c['id'],stage='plan',status='queued',note='공통 미술 기준 승인 · 전용 세트 기준으로 공간 재기획',reasons=[])
    return True


def require_binding(cid, document):
    ctx=context(cid)
    if not ctx:return
    if not ctx['ready'] or any((document.get('theme') or {}).get(k)!=ctx[k] for k in ('policyHash','briefSha256')):
        raise ValueError('현재 테마 공통 미술 기준에 연결된 결과가 필요합니다.')


def require_plan(cid, document):
    ctx=context(cid)
    if not ctx:return
    require_binding(cid,document)
    brief=read(ctx['briefPath'])
    identity=next(s['identityAssets'] for s in brief['spaces'] if s['concept']==cid)
    for variant in document.get('variants',[]):
        mapping=variant.get('themeIdentityAssets',{})
        ids={r['id'] for r in variant.get('requirements',[])}
        if set(mapping)!=set(identity) or any(not isinstance(refs,list) or not refs or not set(refs)<=ids for refs in mapping.values()):
            raise ValueError('공통 테마 기획의 정체성 재료를 모든 공간 변형에 포함해야 합니다.')


def instructions(cid):
    ctx=context(cid)
    if not ctx:return ''
    feedback=read(Path(store.DATA)/'concepts'/cid/'theme-material-feedback.json',{})
    return '\n이전 전용 재료 보완 지시: '+json.dumps(feedback,ensure_ascii=False)+'\n\n## 테마 전용 세트 계약(현재 사용자 지시)\n'+json.dumps(ctx,ensure_ascii=False)+'\n공통 briefPath를 읽어 같은 팔레트·재질·건축 문법을 쓴다. 기존 그림/팔레트 자동 차용은 금지한다.\n결과 JSON.theme={policyHash,briefSha256}은 위 현재 값과 같아야 한다. 이전 산출물은 승인 근거가 아니다.\n기획 variants[].themeIdentityAssets는 brief.spaces 중 이 공간의 identityAssets 문구를 키로,\n해당 변형의 requirements id 배열을 값으로 모두 연결한다. 바닥·벽·가구뿐 아니라 핵심 생물·탈것도 빠뜨리지 않는다.\n재료 조사 variants[].tilesetId는 policy.packId다. 아직 없는 전용 팩은 available:false로 보고한다.\n기존 시대별 native 타일 목록은 기술 분류이며 이 테마의 기존 그림 사용 승인이 아니다.\n제작은 각 전문 하네스로 한다. 미지원 품목은 구현 필요로 명시하며 기존 그림으로 대체하거나 누락하지 않는다.\nart-result.json.themeCoverage는 planning.json의 모든 requirements id를 키로 실제 제작한 native 후보 PNG\n{path,sha256} 배열을 값으로 연결한다. PNG는 후보 receipt의 sheet/candidateImages와 일치해야 한다.\n전체 장면 PNG·참고 그림·기존 stock PNG를 새로 제작한 원본 칩이라고 쓰지 않는다.\n부족하면 정확한 누락 목록과 재제작 지시를 남긴다. 조립 단계는 이 coverage가 완전해야 실행된다.\n기획/재료/시각 검수자는 이름만 대응시킨 가짜 연결과 핵심 품목 누락을 반려한다.\n'


def current(cid, meta):
    ctx=context(cid)
    return not ctx or (ctx['ready'] and meta.get('themePolicyHash')==ctx['policyHash'] and meta.get('themeBriefSha256')==ctx['briefSha256'])


def tick(sh, ids, slots):
    policies={p['seed']:p for cid in ids if (p:=policy(cid))}
    for sid,p in policies.items():
        children=[store.concept(cid) for cid in ids if (policy(cid) or {}).get('seed')==sid and store.concept(cid)['stage']!='discarded']
        if not children or all(context(c['id'])['ready'] for c in children):continue
        jobs=store.jobs("status='running'")
        if len(jobs)>=int(store.setting('max_codex')):return
        if any(j['kind'] not in ('theme-plan','theme-review','plan','plan-review','survey','material-review','art','art-native','art-demo','art-layout-review','art-context-review','seed-discover') for j in jobs):return
        if any(j['kind'] in ('theme-plan','theme-review') and j['tag']==sid for j in jobs):continue
        if any(m.get('themeSeed')==sid for m in sh.provider_retry.pending_meta()):continue
        base=folder(sid);state=read(base/'state.json',{})
        if state.get('retryAt',0)>time.time() or state.get('attempt',0)>=int(store.setting('max_art_revisions') or 10):continue
        brief=read(base/'brief.json');review=read(base/'review.json',{})
        plan_needed=not brief or brief.get('policyHash')!=token(p) or review.get('verdict')=='FAIL' or not {c['id'] for c in children}<={x['concept'] for x in (brief or {}).get('spaces',[])}
        kind='theme-plan' if plan_needed else 'theme-review';out=base/('brief.json' if plan_needed else 'review.json')
        prompt=f'''테마 전용 공용 아트 팩의 {'미술 기획' if plan_needed else '독립 적대적 검수'}다. 코드·그림·프로젝트를 만들지 않는다.
정책: {json.dumps(p,ensure_ascii=False)}
현재 정책 해시: {token(p)}
공간 목록: {json.dumps([{'id':c['id'],'title':c['title']} for c in children],ensure_ascii=False)}
기존 산출물은 비교용 실패 기록이다. 일반 중세 타일이나 v5/modern4 팔레트를 정답으로 상속하지 않는다.
하나의 전용 세트에 사용할 팔레트(실제 hex), 재질/윤곽, 3/4 탑뷰(윗면+정면), 16px 칸과 사람 기준,
건축 문법, 실내외 접합·문 상태, 인물·생물·탈것, 공유 품목과 장소 전용 품목을 정의한다.
각 공간의 정체성 필수 재료를 모두 쓰고 하네스가 미지원이면 구현할 제작 경로를 명시한다.
그림이 없는 것을 완성/사용자 승인으로 쓰지 않는다. 다음은 native 표본 제작과 실제 그림 검수다.
결과는 임시 파일을 쓴 뒤 rename으로 원자적으로 저장: {out}
'''
        if plan_needed:
            prompt+='정확한 JSON: {"version":1,"policyHash":"위 해시","artDirection":{"palette":["#hex"],"projection":"...","scale":"...","materials":"...","architecture":"...","avoid":["..."]},"families":[{"id":"정책의 각 family","visualRules":["..."],"assets":["구체 품목"],"production":"기존 native 하네스 활용/필요 확장"}],"spaces":[{"concept":"공간 id","identityAssets":["공간 정체성 필수 재료"]}]}\n모든 family와 현재 공간을 빠짐없이 포함한다. 필요 없는 family라도 빠뜨리지 말고 적용 범위를 쓴다.\n이전 독립 반려: '+json.dumps(review,ensure_ascii=False)
        else:
            prompt+=f'읽을 기획: {base/"brief.json"}\n현재 기획 SHA256: {sha(base/"brief.json")}\n'
            prompt+='JSON: {"briefSha256":"위 해시","verdict":"PASS|FAIL","checks":{'+','.join('"'+k+'":{"verdict":"PASS|FAIL","evidence":"구체 근거"}' for k in CHECKS)+'},"reasons":["..."],"fixes":["..."]}. 전용 정체성, 전체 재료군/공간 누락, 공유 일관성, 실행 가능한 제작 경로를 엄격히 본다. 기획 합격은 그림 합격이 아니다.'
        if brief and review.get('verdict')=='PASS':
            prompt+='\n기존 승인 미술 기준은 유지하고 새 공간의 제작 목록만 확장한다: '+json.dumps(brief,ensure_ascii=False)
        if out.exists():write(base/'history'/f'{time.time_ns()}-{out.name}',read(out));out.unlink()
        jid=sh.start_codex(None,kind,sid,prompt,str(out))
        sh.PROCS[jid][2].update(themeSeed=sid,themePolicyHash=token(p),themeConcepts=[c['id'] for c in children])
        if brief and review.get('verdict')=='PASS':sh.PROCS[jid][2]['frozenDirection']=brief['artDirection']
        write(Path(store.DATA)/'job-invocations'/f'{jid}.json',sh.PROCS[jid][2])
        write(base/'state.json',dict(state,stage=kind,job=jid))
        return


def on_result(meta, code, result):
    base=folder(meta['themeSeed']);p=read(base/'policy.json');state=read(base/'state.json',{})
    if token(p)!=meta['themePolicyHash']:return
    try:
        if code or not isinstance(result,dict):raise ValueError('테마 작업 결과 없음')
        if meta['kind']=='theme-plan':
            if result.get('policyHash')!=token(p):raise ValueError('테마 정책 해시 불일치')
            if {f['id'] for f in result.get('families',[])}!=set(FAMILIES):raise ValueError('전용 재료군 누락')
            if {c['concept'] for c in result.get('spaces',[])}!=set(meta['themeConcepts']):raise ValueError('공간별 정체성 목록 누락')
            direction=result['artDirection']
            if meta.get('frozenDirection') and direction!=meta['frozenDirection']:raise ValueError('승인된 공통 미술 기준 변경 금지')
            if any(not f.get('assets') or not f.get('visualRules') or not f.get('production') for f in result['families']):raise ValueError('재료군 제작 계획 누락')
            if any(not c.get('identityAssets') for c in result['spaces']):raise ValueError('공간 정체성 재료 누락')
            if any(not isinstance(color,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',color) for color in direction.get('palette',[])):raise ValueError('실제 hex 팔레트 필요')
            if not direction.get('palette') or any(not direction.get(k) for k in ('projection','scale','materials','architecture','avoid')):raise ValueError('공통 미술 기준 누락')
            write(base/'review.json',{})
        else:
            if result.get('briefSha256')!=sha(base/'brief.json') or result.get('verdict') not in ('PASS','FAIL'):raise ValueError('테마 기획 검수 형식/해시 오류')
            checks=result.get('checks',{})
            if any(checks.get(k,{}).get('verdict') not in ('PASS','FAIL') or len(str(checks[k].get('evidence','')))<12 for k in CHECKS):raise ValueError('테마 적대적 검수 근거 누락')
            if result['verdict']=='PASS' and any(checks[k]['verdict']!='PASS' for k in CHECKS):raise ValueError('테마 검수 판정 충돌')
            if result['verdict']=='FAIL':state['attempt']=state.get('attempt',0)+1
        write(base/('brief.json' if meta['kind']=='theme-plan' else 'review.json'),result)
        write(base/'state.json',dict(state,stage='ready' if result.get('verdict')=='PASS' else 'queued',error='',retryAt=0))
    except (KeyError,ValueError,TypeError) as error:
        target=base/('brief.json' if meta['kind']=='theme-plan' else 'review.json')
        if target.exists():target.rename(base/f'invalid-{time.time_ns()}-{target.name}')
        write(base/'state.json',dict(state,stage='error',error=str(error),attempt=state.get('attempt',0)+1,retryAt=time.time()+120))
        store.log(None,'테마 제작 입력 재확인: '+str(error))


def demo_sources(cid, result, components):
    """Every planned material must map to real native candidate pixels."""
    ctx=context(cid)
    if not ctx:return None
    require_binding(cid,result)
    plan=read(Path(store.DATA)/'concepts'/cid/'planning.json',{})
    require_plan(cid,plan)
    required={r['id'] for v in plan.get('variants',[]) for r in v.get('requirements',[])}
    authored={(r['path'],r['sha256']) for g in components['groups'] for c in g['candidates']
              for r in [c['sheet'],*c['sources']] if r['path'].lower().endswith('.png')
              and ('/pick/candidates/' in r['path'] or re.search(r'^qa-runs/[^/]+/[A-E]\.png$',r['path']))}
    exceptions={(r['path'],r['sha256']) for r in ctx['policy']['reuseExceptions']}
    refs_allowed=authored|exceptions
    allowed={digest for path,digest in refs_allowed}
    coverage=result.get('themeCoverage',{})
    if not required or set(coverage)!=required:raise ValueError('전용 세트 필수 재료가 모두 제작되지 않았습니다. 조립보다 재료 제작이 먼저입니다.')
    for rid,refs in coverage.items():
        if not isinstance(refs,list) or not refs or any((r.get('path'),r.get('sha256')) not in refs_allowed for r in refs):raise ValueError('전용 재료의 native 후보 근거 누락: '+rid)
    return allowed
