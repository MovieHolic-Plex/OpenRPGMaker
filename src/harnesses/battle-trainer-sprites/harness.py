#!/usr/bin/env python3
"""전투 트레이너 스프라이트 하네스 — 몬스터 하네스와 같은 「생성형 이미지 → 격자 도트화 → 사람이 고름」.

기본 모드 = gen: 이미지 서버(god-tibo-imagen)가 저장소 소유 몬스터 수집 전용 그림체 샘플을 참고 이미지로 보고 역할별 새 트레이너를 그리면,
monster-collect-species 의 격자 검출·도트화(pixelize)를 거쳐 64x64 투명 PNG 로 정리한다(node/gen.ts 가 그 코드를 import 한다).
옛 편집 모드(chip, p3)·p1·p2 는 사용자 폐기 — 시트는 보존만 하고 pick/sheet/bake 는 거절한다.
감독·에이전트는 후보를 고르지 않는다. 사람 선택 경로이며 object-gate 영수증은 없다.
"""
import argparse, base64, concurrent.futures as cf, datetime, hashlib, io, json, os, re, shutil, subprocess, sys, threading, time
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



# ---------- gen 방식(p4~): 생성형 이미지 → 격자 도트화 ----------

GEN_TS = os.path.join(HERE, 'node', 'gen.ts')
VITE_NODE = os.path.join(ROOT, 'node_modules', '.bin', 'vite-node')


def gen_seed(): return seed()['gen']


