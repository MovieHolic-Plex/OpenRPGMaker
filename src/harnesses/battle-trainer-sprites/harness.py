#!/usr/bin/env python3
"""전투 트레이너 스프라이트 하네스 — Actor1(EasyRPG RTP) 캐릭터를 Argon 이 손 도트 격자로 포켓몬식 전투 그림으로 변형한다.

  harness.py list                                  역할(12)과 원본 블록
  harness.py draw [역할|all] [--n 5] [--par 5] [--plate p1] [--throw]
                                                   후보를 그린다(agy gemini-4-argon-medium, 바로 안 돌아옴). 판 id 출력
  harness.py status [판]                           판·후보 상태
  harness.py sheet <판>                            고르는 시트를 ~/claude-viz/trainer-sprites-pick-<번호>.html 에 쓴다(자체완결)
  harness.py pick <판> 역할=글자 [...]             사용자가 고른 후보를 기록(현재 그림 해시에 묶임)
  harness.py bake <판> [역할 ...]                  고른 것만 public/assets/battle-trainers/<역할>/ 에 굽는다(고르기 전엔 거절)

규칙: 이미지 생성 도구 금지(Argon 이 행 문자열을 직접 쓴다). 감독·에이전트는 후보를 고르지 않는다. 사람 선택 경로이며 object-gate 영수증은 없다.
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


# ---------- Actor1 원본 ----------

def source_frame(block, view, frame=1):
    s = seed()['source']
    im = Image.open(os.path.join(ROOT, s['png'])).convert('RGBA')
    bw, bh = s['block']; fw, fh = s['frame']
    x0 = (block % 4) * bw + frame * fw
    y0 = (block // 4) * bh + s['rows'][view] * fh
    fr = im.crop((x0, y0, x0 + fw, y0 + fh))
    px = fr.load(); key = tuple(s['key'])
    for y in range(fh):
        for x in range(fw):
            if px[x, y][:3] == key: px[x, y] = (0, 0, 0, 0)
    return fr


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


# ---------- 격자 읽기·검사·굽기 ----------

def parse_hex(v):
    v = v.strip().lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def load_grid(grid_path, pal_path, size=64):
    errs = []
    try:
        rows = [ln.rstrip('\n') for ln in open(grid_path, encoding='utf-8')]
    except FileNotFoundError:
        return None, ['grid.txt 가 없다']
    while rows and rows[-1] == '': rows.pop()
    try:
        pal = {k: parse_hex(v) for k, v in json.load(open(pal_path)).items() if k != '.'}
    except Exception as e:
        return None, ['palette.json 읽기 실패: %s' % e]
    if len(rows) != size: errs.append('줄 수 %d (64 여야 함)' % len(rows))
    bad = [i for i, r in enumerate(rows) if len(r) != size]
    if bad: errs.append('길이가 64 가 아닌 줄: %s' % bad[:10])
    unk = sorted({ch for r in rows for ch in r if ch != '.' and ch not in pal})
    if unk: errs.append('팔레트에 없는 글자: %s' % ''.join(unk))
    if errs: return None, errs
    return (rows, pal), []


def render(rows, pal):
    h = len(rows); w = len(rows[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': px[x, y] = pal[ch] + (255,)
    return im


def components(im):
    px = im.load(); w, h = im.size; seen = set(); sizes = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); n = 0
                while st:
                    cx, cy = st.pop(); n += 1
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and (nx, ny) not in seen:
                                seen.add((nx, ny)); st.append((nx, ny))
                sizes.append(n)
    return sorted(sizes, reverse=True)


def check_and_normalize(im, baseline, hmin=36, hmax=60):
    """(정규화한 이미지, 이동량, 오류[], 경고[])."""
    errs, warns = [], []
    bbox = im.getbbox()
    if not bbox: return im, (0, 0), ['그림이 비어 있다'], warns
    x0, y0, x1, y1 = bbox
    h, w = y1 - y0, x1 - x0
    if h < hmin: errs.append('그림 높이 %d줄은 너무 작다(최소 %d)' % (h, hmin))
    if h > hmax: errs.append('그림 높이 %d줄은 너무 크다(최대 %d)' % (h, hmax))
    if w > 60: errs.append('그림 너비 %d칸은 너무 넓다(최대 60)' % w)
    cols = len({c for c in pixels(im) if c[3]})
    opaque = sum(1 for c in pixels(im) if c[3])
    if cols > 18: errs.append('사용 색 %d개(최대 18)' % cols)
    ratio = opaque / (im.width * im.height)
    if ratio < 0.12: errs.append('불투명 화소 비율 %.0f%% 너무 적다' % (ratio * 100))
    comp = components(im)
    if comp and comp[0] / opaque < 0.7: errs.append('가장 큰 덩어리가 전체의 %.0f%% 뿐(흩어져 있음)' % (comp[0] / opaque * 100))
    elif comp and comp[0] / opaque < 0.9: warns.append('떨어진 조각이 %d%% 있다' % round((1 - comp[0] / opaque) * 100))
    fx = im.crop((0, max(0, y1 - 6), im.width, y1)).getbbox()
    feet_cx = (fx[0] + fx[2]) / 2 if fx else (x0 + x1) / 2
    dy = baseline + 1 - y1
    dx = int(round(im.width / 2 - feet_cx))
    if abs(dx) > 12 or abs(dy) > 12: errs.append('발 위치가 기준에서 너무 멀다(dx=%d dy=%d)' % (dx, dy))
    if errs: return im, (dx, dy), errs, warns
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.alpha_composite(im, (dx, dy))
    if out.getbbox()[3] != baseline + 1 or out.getbbox()[0] < 0: errs.append('이동 뒤 가장자리가 잘렸다')
    bb = out.getbbox()
    if bb[0] <= 0 or bb[2] >= im.width or bb[1] <= 0: warns.append('캔버스 가장자리에 닿음')
    # 윤곽: 투명과 이웃한 화소 중 어두운 비율
    px = out.load(); edge = dark = 0
    for y in range(out.height):
        for x in range(out.width):
            if px[x, y][3]:
                if any(not (0 <= x + a < out.width and 0 <= y + b < out.height) or not px[x + a, y + b][3]
                       for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    edge += 1
                    r, g, b2 = px[x, y][:3]
                    if 0.3 * r + 0.59 * g + 0.11 * b2 < 80: dark += 1
    if edge and dark / edge < 0.6: warns.append('윤곽이 어두운 선으로 이어진 비율 %.0f%%' % (dark / edge * 100))
    return out, (dx, dy), errs, warns


def pixels(im):
    return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())


def sha(im): return hashlib.sha256(im.tobytes()).hexdigest()[:16]


# ---------- 프롬프트 ----------

NO_GEN = ("이미지 생성 기능·image-generator 서브에이전트·이미지 API 는 절대 쓰지 마라. "
          "원/다각형/수식으로 몸을 합성하는 코드도 금지다. 네가 모든 행의 문자열을 직접 손으로 적어라(파일 쓰기 도구로 grid.txt 에 그대로 쓴다). "
          "허용되는 코드는 grid.txt 를 PNG 로 굽는 아주 작은 확인용 스크립트뿐이다.")


def front_prompt(role, spec, letter, direction, srows, spal, extra=''):
    s = seed()
    view = spec['view']
    vname = '앞모습(상대 트레이너, 오른쪽 위에 서서 이쪽을 봄)' if view == 'front' else '뒷모습(내 트레이너, 왼쪽 아래에서 상대 쪽을 향해 뒤돌아 선 모습)'
    pal_lines = '\n'.join('  %s = %s' % (k, v) for k, v in spal.items())
    return f"""@source_8x.png 는 RPG 도트 캐릭터 Actor1 의 {('정면' if view == 'front' else '뒷면')} 가운데 걸음 프레임(원본 24x32, 8배 확대, 배경은 임의 초록)이다. 아래 ASCII 가 같은 프레임의 정확한 원본 격자다.
{NO_GEN}

