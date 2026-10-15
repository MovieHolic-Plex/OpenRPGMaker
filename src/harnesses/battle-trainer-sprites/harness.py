#!/usr/bin/env python3
"""전투 트레이너 스프라이트 하네스 — 몬스터 수집(포켓몬류) 전용 전투 인물 그림(64x64)을 Argon 이 격자 행 문자열로 국소 편집해 변형한다.

p3 부터 기본 모드 = chip: 소스는 harness-data/battle-trainer-sprites/source/ 의 몬스터 수집 캠페인 전투 인물 64x64 이다(Actor1 아님).
p1(redraw)·p2(Actor1 24x32 편집)는 소스가 틀려 폐기 — 시트는 보존만 하고 bake 는 거절한다.

  harness.py list                                  역할(12)과 원본 블록
  harness.py draw [역할|all] [--n 5] [--par 5] [--plate p1] [--throw]
                                                   후보를 그린다(agy gemini-4-argon-medium, 바로 안 돌아옴). 판 id 출력
  harness.py status [판]                           판·후보 상태
  harness.py sheet <판>                            고르는 시트를 ~/claude-viz/trainer-sprites-pick-<번호>.html 에 쓴다(자체완결)
  harness.py pick <판> 역할=글자 [...]             사용자가 고른 후보를 기록(현재 그림 해시에 묶임)
  harness.py bake <판> [역할 ...]                  고른 것만 public/assets/battle-trainers/<역할>/ 에 굽는다(고르기 전엔 거절)

규칙: 이미지 생성 도구 금지(Argon 이 행 문자열을 직접 쓴다). 감독·에이전트는 후보를 고르지 않는다. 사람 선택 경로이며 object-gate 영수증은 없다.
"""
import argparse, base64, concurrent.futures as cf, datetime, hashlib, json, os, re, shutil, subprocess, sys, threading, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.join(ROOT, 'harness-data/battle-trainer-sprites')
RUNS = os.path.join(ROOT, 'qa-runs/harnesses/battle-trainer-sprites')
BUNDLE = os.path.join(ROOT, 'public/assets/battle-trainers')
VIZ = os.path.expanduser('~/claude-viz')
MODEL = os.environ.get('TRAINER_HARNESS_MODEL', 'gemini-4-argon-medium')
TIMEOUT = int(os.environ.get('TRAINER_HARNESS_TIMEOUT', str(20 * 60)))
MAX_ATTEMPTS = int(os.environ.get('TRAINER_HARNESS_ATTEMPTS', '3'))
SYMS = 'KHhcCsSWgGbBrRoOyYpPtTlLmMnNdDeEfFiIjJkQuUvVxXzZ0123456789'
LOCK = threading.Lock()


def now(): return datetime.datetime.now().isoformat(timespec='seconds')
def seed(): return json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))
def agy_bin(): return shutil.which('agy') or os.path.expanduser('~/.local/bin/agy')


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def read_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError:
        return default


def ascii_of(img):
    """투명=. , 색은 빈도순 글자. (격자 문자열, {글자: '#rrggbb'}) 반환."""
    px = img.load(); counts = {}
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3] >= 128: counts[p[:3]] = counts.get(p[:3], 0) + 1
    order = sorted(counts, key=lambda c: -counts[c])
    sym = {c: SYMS[i] for i, c in enumerate(order)}
    rows = []
    for y in range(img.height):
        rows.append(''.join(sym[px[x, y][:3]] if px[x, y][3] >= 128 else '.' for x in range(img.width)))
    return rows, {sym[c]: '#%02x%02x%02x' % c for c in order}


def enlarged(img, k, path):
    bg = Image.new('RGBA', (img.width * k, img.height * k), (96, 140, 96, 255))
    bg.alpha_composite(img.resize((img.width * k, img.height * k), Image.NEAREST))
    bg.convert('RGB').save(path)


# ---------- 도우미 ----------

NO_GEN = ("이미지 생성 기능·image-generator 서브에이전트·이미지 API 는 절대 쓰지 마라. "
          "원/다각형/수식으로 몸을 합성하는 코드도 금지다. 네가 모든 행의 문자열을 직접 손으로 적어라(파일 쓰기 도구로 grid.txt 에 그대로 쓴다). "
          "허용되는 코드는 grid.txt 를 PNG 로 굽는 아주 작은 확인용 스크립트뿐이다.")


