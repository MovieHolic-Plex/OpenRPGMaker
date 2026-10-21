"""building-kit 그리기 — 후보 키 하나(화풍 판은 한 줄, 이후 판은 <줄><번호>)마다 새 Opus 프로세스가 그 벌의 **모든 항목**을 그린다.

`draw <테마> <판> --agent [--lines A,B,C] [--jobs N]`

한 줄의 지붕·벽·기단을 서로 다른 에이전트가 그리면 서로 못 보고 조립이 어긋난다 — 그래서 한 에이전트가 한 벌을 다 그린다.
`--jobs` 는 동시에 뜨는 프로세스 수만 제한한다.

샌드박스(작업 폴더)에 넣는 것:
  round_module.py   판 모듈 사본(에이전트는 이번 후보의 함수들만 고친다)
  data/<테마>/      seed.json · palette.json
  refs/             버들항 기준 건물 1배·4배(공용 시트 키트를 시트·검수와 같은 방식으로 합성), Actor1 정면 1배·4배, 팔레트 견본
  dry.py · dry.json 샌드박스 자체 점검(테마·판·후보·모듈·미리보기 폴더). 에이전트는 `python3 dry.py` 로 돌린다
  BRIEF.md          할 일 · 3/4 지붕 지침 · 조립 목표 크기 · 쓰는 법

에이전트는 참고 그림을 Read 로 눈으로만 보고, 고칠 때마다 `python3 dry.py` 로 관문·조립을 돌린 뒤 preview/ PNG 를 다시 연다.
`dot` 에는 그림 파일을 읽는 헬퍼가 없다 — 화소 베끼기(트레이스) 금지. 끝나면 그 후보의 함수 블록만 저장소 판 모듈로 옮긴다
(같은 파일을 여러 프로세스가 동시에 고치지 않는다). 모델 호출은 테스트에서 runner 로 바꿔 끼운다.
"""
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image, ImageDraw  # noqa: E402

import beodeul  # noqa: E402
import dot  # noqa: E402

REPO = dot.REPO
SANDBOX = os.environ.get('BUILDING_KIT_DRAWER_DIR') or os.path.join(REPO, 'qa-runs', 'harnesses', 'building-kit', 'drawer')
DEFAULT_TIMEOUT = int(os.environ.get('BUILDING_KIT_DRAWER_TIMEOUT', '3600'))
MODEL = os.environ.get('BUILDING_KIT_DRAWER_MODEL', 'opus')
MAX_ATTEMPTS = 3
CANDIDATES_PER_LINE = 2
BEGIN = '# >>> {name}'
END = '# <<< {name}'
CANDIDATES_HEAD = 'CANDIDATES = {'

def func_name(item, key):
    return 'cand_' + re.sub(r'[^0-9a-zA-Z]+', '_', item).strip('_') + '_' + key

def round_path(theme, rid):
    s = dot.seed(theme)
    return os.path.join(REPO, s['rounds'][rid]['module'])

def lines_of(seed):
    return [ln for ln, info in seed['lines'].items() if isinstance(info, dict)]

def keys_for(theme, rid, only_lines=None):
    """이번 판의 후보 키 목록 — 화풍 판은 줄 글자 하나씩, 이후 판은 (줄, 번호)마다 하나."""
    seed = dot.seed(theme)
    ls = lines_of(seed)
    if only_lines:
        ls = [ln for ln in ls if ln in only_lines]
    if seed['rounds'][rid].get('wave') == 'style':
        return ls
    return [f'{ln}{n}' for ln in ls for n in range(1, CANDIDATES_PER_LINE + 1)]

