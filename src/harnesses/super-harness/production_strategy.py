"""Choose a production scope before proposing or assembling keyword spaces."""
import json
from pathlib import Path
import store
import theme_production
import theme_concepts

ROOT=Path(__file__).resolve().parents[3]


def get(sid):return theme_production.read(Path(store.DATA)/'keyword-seeds'/sid/'production-strategy.json')


def validate(value):
    if not isinstance(value,dict) or value.get('mode') not in ('dedicated','extend-kit'):raise ValueError('전용 세계관/기존 키트 확장 제작 방식을 먼저 정해야 합니다.')
    if len(str(value.get('reason','')))<15:raise ValueError('제작 방식 선택 근거가 필요합니다.')
    kits=value.get('kitCandidates',[])
    catalog=json.loads((ROOT/'harness-data/super-harness/seed.json').read_text())
    known={t for w in catalog['worldviews'] for t in w.get('native',[])}
    if not isinstance(kits,list) or any(k not in known for k in kits):raise ValueError('등록된 기존 키트 후보를 제시해야 합니다.')
    if value['mode']=='extend-kit' and (not kits or not value.get('reuse') or not value.get('create')):raise ValueError('기존 키트 확장은 재사용 후보와 부족한 재료 조사 계획이 필요합니다.')
    return value


def apply(sid,value):
    validate(value)
    old=get(sid)
    if old and old!=value:raise ValueError('이미 정한 제작 방식은 공간 추가로 변경하지 않습니다.')
    if value['mode']=='dedicated':
        if not theme_production.read(theme_production.folder(sid)/'policy.json'):theme_production.configure(sid,value['reason'])
        if not (theme_concepts.base(sid)/'concept-required.json').exists():theme_concepts.require(sid)
    theme_production.write(Path(store.DATA)/'keyword-seeds'/sid/'production-strategy.json',value)


def instructions(cid):
    c=store.concept(cid)
    if not c or not str(c.get('source','')).startswith('keyword:'):return ''
    strategy=get(c['source'].split(':',1)[1])
    if not strategy:return ''
    return '\n제작 범위 결정: '+json.dumps(strategy,ensure_ascii=False)+'\n기존 키트 확장은 실제 참고문서와 그림으로 적합성을 조사한 뒤 쓸 수 있는 재료를 유지하고 부족한 재료만 제작한다. kitCandidates는 조사 후보이며 재사용 승인이 아니다. 검수에서 맞지 않으면 구체 이유와 추가 제작 범위를 기록한다.\n'
