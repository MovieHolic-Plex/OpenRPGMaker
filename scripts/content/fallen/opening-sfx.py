"""폴른 스타 오프닝 효과음 — 밤공기, 별이 차오르고 갈라져 불꼬리를 끌며 숲에 박히고, 알이 숨 쉬고, 종이 울리고, 제목이 뜬다.

v1(2026-10-29 오전)은 소리 한 겹씩이라 「합성 티가 나고 얇다」(사용자 「효과음도 그렇고…」). v2 는 모든 소리를 층으로 쌓는다:
  저역(서브 붐·땅울림) · 중역(몸통) · 고역(파편·반짝임) · 공간(합성 잔향 — 시간이 갈수록 어두워지는 잔향 꼬리).
제3자 샘플은 쓰지 않는다. 예외: 종·징은 번들 CC0 효과음(rubberduck 100 CC0 SFX 의 bell-01·gong-02)에 저역과 잔향을 덧입힌다.

라우드니스: BS.1770 K-가중 적분 라우드니스(LUFS)와 최대 단기(3초) 라우드니스를 재서 파일마다 목표에 맞추고(TARGET),
표본 최고치는 -1 dBFS 를 넘지 않게 부드럽게 누른다. DC 는 20Hz 고역 통과로 없앤다. 측정값은 실행할 때 표로 찍는다.
  python3 scripts/content/fallen/opening-sfx.py            # 만들기 + 측정표
  python3 scripts/content/fallen/opening-sfx.py --plots DIR # 스펙트로그램·RMS 포락 PNG 도 남긴다

출력: public/assets/cc0/audio/opening/fs-op-*.ogg (48kHz 스테레오 vorbis). .git/info/exclude 때문에 `git add -f` 가 필요하다.
"""
import os, subprocess, sys, tempfile, wave
import numpy as np
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "../../../public/assets/cc0/audio/opening")
SE_DIR = os.path.join(HERE, "../../../public/assets/se/oga-sfx")


def rng_for(name):
    return np.random.default_rng(sum(map(ord, name)) * 7919 + 20261029)


def t_(sec): return np.arange(int(round(sec * SR))) / SR


# ── 필터 ────────────────────────────────────────────────────────────────

def lowpass(x, hz, order=4):
    sos = signal.butter(order, min(hz, SR / 2 - 200) / (SR / 2), "low", output="sos"); return signal.sosfilt(sos, x, axis=0)


def highpass(x, hz, order=4):
    sos = signal.butter(order, hz / (SR / 2), "high", output="sos"); return signal.sosfilt(sos, x, axis=0)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), min(hi, SR / 2 - 200) / (SR / 2)], "band", output="sos"); return signal.sosfilt(sos, x, axis=0)


def sweep(x, kind, hz_from, hz_to, curve=1.0, block=256, q=0.9):
    """시간에 따라 차단(중심) 주파수가 움직이는 2차 필터(상태 변수 필터). kind = low/band/high. curve>1 이면 끝에서 빨리 움직인다."""
    n = len(x); out = np.zeros(n); low = band = 0.0
    for s in range(0, n, block):
        u = (s / max(1, n - 1)) ** curve
        hz = hz_from * (hz_to / hz_from) ** u
        f = 2 * np.sin(np.pi * min(hz, SR / 6) / SR); damp = 1 / q
        seg = x[s:s + block]; o = np.empty(len(seg))
        for i, v in enumerate(seg):
            low += f * band; high = v - low - damp * band; band += f * high
            o[i] = low if kind == "low" else band if kind == "band" else high
        out[s:s + block] = o
    return out


def resonator(x, hz, decay_s):
    """감쇠 공진(유리·쇠의 울림 한 줄). decay_s = 60dB 떨어지는 시간."""
    r = np.exp(-6.9 / (decay_s * SR)); w = 2 * np.pi * hz / SR
    return signal.lfilter([1 - r], [1, -2 * r * np.cos(w), r * r], x)


# ── 소리 재료 ───────────────────────────────────────────────────────────

def brown(rng, n):
    b = np.cumsum(rng.standard_normal(n)); b = highpass(b, 15, 2); return b / (np.abs(b).max() + 1e-9)


def pink(rng, n):
    w = rng.standard_normal(n)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    p = signal.lfilter(b, a, w); return p / (np.abs(p).max() + 1e-9)


