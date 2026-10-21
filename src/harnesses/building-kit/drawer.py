"""building-kit 그리기 — (줄, 후보)마다 새 Opus 프로세스가 판 모듈의 자기 후보 함수만 쓴다.

`draw <테마> <판> --agent [--lines A,B,C] [--jobs N]`

작업 폴더(샌드박스)에 넣는 것: 시드 항목·규칙·잠긴 팔레트 범례({'글자': ('램프', 단)})·버들항 기준 건물 목록(같은 용도,
1배·4배 그림은 사람이 시트에서 본다)·Actor1 크기·그 줄의 화풍 기준 조각(이후 판)·사람이 버린 후보와 이유·이전 독립 검수의
major 사유. 에이전트는 샌드박스의 판 모듈 사본에서 자기 함수 하나만 고치고, `python3 harness.py dry <테마> <판> <후보>` 로
관문·조립을 스스로 돌려 고친다(최대 3회). 그림 파일을 여는 도구는 주지 않는다 — 트레이스 차단(object-gen drawlib 과 같은 규칙).

여러 직업을 동시에 돌리면(--jobs N) 저마다 샌드박스 사본을 쓰고, 끝난 뒤 그 함수 블록만 저장소 판 모듈로 옮긴다
(같은 파일을 여러 프로세스가 동시에 고치지 않는다). 모델 호출은 테스트에서 runner 로 바꿔 끼운다.
"""
import concurrent.futures
import importlib.util
import json
import os
import re
import shlex
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import dot  # noqa: E402

REPO = dot.REPO
DATA = dot.DATA
RUNS = dot.RUNS
SANDBOX = os.environ.get('BUILDING_KIT_DRAWER_DIR') or os.path.join(REPO, 'qa-runs', 'harnesses', 'building-kit', 'drawer')
DEFAULT_TIMEOUT = int(os.environ.get('BUILDING_KIT_DRAWER_TIMEOUT', '3600'))
MODEL = os.environ.get('BUILDING_KIT_DRAWER_MODEL', 'opus')
MAX_ATTEMPTS = 3
BEGIN = '# >>> {name}'
END = '# <<< {name}'
CANDIDATES_HEAD = 'CANDIDATES = {'


def func_name(item, key):
    return 'cand_' + re.sub(r'[^0-9a-zA-Z]+', '_', item).strip('_') + '_' + key


def round_path(theme, rid):
    s = json.load(open(os.path.join(DATA, theme, 'seed.json'), encoding='utf-8'))
    return os.path.join(REPO, s['rounds'][rid]['module'])


def skeleton(theme, rid, seed):
    rd = seed['rounds'][rid]
    items = [it for it in seed['items'] if it['id'] in rd['items']]
    style = rd.get('wave') == 'style'
    keys = [ln for ln in seed['lines']] if style else [f'{ln}{n}' for ln in seed['lines'] for n in (1, 2)]
    head = [
        f'"""building-kit {theme} {rid} 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).',
        '',
        f'{seed["theme"]["name"]} · 화풍 {"판(줄 글자 A·B·C 가 곧 줄)" if style else "판(<줄><번호>)"}.',
        '함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.',
        '"""',
        'import dot',
        '',
        f'ROUND = {rid!r}',
        f'WAVE = {rd.get("wave")!r}',
        'NOTES = {}',
        '',
        '',
    ]
    return '\n'.join(head), items, keys


def ensure_module(theme, rid):
    path = round_path(theme, rid)
    seed = json.load(open(os.path.join(DATA, theme, 'seed.json'), encoding='utf-8'))
    head, items, keys = skeleton(theme, rid, seed)
    text = open(path, encoding='utf-8').read() if os.path.exists(path) else head
    for it in items:
        for key in keys:
            name = func_name(it['id'], key)
            if BEGIN.format(name=name) in text:
                continue
            block = [BEGIN.format(name=name),
                     f'def {name}():',
                     f'    raise NotImplementedError({name!r} + " — 그리기 에이전트가 채운다")',
                     END.format(name=name), '', '']
            text = text.replace(CANDIDATES_HEAD, '\n'.join(block) + CANDIDATES_HEAD, 1) if CANDIDATES_HEAD in text else text + '\n'.join(block)
    lines = [f'    {it["id"]!r}: {{' + ', '.join(f'{k!r}: {func_name(it["id"], k)}' for k in keys) + '},' for it in items]
    body = CANDIDATES_HEAD + '\n' + '\n'.join(lines) + '\n}\n'
    text = re.sub(r'CANDIDATES = \{.*?\n\}\n', body, text, flags=re.S) if CANDIDATES_HEAD in text else text + '\n' + body
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)
    return path