[과제] 이 캐릭터를 출발점으로 삼아, 포켓몬 3세대(GBA) 전투 화면의 {vname} 스프라이트를 새로 그려라. 단순 확대가 아니라 3세대 트레이너 비율(머리 크게, 몸 단순)로 다시 그리는 것이다.
역할: {spec['label']}. 설정: {spec['brief']}
이번 후보({letter})의 방향: {direction}
원작 포켓몬 트레이너·캐릭터를 닮게 그리지 마라. 몬스터볼 모양도 그리지 마라.

[규격]
- 64x64 격자. '.' 은 투명. 그림 높이 {50 if view == 'front' else 48}~58줄, 머리 약 18~22줄, 발 바닥 줄은 대략 60~62(하네스가 정확히 맞춤), 가로는 대략 가운데.
- 1px 짙은 윤곽(원본의 윤곽색 계열을 쓰되 모든 트레이너가 같은 계열), 재질당 3~4톤 명암, 빛은 왼쪽 위, 디더·노이즈·안티앨리어싱 금지. 사용 색 16개 이하. 원본 팔레트의 색을 최대한 재사용하고 역할에 필요한 색만 바꾸거나 추가한다.
- {'정면 직립, 양팔은 몸 옆으로 내리거나(소품은 손에 들기) 허리·팔짱 같은 단순한 자세. 얼굴은 눈·눈썹·입을 직접 찍는다.' if view == 'front' else '뒤통수·머리카락·등·허리·다리·신발이 보이는 직립 뒷모습. 양팔은 몸 옆. 얼굴은 보이지 않는다.'}