def grains(rng, n, times, make):
    """정해진 시각마다 make(rng) 로 만든 짧은 알갱이를 얹는다."""
    x = np.zeros(n)
    for p in times:
        g = make(rng); p = int(p)
        if p >= n: continue
        k = min(len(g), n - p); x[p:p + k] += g[:k]
    return x


def poisson_times(rng, n, rate_fn):
    """시간에 따라 바뀌는 빈도(초당) 로 포아송 시각을 뽑는다."""
    t = 0.0; out = []
    while True:
        r = max(1e-3, rate_fn(t)); t += rng.exponential(1 / r)
        if t * SR >= n: return out
        out.append(t * SR)


def ping(rng, lo=3500, hi=9000, dur=(0.03, 0.12)):
    """반짝이 한 알 — 높은 사인이 짧게 울리고 사라진다."""
    d = rng.uniform(*dur); tt = t_(d * 4); f = rng.uniform(lo, hi)
    return np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * np.exp(-tt / d) * rng.uniform(0.3, 1)


def crackle(rng, ms=(2, 9), hp=1200):
    k = int(rng.uniform(*ms) / 1000 * SR); env = np.exp(-np.arange(k) / (k / 4))
    return highpass(rng.standard_normal(k) * env, hp, 2) * rng.uniform(0.25, 1)


def thud(rng, f=(90, 260), dur=(0.04, 0.12)):
    """돌·흙덩이가 떨어지는 둔한 소리."""
    d = rng.uniform(*dur); tt = t_(d * 4); f0 = rng.uniform(*f)
    body = np.sin(2 * np.pi * f0 * tt * (1 - 0.15 * tt / tt[-1])) * np.exp(-tt / d)
    return (body + lowpass(rng.standard_normal(len(tt)), 900, 2) * np.exp(-tt / (d * 0.5)) * 0.6) * rng.uniform(0.3, 1)


def sine_sweep(t, f_from, f_to, tau):
    f = f_to + (f_from - f_to) * np.exp(-t / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def soft_clip(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


# ── 공간 ────────────────────────────────────────────────────────────────

def reverb(dry, rng, t60=2.2, predelay=0.02, damp=(6000, 900), width=1.0):
    """합성 잔향. 좌우가 다른 지수 감쇠 잡음 IR — 시간이 갈수록 저역 통과 차단이 damp[0]→damp[1] 로 내려가 꼬리가 어두워진다.
    초기 반사 몇 개를 앞에 둔다. 출력은 젖은 소리만(스테레오)."""
    n = int(t60 * SR * 1.1); tt = np.arange(n) / SR
    env = np.exp(-6.9 * tt / t60) * np.clip(tt / 0.008, 0, 1)
    ir = np.zeros((n, 2))
    for ch in range(2):
        nz = rng.standard_normal(n) * env
        # 시간 구간별로 다른 저역 통과를 걸어 이어 붙인다(꼬리가 어두워진다).
        seg = 8; edges = np.linspace(0, n, seg + 1).astype(int)
        for i in range(seg):
            hz = damp[0] * (damp[1] / damp[0]) ** (i / (seg - 1))
            ir[edges[i]:edges[i + 1], ch] = lowpass(nz, hz, 2)[edges[i]:edges[i + 1]]
        for k in range(6):  # 초기 반사
            d = int((0.011 + 0.017 * k + rng.uniform(0, 0.006)) * SR)
            if d < n: ir[d, ch] += rng.uniform(0.25, 0.6) * (0.8 ** k) * (1 if rng.random() > 0.5 else -1)
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True)) + 1e-9
    pad = int(predelay * SR)
    if dry.ndim == 1: dry = np.stack([dry, dry], 1)
    wet = np.stack([signal.fftconvolve(dry[:, c], ir[:, c]) for c in range(2)], 1)
    wet = np.concatenate([np.zeros((pad, 2)), wet])
    if width < 1:
        mid = wet.mean(1, keepdims=True); wet = mid + (wet - mid) * width
    return wet


def mix(*parts):
    n = max(len(p) for p in parts); out = np.zeros((n, 2))
    for p in parts:
        if p.ndim == 1: p = np.stack([p, p], 1)
        out[:len(p)] += p
    return out