def skeleton(theme, rid, seed):
    rd = seed['rounds'][rid]
    items = [it for it in seed['items'] if it['id'] in rd['items']]
    style = rd.get('wave') == 'style'
    keys = keys_for(theme, rid)
    head = [
        f'"""building-kit {theme} {rid} 후보 — 그리기 에이전트가 쓴다(행 문자열 손 도트, 팔레트 램프 글자만).',
        '',
        f'{seed["theme"]["name"]} · 화풍 {"판(줄 글자 A·B·C 가 곧 줄)" if style else "판(<줄><번호>)"}.',
        '한 후보 키의 항목 전부를 같은 에이전트가 그린다. 함수는 (dot.Cv, meta) 를 돌려준다. meta 는 비어 있어도 된다. hex 색 금지.',
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
    seed = dot.seed(theme)
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

def palette_swatch(theme):
    pal = dot.palette(theme)
    block, gap = 10, 2
    rows = list(pal['ramps'].items())
    w = max(len(c) for _, c in rows) * (block + gap) + gap
    h = len(rows) * (block + gap) + gap
    im = Image.new('RGBA', (w, h), (24, 22, 30, 255))
    d = ImageDraw.Draw(im)
    for j, (_, cols) in enumerate(rows):
        for i, c in enumerate(cols):
            x, y = gap + i * (block + gap), gap + j * (block + gap)
            d.rectangle([x, y, x + block - 1, y + block - 1], fill=dot.hx(c) + (255,))
    return im

def write_refs(path, theme, seed):
    d = os.path.join(path, 'refs')
    os.makedirs(d, exist_ok=True)
    for ref in seed.get('refs', []):
        try:
            im = beodeul.kit(ref['kit']).img()
        except SystemExit:
            continue
        im.save(os.path.join(d, f'{ref["kit"]}-1x.png'))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(d, f'{ref["kit"]}-4x.png'))
    act = beodeul.actor1_frame(1, 0, 0)
    act.save(os.path.join(d, 'actor1-front-1x.png'))
    act.resize((act.width * 4, act.height * 4), Image.NEAREST).save(os.path.join(d, 'actor1-front-4x.png'))
    palette_swatch(theme).save(os.path.join(d, 'palette.png'))

def references(theme, seed):
    out = []
    for ref in seed.get('refs', []):
        out.append(f'  - refs/{ref["kit"]}-1x.png · refs/{ref["kit"]}-4x.png — {ref.get("label", "")} ({ref.get("use", "")})')
    out.append('  - refs/actor1-front-1x.png · refs/actor1-front-4x.png — Actor1 정면 24×32(사람 크기 기준)')
    out.append('  - refs/palette.png — 잠긴 팔레트 램프 견본')
    return '\n'.join(out)

def _piece_h(item, role):
    for pc in item['pieces']:
        if pc.get('role') == role:
            return pc['size'][1]
    return 0

def targets(seed):
    items = {it['id']: it for it in seed['items']}
    out = []
    for b in seed.get('buildings', []):
        rh = _piece_h(items[b['roof']], 'l')
        wh = _piece_h(items[b['wall']], 'l')
        bh = _piece_h(items[b['base']], 'l')
        band = items.get(b.get('band') or '')
        band_h = _piece_h(band, 'l') if band else 0
        h = rh + b['storeys'] * wh + max(0, b['storeys'] - 1) * band_h + bh
        out.append(f'  - {b["id"]} "{b.get("title", "")}": {b["cols"]}칸 폭 {b["storeys"]}층 → 조립하면 가로 {b["cols"]}칸 × 세로 {h}칸 '
                   f'(지붕 {rh} + 벽 {wh}×{b["storeys"]} + 기단 {bh})')
    return '\n'.join(out) or '  - (레시피 없음)'

def rejected(theme):
    path = os.path.join(dot.theme_dir(theme), 'ledger.json')
    if not os.path.exists(path):
        return ''
    L = json.load(open(path, encoding='utf-8'))
    rows = [f'  - {r["item"]} 줄 {r["line"]} {r["key"]}: {r["why"]}' for r in L.get('rejects', [])][-12:]
    return '\n'.join(rows)

def review_majors(theme, rid):
    path = os.path.join(dot.RUNS, theme, rid, 'review', 'result.json')
    if not os.path.exists(path):
        return ''
    res = json.load(open(path, encoding='utf-8'))
    rows = []
    for key, v in (res.get('candidates') or {}).items():
        if v.get('verdict') != 'PASS':
            rows.append(f'  - {key}: ' + ' · '.join(v.get('reasons', [])[:3]))
    return '\n'.join(rows)

def item_sections(seed, items):
    out = []
    for it in items:
        pieces = '\n'.join(
            f'  - 조각 {pc["id"]} ({pc.get("role", "")}) at={pc["at"]} size={pc["size"]} kind={pc["kind"]}'
            + (f' tileable={pc["tileable"]}' if pc.get('tileable') else '')
            + (f' inset={pc["inset"]}' if pc.get('inset') else '')
            for pc in it['pieces'])
        joins = ', '.join('→'.join(j[:2]) + f'({j[2]})' for j in it.get('joins', []))
        out.append(f"""### {it['id']} — {it['title']}
- {it['brief']}
- 받아들일 기준: {' · '.join(it.get('accept', []))}
- 세트 그림 {it['size'][0]}×{it['size'][1]}칸(16px 칸). 조각:
{pieces}
- 세트 이음(맞닿는 조각 쌍): {joins or '없음'}""")
    return '\n\n'.join(out)