[원본 격자 24x32] ('.'=투명)
{chr(10).join(srows)}
[원본 팔레트]
{pal_lines}

[산출물] 현재 폴더에 두 파일을 쓴다.
1. grid.txt — 정확히 64줄, 각 줄 정확히 64글자. 글자는 팔레트 키 또는 '.'.
2. palette.json — {{"글자": "#rrggbb", ...}} ('.' 는 넣지 않는다, 글자는 한 자).
쓴 뒤 grid.txt 를 PNG(preview.png, 8배)로 굽는 확인용 스크립트를 돌려 직접 열어 보고, 윤곽이 끊긴 곳·비대칭·얼굴·잡티를 최소 한 번 고쳐 grid.txt 를 다시 써라. 끝나면 'done' 한 단어만 답하라.
{extra}"""


def throw_prompt(role, spec, srows, spal, frames=3):
    pal_lines = '\n'.join('  %s = %s' % (k, v) for k, v in spal.items())
    return f"""@back_6x.png 는 내 트레이너 뒷모습 스프라이트(64x64, 6배 확대)다. 아래가 같은 그림의 정확한 격자와 팔레트다.
{NO_GEN}

[과제] 같은 캐릭터가 오른팔로 공을 던지는 동작 프레임 {frames}장을 같은 그림체·같은 팔레트·같은 크기(64x64)·같은 발 위치로 그려라. 공(몬스터볼)은 그리지 않는다(엔진이 그린다) — 손은 주먹 또는 편 손만.
- throw_1.txt: 던지기 준비(오른팔을 뒤로·위로 젖히고 몸을 살짝 비틂)
- throw_2.txt: 놓는 순간(팔이 앞쪽 위로 쭉 뻗음, 몸이 앞으로 기울어짐)
- throw_3.txt: 마무리(팔이 앞쪽 아래로 내려옴, 자세 복귀 중)
머리·몸·다리의 윤곽과 색은 원본과 일치해야 하며 팔·몸통 기울기·머리카락 흔들림만 바뀐다. 이미지 생성·합성 코드 금지, 모든 행을 직접 적는다.

[원본 격자 64x64] ('.'=투명)
{chr(10).join(srows)}
[팔레트]
{pal_lines}

