#!/usr/bin/env python3
"""몬스터 걷기 칩(따라다니기용 24x32 x 4방향 x 3프레임) 후보 하네스 — Argon 이 격자 문자열을 손으로 적는다.

생성 이미지·합성 코드는 쓰지 않는다. 고른 앞·뒤 전투 그림(번들 112x112)을 참고 그림으로 보여 주고
(@front_4x.png / @back_4x.png), 모델이 `down_0/1/2.txt up_0/1/2.txt right_0/1/2.txt`(각 32줄x24글자)와 palette.json 을
직접 쓴다. 왼쪽은 오른쪽을 거울로 뒤집어 만든다(저작 부담 3분의 1, 거울은 하네스가 한다).
하네스는 규격을 검사·정규화하고(오류면 피드백과 함께 최대 3번 다시 시킨다) 72x128 칩 PNG 와 시트를 만든다.

  python3 field_chip.py draw --species gustchick [--n 2] [--notes 특징] [--base <run>/cand-1]   후보를 그린다(agy gemini-4-argon-medium)
  python3 field_chip.py sheet --species gustchick --out ~/claude-viz/x.html   후보 시트(걷기 GIF 포함)
  python3 field_chip.py pick --species gustchick --run <run> --candidate 1   고른 칩을 장부에 기록(그림 해시 묶음)
  python3 field_chip.py bake   고른 칩을 8명씩 288x256 시트로 묶어 번들에 굽고 런타임 목록을 다시 쓴다(칸 번호는 덧붙이기 전용)
  python3 field_chip.py derive --species grovewarden   앞·뒤 전투 그림을 그대로 줄여 칩 후보 1개를 만든다(모델 없음, 결정적)

산출은 <OUT>/<종>/<run>/cand-<k>/ (OUT 기본 qa-runs/harnesses/monster-field-chip, 저장소에 커밋하지 않는다).
고르기는 사람(또는 위임받은 감독)이 한다. 키는 읽지도 쓰지도 않는다(agy 가 환경에서 스스로 인증한다).
"""
import argparse, base64, datetime, hashlib, io, json, os, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
BUNDLE = os.path.join(ROOT, 'public/assets/harnesses/monster-collect-species')
PICKS = os.path.join(ROOT, 'harness-data/monster-collect-species/field-picks.json')
CHIPS_DIR = os.path.join(ROOT, 'harness-data/monster-collect-species/field-chips')
OUT = os.environ.get('MONSTER_FIELD_CHIP_OUT', os.path.join(ROOT, 'qa-runs/harnesses/monster-field-chip'))
MODEL = os.environ.get('MONSTER_FIELD_CHIP_MODEL', 'gemini-4-argon-medium')
TIMEOUT = int(os.environ.get('MONSTER_FIELD_CHIP_TIMEOUT', str(20 * 60)))
MAX_ATTEMPTS = int(os.environ.get('MONSTER_FIELD_CHIP_ATTEMPTS', '3'))
W, H = 24, 32
BASELINE = 30  # 발 바닥 줄(0 기준). 기존 Monster4~6 칩은 31 이지만 여유 한 줄을 둔다.
DIRS = ['up', 'right', 'down', 'left']  # 칩 시트 행 순서(RM2000)
SRC_DIRS = ['down', 'up', 'right']      # 모델이 그리는 방향. left = right 거울.
FRAMES = [0, 1, 2]                      # 0·2 = 걸음, 1 = 서 있는 그림(걷기 순서 0,1,2,1)

NO_GEN = ("이미지 생성 기능·image-generator 서브에이전트·이미지 API 는 절대 쓰지 마라. "
          "원·다각형·수식으로 몸을 합성하는 코드도 금지다. 모든 행의 문자열을 네가 직접 손으로 적어라(파일 쓰기 도구로 txt 에 그대로 쓴다). "
          "허용되는 코드는 txt 들을 PNG 로 굽는 아주 작은 확인용 스크립트뿐이다.")


def now(): return datetime.datetime.now().isoformat(timespec='seconds')
def agy_bin(): return shutil.which('agy') or os.path.expanduser('~/.local/bin/agy')
def seed(): return json.load(open(os.path.join(ROOT, 'harness-data/monster-collect-species/seed.json'), encoding='utf-8'))


def species_info(sid):
    for s in seed()['species']:
        if s['id'] == sid: return s
    raise SystemExit('시드에 종 %s 가 없다' % sid)


def sha(im): return hashlib.sha256(im.tobytes()).hexdigest()[:16]


def parse_hex(v):
    v = v.strip().lstrip('#')
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def enlarged(path_in, k, path_out):
    im = Image.open(path_in).convert('RGBA')
    bg = Image.new('RGBA', (im.width * k, im.height * k), (150, 190, 150, 255))
    bg.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST))
    bg.convert('RGB').save(path_out)