def run_agy(cwd, prompt, label):
    t0 = time.time()
    try:
        r = subprocess.run([agy_bin(), '-p', prompt, '--model', MODEL, '--output-format', 'text'], cwd=cwd,
                           capture_output=True, text=True, timeout=TIMEOUT)
        out = (r.stdout or '') + (r.stderr or '')
        code = r.returncode
    except subprocess.TimeoutExpired:
        out, code = 'timeout', 124
    open(os.path.join(cwd, 'agy-%s.log' % label), 'w').write('exit=%s sec=%.0f\n%s' % (code, time.time() - t0, out[-4000:]))
    return code


def attempt_dir(cdir, n): return os.path.join(cdir, 'attempts', '%d' % n)


# ---------- 격자 읽기·검사 ----------

def parse_hex(v):
    v = v.strip().lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def render(rows, pal):
    h = len(rows); w = len(rows[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': px[x, y] = pal[ch] + (255,)
    return im


def pixels(im):
    return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())


def sha(im): return hashlib.sha256(im.tobytes()).hexdigest()[:16]


def grid_to_rgb(rows, pal):
    return [[(pal[ch] + (255,)) if ch != '.' else (0, 0, 0, 0) for ch in r] for r in rows]


def changed_ratio(src_rgb, new_rgb):
    n = c = 0
    for ra, rb in zip(src_rgb, new_rgb):
        for a, b in zip(ra, rb):
            if a[3] or b[3]:
                n += 1
                if a != b: c += 1
    return (c / n if n else 0.0), c, n


def load_grid_n(grid_path, pal_path, size):
    w, h = size; errs = []
    try:
        rows = [ln.rstrip('\n') for ln in open(grid_path, encoding='utf-8')]
    except FileNotFoundError:
        return None, ['grid.txt 가 없다']
    while rows and rows[-1] == '': rows.pop()
    try:
        pal = {k: parse_hex(v) for k, v in json.load(open(pal_path)).items() if k != '.'}
    except Exception as e:
        return None, ['palette.json 읽기 실패: %s' % e]
    if len(rows) != h: errs.append('줄 수 %d (%d 여야 함)' % (len(rows), h))
    bad = [i for i, r in enumerate(rows) if len(r) != w]
    if bad: errs.append('길이가 %d 가 아닌 줄: %s' % (w, bad[:10]))
    unk = sorted({ch for r in rows for ch in r if ch != '.' and ch not in pal})
    if unk: errs.append('팔레트에 없는 글자: %s' % ''.join(unk))
    if errs: return None, errs
    return (rows, pal), []


# ---------- chip 방식(p3~): 몬스터 수집 전용 전투 인물 64x64 를 국소 편집 ----------

def chip_seed(): return seed()['chip']


def chip_source(role):
    spec = chip_seed()['roles'][role]
    return Image.open(os.path.join(ROOT, chip_seed()['dir'], spec['file'])).convert('RGBA')


def mask_change(src, new):
    a, b = src.load(), new.load(); n = d = 0
    for y in range(src.height):
        for x in range(src.width):
            sa, sb = a[x, y][3] > 0, b[x, y][3] > 0
            if sa: n += 1
            if sa != sb: d += 1
    return d / n if n else 0.0


def chip_prompt(role, spec, letter, inten, srows, spal, fb=''):
    cs = chip_seed()
    vname = '앞모습' if spec['view'] == 'front' else '뒷모습'
    pal_lines = '\n'.join('  %s = %s' % (k, v) for k, v in spal.items())
    return f"""@source_8x.png 는 몬스터 수집 RPG 전용 전투 트레이너 도트 그림의 {vname}(64x64, 8배 확대, 배경은 임의 초록)이다. 아래 ASCII 가 같은 그림의 정확한 원본 격자다.
{NO_GEN}

[과제] 새로 그리지 마라. 이 그림을 **국소 편집**해 '{spec['label']}' 로 만든다. 실루엣·윤곽 색·명암 톤·팔레트 구조·얼굴(또는 뒷머리) 위치와 크기·도트 밀도를 원본 그대로 유지하고, 아래 지시한 칸만 바꾼다. 3세대 비율로 키우거나 새로 재창작하지 마라.
편집 지시: {spec['edit']}
이번 후보({letter})의 변경 강도: {inten['label']} — {inten['how']}
규칙: 바꾸지 않은 칸은 원본과 같은 글자(같은 색)여야 한다. 원본 대비 바뀐 칸이 불투명 칸 기준 {int(cs['max_changed_ratio'] * 100)}% 를 넘거나, 투명/불투명이 바뀐 칸(실루엣 변화)이 원본 불투명 칸의 {int(cs['max_mask_change'] * 100)}% 를 넘으면 검사에서 거절된다. 색은 같은 명암 단계끼리 갈아 끼우듯 바꾼다(어두운 단계는 어두운 단계로, 하이라이트는 하이라이트로). 새 색은 {cs['max_new_colors']}개까지, 원본에 없는 새 글자로 palette.json 에 추가한다.
원작 포켓몬 캐릭터 닮은꼴 금지. 몬스터볼을 새로 그리지 마라(원본에 이미 있는 손의 공은 그대로 둔다).

[원본 격자 64x64] ('.'=투명, 64줄 x 64글자)
{chr(10).join(srows)}
[원본 팔레트]
{pal_lines}

[산출물] 현재 폴더에 두 파일을 쓴다.
1. grid.txt — 정확히 64줄, 각 줄 정확히 64글자(원본과 같은 크기). 전체 격자를 다시 쓴다.
2. palette.json — {{"글자": "#rrggbb", ...}} (사용한 모든 글자, '.' 제외. 원본 글자의 색을 바꿔 쓰면 그 글자의 새 색으로 적는다).
쓴 뒤 grid.txt 를 PNG(preview.png, 8배)로 굽는 확인용 스크립트로 직접 열어 원본과 나란히 비교하라. 윤곽이 끊기거나 원본과 다른 칸이 의도보다 많으면 고쳐 grid.txt 를 다시 써라. 끝나면 'done' 한 단어만 답하라.
{fb}"""


def make_chip_candidate(plate, role, letter, throw=False):
    cs = chip_seed(); spec = cs['roles'][role]
    cdir = os.path.join(RUNS, plate, role, letter); os.makedirs(cdir, exist_ok=True)
    meta_path = os.path.join(cdir, 'meta.json'); meta = read_json(meta_path, {})
    if meta.get('status') == 'ok': return meta
    src = chip_source(role)
    src.save(os.path.join(cdir, 'source.png')); enlarged(src, 8, os.path.join(cdir, 'source_8x.png'))
    meta.update({'role': role, 'letter': letter, 'view': spec['view'], 'mode': 'chip', 'source_file': spec['file'], 'started': now()})
    if spec['mode'] == 'asis':
        src.save(os.path.join(cdir, 'sprite.png')); enlarged(src, 8, os.path.join(cdir, 'sprite_8x.png'))
        meta.update({'status': 'ok', 'model': None, 'hash': sha(src), 'edit': {'ratio': 0.0, 'changed': 0, 'cells': 0, 'asis': True},
                     'colors': len({c for c in pixels(src) if c[3]}), 'warnings': [], 'finished': now(), 'throw': {'status': 'skipped'}})
        write_json(meta_path, meta); return meta
    meta['model'] = MODEL
    srows, spal = ascii_of(src)
    src_rgb = grid_to_rgb(srows, {k: parse_hex(v) for k, v in spal.items()})
    write_json(os.path.join(cdir, 'source.json'), {'file': spec['file'], 'rows': srows, 'palette': spal})
    inten = cs['intensity'][letter]
    fb = ''
    meta['attempts'] = meta.get('attempts', [])
    for n in range(len(meta['attempts']) + 1, MAX_ATTEMPTS + 1):
        if not fb:
            for f in ('grid.txt', 'palette.json'):
                try: os.remove(os.path.join(cdir, f))
                except FileNotFoundError: pass
        code = run_agy(cdir, chip_prompt(role, spec, letter, inten, srows, spal, fb), 'try%d' % n)
        rec = {'n': n, 'agy_exit': code, 'at': now()}
        ld, errs = load_grid_n(os.path.join(cdir, 'grid.txt'), os.path.join(cdir, 'palette.json'), (64, 64))
        if ld:
            new = render(*ld)
            ratio, c, nn = changed_ratio(src_rgb, grid_to_rgb(*ld))
            mc = mask_change(src, new)
            newcols = {c2[:3] for c2 in pixels(new) if c2[3]} - {c2[:3] for c2 in pixels(src) if c2[3]}
            if ratio > cs['max_changed_ratio']: errs.append('원본 대비 변경 셀 %.0f%% (최대 %d%%) — 지시한 칸만 바꿔라' % (ratio * 100, cs['max_changed_ratio'] * 100))
            if ratio < 0.01: errs.append('원본과 거의 같다(변경 %.1f%%) — 지시한 편집이 보이지 않는다' % (ratio * 100))
            if mc > cs['max_mask_change']: errs.append('실루엣(투명/불투명)이 원본과 %.0f%% 달라졌다(최대 %d%%) — 윤곽을 유지하라' % (mc * 100, cs['max_mask_change'] * 100))
            if len(newcols) > cs['max_new_colors']: errs.append('새 색 %d개(최대 %d)' % (len(newcols), cs['max_new_colors']))
            st = {'ratio': round(ratio, 4), 'changed': c, 'cells': nn, 'mask': round(mc, 4), 'new_colors': len(newcols)}
            rec['edit'] = st
            if not errs:
                new.save(os.path.join(cdir, 'sprite.png')); enlarged(new, 8, os.path.join(cdir, 'sprite_8x.png'))
                shutil.copy(os.path.join(cdir, 'grid.txt'), os.path.join(cdir, 'grid.final.txt'))
                shutil.copy(os.path.join(cdir, 'palette.json'), os.path.join(cdir, 'palette.final.json'))
                meta.update({'status': 'ok', 'hash': sha(new), 'edit': st, 'warnings': [], 'colors': len({c2 for c2 in pixels(new) if c2[3]}),
                             'throw': {'status': 'skipped'}})
                rec['errors'] = []; meta['attempts'].append(rec); break
        rec['errors'] = errs; meta['attempts'].append(rec)
        adir = attempt_dir(cdir, n); os.makedirs(adir, exist_ok=True)
        for f in ('grid.txt', 'palette.json', 'agy-try%d.log' % n):
            if os.path.exists(os.path.join(cdir, f)): shutil.copy(os.path.join(cdir, f), adir)
        fb = ('\n[이전 시도 실패] 폴더의 grid.txt/palette.json 은 검사에서 떨어졌다: ' + '; '.join(errs)
              + '. 같은 설계를 유지하되 위 문제만 고쳐 grid.txt 와 palette.json 을 다시 써라.')
        write_json(meta_path, meta)
    else:
        meta['status'] = 'failed'
    meta['finished'] = now(); write_json(meta_path, meta)
    return meta


# ---------- 명령 ----------

def next_plate():
    os.makedirs(RUNS, exist_ok=True)
    nums = [int(m.group(1)) for d in os.listdir(RUNS) if (m := re.fullmatch(r'p(\d+)', d))]
    return 'p%d' % (max(nums, default=2) + 1)


def plate_mode(plate): return read_json(os.path.join(RUNS, plate, 'plate.json'), {}).get('mode')


def cmd_list(a):
    for k, v in chip_seed()['roles'].items():
        print('%-14s %-18s %s  소스 %s (%s)' % (k, v['label'], v['view'], v['file'], '그대로' if v['mode'] == 'asis' else '국소 편집'))
    print('남은 역할(소스 대응만 정해 둠):', ', '.join('%s←%s' % kv for kv in chip_seed()['future_sources'].items()))


def cmd_draw(a):
    cs = chip_seed()
    roles = [r for r in cs['roles'] if cs['roles'][r].get('draw', True)] if a.role in (None, 'all') else a.role.split(',')
    for r in roles:
        if r not in cs['roles']: sys.exit('모르는 역할: %s' % r)
    plate = a.plate or next_plate()
    letters_all = list(cs['intensity'])[:a.n]
    jobs = [(r, l) for r in roles for l in (['A'] if cs['roles'][r]['mode'] == 'asis' else letters_all)]
    os.makedirs(os.path.join(RUNS, plate), exist_ok=True)
    write_json(os.path.join(RUNS, plate, 'plate.json'), {'plate': plate, 'model': MODEL, 'roles': roles, 'letters': letters_all, 'created': now(),
                                                         'mode': 'chip', 'method': 'agy-argon-edit-monster-collect-trainer-64x64 (no image generation)'})
    print(plate, 'jobs=%d par=%d' % (len(jobs), a.par), flush=True)
    if a.background:
        log = open(os.path.join(RUNS, plate, 'draw.log'), 'a')
        subprocess.Popen([sys.executable, __file__, 'draw', ','.join(roles), '--n', str(a.n), '--par', str(a.par), '--plate', plate], stdout=log, stderr=log, start_new_session=True)
        print('백그라운드로 시작:', os.path.join(RUNS, plate, 'draw.log'))
        return
    def one(j):
        m = make_chip_candidate(plate, j[0], j[1])
        print('%s/%s %s' % (j[0], j[1], m.get('status')), flush=True)
    with cf.ThreadPoolExecutor(a.par) as ex: list(ex.map(one, jobs))
    print('끝', plate)


def plate_cands(plate):
    out = {}
    pdir = os.path.join(RUNS, plate)
    for role in os.listdir(pdir):
        rdir = os.path.join(pdir, role)
        if not os.path.isdir(rdir): continue
        out[role] = {l: read_json(os.path.join(rdir, l, 'meta.json'), {}) for l in sorted(os.listdir(rdir)) if os.path.isdir(os.path.join(rdir, l))}
    return out


def cmd_status(a):
    plates = [a.plate] if a.plate else sorted(d for d in os.listdir(RUNS) if re.fullmatch(r'p\d+', d)) if os.path.isdir(RUNS) else []
    for p in plates:
        print('==', p, '(%s)' % (plate_mode(p) or '폐기: 옛 소스 Actor1'))
        for role, cs in plate_cands(p).items():
            print('  %-14s %s' % (role, ' '.join('%s:%s%s' % (l, m.get('status', '?'), ('(%d%%)' % round(m['edit']['ratio'] * 100)) if m.get('edit') else '') for l, m in cs.items())))
    picks = read_json(os.path.join(DATA, 'picks.json'), {})
    print('picks:', json.dumps(picks, ensure_ascii=False) if picks else '(없음 — 사용자가 고르기 전)')


def data_uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def cmd_sheet(a):
    if plate_mode(a.plate) != 'chip': sys.exit('%s 는 폐기된 옛 소스(Actor1) 판이다 — 시트를 다시 만들지 않는다' % a.plate)
    cs = chip_seed(); cands = plate_cands(a.plate)
    num = a.plate.lstrip('p')
    name = 'trainer-sprites-pick-%s.html' % num
    cards = []; roles_js = {}
    order = [r for r in cs['roles'] if r in cands]
    for role in order:
        spec = cs['roles'][role]; view = spec['view']; cdict = cands[role]
        src_uri = data_uri(os.path.join(RUNS, a.plate, role, sorted(cdict)[0], 'source.png'))
        ok = [(l, m) for l, m in cdict.items() if m.get('status') == 'ok']
        fail = [l for l, m in cdict.items() if m.get('status') != 'ok']
        busy = lambda m: m.get('status') not in ('ok', 'failed')
        items = []
        roles_js[role] = {'view': view, 'cands': {}}
        for l, m in ok:
            uri = data_uri(os.path.join(RUNS, a.plate, role, l, 'sprite.png'))
            roles_js[role]['cands'][l] = {'sprite': uri}
            e = m.get('edit') or {}
            lab = '소스 그대로' if e.get('asis') else '변경 %d%% · 실루엣 %d%% · 새 색 %d' % (round(e['ratio'] * 100), round(e['mask'] * 100), e['new_colors'])
            items.append(f'<div class=cand data-role="{role}" data-l="{l}"><div class=lt>{l}</div><div class=bg><img class=px data-w=64 src="{uri}"></div>'
                         f'<div class=hs>{m["hash"]} · {m["colors"]}색 · {lab}</div></div>')
        for l in fail:
            items.append(f'<div class="cand failed"><div class=lt>{l}</div><div class=hs>{"아직 그리는 중" if busy(cdict[l]) else "검사 탈락(기록 %d회)" % len(cdict[l].get("attempts", []))}</div></div>')
        note = '<div class=hs>던지기 프레임: 소스 hero_back 자체가 오른팔로 볼을 쥔 던지기 자세 1장입니다. 별도 던지기 프레임은 만들지 않았습니다.</div>' if view == 'back' else ''
        cards.append(f'<section><h3>{spec["label"]} <small>({role}, {"앞" if view == "front" else "뒤"}) — {spec["brief"]}</small></h3>'
                     f'<div class=row><div class=src><div class=bg><img class=px data-w=64 src="{src_uri}"></div><div class=hs>원본 · {spec["file"]}</div></div>{"".join(items)}</div>{note}</section>')
    dirs = '<br>'.join('<b>%s</b> %s — %s' % (k, v['label'], v['how']) for k, v in cs['intensity'].items())
    html = TEMPLATE.replace('@@CARDS@@', '\n'.join(cards)).replace('@@ROLES@@', json.dumps(roles_js)).replace('@@PLATE@@', a.plate) \
        .replace('@@ROLELIST@@', ' '.join('<code>%s</code>' % r for r in order)).replace('@@DIRS@@', dirs)
    os.makedirs(VIZ, exist_ok=True)
    out = os.path.join(VIZ, name)
    open(out, 'w', encoding='utf-8').write(html)
    print(out, len(html) // 1024, 'KB')


TEMPLATE = r"""<!doctype html><meta charset=utf-8><title>트레이너 스프라이트 고르기 @@PLATE@@</title>
<style>
body{background:#1c2230;color:#e8ecf4;font:14px/1.5 -apple-system,'Noto Sans KR',sans-serif;margin:0;padding:16px 24px 60px}
h1{font-size:20px;margin:0 0 6px}h3{margin:22px 0 6px;font-size:15px}h3 small{font-weight:400;color:#9fb0c8}
.how{background:#26304a;border:1px solid #3c4a6e;border-radius:8px;padding:10px 14px;margin:8px 0;max-width:1000px}
code{background:#10151f;padding:1px 6px;border-radius:4px;color:#ffd78a}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}
.cand,.src{background:#232b3d;border:2px solid #323d58;border-radius:8px;padding:8px;cursor:pointer;position:relative}
.src{cursor:default;border-style:dashed}
.cand.sel{border-color:#ffd78a;background:#2e3550}.cand.failed{opacity:.45;cursor:default}
.bg{background:#5a9a5a;display:inline-block;line-height:0}
.px{image-rendering:pixelated}
.lt{position:absolute;top:4px;left:8px;font-weight:700;color:#ffd78a;z-index:2;text-shadow:0 0 3px #000}
.hs{font-size:11px;color:#8da0bb;margin-top:4px}.w{font-size:11px;color:#f0a070}
.thr{margin-top:6px}.anim{width:64px;height:64px;image-rendering:pixelated;background-size:auto 100%;animation:thr 0.9s steps(1) infinite}
@keyframes thr{0%{background-position:0 0}33%{background-position:-64px 0}66%{background-position:-128px 0}}
.bar{position:sticky;top:0;background:#1c2230ee;padding:6px 0;z-index:5;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
button{background:#3a4770;color:#fff;border:0;border-radius:6px;padding:5px 12px;cursor:pointer}button.on{background:#c79a2a;color:#111}
#cmd{width:100%;max-width:1000px;background:#10151f;color:#ffd78a;border:1px solid #3c4a6e;padding:6px;font-family:monospace}
#bat{border:2px solid #3c4a6e;image-rendering:pixelated;background:#000}
</style>
<h1>트레이너 스프라이트 후보 시트 (@@PLATE@@) — 왼쪽 몬스터 수집 전용 원본 | 오른쪽 Argon 이 격자로 편집한 결과</h1>
<div class=how><b>고르는 방법</b> — 카드를 눌러 역할마다 하나씩 고르면 맨 아래 칸에 <code>pick</code> 명령이 만들어집니다. 번호만 말해 주셔도 됩니다: 예) <code>hero_m=B hero_f=A boy=C …</code> (역할: @@ROLELIST@@).
고르기 전에는 번들·프로젝트에 아무것도 들어가지 않습니다. 후보 방향: <br>@@DIRS@@<br>
이 그림은 사람 캐릭터라 3/4 윗면 관문 대상이 아닙니다(object-gate 영수증 없음, 사람 선택 경로). 소스: 몬스터 수집 캠페인 전용 전투 인물 그림(저장소 소유, GPT 이미지 생성 원본을 64×64 로 추출) — Actor1(EasyRPG)·Nintendo 원작 그림 아님. 편집은 소스 도트 밀도 그대로(확대 없음), 변경 셀 ≤40%·실루엣 변경 ≤10% 를 하네스가 검사합니다.</div>
<div class=bar>배율 <span id=sc></span> · 같은 배율로 원본과 나란히 봅니다</div>
<h3>전투 화면 합성 미리보기 (480×320, 임시 배경) — 아래에서 카드를 누르면 바뀝니다 · 상대는 마지막에 누른 앞모습, 내 트레이너는 마지막에 누른 뒷모습</h3>
<canvas id=bat width=480 height=320></canvas>
@@CARDS@@
<h3>선택 결과</h3><textarea id=cmd rows=3 readonly></textarea>
<script>
const R=@@ROLES@@; const sel={}; let scale=4, opp=null, hero=null;
function setScale(s){scale=s;document.querySelectorAll('.px').forEach(i=>i.style.width=(+i.dataset.w*s)+'px');
 document.querySelectorAll('.anim').forEach(a=>{a.style.width=(64*s)+'px';a.style.height=(64*s)+'px'});
 document.querySelectorAll('#sc button').forEach(b=>b.classList.toggle('on',+b.dataset.s===s));
 // anim keyframes use px offsets of 1x; rescale with CSS var instead
 document.documentElement.style.setProperty('--s',s)}
const sc=document.getElementById('sc');[2,4,8].forEach(s=>{const b=document.createElement('button');b.textContent=s+'×';b.dataset.s=s;b.onclick=()=>setScale(s);sc.appendChild(b)});
const st=document.createElement('style');document.head.appendChild(st);
function animCss(){st.textContent='@keyframes thr{0%{background-position:0 0}33%{background-position:-'+(64*scale)+'px 0}66%{background-position:-'+(128*scale)+'px 0}}'}
const oSet=setScale;setScale=function(s){oSet(s);animCss()};
const imgs={};function img(u){if(!imgs[u]){const i=new Image();i.src=u;imgs[u]=i}return imgs[u]}
function drawBat(){const c=document.getElementById('bat'),g=c.getContext('2d');g.imageSmoothingEnabled=false;
 const gr=g.createLinearGradient(0,0,0,320);gr.addColorStop(0,'#bfe6f4');gr.addColorStop(.45,'#d9f0d0');gr.addColorStop(.46,'#7fc06a');gr.addColorStop(1,'#4f9a48');g.fillStyle=gr;g.fillRect(0,0,480,320);
 g.fillStyle='#8cc77a';g.beginPath();g.ellipse(360,130,90,22,0,0,7);g.fill();g.fillStyle='#6aab58';g.beginPath();g.ellipse(110,262,110,26,0,0,7);g.fill();
 if(hero&&sel[hero]){const u=R[hero].cands[sel[hero]].sprite;const i=img(u);const f=()=>g.drawImage(i,112-64,238-62*2-2,128,128);if(i.complete)f();else i.onload=drawBat}
 if(opp&&sel[opp]){const u=R[opp].cands[sel[opp]].sprite;const i=img(u);if(i.complete)g.drawImage(i,368-64,210-62*2-2,128,128);else i.onload=drawBat}}
function cmd(){const parts=Object.entries(sel).map(([r,l])=>r+'='+l);
 document.getElementById('cmd').value=parts.length?('npm run harness -- battle-trainer-sprites pick @@PLATE@@ '+parts.join(' ')):'(아직 고른 것이 없습니다)'}
document.querySelectorAll('.cand:not(.failed)').forEach(c=>c.onclick=()=>{const r=c.dataset.role,l=c.dataset.l;sel[r]=l;
 document.querySelectorAll('.cand[data-role="'+r+'"]').forEach(x=>x.classList.toggle('sel',x===c));
 if(R[r].view==='back')hero=r;else opp=r;drawBat();cmd()});
// 초기: 각 역할 A(없으면 첫 후보)를 미리보기 기본으로만 사용, 선택 기록은 비움
const first=r=>Object.keys(R[r].cands)[0];
for(const r in R){if(R[r].view==='back'&&!hero){hero=r}if(R[r].view==='front'&&!opp){opp=r}}
const def={};for(const r in R)def[r]=first(r);
const origDraw=drawBat;drawBat=function(){const sv={...sel};for(const r in def)if(!(r in sel))sel[r]=def[r];origDraw();for(const k of Object.keys(sel))if(!(k in sv))delete sel[k]};
setScale(4);drawBat();cmd();
</script>"""


def cmd_pick(a):
    if plate_mode(a.plate) != 'chip': sys.exit('%s 는 폐기된 옛 소스(Actor1) 판이다 — 고르지 않는다' % a.plate)
    picks = read_json(os.path.join(DATA, 'picks.json'), {})
    cur = picks.setdefault(a.plate, {})
    for kv in a.picks:
        role, _, letter = kv.partition('=')
        m = read_json(os.path.join(RUNS, a.plate, role, letter, 'meta.json'))
        if not m or m.get('status') != 'ok': sys.exit('%s=%s 는 통과한 후보가 아니다' % (role, letter))
        cur[role] = {'letter': letter, 'hash': m['hash'], 'at': now()}
    write_json(os.path.join(DATA, 'picks.json'), picks)
    print(json.dumps(cur, ensure_ascii=False))


def cmd_bake(a):
    if plate_mode(a.plate) != 'chip': sys.exit('%s 는 폐기된 옛 소스(Actor1) 판이다 — 굽지 않는다' % a.plate)
    cs = chip_seed(); picks = read_json(os.path.join(DATA, 'picks.json'), {}).get(a.plate, {})
    roles = a.roles or list(picks)
    if not picks or not roles: sys.exit('사용자가 고르기 전에는 굽지 않는다(picks.json 에 %s 기록 없음). pick 먼저.' % a.plate)
    index = read_json(os.path.join(BUNDLE, 'index.json'), {'version': 1, 'trainers': {}})
    for role in roles:
        if role not in picks: sys.exit('%s 는 고른 기록이 없다' % role)
        p = picks[role]; cdir = os.path.join(RUNS, a.plate, role, p['letter'])
        im = Image.open(os.path.join(cdir, 'sprite.png')).convert('RGBA')
        if sha(im) != p['hash']: sys.exit('%s: 고른 뒤 그림이 바뀌었다(해시 불일치) — 다시 고르게 해야 한다' % role)
        view = cs['roles'][role]['view']
        odir = os.path.join(BUNDLE, role); os.makedirs(odir, exist_ok=True)
        shutil.copy(os.path.join(cdir, 'sprite.png'), os.path.join(odir, '%s.png' % view))
        index['trainers'][role] = {'role': role, 'label': cs['roles'][role]['label'], 'view': view, 'size': [64, 64], 'footY': 62,
                                   'source': 'OPRN monster-collect trainer art (repo-owned, GPT image generation extracted to 64x64), locally edited', view: '%s.png' % view}
        print('baked', role, p['letter'])
    write_json(os.path.join(BUNDLE, 'index.json'), index)


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('list')
    d = sp.add_parser('draw'); d.add_argument('role', nargs='?'); d.add_argument('--n', type=int, default=5); d.add_argument('--par', type=int, default=5)
    d.add_argument('--plate'); d.add_argument('--background', action='store_true')
    st = sp.add_parser('status'); st.add_argument('plate', nargs='?')
    sh = sp.add_parser('sheet'); sh.add_argument('plate')
    pk = sp.add_parser('pick'); pk.add_argument('plate'); pk.add_argument('picks', nargs='+')
    bk = sp.add_parser('bake'); bk.add_argument('plate'); bk.add_argument('roles', nargs='*')
    a = ap.parse_args()
    {'list': cmd_list, 'draw': cmd_draw, 'status': cmd_status, 'sheet': cmd_sheet, 'pick': cmd_pick, 'bake': cmd_bake}[a.cmd](a)


if __name__ == '__main__': main()