def pan(mono, p_from=0.0, p_to=None, delay_ms=0.0):
    """등전력 패닝(-1 왼쪽 … 1 오른쪽). delay_ms 만큼 오른쪽을 늦춰 넓힌다."""
    n = len(mono); p = np.linspace(p_from, p_from if p_to is None else p_to, n)
    l = mono * np.cos((p + 1) * np.pi / 4); r = mono * np.sin((p + 1) * np.pi / 4)
    if delay_ms:
        d = int(delay_ms / 1000 * SR); r = np.concatenate([np.zeros(d), r[:-d]])
    return np.stack([l, r], 1) * np.sqrt(2)


def fit(x, sec):
    n = int(round(sec * SR))
    if len(x) >= n: return x[:n]
    return np.concatenate([x, np.zeros((n - len(x),) + x.shape[1:])])


def read_ogg(path):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: tmp = f.name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s16le", tmp], check=True)
    with wave.open(tmp) as w: a = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2) / 32768.0
    os.unlink(tmp); return a


# ── 라우드니스(BS.1770) ─────────────────────────────────────────────────

def k_weight(x):
    # 48kHz 고정 계수(ITU-R BS.1770-4)
    x = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=0)
    return signal.lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], x, axis=0)


def loudness(st):
    """(적분 LUFS, 최대 단기 3초 LUFS, 최대 순간 0.4초 LUFS, 표본 최고 dBFS)."""
    k = k_weight(st); p = (k ** 2).sum(1)
    def windows(sec, hop=0.1):
        w = int(sec * SR); h = int(hop * SR)
        if len(p) < w: return np.array([p.mean()])
        c = np.concatenate([[0], np.cumsum(p)]); idx = np.arange(0, len(p) - w + 1, h)
        return (c[idx + w] - c[idx]) / w
    lu = lambda e: -0.691 + 10 * np.log10(np.maximum(e, 1e-12))
    m = windows(0.4); blocks = m[lu(m) > -70]
    if len(blocks):
        rel = lu(blocks.mean()) - 10; blocks = blocks[lu(blocks) > rel]
    integ = lu(blocks.mean()) if len(blocks) else -70
    return integ, lu(windows(3.0)).max(), lu(m).max(), 20 * np.log10(np.abs(st).max() + 1e-12)


# ── 마감 ────────────────────────────────────────────────────────────────

def limit(st, ceil, look_ms=3.0, release_ms=90.0):
    """앞을 내다보는 최고치 제한기 — 넘치는 곳의 이득을 미리(3ms) 내리고 천천히(90ms) 푼다. 찌그러뜨리지 않는다."""
    a = np.abs(st).max(1); need = np.minimum(1.0, ceil / np.maximum(a, 1e-9))
    look = int(look_ms / 1000 * SR)
    # 앞쪽 look 표본 안의 최소 이득(미리 내리기)
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * look + 1, origin=0)
    rel = np.exp(-1 / (release_ms / 1000 * SR)); out = np.empty_like(g); cur = 1.0
    for i, v in enumerate(g):
        cur = v if v < cur else v + (cur - v) * rel
        out[i] = cur
    out = signal.lfilter([1 / look] * look, [1], np.concatenate([np.ones(look), out]))[look:]  # 부드럽게
    return st * np.minimum(out, g)[:, None] * 0.999


def finish(st, target_short, ceiling_db=-1.0):
    """DC 제거 → 최대 단기 라우드니스를 목표로 맞춤 → 제한기로 -1dBFS 안으로(한 번 더 맞춤) → 끝 페이드."""
    st = highpass(st, 26, 4)  # DC·초저역(들리지 않고 최고치만 잡아먹는다) 제거
    _, short, _, _ = loudness(st)
    st = st * 10 ** ((target_short - short) / 20)
    for _ in range(6):  # 제한기가 깎은 만큼 다시 올린다
        st = limit(st, 10 ** (ceiling_db / 20))
        _, short, _, _ = loudness(st)
        if abs(target_short - short) < 0.3: break
        st = st * 10 ** ((target_short - short) / 20)
    st = limit(st, 10 ** (ceiling_db / 20))
    fi = int(0.003 * SR); fo = int(0.03 * SR)
    st[:fi] *= np.linspace(0, 1, fi)[:, None]; st[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return st


def write(name, st):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: tmp = f.name
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(st, -1, 1) * 32767).astype("<i2").tobytes())
    dst = os.path.join(OUT, name + ".ogg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libvorbis", "-q:a", "7", dst], check=True)
    os.unlink(tmp); return dst


# ── 소리들 ──────────────────────────────────────────────────────────────