[산출물] 현재 폴더에 throw_1.txt throw_2.txt throw_3.txt (각 정확히 64줄 x 64글자). 새 색이 필요하면 palette_throw.json 에 {{"글자": "#rrggbb"}} 로 추가한다(없으면 palette.json 사용). 확인용 preview 를 직접 열어 한 번 고쳐라. 끝나면 'done' 한 단어만 답하라.
"""


# ---------- 일꾼 ----------

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


def make_candidate(plate, role, letter, throw=True):
    s = seed(); spec = s['roles'][role]; view = spec['view']
    cdir = os.path.join(RUNS, plate, role, letter)
    os.makedirs(cdir, exist_ok=True)
    meta_path = os.path.join(cdir, 'meta.json')
    meta = read_json(meta_path, {})
    if meta.get('status') == 'ok' and (view == 'front' or meta.get('throw', {}).get('status') in ('ok', 'skipped')):
        return meta
    meta.update({'role': role, 'letter': letter, 'view': view, 'model': MODEL, 'started': now()})
    src = source_frame(spec['source'], view)
    srows, spal = ascii_of(src)
    enlarged(src, 8, os.path.join(cdir, 'source_8x.png'))
    write_json(os.path.join(cdir, 'source.json'), {'block': spec['source'], 'view': view, 'frame': 1, 'rows': srows, 'palette': spal})
    direction = s['directions'][letter]
    err_feedback = ''
    if meta.get('status') != 'ok':
        meta['attempts'] = meta.get('attempts', [])
        for n in range(len(meta['attempts']) + 1, MAX_ATTEMPTS + 1):
            for f in ('grid.txt', 'palette.json') if not err_feedback else ():
                try: os.remove(os.path.join(cdir, f))
                except FileNotFoundError: pass
            prompt = front_prompt(role, spec, letter, direction, srows, spal, err_feedback)
            code = run_agy(cdir, prompt, 'try%d' % n)
            rec = {'n': n, 'agy_exit': code, 'at': now()}
            ld, errs = load_grid(os.path.join(cdir, 'grid.txt'), os.path.join(cdir, 'palette.json'))
            if ld:
                im = render(*ld)
                norm, shift, errs, warns = check_and_normalize(im, s['baseline'])
                rec.update({'errors': errs, 'warnings': warns, 'shift': shift})
                if not errs:
                    norm.save(os.path.join(cdir, 'sprite.png'))
                    enlarged(norm, 8, os.path.join(cdir, 'sprite_8x.png'))
                    meta.update({'status': 'ok', 'hash': sha(norm), 'shift': list(shift), 'warnings': warns,
                                 'colors': len({c for c in pixels(norm) if c[3]}), 'grid_rows': ld[0]})
                    shutil.copy(os.path.join(cdir, 'grid.txt'), os.path.join(cdir, 'grid.final.txt'))
                    meta['attempts'].append(rec); break
            else:
                rec['errors'] = errs
            meta['attempts'].append(rec)
            adir = attempt_dir(cdir, n); os.makedirs(adir, exist_ok=True)
            for f in ('grid.txt', 'palette.json', 'agy-try%d.log' % n):
                if os.path.exists(os.path.join(cdir, f)): shutil.copy(os.path.join(cdir, f), adir)
            err_feedback = ('\n[이전 시도 실패] 폴더의 grid.txt/palette.json 은 검사에서 떨어졌다: ' + '; '.join(errs)
                            + '. 같은 설계를 유지하되 위 문제만 고쳐 grid.txt 와 palette.json 을 다시 써라.')
            write_json(meta_path, meta)
        else:
            meta['status'] = 'failed'
    meta['finished'] = now()
    write_json(meta_path, meta)
    if meta['status'] != 'ok' or view != 'back' or not throw:
        if meta['status'] == 'ok': meta['throw'] = {'status': 'skipped'}; write_json(meta_path, meta)
        return meta
    meta['throw'] = make_throw(cdir, role, spec, meta)
    write_json(meta_path, meta)
    return meta


def make_throw(cdir, role, spec, meta):
    s = seed()
    tdir = os.path.join(cdir, 'throw'); os.makedirs(tdir, exist_ok=True)
    back = Image.open(os.path.join(cdir, 'sprite.png')).convert('RGBA')
    enlarged(back, 6, os.path.join(tdir, 'back_6x.png'))
    rows, pal = ascii_of(back)
    # 정확한 격자는 정규화된 sprite 에서 다시 뽑는다
    prompt = throw_prompt(role, spec, rows, pal)
    state = {'status': 'failed', 'attempts': []}
    fb = ''
    for n in range(1, MAX_ATTEMPTS + 1):
        for i in (1, 2, 3):
            try: os.remove(os.path.join(tdir, 'throw_%d.txt' % i))
            except FileNotFoundError: pass
        code = run_agy(tdir, prompt + fb, 'try%d' % n)
        rec = {'n': n, 'agy_exit': code, 'at': now(), 'errors': []}
        frames = []
        palp = os.path.join(tdir, 'palette_throw.json')
        if not os.path.exists(palp):
            json.dump({k: v for k, v in pal.items()}, open(palp, 'w'))
        # 등록된 new 팔레트: 기본 팔레트에 얹는다
        full = dict(pal)
        try: full.update(json.load(open(palp)))
        except Exception: pass
        fpal = os.path.join(tdir, 'palette_full.json'); json.dump(full, open(fpal, 'w'))
        for i in (1, 2, 3):
            ld, errs = load_grid(os.path.join(tdir, 'throw_%d.txt' % i), fpal)
            if not ld: rec['errors'] += ['프레임%d: %s' % (i, e) for e in errs]; continue
            im = render(*ld)
            norm, shift, errs, warns = check_and_normalize(im, s['baseline'], hmin=34, hmax=62)
            if errs: rec['errors'] += ['프레임%d: %s' % (i, e) for e in errs]
            else: frames.append(norm)
        state['attempts'].append(rec)
        if len(frames) == 3 and not rec['errors']:
            strip = Image.new('RGBA', (64 * 3, 64), (0, 0, 0, 0))
            for i, f in enumerate(frames): strip.alpha_composite(f, (64 * i, 0))
            strip.save(os.path.join(cdir, 'throw.png'))
            state.update({'status': 'ok', 'hash': sha(strip)})
            break
        fb = '\n[이전 시도 실패] ' + '; '.join(rec['errors']) + '. 문제 프레임만 고쳐 다시 써라(throw_N.txt).'
    return state


# ---------- 명령 ----------

def next_plate():
    os.makedirs(RUNS, exist_ok=True)
    nums = [int(m.group(1)) for d in os.listdir(RUNS) if (m := re.fullmatch(r'p(\d+)', d))]
    return 'p%d' % (max(nums, default=0) + 1)


def cmd_list(a):
    s = seed()
    for k, v in s['roles'].items():
        print('%-12s %-16s %s  Actor1 블록 %d' % (k, v['label'], v['view'], v['source']))


def cmd_draw(a):
    s = seed()
    roles = list(s['roles']) if a.role in (None, 'all') else a.role.split(',')
    for r in roles:
        if r not in s['roles']: sys.exit('모르는 역할: %s' % r)
    plate = a.plate or next_plate()
    letters = list(s['directions'])[:a.n]
    jobs = [(r, l) for r in roles for l in letters]
    os.makedirs(os.path.join(RUNS, plate), exist_ok=True)
    write_json(os.path.join(RUNS, plate, 'plate.json'), {'plate': plate, 'model': MODEL, 'roles': roles, 'letters': letters,
                                                         'created': now(), 'method': 'agy-argon-grid-rows (no image generation)'})
    print(plate, 'jobs=%d par=%d' % (len(jobs), a.par), flush=True)
    if a.background:
        log = open(os.path.join(RUNS, plate, 'draw.log'), 'a')
        subprocess.Popen([sys.executable, __file__, 'draw', ','.join(roles), '--n', str(a.n), '--par', str(a.par), '--plate', plate]
                         + (['--no-throw'] if a.no_throw else []), stdout=log, stderr=log, start_new_session=True)
        print('백그라운드로 시작:', os.path.join(RUNS, plate, 'draw.log'))
        return
    def one(j):
        m = make_candidate(plate, j[0], j[1], throw=not a.no_throw)
        print('%s/%s %s %s' % (j[0], j[1], m.get('status'), m.get('throw', {}).get('status', '')), flush=True)
    with cf.ThreadPoolExecutor(a.par) as ex: list(ex.map(one, jobs))
    print('끝', plate)


def plate_cands(plate):
    out = {}
    pdir = os.path.join(RUNS, plate)
    for role in seed()['roles']:
        rdir = os.path.join(pdir, role)
        if not os.path.isdir(rdir): continue
        out[role] = {l: read_json(os.path.join(rdir, l, 'meta.json'), {}) for l in sorted(os.listdir(rdir)) if os.path.isdir(os.path.join(rdir, l))}
    return out


def cmd_status(a):
    plates = [a.plate] if a.plate else sorted(d for d in os.listdir(RUNS) if re.fullmatch(r'p\d+', d)) if os.path.isdir(RUNS) else []
    for p in plates:
        print('==', p)
        for role, cs in plate_cands(p).items():
            print('  %-12s %s' % (role, ' '.join('%s:%s%s' % (l, m.get('status', '?'), '+T' if m.get('throw', {}).get('status') == 'ok' else '') for l, m in cs.items())))
    picks = read_json(os.path.join(DATA, 'picks.json'), {})
    print('picks:', json.dumps(picks, ensure_ascii=False) if picks else '(없음 — 사용자가 고르기 전)')


def data_uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def cmd_sheet(a):
    s = seed(); cands = plate_cands(a.plate)
    num = a.plate.lstrip('p')
    name = 'trainer-sprites-pick-%s.html' % num
    cards = []
    roles_js = {}
    for role, cs in cands.items():
        spec = s['roles'][role]; view = spec['view']
        src = source_frame(spec['source'], view)
        b = io.BytesIO(); src.save(b, 'PNG'); src_uri = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
        ok = [(l, m) for l, m in cs.items() if m.get('status') == 'ok']
        fail = [l for l, m in cs.items() if m.get('status') != 'ok']
        items = []
        roles_js[role] = {'view': view, 'cands': {}}
        for l, m in ok:
            sp = os.path.join(RUNS, a.plate, role, l, 'sprite.png')
            th = os.path.join(RUNS, a.plate, role, l, 'throw.png')
            uri = data_uri(sp); turi = data_uri(th) if os.path.exists(th) else ''
            roles_js[role]['cands'][l] = {'sprite': uri, 'throw': turi}
            warn = ''.join('<div class=w>%s</div>' % w for w in m.get('warnings', []))
            items.append(f'<div class=cand data-role="{role}" data-l="{l}"><div class=lt>{l}</div><div class=bg><img class=px data-w=64 src="{uri}"></div>'
                         + (f'<div class="bg thr"><div class=anim data-strip="{turi}" style="background-image:url({turi})"></div></div>' if turi else '')
                         + f'<div class=hs>{m["hash"]} · {m["colors"]}색{(" · 던지기 3장" if turi else "")}</div>{warn}</div>')
        for l in fail:
            items.append(f'<div class="cand failed"><div class=lt>{l}</div><div class=hs>검사 탈락(기록 {len(cs[l].get("attempts", []))}회)</div></div>')
        dirs = '<br>'.join('<b>%s</b> %s' % (k, v.split(' — ')[0]) for k, v in s['directions'].items())
        cards.append(f'<section><h3>{spec["label"]} <small>({role}, {"앞" if view == "front" else "뒤"}) — {spec["brief"]}</small></h3>'
                     f'<div class=row><div class=src><div class=bg><img class=px data-w=24 src="{src_uri}"></div><div class=hs>Actor1 원본 블록 {spec["source"]}</div></div>{"".join(items)}</div></section>')
    html = TEMPLATE.replace('@@CARDS@@', '\n'.join(cards)).replace('@@ROLES@@', json.dumps(roles_js)).replace('@@PLATE@@', a.plate) \
        .replace('@@ROLELIST@@', ' '.join('<code>%s</code>' % r for r in cands)).replace('@@DIRS@@', dirs)
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
<h1>트레이너 스프라이트 후보 시트 (@@PLATE@@) — Argon 이 Actor1 을 손 도트 격자로 변형</h1>
<div class=how><b>고르는 방법</b> — 카드를 눌러 역할마다 하나씩 고르면 맨 아래 칸에 <code>pick</code> 명령이 만들어집니다. 번호만 말해 주셔도 됩니다: 예) <code>hero_m=B hero_f=A boy=C …</code> (역할: @@ROLELIST@@).
고르기 전에는 번들·프로젝트에 아무것도 들어가지 않습니다. 후보 방향: <br>@@DIRS@@<br>
이 그림은 사람 캐릭터라 3/4 윗면 관문 대상이 아닙니다(object-gate 영수증 없음, 사람 선택 경로). 출처: Actor1 © Marina Navarro Travesset / VictorSena, CC BY 4.0 (EasyRPG RTP).</div>
<div class=bar>배율 <span id=sc></span> · 같은 배율로 Actor1 원본과 나란히 봅니다</div>
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
 document.documentElement.style.setProperty('--k',s)}
const sc=document.getElementById('sc');[2,4,8].forEach(s=>{const b=document.createElement('button');b.textContent=s+'×';b.dataset.s=s;b.onclick=()=>setScale(s);sc.appendChild(b)});
const st=document.createElement('style');document.head.appendChild(st);
function animCss(){st.textContent='@keyframes thr{0%{background-position:0 0}33%{background-position:-'+(64*scale)+'px 0}66%{background-position:-'+(128*scale)+'px 0}}'}
const oSet=setScale;setScale=function(s){oSet(s);animCss()};
const imgs={};function img(u){if(!imgs[u]){const i=new Image();i.src=u;imgs[u]=i}return imgs[u]}
function drawBat(){const c=document.getElementById('bat'),g=c.getContext('2d');g.imageSmoothingEnabled=false;
 const gr=g.createLinearGradient(0,0,0,320);gr.addColorStop(0,'#bfe6f4');gr.addColorStop(.45,'#d9f0d0');gr.addColorStop(.46,'#7fc06a');gr.addColorStop(1,'#4f9a48');g.fillStyle=gr;g.fillRect(0,0,480,320);
 g.fillStyle='#8cc77a';g.beginPath();g.ellipse(360,130,90,22,0,0,7);g.fill();g.fillStyle='#6aab58';g.beginPath();g.ellipse(110,262,110,26,0,0,7);g.fill();
 if(hero&&sel[hero]){const u=R[hero].cands[sel[hero]].sprite;const i=img(u);const f=()=>g.drawImage(i,24,128+ (320-262)-64+10-64,128,128);if(i.complete)f();else i.onload=drawBat}
 if(opp&&sel[opp]){const u=R[opp].cands[sel[opp]].sprite;const i=img(u);if(i.complete)g.drawImage(i,296,22,128,128);else i.onload=drawBat}}
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
    picks = read_json(os.path.join(DATA, 'picks.json'), {})
    cur = picks.setdefault(a.plate, {})
    for kv in a.picks:
        role, _, letter = kv.partition('=')
        m = read_json(os.path.join(RUNS, a.plate, role, letter, 'meta.json'))
        if not m or m.get('status') != 'ok': sys.exit('%s=%s 는 통과한 후보가 아니다' % (role, letter))
        cur[role] = {'letter': letter, 'hash': m['hash'], 'throw': m.get('throw', {}).get('hash'), 'at': now()}
    write_json(os.path.join(DATA, 'picks.json'), picks)
    print(json.dumps(cur, ensure_ascii=False))


def cmd_bake(a):
    s = seed(); picks = read_json(os.path.join(DATA, 'picks.json'), {}).get(a.plate, {})
    roles = a.roles or list(picks)
    if not picks or not roles: sys.exit('사용자가 고르기 전에는 굽지 않는다(picks.json 에 %s 기록 없음). pick 먼저.' % a.plate)
    index = read_json(os.path.join(BUNDLE, 'index.json'), {'version': 1, 'trainers': {}})
    for role in roles:
        if role not in picks: sys.exit('%s 는 고른 기록이 없다' % role)
        p = picks[role]; cdir = os.path.join(RUNS, a.plate, role, p['letter'])
        m = read_json(os.path.join(cdir, 'meta.json'))
        im = Image.open(os.path.join(cdir, 'sprite.png')).convert('RGBA')
        if sha(im) != p['hash']: sys.exit('%s: 고른 뒤 그림이 바뀌었다(해시 불일치) — 다시 고르게 해야 한다' % role)
        view = s['roles'][role]['view']
        odir = os.path.join(BUNDLE, role); os.makedirs(odir, exist_ok=True)
        shutil.copy(os.path.join(cdir, 'sprite.png'), os.path.join(odir, '%s.png' % view))
        entry = {'role': role, 'label': s['roles'][role]['label'], 'view': view, 'size': [64, 64], 'footY': s['baseline'],
                 'source': 'EasyRPG RTP Actor1 (CC BY 4.0) modified', view: '%s.png' % view}
        if os.path.exists(os.path.join(cdir, 'throw.png')):
            shutil.copy(os.path.join(cdir, 'throw.png'), os.path.join(odir, 'throw.png'))
            entry['throw'] = {'file': 'throw.png', 'frames': 3, 'frameSize': [64, 64]}
        index['trainers'][role] = entry
        print('baked', role, p['letter'])
    write_json(os.path.join(BUNDLE, 'index.json'), index)


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('list')
    d = sp.add_parser('draw'); d.add_argument('role', nargs='?'); d.add_argument('--n', type=int, default=5); d.add_argument('--par', type=int, default=5)
    d.add_argument('--plate'); d.add_argument('--no-throw', action='store_true'); d.add_argument('--background', action='store_true')
    st = sp.add_parser('status'); st.add_argument('plate', nargs='?')
    sh = sp.add_parser('sheet'); sh.add_argument('plate')
    pk = sp.add_parser('pick'); pk.add_argument('plate'); pk.add_argument('picks', nargs='+')
    bk = sp.add_parser('bake'); bk.add_argument('plate'); bk.add_argument('roles', nargs='*')
    a = ap.parse_args()
    {'list': cmd_list, 'draw': cmd_draw, 'status': cmd_status, 'sheet': cmd_sheet, 'pick': cmd_pick, 'bake': cmd_bake}[a.cmd](a)


if __name__ == '__main__': main()
