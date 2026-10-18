"""retro2003 적 전투 시트를 관절 좌표로 직접 그리는 공용 도구.

시트 계약(src/assets/pixelEnemySheets.ts 머리말): 셀 S 정사각 3열x3행, 1:1 도트, 알파 0/255,
오른쪽(아군 쪽)을 본다, 바닥 기준선 y=S-4. 칸 순서 idle_a idle_b idle_c / windup move attack / skill hit dead.
(0,2) 칸 이름은 계약상 recover 지만, 시트 목록에서 skillCell 을 켠 종은 그 칸을 스킬 방출 자세로 그린다.

그림 방식: 부위 마스크를 다각형으로 래스터화한 뒤 부위별 1px 외곽선 + 세로 단면 명암(위 빛·아래 그늘).
비트맵 확대·추적·생성 이미지는 쓰지 않는다. 각 종 스크립트는 draw(pose) -> RGBA 만 정의하고 run() 을 부른다.
"""
from __future__ import annotations

import hashlib
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
POSES = ["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit", "dead"]
# 지금 그리는 시트의 칸 크기. build() 가 정하므로 96 칸 종도 blank·limb·chain 에 S 를 넘기지 않아도 된다.
CELL = 64


# ── 기하 ─────────────────────────────────────────────────────

def rnd(p):
    return (int(round(p[0])), int(round(p[1])))


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def polar(p, ang_deg, length):
    a = math.radians(ang_deg)
    return (p[0] + math.cos(a) * length, p[1] + math.sin(a) * length)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def blank(S=None):
    return Image.new("L", (S or CELL, S or CELL), 0)


def poly(m, pts):
    ImageDraw.Draw(m).polygon([rnd(p) for p in pts], fill=255)
    return m


def ellipse(m, c, rx, ry):
    ImageDraw.Draw(m).ellipse([c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry], fill=255)
    return m


def tapered(a, b, wa, wb, bulge=0.0, mid=0.5):
    """a→b 사이를 폭 wa→wb 로 잇는 다각형(중간 mid 지점에서 bulge 만큼 부풀림)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    left, right = [], []
    for i in range(9):
        t = i / 8
        w = (wa + (wb - wa) * t) / 2 + bulge * max(0.0, 1 - abs(t - mid) / max(mid, 1 - mid))
        c = lerp(a, b, t)
        left.append((c[0] + nx * w, c[1] + ny * w))
        right.append((c[0] - nx * w, c[1] - ny * w))
    return left + right[::-1]


def limb(a, b, w, S=None):
    m = blank(S)
    d = ImageDraw.Draw(m)
    d.line([rnd(a), rnd(b)], fill=255, width=w)
    if w >= 3:
        r = w / 2 - 0.5
        for p in (a, b):
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
    return m


def chain(pts, widths, S=None):
    """여러 마디를 폭을 바꿔 가며 잇는 하나의 마스크(꼬리·뱀 몸·촉수)."""
    m = blank(S)
    for i in range(len(pts) - 1):
        m = Image.fromarray(np.maximum(np.array(m), np.array(poly(blank(S), tapered(pts[i], pts[i + 1], widths[i], widths[i + 1])))))
        r = widths[i + 1] / 2
        if r >= 1:
            ellipse(m, pts[i + 1], r - 0.5, r - 0.5)
    return m


def bezier(a, c, b, n=12):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]))
    return out


def ik(hip, foot, l1, l2, up=True):
    """두 마디 다리: 무릎을 위(up)·아래로 꺾은 관절점."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = min(math.hypot(dx, dy), l1 + l2 - 0.01)
    a = math.atan2(dy, dx)
    cos_k = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * max(d, 0.01))
    k = math.acos(max(-1, min(1, cos_k)))
    cand = [polar(hip, math.degrees(a + k), l1), polar(hip, math.degrees(a - k), l1)]
    cand.sort(key=lambda p: p[1])
    return cand[0] if up else cand[1]


