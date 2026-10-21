#!/usr/bin/env python3
"""상자·원통(바퀴)·사각뿔 밑그림: jp-inaka 탈것·망루·자전거를 실제 크기 3D 기본형으로 놓고 우리 3/4 투영으로 1배 렌더한다.

투영: 점 (x, y=북쪽, z=위) → 화면 sx = x, sy = 바닥 − 0.65·y − z  (tunnel_underdraw.py 와 같은 투영).
  - 윗면은 0.65 로 눌리고, 남향 수직면은 높이 그대로 보인다. 동·서향 면은 폭 0.
  - 시선 방향 d = (0, 1, −0.65) — 같은 화소에 겹치면 y − 0.65·z 가 작은 쪽이 앞이다.
  - 동서로 달리는 차 바퀴(x–z 평면 원판)는 온전한 원, 남북으로 달리는 차 바퀴(y–z 평면)는 세로 띠(트레드).
빛은 북서 위에서. 출력은 회색 값 지도(밝을수록 빛) + 면 경계선 + 바닥 그림자, 12px 여백, 키트 칸 경계는 빨간 점선.

  python3 box_underdraw.py keitora|tractor|watchtower|bicycle <out.png> [--scale 4]
  python3 box_underdraw.py all <out_dir>            # 넷 다 1배 + 4배
"""
import argparse, math, os
import numpy as np
from PIL import Image

PAD = 12
C = 0.65
LIGHT = np.array((-0.55, 0.45, 0.70)); LIGHT = LIGHT / np.linalg.norm(LIGHT)
VIEW = np.array((0.0, -1.0, C)); VIEW = VIEW / np.linalg.norm(VIEW)        # 보는 사람 쪽(남·위)


def v3(*a):
    return np.array(a, dtype=float)