def night_air():
    """첫 컷 앞 9초 — 밤바람과 먼 풀벌레. 아주 작게, 갈라지는 박에서 끊긴다(큐가 끊는다)."""
    rng = rng_for("air"); sec = 9.5; t = t_(sec); n = len(t)
    gust = lowpass(rng.standard_normal(n), 0.4, 1); gust = 0.55 + 0.45 * gust / (np.abs(gust).max() + 1e-9)
    wind = sweep(pink(rng, n), "band", 260, 520, q=0.7) * gust
    wind2 = pan(sweep(pink(rng, n), "band", 900, 700, q=1.2) * gust[::-1] * 0.3, -0.4, 0.3)
    # 풀벌레 — 4.6kHz 근처에서 3번씩 짧게 우는 소리를 멀리 둔다(왼쪽·오른쪽 두 마리).
    def cricket(f0, phase, p):
        x = np.zeros(n)
        for start in np.arange(phase, sec, 1.35 + rng.uniform(-0.1, 0.1)):
            for j in range(3):
                s = int((start + j * 0.055) * SR); k = int(0.035 * SR)
                if s + k >= n: break
                tt = np.arange(k) / SR; x[s:s + k] += np.sin(2 * np.pi * f0 * tt) * np.sin(np.pi * tt / tt[-1]) ** 2
        return pan(x * 0.12, p)
    bugs = mix(cricket(4650, 0.3, -0.6), cricket(4380, 0.95, 0.55))
    fade = np.clip(t / 2.0, 0, 1)[:, None]
    dry = mix(pan(wind, -0.1, 0.1, 9), wind2, bugs) * fade
    return fit(mix(dry, reverb(dry, rng, 1.6, 0.03, (4000, 900)) * 0.35), sec)


def star_swell():
    """5.4초. 반짝이는 고역 덩어리가 차오르고, 낮은 울림이 깔리고, 마지막 마디 네 박에 심장처럼 뛴다.
    끝 0.7초는 공기가 빨려 드는 역회전 잡음 — 0.08초 정적으로 끊겨 갈라짐이 크게 들린다."""
    rng = rng_for("swell"); sec = 5.4; t = t_(sec); n = len(t); T = sec - 0.08
    rise = np.clip(t / T, 0, 1)
    # 고역: 별빛 화음(E6·B6·E7·G#7) — 줄마다 조금씩 어긋나게 흔들어 합창처럼.
    shimmer = np.zeros(n)
    for f, a in [(1318.5, .5), (1975.5, .38), (2637, .28), (3322, .16), (3951, .12)]:
        for d in (-1, 1):
            ff = f * (1 + d * 0.0035) * (1 + 0.002 * np.sin(2 * np.pi * rng.uniform(0.2, 0.5) * t))
            shimmer += np.sin(2 * np.pi * np.cumsum(ff) / SR + rng.uniform(0, 6)) * a * 0.5
    shimmer *= rise ** 2.4 * (0.7 + 0.3 * np.sin(2 * np.pi * 5.3 * t))
    sparkle = grains(rng, n, poisson_times(rng, n, lambda s: 3 + 40 * (s / T) ** 2), lambda r: ping(r, 4000, 10000)) * rise ** 1.5
    # 저역: 55Hz 와 다섯째 82.5Hz 가 천천히 부푼다 + 마지막 1.5초 41Hz 서브가 밑을 받친다.
    drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.5 * t + 1) + 0.35 * np.sin(2 * np.pi * 110.3 * t)) * rise ** 1.8 * 0.5
    sub = np.sin(2 * np.pi * 41 * t) * np.clip((t - (T - 1.6)) / 1.6, 0, 1) ** 2 * 0.6
    # 심장 박: 마지막 마디의 네 박(곡 박 0.75초) — 그림의 별 무리가 같은 박에 부푼다.
    beats = [T + 0.08 - 0.75 * k - 0.75 for k in (4, 3, 2, 1)]  # 갈라짐 박 기준 4·3·2·1 박 앞
    heart = np.zeros(n)
    for i, b in enumerate(beats):
        s = int(b * SR); tt = t_(0.5)
        g = sine_sweep(tt, 95, 48, 0.05) * np.exp(-tt / 0.11) * (0.5 + 0.17 * i)
        k = min(len(g), n - s); heart[s:s + k] += g[:k]
    # 빨려 드는 공기 — 높아지는 띠 잡음이 지수로 커지다가 뚝.
    suck_env = np.clip((t - (T - 0.75)) / 0.75, 0, 1) ** 3 * (t < T)
    suck = sweep(rng.standard_normal(n), "band", 500, 7000, curve=2.0, q=1.4) * suck_env
    hi = mix(pan(shimmer * 0.42, -0.2, 0.25, 7), pan(sparkle * 0.35, 0.3, -0.3, 3))
    lo = mix(pan(drone + sub + heart * 1.2, 0))
    air = pan(suck * 0.7, 0.15, 0, 4)
    dry = mix(hi, lo, air)
    wet = reverb(mix(hi, air), rng, 2.6, 0.03, (7000, 1500)) * 0.5
    out = fit(mix(dry, wet), sec)
    out[int(T * SR):] *= 0  # 마지막 정적
    return out