def suggested_palette(path, n=12):
    """참고 그림의 대표색(자주 쓰인 순). 모델이 그대로 쓰거나 줄이도록 글자와 함께 알려 준다."""
    im = Image.open(path).convert('RGBA'); px = im.load(); counts = {}
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] >= 128:
                c = tuple(v // 8 * 8 + 4 for v in px[x, y][:3]); counts[c] = counts.get(c, 0) + 1
    top = sorted(counts, key=lambda c: -counts[c])[:n]
    return {'abcdefghijkl'[i]: '#%02x%02x%02x' % c for i, c in enumerate(top)}


def read_grid(path, pal):
    rows = [ln.rstrip('\n') for ln in open(path, encoding='utf-8')]
    while rows and rows[-1] == '': rows.pop()
    errs = []
    if len(rows) != H: errs.append('%s: 줄 수 %d (%d 여야 함)' % (os.path.basename(path), len(rows), H))
    bad = [i + 1 for i, r in enumerate(rows) if len(r) != W]
    if bad: errs.append('%s: 길이가 %d 가 아닌 줄 %s' % (os.path.basename(path), W, bad[:8]))
    unk = sorted({ch for r in rows for ch in r if ch != '.' and ch not in pal})
    if unk: errs.append('%s: 팔레트에 없는 글자 %s' % (os.path.basename(path), ''.join(unk)))
    if errs: return None, errs
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.': px[x, y] = pal[ch] + (255,)
    return im, []


MIN_CHANGED = int(os.environ.get('MONSTER_FIELD_CHIP_MIN_CHANGED', '20'))


def changed_cells(a, b):
    pa, pb = a.load(), b.load()
    return sum(1 for y in range(H) for x in range(W) if pa[x, y] != pb[x, y])


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


def check_frame(name, im):
    errs, warns = [], []
    bb = im.getbbox()
    if not bb: return ['%s: 그림이 비어 있다' % name], warns
    x0, y0, x1, y1 = bb
    if x1 - x0 > 22: errs.append('%s: 가로 %d칸(최대 22)' % (name, x1 - x0))
    if y1 - y0 < 10: errs.append('%s: 세로 %d줄은 너무 작다(최소 10)' % (name, y1 - y0))
    if y1 - 1 < BASELINE - 1 or y1 - 1 > BASELINE + 1: errs.append('%s: 발 바닥이 %d 줄(기준 %d±1)' % (name, y1 - 1, BASELINE))
    if x0 < 1 or x1 > W - 1: warns.append('%s: 가장자리에 닿음' % name)
    cols = len({im.getpixel((x, y)) for y in range(H) for x in range(W) if im.getpixel((x, y))[3]})
    if cols > 16: errs.append('%s: 사용 색 %d개(최대 16)' % (name, cols))
    comp = components(im); opaque = sum(comp)
    if comp and comp[0] / opaque < 0.8: errs.append('%s: 가장 큰 덩어리가 전체의 %d%% 뿐(흩어짐)' % (name, comp[0] / opaque * 100))
    return errs, warns


def assemble(frames):
    """frames[(dir,frame)] → 72x128 시트(열=프레임 0..2, 행=위·오른쪽·아래·왼쪽)."""
    sheet = Image.new('RGBA', (72, 128), (0, 0, 0, 0))
    for r, d in enumerate(DIRS):
        for f in FRAMES:
            im = frames[('right', f)].transpose(Image.FLIP_LEFT_RIGHT) if d == 'left' else frames[(d, f)]
            sheet.alpha_composite(im, (f * 24, r * 32))
    return sheet


def prompt(spec, sid, pal, feedback='', notes='', base=False):
    pal_lines = '\n'.join('  %s = %s' % (k, v) for k, v in pal.items())
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    return f"""@front_4x.png 는 이 몬스터 「{spec['name'] if 'name' in spec else sid}」의 전투 앞모습(왼쪽을 보고 서 있음), @back_4x.png 는 뒷모습이다(112x112 도트를 4배 확대, 배경은 임의 초록).
{NO_GEN}

[과제] 두 그림을 참고해 같은 몬스터가 필드를 따라다니는 **작은 걷기 칩**(RPG Maker 2000 CharSet 규격, 24x32 프레임)을 새로 그려라. 단순 축소가 아니라 24x32 안에서 읽히도록 비율을 단순화한다(머리·큰 특징을 크게, 다리·잔털은 줄임). 같은 몸 형태·색을 유지해 한눈에 같은 몬스터로 보이게 한다.
설정: {spec.get('brief') or spec.get('concept') or ''}
{('이 몬스터의 특징(앞모습 기준, 반드시 칩에서도 보여야 함): ' + notes) if notes else ''}
{BASE_NOTE if base else ''}

[그릴 프레임 9장] 모두 24열 x 32줄 격자, '.' 은 투명. 파일 이름 → 내용
- down_1.txt : 화면 아래쪽(카메라)을 보는 서 있는 그림(정면)
- down_0.txt / down_2.txt : 같은 방향의 걸음 두 장(왼발·오른발이 번갈아, 몸이 1줄 올라갔다 내려가거나 다리·꼬리 위치만 바꿈. 두 장은 서로 좌우 대칭 걸음)
- up_0/1/2.txt : 위쪽을 보는 뒷모습, 같은 방식(1 = 서 있는 그림)
- right_0/1/2.txt : 오른쪽을 보는 옆모습, 같은 방식(전투 앞모습은 왼쪽을 보니 몸 형태는 그 좌우 반전이다. 꼬리·날개가 24칸 폭 밖으로 나가 잘리지 않게 말거나 짧게 줄이고, 가로 22칸 안에 모두 들어오게 한다). 왼쪽 방향은 하네스가 right 를 거울로 뒤집어 쓰니 그리지 않는다.
**걷기 프레임 규칙(하네스가 변경 셀 수를 검사해 어기면 거절한다)**: 걷기 순서는 0,1,2,1 이다. 프레임 0 과 2 는 서로 다른 걸음, 1 은 서 있는 그림이다.
 - 프레임 0·2 는 서 있는 그림(1)과 비교해 각각 **최소 20칸 이상** 달라야 하고, 0 과 2 도 서로 **최소 28칸 이상**(그중 발·다리가 있는 아래 8줄에서 6칸 이상) 달라야 한다.
 - 다리(발) 위치를 확실히 바꾼다: 한쪽 발을 들거나 앞뒤로 벌린다(프레임 0 은 왼발 앞/오른발 뒤, 프레임 2 는 반대). 발·다리가 없는 부분은 몸 전체를 1줄 위로 올린다(프레임 0·2 중 하나 이상은 몸통이 1줄 위, 발 바닥 줄은 그대로).
 - 몸통·머리는 같은 모양과 색을 유지하되 걷는 중 1줄 상하로 움직여도 된다. 날개·꼬리는 걸음에 맞춰 1~2칸 흔든다. 발이 움직이지 않는 그림은 거절된다.

[규격]
- 그림은 가로 22칸 이하, 발 바닥(가장 아래 불투명 줄)은 **위에서 {BASELINE + 1}번째 줄(0부터 센 {BASELINE}번 줄, ±1)**. 몸 윗부분은 몬스터 크기에 맞게 아래쪽에 두고 위는 투명으로 비운다(작은 몬스터는 세로 14~20줄이 알맞다).
- 1px 짙은 윤곽(몸 색보다 어두운 같은 계열 한 색), 재질당 2~3톤 명암, 빛은 왼쪽 위, 디더·노이즈·안티앨리어싱 금지. 사용 색 16개 이하. 참고 그림의 색을 그대로 쓴다.
- 대표색(참고 그림에서 뽑음. 필요하면 윤곽색·그림자색을 더 추가해도 된다):
{pal_lines}
{fb}
[산출물] 현재 폴더에 위 9개 txt(각 정확히 32줄, 줄마다 정확히 24글자)와 palette.json({{"글자": "#rrggbb"}}, '.' 는 넣지 않고 글자는 한 자)을 쓴다. 쓴 뒤 txt 들을 PNG(preview.png, 6배 확대, 3열x3행)로 굽는 확인용 스크립트를 돌려 직접 열어 보고 윤곽 끊김·프레임 흔들림·잡티를 최소 한 번 고쳐 다시 써라. 끝나면 'done' 한 단어만 답하라.
"""


BASE_NOTE = ("[기준 그림] 현재 폴더에 이미 9장 txt 와 palette.json 이 있다(이전 후보). 서 있는 그림(_1)과 몸 형태·색·윤곽은 그대로 두고 "
             "**걷기 프레임 _0 과 _2 만** 위 규칙대로 다시 그려라. _1 도 다리 위치가 어색하면 고쳐도 되지만 몸 형태는 바꾸지 않는다.")


def run_agy(cwd, text, label):
    t0 = time.time()
    try:
        r = subprocess.run([agy_bin(), '-p', text, '--model', MODEL, '--output-format', 'text'], cwd=cwd,
                           capture_output=True, text=True, timeout=TIMEOUT)
        out, code = (r.stdout or '') + (r.stderr or ''), r.returncode
    except subprocess.TimeoutExpired:
        out, code = 'timeout', 124
    open(os.path.join(cwd, 'agy-%s.log' % label), 'w').write('exit=%s sec=%.0f\n%s' % (code, time.time() - t0, out[-4000:]))
    return code


def load_attempt(d):
    errs, warns = [], []
    try:
        pal = {k: parse_hex(v) for k, v in json.load(open(os.path.join(d, 'palette.json'))).items() if k != '.'}
    except Exception as e:
        return None, ['palette.json 읽기 실패: %s' % e], warns
    frames = {}
    for dr in SRC_DIRS:
        for f in FRAMES:
            p = os.path.join(d, '%s_%d.txt' % (dr, f))
            if not os.path.exists(p): errs.append('%s_%d.txt 가 없다' % (dr, f)); continue
            im, e = read_grid(p, pal)
            if e: errs += e; continue
            e2, w2 = check_frame('%s_%d' % (dr, f), im)
            errs += e2; warns += w2
            frames[(dr, f)] = im
    if errs: return None, errs, warns
    # 같은 방향 걸음 사이 몸 크기 흔들림
    for dr in SRC_DIRS:
        ws = [frames[(dr, f)].getbbox() for f in FRAMES]
        hs = [b[3] - b[1] for b in ws]
        if max(hs) - min(hs) > 3: errs.append('%s 방향 프레임의 세로 크기가 %s 로 흔들린다(차이 3줄 이하)' % (dr, hs))
        for a_, b_ in ((0, 1), (2, 1), (0, 2)):
            n = changed_cells(frames[(dr, a_)], frames[(dr, b_)])
            if n < (MIN_CHANGED if (a_, b_) != (0, 2) else MIN_CHANGED + 8): errs.append('%s 방향 프레임 %d 와 %d 는 %d칸만 다르다(최소 %d칸 — 다리·발 위치를 확실히 바꿔라)' % (dr, a_, b_, n, MIN_CHANGED))
        legs = sum(1 for y in range(BASELINE - 7, H) for x in range(W) if frames[(dr, 0)].getpixel((x, y)) != frames[(dr, 2)].getpixel((x, y)))
        if legs < 6: errs.append('%s 방향 프레임 0 과 2 의 다리·발 줄(아래 8줄)이 %d칸만 다르다(최소 6칸 — 발 위치를 번갈아 바꿔라)' % (dr, legs))
    return (frames if not errs else None), errs, warns


def make_candidate(sid, run_dir, k, front, back, pal, notes='', base_dir=None):
    cdir = os.path.join(run_dir, 'cand-%d' % k); os.makedirs(cdir, exist_ok=True)
    enlarged(front, 4, os.path.join(cdir, 'front_4x.png')); enlarged(back, 4, os.path.join(cdir, 'back_4x.png'))
    spec = species_info(sid); meta = {'species': sid, 'k': k, 'attempts': []}
    feedback = []
    for n in range(1, MAX_ATTEMPTS + 1):
        adir = os.path.join(cdir, 'attempts', str(n)); os.makedirs(adir, exist_ok=True)
        for f in ('front_4x.png', 'back_4x.png'): shutil.copy(os.path.join(cdir, f), adir)
        if base_dir and n == 1:
            for f in os.listdir(base_dir):
                if f.endswith('.txt') or f == 'palette.json': shutil.copy(os.path.join(base_dir, f), adir)
        elif base_dir and n > 1:  # 재시도는 직전 시도 파일 위에서 고친다
            prev = os.path.join(cdir, 'attempts', str(n - 1))
            for f in os.listdir(prev):
                if f.endswith('.txt') or f == 'palette.json': shutil.copy(os.path.join(prev, f), adir)
        code = run_agy(adir, prompt(spec, sid, pal, feedback, notes, bool(base_dir)), 'try%d' % n)
        frames, errs, warns = load_attempt(adir)
        meta['attempts'].append({'n': n, 'agy_exit': code, 'errors': errs, 'warnings': warns, 'at': now()})
        json.dump(meta, open(os.path.join(cdir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
        if frames:
            sheet = assemble(frames)
            sheet.save(os.path.join(cdir, 'chip.png'))
            meta.update({'ok': True, 'sha': sha(sheet), 'warnings': warns})
            json.dump(meta, open(os.path.join(cdir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
            return meta
        feedback = errs
    meta['ok'] = False
    json.dump(meta, open(os.path.join(cdir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    return meta


def cmd_draw(a):
    sid = a.species
    front = os.path.join(BUNDLE, sid, 'front.png'); back = os.path.join(BUNDLE, sid, 'back.png')
    if not (os.path.exists(front) and os.path.exists(back)): raise SystemExit('번들에 %s 앞·뒤 그림이 없다(build 먼저)' % sid)
    run = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    run_dir = os.path.join(OUT, sid, run); os.makedirs(run_dir, exist_ok=True)
    pal = suggested_palette(front)
    base_dir = None
    if a.base:  # "<run>/<cand>" — 그 후보의 마지막 시도 파일을 출발점으로 삼는다(걷기만 보강)
        brun, bk = a.base.split('/')
        battempts = os.path.join(OUT, sid, brun, bk, 'attempts')
        base_dir = os.path.join(battempts, str(max(int(x) for x in os.listdir(battempts))))
    print('run', run, 'dir', run_dir)
    with ThreadPoolExecutor(max_workers=a.n) as ex:
        res = list(ex.map(lambda k: make_candidate(sid, run_dir, k, front, back, pal, a.notes or '', base_dir), range(1, a.n + 1)))
    for m in res: print('cand', m['k'], 'ok' if m.get('ok') else 'FAIL', [len(t['errors']) for t in m['attempts']])
    print(run)


def gif_uri(frames_img, d, scale=8):
    row = DIRS.index(d); seq = [0, 1, 2, 1]; out = []
    for f in seq:
        c = frames_img.crop((f * 24, row * 32, f * 24 + 24, row * 32 + 32)).resize((24 * scale, 32 * scale), Image.NEAREST)
        bg = Image.new('RGBA', c.size, (150, 190, 150, 255)); bg.alpha_composite(c); out.append(bg.convert('P', palette=Image.ADAPTIVE))
    b = io.BytesIO(); out[0].save(b, 'GIF', save_all=True, append_images=out[1:], duration=220, loop=0, disposal=2)
    return 'data:image/gif;base64,' + base64.b64encode(b.getvalue()).decode()


def png_uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def cmd_sheet(a):
    cards = []
    for sid in a.species:
        sdir = os.path.join(OUT, sid)
        for run in sorted(os.listdir(sdir)) if os.path.isdir(sdir) else []:
            for cd in sorted(os.listdir(os.path.join(sdir, run))):
                p = os.path.join(sdir, run, cd, 'chip.png')
                if not os.path.exists(p): continue
                chip = Image.open(p).convert('RGBA')
                big = Image.new('RGBA', (chip.width * 5, chip.height * 5), (150, 190, 150, 255))
                big.alpha_composite(chip.resize((chip.width * 5, chip.height * 5), Image.NEAREST))
                gifs = ''.join('<figure><img src="%s"><figcaption>%s</figcaption></figure>' % (gif_uri(chip, d), d) for d in DIRS)
                front = Image.open(os.path.join(BUNDLE, sid, 'front.png')).convert('RGBA')
                meta = json.load(open(os.path.join(sdir, run, cd, 'meta.json')))
                cards.append('<section><h3>%s · %s / %s</h3><div class="row"><figure><img src="%s" style="width:224px;image-rendering:pixelated"><figcaption>전투 앞모습 원본(2배)</figcaption></figure>'
                             '<figure><img src="%s" style="image-rendering:pixelated"><figcaption>칩 72x128 (위·오른·아래·왼, 5배)</figcaption></figure><figure><img src="%s"><figcaption>실제 크기 1배(게임 화면 그대로)</figcaption></figure>%s</div>'
                             '<p>시도 %d회 · 경고 %s · 해시 %s</p></section>' % (sid, run, cd, png_uri(front), png_uri(big.convert('RGB')), png_uri(chip), gifs,
                                                                           len(meta['attempts']), '; '.join(meta.get('warnings', [])) or '없음', meta.get('sha')))
    html = ('<!doctype html><meta charset="utf-8"><title>%s</title><style>body{background:#14161c;color:#e8e8ee;font:14px sans-serif;margin:20px}'
            'section{border:1px solid #333;padding:10px;margin:14px 0;background:#1d2029}.row{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap}'
            'figure{margin:0;text-align:center}img{image-rendering:pixelated}figcaption{font-size:12px;color:#aab}</style><h1>%s</h1>%s'
            % (a.title, a.title, ''.join(cards)))
    open(os.path.expanduser(a.out), 'w', encoding='utf-8').write(html)
    print(a.out, len(cards), '장')


# ---- derive: 전투 그림에서 칩을 바로 만든다 -------------------------------------------------
# 2026-10-18 「몬스터 하나에 서로 다른 이미지들이 혼재」 — 모델이 따로 그린 칩은 전투 그림과 다른 생물이 되곤 했다.
# derive 는 고른 앞(아래·옆 방향)·뒤(위 방향) 전투 그림을 칸 최빈색으로 줄이고 앞모습 가장 어두운 색으로 1px 윤곽을 다시 둘러
# 색·실루엣이 전투 그림 그대로인 칩을 만든다. 걸음은 몸을 1줄 올리고 발 줄을 좌우로 1칸 엇갈린다.
DERIVE_W, DERIVE_H = 20, 26  # 몸 상한: 좌우 2칸 여유(걸음 엇갈림이 칸 경계에 닿지 않게)·위 4칸 여유


def _lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _reduce(im, tw, th):
    """잉크 상자를 tw x th 안으로 줄인다. 칸마다 불투명이 절반 이상이면 최빈색(같으면 어두운 색)."""
    im = im.convert('RGBA'); bb = im.getbbox(); im = im.crop(bb); px = im.load(); w, h = im.size
    s = max(w / tw, h / th, 1)
    ow, oh = max(1, round(w / s)), max(1, round(h / s))
    out = Image.new('RGBA', (ow, oh), (0, 0, 0, 0)); po = out.load()
    for oy in range(oh):
        for ox in range(ow):
            y0, x0 = int(oy * s), int(ox * s)
            y1, x1 = max(y0 + 1, int((oy + 1) * s)), max(x0 + 1, int((ox + 1) * s))
            counts, total = {}, 0
            for y in range(y0, min(y1, h)):
                for x in range(x0, min(x1, w)):
                    total += 1
                    if px[x, y][3] >= 128: counts[px[x, y][:3]] = counts.get(px[x, y][:3], 0) + 1
            if sum(counts.values()) * 2 < total: continue
            po[ox, oy] = min(counts, key=lambda c: (-counts[c], _lum(c))) + (255,)
    return out


def _outline(im, ink):
    """바깥과 닿은 칸을 윤곽색으로, 8방향 이웃 없는 외톨이 도트는 지운다."""
    w, h = im.size; px = im.load(); out = im.copy(); po = out.load()
    on = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y][3] > 0
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            if not any(on(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy): po[x, y] = (0, 0, 0, 0)
            elif not (on(x - 1, y) and on(x + 1, y) and on(x, y - 1) and on(x, y + 1)): po[x, y] = ink + (255,)
    return out


def _limit_colors(im, n=16):
    """16색 넘으면 드문 색을 가장 가까운 자주 쓴 색으로 바꾼다(새 색은 만들지 않는다)."""
    px = im.load(); w, h = im.size; counts = {}
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: counts[px[x, y][:3]] = counts.get(px[x, y][:3], 0) + 1
    keep = sorted(counts, key=lambda c: -counts[c])[:n]
    near = {c: min(keep, key=lambda k: sum((a - b) ** 2 for a, b in zip(c, k))) for c in counts}
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: px[x, y] = near[px[x, y][:3]] + (255,)
    return im


def _place(body, lift=0, step=0):
    """24x32 칸 바닥(BASELINE) 가운데에 놓는다. lift: 몸을 위로, step: 발 줄(아래 4줄)을 좌우로 엇갈림."""
    frame = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    x = (W - body.width) // 2; y = BASELINE + 1 - body.height
    frame.alpha_composite(body, (x, y - lift))
    if step:
        feet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); feet.alpha_composite(body, (x + step, y))
        band = (0, BASELINE - 3, W, BASELINE + 1)
        frame.paste((0, 0, 0, 0), band); frame.alpha_composite(feet.crop(band), band[:2])
    return frame


def _clean_chip_eye(px, bw, bh, inner, rect):
    """줄인 몸의 눈 자리 rect(x0,y0,x1,y1, 끝 제외)에서 윤곽이 아닌 어두운 칸을 둘레 밝은 살갗의 최빈색으로 덮는다."""
    x0, y0, x1, y1 = max(rect[0], 0), max(rect[1], 0), min(rect[2], bw), min(rect[3], bh)
    ring = [px[x, y] for x in range(x0 - 1, x1 + 1) for y in range(y0 - 1, y1 + 1)
            if 0 <= x < bw and 0 <= y < bh and not (x0 <= x < x1 and y0 <= y < y1) and px[x, y][3] and _lum(px[x, y]) >= 110]
    if not ring: return
    skin = max(set(ring), key=ring.count)
    for x in range(x0, x1):
        for y in range(y0, y1):
            if inner(x, y) and _lum(px[x, y]) < _lum(skin) * 0.6: px[x, y] = skin


def _stamp_chip_eyes(body, front, eye):
    """손 도트 2차 눈(eyes.json 의 patch 종): 줄인 몸에서 사라지는 눈을 앞모습 눈 자리에 다시 찍는다.
    가까운 눈 = 2x2(왼쪽 위 흰 반짝임 + 어두운 3칸), 먼 눈 = 1x2 어두운 칸. 투명·실루엣 가장자리 칸에는 찍지 않는다.
    eye['chip'] == 'clean'(3차, eye-patches-r3): 찍기 전에 줄인 눈 자리의 어두운 잔상을 둘레 살갗색으로 지우고, 정면 둘째 눈(second)도 2x2 로 찍는다."""
    src = front.convert('RGBA'); bb = src.getbbox(); w, h = bb[2] - bb[0], bb[3] - bb[1]
    s = max(w / DERIVE_W, h / DERIVE_H, 1)
    px = body.load(); bw, bh = body.size; sp = src.load()
    nx, ny, nw, nh = eye['near']
    cells = [sp[x, y] for x in range(nx, nx + nw) for y in range(ny, ny + nh) if sp[x, y][3]]
    dark = min(cells, key=_lum)[:3] + (255,); white = max(cells, key=_lum)[:3] + (255,)
    # 6차(eye_catalog_r6): 종마다 홍채 색이 다르다 — 칩 눈 오른쪽 아래 칸에 앞모습 눈의 가장 흔한 유채색(홍채)을 찍는다
    tinted = [c for c in cells if c[:3] != dark[:3] and c[:3] != white[:3] and max(c[:3]) - min(c[:3]) >= 40]
    iris = max(set(tinted), key=tinted.count)[:3] + (255,) if tinted else dark
    inner = lambda x, y: 0 < x < bw - 1 and 0 < y < bh - 1 and all(px[x + dx, y + dy][3] for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))
    def at(box):
        return round((box[0] + box[2] / 2 - bb[0]) / s - 0.5), round((box[1] + box[3] / 2 - bb[1]) / s - 0.5)
    clean = eye.get('chip') == 'clean'
    cx, cy = at(eye['near'])
    cx, cy = min(cx, bw - 2), min(cy, bh - 2)
    if clean:  # 다시 찍을 수 있는 눈 자리만 지운다(찍기는 알파만 보므로 지우기 전에 판정해도 같다)
        def fits(x, y, w, h): return all(inner(x + dx, y + dy) for dx in range(w) for dy in range(h))
        for box, w in ((eye['near'], 2), (eye.get('far'), 1), (eye.get('second'), 2)):
            if not box: continue
            ex, ey = (cx, cy) if box is eye['near'] else at(box)
            if box is eye.get('far'): ex = min(ex, cx - 2)
            if fits(ex, ey, w, 2):
                _clean_chip_eye(px, bw, bh, inner, [int((box[0] - bb[0]) / s), int((box[1] - bb[1]) / s), int(-(-(box[0] + box[2] - bb[0]) // s)), int(-(-(box[1] + box[3] - bb[1]) // s))])
    for ex, ey in [(cx, cy)] + ([tuple(min(v, lim) for v, lim in zip(at(eye['second']), (bw - 2, bh - 2)))] if clean and eye.get('second') else []):
        spots = [(ex, ey, white), (ex + 1, ey, dark), (ex, ey + 1, dark), (ex + 1, ey + 1, iris if (eye.get('patch') or {}).get('source') == 'eye_catalog_r6.py' else dark)]
        if all(inner(x, y) for x, y, _ in spots):
            for x, y, c in spots: px[x, y] = c
    if eye.get('far'):
        fx, fy = at(eye['far'])
        fx = min(fx, cx - 2)
        if all(inner(fx, y) and _lum(px[fx, y]) > 110 for y in (fy, fy + 1)):
            px[fx, fy] = dark; px[fx, fy + 1] = dark
    return body


def derive_frames(front, back, eye=None):
    """앞·뒤 전투 그림 → frames[(dir, f)] (down·up·right × 0·1·2). eye = eyes.json 항목(patch 종만 칩 눈을 다시 찍는다)."""
    ink = min((c[:3] for _, c in front.convert('RGBA').getcolors(1 << 16) if c[3] >= 128), key=_lum)
    down = _outline(_reduce(front, DERIVE_W, DERIVE_H), ink)
    if eye and eye.get('patch'):
        down = _stamp_chip_eyes(down, front, eye)
    bodies = {
        'down': down,
        'up': _outline(_reduce(back, DERIVE_W, DERIVE_H), ink),
    }
    bodies['right'] = bodies['down'].transpose(Image.FLIP_LEFT_RIGHT)  # 전투 앞모습은 왼쪽을 본다
    frames = {}
    for d, body in bodies.items():
        frames[(d, 0)] = _limit_colors(_place(body, lift=1, step=-1))
        frames[(d, 1)] = _limit_colors(_place(body))
        frames[(d, 2)] = _limit_colors(_place(body, lift=1, step=1))
    return frames


def cmd_derive(a):
    sid = a.species
    front = os.path.join(BUNDLE, sid, 'front.png'); back = os.path.join(BUNDLE, sid, 'back.png')
    if not (os.path.exists(front) and os.path.exists(back)): raise SystemExit('번들에 %s 앞·뒤 그림이 없다(build 먼저)' % sid)
    run = 'derive-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    cdir = os.path.join(OUT, sid, run, 'cand-1'); os.makedirs(cdir, exist_ok=True)
    eyes = json.load(open(os.path.join(ROOT, 'harness-data/monster-collect-species/eyes.json'), encoding='utf-8'))['species']
    frames = derive_frames(Image.open(front), Image.open(back), eyes.get(sid))
    errs, warns = [], []
    for (d, f), im in frames.items():
        e, w = check_frame('%s_%d' % (d, f), im); errs += e; warns += w
    meta = {'species': sid, 'k': 1, 'derived': True, 'attempts': [{'n': 1, 'errors': errs, 'warnings': warns, 'at': now()}]}
    if not errs:
        sheet = assemble(frames); sheet.save(os.path.join(cdir, 'chip.png'))
        meta.update({'ok': True, 'sha': sha(sheet), 'warnings': warns})
    else:
        meta['ok'] = False
    json.dump(meta, open(os.path.join(cdir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    print(sid, run, 'ok' if meta['ok'] else 'FAIL', '; '.join(errs + warns))



def cmd_pick(a):
    cdir = os.path.join(OUT, a.species, a.run, 'cand-%d' % a.candidate)
    meta = json.load(open(os.path.join(cdir, 'meta.json')))
    if not meta.get('ok'): raise SystemExit('이 후보는 검사를 통과하지 못했다')
    chip = Image.open(os.path.join(cdir, 'chip.png')).convert('RGBA')
    if sha(chip) != meta['sha']: raise SystemExit('그림이 바뀌었다(해시 불일치)')
    os.makedirs(CHIPS_DIR, exist_ok=True)
    chip.save(os.path.join(CHIPS_DIR, a.species + '.png'))
    picks = json.load(open(PICKS)) if os.path.exists(PICKS) else {'version': 1, 'picks': {}}
    picks['picks'][a.species] = {'run': a.run, 'candidate': a.candidate, 'sha': meta['sha'], 'at': now(), 'note': a.note or ''}
    json.dump(picks, open(PICKS, 'w'), ensure_ascii=False, indent=1); open(PICKS, 'a').write('\n')
    print(a.species, '칩 ←', a.run, '후보', a.candidate, meta['sha'])


def cmd_bake(a):
    picks = json.load(open(PICKS))['picks'] if os.path.exists(PICKS) else {}
    fdir = os.path.join(BUNDLE, 'field'); os.makedirs(fdir, exist_ok=True)
    idx_path = os.path.join(fdir, 'index.json')
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {'sheets': 0, 'chips': {}}
    used = {(c['sheet'], c['index']) for c in idx['chips'].values()}
    for sid in picks:  # 이미 칸이 있으면 유지(덧붙이기 전용 — 저장된 프로젝트의 참조가 흔들리지 않게)
        if sid in idx['chips']: continue
        n = 0
        while (n // 8 + 1, n % 8) in used: n += 1
        idx['chips'][sid] = {'sheet': n // 8 + 1, 'index': n % 8}; used.add((n // 8 + 1, n % 8))
    idx['sheets'] = max([c['sheet'] for c in idx['chips'].values()] or [0])
    sheets = {}
    for sid, c in idx['chips'].items():
        chip_path = os.path.join(CHIPS_DIR, sid + '.png')
        if not os.path.exists(chip_path): raise SystemExit('%s 칩 파일이 없다(pick 먼저)' % sid)
        sh = sheets.setdefault(c['sheet'], Image.new('RGBA', (288, 256), (0, 0, 0, 0)))
        sh.alpha_composite(Image.open(chip_path).convert('RGBA'), ((c['index'] % 4) * 72, (c['index'] // 4) * 128))
    for n, sh in sheets.items(): sh.save(os.path.join(fdir, 'chips-%d.png' % n), optimize=True)
    json.dump(idx, open(idx_path, 'w'), ensure_ascii=False, indent=1); open(idx_path, 'a').write('\n')
    print('시트', idx['sheets'], '장 · 칩', len(idx['chips']), '개 →', os.path.relpath(fdir, ROOT))
    subprocess.run(['node_modules/.bin/vite-node', '--script', 'scripts/harness.mts', '--', 'monster-collect-species', 'manifest'], cwd=ROOT, check=True)


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('draw'); d.add_argument('--species', required=True); d.add_argument('--n', type=int, default=2); d.add_argument('--notes'); d.add_argument('--base'); d.set_defaults(fn=cmd_draw)
    s = sub.add_parser('sheet'); s.add_argument('--species', nargs='+', required=True); s.add_argument('--out', required=True); s.add_argument('--title', default='몬스터 걷기 칩 후보'); s.set_defaults(fn=cmd_sheet)
    k = sub.add_parser('pick'); k.add_argument('--species', required=True); k.add_argument('--run', required=True); k.add_argument('--candidate', type=int, required=True); k.add_argument('--note'); k.set_defaults(fn=cmd_pick)
    b = sub.add_parser('bake'); b.set_defaults(fn=cmd_bake)
    v = sub.add_parser('derive'); v.add_argument('--species', required=True); v.set_defaults(fn=cmd_derive)
    a = ap.parse_args(); a.fn(a)


if __name__ == '__main__':
    main()