class Scene:
    """점 뿌리기 + 깊이 버퍼. 면마다 fid(문자열)를 남겨 경계선과 재질 칠하기에 쓴다."""

    def __init__(self, kw, kh, base, ox=0.0, pad=PAD):
        self.kw, self.kh, self.pad, self.base, self.ox = kw, kh, pad, base, ox
        W, H = kw + 2 * pad, kh + 2 * pad
        self.W, self.H = W, H
        self.depth = np.full((H, W), np.inf)
        self.fid = np.full((H, W), -1, int)
        self.nrm = np.zeros((H, W, 3))
        self.uv = np.zeros((H, W, 2))
        self.shadow = np.zeros((H, W), bool)
        self.names = []

    def scr(self, p):
        return p[0] + self.ox + self.pad, self.base - C * p[1] - p[2] + self.pad

    def _id(self, name):
        if name not in self.names:
            self.names.append(name)
        return self.names.index(name)

    def _put(self, p, n, fid, u, v):
        sx, sy = self.scr(p)
        i, j = int(math.floor(sx)), int(math.floor(sy))
        if not (0 <= i < self.W and 0 <= j < self.H):
            return
        d = p[1] - C * p[2]
        if d < self.depth[j, i] - 1e-6:
            if np.dot(n, VIEW) < 0:
                n = -n
            self.depth[j, i] = d; self.fid[j, i] = fid; self.nrm[j, i] = n; self.uv[j, i] = (u, v)
        if p[2] > 0.05:                                              # 바닥 그림자(빛 반대쪽 = 남동)
            g = p - LIGHT * (p[2] / LIGHT[2])
            gx, gy = self.scr(g)
            gi, gj = int(math.floor(gx)), int(math.floor(gy))
            if 0 <= gi < self.W and 0 <= gj < self.H:
                self.shadow[gj, gi] = True

    def _steps(self, a, b):
        (x0, y0), (x1, y1) = self.scr(a), self.scr(b)
        return max(2, int(math.ceil(math.hypot(x1 - x0, y1 - y0) / 0.3)) + 1)

    def quad(self, name, p0, p1, p3, normal=None):
        """평행사변형 p0 + u(p1−p0) + v(p3−p0). 법선은 보는 쪽으로 뒤집힌다(얇은 판은 양면)."""
        fid = self._id(name)
        e1, e2 = p1 - p0, p3 - p0
        n = np.cross(e1, e2) if normal is None else normal
        n = n / (np.linalg.norm(n) or 1)
        nu, nv = self._steps(p0, p1), self._steps(p0, p3)
        for a in range(nu):
            for b in range(nv):
                u, v = a / (nu - 1), b / (nv - 1)
                self._put(p0 + e1 * u + e2 * v, n, fid, u, v)

    def tri(self, name, p0, p1, p2):
        fid = self._id(name)
        e1, e2 = p1 - p0, p2 - p0
        n = np.cross(e1, e2); n = n / (np.linalg.norm(n) or 1)
        nu, nv = self._steps(p0, p1), self._steps(p0, p2)
        for a in range(nu):
            for b in range(nv):
                u, v = a / (nu - 1), b / (nv - 1)
                if u + v <= 1.0:
                    self._put(p0 + e1 * u + e2 * v, n, fid, u, v)

    def box(self, name, o, ex, ey, ez):
        """o = 한 꼭짓점, ex/ey/ez = 세 모서리 벡터(서로 수직). 면 이름: name.top/.bot/.s/.n/.e/.w(가까운 축 기준)."""
        ctr = o + (ex + ey + ez) / 2
        faces = [(o, ex, ey), (o + ez, ex, ey), (o, ex, ez), (o + ey, ex, ez), (o, ey, ez), (o + ex, ey, ez)]
        for (p0, a, b) in faces:
            n = np.cross(a, b); n = n / np.linalg.norm(n)
            fc = p0 + (a + b) / 2
            if np.dot(n, fc - ctr) < 0:
                n = -n
            tag = max((('top', n[2]), ('bot', -n[2]), ('s', -n[1]), ('n', n[1]), ('e', n[0]), ('w', -n[0])), key=lambda t: t[1])[0]
            self.quad(f'{name}.{tag}', p0, p0 + a, p0 + b, normal=n)

    def cyl(self, name, c0, axis, r, length, caps=True):
        """원통: 중심 c0 에서 axis(단위) 방향으로 length, 반지름 r. 옆면 name.side, 마개 name.cap."""
        a = axis / np.linalg.norm(axis)
        t1 = np.cross(a, v3(0, 0, 1))
        if np.linalg.norm(t1) < 1e-6:
            t1 = np.cross(a, v3(1, 0, 0))
        t1 /= np.linalg.norm(t1); t2 = np.cross(a, t1)
        fs, fc = self._id(name + '.side'), self._id(name + '.cap')
        na = max(24, int(2 * math.pi * r / 0.3)); nl = max(2, int(length / 0.3) + 1)
        for k in range(na):
            th = 2 * math.pi * k / na
            rad = t1 * math.cos(th) + t2 * math.sin(th)
            for m in range(nl):
                self._put(c0 + a * (length * m / (nl - 1)) + rad * r, rad, fs, k / na, m / (nl - 1))
        if caps:
            nr = max(2, int(r / 0.3) + 1)
            for end in (0.0, length):
                for k in range(na):
                    th = 2 * math.pi * k / na
                    rad = t1 * math.cos(th) + t2 * math.sin(th)
                    for m in range(nr):
                        self._put(c0 + a * end + rad * (r * m / (nr - 1)), a if end else -a, fc, k / na, m / (nr - 1))

    def torus(self, name, c0, axis, R, r):
        """고리(자전거 타이어): 중심 c0, 고리 면의 법선 axis, 큰 반지름 R, 관 반지름 r."""
        a = axis / np.linalg.norm(axis)
        t1 = np.cross(a, v3(0, 0, 1))
        if np.linalg.norm(t1) < 1e-6:
            t1 = np.cross(a, v3(1, 0, 0))
        t1 /= np.linalg.norm(t1); t2 = np.cross(a, t1)
        fid = self._id(name)
        na, nb = max(48, int(2 * math.pi * R / 0.25)), max(12, int(2 * math.pi * r / 0.25))
        for k in range(na):
            th = 2 * math.pi * k / na
            rad = t1 * math.cos(th) + t2 * math.sin(th)
            for m in range(nb):
                ph = 2 * math.pi * m / nb
                n = rad * math.cos(ph) + a * math.sin(ph)
                self._put(c0 + rad * R + n * r, n, fid, k / na, m / nb)

    def rod(self, name, p0, p1, r=0.6):
        d = p1 - p0
        self.cyl(name, p0, d, r, float(np.linalg.norm(d)), caps=False)

    def pyramid(self, name, corners, apex):
        for k in range(4):
            a, b = corners[k], corners[(k + 1) % 4]
            self.tri(f'{name}.{k}', a, b, apex)

    # ── 렌더 ──
    def grey(self, ground=(150, 140, 120), shade=(95, 88, 76)):
        im = np.zeros((self.H, self.W, 3), np.uint8)
        im[:] = ground
        im[self.shadow] = shade
        on = self.fid >= 0
        lam = np.clip((self.nrm * LIGHT).sum(-1), 0, 1)
        q = (40 + 200 * (0.18 + 0.82 * lam)).astype(int)
        for j in range(self.H):
            for i in range(self.W):
                if not on[j, i]:
                    continue
                g = q[j, i]
                for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    jj, ii = j + dj, i + di
                    if not (0 <= jj < self.H and 0 <= ii < self.W) or self.fid[jj, ii] < 0:
                        g = int(g * 0.55); break                         # 바깥 윤곽
                    if self.fid[jj, ii] != self.fid[j, i] and self.depth[jj, ii] > self.depth[j, i] + 0.4:
                        g = int(g * 0.72); break                         # 앞 면이 뒤 면을 가리는 경계
                im[j, i] = (g, g, min(255, g + 6))
        for i in range(0, self.kw, 2):
            im[self.pad, self.pad + i] = (220, 40, 40); im[self.pad + self.kh - 1, self.pad + i] = (220, 40, 40)
        for j in range(0, self.kh, 2):
            im[self.pad + j, self.pad] = (220, 40, 40); im[self.pad + j, self.pad + self.kw - 1] = (220, 40, 40)
        return Image.fromarray(im)