def star_crack():
    """4.5초. 유리에 금 가는 알갱이 수십 개(0~0.15초) + 유리 울림(엇나간 배음) + 깊은 쿵(90→34Hz) + 중역 파열 + 반짝이며 흩어지는 꼬리."""
    rng = rng_for("crack"); sec = 4.5; t = t_(sec); n = len(t)
    # 금: 짧은 잡음 알갱이를 유리 공진 넷에 통과시킨다.
    times = np.sort(np.concatenate([rng.uniform(0, 0.03, 8), rng.exponential(0.045, 40)])) * SR
    raw = grains(rng, n, times, lambda r: r.standard_normal(int(r.uniform(0.0008, 0.004) * SR)) * r.uniform(0.3, 1))
    glass = sum(resonator(raw, f, d) * a for f, d, a in [(2210, .35, 1), (3730, .28, .8), (5180, .22, .7), (6940, .18, .55), (8820, .12, .4)])
    glass = highpass(glass + highpass(raw, 2500) * 0.6, 1500)
    ring = np.zeros(n)  # 금이 다 간 뒤 남는 유리 울림 — 엇나간 배음, 1.4초
    for f, a, d in [(1870, .5, 1.4), (3412, .35, 1.0), (5236, .25, .8), (7790, .15, .6)]:
        ring += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * a * np.exp(-6.9 * t / (d * 3)) * (1 + 0.15 * np.sin(2 * np.pi * 3.1 * t))
    ring *= np.clip(t / 0.01, 0, 1)
    # 저역: 깊은 쿵 + 2배음(작은 스피커에서도 들리게 살짝 찌그러뜨린다).
    boom = soft_clip(sine_sweep(t, 92, 34, 0.12) * np.exp(-t / 0.55), 1.8)
    body = lowpass(rng.standard_normal(n), 1400) * np.exp(-t / 0.09) * 0.9 + bandpass(rng.standard_normal(n), 300, 2500) * np.exp(-t / 0.035) * 0.8
    # 꼬리: 반짝이 알갱이가 사방으로 흩어진다(좌우 무작위, 빈도가 줄어든다).
    tail = np.zeros((n, 2))
    for p in poisson_times(rng, n, lambda s: 70 * np.exp(-s / 0.9) + 2):
        g = ping(rng, 3500, 11000, (0.02, 0.09)) * np.exp(-(p / SR) / 1.6)
        s = int(p); k = min(len(g), n - s)
        tail[s:s + k] += pan(g[:k], rng.uniform(-0.9, 0.9))
    hi = mix(pan(glass * 0.55, 0.15, 0.1, 5), pan(ring * 0.32, -0.1, 0.1, 9), tail * 0.45)
    lo = pan(boom * 1.0 + body * 0.6, 0.05)
    dry = mix(hi, lo)
    wet = reverb(mix(hi, pan(body * 0.6, 0)), rng, 3.0, 0.025, (8000, 1200)) * 0.55
    return fit(mix(dry, wet), sec)