def ik_side(hip, foot, l1, l2, forward=True):
    """두 마디 다리: 무릎을 앞(+x, forward)·뒤로 꺾은 관절점(짐승·사람 다리)."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = min(math.hypot(dx, dy), l1 + l2 - 0.01)
    a = math.atan2(dy, dx)
    cos_k = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * max(d, 0.01))
    k = math.acos(max(-1, min(1, cos_k)))
    cand = [polar(hip, math.degrees(a + k), l1), polar(hip, math.degrees(a - k), l1)]
    cand.sort(key=lambda p: p[0])
    return cand[1] if forward else cand[0]


# ── 캔버스 ───────────────────────────────────────────────────

class Canvas:
    def __init__(self, S=64, ink=(20, 20, 28)):
        self.S = S
        self.ink = ink
        self.rgb = np.zeros((S, S, 3), np.uint8)
        self.a = np.zeros((S, S), bool)

    def blank(self):
        return blank(self.S)

    def mask(self, m):
        return np.array(m) > 0 if isinstance(m, Image.Image) else m

    def put(self, mask, color):
        mask = self.mask(mask)
        self.rgb[mask] = color
        self.a[mask] = True

    def pixel(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.S and 0 <= y < self.S:
            self.rgb[y, x] = color
            self.a[y, x] = True

    def line(self, pts, color, width=1):
        m = self.blank()
        ImageDraw.Draw(m).line([rnd(p) for p in pts], fill=255, width=width)
        self.put(np.array(m) > 0, color)

    def line4(self, pts, color):
        """1px 선이지만 대각 이음을 한 칸 메워 4방향으로 이어지게(떨어진 조각으로 세지 않게)."""
        im = self.blank()
        ImageDraw.Draw(im).line([rnd(p) for p in pts], fill=255, width=1)
        m = np.array(im) > 0
        a, b = m[:-1, :-1] & m[1:, 1:], m[:-1, 1:] & m[1:, :-1]
        fill = np.zeros_like(m)
        fill[:-1, 1:] |= a & ~m[:-1, 1:] & ~m[1:, :-1]
        fill[:-1, :-1] |= b & ~m[:-1, :-1] & ~m[1:, 1:]
        self.put(m | fill, color)

    def part(self, m, ramp, ink=None, gloss=True, belly=None):
        """외곽선 링 → 세로 단면 명암. ramp = (그늘, 중간, 빛, 하이라이트)."""
        S = self.S
        M = self.mask(m)
        if not M.any():
            return M
        ring = M.copy()
        ring[1:] |= M[:-1]
        ring[:-1] |= M[1:]
        ring[:, 1:] |= M[:, :-1]
        ring[:, :-1] |= M[:, 1:]
        self.put(ring & ~M, ink or self.ink)
        for x in range(S):
            col = M[:, x]
            y = 0
            while y < S:
                if not col[y]:
                    y += 1
                    continue
                y0 = y
                while y < S and col[y]:
                    y += 1
                n = y - y0
                for i in range(n):
                    if n <= 2:
                        c = ramp[2] if i == 0 else ramp[1]
                    elif i == 0:
                        c = ramp[3] if gloss and n >= 4 and (x % 3) else ramp[2]
                    elif i >= math.ceil(n * 0.62):
                        c = belly if belly and i == n - 1 and n >= 5 else ramp[0]
                    else:
                        c = ramp[1]
                    self.rgb[y0 + i, x] = c
                    self.a[y0 + i, x] = True
        return M

    def shade_side(self, M, color, side=-1, depth=2):
        """마스크의 뒤쪽(side=-1 왼쪽) 가장자리 depth 칸을 그늘색으로(둥근 입체감)."""
        M = self.mask(M)
        sh = np.zeros_like(M)
        cur = M.copy()
        for _ in range(depth):
            edge = cur.copy()
            if side < 0:
                edge[:, 1:] &= ~cur[:, :-1]
            else:
                edge[:, :-1] &= ~cur[:, 1:]
            sh |= edge
            cur &= ~edge
        self.rgb[sh] = color
        return sh

    def image(self):
        out = np.zeros((self.S, self.S, 4), np.uint8)
        out[..., :3] = self.rgb
        out[..., 3] = np.where(self.a, 255, 0)
        return Image.fromarray(out, "RGBA")


# ── 효과(외곽선 없는 빛·바람·불) ─────────────────────────────

def glow(cv, c, r, colors):
    """동심원 빛무리: colors 바깥→안쪽."""
    n = len(colors)
    for i, col in enumerate(colors):
        rr = r * (1 - i / n)
        cv.put(ellipse(cv.blank(), c, rr, rr), col)


def ring(cv, c, r, a0, a1, color, width=1):
    """c 중심 반지름 r 의 호(음파·충격파)."""
    pts = [polar(c, a0 + (a1 - a0) * i / 16, r) for i in range(17)]
    cv.line(pts, color, width)


def slash(cv, a, b, bow, thick, color, core):
    """a→b 를 bow 만큼 휜 칼바람(가운데가 두껍고 양끝이 뾰족)."""
    mid = lerp(a, b, 0.5)
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    ctrl = (mid[0] - dy / n * bow, mid[1] + dx / n * bow)

    def q(t):
        u = 1 - t
        return (u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1])
    left, right, cpts = [], [], []
    for i in range(17):
        t = i / 16
        p, p2 = q(t), q(min(1, t + 0.01))
        tx, ty = p2[0] - p[0], p2[1] - p[1]
        m = math.hypot(tx, ty) or 1
        w = thick * math.sin(math.pi * t) / 2 + 0.2
        left.append((p[0] - ty / m * w, p[1] + tx / m * w))
        right.append((p[0] + ty / m * w, p[1] - tx / m * w))
        if 0.2 <= t <= 0.8:
            cpts.append(p)
    cv.put(np.array(poly(cv.blank(), left + right[::-1])) > 0, color)
    cv.line(cpts, core)


def arc_trail(cv, center, r0, a0, a1, thick, color, core):
    """무기가 지나간 초승달 궤적."""
    outer, inner = [], []
    for i in range(17):
        t = i / 16
        a = a0 + (a1 - a0) * t
        w = thick * math.sin(math.pi * t) + 0.3
        outer.append(polar(center, a, r0 + w / 2))
        inner.append(polar(center, a, r0 - w / 2))
    cv.put(np.array(poly(cv.blank(), outer + inner[::-1])) > 0, color)
    cv.line([polar(center, a0 + (a1 - a0) * (0.2 + 0.6 * i / 10), r0) for i in range(11)], core)


def sparkle(cv, p, core, ray, big=False):
    x, y = rnd(p)
    cv.pixel(x, y, core)
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        cv.pixel(x + d[0], y + d[1], ray)
    if big:
        for d in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            cv.pixel(x + d[0], y + d[1], ray)


def burst(cv, c, r, color, core, spikes=8, rot=0.0):
    """충격 별(가시 spikes 개)."""
    pts = []
    for i in range(spikes * 2):
        a = rot + i * 180 / spikes
        pts.append(polar(c, a, r if i % 2 == 0 else r * 0.45))
    cv.put(poly(cv.blank(), pts), color)
    inner = [polar(c, rot + i * 180 / spikes, (r if i % 2 == 0 else r * 0.45) * 0.5) for i in range(spikes * 2)]
    cv.put(poly(cv.blank(), inner), core)


def flame(cv, base, h, w, colors, lean=0.0, tongues=3, seed=0):
    """위로 솟는 불꽃(colors 바깥→안쪽). base 는 불꽃 아랫단 가운데."""
    for k, col in enumerate(colors):
        s = 1 - k * 0.28
        pts = [(base[0] - w * s / 2, base[1])]
        for i in range(tongues):
            t0 = (i + 0.5) / tongues
            x = base[0] - w * s / 2 + w * s * t0
            hh = h * s * (0.65 + 0.35 * math.sin((i + seed) * 2.1 + 1.3) ** 2)
            if i == tongues // 2:
                hh = h * s
            pts.append((x - w * s / tongues * 0.35, base[1] - hh * 0.45))
            pts.append((x + lean * hh / h * 4, base[1] - hh))
            pts.append((x + w * s / tongues * 0.35, base[1] - hh * 0.45))
        pts.append((base[0] + w * s / 2, base[1]))
        pts.append((base[0], base[1] + 2 * s))
        cv.put(poly(cv.blank(), pts), col)


def speed_lines(cv, x0, x1, ys, color):
    for y in ys:
        cv.line([(x0, y), (x1, y)], color)


def puff(cv, c, r, colors):
    """먼지·연기 뭉치(외곽 colors[0], 속 colors[1])."""
    for dx, dy, k in ((-r * 0.6, 0.2 * r, 0.75), (r * 0.5, 0.25 * r, 0.7), (0, -0.25 * r, 0.85)):
        cv.put(ellipse(cv.blank(), (c[0] + dx, c[1] + dy), r * k, r * k * 0.8), colors[0])
    for dx, dy, k in ((-r * 0.4, 0.1 * r, 0.45), (r * 0.3, 0.15 * r, 0.4), (0, -0.2 * r, 0.5)):
        cv.put(ellipse(cv.blank(), (c[0] + dx - 0.6, c[1] + dy - 0.6), r * k, r * k * 0.8), colors[1])


def crack(cv, start, pts, color):
    cv.line([start] + pts, color)


# ── 시트 출력·검사 ───────────────────────────────────────────

def clamp(im, S):
    """여백 1px·바닥선 y=S-4 를 넘는 픽셀은 깎아낸다(안전장치)."""
    a = np.array(im)
    a[S - 3:, :, 3] = 0
    a[0, :, 3] = 0
    a[:, 0, 3] = 0
    a[:, -1, 3] = 0
    a[..., 3] = np.where(a[..., 3] > 0, 255, 0)
    return Image.fromarray(a, "RGBA")


def islands(im):
    """연결 성분(4방향)을 크기순으로."""
    A = np.array(im)[..., 3] > 0
    seen = np.zeros_like(A)
    comps = []
    H, W = A.shape
    for y in range(H):
        for x in range(W):
            if A[y, x] and not seen[y, x]:
                st = [(y, x)]
                seen[y, x] = True
                n = 0
                while st:
                    cy, cx = st.pop()
                    n += 1
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < H and 0 <= nx < W and A[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            st.append((ny, nx))
                comps.append(n)
    return sorted(comps, reverse=True)


def build(draw, S=64):
    global CELL
    CELL = S
    frames = [clamp(draw(n), S) for n in POSES]
    sheet = Image.new("RGBA", (S * 3, S * 3))
    hashes = set()
    for i, f in enumerate(frames):
        b = f.getbbox()
        assert b and b[0] > 0 and b[1] > 0 and b[2] < S and b[3] <= S - 3, (POSES[i], b)
        hashes.add(hashlib.sha256(f.tobytes()).hexdigest())
        sheet.alpha_composite(f, (i % 3 * S, i // 3 * S))
    assert len(hashes) == 9, "duplicate pose"
    colors = {c for _, c in sheet.getcolors(S * S * 9) if c[3]}
    assert len(colors) <= 32, len(colors)
    assert set(sheet.getchannel("A").tobytes()) <= {0, 255}
    return frames, sheet, len(colors)


def preview(frames, sheet, out: Path, S=64, idle_ms=170):
    out.mkdir(parents=True, exist_ok=True)
    bg = (32, 40, 64, 255)

    def on_bg(im, k):
        b = Image.new("RGBA", im.size, bg)
        b.alpha_composite(im)
        return b.convert("RGB").resize((im.width * k, im.height * k), Image.Resampling.NEAREST)

    k = 4 if S <= 64 else 3
    big = on_bg(sheet, k)
    d = ImageDraw.Draw(big)
    for i, n in enumerate(POSES):
        x, y = i % 3 * S * k, i // 3 * S * k
        d.rectangle([x, y, x + S * k - 1, y + S * k - 1], outline=(70, 80, 110))
        d.line([x, y + (S - 4) * k + k, x + S * k - 1, y + (S - 4) * k + k], fill=(90, 70, 70))
        d.text((x + 4, y + 3), f"{i} {'skill' if n == 'recover' else n}", fill=(230, 230, 210))
    big.save(out / "sheet_4x.png")
    on_bg(frames[0], k).save(out / "portrait_4x.png")
    for tag, seq, dur in (("idle", [0, 1, 2, 1], [idle_ms] * 4),
                          ("attack", [0, 3, 4, 5, 0], [200, 320, 160, 380, 260]),
                          ("skill", [0, 3, 6, 6, 0], [200, 360, 300, 300, 260]),
                          ("cycle", [0, 1, 2, 1, 3, 4, 5, 0, 3, 6, 0, 7, 8],
                           [idle_ms] * 4 + [320, 160, 380, 200, 360, 600, 200, 420, 1000])):
        imgs = [on_bg(frames[i], k) for i in seq]
        imgs[0].save(out / f"{tag}.gif", save_all=True, append_images=imgs[1:], duration=dur, loop=0, disposal=2)


def run(slug, draw, argv, S=64, idle_ms=170):
    """시트·초상 저장 + 검사. argv 에 --preview DIR 이 있으면 DIR 에 4배 시트·GIF."""
    sheet_path = ROOT / f"public/assets/generated/pixel-enemies/{slug}.png"
    portrait_path = ROOT / f"public/assets/generated/pixel-enemy-portraits/{slug}.png"
    frames, sheet, ncol = build(draw, S)
    for i, f in enumerate(frames[:3]):
        parts = islands(f)
        assert len(parts) == 1, (slug, POSES[i], parts)  # 대기 칸은 떨어진 픽셀 없이 한 덩어리
    sheet.save(sheet_path)
    portrait = frames[0]  # 초상은 시트와 같은 칸 크기(96 칸 종은 96 초상)
    portrait.save(portrait_path)
    for path, im in ((sheet_path, sheet), (portrait_path, portrait)):
        with Image.open(path) as r:
            assert r.convert("RGBA").tobytes() == im.tobytes()
    if "--preview" in argv:
        preview(frames, sheet, Path(argv[argv.index("--preview") + 1]), S, idle_ms)
    print(f"{slug}: 9 poses, {ncol} colors, sheet sha256 {hashlib.sha256(sheet_path.read_bytes()).hexdigest()}")
    return frames, sheet