# ═══════════════ 차체 좌표: s 뒤→앞, w 왼쪽(+), z 위. heading θ = 동쪽에서 남쪽으로 돈 각 ═══════════════
def frame(ox, oy, theta_deg):
    t = math.radians(theta_deg)
    h = v3(math.cos(t), -math.sin(t), 0)          # 앞
    l = v3(math.sin(t), math.cos(t), 0)           # 왼쪽(앞을 보고)
    z = v3(0, 0, 1)
    o = v3(ox, oy, 0)

    def P(s, w, zz):
        return o + h * s + l * w + z * zz

    return P, h, l, z


KEITORA_HEADING = 26.0       # 동쪽에서 26° 남쪽으로(앞이 동남동)
BICYCLE_HEADING = 30.0       # 동쪽에서 30° 남쪽으로(뒤 서북서 → 앞 동남동)
TRACTOR_HEADING = 0.0        # 정동


def keitora(S):
    P0, h, l, z = frame(5.5, 27.0, KEITORA_HEADING)
    h = h * 1.13                                   # 길이 방향 늘림(칸을 채운다)
    P = lambda s, w, zz: P0(s * 1.13, w, zz)
    WH = 10.0                                       # 차폭 반(19px ≈ 1.48 m)
    # 바퀴(먼 쪽 먼저 — 깊이 버퍼라 순서는 상관없다)
    for s in (8.0, 38.0):
        for w in (WH - 0.5, -WH + 0.5 - 3.0):
            S.cyl(f'wheel{int(s)}{"n" if w > 0 else "s"}', P(s, w, 4.5), l, 4.5, 3.0)
    S.box('chassis', P(2, -WH + 1.5, 3.5), h * 44, l * (2 * WH - 3), z * 4.5)
    # 짐칸: 바닥 z9, 판 z9~15, 두께 1
    S.box('bed.floor', P(0, -WH, 7.5), h * 29, l * 2 * WH, z * 1.5)
    S.box('bed.wallN', P(0, WH - 1, 9), h * 29, l * 1, z * 6)
    S.box('bed.wallS', P(0, -WH, 9), h * 29, l * 1, z * 6)
    S.box('bed.gate', P(0, -WH, 9), h * 1, l * 2 * WH, z * 6)
    S.box('bed.front', P(28, -WH, 9), h * 1, l * 2 * WH, z * 8)
    # 가드 프레임(캡 뒤 기둥 두 개 + 윗대)
    for w in (WH - 1, -WH + 1):
        S.rod('guard', P(29, w, 15), P(29, w, 21), 0.6)
    S.rod('guard', P(29, WH - 1, 21), P(29, -WH + 1, 21), 0.6)
    # 캡: 아래 상자(z7~15) + 위 상자(z15~23, 뒤 s30~41) + 기운 앞유리 쐐기(s41→45)
    S.box('cab.low', P(30, -WH, 5), h * 16, l * 2 * WH, z * 10)
    S.box('cab.up', P(30.5, -WH + 0.5, 15), h * 11.5, l * (2 * WH - 1), z * 8)
    a0, a1 = P(42, -WH + 0.5, 23), P(42, WH - 0.5, 23)
    b0, b1 = P(46, -WH + 0.5, 15), P(46, WH - 0.5, 15)
    S.quad('cab.glass', a0, a1, b0)
    S.tri('cab.sideS', P(42, -WH + 0.5, 15), a0, b0)
    S.tri('cab.sideN', P(42, WH - 0.5, 15), a1, b1)
    S.box('bumper', P(45.5, -WH, 4), h * 1.5, l * 2 * WH, z * 3)