def meteor_roar():
    """7.35초. 다가오는 불덩이 — 띠 잡음 중심이 150→900Hz 로, 저역 통과가 500→6000Hz 로 열리고(가까워질수록 밝게),
    낮게 우는 소리의 음높이가 70→118Hz 로 오른다(도플러처럼). 공기를 찢는 난류 떨림, 불티, 깔리는 서브.
    왼쪽 위에서 가운데로 다가오고 점점 넓어진다. 박히기 0.28초 전부터 숨을 죽인다."""
    rng = rng_for("roar"); sec = 7.35; t = t_(sec); n = len(t); u = t / sec
    turb = lowpass(rng.standard_normal(n), 9, 2); turb = 1 + 0.35 * turb / (np.abs(turb).max() + 1e-9)
    grow = (0.1 + 0.9 * u ** 1.5)
    body = sweep(brown(rng, n) * 0.6 + pink(rng, n) * 0.5, "band", 150, 900, curve=1.4, q=0.8)
    body = sweep(body, "low", 500, 6000, curve=1.6) * grow * turb
    hiss = sweep(rng.standard_normal(n), "band", 1500, 6500, curve=2.2, q=1.0) * u ** 2.6 * turb * 0.5
    f0 = 70 * (118 / 70) ** (u ** 1.3) * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    whine = sum(np.sin(k * ph + rng.uniform(0, 6)) / k ** 1.1 for k in range(1, 9))
    whine = sweep(whine, "low", 300, 2400, curve=1.5) * u ** 1.8 * 0.55 * turb
    sub = lowpass(brown(rng, n), 70) * (0.15 + 0.85 * u ** 2) * 1.4
    fire = grains(rng, n, poisson_times(rng, n, lambda s: 12 + 110 * (s / sec) ** 2), lambda r: crackle(r, (2, 7), 1500)) * (0.3 + 0.7 * u) * 0.6
    duck = np.clip((sec - t) / 0.28, 0.03, 1) ** 2
    near = mix(pan(body * 0.9, -0.55, 0.0, 6), pan(hiss, -0.4, 0.1, 11), pan(whine, -0.5, 0.0, 3), pan(fire, -0.6, 0.2, 2))
    near = near * (0.6 + 0.4 * u)[:, None] + near[:, ::-1] * (0.4 * u)[:, None]  # 다가올수록 넓어진다
    lo = pan(sub, 0)
    dry = mix(near, lo) * duck[:, None]
    wet = reverb(near * duck[:, None], rng, 1.8, 0.02, (5000, 900)) * 0.3
    out = fit(mix(dry, wet), sec)
    return out


def impact():
    """6.5초. 땅을 치는 소리 — 날카로운 첫 타격 + 서브 드롭(78→22Hz, 1.6초) + 중역 폭발 + 흙·돌·불티 파편(2.5초) + 긴 땅울림 + 큰 잔향."""
    rng = rng_for("impact"); sec = 6.5; t = t_(sec); n = len(t)
    click = highpass(rng.standard_normal(n), 2000) * np.exp(-t / 0.006) * 1.2
    blast = lowpass(rng.standard_normal(n), 3200) * np.exp(-t / 0.18) * 1.0 + lowpass(rng.standard_normal(n), 700) * np.exp(-t / 0.4) * 0.7
    drop = soft_clip(sine_sweep(t, 78, 22, 0.35) * np.exp(-t / 1.2) * np.clip(t / 0.004, 0, 1), 2.2)
    rumble = lowpass(brown(rng, n), 130) * np.exp(-t / 1.3) * np.clip(t / 0.08, 0, 1) * 0.7
    rocks = grains(rng, n, poisson_times(rng, n, lambda s: (90 * np.exp(-s / 0.5) + 6 * np.exp(-s / 1.5)) * (s > 0.08)), lambda r: thud(r))
    dirt = grains(rng, n, poisson_times(rng, n, lambda s: (160 * np.exp(-s / 0.7) + 10) * (s > 0.15)), lambda r: crackle(r, (2, 10), 900)) * np.exp(-t / 1.4)
    rain = sweep(pink(rng, n), "band", 3000, 1200, q=0.8) * np.clip((t - 0.3) / 0.4, 0, 1) * np.exp(-t / 1.0) * 0.25  # 흙비
    hi = mix(pan(click + blast * 1.25, 0.0, 0.0, 4), pan(rocks * 0.6, -0.35, 0.35, 8), pan(dirt * 0.5, 0.4, -0.3, 5), pan(rain, -0.2, 0.2, 13))
    lo = pan(drop * 0.6 + rumble * 0.8, 0)
    dry = mix(hi, lo)
    wet = reverb(mix(hi, pan(blast * 0.8 + rumble * 0.3, 0)), rng, 3.4, 0.035, (5000, 600)) * 0.6
    return fit(mix(dry, wet), sec)


