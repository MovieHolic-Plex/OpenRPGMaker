#!/usr/bin/env python3
"""캐릭터 칩 하네스 — Actor1 을 뼈대로, AI 가 픽셀을 직접 찍어 RM2000 캐릭터(72×128, 3프레임×4방향)를 만든다.

  python3 src/harnesses/charset-actor/harness.py calibrate              # 기계 검수가 Actor1 8명을 전부 통과시키는지
  python3 src/harnesses/charset-actor/harness.py base 0 out.chr.txt      # Actor1 n번째 캐릭터를 격자 글자로
  python3 src/harnesses/charset-actor/harness.py check F.chr.txt [--base 0]         # 기계 검수(JSON)
  python3 src/harnesses/charset-actor/harness.py views F.chr.txt OUTDIR [--base 0]  # 8배 시트·필름 띠·GIF 3종
  python3 src/harnesses/charset-actor/harness.py draw <brief> --engine sonnet|gpt [--run R]   # 작업자 띄우기(백그라운드)
  python3 src/harnesses/charset-actor/harness.py status [--run R]
  python3 src/harnesses/charset-actor/harness.py page --run R            # 비교 화면 → ~/claude-viz/charset-actor-<R>.html

생성 이미지 금지: 작업자는 격자 글자(.chr.txt)를 직접 고친다. 그림 생성 모델·외부 그림 변환은 쓰지 않는다.
감독은 고르지 않는다 — 후보를 나란히 보여 주고 사용자가 판정한다.
"""
import argparse
import base64
import html
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
from PIL import Image  # noqa: E402

RTP = ROOT / 'public' / 'assets' / 'easyrpg'
ACTOR1 = RTP / 'charset' / 'Actor1.png'
GRAPHICS = ROOT / 'src' / 'assets' / 'sharedCharacterGraphics.json'   # 칩 ↔ 얼굴 짝 정본
BASE_SHEETS = ('Actor1', 'Actor2', 'Actor3', 'Actor4', 'People1', 'People2', 'People3', 'People4', 'People5')
HDATA = ROOT / 'harness-data' / 'charset-actor'
LAWN = HDATA / 'lawn16.png'
DATA = Path(os.environ.get('CHR_HARNESS_DATA', os.path.expanduser('~/.local/share/oprn/charset-actor-harness')))
VIZ = Path(os.path.expanduser('~/claude-viz'))
ENGINES = {
    'sonnet': dict(label='Claude Sonnet 5.5 · medium', model='claude-sonnet-5-5', effort='medium'),
    'gpt': dict(label='GPT 6.1 sol · high', model='gpt-6.1-sol', effort='high'),
    'opus': dict(label='Claude Opus 5.5 · high', model='claude-opus-5-5', effort='high'),
}
CLAUDE_ENGINES = ('sonnet', 'opus')
DEFAULT_KEEP = ('몸 비율·머리 크기·팔다리 위치·걸음 동작(다리 모양과 1px 출렁임)은 뼈대 그대로 둔다. 무엇을 얼마나 바꾸는지는 '
                '아래 6번(수정 강도)을 따른다.')

# 수정 강도별 작업자 규칙(worker.md 의 {STRENGTH_RULES}). 기계 기준은 chr.STRENGTH.
STRENGTH_RULES = {
    'weak': '''**강도 「약함」 — 같은 사람, 다른 색.** 원래 그림의 모양은 그대로 두고 **색만** 바꾼다.
   - 바꾸는 것: 머리색·옷 색·피부 톤·눈 색, 옷 안쪽의 작은 무늬(띠·단추·줄 1~2개, 옷 색 나누기). 색의 명암 단계는 원래대로 옮긴다.
   - 하지 않는 것: 머리 모양·옷 모양·소지품을 바꾸거나 더하기. **바깥 윤곽(실루엣)은 한 픽셀도 바꾸지 않는 것이 목표**다.
   기계 검사: 뼈대 실루엣과 다른 픽셀이 12프레임 합 30 을 넘거나, 뼈대 밖으로 튀어나온 픽셀이 하나라도 있으면 불합격.''',
    'normal': '''**강도 「보통」 — 「색만 바꾼 같은 사람」이 아니라 「다른 사람」으로 보여야 한다**(2026-10-02 사용자: 「너무 비슷하다, 약간 더 바꾸되」). 바꿔도 되는 것:
   - **머리 모양**: 길이·앞머리·묶음·곱슬·숱. 머리 둘레 2px 안에서 실루엣이 바뀌어도 된다.
   - **옷의 모양과 무늬**: 깃·소매 길이·조끼/망토 자락의 안쪽 선·줄무늬·체크·띠·단추·주머니·옷 색 나누기.
   - 피부 톤, 눈 색, 수염, 얼굴 디테일(주근깨·볼).
   **하지 않는 것:** 무기·모자·두건·들고 있는 물건·날개·지팡이·가방처럼 **몸 밖으로 튀어나오는 새 소지품**(2026-10-02 사용자: 「무기나 모자 추가는 별로」).
   기계 검사가 뼈대 실루엣을 2px 넓힌 밖으로 튀어나온 픽셀을 세서, 프레임당 10·전체 60 을 넘으면 불합격이다. 뼈대에 원래 있던 소지품은 두고 색만 바꿔도 된다.
   - 원래 쓰고 있던 투구·두건·모자는 새로 더한 것이 아니므로 **모양을 바꿔도 된다**(둘레 2px 안 — 투구 → 다른 모양 투구·두건·상투).
   **색만 바꾸면 불합격이다**: 색 바꾸기로 설명되지 않는 픽셀(모양을 새로 찍은 픽셀)이 15 % 이상이어야 한다(2026-10-03 「보통」 작업자가 팔레트만 바꾸고 1분 만에 끝냈고, 다시 시켜도 11 % 로 색만 바꾼 것처럼 보였다).
   그러니 **네 방향 모두에서** 머리(또는 쓰개) 모양과 옷의 모양 하나 이상을 픽셀로 다시 찍는다.''',
    'strong': '''**강도 「강함」 — 원본을 알아보기 어려울 만큼 다른 캐릭터로.** 몸 비율·머리 크기·팔다리 위치·걸음은 그대로 두고 그 위를 크게 바꾼다:
   - **머리 모양을 확실히** 바꾼다(짧은 머리 ↔ 긴 머리·묶음·땋은 머리·앞머리). 머리 둘레 3px 까지 실루엣이 바뀌어도 된다.
   - **옷의 형태**를 바꾼다: 갑옷 ↔ 천옷, 소매·깃·치마/바지 자락, 망토·목도리 자락, 옷 색 나누기. 원래 옷과 다른 직업으로 읽혀도 된다.
   - 작은 장신구(머리띠·리본·깃털 하나·귀걸이·목걸이·허리띠 주머니)는 실루엣 밖으로 조금 나와도 된다.
   - 원본에 있던 소지품(창·검·투구 장식)은 지워도 되고 색만 바꿔도 된다.
   **하지 않는 것:** 큰 무기·방패·날개·지팡이·가방·높은 모자처럼 몸에서 크게 튀어나오는 새 소지품.
   **원본 소지품을 지울 거면 네 방향 모두에서 한 픽셀도 남기지 않는다** — 남은 칼끝·창 조각이 허공에 뜬다(2026-10-03 첫 「강함」).
   남길 거면 손에 붙은 그대로 둔다. **옆모습·뒷모습도 정면만큼 다시 칠한다** — 원래 옷의 무늬(갑옷 체크 등)가 옆모습에 남으면
   다른 옷으로 읽힌다. 정면만 바꾸고 옆모습을 덜 고치는 것이 가장 흔한 실패다.
   기계 검사: 뼈대 실루엣을 2px 넓힌 밖으로 튀어나온 픽셀이 프레임당 20·전체 160 을 넘으면 불합격. 원본과 30 % 넘게 달라야 하고,
   색 바꾸기로 설명되지 않는 픽셀(모양을 새로 찍은 픽셀)이 25 % 이상이어야 한다.''',
}
NO_BRIEF = ('(지시 없음 — 위 강도 안에서 네가 새 캐릭터를 정한다. 어떤 사람인지(직업·나이·성격이 옷과 색에 드러나게) 먼저 정하고 '
            'notes.md 첫 줄에 쓴다.)')