def brief(theme, rid, seed, key, items, line):
    names = ', '.join(func_name(it['id'], key) for it in items)
    return f"""# building-kit 그리기 — {seed['theme']['name']} · 판 {rid} · 후보 {key} (항목 {len(items)}개)

너는 버들항(beodeul_city)과 같은 계열 oprn-atlas 의 16px 3/4 탑뷰 건물 부품을 코드 도트로 그린다.
이번 작업은 **{key} 한 벌 전체**다 — 아래 항목 전부를 네가 그린다(같은 줄의 지붕·벽·기단이 서로 맞아야 한다).
사람이 나중에 시트에서 고른다. 생성 이미지·트레이스 금지. 사람(캐릭터)은 그리지 않는다.

## 이번에 그릴 항목
{item_sections(seed, items)}

## 3/4 지붕 — 여기서 갈린다
- 박공 지붕을 3/4 탑뷰로 보면 위에서부터: ① 용마루가 위쪽 가까이에 **밝은 선**으로 지나가고
  ② 그 아래 **큰 사면**이 면으로 보이며(2칸 이상) 기와 줄이 가로로 흐르고 ③ 맨 아래 처마 띠는 더 어둡다.
  ④ l·r 끝은 박공 삼각벽 또는 널 끝(끝판)으로 닫힌다.
- 지붕을 한 가지 색·한 가지 무늬의 **평평한 사각형**으로 채우면 벽돌 담으로 읽힌다(실패). 용마루·사면·처마
  세 띠는 밝기와 줄 방향이 서로 달라야 하고, 윗면(용마루+사면)은 처마보다 밝다.
- 지붕 **맨 아래 2행은 칸 경계까지 불투명**하게 찍는다. '~'(반투명 그림자)를 지붕 아래에 쓰면 바닥이 비쳐
  조립했을 때 지붕과 벽 사이가 벌어진다(A2 FAIL). '~' 는 건물 발치 바닥 그림자에만 쓴다.
- 처마(overhang)는 지붕 l·r 조각의 **바깥 2~3px** 에 그린다 — 조립에서 지붕 폭 = 벽 폭(0칸)이다.
  벽 l·r 조각은 바깥 2~3px 을 투명하게 두어(시드 inset) 지붕 처마가 벽보다 튀어나와 보이게 한다.
- 처마 그늘은 벽 조각 **맨 위 1~2행**에 벽 재질의 어두운 단으로 **불투명하게** 찍는다.
- refs/ 의 버들항 기준 건물 지붕과 같은 배율로 견줘라(색·기와 줄 간격·처마 두께).

## 조립 목표 크기 (dry.py 가 이 레시피로 조립해 preview/ 에 보여 준다)
{targets(seed)}

## 줄 {line}
- 이름: {seed['lines'][line]['name']}
- 화풍: {seed['lines'][line]['concept']}

## 잠긴 팔레트 (글자 → (램프, 단); 단 0 = 가장 어두움)
{palette_legend(theme)}

## 샌드박스 그림 — Read 로 열어 본다 (보기·비율용, 화소 베끼기 금지)
{references(theme, seed)}

## 이번 판 규칙
{json.dumps(seed['rules'], ensure_ascii=False, indent=1)}

## 하지 말 것
{rejected(theme) or '  - (아직 없음)'}

## 이전 독립 검수의 major
{review_majors(theme, rid) or '  - (아직 없음)'}

## 쓰는 법
- 샌드박스의 `round_module.py` 에서 **이번 후보 {key} 의 함수 {len(items)}개만** 고친다: {names}.
  다른 후보 함수·CANDIDATES·ROUND/WAVE 는 건드리지 않는다.
- 함수는 `dot.grid(rows, legend)` 로만 화소를 찍어 `(cv, meta)` 를 돌려준다. `rows` 는 위→아래 문자열, 글자 하나 = 화소 하나,
  '.' 투명, '~' 그림자(투명한 곳에만). `legend` 는 `dot.legend('{theme}', a=('램프', 단), ...)`.
- 원·다각형 마스크로 본체 만들기, 잡음 채우기, 난수 금지. 반복 무늬 보조는 좌표를 고른 것만.
- 고칠 때마다 **이 폴더에서 그대로 `python3 dry.py`** 를 실행한다(승인 없이 돈다). FAIL 코드와 문구를 보고 고친다(최대 {MAX_ATTEMPTS}회).
- dry.py 가 `preview/` 에 미리보기를 쓴다: `preview/<항목>.png`(4배) · `preview/<건물>.png`(3배, 버들항 잔디 위) ·
  `preview/compare.png`(내 조립 건물과 버들항 기준 건물을 같은 배율로 나란히).
  **고칠 때마다 preview PNG 를 Read 로 열어** 눈으로 확인하고, **끝내기 전에 `preview/compare.png` 를 반드시 본다**.
- 그림 파일은 보기·비율용이다. Read 로 열어 보되 화소를 베끼지 않는다 — `dot` 에 그림을 읽는 도구는 없다.
- 끝나면 한 줄로 무엇을 그렸고 무엇이 아직 안 읽히는지 적는다.
"""