def tractor(S):
    P, h, l, z = frame(5.0, 17.0, TRACTOR_HEADING)
    for (s, w, r, wd) in ((14, 9.5, 10, 6), (14, -15.5, 10, 6), (47, 8, 5.5, 4), (47, -12, 5.5, 4)):
        S.cyl(f'wheel{s}{"n" if w > 0 else "s"}', P(s, w, r), l, r, wd)
    S.box('rotary', P(-6, -11, 3), h * 8, l * 22, z * 8)
    S.box('floor', P(4, -8, 10), h * 22, l * 16, z * 3)
    S.box('seat', P(9, -4, 13), h * 8, l * 8, z * 5)
    S.box('seatback', P(7, -4, 13), h * 2, l * 8, z * 11)
    S.box('hood', P(26, -6, 8), h * 32, l * 12, z * 11)
    S.rod('stack', P(48, 0, 19), P(48, 0, 30), 1.3)
    for (s, w) in ((6, 9.5), (6, -9.5), (26, 9.5), (26, -9.5)):
        S.rod('post', P(s, w, 13), P(s, w, 37), 0.8)
    S.box('canopy', P(4, -11.5, 37), h * 24, l * 23, z * 1.5)
    S.rod('wheelrim', P(28, 3, 24), P(28, -3, 24), 0.7)            # 핸들 대


