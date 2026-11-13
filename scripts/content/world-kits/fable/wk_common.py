"""테마 세계 칩셋 늘리기 — Fable 한 방 그리기 공용(세계 불문): 경로 · 주인공 칩 · 지금 타일셋의 키트 그림/칸 통행 · 행 문자열 ↔ PNG · 답 읽기.

그림의 흐름: draw.py(모델, 그림 한 장에 호출 1번) → tiledata/<세계>/variety/src/<id>.png → build.py(모델 없음: 변형의 빈 칸 지키기·집 부품 조립)
           → tiledata/<세계>/variety/pieces/<머리>-<id>.png + spec.json + waiver-manifest.json → object-gate owner-waive → 그 세계의 굽기 스크립트.
세계마다 다른 것(팔레트·시트·주문 목록)은 worlds/<세계 id>.py 가 준다. 작업 폴더(장부·모델 답·보낸 글)는 저장소 밖: 환경 변수 WK_FABLE_WORK,
없으면 ~/.cache/oprn-world-kits/<세계> (/tmp 는 지워진다).
"""
import importlib, json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
BG = (196, 160, 104)
KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
T = 16


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


class World:
    """worlds/<id>.py 를 읽어 경로·팔레트·지금 타일셋을 묶는다."""
    def __init__(self, wid):
        sys.path.insert(0, os.path.join(HERE, 'worlds'))
        self.mod = m = importlib.import_module(wid)
        self.id, self.prefix = m.ID, m.PREFIX
        self.dir = os.path.join(ROOT, m.DIR, 'variety')
        self.src, self.pieces = os.path.join(self.dir, 'src'), os.path.join(self.dir, 'pieces')
        self.work = os.environ.get('WK_FABLE_WORK') or os.path.expanduser(f'~/.cache/oprn-world-kits/{wid}')
        self.ramps = {k: list(v) for k, v in m.RAMPS.items()}
        self.rev = {}
        for r, tones in self.ramps.items():
            for i, c in enumerate(tones):
                self.rev.setdefault(hx(c), f'{r}:{i}')
        self.ts = json.load(open(os.path.join(ROOT, m.TILESET), encoding='utf-8'))
        self.sheet = Image.open(os.path.join(ROOT, m.SHEET)).convert('RGBA')
        self.tpr = self.ts['tilesPerRow']
        self.kits = {k['id']: k for k in self.ts['structureKits']}

    # ── 지금 타일셋에서 읽는 것(변형의 틀) ──
    def tile(self, t):
        return self.sheet.crop(((t % self.tpr) * T, (t // self.tpr) * T, (t % self.tpr) * T + T, (t // self.tpr) * T + T))

    def kit_image(self, kid):
        k = self.kits[kid]
        im = Image.new('RGBA', (k['width'] * T, k['height'] * T), (0, 0, 0, 0))
        for y, row in enumerate(k['rows']):
            for x in range(k['width']):
                for t in (row['tiles'][x], (row.get('upperTiles') or [-1] * k['width'])[x]):
                    if t is not None and t >= 0: im.alpha_composite(self.tile(t), (x * T, y * T))
        return im

    def kit_pcs(self, kid):
        """원본 키트의 칸마다 통행 종류(굽기의 pc 낱말) — 변형은 같은 칸에 같은 pc 를 받는다. {(x,y): pc}"""
        k = self.kits[kid]; out = {}
        for y, row in enumerate(k['rows']):
            for x in range(k['width']):
                lo, up = row['tiles'][x], (row.get('upperTiles') or [-1] * k['width'])[x]
                if up is not None and up >= 0:
                    walk = self.ts['passability'][up]['up']
                    out[(x, y)] = 'solid' if not walk else 'star' if self.ts['priority'][up] == 'upper' else 'flat'
                elif lo is not None and lo >= 0:
                    out[(x, y)] = 'floor' if self.ts['passability'][lo]['up'] else 'solidfloor'
        return out

    def kit_entrance(self, kid):
        for p in self.kits[kid].get('parts') or []:
            if p.get('kind') == 'entrance': return list(range(p['dx'], p['dx'] + p['w']))
        return None

    def src_png(self, pid):
        p = os.path.join(self.src, pid + '.png')
        return Image.open(p).convert('RGBA') if os.path.exists(p) else None

    # ── 행 문자열(모델과 주고받는 형식): {"legend": {"글자": "램프:단"}, "rows": ["…"]} ──
    def colour_of(self, name):
        if not isinstance(name, str) or ':' not in name: return None
        r, t = name.split(':', 1)
        try: t = int(t)
        except ValueError: return None
        ramp = self.ramps.get(r.strip())
        return hx(ramp[t]) if ramp is not None and 0 <= t < len(ramp) else None

    def png_to_rows(self, im):
        a = np.array(im.convert('RGBA'))
        names = []
        for px in a.reshape(-1, 4):
            if px[3] == 255:
                n = self.rev.get(tuple(int(v) for v in px[:3]))
                if n and n not in names: names.append(n)
        order = list(self.ramps)
        names.sort(key=lambda n: (order.index(n.split(':')[0]), int(n.split(':')[1])))
        inv = {n: KEYS[i] for i, n in enumerate(names)}
        rows = [''.join('.' if px[3] == 0 else inv.get(self.rev.get(tuple(int(v) for v in px[:3])), '.') for px in row) for row in a]
        return {v: k for k, v in inv.items()}, rows

    def rows_to_png(self, legend, rows):
        h, w = len(rows), len(rows[0])
        a = np.zeros((h, w, 4), np.uint8)
        cols = {k: self.colour_of(v) for k, v in legend.items()}
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if cols.get(ch): a[y, x, :3] = cols[ch]; a[y, x, 3] = 255
        return Image.fromarray(a, 'RGBA')

    def read_answer(self, w, h, text):
        """모델의 답 → {'strictOk', 'strictErrors', 'lenientOk', 'legend', 'rows', 'door'}. 느슨하게 읽되(앞뒤 글 떼기·행 길이 맞추기) 엄격 결과도 남긴다.
        lenientOk = 그림으로 읽혔다(8% 이상 채움)."""
        t = (text or '').strip()
        out = {'strictOk': False, 'strictErrors': [], 'lenientOk': False, 'legend': None, 'rows': None, 'door': None}
        obj = None
        try: obj = json.loads(t)
        except Exception: out['strictErrors'].append('답이 JSON 하나가 아님')
        ok = lambda o: isinstance(o, dict) and isinstance(o.get('rows'), list) and isinstance(o.get('legend'), dict)
        if not ok(obj):
            t2 = re.sub(r'\.(?:replace|slice|substring|substr|padEnd|padStart|repeat|join|map)\([^()]*\)', '', t)
            objs, dec, i = [], json.JSONDecoder(), t2.find('{')
            while i >= 0:
                try:
                    o, end = dec.raw_decode(t2, i)
                    if ok(o): objs.append(o)
                    i = t2.find('{', end)
                except Exception:
                    i = t2.find('{', i + 1)
            if not objs: return out
            obj = objs[-1]
        legend = {}
        for k, v in obj['legend'].items():
            if len(str(k)) == 1 and k != '.' and self.colour_of(v) is not None: legend[k] = v
            else: out['strictErrors'].append(f'쓸 수 없는 범례 {k}={v!r}')
        rows = [str(r).replace(' ', '') for r in obj['rows']]
        if len(rows) != h:
            out['strictErrors'].append(f'행 수 {len(rows)} ≠ {h}')
            rows = (rows + ['.' * w] * h)[:h]
        n = sum(1 for r in rows if len(r) != w)
        if n:
            out['strictErrors'].append(f'길이 틀린 행 {n}개')
            rows = [(r + '.' * w)[:w] for r in rows]
        okc = set(legend) | {'.'}
        if any(ch not in okc for r in rows for ch in r):
            out['strictErrors'].append('범례에 없는 글자')
            rows = [''.join(ch if ch in okc else '.' for ch in r) for r in rows]
        out.update(legend=legend, rows=rows, door=obj.get('door'), strictOk=not out['strictErrors'])
        out['lenientOk'] = sum(1 for r in rows for ch in r if ch != '.') >= 0.08 * w * h
        return out


def _actor(col):
    """Actor1 걷기 칩 시트의 col 번째 사람, 앞모습 가운데 프레임(24×32)."""
    im = Image.open(os.path.join(ROOT, 'public/assets/easyrpg/charset/Actor1.png')).convert('RGBA')
    key = np.array(im)[0, 0, :3]
    ox, oy = (col % 4) * 72, (col // 4) * 128
    a = np.array(im.crop((ox + 24, oy + 64, ox + 48, oy + 96)))
    a[(a[:, :, :3] == key).all(-1)] = 0
    return Image.fromarray(a, 'RGBA')


def hero():
    return _actor(0)


def people(n=3):
    return [_actor(c) for c in range(1, 1 + n)]


def big(im, s, bg=BG):
    b = Image.new('RGBA', (im.width * s, im.height * s), tuple(bg) + (255,))
    b.alpha_composite(im.convert('RGBA').resize((im.width * s, im.height * s), Image.NEAREST))
    return b.convert('RGB')


def cap_for(w, h):
    """출력 상한(토큰) — 화소 수에 따라. 48×56(2,688px) 을 넘는 그림은 한 번에 못 그린다(잘린다): 쪼개서 주문한다."""
    px = w * h
    for lim, cap in ((256, 8000), (512, 9000), (768, 10000), (1024, 12000), (1536, 16000), (1920, 18000), (2304, 20000), (2760, 24000)):
        if px <= lim: return cap
    raise ValueError(f'{w}x{h} = {px}px is over the piece limit')
