#!/usr/bin/env python3
"""트레이싱 C 조 — 손 도트 캔버스 라이브러리. (램프, 단) 두 배열에 좌표를 정해 찍는다. 밑그림 화소는 읽지 않는다.
단은 램프 인덱스(7단: 0=가장 어둠·3=기본, 5단: 0..4·2=기본). 그라디언트·노이즈 함수 없음."""
import os, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
PAL = os.path.join(ROOT, 'tiledata/atlas-pick/palette/modern3.pal')
RAMPS = {}; ORDER = []
for ln in open(PAL, encoding='utf-8'):
    m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
    if m:
        RAMPS[m.group(1)] = [tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))]
        ORDER.append(m.group(1))
RID = {n: i for i, n in enumerate(ORDER)}


def cl(r, t):
    return max(0, min(len(RAMPS[r]) - 1, t))


class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.rp = np.full((h, w), -1, dtype=np.int16)
        self.tn = np.zeros((h, w), dtype=np.int16)

    def px(self, x, y, r, t):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.rp[y, x] = RID[r]; self.tn[y, x] = cl(r, t)

    def fill(self, x, y, w, h, r, t):
        x0, y0, x1, y1 = max(0, x), max(0, y), min(self.w, x + w), min(self.h, y + h)
        if x1 > x0 and y1 > y0:
            self.rp[y0:y1, x0:x1] = RID[r]; self.tn[y0:y1, x0:x1] = cl(r, t)

    def shade(self, x, y, w, h, dt):
        x0, y0, x1, y1 = max(0, x), max(0, y), min(self.w, x + w), min(self.h, y + h)
        if x1 <= x0 or y1 <= y0: return
        sub = self.rp[y0:y1, x0:x1]; tn = self.tn[y0:y1, x0:x1]
        for name, rid in RID.items():
            m = sub == rid
            if m.any():
                tn[m] = np.clip(tn[m] + dt, 0, len(RAMPS[name]) - 1)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h and self.rp[y, x] >= 0:
            return ORDER[self.rp[y, x]], int(self.tn[y, x])
        return None

    def pat(self, x, y, rows, leg):
        """글자 격자 그대로 찍는다. leg: 글자 → (램프, 단). 범례에 없는 글자(.)는 건드리지 않는다."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in leg and leg[ch] is not None:
                    r, t = leg[ch]; self.px(x + i, y + j, r, t)

    def ellipse(self, cx, cy, rx, ry, r, t):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1.0:
                    self.px(x, y, r, t)

    def hline(self, x, y, n, r, t): self.fill(x, y, n, 1, r, t)
    def vline(self, x, y, n, r, t): self.fill(x, y, 1, n, r, t)

    def box(self, x, y, w, h, r='sumi', t=1):
        self.fill(x, y, w, 1, r, t); self.fill(x, y + h - 1, w, 1, r, t)
        self.fill(x, y, 1, h, r, t); self.fill(x + w - 1, y, 1, h, r, t)

    def outline(self, t=1, keep=None):
        """몸(칠해진 화소)의 바깥 1칸에 먹선. 캔버스 안쪽으로만."""
        body = self.rp >= 0
        n = np.zeros_like(body)
        n[1:, :] |= body[:-1, :]; n[:-1, :] |= body[1:, :]; n[:, 1:] |= body[:, :-1]; n[:, :-1] |= body[:, 1:]
        o = n & ~body
        self.rp[o] = RID['sumi']; self.tn[o] = t

    def rgba(self):
        img = np.zeros((self.h, self.w, 4), dtype=np.uint8)
        for name, rid in RID.items():
            m = self.rp == rid
            if m.any():
                arr = np.array(RAMPS[name], dtype=np.uint8)
                img[m, :3] = arr[self.tn[m]]; img[m, 3] = 255
        return img

    def save_png(self, path):
        Image.fromarray(self.rgba(), 'RGBA').save(path)

    def emit_pxg(self, path):
        letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        used = sorted(set(int(v) for v in np.unique(self.rp) if v >= 0))
        let = {rid: letters[i] for i, rid in enumerate(used)}
        T = '0123456789abcde'
        out = ['@size %d %d' % (self.w, self.h), '@cell 32', '@palette palette.pal', '@layer main']
        for rid in used: out.append('@mat %s %s 0' % (let[rid], ORDER[rid]))
        out.append('@mblock 0 0')
        for y in range(self.h): out.append(''.join('.' if self.rp[y, x] < 0 else let[int(self.rp[y, x])] for x in range(self.w)))
        out.append('@tblock 0 0')
        for y in range(self.h): out.append(''.join('.' if self.rp[y, x] < 0 else T[int(self.tn[y, x])] for x in range(self.w)))
        open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')

    def blit(self, other, x, y):
        """다른 캔버스를 (x,y)에 얹는다(비어 있는 칸은 건너뜀). 장면 조립 전용."""
        for j in range(other.h):
            for i in range(other.w):
                if other.rp[j, i] >= 0:
                    X, Y = x + i, y + j
                    if 0 <= X < self.w and 0 <= Y < self.h:
                        self.rp[Y, X] = other.rp[j, i]; self.tn[Y, X] = other.tn[j, i]