def run_gen(*args, timeout=TIMEOUT):
    r = subprocess.run([VITE_NODE, '--script', GEN_TS, '--', *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout or ''), (r.stderr or '')


def gen_reference(plate, view):
    g = gen_seed(); path = os.path.join(RUNS, plate, '_ref_%s.png' % view)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        src = os.path.join(ROOT, chip_seed()['dir'])
        names = []
        for n in g['samples'][view]:
            p = os.path.join(src, n + '.png')
            if n == 'hero_back':  # 샘플의 손에 든 볼을 지운다(볼 모양을 그리게 하지 않기 위해, 참고 이미지 전용·번들 아님)
                im = Image.open(p).convert('RGBA'); px = im.load()
                for y in range(20, 29):
                    for x in range(49, 64): px[x, y] = (0, 0, 0, 0)
                p = os.path.join(RUNS, plate, '_sample_hero_back_noball.png'); im.save(p)
            names.append(p)
        files = ','.join(names)
        code, out, err = run_gen('reference', '--out', path, '--samples', files, '--scale', str(g['sampleScale']))
        if code: sys.exit('참고 이미지 합성 실패: ' + err[-400:])
    return path


def gen_prompt(role, spec, letter):
    g = gen_seed()
    n = len(g['samples'][spec['view']])
    common = (f"The reference image shows {n} EXAMPLE trainer sprites on a flat magenta canvas. They define the target art style: "
              f"{g['style']} Each art pixel is one clean square block about {g['sampleScale']}x{g['sampleScale']} image pixels, and a full figure is about 56 art pixels tall "
              f"(roughly {56 * g['sampleScale']} image pixels, i.e. about {round(56 * g['sampleScale'] / 12.54)}% of the picture height): draw your character just as large as the examples. ")
    task = ("EDIT TASK: draw ONE NEW, completely different original character in exactly that style (same head-to-body proportion, same outline weight and shading, same pixel block size). "
            "Do NOT copy or redraw any example character and do NOT include the examples in your picture; the output has only the one new character, centered. ")
    if spec['view'] == 'front':
        pose = ("Pose: standing upright, facing the viewer (front view, straight on), feet apart on the same ground line, simple relaxed arms; any prop is held in a hand and stays inside the figure's reach. ")
    else:
        pose = ("Pose: seen from BEHIND (camera directly behind and slightly above), showing the back of the head, hair, back and legs; the RIGHT arm (on the viewer's right) is raised and bent back as if about to throw something, hand open with NOTHING in it; the left arm hangs down. ")
    forbid = ("Some examples may show a small ball or orb; YOUR character holds no ball, no capsule, no orb and no creature. No monster-ball shape anywhere. "
              "It must NOT resemble any existing official Pokemon trainer or character. Original design only. ")
    bg = ("The whole background is flat solid pure magenta #FF00FF everywhere, magenta touching the outline directly: NO glow, NO aura, NO shadow, NO ground, NO text, no anti-aliasing, no gradients, no dithering. ")
    return common + task + pose + f"Character: {spec['label']} — {spec['brief']} Variation: {g['variants'][letter]} " + forbid + bg


def make_gen_candidate(plate, role, letter, throw=False):
    g = gen_seed(); spec = g['roles'][role]; view = spec['view']
    cdir = os.path.join(RUNS, plate, role, letter); os.makedirs(cdir, exist_ok=True)
    meta_path = os.path.join(cdir, 'meta.json'); meta = read_json(meta_path, {})
    if meta.get('status') == 'ok': return meta
    ref = gen_reference(plate, view)
    prompt = gen_prompt(role, spec, letter)
    open(os.path.join(cdir, 'prompt.txt'), 'w', encoding='utf-8').write(prompt)
    meta.update({'role': role, 'letter': letter, 'view': view, 'mode': 'gen', 'started': now(), 'model': 'god-tibo-imagen',
                 'reference': os.path.relpath(ref, RUNS), 'samples': g['samples'][view]})
    # 이미지 서버 오류(502 등)로 못 받은 시도는 후보 시도 횟수에 넣지 않는다 — 검사에 떨어진 시도만 센다.
    meta['attempts'] = [x for x in meta.get('attempts', []) if not any(str(e).startswith('이미지 생성 실패') for e in x.get('errors', []))]
    meta.pop('status', None)
    for n in range(len(meta['attempts']) + 1, MAX_ATTEMPTS + 1):
        rec = {'n': n, 'at': now()}
        raw = os.path.join(cdir, 'raw-%d.png' % n)
        code, out, err = run_gen('generate', '--prompt-file', os.path.join(cdir, 'prompt.txt'), '--reference', ref, '--out', raw,
                                 '--slug', 'bts-%s-%s-%s-%d' % (plate, role, letter, n))
        if code or not os.path.exists(raw):
            rec['errors'] = ['이미지 생성 실패: ' + err.strip().splitlines()[-1][:200] if err.strip() else '이미지 생성 실패']
            meta['attempts'].append(rec); write_json(meta_path, meta); continue
        adir = os.path.join(cdir, 'attempts', str(n)); os.makedirs(adir, exist_ok=True)
        code, out, err = run_gen('pixelize', '--raw', raw, '--out-dir', adir, '--max-colors', str(g['maxColors']))
        line = next((ln for ln in reversed(out.strip().splitlines()) if ln.startswith('{')), None)
        if code or not line:
            rec['errors'] = ['도트화 실패: ' + (err.strip().splitlines()[-1][:200] if err.strip() else '?')]
            meta['attempts'].append(rec); write_json(meta_path, meta); continue
        res = json.loads(line); rec.update({k: res[k] for k in ('block', 'colors', 'ink', 'warnings', 'errors')})
        meta['attempts'].append(rec)
        if not res['errors']:
            shutil.copy(os.path.join(adir, 'sprite.png'), os.path.join(cdir, 'sprite.png'))
            shutil.copy(os.path.join(adir, 'grid.png'), os.path.join(cdir, 'grid.png'))
            sp = Image.open(os.path.join(cdir, 'sprite.png')).convert('RGBA')
            enlarged(sp, 8, os.path.join(cdir, 'sprite_8x.png'))
            meta.update({'status': 'ok', 'hash': sha(sp), 'colors': res['colors'], 'block': res['block'], 'ink': res['ink'], 'warnings': res['warnings'],
                         'raw': 'raw-%d.png' % n, 'throw': {'status': 'skipped'}})
            break
        write_json(meta_path, meta)
    else:
        meta['status'] = 'failed'
    meta['finished'] = now(); write_json(meta_path, meta)
    return meta


# ---------- chip 방식(p3, 폐기): 몬스터 수집 전용 전투 인물 64x64 를 국소 편집 ----------

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


def require_gen(plate, what):
    if plate_mode(plate) != 'gen':
        sys.exit('%s 는 폐기된 판이다(p1·p2 소스 Actor1, p3 소스 편집 모드, 사용자 결정으로 폐기) — %s 하지 않는다' % (plate, what))


def cmd_list(a):
    for k, v in gen_seed()['roles'].items():
        print('%-14s %-18s %s  %s' % (k, v['label'], v['view'], v['brief'][:60]))


def cmd_draw(a):
    g = gen_seed()
    mode = a.mode
    if mode == 'chip':
        cs = chip_seed(); table = cs['roles']; letters_all = list(cs['intensity'])[:a.n]; maker = make_chip_candidate
    else:
        table = g['roles']; letters_all = list(g['variants'])[:a.n]; maker = make_gen_candidate
    roles = list(table) if a.role in (None, 'all') else a.role.split(',')
    for r in roles:
        if r not in table: sys.exit('모르는 역할: %s' % r)
    plate = a.plate or next_plate()
    jobs = [(r, l) for r in roles for l in (['A'] if table[r].get('mode') == 'asis' else letters_all)]
    os.makedirs(os.path.join(RUNS, plate), exist_ok=True)
    write_json(os.path.join(RUNS, plate, 'plate.json'), {'plate': plate, 'roles': roles, 'letters': letters_all, 'created': now(), 'mode': mode,
                                                         'model': MODEL if mode == 'chip' else 'god-tibo-imagen',
                                                         'method': ('generated image -> grid pixelize (monster-collect-species pipeline) -> 64x64' if mode == 'gen' else 'agy-argon-edit (deprecated)')})
    print(plate, mode, 'jobs=%d par=%d' % (len(jobs), a.par), flush=True)
    if a.background:
        log = open(os.path.join(RUNS, plate, 'draw.log'), 'a')
        subprocess.Popen([sys.executable, __file__, 'draw', ','.join(roles), '--n', str(a.n), '--par', str(a.par), '--plate', plate, '--mode', mode],
                         stdout=log, stderr=log, start_new_session=True)
        print('백그라운드로 시작:', os.path.join(RUNS, plate, 'draw.log'))
        return
    def one(j):
        m = maker(plate, j[0], j[1])
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
        m = plate_mode(p)
        print('==', p, '(%s)' % ('생성형' if m == 'gen' else '폐기: ' + ('p3 편집 모드' if m == 'chip' else 'p1/p2 옛 소스 Actor1')))
        for role, cs in plate_cands(p).items():
            print('  %-14s %s' % (role, ' '.join('%s:%s' % (l, m2.get('status', '?')) for l, m2 in cs.items())))
    picks = read_json(os.path.join(DATA, 'picks.json'), {})
    print('picks:', json.dumps(picks, ensure_ascii=False) if picks else '(없음 — 사용자가 고르기 전)')


def data_uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def sprite_stats(im):
    px = im.load(); w, h = im.size; opaque = orphan = edge = dark = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if not p[3]: continue
            opaque += 1; same = False; is_edge = False
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + ox, y + oy
                if not (0 <= nx < w and 0 <= ny < h) or not px[nx, ny][3]: is_edge = True; continue
                if px[nx, ny][:3] == p[:3]: same = True
            if not same: orphan += 1
            if is_edge:
                edge += 1
                if 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2] < 80: dark += 1
    return {'orphan': orphan / opaque if opaque else 1, 'outline': dark / edge if edge else 0}