def extract_block(text, name):
    m = re.search(re.escape(BEGIN.format(name=name)) + r'.*?' + re.escape(END.format(name=name)), text, re.S)
    return m.group(0) if m else None


def splice(path, sandbox_text, name):
    cur = open(path, encoding='utf-8').read()
    block = extract_block(sandbox_text, name)
    if not block:
        return False
    old = extract_block(cur, name)
    if old is None:
        return False
    if block == old:
        return False
    open(path, 'w', encoding='utf-8').write(cur.replace(old, block))
    return True


def palette_legend(theme):
    pal = dot.palette(theme)
    out = []
    for name, ramp in pal['ramps'].items():
        out.append(f'  {name:8} ' + ' '.join(f'{i}:{c}' for i, c in enumerate(ramp)))
    return '\n'.join(out)


def references(theme, seed):
    out = []
    for ref in seed.get('refs', []):
        out.append(f'  - {ref["kit"]} — {ref.get("label", "")} ({ref.get("use", "")})')
    for b in seed.get('buildings', []):
        out.append(f'  - 조립 목표 {b["id"]} "{b["title"]}" — {b["cols"]}칸 {b["storeys"]}층, {b["use"]}')
    return '\n'.join(out)


def rejected(theme):
    path = os.path.join(dot.theme_dir(theme), 'ledger.json')
    if not os.path.exists(path):
        return ''
    L = json.load(open(path, encoding='utf-8'))
    rows = [f'  - {r["item"]} 줄 {r["line"]} {r["key"]}: {r["why"]}' for r in L.get('rejects', [])][-12:]
    return '\n'.join(rows)


def review_majors(theme, rid):
    path = os.path.join(RUNS, theme, rid, 'review', 'result.json')
    if not os.path.exists(path):
        return ''
    res = json.load(open(path, encoding='utf-8'))
    rows = []
    for key, v in (res.get('candidates') or {}).items():
        if v.get('verdict') != 'PASS':
            rows.append(f'  - {key}: ' + ' · '.join(v.get('reasons', [])[:3]))
    return '\n'.join(rows)


def brief(theme, rid, seed, item_id, key, line):
    it = next(i for i in seed['items'] if i['id'] == item_id)
    pieces = '\n'.join(
        f'  - 조각 {pc["id"]} ({pc.get("role", "")}) at={pc["at"]} size={pc["size"]} kind={pc["kind"]}'
        + (f' tileable={pc["tileable"]}' if pc.get('tileable') else '')
        for pc in it['pieces'])
    joins = ', '.join('→'.join(j[:2]) + f'({j[2]})' for j in it.get('joins', []))
    return f"""# building-kit 그리기 — {seed['theme']['name']} · 판 {rid} · 후보 {key} · 항목 {item_id}

너는 버들항(beodeul_city)과 같은 계열 oprn-atlas 의 16px 3/4 탑뷰 건물 부품 하나를 코드 도트로 그린다.
사람이 나중에 시트에서 고른다. 생성 이미지·트레이스 금지. 사람(캐릭터)은 그리지 않는다.

## 항목
- {it['title']}
- {it['brief']}
- 받아들일 기준: {' · '.join(it.get('accept', []))}
- 세트 그림 {it['size'][0]}×{it['size'][1]}칸(16px 칸). 조각:
{pieces}
- 세트 이음(맞닿는 조각 쌍): {joins or '없음'}

## 이번 판 규칙
{json.dumps(seed['rules'], ensure_ascii=False, indent=1)}

## 줄 {line}
- 이름: {seed['lines'][line]['name']}
- 화풍: {seed['lines'][line]['concept']}

## 잠긴 팔레트 (글자 → (램프, 단); 단 0 = 가장 어두움)
{palette_legend(theme)}

## 버들항 기준(같은 용도 — 질감·결·색의 기준)
{references(theme, seed)}

## 사람 크기
- Actor1 정상 24×32px — 문은 32~40px 높이, 1층 벽은 2칸(32px).

## 하지 말 것
{rejected(theme) or '  - (아직 없음)'}

## 이전 독립 검수의 major
{review_majors(theme, rid) or '  - (아직 없음)'}

## 쓰는 법
- 샌드박스의 `round_module.py` 에서 **함수 {func_name(item_id, key)} 하나만** 고친다. 다른 함수·CANDIDATES 는 건드리지 않는다.
- 함수는 `dot.grid(rows, legend)` 로만 화소를 찍어 `(cv, meta)` 를 돌려준다. `rows` 는 위→아래 문자열, 글자 하나 = 화소 하나,
  '.' 투명, '~' 그림자(투명한 곳에만). `legend` 는 `dot.legend('{theme}', a=('램프', 단), ...)`.
- 원·다각형 마스크로 본체 만들기, 잡음 채우기, 난수 금지. 반복 무늬 보조는 좌표를 고른 것만.
- 고친 뒤 `python3 {os.path.join(HERE, 'harness.py')} dry {theme} {rid} {key}` 를 돌려 FAIL 코드를 고친다(최대 {MAX_ATTEMPTS}회).
- 그림 파일을 여는 도구는 없다. 행 문자열과 관문 문구만 보고 고친다.
- 끝나면 한 줄로 무엇을 그렸고 무엇이 아직 안 읽히는지 적는다.
"""