def claude_command(sandbox, model=None, effort=None):
    cmd = [shutil.which('claude') or 'claude', '-p', '--output-format', 'text', '--strict-mcp-config',
           '--allowedTools', 'Read,Write,Edit,Bash(python3:*)', '--add-dir', sandbox, '--model', model or MODEL]
    if effort:
        cmd += ['--effort', effort]
    return cmd

def subprocess_runner(cmd, prompt, cwd, timeout):
    r = subprocess.run(cmd, input=prompt, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout or '', r.stderr or ''

def sandbox_for(theme, rid, key):
    path = os.path.join(SANDBOX, theme, rid, key)
    os.makedirs(path, exist_ok=True)
    shutil.copy(round_path(theme, rid), os.path.join(path, 'round_module.py'))
    seed = dot.seed(theme)
    data = os.path.join(path, 'data', theme)
    os.makedirs(data, exist_ok=True)
    json.dump(seed, open(os.path.join(data, 'seed.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(dot.palette(theme), open(os.path.join(data, 'palette.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    write_refs(path, theme, seed)
    shutil.copy(os.path.join(HERE, 'dry.py'), os.path.join(path, 'dry.py'))
    out = os.path.join(path, 'preview')
    shutil.rmtree(out, ignore_errors=True)
    json.dump({'theme': theme, 'round': rid, 'key': key, 'module': os.path.join(path, 'round_module.py'),
               'out': out, 'harness': HERE, 'data': os.path.join(path, 'data')},
              open(os.path.join(path, 'dry.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return path

def draw_one(theme, rid, key, runner, cmd, timeout, effort):
    line = key[0]
    seed = dot.seed(theme)
    items = [it for it in seed['items'] if it['id'] in seed['rounds'][rid]['items']]
    sandbox = sandbox_for(theme, rid, key)
    text = brief(theme, rid, seed, key, items, line)
    (open(os.path.join(sandbox, 'BRIEF.md'), 'w', encoding='utf-8')).write(text)
    command = cmd or claude_command(sandbox, effort=effort)
    rc, out, err = runner(command, text, sandbox, timeout)
    (open(os.path.join(sandbox, 'drawer.log'), 'w', encoding='utf-8')).write((out or '') + '\n--- stderr\n' + (err or '')[-4000:])
    sandbox_text = open(os.path.join(sandbox, 'round_module.py'), encoding='utf-8').read()
    changed = [it['id'] for it in items if splice(round_path(theme, rid), sandbox_text, func_name(it['id'], key))]
    return {'theme': theme, 'round': rid, 'key': key, 'exit': rc, 'changed': changed,
            'missing': [it['id'] for it in items if it['id'] not in changed],
            'sandbox': os.path.relpath(sandbox, REPO), 'tail': (out or '').strip().splitlines()[-3:]}

def run(theme, rid, lines_=None, jobs=1, cmd=None, runner=None, timeout=None, effort=None):
    path = ensure_module(theme, rid)
    keys = keys_for(theme, rid, lines_)
    if not keys:
        raise SystemExit(f'{theme} {rid}: 그릴 후보 키가 없다 — --lines 로 줄을 고른다')
    runner = runner or subprocess_runner
    timeout = timeout or DEFAULT_TIMEOUT
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, int(jobs))) as ex:
        futs = [ex.submit(draw_one, theme, rid, k, runner, cmd, timeout, effort) for k in keys]
        for f in futs:
            try:
                results.append(f.result())
            except Exception as e:  # noqa: BLE001
                results.append({'error': str(e)})
    for r in results:
        if 'error' in r:
            print(f'  그리기 실패: {r["error"]}')
            continue
        state = ('함수 갱신 ' + ','.join(r['changed'])) if r['changed'] else '변경 없음'
        if r['missing']:
            state += ' · 안 고침 ' + ','.join(r['missing'])
        print(f'  후보 {r["key"]:3} exit {r["exit"]} {state} · {r["sandbox"]}')
    print(f'{theme} {rid}: 후보 {len(results)}벌 그리기 → {os.path.relpath(path, REPO)}  (다음: gate → review → sheet)')
    return 0 if all(r.get('exit') == 0 and r.get('changed') and not r.get('missing') for r in results) else 1
