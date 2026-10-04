"""H열: 생성 단계에서부터 3/4 뷰로 뽑는다 → C(글자 = 픽셀) → E(Sonnet 손질).

G(정면 그림을 사후에 3/4로 고침)와 달리 원본이 처음부터 「윗면 T + 앞면 F」로 나온다. 생성 그림은 원본일 뿐이고
최종물은 C·E 를 거친 도트다(생성 픽셀 직접 채택 금지 — 데모 전용).

  python3 scripts/content/atlas-pick/ascii_h34.py frame            # 각도 틀 그리기
  python3 scripts/content/atlas-pick/ascii_h34.py gen <n> <라운드>  # Tibo 로 n장 뽑기 (h34/raw/)
  python3 scripts/content/atlas-pick/ascii_h34.py c <원본.png>      # C 단계 (h34/<이름>-c.png/.txt)
  python3 scripts/content/atlas-pick/ascii_h34.py e [이름...]       # E 단계 claude -p (h34/<이름>-post.*)
  python3 scripts/content/atlas-pick/ascii_h34.py check            # 형태 확인 + view34_check → h34/result.json
"""
import json, subprocess, sys, time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import ascii_pixelize as ap  # noqa: E402
import bakeoff_c as bc  # noqa: E402
from ascii_post import to_img, zoom_grid, hexrgb  # noqa: E402

ROOT = ap.ROOT
H = ROOT / 'tiledata/atlas-pick/ascii-pixelize/h34'
RAWD = H / 'raw'
FRAME = H / 'frame.png'
K = 4
SHEET = (448, 256)
TOP, FRONT = (224, 224, 224), (150, 150, 150)

# 이름: (박스 x0,y0,x1,y1 @1x, 윗면 두께 T @1x, 목표 크기, 분류, 설명)
OBJ = {
    'tree_sakura': ((8, 8, 72, 104), 12, (32, 48), 'exempt', 'a cherry-blossom street tree: pink blossom crown (its rounded TOP surface visible from above as a lighter dome, T about 12) above a short trunk'),
    'tree_green': ((80, 8, 144, 104), 12, (32, 48), 'exempt', 'a leafy green street tree: round dark-green crown (its rounded TOP surface visible from above as a lighter dome) above a short trunk'),
    'vending_red': ((156, 8, 182, 56), 10, (16, 30), 'prop', 'a red-white Japanese drink vending machine: top face T=10 light lid seen from above, front face F=38 with lit product window, coin slot, dispensing slot'),
    'vending_blue': ((190, 8, 216, 56), 10, (16, 30), 'prop', 'a blue-white Japanese drink vending machine: top face T=10 light lid seen from above, front face F=38 with lit product window, buttons, dispensing slot'),
    'street_lamp': ((228, 8, 256, 88), 10, (16, 40), 'exempt', 'a gray street lamp: the lamp head shows its lighter TOP surface (T about 10) above its lit front, then a thin pole and a small base with a top face'),
    'traffic_light': ((266, 8, 322, 92), 10, (32, 48), 'exempt', 'a traffic light: a horizontal signal box on a gray pole; the box shows its lighter TOP surface (T about 10) above its front with three lights (red lit), the pole head also shows a small top face'),
    'hero': ((334, 8, 366, 56), 8, (16, 24), 'exempt', 'a 16x24 JRPG hero: young person, dark hair (the top of the head/hair seen slightly from above), white shirt, navy jacket, standing facing the viewer'),
    'taxi': ((8, 120, 120, 184), 14, (56, 32), 'vehicle', 'a yellow-cream Japanese taxi in SIDE PROFILE, wheels at both ends: NO front grille, NO windshield facing us. Three light strips = the visible TOP surfaces of hood (low, left), roof (raised, middle, with a small roof lamp on it) and trunk (low, right); under them the body side F with dark windows and two black wheels'),
    'guardrail': ((136, 136, 232, 160), 6, (48, 16), 'prop', 'a section of white-and-gray metal roadside guardrail: light top face T=6 seen from above on the rail, front face F=18 with two rails, two posts with small top faces'),
}