def watchtower(S):
    cx, cy = 16.0, 13.0
    G, T, DZ = 13.0, 7.0, 30.0                                      # 바닥 다리 반폭, 위 반폭, 전망대 높이
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for (sx_, sy_) in corners:
        S.rod('leg', v3(cx + sx_ * G, cy + sy_ * G, 0), v3(cx + sx_ * T, cy + sy_ * T, DZ), 1.0)
        S.box('foot', v3(cx + sx_ * G - 2, cy + sy_ * G - 2, 0), v3(4, 0, 0), v3(0, 4, 0), v3(0, 0, 1.5))
    # 네 면 가로 띠 + X 가새(다리 사이 같은 높이)
    def at(sx_, sy_, zz):
        k = zz / DZ
        g = G + (T - G) * k
        return v3(cx + sx_ * g, cy + sy_ * g, zz)
    for k in range(4):
        a, b = corners[k], corners[(k + 1) % 4]
        for (za, zb) in ((2, 15), (15, 29)):
            S.rod('brace', at(*a, za), at(*b, zb), 0.45); S.rod('brace', at(*b, za), at(*a, zb), 0.45)
            S.rod('ring', at(*a, zb), at(*b, zb), 0.5)
    for w in (-2.5, 2.5):                                           # 사다리(남쪽 면)
        S.rod('ladder', v3(cx + w, cy - G + 1.5, 0), v3(cx + w, cy - T - 0.5, DZ), 0.45)
    D = 9.0
    S.box('deck', v3(cx - D, cy - D, DZ), v3(2 * D, 0, 0), v3(0, 2 * D, 0), v3(0, 0, 2))
    for (p0, e) in ((v3(cx - D, cy - D, DZ + 2), v3(2 * D, 0, 0)), (v3(cx - D, cy + D - 0.6, DZ + 2), v3(2 * D, 0, 0))):
        S.box('rail', p0 + v3(0, 0, 3.5), e, v3(0, 0.6, 0), v3(0, 0, 0.8))
    for (p0, e) in ((v3(cx - D, cy - D, DZ + 2), v3(0, 2 * D, 0)), (v3(cx + D - 0.6, cy - D, DZ + 2), v3(0, 2 * D, 0))):
        S.box('rail', p0 + v3(0, 0, 3.5), v3(0.6, 0, 0), e, v3(0, 0, 0.8))
    for (sx_, sy_) in corners:
        S.rod('post', v3(cx + sx_ * (D - 1), cy + sy_ * (D - 1), DZ + 2), v3(cx + sx_ * (D - 1), cy + sy_ * (D - 1), 42), 0.55)
    S.cyl('bell', v3(cx, cy, 36.5), v3(0, 0, 1), 1.8, 3.0)
    E = 11.0
    rc = [v3(cx + a * E, cy + b * E, 42) for (a, b) in corners]
    S.pyramid('roof', rc, v3(cx, cy, 51))


def bicycle(S):
    P0, h, l, z = frame(4.0, 10.5, BICYCLE_HEADING)
    K = 1.1                                        # 2×2 칸을 채우는 배율
    P = lambda s, w, zz: P0(s * K, w * K, zz * K)
    R = 5.5 * K
    for s in (4.5, 21.5):
        S.torus(f'tire{int(s)}', P(s, 0, 5.5), l, R - 0.8, 0.8)
        S.cyl(f'hub{int(s)}', P(s, -0.8, 5.5), l, 0.9, 1.6)
    pts = {'rh': (4.5, 5.5), 'seat': (10, 14.5), 'bb': (12, 3.5), 'head': (19, 15.5), 'fh': (21.5, 5.5)}
    for (a, b) in (('rh', 'seat'), ('rh', 'bb'), ('bb', 'seat'), ('bb', 'head'), ('head', 'fh')):
        S.rod('frame', P(pts[a][0], 0, pts[a][1]), P(pts[b][0], 0, pts[b][1]), 0.6)
    S.box('rack', P(1, -2.2, 12.5), h * 7.5 * K, l * 4.4 * K, z * 0.8 * K)
    S.box('saddle', P(8.5, -1.4, 14.8), h * 3.6 * K, l * 2.8 * K, z * 1.4 * K)
    S.rod('stem', P(19, 0, 15.5), P(19, 0, 18), 0.6)
    S.rod('bar', P(18.2, -4.2, 18), P(18.2, 4.2, 18), 0.55)
    S.box('basket', P(19.8, -2.6, 13), h * 5 * K, l * 5.2 * K, z * 4 * K)
    S.rod('stand', P(6, 0, 4), P(7.5, -2.5, 0), 0.45)