TIMEOUT_S = int(os.environ.get('CHR_HARNESS_TIMEOUT', str(60 * 60)))


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def write_json_atomic(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            json.dump(value, out, ensure_ascii=False, indent=2)
            out.write('\n')
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        if Path(tmp).exists():
            Path(tmp).unlink()


@contextmanager
def run_lock(root):
    import fcntl
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.production.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError(f'이 실행은 이미 저작/내보내기 중입니다: {root.name}') from None
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


LOCAL_BRIEFS = DATA / 'briefs-local.json'   # 화면에서 올린 그림으로 만든 지시(저장소 밖 — 남의 그림일 수 있다)
INPUTS = DATA / 'inputs'                     # 올린 칩 그림(배경 키 색으로 정규화한 288×256)


def briefs():
    b = json.loads((HDATA / 'briefs.json').read_text(encoding='utf-8'))
    if LOCAL_BRIEFS.exists():
        b.update(json.loads(LOCAL_BRIEFS.read_text(encoding='utf-8')))
    return b


def strength_of(brief_name):
    return (briefs().get(brief_name) or {}).get('strength', 'normal')


def norm_base(x):
    """뼈대 키 → 'Actor2:3' 또는 'input:<id>:<칸>'(화면에서 올린 그림). 옛 지시·기록의 정수는 Actor1 번호다."""
    if isinstance(x, int) or (isinstance(x, str) and x.isdigit()):
        return f'Actor1:{int(x)}'
    if str(x).startswith('input:'):
        _, iid, n = str(x).split(':')
        if not (INPUTS / f'{iid}.png').exists():
            raise SystemExit(f'올린 그림 {iid} 이 없다({INPUTS})')
        return f'input:{iid}:{int(n)}'
    sheet, n = str(x).split(':')
    if sheet not in BASE_SHEETS:
        raise SystemExit(f'뼈대 칩셋 {sheet!r} 은 {BASE_SHEETS} 중 하나여야 한다')
    return f'{sheet}:{int(n)}'


def base_sheet(key):
    k = norm_base(key)
    if k.startswith('input:'):
        _, iid, n = k.split(':')
        return INPUTS / f'{iid}.png', int(n)
    sheet, n = k.split(':')
    return RTP / 'charset' / f'{sheet}.png', int(n)


def base_label(key):
    k = norm_base(key)
    if k.startswith('input:'):
        _, iid, n = k.split(':')
        return f'올린 그림 {iid} {int(n) + 1}번'
    sheet, n = k.split(':')
    return f'{sheet} {int(n) + 1}번'


def base_of(key):
    png, n = base_sheet(key)
    pal, _, frames = C.from_actor(png, n)
    return pal, frames


def face_ref(key):
    """칩 뼈대의 짝 얼굴 → (FaceSet png, 번호) 또는 None. 정본 sharedCharacterGraphics.json 에서 RTP 얼굴(easyrpg-faceset-*)만 쓴다
    — 생성 얼굴(generated-faceset-*)이 짝인 칩과 올린 그림은 얼굴 뼈대가 없다."""
    if norm_base(key).startswith('input:'):
        return None
    sheet, n = norm_base(key).split(':')
    tk = f'tex_easyrpg_charset_{sheet.lower()}'
    for m in json.loads(GRAPHICS.read_text(encoding='utf-8'))['mappings']:
        if m.get('textureKey') == tk and m.get('characterIndex') == int(n):
            fid = m.get('faceResourceId') or ''
            mm = __import__('re').fullmatch(r'easyrpg-faceset-([a-z]+\d*)-(\d+)', fid)
            if not mm:
                return None
            name = mm.group(1).capitalize()
            png = RTP / 'faceset' / f'{name}.png'
            return (png, int(mm.group(2))) if png.exists() else None
    return None


# ─────────────────────────────── 명령 ───────────────────────────────
def cmd_calibrate(_):
    """RTP 원본 72명(Actor1~4·People1~5)이 자기 자신을 뼈대로 했을 때 전부 통과해야 한다(새 캐릭터 여부 검사는 끔)."""
    bad = 0
    for sh in BASE_SHEETS:
        for i in range(8):
            pal, frames = base_of(f'{sh}:{i}')
            r = C.gate(pal, frames, (pal, frames), check_changed=False)
            if not r['ok']:
                print(sh, i, 'FAIL', r['fails'][:3])
            bad += not r['ok']
    print(f'{len(BASE_SHEETS) * 8 - bad}/{len(BASE_SHEETS) * 8} 통과')
    sys.exit(1 if bad else 0)


def cmd_base(a):
    pal, frames = base_of(a.n)
    Path(a.out).write_text(C.dump(pal, {}, frames, header=f'{base_label(a.n)} 캐릭터 (뼈대). 색 글자는 어두운 것부터 a,b,c…'),
                           encoding='utf-8')
    print(a.out)


def propagate_file(file, base_key, keep_worker=True):
    """out.chr.txt 의 걸음 0·2 를 서 있는 자세에서 다시 만든다(chr.propagate). 작업자 원본은 out.worker.chr.txt 로 남긴다."""
    file = Path(file)
    pal, notes, frames = C.load(file)
    bp, bf = base_of(base_key)
    if keep_worker:
        worker = file.with_name(file.name.replace('.chr.txt', '.worker.chr.txt'))
        if not worker.exists():
            shutil.copy(file, worker)
    new = C.propagate(bf, frames, bp, pal)
    file.write_text(C.dump(pal, notes, new, header='걸음 0·2 는 하네스가 서 있는 자세에서 전파했다(chr.propagate)'), encoding='utf-8')
    return new


def cmd_propagate(a):
    propagate_file(a.file, a.base, keep_worker=not a.no_keep)
    pal, _, frames = C.load(a.file)
    print(json.dumps(C.gate(pal, frames, base_of(a.base), strength=a.strength), ensure_ascii=False, indent=1))


def cmd_check(a):
    pal, _, frames = C.load(a.file)
    r = C.gate(pal, frames, base_of(a.base) if a.base is not None else None, strength=a.strength)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(0 if r['ok'] else 1)


def make_views(file, out, base_n=None, strength='normal'):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    raw = Path(file).read_bytes()
    pal, _, frames = C.parse(raw.decode('utf-8'))
    se = C.structural_errors(pal, frames)
    if se:
        raise C.GridError('; '.join(se[:5]))
    base = base_of(base_n) if base_n is not None else None
    C.sheet_keyed(pal, frames).save(out / 'sheet.png')
    C.sheet_big(pal, frames, 8).save(out / 'sheet_x8.png')
    C.strip(pal, frames, 6, base).save(out / 'strip.png')
    C.gif_walk(pal, frames, out / 'walk.gif', 4, LAWN)
    C.gif_turn(pal, frames, out / 'turn.gif', 4, LAWN)
    C.gif_stroll(pal, frames, out / 'stroll.gif', 3, LAWN)
    png = base_sheet(base_n)[0] if base_n is not None else ACTOR1
    others = (0, 1, 3, 6)
    if base_n is not None and norm_base(base_n).startswith('input:'):
        _, iid, slot = norm_base(base_n).split(':')
        info_file = INPUTS / f'{iid}.json'
        info = json.loads(info_file.read_text(encoding='utf-8')) if info_file.exists() else {}
        others = tuple(info.get('slots') or [int(slot)])[:4]
    C.context(pal, frames, png, 3, LAWN, others=others).save(out / 'context.png')
    r = C.gate(pal, frames, base, strength=strength)
    r['strength'] = strength
    r['sourceSha256'] = hashlib.sha256(raw).hexdigest()
    r['baseSha256'] = hashlib.sha256(C.dump(base[0], {}, base[1]).encode()).hexdigest() if base else None
    write_json_atomic(out / 'gate.json', r)
    write_json_atomic(out / 'render.json', binding(r))
    return r


def cmd_views(a):
    r = make_views(a.file, a.out, a.base, a.strength)
    print(json.dumps(r, ensure_ascii=False, indent=1))
    print('그림:', ', '.join(sorted(p.name for p in Path(a.out).iterdir())))


def run_dir(run):
    return DATA / 'runs' / run


def start_draw(brief, engine, run, w, src=None, fix_text=None):
    """작업자 하나를 백그라운드로 띄운다 → Popen. src 가 있으면 그 결과(out.chr.txt)에서 시작해 fix_text 를 고친다."""
    b = briefs()[brief]
    eng = ENGINES[engine]
    w.mkdir(parents=True, exist_ok=True)
    base_txt = w / 'base.chr.txt'
    bk = norm_base(b['base'])
    pal, frames = base_of(bk)
    base_txt.write_text(C.dump(pal, {}, frames, header=f'{base_label(bk)} 캐릭터 (뼈대) — 고치지 말 것, 복사해서 쓴다'),
                        encoding='utf-8')
    stg = b.get('strength', 'normal')
    make_views(base_txt, w / 'base-views', bk, stg)
    tool = f'python3 {HERE / "harness.py"}'
    t = (HERE / 'worker.md').read_text(encoding='utf-8')
    rep = {'{TOOL}': tool, '{DIR}': str(w), '{BASE_N}': bk, '{BASE_LABEL}': base_label(bk), '{NAME}': b['name'],
           '{STRENGTH_RULES}': STRENGTH_RULES[stg], '{STRENGTH}': stg,
           '{BRIEF}': b.get('brief') or NO_BRIEF, '{KEEP}': b.get('keep', DEFAULT_KEEP), '{SHEET_PNG}': str(base_sheet(bk)[0])}
    for k, v in rep.items():
        t = t.replace(k, v)
    if src:
        # 수정 작업: 다른 작업자(또는 이전 판)의 결과에서 시작한다. 지적은 감독·검수자가 쓴 글을 그대로 붙인다.
        shutil.copy(src / 'out.chr.txt', w / 'start.chr.txt')
        make_views(w / 'start.chr.txt', w / 'start-views', bk, stg)
        t += (HERE / 'fixer.md').read_text(encoding='utf-8').replace('{FIX}', fix_text or '(지적 없음 — 스스로 찾아 고친다)') \
            .replace('{SRC}', str(src))
    (w / 'prompt.md').write_text(t, encoding='utf-8')
    p = _spawn(engine, w, w / 'prompt.md', w / 'worker.log')
    meta = dict(run=run, brief=brief, engine=engine, label=eng['label'], model=eng['model'], effort=eng['effort'],
                pid=p.pid, started=now(), dir=str(w), base=bk, strength=stg, src=str(src) if src else None)
    if src:
        meta['label'] += f' — {json.loads((src / "meta.json").read_text())["label"]} 결과를 수정'
    (w / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    return p, meta


def _spawn(engine, cwd, prompt, log):
    eng = ENGINES[engine]
    if engine in CLAUDE_ENGINES:
        cmd = [shutil.which('claude') or 'claude', '-p', '--model', eng['model'], '--effort', eng['effort'],
               '--dangerously-skip-permissions', '--add-dir', str(HERE), '--output-format', 'text']
    else:
        cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', eng['model'],
               '-c', f'model_reasoning_effort="{eng["effort"]}"', '--skip-git-repo-check', '-s', 'workspace-write',
               '--add-dir', str(HERE), '-C', str(cwd), '-']
    return subprocess.Popen(['timeout', str(TIMEOUT_S)] + cmd, cwd=cwd, stdin=open(prompt, 'rb'), stdout=open(log, 'w'),
                            stderr=subprocess.STDOUT, start_new_session=True)


def cmd_draw(a):
    run = a.run or datetime.now().strftime('%Y%m%d-%H%M')
    src = Path(a.src).expanduser() if a.src else None
    tag = a.engine + (f'-fix-{a.tag or src.name.split("__")[-1]}' if src else '')
    w = run_dir(run) / f'{a.brief}__{tag}'
    if w.exists() and any(w.iterdir()) and not a.force:
        sys.exit(f'이미 있다: {w} (--force 로 덮기)')
    fix = Path(a.fix_notes).read_text(encoding='utf-8') if a.fix_notes else None
    _, meta = start_draw(a.brief, a.engine, run, w, src, fix)
    print(json.dumps(meta, ensure_ascii=False))


# ─────────────────────────────── 검수자 ───────────────────────────────
def start_review(w, engine='sonnet'):
    """독립 검수자 — 작업자의 메모는 주지 않고 그림·기계 검수·지시만 준다. 결과는 w/review/verdict.json."""
    meta = json.loads((w / 'meta.json').read_text())
    b = briefs()[meta['brief']]
    rv = w / 'review'
    if rv.exists():
        shutil.rmtree(rv)
    rv.mkdir()
    v = w / 'views'
    stg = b.get('strength', 'normal')
    make_views(w / 'out.chr.txt', v, norm_base(b['base']), stg)
    for n in ('strip.png', 'sheet_x8.png', 'context.png', 'gate.json'):
        shutil.copy(v / n, rv / n)
    shutil.copy(w / 'base-views' / 'strip.png', rv / 'base_strip.png')
    t = (HERE / 'reviewer.md').read_text(encoding='utf-8')
    for k, val in {'{NAME}': b['name'], '{BRIEF}': b.get('brief') or '(지시 없음 — 작업자가 강도 안에서 정했다)',
                   '{STRENGTH_LABEL}': C.STRENGTH[stg]['label'], '{KEEP}': b.get('keep', DEFAULT_KEEP), '{DIR}': str(rv),
                   '{BASE_N}': norm_base(b['base']), '{BASE_LABEL}': base_label(b['base'])}.items():
        t = t.replace(k, val)
    (rv / 'prompt.md').write_text(t, encoding='utf-8')
    return _spawn(engine, rv, rv / 'prompt.md', rv / 'review.log')


def current_gate(w):
    """이전 PASS를 그대로 쓰지 않는다. 검사 버전·격자·원본·강도에 결부한다."""
    meta = json.loads((w / 'meta.json').read_text())
    raw = (w / 'out.chr.txt').read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    base = base_of(meta['base'])
    base_hash = hashlib.sha256(C.dump(base[0], {}, base[1]).encode()).hexdigest()
    strength = meta.get('strength') or briefs().get(meta['brief'], {}).get('strength', 'normal')
    file = w / 'views' / 'gate.json'
    try:
        result = json.loads(file.read_text())
    except (OSError, ValueError):
        result = {}
    if (result.get('version'), result.get('sourceSha256'), result.get('baseSha256'), result.get('strength')) == (C.GATE_VERSION, source_hash, base_hash, strength):
        return result
    try:
        pal, _, frames = C.parse(raw.decode('utf-8'))
        result = C.gate(pal, frames, base, strength=strength)
    except (C.GridError, UnicodeError) as error:
        result = dict(version=C.GATE_VERSION, ok=False, discard=True, fatal=[dict(code='structure', what=str(error))],
                      fails=[str(error)], warns=[], metrics={})
    result.update(strength=strength, sourceSha256=source_hash, baseSha256=base_hash)
    file.parent.mkdir(exist_ok=True)
    write_json_atomic(file, result)
    return result


def binding(gate):
    return {k: gate.get(k) for k in ('version', 'sourceSha256', 'baseSha256', 'strength')}


def views_fresh(w, gate):
    try:
        return json.loads((w / 'views' / 'render.json').read_text()) == binding(gate)
    except (OSError, ValueError):
        return False


def bind_review(w, inspected):
    file = w / 'review' / 'verdict.json'
    value = json.loads(file.read_text())
    value['inspected'] = binding(inspected)
    write_json_atomic(file, value)


def read_verdict(w, gate=None):
    f = w / 'review' / 'verdict.json'
    try:
        v = json.loads(f.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    gate = current_gate(w) if gate is None else gate
    v['verdict'] = str(v.get('verdict', '')).upper()
    if v.get('inspected') != binding(gate):
        v.update(verdict='FAIL', stale=True)
        v.setdefault('issues', []).insert(0, dict(severity='high', where='검수 대상',
                                                 what='현재 격자·원본·강도·검사 버전의 시각 검수가 필요합니다', fix='현재 그림을 다시 검수'))
    score = v.get('score')
    if (not isinstance(score, (int, float)) or not 8 <= score <= 10 or v.get('discard') or v.get('fatal')
            or any(i.get('severity') in ('high', 'mid') for i in v.get('issues', []))):
        v['verdict'] = 'FAIL'
    if not gate['ok']:
        # 기계 검수가 막으면 검수자 판정과 상관없이 불합격
        v['verdict'] = 'FAIL'
        v.setdefault('issues', []).insert(0, dict(severity='high', where='기계 검수', what='; '.join(gate['fails']),
                                                   fix='기계 검수를 통과시켜라'))
    return v


def quality(w, decision=None, gate=None, review=None):
    gate = current_gate(w) if gate is None else gate
    review = read_verdict(w, gate) if review is None else review
    reasons = []
    if not gate['ok']:
        reasons.extend(gate['fails'])
    visual_fatal = bool(review and not review.get('stale') and (review.get('discard') or review.get('fatal')))
    fatal = gate.get('discard', False) or visual_fatal
    if fatal:
        reasons.append('머리/몸체 결손 등 폐기 결함')
    if decision == 'reject':
        reasons.append('사용자 버림')
    if not review:
        reasons.append('시각 검수 미완료')
    elif review.get('stale'):
        reasons.append('현재 그림의 시각 검수 미완료')
    elif review['verdict'] != 'PASS' and decision != 'accept':
        reasons.append('시각 검수 불합격')
    if not views_fresh(w, gate):
        reasons.append('현재 격자의 렌더 미완료')
    pending = (gate['ok'] and not fatal and decision != 'reject'
               and (not review or review.get('stale') or not views_fresh(w, gate)))
    return dict(eligible=not reasons, discard=fatal, pending=bool(pending), reasons=reasons)


def fix_text_from(v):
    lines = []
    for it in v.get('issues', []):
        lines.append(f"- [{it.get('severity', '?')}] {it.get('where', '')}: {it.get('what', '')} → 고칠 것: {it.get('fix', '')}")
    if v.get('good'):
        lines.append('\n검수자가 잘 됐다고 본 것(살릴 것): ' + ' / '.join(v['good']))
    return '\n'.join(lines) or '(검수자 지적 없음)'


def _wait(p):
    p.wait()


def run_loop(brief, run, drawer, reviewer, rounds, log, face=None, gen_face=True, propagate=True):
    prev = None
    for r in range(1, rounds + 1):
        w = run_dir(run) / f'{brief}__{drawer}-r{r}'
        try:
            w.mkdir(parents=True, exist_ok=False)
        except FileExistsError:
            log(f'{brief} r{r}: 기존 후보가 있어 덮어쓰지 않습니다. 새 실행 이름을 사용하세요')
            return
        fix = fix_text_from(read_verdict(prev)) if prev else None
        p, _ = start_draw(brief, drawer, run, w, prev, fix)
        log(f'{brief} r{r}: {drawer} 그리기 시작 pid={p.pid}')
        _wait(p)
        if not (w / 'out.chr.txt').exists():
            log(f'{brief} r{r}: 결과 없음 — 멈춤')
            return
        if propagate:
            try:
                propagate_file(w / 'out.chr.txt', briefs()[brief]['base'])
                log(f'{brief} r{r}: 걸음 0·2 전파')
            except Exception as e:  # noqa: BLE001
                log(f'{brief} r{r}: 전파 실패 {e!r}'[:300])
        make_views(w / 'out.chr.txt', w / 'views', norm_base(briefs()[brief]['base']), strength_of(brief))
        rp = start_review(w, reviewer)
        log(f'{brief} r{r}: {reviewer} 검수 시작 pid={rp.pid}')
        _wait(rp)
        if rp.returncode != 0 or not (w / 'review' / 'verdict.json').exists():
            log(f'{brief} r{r}: 검수 실패 — 멈춤')
            return
        bind_review(w, json.loads((w / 'review' / 'gate.json').read_text()))
        v = read_verdict(w)
        if v is None:
            log(f'{brief} r{r}: 검수 결과 없음 — 멈춤')
            return
        log(f'{brief} r{r}: {v["verdict"]} 점수 {v.get("score")} 지적 {len(v.get("issues", []))}개')
        if v['verdict'] == 'PASS' or r == rounds:
            if face and face_ref(briefs()[brief]['base']) is None:
                log(f'{brief} r{r}: 짝 얼굴 뼈대 없음(올린 그림이거나 생성 얼굴이 짝) — 얼굴 건너뜀')
            elif face:
                fp = start_face(w, face)
                log(f'{brief} r{r}: {face} 얼굴 시작 pid={fp.pid}')
                fp.wait()
                fr = finish_face(w)
                log(f'{brief} r{r}: 얼굴 {"통과" if fr and fr["ok"] else "불통과/없음"}')
                if gen_face and (w / 'face' / 'out.face.txt').exists():
                    try:
                        log(f'{brief} r{r}: 생성 얼굴 {gen_face_one(w)}')
                    except Exception as e:  # noqa: BLE001
                        log(f'{brief} r{r}: 생성 얼굴 실패 {e!r}'[:300])
            try:
                d = describe_one(w)
                log(f'{brief} r{r}: 설명 「{d.get("label") if d else "없음"}」')
            except Exception as e:  # noqa: BLE001
                log(f'{brief} r{r}: 설명 실패 {e!r}'[:300])
            return
        prev = w


def cmd_loop(a):
    import threading
    run = a.run or datetime.now().strftime('%Y%m%d-%H%M')
    run_dir(run).mkdir(parents=True, exist_ok=True)
    lf = open(run_dir(run) / 'loop.log', 'a')
    lock = threading.Lock()

    def log(msg):
        with lock:
            line = f'{datetime.now().strftime("%H:%M:%S")} {msg}'
            print(line, flush=True)
            lf.write(line + '\n')
            lf.flush()
    from concurrent.futures import ThreadPoolExecutor
    names = list(briefs()) if a.briefs == ['all'] else a.briefs
    with ThreadPoolExecutor(max_workers=a.par) as ex:  # codex 동시 실행 수 제한
        for f in [ex.submit(run_loop, b, run, a.drawer, a.reviewer, a.rounds, log, a.face or None, not a.no_gen_face, not a.no_propagate) for b in names]:
            try:
                f.result()
            except Exception as e:  # noqa: BLE001 — 한 캐릭터가 죽어도 나머지는 계속
                log(f'오류: {e!r}')
    log('끝')


def _alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        state = Path(f'/proc/{pid}/stat')
        if state.exists() and state.read_text().rsplit(')', 1)[1].strip().startswith('Z'):
            return False
        return True
    except OSError:
        return False


def cmd_status(a):
    runs = [run_dir(a.run)] if a.run else sorted((DATA / 'runs').glob('*'))
    for r in runs:
        for w in sorted(r.glob('*__*')):
            m = json.loads((w / 'meta.json').read_text())
            out = w / 'out.chr.txt'
            st = 'running' if _alive(m['pid']) else ('done' if out.exists() else 'no-output')
            print(r.name, w.name, st, m['started'], (w / 'worker.log').stat().st_size, 'B log')


def _data_uri(p):
    mime = 'image/gif' if str(p).endswith('.gif') else 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(Path(p).read_bytes()).decode()


def cmd_page(a):
    rd = run_dir(a.run)
    cards = []
    base_done = set()
    ws = sorted(rd.glob('*__*'), key=lambda w: ('-fix-' in w.name, w.name))  # 처음부터 그린 것 먼저, 수정본은 뒤에
    for w in ws:
        m = json.loads((w / 'meta.json').read_text())
        if norm_base(m['base']) not in base_done:
            base_done.add(norm_base(m['base']))
            bv = w / 'base-views'
            cards.append(dict(title=f'뼈대 — {base_label(m["base"])} (원본)', views=bv, gate=None, notes='', base=True))
        out = w / 'out.chr.txt'
        if not out.exists():
            cards.append(dict(title=m['label'] + ' · ' + w.name.split('__')[-1], views=None, gate=None, notes='(아직 그리는 중)', base=False))
            continue
        v = w / 'views'
        r = make_views(out, v, norm_base(m['base']), m.get('strength', 'normal'))
        notes = (w / 'notes.md').read_text(encoding='utf-8') if (w / 'notes.md').exists() else ''
        rv = read_verdict(w)
        title = m['label'] + (f' · {w.name.rsplit("-", 1)[-1]}' if w.name.split('__')[-1].count('-r') else '')
        cards.append(dict(title=title, views=v, gate=r, notes=notes, base=False, review=rv))
    b = briefs()
    brief_txt = '<br>'.join(html.escape(f'{v["name"]}: {v["brief"]}') for v in b.values())
    parts = []
    for c in cards:
        if c['views'] is None:
            parts.append(f'<section class=card><h2>{html.escape(c["title"])}</h2><p>{html.escape(c["notes"])}</p></section>')
            continue
        v = c['views']
        g = c['gate']
        gate_html = ''
        if g is not None:
            mm = g['metrics']
            gate_html = (f'<div class="gate {"ok" if g["ok"] else "bad"}">기계 검수 {"통과" if g["ok"] else "불통과"}'
                         + ''.join(f'<div class=f>✗ {html.escape(x)}</div>' for x in g['fails'])
                         + ''.join(f'<div class=w>△ {html.escape(x)}</div>' for x in g['warns'])
                         + f'<div class=m>색 {mm.get("colors")} · 원본과 다른 픽셀 {mm.get("changed_vs_base", 0):.0%}'
                         + f' · 실루엣 바뀐 픽셀 {mm.get("silhouette_changed_px")} · 윤곽 어두움 최저 {mm.get("dark_edge_min", 0):.0%}</div></div>')
        rv = c.get('review')
        rv_html = ''
        if rv:
            rv_html = (f'<div class="gate {"ok" if rv["verdict"] == "PASS" else "bad"}">검수자(Sonnet 5.5 medium) '
                       f'<b>{html.escape(rv["verdict"])}</b> · 점수 {html.escape(str(rv.get("score")))}'
                       + ''.join(f'<div class={"f" if i.get("severity") in ("high", "mid") else "w"}>[{html.escape(str(i.get("severity")))}] '
                                 f'{html.escape(str(i.get("where", "")))} — {html.escape(str(i.get("what", "")))}'
                                 f'<div class=m>고칠 것: {html.escape(str(i.get("fix", "")))}</div></div>' for i in rv.get('issues', []))
                       + (f'<div class=m>잘 된 점: {html.escape(" / ".join(map(str, rv.get("good", []))))}</div>' if rv.get('good') else '')
                       + '</div>')
        parts.append(f'''<section class="card{' base' if c['base'] else ''}"><h2>{html.escape(c['title'])}</h2>
<div class=row><figure><img src="{_data_uri(v / 'walk.gif')}"><figcaption>걷기 4방향 (4배)</figcaption></figure>
<figure><img src="{_data_uri(v / 'turn.gif')}"><figcaption>돌기 (4배)</figcaption></figure>
<figure><img src="{_data_uri(v / 'stroll.gif')}"><figcaption>칸 위를 걷기 (3배)</figcaption></figure>
<figure><img class=one src="{_data_uri(v / 'sheet.png')}"><figcaption>1배 (게임 크기)</figcaption></figure></div>
<details><summary>8배 시트 · 필름 띠 · Actor1 옆에 세운 그림(검수자가 보는 그림)</summary><div class=row>
<img src="{_data_uri(v / 'sheet_x8.png')}"><img src="{_data_uri(v / 'strip.png')}"><img src="{_data_uri(v / 'context.png')}"></div></details>
{gate_html}{rv_html}{'<details><summary>작업자 메모</summary><pre>' + html.escape(c['notes']) + '</pre></details>' if c['notes'] else ''}
</section>''')
    page = f'''<!doctype html><meta charset=utf-8><title>캐릭터 칩 하네스 {a.run}</title>
<style>body{{background:#1d1f24;color:#e6e6e6;font:14px/1.5 system-ui,sans-serif;margin:20px}}
h1{{font-size:18px}} .card{{background:#2a2d34;border-radius:8px;padding:12px 16px;margin:14px 0}} .card.base{{opacity:.9;border:1px dashed #666}}
h2{{font-size:16px;margin:4px 0 10px}} .row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}}
figure{{margin:0}} figcaption{{font-size:12px;color:#aaa}} img{{image-rendering:pixelated;display:block}} img.one{{zoom:1}}
.gate{{margin-top:10px;padding:8px;border-radius:6px}} .gate.ok{{background:#21402a}} .gate.bad{{background:#4a2323}}
.f{{color:#ff9a9a}} .w{{color:#e8d27a}} .m{{color:#bbb;font-size:12px}} pre{{white-space:pre-wrap;font-size:12px}}
summary{{cursor:pointer;color:#9cc;margin-top:8px}}</style>
<h1>캐릭터 칩 하네스 — 실행 {html.escape(a.run)}</h1><p>{brief_txt}</p>
<p style="color:#aaa">두 작업자가 같은 뼈대(Actor1)와 같은 지시로 픽셀을 직접 찍었다(생성 이미지 없음). 고르는 건 사용자.</p>
{''.join(parts)}'''
    VIZ.mkdir(exist_ok=True)
    out = VIZ / f'charset-actor-{a.run}.html'
    out.write_text(page, encoding='utf-8')
    print(out, f'http://mdc-server:18301/{out.name}')


# ─────────────────────────────── 얼굴 ───────────────────────────────
def base_face(key):
    fr = face_ref(key)
    if fr is None:
        return None
    pal, _, rows = C.from_faceset(fr[0], fr[1])
    return pal, rows


def make_face_views(file, out, base_n, chip_dir=None):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    pal, _, rows = C.parse_face(Path(file).read_text(encoding='utf-8'))
    r = C.face_gate(pal, rows, base_face(base_n))
    if not r['fails'] or len(rows) == C.FACE:
        try:
            im = C.face_rgba(pal, rows)
            im.save(out / 'face.png')
            C.up(im, 4).save(out / 'face_x4.png')
            bp, brows = base_face(base_n)
            parts = [C.up(C.face_rgba(bp, brows), 4), C.up(im, 4)]
            if chip_dir and (Path(chip_dir) / 'out.chr.txt').exists():
                cp, _, cf = C.load(Path(chip_dir) / 'out.chr.txt')
                parts.append(C.up(C.frame_rgba(cp, cf[('down', 1)]), 6))
            W = sum(p.width for p in parts) + 16 * (len(parts) - 1)
            cmp_ = Image.new('RGBA', (W, max(p.height for p in parts)), C.KEY + (255,))
            x = 0
            for p in parts:
                cmp_.alpha_composite(p, (x, 0))
                x += p.width + 16
            cmp_.convert('RGB').save(out / 'compare.png')
        except (IndexError, KeyError, TypeError):
            pass
    (out / 'gate.json').write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding='utf-8')
    return r


def cmd_face_check(a):
    pal, _, rows = C.parse_face(Path(a.file).read_text(encoding='utf-8'))
    r = C.face_gate(pal, rows, base_face(a.base))
    print(json.dumps(r, ensure_ascii=False, indent=1))
    sys.exit(0 if r['ok'] else 1)


def cmd_face_views(a):
    chip = Path(a.file).resolve().parent.parent  # <작업 폴더>/face/out.face.txt → 칩은 <작업 폴더>/out.chr.txt
    r = make_face_views(a.file, a.out, a.base, chip)
    print(json.dumps(r, ensure_ascii=False, indent=1))


def start_face(w, engine='sonnet'):
    """완성된 칩(w/out.chr.txt)의 짝 얼굴을 뼈대 얼굴에서 고쳐 만든다 → Popen. 결과 w/face/out.face.txt."""
    meta = json.loads((w / 'meta.json').read_text())
    b = briefs()[meta['brief']]
    fd = w / 'face'
    fd.mkdir(exist_ok=True)
    ref = fd / 'ref'
    ref.mkdir(exist_ok=True)
    bk = norm_base(b['base'])
    make_views(w / 'out.chr.txt', w / 'views', bk, b.get('strength', 'normal'))
    shutil.copy(w / 'views' / 'strip.png', ref / 'chip_strip.png')
    shutil.copy(w / 'views' / 'sheet_x8.png', ref / 'chip_x8.png')
    bp, brows = base_face(bk)
    C.up(C.face_rgba(bp, brows), 4).save(ref / 'base_face_x4.png')
    (fd / 'base.face.txt').write_text(C.dump_face(bp, {}, brows, header=f'{base_label(bk)} 의 짝 얼굴 (뼈대, 64색으로 줄임) — 고치지 말 것'),
                                      encoding='utf-8')
    t = (HERE / 'face.md').read_text(encoding='utf-8')
    for k, v in {'{NAME}': b['name'], '{BRIEF}': b['brief'], '{BASE_N}': bk, '{BASE_LABEL}': base_label(bk), '{DIR}': str(fd),
                 '{TOOL}': f'python3 {HERE / "harness.py"}'}.items():
        t = t.replace(k, v)
    (fd / 'prompt.md').write_text(t, encoding='utf-8')
    p = _spawn(engine, fd, fd / 'prompt.md', fd / 'worker.log')
    (fd / 'meta.json').write_text(json.dumps(dict(engine=engine, label=ENGINES[engine]['label'], pid=p.pid, started=now()),
                                             ensure_ascii=False), encoding='utf-8')
    return p


POSE_MIN = 0.65   # v2 의 골격 점수 기준(지금은 참고로만 기록)
ANGLE_MIN = 7     # v3 각도 검수자 점수 기준(0-10) + 같은 방향


def gen_face_one(w, tries=3, reuse=False):
    """생성 얼굴 v3(각도만 고정): 손 도트 얼굴을 참고로 생김새·머리·옷은 자유롭게, 고개 방향·기울기·시선·구도만 잠근다.
    생성 그림은 원본 구도에 맞춰 확대·위치를 찾아 자른다(gen_face.align_crop — 생성은 줌아웃되기 쉽다).
    각도 검수자(Sonnet)가 같은 방향·ANGLE_MIN 이상이라고 할 때까지, 가장 높은 것.
    reuse=True 면 face_gen/raw-*.png(이미 뽑은 것)를 먼저 다시 자르고 다시 판정하고, 모자라면 tries 번까지 새로 뽑는다.
    결과 w/face_gen/{ref.png, raw-<k>.png, cand-<k>_x4.png, angle-<k>.json, face.png, face_x4.png, compare.png, meta.json}"""
    import gen_face as G
    meta = json.loads((w / 'meta.json').read_text())
    b = briefs()[meta['brief']]
    if not (w / 'face' / 'out.face.txt').exists():
        raise RuntimeError('손 도트 얼굴이 먼저 있어야 한다(faces)')
    gd = w / 'face_gen'
    raws = sorted(gd.glob('raw-*.png'), key=lambda p: int(p.stem.split('-')[1])) if reuse and gd.exists() else []
    if gd.exists() and not reuse:
        old = w / f'face_gen_{_gen_meta(w).get("version", "v1") if _gen_meta(w) else "old"}'
        if old.exists():
            shutil.rmtree(old)
        gd.rename(old)   # 이전 판은 비교용으로 남긴다
    gd.mkdir(exist_ok=True)
    bp, brows = base_face(b['base'])
    base_im = C.face_rgba(bp, brows)
    C.up(base_im, 4).save(gd / 'base_x4.png')
    hp, _, hrows = C.parse_face((w / 'face' / 'out.face.txt').read_text(encoding='utf-8'))
    hand_im = C.face_rgba(hp, hrows)
    mask = G.kept_mask(brows, hrows, bp, hp)
    ref = G.reference_lock(hand_im)
    ref.save(gd / 'ref.png')
    t0 = time.time()
    best, engine, tried = None, (_gen_meta(w) or {}).get('engine'), []

    def judge(k, raw):
        face, info = G.align_crop(raw, base_im, mask)
        C.up(face, 4).save(gd / f'cand-{k}_x4.png')
        j = G.judge_angle(gd, gd / 'base_x4.png', gd / f'cand-{k}_x4.png', gd / f'angle-{k}.json') or {}
        sc, same = float(j.get('score') or 0), bool(j.get('same_direction'))
        tried.append(dict(k=k, angle=sc, same=same, issues=j.get('issues', []), **info))
        return (same, sc), face

    n = 0
    for p in raws:
        key, face = judge(int(p.stem.split('-')[1]), Image.open(p).convert('RGB'))
        if best is None or key > best[0]:
            best = (key, face, tried[-1]['k'])
        n = max(n, tried[-1]['k'] + 1)
    new = 0
    while not (best and best[0][0] and best[0][1] >= ANGLE_MIN) and new < tries:
        raw, engine, _ = G.generate_free(ref, b['brief'])
        raw.save(gd / f'raw-{n}.png')
        key, face = judge(n, raw)
        if best is None or key > best[0]:
            best = (key, face, n)
        n += 1
        new += 1
    (same, sc), face, k = best
    face.save(gd / 'face.png')
    C.up(face, 4).save(gd / 'face_x4.png')
    cp, _, cf = C.load(w / 'out.chr.txt')
    parts = [C.up(base_im, 4), C.up(hand_im, 4), C.up(face.convert('RGBA'), 4), C.up(C.frame_rgba(cp, cf[('down', 1)]), 6)]
    W = sum(p.width for p in parts) + 16 * (len(parts) - 1)
    cmp_ = Image.new('RGBA', (W, max(p.height for p in parts)), C.KEY + (255,))
    x = 0
    for p in parts:
        cmp_.alpha_composite(p, (x, 0))
        x += p.width + 16
    cmp_.convert('RGB').save(gd / 'compare.png')
    (gd / 'meta.json').write_text(json.dumps(dict(version='v3-angle', engine=engine, angle=sc, same_direction=same,
                                                  angle_min=ANGLE_MIN, ok=same and sc >= ANGLE_MIN, tried=tried, chosen=k,
                                                  generated_now=new, wall=round(time.time() - t0), at=now()),
                                             ensure_ascii=False), encoding='utf-8')
    return f'각도 {sc} 같은방향 {same} 새로 뽑음 {new} 시도 {[(t["k"], t["angle"], t["same"], t["zoom"]) for t in tried]}'


def cmd_gen_faces(a):
    """완성된 칩마다 생성 얼굴을 만든다(동시 a.par). 이미 있으면 --redo 때만 다시."""
    from concurrent.futures import ThreadPoolExecutor
    ws = [w for w in sorted(run_dir(a.run).glob('*__*')) if (w / 'out.chr.txt').exists()
          and (a.redo or a.reuse or not (w / 'face_gen' / 'face.png').exists()) and (not a.only or w.name.split('__')[0] in a.only.split(','))]

    def one(w):
        for k in range(3):
            try:
                e = gen_face_one(w, reuse=a.reuse)
                print(f'{datetime.now():%H:%M:%S} {w.name} 생성 얼굴 끝 ({e})', flush=True)
                return
            except Exception as ex:  # noqa: BLE001 — API 실패는 재시도
                print(f'{datetime.now():%H:%M:%S} {w.name} 실패 {k + 1}/3: {ex!r}'[:300], flush=True)
    with ThreadPoolExecutor(max_workers=a.par) as ex:
        list(ex.map(one, ws))
    print('끝', flush=True)


def finish_face(w):
    fd = w / 'face'
    if (fd / 'out.face.txt').exists():
        b = norm_base(json.loads((w / 'meta.json').read_text())['base'])
        return make_face_views(fd / 'out.face.txt', fd / 'views', b, w)
    return None


def cmd_faces(a):
    """완성된 칩 중 얼굴이 없는 것에 얼굴 작업자를 붙인다(동시 a.par)."""
    from concurrent.futures import ThreadPoolExecutor
    ws = [w for w in sorted(run_dir(a.run).glob('*__*')) if (w / 'out.chr.txt').exists()
          and face_ref(json.loads((w / 'meta.json').read_text())['base']) is not None
          and (a.redo or not (w / 'face' / 'out.face.txt').exists())]

    def one(w):
        p = start_face(w, a.engine)
        print(f'{datetime.now():%H:%M:%S} {w.name} 얼굴 시작 pid={p.pid}', flush=True)
        p.wait()
        r = finish_face(w)
        print(f'{datetime.now():%H:%M:%S} {w.name} 얼굴 끝 {"통과" if r and r["ok"] else r and r["fails"]}', flush=True)
    with ThreadPoolExecutor(max_workers=a.par) as ex:
        list(ex.map(one, ws))
    print('끝', flush=True)


# ─────────────────────────────── 그림 넣기(올린 칩) ───────────────────────────────
def ingest(src, name=None):
    """올린 CharSet 그림 → INPUTS/<id>.png(288×256, 배경 키 색 칠함) → (id, [캐릭터가 있는 칸], 자기 검사 결과).
    72×128(한 명) 그림은 0번 칸에 넣는다. 투명 배경이면 KEY 로 칠한다. 한 칸 색이 60개를 넘으면 60색으로 줄인다."""
    import hashlib
    im = Image.open(src)
    w, h = im.size
    if not (w % 72 == 0 and h % 128 == 0 and w <= 288 and h <= 256):
        raise ValueError(f'CharSet 크기가 아니다 {w}×{h} — 72×128(한 명) 또는 288×256(여덟 명)')
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        rgba = im.convert('RGBA')
        key = C.KEY
        flat = Image.new('RGB', (w, h), key)
        flat.paste(rgba.convert('RGB'), (0, 0), rgba.split()[3].point(lambda a: 255 if a >= 128 else 0))
    else:
        flat = im.convert('RGB')
        key = flat.getpixel((0, 0))
    sheet = Image.new('RGB', (288, 256), key)
    sheet.paste(flat, (0, 0))
    slots = []
    for n in range(8):
        bx, by = (n % 4) * 72, (n // 4) * 128
        blk = sheet.crop((bx, by, bx + 72, by + 128))
        px = list(blk.getdata())
        opaque = sum(c != key for c in px)
        if opaque < 1000:   # 옆 칸에서 넘어온 몇 픽셀(조선 병사 1번 칸 25px)은 캐릭터가 아니다
            continue
        cols = {c for c in px if c != key}
        if len(cols) > 60:
            q = blk.quantize(61, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
            qd = [key if c == key else (qc if qc != key else (qc[0], qc[1], qc[2] ^ 1)) for c, qc in zip(px, q.getdata())]
            blk = Image.new('RGB', blk.size)
            blk.putdata(qd)
            sheet.paste(blk, (bx, by))
        slots.append(n)
    if not slots:
        raise ValueError('캐릭터가 있는 칸이 없다(배경 키 색은 왼쪽 위 픽셀로 읽는다)')
    iid = hashlib.sha1(sheet.tobytes()).hexdigest()[:8]
    INPUTS.mkdir(parents=True, exist_ok=True)
    sheet.save(INPUTS / f'{iid}.png')
    selfcheck = {}
    for n in slots:
        pal, _, frames = C.from_actor(INPUTS / f'{iid}.png', n)
        r = C.gate(pal, frames, (pal, frames), check_changed=False)
        selfcheck[n] = r['fails']
    (INPUTS / f'{iid}.json').write_text(json.dumps(dict(name=name or Path(str(src)).stem, src=str(src), slots=slots,
                                                        selfcheck=selfcheck, at=now()), ensure_ascii=False), encoding='utf-8')
    return iid, slots, selfcheck


def add_input_briefs(iid, slots, strengths, name, brief=''):
    """올린 그림의 칸 × 강도마다 지시를 만들어 LOCAL_BRIEFS 에 넣는다 → 지시 이름 목록."""
    loc = json.loads(LOCAL_BRIEFS.read_text(encoding='utf-8')) if LOCAL_BRIEFS.exists() else {}
    keys = []
    for n in slots:
        for stg in strengths:
            k = f'in-{iid}-{n}-{stg}'
            loc[k] = dict(name=f'{name}{f" {n + 1}" if len(slots) > 1 else ""} · {C.STRENGTH[stg]["label"]}',
                          base=f'input:{iid}:{n}', gender='', brief=brief or '', strength=stg, source='upload', at=now())
            keys.append(k)
    LOCAL_BRIEFS.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_BRIEFS.write_text(json.dumps(loc, ensure_ascii=False, indent=1), encoding='utf-8')
    return keys


def spawn_loop(keys, run, drawer='gpt'):
    """loop 를 따로 프로세스로(화면 서버가 막히지 않게)."""
    run_dir(run).mkdir(parents=True, exist_ok=True)
    return subprocess.Popen([sys.executable, str(HERE / 'harness.py'), 'loop', *keys, '--run', run, '--drawer', drawer,
                             '--par', str(min(6, len(keys)))], cwd=str(ROOT), stdout=open(run_dir(run) / 'loop.out', 'a'),
                            stderr=subprocess.STDOUT, start_new_session=True)


def cmd_ingest(a):
    iid, slots, sc = ingest(a.image, a.name)
    if a.slot is not None:
        slots = [s_ for s_ in slots if s_ in a.slot]
    strengths = a.strength.split(',')
    for stg in strengths:
        if stg not in C.STRENGTH:
            sys.exit(f'강도 {stg!r} 은 {list(C.STRENGTH)} 중 하나')
    keys = add_input_briefs(iid, slots, strengths, a.name or Path(a.image).stem, a.brief or '')
    print(json.dumps(dict(id=iid, slots=slots, selfcheck=sc, briefs=keys), ensure_ascii=False, indent=1))
    if a.go:
        run = a.run or datetime.now().strftime('%Y%m%d-%H%M') + f'-in-{iid}'
        p = spawn_loop(keys, run, a.drawer)
        print(f'loop pid={p.pid} run={run}')


# ─────────────────────────────── 설명(조수가 읽을 것) ───────────────────────────────
def describe_one(w, engine='sonnet'):
    """완성된 칩을 Sonnet 이 그림만 보고 설명한다 → w/desc.json (sharedCharacterGraphics 의 label·attributes 형식 + 외형 문장·태그)."""
    meta = json.loads((w / 'meta.json').read_text())
    b = briefs().get(meta['brief'], {})
    dd = w / 'describe'
    if dd.exists():
        shutil.rmtree(dd)
    dd.mkdir()
    for n in ('sheet_x8.png', 'strip.png'):
        shutil.copy(w / 'views' / n, dd / n)
    face_line = ''
    if (w / 'face_gen' / 'face_x4.png').exists():
        shutil.copy(w / 'face_gen' / 'face_x4.png', dd / 'face_x4.png')
        face_line = '- `face_x4.png` — 이 캐릭터의 대화창 얼굴(4배). 머리·눈·옷깃 색은 칩과 맞춰 본다.'
    t = (HERE / 'describe.md').read_text(encoding='utf-8')
    for k, v in {'{NAME}': b.get('name', meta['brief']), '{DIR}': str(dd), '{FACE_LINE}': face_line,
                 '{BRIEF}': b.get('brief') or '(지시 없음)'}.items():
        t = t.replace(k, v)
    (dd / 'prompt.md').write_text(t, encoding='utf-8')
    _spawn(engine, dd, dd / 'prompt.md', dd / 'describe.log').wait()
    try:
        d = json.loads((dd / 'desc.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    d['by'], d['at'] = ENGINES[engine]['label'], now()
    (w / 'desc.json').write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding='utf-8')
    return d


def _desc(w):
    try:
        return json.loads((w / 'desc.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def cmd_describe(a):
    from concurrent.futures import ThreadPoolExecutor
    runs = [run_dir(a.run)] if a.run else sorted((DATA / 'runs').glob('*'))
    ws = [w for r in runs for w in sorted(r.glob('*__*')) if (w / 'views' / 'sheet_x8.png').exists()
          and (a.redo or not (w / 'desc.json').exists()) and (not a.only or w.name.split('__')[0] in a.only.split(','))]
    if a.accepted:
        acc = {k for k, d in _decisions().items() if d['decision'] == 'accept'}
        ws = [w for w in ws if f'{w.parent.name}/{w.name}' in acc]

    def one(w):
        d = describe_one(w)
        print(f'{datetime.now():%H:%M:%S} {w.parent.name}/{w.name} 「{d.get("label") if d else "실패"}」', flush=True)
    with ThreadPoolExecutor(max_workers=a.par) as ex:
        list(ex.map(one, ws))
    if a.accepted or not a.run:
        export_decisions()
    print(f'끝 {len(ws)}개', flush=True)


# ─────────────────────────────── 받기/버리기 화면 ───────────────────────────────
REASONS = ['Actor1 과 화풍 다름', '지시와 다름', '1배에서 안 읽힘', '방향마다 다른 사람', '걸음 어색', '형태 뭉개짐', '색이 탁함', '잡티']
DECISIONS = DATA / 'decisions.jsonl'          # 정본(추가만). 저장소 사본은 export_decisions 가 쓴다.
EXPORT = HDATA / 'decisions.json'
ACCEPTED = HDATA / 'accepted'
ACCEPTED_LOCAL = DATA / 'accepted'           # 올린 그림에서 나온 것(남의 그림일 수 있다 — 저장소 밖)


def _items():
    out = []
    decisions = _decisions()
    for rd in sorted((p for p in (DATA / 'runs').glob('*') if p.name != 'reviewtest'), reverse=True):
        discarded_file = rd / 'discarded.json'
        discarded = {r['dir'] for r in json.loads(discarded_file.read_text())['characters']} if discarded_file.exists() else set()
        for w in sorted(rd.glob('*__*')):
            if w.name in discarded:
                continue
            try:
                m = json.loads((w / 'meta.json').read_text())
            except (OSError, ValueError):
                continue
            b = briefs().get(m['brief'], {})
            has = (w / 'out.chr.txt').exists() and (w / 'views' / 'walk.gif').exists()
            gate = None
            if has:
                gate = current_gate(w)
            review = read_verdict(w, gate) if has else None
            q = quality(w, decisions.get(f'{rd.name}/{w.name}', {}).get('decision'), gate, review) if has else None
            if q and q['discard']:
                continue  # 폐기 대상은 선택 후보에 올리지 않는다.
            out.append(dict(id=f'{rd.name}/{w.name}', run=rd.name, dir=w.name, brief=m['brief'], name=b.get('name', m['brief']),
                            gender=b.get('gender', ''), brief_text=b.get('brief', ''), base=norm_base(m['base']), base_label=base_label(m['base']),
                            has_face=face_ref(m['base']) is not None, label=m['label'],
                            strength=m.get('strength') or b.get('strength', 'normal'), upload=b.get('source') == 'upload',
                            desc=_desc(w),
                            status='running' if _alive(m['pid']) else ('done' if has and views_fresh(w, gate) else 'failed'),
                            gate=gate, review=review, quality=q,
                            render_fresh=views_fresh(w, gate) if has else False,
                            face=_face_state(w), face_gen=_gen_meta(w)))
    return out


def _gen_meta(w):
    try:
        return json.loads((w / 'face_gen' / 'meta.json').read_text()) if (w / 'face_gen' / 'face_x4.png').exists() else None
    except (OSError, ValueError):
        return None


def _face_state(w):
    fd = w / 'face'
    if not (fd / 'meta.json').exists():
        return None
    try:
        if _alive(json.loads((fd / 'meta.json').read_text())['pid']):
            return 'running'   # 작업자도 views 를 만들므로 살아 있는 동안은 그리는 중
    except (OSError, ValueError, KeyError):
        pass
    return 'done' if (fd / 'views' / 'face_x4.png').exists() else 'failed'


def _decisions():
    cur = {}
    if DECISIONS.exists():
        for line in DECISIONS.read_text(encoding='utf-8').splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d['decision'] == 'clear':
                cur.pop(d['id'], None)
            else:
                cur[d['id']] = d
    return cur


def export_decisions():
    cur = _decisions()
    EXPORT.write_text(json.dumps(dict(updated=now(), decisions=list(cur.values())), ensure_ascii=False, indent=1) + '\n',
                      encoding='utf-8')
    # 받은 것은 격자·1배 시트를 저장소로 옮긴다(작은 글자 파일 — 다음 단계 번들 등록의 원본)
    # 설명(desc.json)은 <stem>.json 으로 — 조수가 NPC 를 고를 때 읽을 것(label·attributes 는 sharedCharacterGraphics 형식).
    keep = set()
    bs = briefs()
    for d in cur.values():
        if d['decision'] != 'accept':
            continue
        run, dname = d['id'].split('/', 1)
        w = run_dir(run) / dname
        stem = f'{dname}__{run}'
        if not (w / 'out.chr.txt').exists():
            discarded_file = run_dir(run) / 'discarded.json'
            discarded = json.loads(discarded_file.read_text())['characters'] if discarded_file.exists() else []
            if dname not in {row['dir'] for row in discarded}:
                keep.add(stem)  # 과거 실행만 보관된 받은 칩은 이번 정리에서 지우지 않는다.
            continue
        gate = current_gate(w)
        review = read_verdict(w, gate)
        if not quality(w, 'accept', gate, review)['eligible']:
            if not gate.get('discard') and not (review and not review.get('stale') and (review.get('discard') or review.get('fatal'))):
                keep.add(stem)  # 옛 검수 갱신 대기 때문에 이미 받은 사본을 지우지 않는다.
            continue
        keep.add(stem)
        m = json.loads((w / 'meta.json').read_text())
        b = bs.get(m['brief'], {})
        dest = ACCEPTED_LOCAL if b.get('source') == 'upload' else ACCEPTED
        dest.mkdir(parents=True, exist_ok=True)
        shutil.copy(w / 'out.chr.txt', dest / f'{stem}.chr.txt')
        shutil.copy(w / 'views' / 'sheet.png', dest / f'{stem}.png')
        info = dict(id=d['id'], brief=m['brief'], name=b.get('name'), base=norm_base(m['base']), base_label=base_label(m['base']),
                    strength=m.get('strength') or b.get('strength', 'normal'), files=dict(chr=f'{stem}.chr.txt', sheet=f'{stem}.png'),
                    description=_desc(w))
        (dest / f'{stem}.json').write_text(json.dumps(info, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for dest in (ACCEPTED, ACCEPTED_LOCAL):
        for f in dest.glob('*') if dest.exists() else []:
            if f.name.split('.', 1)[0] not in keep:
                f.unlink()


def cmd_serve(a):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import unquote
    web = HERE / 'web' / 'index.html'
    root = (DATA / 'runs').resolve()

    class H(BaseHTTPRequestHandler):
        def log_message(self, *x):
            pass

        def _send(self, code, body, ctype='application/json; charset=utf-8'):
            if isinstance(body, str):
                body = body.encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', ctype)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = unquote(self.path.split('?', 1)[0])
            if path in ('/', '/index.html'):
                return self._send(200, web.read_bytes(), 'text/html; charset=utf-8')
            if path == '/api/state':
                dec = _decisions()
                items = _items()
                for it in items:
                    it['decision'] = dec.get(it['id'])
                return self._send(200, json.dumps(dict(items=items, reasons=REASONS), ensure_ascii=False))
            if path.startswith('/in/'):
                f = (INPUTS / path[4:]).resolve()
                if INPUTS.resolve() not in f.parents or not f.is_file():
                    return self._send(404, 'not found', 'text/plain')
                return self._send(200, f.read_bytes(), 'image/png')
            if path.startswith('/f/'):
                f = (root / path[3:]).resolve()
                if root not in f.parents or not f.is_file():
                    return self._send(404, 'not found', 'text/plain')
                ct = {'.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json',
                      '.zip': 'application/zip', '.html': 'text/html; charset=utf-8'}.get(f.suffix, 'text/plain; charset=utf-8')
                return self._send(200, f.read_bytes(), ct)
            return self._send(404, 'not found', 'text/plain')

        def do_POST(self):
            n = int(self.headers.get('Content-Length') or 0)
            d = json.loads(self.rfile.read(n) or b'{}')
            if self.path == '/api/new':
                return self._new(d)
            if self.path != '/api/decide':
                return self._send(404, '{}')
            if d.get('decision') not in ('accept', 'reject', 'clear') or '/' not in str(d.get('id', '')):
                return self._send(400, '{"error":"bad"}')
            if d['decision'] == 'accept':
                w = root / d['id']
                if not w.is_dir() or root not in w.resolve().parents:
                    return self._send(404, '{"error":"candidate missing"}')
                gate = current_gate(w)
                review = read_verdict(w, gate)
                if not quality(w, 'accept', gate, review)['eligible']:
                    return self._send(409, json.dumps(dict(error='결손/검사 실패 결과는 받을 수 없습니다',
                                                         fails=gate['fails']), ensure_ascii=False))
            rec = dict(id=d['id'], decision=d['decision'], reasons=d.get('reasons') or [], note=d.get('note') or '',
                       client='web', at=now())
            DATA.mkdir(parents=True, exist_ok=True)
            with open(DECISIONS, 'a', encoding='utf-8') as fh:
                fh.write(json.dumps(rec, ensure_ascii=False) + '\n')
            export_decisions()
            return self._send(200, json.dumps(rec, ensure_ascii=False))

        def _new(self, d):
            """그림 넣기: {image: dataURL, name, strengths: [weak|normal|strong], brief} → 칸 × 강도마다 loop 를 띄운다."""
            import io
            try:
                raw = base64.b64decode(str(d.get('image', '')).split(',', 1)[-1])
                strengths = [x for x in d.get('strengths') or [] if x in C.STRENGTH] or ['normal']
                name = (d.get('name') or '올린 그림').strip()[:40]
                up = DATA / 'uploads'
                up.mkdir(parents=True, exist_ok=True)
                f = up / f'{datetime.now():%Y%m%d-%H%M%S}.png'
                Image.open(io.BytesIO(raw)).save(f)
                iid, slots, sc = ingest(f, name)
                keys = add_input_briefs(iid, slots, strengths, name, (d.get('brief') or '').strip())
                run = datetime.now().strftime('%Y%m%d-%H%M%S') + f'-in-{iid}-' + uuid.uuid4().hex[:8]
                p = spawn_loop(keys, run)
            except Exception as e:  # noqa: BLE001 — 화면에 그대로 보여 준다
                return self._send(400, json.dumps(dict(error=str(e)), ensure_ascii=False))
            return self._send(200, json.dumps(dict(id=iid, slots=slots, selfcheck=sc, briefs=keys, run=run, pid=p.pid),
                                              ensure_ascii=False))

    print(f'http://mdc-server:{a.port}/', flush=True)
    ThreadingHTTPServer(('0.0.0.0', a.port), H).serve_forever()


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('calibrate').set_defaults(fn=cmd_calibrate)
    p = sp.add_parser('base')
    p.add_argument('n', help='Actor2:3 처럼 (정수는 Actor1)')
    p.add_argument('out')
    p.set_defaults(fn=cmd_base)
    p = sp.add_parser('check')
    p.add_argument('file')
    p.add_argument('--base', help='Actor2:3 처럼 (정수는 Actor1)')
    p.add_argument('--strength', default='normal', choices=list(C.STRENGTH))
    p.set_defaults(fn=cmd_check)
    p = sp.add_parser('propagate', help='걸음 0·2 를 서 있는 자세에서 다시 만든다')
    p.add_argument('file')
    p.add_argument('--base', required=True)
    p.add_argument('--no-keep', action='store_true', help='작업자 원본(out.worker.chr.txt)을 남기지 않는다')
    p.add_argument('--strength', default='normal', choices=list(C.STRENGTH))
    p.set_defaults(fn=cmd_propagate)
    p = sp.add_parser('views')
    p.add_argument('file')
    p.add_argument('out')
    p.add_argument('--base', help='Actor2:3 처럼 (정수는 Actor1)')
    p.add_argument('--strength', default='normal', choices=list(C.STRENGTH))
    p.set_defaults(fn=cmd_views)
    p = sp.add_parser('draw')
    p.add_argument('brief')
    p.add_argument('--engine', choices=list(ENGINES), required=True)
    p.add_argument('--run')
    p.add_argument('--force', action='store_true')
    p.add_argument('--src', help='수정 작업: 다른 작업자의 작업 폴더(out.chr.txt 가 있는 곳)')
    p.add_argument('--tag', help='수정 작업 폴더 이름 꼬리(기본: 원본 엔진 이름)')
    p.add_argument('--fix-notes', help='수정 작업: 감독의 지적 파일')
    p.set_defaults(fn=cmd_draw)
    p = sp.add_parser('status')
    p.add_argument('--run')
    p.set_defaults(fn=cmd_status)
    p = sp.add_parser('page')
    p.add_argument('--run', required=True)
    p.set_defaults(fn=cmd_page)
    p = sp.add_parser('loop', help='그리기 → 검수 → 지적대로 고치기 반복(검수 PASS 또는 rounds 까지)')
    p.add_argument('briefs', nargs='+')
    p.add_argument('--run')
    p.add_argument('--drawer', default='gpt', choices=list(ENGINES))
    p.add_argument('--reviewer', default='sonnet', choices=list(ENGINES))
    p.add_argument('--par', type=int, default=6)
    p.add_argument('--rounds', type=int, default=1)
    p.add_argument('--face', default='sonnet', help='칩이 끝나면 짝 얼굴을 붙일 엔진(빈 문자열이면 안 붙임)')
    p.add_argument('--no-gen-face', action='store_true', help='손 도트 얼굴 뒤 생성 얼굴(v3)을 건너뛴다')
    p.add_argument('--no-propagate', action='store_true', help='걸음 0·2 를 작업자가 그린 그대로 둔다')  # 2026-10-02 사용자 판단: 원샷이 제일 낫다 — 반복 고치기는 명시할 때만
    p.set_defaults(fn=cmd_loop)
    p = sp.add_parser('serve', help='받기/버리기 화면')
    p.add_argument('--port', type=int, default=18314)
    p.set_defaults(fn=cmd_serve)
    p = sp.add_parser('face-check')
    p.add_argument('file')
    p.add_argument('--base', required=True)
    p.set_defaults(fn=cmd_face_check)
    p = sp.add_parser('face-views')
    p.add_argument('file')
    p.add_argument('out')
    p.add_argument('--base', required=True)
    p.set_defaults(fn=cmd_face_views)
    p = sp.add_parser('faces', help='완성된 칩에 짝 얼굴(48×48)을 붙인다')
    p.add_argument('--run', required=True)
    p.add_argument('--engine', default='sonnet', choices=list(ENGINES))
    p.add_argument('--par', type=int, default=6)
    p.add_argument('--redo', action='store_true')
    p.set_defaults(fn=cmd_faces)
    p = sp.add_parser('gen-faces', help='얼굴을 이미지 생성으로(칩은 손 도트 그대로)')
    p.add_argument('--run', required=True)
    p.add_argument('--par', type=int, default=6)
    p.add_argument('--only', help='brief 이름 쉼표 목록')
    p.add_argument('--redo', action='store_true')
    p.add_argument('--reuse', action='store_true', help='이미 뽑은 raw 를 다시 자르고 다시 판정, 모자라면 새로 뽑기')
    p.set_defaults(fn=cmd_gen_faces)
    p = sp.add_parser('ingest', help='올린 CharSet 그림을 뼈대로 넣는다(input:<id>:<칸>) — --go 면 바로 loop')
    p.add_argument('image')
    p.add_argument('--name')
    p.add_argument('--strength', default='normal', help='weak,normal,strong 쉼표 목록(칸마다 강도별로 하나씩)')
    p.add_argument('--brief', help='무엇으로 바꿀지(없으면 작업자가 강도 안에서 정한다)')
    p.add_argument('--slot', type=int, nargs='+', help='쓸 칸 번호(0부터, 기본 캐릭터가 있는 칸 전부)')
    p.add_argument('--go', action='store_true')
    p.add_argument('--run')
    p.add_argument('--drawer', default='gpt', choices=list(ENGINES))
    p.set_defaults(fn=cmd_ingest)
    p = sp.add_parser('describe', help='완성된 칩에 설명(desc.json)을 붙인다 — 조수가 읽을 것')
    p.add_argument('--run')
    p.add_argument('--only')
    p.add_argument('--accepted', action='store_true', help='받은 것만')
    p.add_argument('--redo', action='store_true')
    p.add_argument('--par', type=int, default=6)
    p.set_defaults(fn=cmd_describe)
    sp.add_parser('export', help='결정을 harness-data/charset-actor/decisions.json·accepted/ 로').set_defaults(
        fn=lambda a: export_decisions())
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
