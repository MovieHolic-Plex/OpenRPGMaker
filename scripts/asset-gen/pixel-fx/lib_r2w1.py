"""retro2003 2차 확장(r2w1: 묶음 a1·a2) 스킬 이펙트 공용 모듈 (2026-09-29).

좌표로만 찍는 도트: 원본 그림·축소·블러·안티에일리어싱 없음. lib_samurai.Ink(= lib_scout.Cel) 위에 새 모티프를 얹는다.
직업 모듈 r2w1_<classKey>.py 가 한 직업의 스킬 목록(SKILLS)과 이펙트 시트(@effect) 전부를 가진다.

    python3 scripts/asset-gen/pixel-fx/lib_r2w1.py a1                # a1 전체: 시트 + 확인판 + 무대 합성판
    python3 scripts/asset-gen/pixel-fx/lib_r2w1.py a1 valkyrie_dive  # 키 지정
    python3 scripts/asset-gen/pixel-fx/lib_r2w1.py --emit a1         # SKILLS → src/assets/retroRosterSkills/a1.ts
    python3 scripts/asset-gen/pixel-fx/lib_r2w1.py a1 valkyrie       # 한 직업만(직업 이름은 BATCHES 의 classKey)

정본은 **묶음 파일(src/assets/retroRosterSkills/<batch>.ts)**: 시트를 쓰기 전에 그 파일의 (frame, frames, anchor)와
스크립트의 (SIZE, FRAMES, ANCHOR)가 같은지 확인하고 다르면 멈춘다(--emit 로 만든 파일도 같은 검사를 거친다).

셀 규약(retroClassSkills.ts 머리 주석과 같다):
  user/target/allTargets/allAllies  발이 SIZE-8 행, 몸 중심이 셀 중심   screen  무대 전체 128px(fade_oval 필수)
  projectile  32px 루프, 머리(진행 방향)가 **왼쪽**  · 시트당 ≤16색, 알파 0/255
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

if __name__ == '__main__':  # 직업 모듈이 `from lib_r2w1 import *` 할 때 같은 인스턴스(REG)를 보게 한다.
    sys.modules['lib_r2w1'] = sys.modules['__main__']

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lib_samurai import Ink, INDIGO, IRON, WHITE  # noqa: E402,F401
from lib_scout import (Cel, rgba, lerp, ease, rng, pol, pal, pick, check, board, gif, OUT, ROOT, BG)  # noqa: E402,F401
from fx_edge import fade_edges, fade_oval  # noqa: E402

REVIEW = ROOT / '.omo/r2w1'
BATCH_DIR = ROOT / 'src/assets/retroRosterSkills'
REG = {}          # key -> dict(size, frames, anchor, pal, draw, edge, module)
CLASSES = {}      # classKey -> module
BATCHES = {
    'a1': ['valkyrie', 'paladin', 'red_mage', 'dark_knight', 'chronomancer', 'thief', 'beast_tamer'],
    'a2': ['pirate', 'sorceress', 'elf_archer', 'hunter', 'brawler', 'martial_artist', 'general', 'prince'],
}
ANCHORS = ('user', 'target', 'allTargets', 'allAllies', 'screen', 'projectile')
MOTIONS = ('dash-strike', 'leap-strike', 'blink-strike', 'flurry', 'spin', 'cast', 'shoot', 'buff', 'finisher')

# ------------------------------------------------------------------ 색 가족(같은 글자 = 같은 색, 직업 안에서 이어진다)
SKY = dict(b0='#0c1c48', b1='#2456b4', b2='#5c9cf0', b3='#b4dcff', b4='#effaff')
GOLD = dict(y0='#6a3c0c', y1='#c8801c', y2='#ffd444', y3='#fff4a8')
STEEL = dict(s0='#2a3448', s1='#6c7c98', s2='#b8c8dc', s3='#eef4fc')
HOLY = dict(h0='#8a5a10', h1='#e8b030', h2='#fff0a0', h3='#ffffe8')
CRIM = dict(r0='#3c0814', r1='#8c1428', r2='#e03040', r3='#ff8878', r4='#ffd8c8')
VIO = dict(v0='#140a24', v1='#3a1c62', v2='#7a3cc0', v3='#b878f0', v4='#e8ccff')
TEAL = dict(c0='#08303c', c1='#14708a', c2='#38c0d8', c3='#98ecf4', c4='#e4ffff')
GREEN = dict(g0='#123018', g1='#2c6c30', g2='#5cb040', g3='#a4e068', g4='#e4ffb8')
BROWN = dict(t0='#301a0c', t1='#6c4220', t2='#a87438', t3='#dcae6c', t4='#f8e4b0')
FIREC = dict(f0='#4c1010', f1='#b02c18', f2='#f06a1c', f3='#ffb43a', f4='#fff2a0')
SEA = dict(a0='#08183c', a1='#14509c', a2='#2c8ce0', a3='#70d4f4', a4='#d0f8ff')
SMOKEC = dict(q0='#1c1c28', q1='#444458', q2='#787890', q3='#b0b0c4', q4='#e8e8f4')
BLOOD = dict(d0='#280408', d1='#640c1c', d2='#b01c30', d3='#f05060')
PINK = dict(p0='#4c1030', p1='#b02c68', p2='#f070a8', p3='#ffc0d8')
AMBER = dict(m0='#4a2408', m1='#a85c14', m2='#f0a028', m3='#ffe07c')


class _Pal(dict):
    """없는 키를 만나면 마젠타를 돌려주고 기록한다(끝에서 한꺼번에 알린다)."""
    missing = set()

    def __missing__(self, k):
        _Pal.missing.add(k)
        return (255, 0, 255, 255)


class Ink2(Ink):
    """Ink + 이 묶음 전용 모티프. 모든 채움은 팔레트 키다."""

    def __init__(self, n, palette):
        super().__init__(n, palette)
        self.pal = _Pal(self.pal)

    def wing(self, x, y, side, span, keys, flap=0.0, tilt=0.0, feathers=5):
        """옆으로 펼친 날개. side=-1 왼쪽/+1 오른쪽, span 은 펼친 길이. flap: -1(내림)~1(올림). keys 어두움→밝음."""
        base = (x, y)
        n = feathers
        for layer, k in enumerate(keys):
            shrink = 1 - layer * 0.16
            for i in range(n):
                u = i / max(1, n - 1)
                a = math.radians(-75 + 150 * u * 0.9 - 50 * flap + tilt)
                L = span * shrink * (0.55 + 0.45 * math.sin(math.pi * (0.25 + 0.75 * (1 - u))))
                tip = (x + side * math.cos(a) * L, y + math.sin(a) * L)
                w = max(1.0, span * 0.11 * shrink)
                self.poly([base, (tip[0] - side * 0, tip[1] - w), (tip[0], tip[1] + w)], k)

    def spear(self, x, y, ang, L, shaft='t2', head='s2', hi='s3', tip=None, wrap=None, edge=None, big=1.0):
        """창: 촉 끝이 (x, y), ang(라디안) 방향으로 자루가 뒤로 L 만큼. big 은 촉 배율. edge 가 있으면 어두운 테두리를 두른다."""
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        hl, hw = 10 * big, 3.2 * big
        ex, ey = x - ux * L, y - uy * L
        bx, by = x - ux * hl, y - uy * hl
        if edge:
            self.line([(bx, by), (ex, ey)], edge, 4)
            self.poly([(x + ux * 1.5, y + uy * 1.5), (bx + vx * (hw + 1.4), by + vy * (hw + 1.4)), (bx - ux * 2, by - uy * 2), (bx - vx * (hw + 1.4), by - vy * (hw + 1.4))], edge)
        self.line([(bx, by), (ex, ey)], shaft, 2)
        if wrap:
            for j in range(4):
                t = hl + 2 + j * 4
                self.line([(x - ux * t + vx * 1.5, y - uy * t + vy * 1.5), (x - ux * t - vx * 1.5, y - uy * t - vy * 1.5)], wrap)
        self.poly([(x, y), (bx + vx * hw, by + vy * hw), (bx - ux * 1.5, by - uy * 1.5), (bx - vx * hw, by - vy * hw)], head)
        self.line([(x, y), (bx + ux * 1, by + uy * 1)], hi)
        self.line([(bx + vx * hw * 0.6, by + vy * hw * 0.6), (bx - vx * hw * 0.6, by - vy * hw * 0.6)], hi)

    def glow(self, x, y, r, keys, squash=1.0):
        """부드러운 빛무리: 가장 바깥은 체커 디더, 안쪽으로 갈수록 밝고 꽉 찬 원."""
        n = len(keys)
        for i, k in enumerate(keys):
            rr = r * (1 - i / (n + 0.5))
            if i == 0:
                self.ddisc(x, y, rr, k, squash=squash)
            else:
                self.oval(x, y, rr, rr * squash, k)

    def burst(self, x, y, r, keys, rays=8, rot=0.0, long=1.5, core=True):
        """방사형 폭발: 끝이 뾰족한 광선 + 중심 원. keys 어두움→밝음(마지막 두 개가 중심)."""
        ray_keys = keys[:-1] if len(keys) > 2 else keys
        for i in range(rays):
            a = rot + i * math.tau / rays
            ln = r * long * (0.7 if i % 2 else 1.0)
            self.lens((x, y), pol(x, y, ln, a), max(2.0, r * 0.3), ray_keys)
        if core:
            self.disc(x, y, r * 0.62, keys[-2] if len(keys) > 1 else keys[-1])
            self.disc(x, y, r * 0.36, keys[-1])

    def sword(self, x, y, ang, L, blade='s2', hi='s3', guard='y2', grip=None, bw=2.0, edge=None):
        """검: 칼끝 (x, y), 손잡이가 뒤쪽. bw = 날 폭(px). edge 가 있으면 어두운 테두리."""
        grip = grip or guard
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        gx, gy = x - ux * (L - 4), y - uy * (L - 4)
        h = bw / 2
        body = [(x, y), (gx - ux * 6 + vx * h, gy - uy * 6 + vy * h), (gx + vx * h, gy + vy * h), (gx - vx * h, gy - vy * h), (gx - ux * 6 - vx * h, gy - uy * 6 - vy * h)]
        body = [(x, y), (gx + vx * h, gy + vy * h), (gx - vx * h, gy - vy * h)]
        if edge:
            grown = [(x + ux * 1.5, y + uy * 1.5), (gx + vx * (h + 1.5), gy + vy * (h + 1.5)), (gx - vx * (h + 1.5), gy - vy * (h + 1.5))]
            self.poly(grown, edge)
        self.poly(body, blade)
        self.line([(x, y), (gx + vx * h * 0.35, gy + vy * h * 0.35)], hi)
        gw = max(3, bw * 1.2 + 2)
        self.line([(gx + vx * gw, gy + vy * gw), (gx - vx * gw, gy - vy * gw)], guard, 2)
        self.line([(gx, gy), (x - ux * L, y - uy * L)], grip, 2 if bw > 4 else 1)

    def star4(self, x, y, r, key, core=None):
        """네 갈래 별(마름모 십자)."""
        r = max(1.0, r)
        self.poly([(x, y - r), (x + r * 0.28, y - r * 0.28), (x + r, y), (x + r * 0.28, y + r * 0.28), (x, y + r), (x - r * 0.28, y + r * 0.28), (x - r, y), (x - r * 0.28, y - r * 0.28)], key)
        if core:
            self.px(x, y, core)

    def trail(self, pts, keys, w0=1, w1=4):
        """궤적: 점들을 잇고 뒤로 갈수록 가늘게. keys 어두움→밝음(밝은 층일수록 좁다)."""
        n = len(pts)
        for i in range(n - 1):
            u = i / max(1, n - 2)
            for j, k in enumerate(keys):
                th = lerp(w0, w1, u) * (len(keys) - j) / len(keys)
                self.line([pts[i], pts[i + 1]], k, max(1, round(th)))

    def skull(self, x, y, r, bone, shade, eye):
        self.disc(x, y - r * 0.15, r, bone)
        self.rect(x - r * 0.55, y + r * 0.45, x + r * 0.55, y + r * 1.05, bone)
        self.disc(x - r * 0.42, y - r * 0.05, max(1, r * 0.26), eye)
        self.disc(x + r * 0.42, y - r * 0.05, max(1, r * 0.26), eye)
        self.px(x, y + r * 0.35, shade)
        for i in (-1, 0, 1):
            self.px(x + i * r * 0.3, y + r * 0.95, shade)

    def coin(self, x, y, r, rim, face, hi, edge_on=0.0):
        """동전. edge_on 0=정면, 1=옆면(얇게)."""
        rx = max(0.6, r * (1 - edge_on * 0.85))
        self.oval(x, y, rx, r, rim)
        if rx > 1.4:
            self.oval(x, y, rx - 1, r - 1, face)
            self.px(x - rx * 0.3, y - r * 0.4, hi)

    def crown(self, x, y, w, key, gem=None, hi=None):
        h = w * 0.55
        self.poly([(x - w / 2, y), (x - w / 2, y - h), (x - w / 4, y - h * 0.4), (x, y - h), (x + w / 4, y - h * 0.4), (x + w / 2, y - h), (x + w / 2, y)], key)
        if hi:
            self.line([(x - w / 2 + 1, y - 1), (x + w / 2 - 1, y - 1)], hi)
        if gem:
            self.px(x, y - h * 0.3, gem)

    def rune_ring(self, x, y, r, key, glyph, n=8, rot=0.0, squash=1.0, w=1):
        """룬 원: 고리 + 둘레의 점/획 무늬."""
        self.ring(x, y, r, key, w, squash)
        for i in range(n):
            a = rot + i * 2 * math.pi / n
            px, py = pol(x, y, r - 2, a, squash)
            self.px(px, py, glyph)
            self.px(*pol(x, y, r - 3.5, a + 0.12, squash), glyph)

    def gear(self, x, y, r, teeth, key, hole=None, rot=0.0):
        for i in range(teeth):
            a = rot + i * 2 * math.pi / teeth
            self.poly([pol(x, y, r - 1, a - 0.16), pol(x, y, r + 2, a - 0.1), pol(x, y, r + 2, a + 0.1), pol(x, y, r - 1, a + 0.16)], key)
        self.disc(x, y, r, key)
        if hole:
            self.disc(x, y, max(1, r * 0.4), hole)

    def hexstar(self, x, y, r, key, rot=0.0):
        self.poly([pol(x, y, r, rot + i * math.pi / 3) for i in range(6)], key)

    def slash(self, p0, p1, keys, th=5, bow=0.0, frac=1.0):
        """직선/휜 베기 궤적(lib_scout.blade 를 감싼 것). bow<0 이면 반대로 휜다."""
        if abs(bow) < 0.5:
            self.lens(p0, p1, th, keys, frac)
        else:
            self.blade(p0, p1, bow, th, keys, frac)

    def shockring(self, x, y, r, k1, k2=None, squash=0.45, w=2):
        """땅에 깔리는 타원 충격파."""
        self.ring(x, y, r, k1, w, squash)
        if k2:
            self.ring(x, y, max(1, r - 2), k2, 1, squash)

    def cross(self, x, y, r, key, th=1):
        self.line([(x - r, y), (x + r, y)], key, th)
        self.line([(x, y - r), (x, y + r)], key, th)

    def fan_lines(self, x, y, n, r0, r1, a0, a1, key, w=1):
        for i in range(n):
            a = math.radians(lerp(a0, a1, i / max(1, n - 1)))
            self.line([pol(x, y, r0, a), pol(x, y, r1, a)], key, w)

    def drops(self, x, y, n, spread, fall, seed, key, hi=None, size=1):
        r = rng(seed)
        for i in range(n):
            px = x + r.uniform(-spread, spread)
            py = y + fall * r.uniform(0.2, 1.0)
            self.px(px, py, key)
            if size > 1:
                self.px(px, py + 1, key)
            if hi and i % 3 == 0:
                self.px(px, py - 1, hi)


def effect(key, size, frames, anchor, palette, edge='auto'):
    """이펙트 시트 등록 데코레이터. edge: 'auto'(screen→fade_oval, 그 밖→가장자리 얇게) | None | ('oval', band) | dict(T=,B=,L=,R=)."""
    assert anchor in ANCHORS, anchor

    def deco(fn):
        assert key not in REG, key
        REG[key] = dict(size=size, frames=frames, anchor=anchor, pal=palette, draw=fn, edge=edge, module=fn.__module__)
        return fn
    return deco


class Skills:
    """직업 모듈이 만든다: 스킬 목록 → TS."""

    def __init__(self, class_key, class_id, chip):
        self.class_key, self.class_id, self.chip = class_key, class_id, chip
        self.rows = []

    def add(self, ident, name, level, motion, desc, *keys):
        """keys: 새 시트 키(이 직업 모듈의 @effect) 또는 이미 있는 시트 키. 이미 있는 시트는 (키, anchor) 로 앵커만 바꿔 쓸 수 있다."""
        assert motion in MOTIONS, motion
        ks, anchors = [], {}
        for k in keys:
            if isinstance(k, tuple):
                k, a = k
                assert a in ANCHORS, a
                anchors[k] = a
            ks.append(k)
        self.rows.append(dict(id=f'skill_{self.class_key}_{ident}', name=name, level=level, motion=motion, desc=desc, keys=ks, anchors=anchors))
        return self

    def check(self, reuse=False):
        levels = [r['level'] for r in self.rows]
        assert levels == [1, 3, 5, 7, 10, 12, 16, 22], (self.class_key, levels)
        assert len({r['motion'] for r in self.rows}) >= 4, (self.class_key, 'motion 이 4종 미만')
        assert self.rows[-1]['motion'] == 'finisher', self.class_key
        if reuse:
            # a2 부터: 스킬 하나당 새 시트 최대 1장, 나머지는 기존 시트(EXISTING) 재사용.
            existing = existing_sheets()
            for r in self.rows:
                new = [k for k in r['keys'] if k in REG]
                assert len(new) <= 1, (r['id'], new, '스킬 하나당 새 시트는 최대 1장')
                for k in r['keys']:
                    if k in REG:
                        assert k.startswith(self.class_key + '_'), (r['id'], k, '새 키는 <classKey>_ 로 시작한다')
                        continue
                    assert k in existing, (r['id'], k, '없는 시트')
                    a = r['anchors'].get(k, existing[k]['anchor'])
                    assert (a == 'projectile') == (existing[k]['anchor'] == 'projectile'), (r['id'], k, '투사체 시트는 투사체로만')
                    assert not (a == 'projectile' and k.startswith('mon_')), (r['id'], k, '몬스터 투사체는 오른쪽을 본다 — 아군 스킬에 쓰지 않는다')
                    assert (a == 'screen') == (existing[k]['frame'] == 128 and existing[k]['anchor'] == 'screen'), (r['id'], k, 'screen 은 128 화면 시트만')
            return
        primary = set()
        for r in self.rows:
            for k in r['keys']:
                assert k.startswith(self.class_key + '_'), (r['id'], k, '키는 <classKey>_ 로 시작한다')
                assert k not in primary, (r['id'], k, '같은 키를 두 스킬이 쓴다')
                primary.add(k)


# ------------------------------------------------------------------ 계약(묶음 TS)
def batch_contract(batch):
    text = (BATCH_DIR / f'{batch}.ts').read_text(encoding='utf8')
    layers = {}
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        spec = layers.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4)), anchors=set()))
        spec['anchors'].add(m.group(2))
        if (spec['frame'], spec['frames']) != (int(m.group(3)), int(m.group(4))):
            raise SystemExit(f'{m.group(1)}: 묶음 파일 안에서 규격이 서로 다르다')
    return layers


REUSE_BATCHES = {'a2'}   # 이 묶음들은 기존 시트를 재사용한다(스킬당 새 시트 ≤1)
_EXISTING = {}


def existing_sheets():
    """이미 그려진 시트의 규격(계약 두 파일 + 앞 묶음 a1). 키 → dict(anchor, frame, frames)."""
    if _EXISTING:
        return _EXISTING
    srcs = [ROOT / 'src/assets/retroClassSkills.ts', ROOT / 'src/assets/retroMonsterSkills.ts', BATCH_DIR / 'a1.ts']
    for p in srcs:
        text = p.read_text(encoding='utf8')
        for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
            _EXISTING.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
        for m in re.finditer(r'L\("(\w+)", "(\w+)", (\d+), (\d+)\)', text):
            _EXISTING.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    for k, v in _EXISTING.items():
        png = OUT / f'{k}.png'
        assert png.exists(), (k, '시트 파일 없음')
        w, h = Image.open(png).size
        assert (w, h) == (v['frame'] * v['frames'], v['frame']), (k, (w, h), v)
    return _EXISTING


def batch_of(key):
    mod = REG[key]['module']
    for b, names in BATCHES.items():
        if any(mod.endswith(n) for n in names):
            return b
    raise KeyError(key)


def load_batch(batch):
    for name in BATCHES[batch]:
        try:
            mod = importlib.import_module(f'r2w1_{name}')
        except ModuleNotFoundError as err:
            if err.name == f'r2w1_{name}':
                print(f'--- r2w1_{name} 없음')
                continue
            raise
        CLASSES[name] = mod


# ------------------------------------------------------------------ TS 내보내기
def ts_text(batch):
    out = [f'// 묶음 {batch} — 담당 에이전트만 이 파일을 쓴다. 규격: src/assets/retroRoster.ts 머리 주석, 스킬 형식은 retroClassSkills.ts(RetroClassSkill).',
           '// 이 파일은 scripts/asset-gen/pixel-fx/lib_r2w1.py --emit ' + batch + ' 로 만든다(직업 모듈 r2w1_<classKey>.py 의 SKILLS 가 정본).',
           'import type { RetroRosterBatch } from "@/assets/retroRoster";', '',
           'export const BATCH: RetroRosterBatch = {', '  skills: [']
    rows = []
    for cname in BATCHES[batch]:
        mod = CLASSES.get(cname)
        if not mod:
            continue
        sk = mod.SKILLS
        sk.check(reuse=batch in REUSE_BATCHES)
        for r in sk.rows:
            layers = []
            for k in r['keys']:
                if k in REG:
                    e = REG[k]
                    anchor, frame, frames = r['anchors'].get(k, e['anchor']), e['size'], e['frames']
                    assert (anchor == 'projectile') == (e['anchor'] == 'projectile') and (anchor == 'screen') == (e['anchor'] == 'screen'), (r['id'], k, anchor)
                else:
                    e = existing_sheets()[k]
                    anchor, frame, frames = r['anchors'].get(k, e['anchor']), e['frame'], e['frames']
                layers.append(f'{{ key: "{k}", anchor: "{anchor}", frame: {frame}, frames: {frames} }}')
            rows.append(f'    {{ id: "{r["id"]}", classId: "{sk.class_id}", actorId: "actor_{sk.class_key}", name: "{r["name"]}", level: {r["level"]}, '
                        f'motion: "{r["motion"]}", description: "{r["desc"]}", layers: [{", ".join(layers)}] }},')
    out += rows
    out += ['  ],', '  partyPixel: []', '};', '']
    return '\n'.join(out)


# ------------------------------------------------------------------ 그리기 · 검사
def render(key):
    e = REG[key]
    _Pal.missing = set()
    frames = []
    for f in range(e['frames']):
        c = Ink2(e['size'], e['pal'])
        e['draw'](c, f)
        post(c, e)
        frames.append(c.im)
    if _Pal.missing:
        raise SystemExit(f'{key}: 팔레트에 없는 키 {sorted(_Pal.missing)} — PAL 에 추가하거나 다른 키를 쓴다')
    return frames


def post(c, e):
    edge = e['edge']
    if edge == 'auto':
        if e['anchor'] == 'screen':
            fade_oval(c, 0.35)
        elif e['anchor'] != 'projectile':
            band = 3 if e['size'] >= 128 else 2
            fade_edges(c, T=band, B=band, L=band, R=band)
    elif isinstance(edge, tuple) and edge[0] == 'oval':
        fade_oval(c, edge[1])
    elif isinstance(edge, dict):
        fade_edges(c, **edge)


def run(key, batch=None, quiet=False):
    e = REG[key]
    batch = batch or batch_of(key)
    spec = batch_contract(batch).get(key)
    got = (e['size'], e['frames'], e['anchor'])
    if not spec or (spec['frame'], spec['frames']) != got[:2] or got[2] not in spec['anchors']:
        raise SystemExit(f'{key}: 스크립트 {got} != 묶음 파일 {spec}')
    if len(e['pal']) > 15:
        raise SystemExit(f'{key}: 잉크 {len(e["pal"])}색(+투명 > 16)')
    frames = render(key)
    size, n = e['size'], e['frames']
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    OUT.mkdir(parents=True, exist_ok=True)
    rd = REVIEW / batch / 'fx'
    rd.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    if Image.open(OUT / f'{key}.png').convert('RGBA').tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    scale = 4 if size <= 64 else 2
    board(frames, scale).save(rd / f'{key}-preview.png')
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<26} {e["anchor"]:<10} {size}px x{n} colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, e


# ------------------------------------------------------------------ 확인판
def class_board(name, rows, path):
    """키 하나 = 한 줄(프레임 가로), 128px 프레임 기준으로 맞춰 1900px 안으로."""
    font = ImageFont.load_default()
    lines = []
    for line, frames, e in rows:
        size = e['size']
        sc = max(1, 96 // size) if size <= 64 else 1
        cell = size * sc
        gap = 2
        W = len(frames) * (cell + gap) + gap
        im = Image.new('RGBA', (W, cell + 14), BG)
        d = ImageDraw.Draw(im)
        d.text((3, 1), f'{e["module"][5:]} {rows_key(e)}  {e["anchor"]} {size}px x{len(frames)}', fill=(255, 255, 255, 255), font=font)
        for i, fr in enumerate(frames):
            im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (gap + i * (cell + gap), 14))
        lines.append(im)
    return lines


def rows_key(e):
    for k, v in REG.items():
        if v is e:
            return k
    return '?'


def stack(images, path, max_h=1880):
    """세로로 쌓되 1880px 를 넘으면 파일을 나눈다. 저장한 경로 목록."""
    paths, cur, h, part = [], [], 0, 1
    def flush():
        nonlocal cur, h, part
        if not cur:
            return
        W = max(i.size[0] for i in cur)
        out = Image.new('RGBA', (W, sum(i.size[1] for i in cur)), BG)
        y = 0
        for i in cur:
            out.alpha_composite(i, (0, y))
            y += i.size[1]
        assert out.size[0] <= 1900 and out.size[1] <= 1900, out.size
        p = Path(str(path).replace('.png', f'-{part}.png'))
        out.save(p)
        paths.append(p)
        cur, h, part = [], 0, part + 1
    for im in images:
        if im.size[0] > 1900:
            f = 1900 / im.size[0]
            im = im.resize((1900, max(1, int(im.size[1] * f))), Image.NEAREST)
        if h + im.size[1] > max_h:
            flush()
        cur.append(im)
        h += im.size[1]
    flush()
    return paths


def _cell(path, size=48, at=(0, 0)):
    im = Image.open(path).convert('RGBA').crop((at[0], at[1], at[0] + size, at[1] + size))
    return im.resize((size * 2, size * 2), Image.NEAREST)


def stage(cls_mod, batch):
    """가상 무대 합성판: 왼쪽 적(슬라임 3), 오른쪽 아군(직업 칩 idle). 런타임과 같은 2배·앵커 규칙."""
    actor_path = ROOT / f'public/assets/generated/charset-battlers/{cls_mod.SKILLS.chip}.png'
    atk_path = actor_path
    actor = _cell(actor_path)
    slime = _cell(ROOT / 'public/assets/generated/pixel-enemies/slime.png')
    PW, PH = 400, 264
    enemy_x = [(80, 200), (130, 232), (60, 250)]
    ally_x = [(300, 216), (350, 236), (270, 250)]
    font = ImageFont.load_default()
    rows = []
    for r in cls_mod.SKILLS.rows:
        panels = []
        for ti, tt in enumerate((0.2, 0.5, 0.85)):
            p = Image.new('RGBA', (PW, PH), BG)
            d = ImageDraw.Draw(p)
            d.line((0, 258, PW, 258), fill=(0x2c, 0x36, 0x54, 255))
            for ex, ef in enemy_x[:3]:
                p.alpha_composite(slime, (ex - 48, ef - 88))
            for ax, af in ally_x[:1]:
                p.alpha_composite(actor, (ax - 48, af - 90))
            for k in r['keys']:
                e = sheet_spec(k, r)
                fr_all = render_cache(k)
                fi = min(len(fr_all) - 1, int(tt * len(fr_all)))
                fr = fr_all[fi]
                s = e['size'] * 2
                img = fr.resize((s, s), Image.NEAREST)
                a = e['anchor']
                if a == 'target':
                    p.alpha_composite(img, (enemy_x[0][0] - s // 2, enemy_x[0][1] - (s - 16)))
                elif a == 'allTargets':
                    for ex, ef in enemy_x:
                        p.alpha_composite(img, (ex - s // 2, ef - (s - 16)))
                elif a == 'user':
                    p.alpha_composite(img, (ally_x[0][0] - s // 2, ally_x[0][1] - (s - 16)))
                elif a == 'allAllies':
                    for ax, af in ally_x:
                        p.alpha_composite(img, (ax - s // 2, af - (s - 16)))
                elif a == 'screen':
                    p.alpha_composite(img, (PW // 2 - s // 2, 140 - s // 2))
                else:
                    x0, x1 = ally_x[0][0] - 20, enemy_x[0][0] + 20
                    px = int(lerp(x0, x1, tt)) - s // 2
                    p.alpha_composite(img, (px, ally_x[0][1] - 50 - s // 2))
            d.text((4, 4), f'{r["name"]} L{r["level"]} {r["motion"]}', fill=(255, 255, 255, 255), font=font)
            panels.append(p)
        row = Image.new('RGBA', (PW * 3 + 8, PH), BG)
        for i, p in enumerate(panels):
            row.alpha_composite(p, (i * (PW + 4), 0))
        rows.append(row)
    return rows


_CACHE = {}


def render_cache(key):
    if key not in _CACHE:
        if key in REG:
            _CACHE[key] = render(key)
        else:
            e = existing_sheets()[key]
            im = Image.open(OUT / f'{key}.png').convert('RGBA')
            s = e['frame']
            _CACHE[key] = [im.crop((i * s, 0, (i + 1) * s, s)) for i in range(e['frames'])]
    return _CACHE[key]


def sheet_spec(key, row):
    """무대 합성용 규격: 새 시트는 REG, 재사용 시트는 기존 규격(+스킬의 앵커 덮어쓰기)."""
    if key in REG:
        e = REG[key]
        return dict(e, anchor=row['anchors'].get(key, e['anchor']))
    e = existing_sheets()[key]
    return dict(size=e['frame'], frames=e['frames'], anchor=row['anchors'].get(key, e['anchor']))


def main(argv):
    if argv and argv[0] == '--emit':
        batch = argv[1]
        load_batch(batch)
        (BATCH_DIR / f'{batch}.ts').write_text(ts_text(batch), encoding='utf8')
        print('wrote', BATCH_DIR / f'{batch}.ts')
        return 0
    batch = argv[0]
    picks = argv[1:]
    only_cls = [a for a in picks if a in BATCHES[batch]]
    only = [a for a in picks if a not in BATCHES[batch]]
    load_batch(batch)
    bad = 0
    for cname in BATCHES[batch]:
        mod = CLASSES.get(cname)
        if not mod or (only_cls and cname not in only_cls):
            continue
        keys = list(dict.fromkeys(k for r in mod.SKILLS.rows for k in r['keys'] if k in REG))
        # 스킬에 안 쓰인 이펙트가 있으면 알린다.
        own = [k for k, v in REG.items() if v['module'] == mod.__name__]
        for k in own:
            if k not in keys:
                print(f'??? {k}: 어떤 스킬에도 안 쓰임')
        results = []
        for k in keys:
            if only and k not in only:
                continue
            res = run(k, batch)
            bad += res[0].startswith('BAD')
            results.append(res)
        if results and not only:
            mod.SKILLS.check(reuse=batch in REUSE_BATCHES)
            imgs = class_board(cname, results, None)
            for p in stack(imgs, REVIEW / batch / f'{cname}-sheet.png'):
                print('sheet', p)
            for i, p in enumerate(stack(stage(mod, batch), REVIEW / batch / f'{cname}-stage.png', max_h=1800)):
                print('stage', p)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