def smolder():
    """6.5초. 충돌 뒤 — 낮게 타닥이는 불, 숨 쉬듯 흔들리는 바람, 이따금 무너지는 나뭇가지."""
    rng = rng_for("smolder"); sec = 6.5; t = t_(sec); n = len(t)
    fire = grains(rng, n, poisson_times(rng, n, lambda s: 26), lambda r: crackle(r, (2, 12), 700)) * 0.7
    pops = grains(rng, n, poisson_times(rng, n, lambda s: 2.2), lambda r: crackle(r, (8, 25), 400) * 2)
    roar = sweep(brown(rng, n) * 0.5 + pink(rng, n) * 0.5, "band", 180, 260, q=0.6) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.35 * t))
    branch = grains(rng, n, [int(1.9 * SR), int(4.2 * SR)], lambda r: thud(r, (120, 200), (0.08, 0.16)) * 1.3)
    dry = mix(pan(fire, -0.3, 0.3, 6), pan(pops * 0.6, 0.4, -0.2, 3), pan(roar * 0.55, 0, 0, 12), pan(branch * 0.5, -0.5))
    return fit(mix(dry, reverb(dry, rng, 1.8, 0.02, (4500, 800)) * 0.35), sec)


def pod_hum():
    """4.5초. 은빛 알이 숨 쉬는 소리 — 맑은 화음(A5·E6·A6)이 1.1Hz 로 들숨·날숨처럼 부풀고, 아래에 낮은 웅웅."""
    rng = rng_for("pod"); sec = 4.5; t = t_(sec); n = len(t)
    breath = 0.55 + 0.45 * np.sin(2 * np.pi * 1.1 * t - np.pi / 2)
    chord = sum(np.sin(2 * np.pi * f * (1 + 0.003 * np.sin(2 * np.pi * 0.3 * t + i)) * t + i) * a
                for i, (f, a) in enumerate([(880, .5), (1318.5, .35), (1760, .25), (2637, .1)]))
    hum = np.sin(2 * np.pi * 110 * t) * 0.35 + np.sin(2 * np.pi * 220.4 * t) * 0.15
    env = np.clip(t / 1.2, 0, 1) ** 1.5
    dry = mix(pan(chord * breath * env * 0.4, -0.2, 0.2, 9), pan(hum * breath * env, 0))
    return fit(mix(dry, reverb(dry, rng, 3.0, 0.04, (6000, 1500)) * 0.7), sec)


def bell():
    """5초. 번들 종(bell-01, CC0) + 한 옥타브 아래로 늘인 같은 종(몸통) + 탑 안을 채우는 긴 잔향."""
    rng = rng_for("bell"); src = read_ogg(os.path.join(SE_DIR, "bell-01.ogg")); mono = src.mean(1)
    low = signal.resample(mono, len(mono) * 2)  # 반 속도 = 한 옥타브 아래, 두 배 길이
    low = lowpass(low, 1200) * np.exp(-np.arange(len(low)) / SR / 1.2)
    ts = t_(4.5); sub = np.sin(2 * np.pi * 55 * ts) * np.exp(-ts / 0.7) * np.clip(ts / 0.01, 0, 1) * 0.04
    dry = mix(pan(mono, 0.1, 0.1, 4), pan(low * 0.16, -0.1, -0.1, 8), pan(sub, 0))
    return fit(mix(dry * 0.9, reverb(dry, rng, 3.8, 0.03, (6500, 1100)) * 0.75), 5.0)


def title_rise():
    """3초. 제목이 뜨기 직전 — 거꾸로 감은 심벌처럼 숨이 차오르는 공기 + 위로 흩어지는 반짝이. 끝에서 바로 끊는다(징이 받는다)."""
    rng = rng_for("rise"); sec = 3.0; t = t_(sec); n = len(t)
    env = (t / sec) ** 3.2
    air = sweep(rng.standard_normal(n), "band", 1200, 9000, curve=1.6, q=0.8) * env
    sparkle = grains(rng, n, poisson_times(rng, n, lambda s: 4 + 50 * (s / sec) ** 2), lambda r: ping(r, 3000, 9000)) * (t / sec) ** 1.5
    chord = sum(np.sin(2 * np.pi * f * t + i) * a for i, (f, a) in enumerate([(659.3, .4), (987.8, .3), (1318.5, .25)])) * env * 0.5
    dry = mix(pan(air * 0.6, -0.3, 0.3, 8), pan(sparkle * 0.3, 0.3, -0.3, 4), pan(chord, 0, 0, 6))
    out = mix(dry, reverb(dry, rng, 2.0, 0.02, (8000, 2000)) * 0.4)
    out = fit(out, sec); out[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))[:, None]
    return out