def machine_filter(sp):
    """사람에게 보이기 전 걸러내기: 외톨이 점(색이 잘게 갈라짐)이 많거나 윤곽이 끊긴 도트화는 뭉개진 것으로 본다."""
    st = sprite_stats(sp); why = []
    if st['orphan'] > 0.10: why.append('외톨이 점 %d%% — 색이 잘게 갈라짐' % round(st['orphan'] * 100))
    if st['outline'] < 0.90: why.append('윤곽이 끊김(어두운 가장자리 %d%%)' % round(st['outline'] * 100))
    return why, st


def thumb_uri(path, size=220):
    src = Image.open(path).convert('RGBA'); im = Image.new('RGB', src.size, (255, 0, 255)); im.paste(src, (0, 0), src); im.thumbnail((size, size))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=82)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def cmd_sheet(a):
    require_gen(a.plate, '시트를 만들')
    g = gen_seed(); cands = plate_cands(a.plate)
    manual = read_json(os.path.join(RUNS, a.plate, 'manual_filter.json'), {})  # 눈으로 보고 걸러낸 것: {"role/letter": "사유"}
    name = 'trainer-sprites-pick-%s.html' % a.plate.lstrip('p')
    cards = []; roles_js = {}; dropped = []
    order = [r for r in g['roles'] if r in cands]
    for role in order:
        spec = g['roles'][role]; view = spec['view']; cdict = cands[role]
        ref_uri = data_uri(os.path.join(RUNS, a.plate, '_ref_%s.png' % view))
        items = []
        roles_js[role] = {'view': view, 'cands': {}}
        shown = 0
        for l, m in cdict.items():
            if m.get('status') != 'ok':
                if m.get('status') == 'failed': dropped.append('%s/%s: 생성·검사 실패(이미지 서버 오류 또는 규격 미달 %d회)' % (role, l, len(m.get('attempts', []))))
                continue
            sp_path = os.path.join(RUNS, a.plate, role, l, 'sprite.png')
            sp = Image.open(sp_path).convert('RGBA')
            why, st = machine_filter(sp)
            if '%s/%s' % (role, l) in manual: why.append(manual['%s/%s' % (role, l)])
            if why:
                dropped.append('%s/%s: %s' % (role, l, ' · '.join(why))); continue
            uri = data_uri(sp_path)
            raw_uri = thumb_uri(os.path.join(RUNS, a.plate, role, l, m['raw']))
            roles_js[role]['cands'][l] = {'sprite': uri}
            shown += 1
            prompt = open(os.path.join(RUNS, a.plate, role, l, 'prompt.txt'), encoding='utf-8').read()
            items.append(f'<div class=cand data-role="{role}" data-l="{l}"><div class=lt>{l}</div>'
                         f'<div class=pair><div><img class=rawimg src="{raw_uri}"><div class=hs>생성 원본</div></div>'
                         f'<div><div class=bg><img class=px data-w=64 src="{uri}"></div><div class=hs>도트화 64×64</div></div></div>'
                         f'<div class=hs>{m["hash"]} · {m["colors"]}색 · 격자 {m["block"]}px · 높이 {m["ink"]["height"]} · 외톨이 {round(st["orphan"] * 100)}%</div>'
                         f'<details onclick="event.stopPropagation()"><summary>이 후보의 생성 프롬프트</summary><pre>{prompt}</pre></details></div>')
        cards.append(f'<section><h3>{spec["label"]} <small>({role}, {"앞" if view == "front" else "뒤"}) — {spec["brief"]}</small> <b class=n>{shown}장</b></h3>'
                     f'<div class=row><div class=src><img src="{ref_uri}" style="width:220px;image-rendering:pixelated"><div class=hs>이미지 서버에 준 참고 이미지(그림체 샘플, 저장소 소유 전용 소스)</div></div>{"".join(items)}</div></section>')
    drop_html = ('<div class=how><b>걸러낸 후보(사람에게 보이기 전에 걸렀습니다)</b><br>' + '<br>'.join(dropped) + '</div>') if dropped else ''
    dirs = '<br>'.join('<b>%s</b> %s' % kv for kv in g['variants'].items())
    html = TEMPLATE.replace('@@CARDS@@', '\n'.join(cards)).replace('@@ROLES@@', json.dumps(roles_js)).replace('@@PLATE@@', a.plate) \
        .replace('@@ROLELIST@@', ' '.join('<code>%s</code>' % r for r in order)).replace('@@DIRS@@', dirs).replace('@@DROPPED@@', drop_html) \
        .replace('@@MAINPROMPT@@', gen_prompt('hero_m', g['roles']['hero_m'], 'A').replace('<', '&lt;'))
    os.makedirs(VIZ, exist_ok=True)
    out = os.path.join(VIZ, name)
    open(out, 'w', encoding='utf-8').write(html)
    print(out, len(html) // 1024, 'KB', '걸러냄', len(dropped))


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
.pair{display:flex;gap:10px;align-items:flex-end}.rawimg{width:220px;height:220px;object-fit:contain;background:#f0f;image-rendering:pixelated}pre{white-space:pre-wrap;font-size:11px;max-width:460px;color:#c8d4e8;background:#10151f;padding:6px;border-radius:4px}details{margin-top:4px;font-size:11px;color:#8da0bb}.n{color:#ffd78a;font-size:12px}
.thr{margin-top:6px}.anim{width:64px;height:64px;image-rendering:pixelated;background-size:auto 100%;animation:thr 0.9s steps(1) infinite}
@keyframes thr{0%{background-position:0 0}33%{background-position:-64px 0}66%{background-position:-128px 0}}
.bar{position:sticky;top:0;background:#1c2230ee;padding:6px 0;z-index:5;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
button{background:#3a4770;color:#fff;border:0;border-radius:6px;padding:5px 12px;cursor:pointer}button.on{background:#c79a2a;color:#111}
#cmd{width:100%;max-width:1000px;background:#10151f;color:#ffd78a;border:1px solid #3c4a6e;padding:6px;font-family:monospace}
#bat{border:2px solid #3c4a6e;image-rendering:pixelated;background:#000}
</style>
<h1>트레이너 스프라이트 후보 시트 (@@PLATE@@) — 왼쪽 그림체 샘플(참고 이미지) | 오른쪽 생성형 이미지 → 격자 도트화 결과</h1>
<div class=how><b>고르는 방법</b> — 카드를 눌러 역할마다 하나씩 고르면 맨 아래 칸에 <code>pick</code> 명령이 만들어집니다. 번호만 말해 주셔도 됩니다: 예) <code>hero_m=B hero_f=A boy=C …</code> (역할: @@ROLELIST@@).
고르기 전에는 번들·프로젝트에 아무것도 들어가지 않습니다. 후보 방향: <br>@@DIRS@@<br>
이 그림은 사람 캐릭터라 3/4 윗면 관문 대상이 아닙니다(object-gate 영수증 없음, 사람 선택 경로). 방식: 이미지 서버가 저장소 소유 몬스터 수집 전용 그림체 샘플을 참고로 역할별 새 인물을 그리고, 몬스터 하네스와 같은 격자 검출·도트화로 64×64 로 정리했습니다(Actor1·Nintendo 원작 그림 아님, 소스 복제 아님).</div>
<div class=how><details><summary><b>생성 프롬프트 틀</b> (예: hero_m A. 역할마다 Character 줄과 Variation 문장만 다릅니다 — 이 문장을 고쳐 달라고 말씀해 주시면 됩니다)</summary><pre>@@MAINPROMPT@@</pre></details></div>
@@DROPPED@@
<div class=bar>배율 <span id=sc></span> · 같은 배율로 봅니다</div>
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
    require_gen(a.plate, '고르')
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
    require_gen(a.plate, '굽')
    cs = gen_seed(); picks = read_json(os.path.join(DATA, 'picks.json'), {}).get(a.plate, {})
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
                                   'source': 'OPRN monster-collect trainer art (generated image, grid-pixelized to 64x64)', view: '%s.png' % view}
        print('baked', role, p['letter'])
    write_json(os.path.join(BUNDLE, 'index.json'), index)



# ---------- compare: 같은 생성 원본의 세 가지 표현(64 격자 / 128 양자화 / 128 부드러움) 비교 시트 ----------

def _fringe_free_rgba(raw_path):
    """마젠타 배경 생성 원본 → (색, 마스크). 가장자리 마젠타 번짐은 안쪽 색으로 덮는다."""
    import numpy as np
    im = Image.open(raw_path).convert('RGBA')
    full = np.asarray(im).astype(np.int16)
    a = full[..., :3]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = ((r > 170) & (b > 170) & (g < 120) & (abs(r - b) < 70)) | (full[..., 3] < 128)  # 생성기가 알파 투명 배경을 줄 때도 있다
    soft = (r - g > 60) & (b - g > 60)  # 분홍 번짐
    ink = ~bg
    core = ink & ~soft
    col = a.copy()
    known = core.copy()
    for _ in range(4):  # 번진 화소 색을 이웃 확실한 색으로 채운다
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(col, dy, 0), dx, 1); shk = np.roll(np.roll(known, dy, 0), dx, 1)
            take = (~known) & shk
            col[take] = sh[take]; known = known | take
    return col.astype(np.uint8), ink.astype(np.uint8) * 255


def make_variants(raw_path, out_dir, tag, target_h=112, canvas=128, colors=24):
    import numpy as np
    col, mask = _fringe_free_rgba(raw_path)
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = Image.fromarray(col[y0:y1, x0:x1]); m = Image.fromarray(mask[y0:y1, x0:x1])
    h = y1 - y0; w = x1 - x0
    tw = max(1, round(w * target_h / h))
    rgb_s = rgb.resize((tw, target_h), Image.LANCZOS); m_s = m.resize((tw, target_h), Image.LANCZOS)
    left = (canvas - tw) // 2; top = canvas - 1 - target_h   # 발 줄 = canvas-2 (아래 1칸 여백)
    # (3) 부드럽게: 반투명 가장자리 유지
    soft = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    rgba = rgb_s.convert('RGBA'); rgba.putalpha(m_s)
    soft.alpha_composite(rgba, (left, top))
    # (2) 양자화: 마스크 이진화 + 색 수만 줄임(디더 없음)
    hard_m = m_s.point(lambda v: 255 if v >= 128 else 0)
    q = rgb_s.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    qr = q.convert('RGBA'); qr.putalpha(hard_m)
    quant = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    quant.alpha_composite(qr, (left, top))
    os.makedirs(out_dir, exist_ok=True)
    pq = os.path.join(out_dir, tag + '_hires%d.png' % canvas); ps = os.path.join(out_dir, tag + '_smooth%d.png' % canvas)
    quant.save(pq); soft.save(ps)
    return pq, ps, len({c[:3] for c in pixels(quant) if c[3]})


def data_uri_jpg_bg(path):
    return data_uri(path)


def cmd_compare(a):
    require_gen(a.plate, '비교 시트를 만들')
    picks = [p.split('/') for p in a.picks]            # role/letter
    out_dir = os.path.join(RUNS, a.plate, 'compare')
    byrole = {}
    for role, letter in picks:
        m = read_json(os.path.join(RUNS, a.plate, role, letter, 'meta.json'))
        if not m or m.get('status') != 'ok': sys.exit('%s/%s 는 통과한 후보가 아니다' % (role, letter))
        tag = '%s_%s' % (role, letter)
        pq, ps, ncol = make_variants(os.path.join(RUNS, a.plate, role, letter, m['raw']), out_dir, tag)
        byrole.setdefault(role, []).append({'tag': tag, 'letter': letter, 'grid': os.path.join(RUNS, a.plate, role, letter, 'sprite.png'), 'quant': pq, 'smooth': ps, 'colors': ncol, 'm': m})
    mon = {'harness_front': os.path.join(ROOT, 'public/assets/harnesses/monster-collect-species/sparkit/front.png'),
           'harness_back': os.path.join(ROOT, 'public/assets/harnesses/monster-collect-species/leafling/back.png'),
           'camp_front': os.path.join(ROOT, 'public/assets/monster-expedition/creatures/brambleboar-front.png'),
           'camp_back': os.path.join(ROOT, 'public/assets/monster-expedition/creatures/atollclamp-back.png')}
    bg = os.path.join(ROOT, 'public/assets/emerald-monster/battle/grass.png')
    U = {k: data_uri(v) for k, v in mon.items()}; BG = data_uri(bg)
    pairs = []  # (성별, k)
    for gname in ('m', 'f'):
        backs = byrole.get('hero_%s' % gname, []); fronts = byrole.get('hero_%s_front' % gname, [])
        for k in range(min(len(backs), len(fronts))): pairs.append((gname, backs[k], fronts[k]))
    rows = []
    for gname, bk, fr in pairs:
        cols = []
        for key, title, size in (('grid', '(1) 지금: 64×64 격자 도트화 · 2배(128px)', 128), ('quant', '(2) 격자 강제 없이 128 캔버스(몸 112px) · 24색 양자화 · 1배', 128), ('smooth', '(3) 128 캔버스 부드러운 축소(원본 색 그대로) · 1배', 128)):
            u_b = data_uri(bk[key]); u_f = data_uri(fr[key])
            cols.append(f'<div class=sc><div class=ct>{title}</div>'
                        f'<div class=zoom><div class=field style="background-image:url({BG})">'
                        f'<img class=px style="left:48px;bottom:0;width:128px;height:128px" src="{u_b}">'
                        f'<img class=px style="right:48px;bottom:30px;width:128px;height:128px" src="{u_f}"></div></div>'
                        f'<div class=ct style="margin-top:6px">같은 줄에 몬스터와 나란히(왼쪽부터: 캠페인 몬스터 64→2배 · 상대 트레이너 · 내 트레이너 · 하네스 몬스터 112→128px)</div>'
                        f'<div class=zoom><div class=field style="background-image:url({BG})">'
                        f'<img class=px style="left:0px;bottom:24px;width:128px;height:128px" src="{U["camp_front"]}">'
                        f'<img class=px style="left:118px;bottom:24px;width:128px;height:128px" src="{u_f}">'
                        f'<img class=px style="left:236px;bottom:24px;width:128px;height:128px" src="{u_b}">'
                        f'<img class=px style="left:354px;bottom:24px;width:128px;height:128px" src="{U["harness_back"]}">'
                        f'</div></div></div>')
        info = f'히어로{"(남)" if gname == "m" else "(여)"} · 뒷모습 {bk["letter"]} / 앞모습 {fr["letter"]} · (2) 양자화 색 {bk["colors"]}·{fr["colors"]}'
        rows.append(f'<section><h3>{info}</h3><div class=r3>{"".join(cols)}</div></section>')
    # 확대 비교(같은 화면 크기)
    crops = []
    for role in ('hero_m', 'hero_m_front', 'hero_f', 'hero_f_front'):
        for v in byrole.get(role, []):
            cells = ''.join(f'<div><div class=bg><img class=px style="width:{w}px;height:{w}px" src="{data_uri(v[key])}"></div><div class=hs>{lab}</div></div>' for key, lab, w in (('grid', '(1) 64 격자 ×4', 256), ('quant', '(2) 128 양자화 ×2', 256), ('smooth', '(3) 128 부드러움 ×2', 256)))
            crops.append(f'<div class=cand><div class=hs>{role} {v["letter"]}</div><div class=pair>{cells}</div></div>')
    html = COMPARE_TEMPLATE.replace('@@ROWS@@', '\n'.join(rows)).replace('@@CROPS@@', '\n'.join(crops)).replace('@@PLATE@@', a.plate)
    os.makedirs(VIZ, exist_ok=True)
    out = os.path.join(VIZ, 'trainer-sprites-pick-%s.html' % a.out)
    open(out, 'w', encoding='utf-8').write(html)
    print(out, len(html) // 1024, 'KB')


COMPARE_TEMPLATE = r"""<!doctype html><meta charset=utf-8><title>트레이너 표현 방식 비교 @@PLATE@@</title>
<style>
body{background:#1c2230;color:#e8ecf4;font:14px/1.5 -apple-system,'Noto Sans KR',sans-serif;margin:0;padding:16px 24px 60px}
h1{font-size:20px;margin:0 0 6px}h3{margin:22px 0 6px;font-size:15px}
.how{background:#26304a;border:1px solid #3c4a6e;border-radius:8px;padding:10px 14px;margin:8px 0;max-width:1100px}
.r3{display:flex;gap:14px;flex-wrap:wrap}.sc{flex:0 0 auto}.ct{font-size:12px;color:#ffd78a;margin-bottom:3px;max-width:480px}
.field{position:relative;width:480px;height:240px;background-size:480px 240px;background-repeat:no-repeat;image-rendering:pixelated;overflow:hidden;transform-origin:0 0}
.zoom{width:calc(480px*var(--z,1));height:calc(240px*var(--z,1));overflow:hidden}.zoom .field{transform:scale(var(--z,1))}
.field img{position:absolute;image-rendering:pixelated}
.px{image-rendering:pixelated}.bg{background:#5a9a5a;display:inline-block;line-height:0}.hs{font-size:11px;color:#8da0bb}
.cand{background:#232b3d;border:2px solid #323d58;border-radius:8px;padding:8px;margin:8px 0;display:inline-block;margin-right:10px}.pair{display:flex;gap:10px}
button{background:#3a4770;color:#fff;border:0;border-radius:6px;padding:5px 12px;cursor:pointer}button.on{background:#c79a2a;color:#111}
</style>
<h1>트레이너 표현 방식 비교 (@@PLATE@@ 생성 원본 그대로, 같은 그림 세 가지)</h1>
<div class=how>고르는 시트가 아닙니다 — 번들·프로젝트에는 아무것도 들어가지 않았고, 비교용 그림(각 역할에서 보기 좋은 2장)만 올렸습니다. 어느 쪽이 몬스터와 어울리는지 보고 방향만 정해 주세요.<br>
장면은 실제 게임의 480×240 field·지형 그림·몬스터 128px·발판 위치를 CSS 로 복제한 것입니다(플레이어 실제 렌더 아님). 위 장면은 트레이너 도입(슬라이드 인) 위치이고, 아래 장면은 <b>캠페인 기본 몬스터(64×64 → 2배)</b>와 <b>하네스 몬스터(112×112 → 128px, 1.14배)</b>를 트레이너와 같은 줄에 세운 밀도 비교입니다.<br>
(1) 지금: 생성 원본 → 격자 검출 도트화 → 64×64, 2배 확대. (2) 격자 강제 없이 원본을 128 캔버스(몸 112px)로 줄이고 색만 24색으로 줄임(디더 없음, 윤곽 보존, 최근접 표시). (3) 같은 크기로 부드럽게(고품질 축소) 줄인 것 — 반투명 가장자리 포함, 도트 아님.<br>
배율 <span id=sc></span></div>
@@ROWS@@
<h3>확대 비교 (같은 화면 크기)</h3>
@@CROPS@@
<script>
function setZ(z){document.documentElement.style.setProperty('--z',z);document.querySelectorAll('#sc button').forEach(b=>b.classList.toggle('on',+b.dataset.z===z))}
const sc=document.getElementById('sc');[1,1.5,2].forEach(z=>{const b=document.createElement('button');b.textContent=z+'×';b.dataset.z=z;b.onclick=()=>setZ(z);sc.appendChild(b)});setZ(1);
</script>"""


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('list')
    d = sp.add_parser('draw'); d.add_argument('role', nargs='?'); d.add_argument('--n', type=int, default=5); d.add_argument('--par', type=int, default=5)
    d.add_argument('--plate'); d.add_argument('--mode', choices=['gen', 'chip'], default='gen'); d.add_argument('--background', action='store_true')
    st = sp.add_parser('status'); st.add_argument('plate', nargs='?')
    sh = sp.add_parser('sheet'); sh.add_argument('plate')
    pk = sp.add_parser('pick'); pk.add_argument('plate'); pk.add_argument('picks', nargs='+')
    bk = sp.add_parser('bake'); bk.add_argument('plate'); bk.add_argument('roles', nargs='*')
    cp = sp.add_parser('compare'); cp.add_argument('plate'); cp.add_argument('picks', nargs='+'); cp.add_argument('--out', default='5')
    a = ap.parse_args()
    {'list': cmd_list, 'draw': cmd_draw, 'status': cmd_status, 'sheet': cmd_sheet, 'pick': cmd_pick, 'bake': cmd_bake, 'compare': cmd_compare}[a.cmd](a)


if __name__ == '__main__': main()