def low_roof_house(kw, kh, roof_share=0.25, hip=True, over=3.0):
    """낮은 지붕 집(R8, 사용자 결정 지붕 ≈ 건물 높이의 25%): 벽 상자 + 낮은 우진각(hip) 또는 박공 지붕.
    지붕 화면 높이 = 0.65·깊이 + 오름. 오름이 0.65·깊이/2 보다 작으면 위에서 앞·뒤 두 비탈이 다 보인다(낮은 지붕을 위에서 본 모습)."""
    def fn(S):
        H = kh - 4                                   # 건물 화면 높이(그림자 여백 제외)
        roof = roof_share * H
        rise = roof * 0.25                           # 지붕 오름(낮은 물매)
        D = (roof - rise) / C                        # 깊이: 0.65·D + rise = roof
        Hw = H - roof                                # 앞벽 높이(화면 = 실제)
        x0, x1 = 2.0 + over, kw - 2.0 - over
        S.box('wall', v3(x0, 0, 0), v3(x1 - x0, 0, 0), v3(0, D, 0), v3(0, 0, Hw))
        e0, e1, y0, y1 = x0 - over, x1 + over, -over * 0.6, D + over * 0.6
        ym, zr = (y0 + y1) / 2, Hw + rise
        r0, r1 = (e0 + (ym - y0), e1 - (ym - y0)) if hip else (e0, e1)
        A, B, Cc, Dd = v3(e0, y0, Hw), v3(e1, y0, Hw), v3(e1, y1, Hw), v3(e0, y1, Hw)
        R0, R1 = v3(r0, ym, zr), v3(r1, ym, zr)
        S.tri('roof.s', A, B, R1); S.tri('roof.s', A, R1, R0)      # 앞 비탈
        S.tri('roof.n', Dd, Cc, R1); S.tri('roof.n', Dd, R1, R0)   # 뒤 비탈(낮은 지붕이라 보인다)
        if hip:
            S.tri('roof.w', A, Dd, R0); S.tri('roof.e', B, Cc, R1)
        S.box('eave', v3(e0, y0 - 0.6, Hw - 1.2), v3(e1 - e0, 0, 0), v3(0, 0.6, 0), v3(0, 0, 1.2))
    return fn


HOUSES = {'kominka': (96, 96, True), 'kawara-farmhouse': (96, 80, True), 'kura': (64, 80, False), 'dagashiya': (80, 96, False),
          'wooden-station': (112, 96, True), 'bus-stop-shelter': (48, 64, False), 'waterwheel-mill': (64, 64, True), 'agri-tin-shed': (64, 80, False)}


MODELS = {'keitora': (keitora, 64, 48, 45), 'tractor': (tractor, 64, 64, 61), 'watchtower': (watchtower, 32, 64, 62),
          'bicycle': (bicycle, 32, 32, 30)}
for _k, (_w, _h, _hip) in HOUSES.items():
    MODELS['house-' + _k] = (low_roof_house(_w, _h, hip=_hip), _w, _h, _h - 3)


def render(kind):
    fn, kw, kh, base = MODELS[kind]
    S = Scene(kw, kh, base)
    fn(S)
    return S


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=list(MODELS) + ['all'])
    ap.add_argument('out')
    ap.add_argument('--scale', type=int, default=1)
    a = ap.parse_args()
    kinds = list(MODELS) if a.kind == 'all' else [a.kind]
    for k in kinds:
        im = render(k).grey()
        if a.scale > 1:
            im = im.resize((im.width * a.scale, im.height * a.scale), Image.NEAREST)
        out = os.path.join(a.out, f'{k}.png') if a.kind == 'all' else a.out
        if a.kind == 'all':
            os.makedirs(a.out, exist_ok=True)
        im.save(out); print(out, im.size)