CORE = ("EDIT TASK. The reference is a flat gray SPRITE-SHEET FRAME on a magenta #FF00FF background: each gray box marks where ONE separate game sprite goes. "
        "In every box the LIGHT gray upper band is the object's TOP SURFACE seen from above and the MEDIUM gray lower part is its FRONT FACE below it. "
        "PAINT each box as a finished pixel-art sprite in top-down 3/4 view JRPG map sprite (RPG Maker style): each object shows its top surface seen from above AND its front face below; "
        "NO side faces (at most a 1px darker right edge); light from the top-left, so the top surface is the LIGHTEST tone. "
        "Keep the top band and the front part at the sizes the frame gives; never draw a flat front elevation without a top surface. "
        "EVERY sprite must FILL its gray box completely, touching all four edges of the box (the box IS the sprite's bounding box; no empty gray margin around it). "
        "The top band must be painted with the object's real TOP SURFACE (roof, lid, cap, rail top, canopy top) as a lighter tone, clearly separated from the darker front face. "
        "Look at the object as if the camera is high above and in front, tilted down about 45 degrees: the roof, hood, trunk, lid and rail tops are seen as thick lighter surfaces, at least a third as tall as the front face. "
        "Do NOT copy the gray band colors themselves and do NOT leave any gray band unpainted. "
        "Keep everything between boxes flat magenta #FF00FF (no shadows on the ground, no ground), and inside each box keep the empty background flat medium gray. "
        + bc.STYLE + " Sprites in frame order: ")
ORDER = list(OBJ)


def prompt():
    parts = []
    for i, n in enumerate(ORDER):
        parts.append(f"({i + 1}) {OBJ[n][4]}")
    return CORE + '; '.join(parts) + '. No text, no logos.'


def make_frame():
    im = Image.new('RGB', SHEET, bc.MAG)
    d = ImageDraw.Draw(im)
    for n, (b, t, *_r) in OBJ.items():
        x0, y0, x1, y1 = b
        d.rectangle([x0, y0, x1 - 1, y0 + t - 1], fill=TOP)
        d.rectangle([x0, y0 + t, x1 - 1, y1 - 1], fill=FRONT)
    # 택시: 옆모습 — 보닛·트렁크는 낮고 지붕은 솟는다(단차). 윗면 3개가 밝은 띠.
    x0, y0, x1, y1 = OBJ['taxi'][0]
    d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=bc.MAG)
    d.rectangle([x0 + 34, y0, x0 + 86, y0 + 13], fill=TOP)              # 지붕 윗면
    d.rectangle([x0 + 34, y0 + 14, x0 + 86, y1 - 1], fill=FRONT)        # 캐빈 옆면
    d.rectangle([x0, y0 + 26, x0 + 33, y0 + 37], fill=TOP)              # 보닛 윗면
    d.rectangle([x0, y0 + 38, x0 + 33, y1 - 1], fill=FRONT)
    d.rectangle([x0 + 87, y0 + 26, x1 - 1, y0 + 37], fill=TOP)          # 트렁크 윗면
    d.rectangle([x0 + 87, y0 + 38, x1 - 1, y1 - 1], fill=FRONT)
    big = im.resize((SHEET[0] * K, SHEET[1] * K), Image.NEAREST)
    big.save(FRAME); im.save(H / 'frame1x.png')
    return big


def gen(n, rnd):
    make_frame()
    p = prompt()
    (H / f'prompt-{rnd}.txt').write_text(p + '\n', encoding='utf-8')

    def one(i):
        out = RAWD / f'{rnd}-{i}.png'
        ok, dt, err = bc.tibo(p, str(FRAME), str(out), 'sunburst')
        print(rnd, i, 'ok' if ok else 'FAIL', '%.0fs' % dt, err or '', flush=True)
        with open(RAWD / 'gen-log.jsonl', 'a') as f:
            f.write(json.dumps(dict(round=rnd, i=i, ok=ok, sec=round(dt), model='sunburst', err=str(err) if err else None,
                                    t=time.strftime('%F %T'))) + '\n')
    with ThreadPoolExecutor(n) as ex:
        list(ex.map(one, range(1, n + 1)))


def c_stage(raw, only=None):
    pal = ap.palette()
    im = Image.open(raw).convert('RGB')
    bx = ap.boxes(im)
    assert len(bx) == len(ORDER), (len(bx), bx)
    res = []
    for n, b in zip(ORDER, bx):
        if only and n not in only:
            continue
        res.append(c_one(n, im.crop(b), OBJ[n][2], pal))
        print(n, res[-1]['src'], res[-1]['target'], res[-1]['colors'])
    return res