def claude_command(sandbox, model=None, effort=None):
    cmd = [shutil.which('claude') or 'claude', '-p', '--output-format', 'text', '--strict-mcp-config',
           '--allowedTools', 'Write,Edit,Bash(python3:*)', '--add-dir', sandbox, '--model', model or MODEL]
    if effort:
        cmd += ['--effort', effort]
    return cmd


def subprocess_runner(cmd, prompt, cwd, timeout):
    r = subprocess.run(cmd, input=prompt, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout or '', r.stderr or ''


def sandbox_for(theme, rid, item_id, key):
    path = os.path.join(SANDBOX, theme, rid, f'{item_id}.{key}')
    os.makedirs(path, exist_ok=True)
    module = round_path(theme, rid)
    shutil.copy(module, os.path.join(path, 'round_module.py'))
    seed = json.load(open(os.path.join(DATA, theme, 'seed.json'), encoding='utf-8'))
    json.dump(seed, open(os.path.join(path, 'seed.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(dot.palette(theme), open(os.path.join(path, 'palette.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return path


def draw_one(theme, rid, item_id, key, runner, cmd, timeout, effort):
    line = key[0]
    sandbox = sandbox_for(theme, rid, item_id, key)
    seed = json.load(open(os.path.join(DATA, theme, 'seed.json'), encoding='utf-8'))
    text = brief(theme, rid, seed, item_id, key, line)
    (open(os.path.join(sandbox, 'BRIEF.md'), 'w', encoding='utf-8')).write(text)
    name = func_name(item_id, key)
    command = cmd or claude_command(sandbox, effort=effort)
    rc, out, err = runner(command, text, sandbox, timeout)
    (open(os.path.join(sandbox, 'drawer.log'), 'w', encoding='utf-8')).write((out or '') + '\n--- stderr\n' + (err or '')[-4000:])
    sandbox_text = open(os.path.join(sandbox, 'round_module.py'), encoding='utf-8').read()
    changed = splice(round_path(theme, rid), sandbox_text, name)
    return {'theme': theme, 'round': rid, 'item': item_id, 'key': key, 'exit': rc, 'changed': changed,
            'sandbox': os.path.relpath(sandbox, REPO), 'tail': (out or '').strip().splitlines()[-3:]}


def run(theme, rid, lines_=None, jobs=1, cmd=None, runner=None, timeout=None, effort=None):
    path = ensure_module(theme, rid)
    seed = json.load(open(os.path.join(DATA, theme, 'seed.json'), encoding='utf-8'))
    rd = seed['rounds'][rid]
    keys = list(lines_ or seed['lines'])
    style = rd.get('wave') == 'style'
    jobs_list = []
    for item_id in rd['items']:
        for key in keys:
            if style:
                jobs_list.append((item_id, key))
            else:
                for n in (1, 2):
                    jobs_list.append((item_id, f'{key}{n}'))
    runner = runner or subprocess_runner
    timeout = timeout or DEFAULT_TIMEOUT
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, int(jobs))) as ex:
        futs = [ex.submit(draw_one, theme, rid, i, k, runner, cmd, timeout, effort) for i, k in jobs_list]
        for f in futs:
            try:
                results.append(f.result())
            except Exception as e:  # noqa: BLE001
                results.append({'error': str(e)})
    for r in results:
        if 'error' in r:
            print(f'  그리기 실패: {r["error"]}')
            continue
        print(f'  {r["item"]:20} {r["key"]:3} exit {r["exit"]} ' + ('함수 갱신' if r['changed'] else '변경 없음') + f' · {r["sandbox"]}')
    print(f'{theme} {rid}: 그리기 {len(results)}건 → {os.path.relpath(path, REPO)}  (다음: gate → review → sheet)')
    return 0 if all(r.get('exit') == 0 and r.get('changed') for r in results) else 1