def title_hit():
    """6초. 제목이 뜨는 박 — 번들 징(gong-02, CC0) + 깊은 서브 붐 + 아주 긴 잔향."""
    rng = rng_for("hit"); src = read_ogg(os.path.join(SE_DIR, "gong-02.ogg")); mono = src.mean(1)
    t = t_(6.0); boom = soft_clip(sine_sweep(t, 70, 36, 0.2) * np.exp(-t / 0.9), 1.5) * np.clip(t / 0.006, 0, 1)
    dry = mix(pan(mono, 0, 0, 5), pan(boom * 0.14, 0))
    return fit(mix(dry, reverb(dry, rng, 4.5, 0.04, (6000, 900)) * 0.8), 6.0)


# (파일, 만들기, 목표 최대 단기 라우드니스 LUFS, 표본 최고 dBFS 천장).
# 게임에서는 오프닝 곡(음량 0.7 에서 단기 -19~-13 LUFS, 최고 -3.3 dBFS)과 함께 울린다. 브라우저 출력은 넘치면 잘리므로
# 곡과 겹쳐도 0 dBFS 를 넘지 않게 천장을 낮게 잡고, 대신 제한기로 밀도를 올렸다(측정: /tmp 녹화 mux 의 곡·효과음 분리 합).
# 큰 타격(갈라짐·충돌·종·제목)은 곡보다 3~5 LU 위, 바닥 소리(밤바람·불·알)는 곡 밑에 깔린다.
SOUNDS = [
    ("fs-op-night-air", night_air, -27, -12),
    ("fs-op-star-swell", star_swell, -18, -7),
    ("fs-op-star-crack", star_crack, -13, -4.5),
    ("fs-op-meteor-roar", meteor_roar, -14, -6.5),
    ("fs-op-impact", impact, -12.5, -3),
    ("fs-op-smolder", smolder, -24, -12),
    ("fs-op-pod-hum", pod_hum, -21, -10),
    ("fs-op-bell", bell, -13, -4.5),
    ("fs-op-title-rise", title_rise, -19, -8),
    ("fs-op-title-hit", title_hit, -14, -4.5),
]


def plot(name, st, outdir):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    m = st.mean(1); fig, ax = plt.subplots(2, 1, figsize=(9, 5), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    f, tt, S = signal.spectrogram(m, SR, nperseg=2048, noverlap=1536)
    ax[0].pcolormesh(tt, f, 10 * np.log10(S + 1e-12), vmin=-120, vmax=-30, shading="auto", cmap="magma"); ax[0].set_yscale("symlog", linthresh=200); ax[0].set_ylim(20, 20000)
    ax[0].set_title(name); ax[0].set_ylabel("Hz")
    w = int(0.05 * SR); r = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, "same")); x = np.arange(len(m)) / SR
    for band, col in [((20, 150), "#e66"), ((150, 2000), "#6c6"), ((2000, 20000), "#69f")]:
        b = bandpass(m, max(band[0], 20), band[1]) if band[0] > 20 else lowpass(m, band[1])
        rb = np.sqrt(np.convolve(b ** 2, np.ones(w) / w, "same")); ax[1].plot(x, 20 * np.log10(rb + 1e-6), col, lw=0.8, label=f"{band[0]}-{band[1]}")
    ax[1].plot(x, 20 * np.log10(r + 1e-6), "k", lw=1, label="all"); ax[1].set_ylim(-70, 0); ax[1].set_ylabel("RMS dB"); ax[1].legend(fontsize=7, loc="upper right"); ax[1].set_xlabel("s")
    fig.tight_layout(); fig.savefig(os.path.join(outdir, name + ".png"), dpi=80); plt.close(fig)


if __name__ == "__main__":
    plots = sys.argv[sys.argv.index("--plots") + 1] if "--plots" in sys.argv else None
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    if plots: os.makedirs(plots, exist_ok=True)
    print(f"{'file':22} {'sec':>5} {'I LUFS':>7} {'S max':>7} {'M max':>7} {'peak':>6}")
    for name, fn, target, ceiling in SOUNDS:
        if only and name not in only: continue
        st = finish(fn(), target, ceiling)
        write(name, st)
        i, s, m, p = loudness(st)
        print(f"{name:22} {len(st) / SR:5.2f} {i:7.1f} {s:7.1f} {m:7.1f} {p:6.1f}")
        if plots: plot(name, st, plots)