def flood_mask(crop, tol=30, light=False):
    """두 톤 틀(밝은 윗면·중간 앞면)과 마젠타가 원본에 번졌으므로, 테두리에서 바탕색만 따라 번지는 채움으로 바탕을 지운다.
    ap.object_mask 는 최빈 한 색만 바탕으로 보아 두 톤을 못 지운다."""
    from collections import deque
    w, h = crop.size; px = crop.load()
    def gray(c): return max(c) - min(c) < 22
    def mag(c): return c[0] > 190 and c[2] > 190 and c[1] < min(c[0], c[2]) - 40
    border = [px[x, y] for x in range(w) for y in (0, h - 1)] + [px[x, y] for y in range(h) for x in (0, w - 1)]
    q = Counter((c[0] // 6, c[1] // 6, c[2] // 6) for c in border if gray(c))
    tones = []
    for k, _ in q.most_common(8):
        c = tuple(v * 6 + 3 for v in k)
        if all(sum((a - b) ** 2 for a, b in zip(c, t)) > 24 ** 2 for t in tones):
            tones.append(c)
        if len(tones) == 3: break
    def is_bg(c):
        if mag(c): return True
        if light and gray(c) and sum(c) > 3 * 196: return True   # 택시: 밝은 윗띠(틀 색)가 톤 목록에서 빠질 때
        return gray(c) and any(sum((a - b) ** 2 for a, b in zip(c, t)) <= tol * tol for t in tones)
    bgm = [[False] * w for _ in range(h)]
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(px[x, y]) and not bgm[y][x]: bgm[y][x] = True; dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(px[x, y]) and not bgm[y][x]: bgm[y][x] = True; dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bgm[ny][nx] and is_bg(px[nx, ny]):
                bgm[ny][nx] = True; dq.append((nx, ny))
    return [[not bgm[y][x] for x in range(w)] for y in range(h)], tones


def c_one(name, crop, target, pal):
    mask, bg = flood_mask(crop, light=(name == 'taxi'))
    x0, y0, x1, y1 = ap.tight(mask)
    crop = crop.crop((x0, y0, x1, y1)); mask = [r[x0:x1] for r in mask[y0:y1]]
    w, h = crop.size
    tw, th = target
    s = min(tw / w, th / h)
    gw, gh = max(1, round(w * s)), max(1, round(h * s))
    ox, oy = (tw - gw) // 2, th - gh
    px = crop.load(); cache = {}
    q = [[ap.nearest(px[x, y], pal, cache) if mask[y][x] else None for x in range(w)] for y in range(h)]
    top = ap.pick_k(Counter(c for r in q for c in r if c), ap.K)
    q = [[(min(top, key=lambda p: ap.dist(c, p)) if c not in top else c) if c else None for c in r] for r in q]
    order = sorted(top, key=ap.lum)
    ch = {c: ap.CHARS[i] for i, c in enumerate(order)}
    grid = [['.'] * tw for _ in range(th)]
    for gy in range(gh):
        for gx in range(gw):
            sx0, sx1 = int(gx * w / gw), max(int(gx * w / gw) + 1, int((gx + 1) * w / gw))
            sy0, sy1 = int(gy * h / gh), max(int(gy * h / gh) + 1, int((gy + 1) * h / gh))
            cnt = Counter(q[y][x] for y in range(sy0, sy1) for x in range(sx0, sx1))
            if sum(v for c, v in cnt.items() if c) * 2 < sum(cnt.values()):
                continue
            grid[oy + gy][ox + gx] = ch[max((c for c in cnt if c), key=lambda c: cnt[c])]
    text = '\n'.join(''.join(r) for r in grid)
    legend = {v: '#%02x%02x%02x' % k for k, v in ch.items()}
    (H / f'{name}-c.txt').write_text(text + '\n', encoding='utf-8')
    to_img(text, legend).save(H / f'{name}-c.png')
    crop.save(H / f'{name}-src.png')
    return {'name': name, 'target': list(target), 'src': [w, h], 'legend': legend,
            'colors': len(top)}


def c_cmd(raw):
    res = c_stage(raw)
    (H / 'c-result.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    Image.open(raw).save(H / 'raw-chosen.png')


# ───────── E ─────────
PROMPT = ap_prompt = None


def e_prompt(n, r):
    from ascii_post import PROMPT as BASE
    rel = lambda p: str(p.relative_to(ROOT))
    leg = ', '.join(f"'{k}'={v}" for k, v in sorted(r['legend'].items(), key=lambda kv: sum(hexrgb(kv[1]))))
    tw, th = r['target']
    txt = BASE.format(name=n, w=tw, h=th, src=rel(H / f'{n}-srcs.png'), zoom=rel(H / f'{n}-zoom.png'),
                      txt=rel(H / f'{n}-c.txt'), legend=leg, out=rel(H / f'{n}-post.txt'), notes=rel(H / f'{n}-notes.md'))
    return txt + "- 윗면(가장 밝은 단)과 앞면 구분을 지켜라. 윗면 띠를 앞면 색으로 덮거나 지우지 마라. 택시라면 지붕·보닛·트렁크 윗면 단차를 그대로 둔다.\n"


def e_prep(names=None):
    res = json.loads((H / 'c-result.json').read_text(encoding='utf-8'))
    jobs = []
    for r in res:
        n = r['name']
        if names and n not in names:
            continue
        text = (H / f'{n}-c.txt').read_text(encoding='utf-8')
        zoom_grid(to_img(text, r['legend'])).save(H / f'{n}-zoom.png')
        s = Image.open(H / f'{n}-src.png'); s.thumbnail((360, 360)); s.save(H / f'{n}-srcs.png')
        (H / f'{n}-prompt.md').write_text(e_prompt(n, r), encoding='utf-8')
        jobs.append(n)
    return jobs


def e_run_one(n):
    p = (H / f'{n}-prompt.md').read_text(encoding='utf-8')
    r = subprocess.run(['claude', '-p', '--model', 'sonnet', '--effort', 'medium', '--allowedTools', 'Read,Write',
                        '--output-format', 'json', p], cwd=ROOT, capture_output=True, text=True, timeout=1800)
    (H / f'{n}-run.json').write_text(r.stdout or r.stderr, encoding='utf-8')
    return n, r.returncode


def e_cmd(names):
    jobs = e_prep(names)
    with ThreadPoolExecutor(len(jobs)) as ex:
        for n, rc in ex.map(e_run_one, jobs):
            print(n, rc, flush=True)


# 택시: 첫 실행이 한 줄 1자 짧아 보정해 저장했고, 한 번 더 돌린 결과(57자 줄)가 더 나빠 첫 결과를 유지했다.
PADDED_MANUAL = {'taxi': 1}


def check():
    res = json.loads((H / 'c-result.json').read_text(encoding='utf-8'))
    out = []
    for r in res:
        n = r['name']; tw, th = r['target']
        cls = OBJ[n][3]
        f = H / f'{n}-post.txt'
        if not f.exists():
            # 두 번 돌려도 줄 수/길이가 틀리면(긴 쪽은 채울 수 없다) E 실패 — 페이지는 C 를 그대로 쓴다.
            cost = 0.0
            for rf in (f'{n}-run.json', f'{n}-run1.json'):
                try: cost += json.loads((H / rf).read_text(encoding='utf-8')).get('total_cost_usd') or 0
                except Exception: pass
            out.append({'name': n, 'cls': cls, 'size': [tw, th], 'e_failed': True, 'shape_ok': False,
                        'note': '재실행까지 두 번 모두 줄 수/길이 초과(1회 49줄, 재시도 시 33자 줄) → C 그대로', 'check': None, 'cost_usd': cost})
            continue
        rows = f.read_text(encoding='utf-8').strip('\n').split('\n')
        shape_ok = len(rows) == th and all(len(a) == tw for a in rows)
        padded = 0
        if not shape_ok and len(rows) == th and all(tw - 2 <= len(a) <= tw for a in rows):
            fixed = []
            for a in rows:
                k = tw - len(a); padded += k > 0
                fixed.append('.' * (k // 2) + a + '.' * (k - k // 2))
            rows, shape_ok = fixed, True
            f.write_text('\n'.join(rows) + '\n', encoding='utf-8')
        bad = sorted({c for a in rows for c in a if c != '.' and c not in r['legend']})
        chk = None
        if shape_ok and not bad:
            to_img('\n'.join(rows), r['legend']).save(H / f'{n}-post.png')
            # 기계 검사는 C·E 둘 다 잰다. 예외 조각은 눈 검수(check=None).
            chk = {}
            for tag, png in (('c', H / f'{n}-c.png'), ('post', H / f'{n}-post.png')):
                if cls == 'exempt':
                    continue
                c = subprocess.run(['python3', 'scripts/content/atlas-pick/view34_check.py', f'{png}:{cls}'],
                                   cwd=ROOT, capture_output=True, text=True)
                line = (c.stdout or c.stderr).strip().splitlines()[-1:] if (c.stdout or c.stderr) else []
                chk[tag] = line[0].split('  ', 0)[0][-90:] if line else None
        cost = 0.0
        for rf in (f'{n}-run.json', f'{n}-run1.json'):   # 재실행이 있으면 두 번 값을 합친다
            try:
                cost += json.loads((H / rf).read_text(encoding='utf-8')).get('total_cost_usd') or 0
            except Exception:
                pass
        padded = padded or PADDED_MANUAL.get(n, 0)
        out.append({'name': n, 'cls': cls, 'size': [tw, th], 'shape_ok': shape_ok, 'padded_rows': padded,
                    'bad_chars': bad, 'check': chk, 'cost_usd': cost})
    (H / 'result.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    for o in out:
        print(o)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'frame':
        make_frame()
    elif cmd == 'gen':
        gen(int(sys.argv[2]), sys.argv[3])
    elif cmd == 'c':
        c_cmd(sys.argv[2])
    elif cmd == 'e':
        e_cmd(sys.argv[2:] or None)
    elif cmd == 'check':
        check()
