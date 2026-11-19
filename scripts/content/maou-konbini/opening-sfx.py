"""『전생한 마왕, 편의점 알바 시작하다』 오프닝·옥좌 결전·원룸 효과음 — 자체 합성(제3자 샘플 없음).

마계 굉음(옥좌의 방 첫 박) · 성문 박차기 · 레코드 긁힘(흥정 개그 박) · 동귀어진 소멸 · 형광등 치익 · 원룸 생활 소음 ·
잔고 0엔 슬픈 나팔 · 현관 우편함 전단지. 필터·잔향·라우드니스 마감은 폴른 스타 오프닝 효과음(scripts/content/fallen/opening-sfx.py)과 같은 방식이다.

    python3 scripts/content/maou-konbini/opening-sfx.py [--only a,b]

출력: public/assets/cc0/audio/maou/mk-op-*.ogg (48kHz 스테레오 vorbis). .git/info/exclude 때문에 `git add -f` 가 필요하다.
"""
import os, subprocess, sys, tempfile, wave
import numpy as np
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "../../../public/assets/cc0/audio/maou")
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


# ── 소리들 ──────────────────────────────────────────────────────────────

def saw(t, f):
    ph = np.cumsum(np.broadcast_to(f, t.shape)) / SR
    return 2 * (ph % 1.0) - 1


def dread():
    """마계 굉음 — 옥좌의 방이 열릴 때. 땅이 우는 저역 + 짐승 같은 으르렁 + 큰 홀 잔향."""
    rng = rng_for("dread"); sec = 4.2; t = t_(sec); n = len(t)
    env = np.clip(t / 0.35, 0, 1) * np.exp(-np.maximum(0, t - 0.5) / 1.3)
    sub = sine_sweep(t, 70, 34, 1.2) * env
    growl_f = 52 + 6 * np.sin(2 * np.pi * 0.7 * t)
    growl = bandpass(saw(t, growl_f) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)), 70, 900) * env
    rumble = lowpass(brown(rng, n), 180, 2) * env
    body = mix(pan(sub * 0.9), pan(growl * 0.55, -0.2, 0.2, 6), pan(rumble * 0.8, 0.3, -0.3))
    wet = reverb(body.mean(1), rng, t60=3.2, predelay=0.03, damp=(2500, 400))
    return fit(mix(body, wet * 0.6), sec + 1.2)


def doors():
    """성문을 박차고 들어온다 — 무거운 나무문 두 짝이 벽에 부딪는 소리 둘 + 경첩 끼익 + 큰 홀 잔향."""
    rng = rng_for("doors"); sec = 2.6; n = int(sec * SR)
    def slam(at, f0):
        tt = t_(0.9); d = 0.16
        body = np.sin(2 * np.pi * f0 * tt * (1 - 0.2 * tt)) * np.exp(-tt / d)
        crack = highpass(rng.standard_normal(len(tt)), 800, 2) * np.exp(-tt / 0.025)
        knock = resonator(rng.standard_normal(len(tt)) * np.exp(-tt / 0.01), 210, 0.25)
        x = np.zeros(n); p = int(at * SR); k = min(len(tt), n - p)
        x[p:p + k] = (body + crack * 0.5 + knock * 0.4)[:k]; return x
    creak_t = t_(0.5); creak = bandpass(saw(creak_t, 380 + 140 * np.sin(2 * np.pi * 3 * creak_t)), 600, 2600) * np.hanning(len(creak_t)) * 0.25
    cr = np.zeros(n); cr[:len(creak)] = creak
    dry = mix(pan(slam(0.08, 70), -0.4), pan(slam(0.21, 62), 0.4), pan(cr, -0.2, 0.2))
    wet = reverb(dry.mean(1), rng, t60=2.6, predelay=0.025, damp=(4000, 600))
    return fit(mix(dry, wet * 0.7), sec)


def scratch():
    """레코드 긁힘 — 「4분의 1」 흥정 개그 박. 장엄한 분위기를 긁어 세운다."""
    rng = rng_for("scratch"); sec = 0.55; t = t_(sec); n = len(t)
    # 판을 앞으로 당겼다 뒤로 미는 두 번의 손짓: 재생 속도 곡선
    speed = np.interp(t, [0, 0.08, 0.2, 0.32, 0.45, sec], [0.2, 2.6, -1.8, 2.2, 0.1, 0])
    hz = 400 + 1800 * np.abs(speed)
    noise = rng.standard_normal(n)
    out = np.zeros(n); low = band = 0.0
    for i in range(n):  # 움직이는 대역 통과
        f = 2 * np.sin(np.pi * min(hz[i], SR / 6) / SR); high = noise[i] - low - 0.5 * band; band += f * high; low += f * band; out[i] = band
    tone = np.sin(2 * np.pi * np.cumsum(220 * speed) / SR) * 0.3
    env = np.clip(np.abs(speed) / 2.6, 0, 1) ** 0.6
    return pan((out * 0.8 + tone) * env, 0.1)


def vanish():
    """『동귀어진』 — 빛이 빨려 들며 높아지다(2.3초) 안으로 무너지고, 하얀 잡음이 길게 꺼진다. 끝은 완전한 정적."""
    rng = rng_for("vanish"); sec = 6.0; t = t_(sec); n = len(t)
    hit = 2.3
    pre = t < hit
    whine = sine_sweep(t, 3200, 180, -1.0) if False else np.sin(2 * np.pi * np.cumsum(180 * (16 ** np.clip(t / hit, 0, 1))) / SR)
    whine *= np.where(pre, (t / hit) ** 2, 0) * 0.55
    swell = highpass(pink(rng, n), 300, 2) * np.where(pre, (t / hit) ** 3, 0)
    sub = sine_sweep(np.maximum(0, t - hit), 90, 28, 0.5) * np.where(pre, 0, np.exp(-np.maximum(0, t - hit) / 0.9))
    burst = pink(rng, n) * np.where(pre, 0, np.exp(-np.maximum(0, t - hit) / 0.5)) * 0.8
    shimmer = grains(rng, n, [p for p in poisson_times(rng, n, lambda s: 40 if hit < s < hit + 1.5 else 0)], lambda r: ping(r, 2500, 7000)) * 0.4
    dry = mix(pan(whine, -0.3, 0.3), pan(swell * 0.6, 0.4, -0.4, 4), pan(sub * 1.1), pan(burst * 0.7, -0.2, 0.2, 7), pan(shimmer, 0.5, -0.5))
    wet = reverb(dry.mean(1), rng, t60=3.6, predelay=0.02, damp=(7000, 900))
    st = fit(mix(dry, wet * 0.75), sec)
    fade = np.clip((sec - 0.2 - t) / 2.0, 0, 1); st *= fade[:, None]
    return st


def fluoro():
    """형광등이 켜진다 — 점등관 「틱」, 치익·치직 깜빡이는 웅웅거림 셋, 그다음 낮게 이어지는 형광등 소리."""
    rng = rng_for("fluoro"); sec = 3.6; t = t_(sec); n = len(t)
    hum = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(120, 0.5), (240, 0.3), (360, 0.18), (480, 0.1)])
    buzz = bandpass(np.sign(np.sin(2 * np.pi * 120 * t)) * 0.4 + rng.standard_normal(n) * 0.25, 900, 6000)
    gate = np.zeros(n)
    for a, b in [(0.25, 0.33), (0.6, 0.66), (0.85, 1.05), (1.25, sec)]:
        gate[int(a * SR):int(b * SR)] = 1
    gate = lowpass(gate, 60, 2)
    steady = np.clip((t - 1.25) / 0.3, 0, 1)
    level = gate * (1 - 0.65 * steady)
    clicks = grains(rng, n, [0.05 * SR, 0.22 * SR, 0.58 * SR, 0.84 * SR, 1.24 * SR], lambda r: crackle(r, (3, 8), 1500) * 1.6)
    sizzle = grains(rng, n, [p for p in poisson_times(rng, n, lambda s: 90 if s < 1.3 else 4)], lambda r: crackle(r, (1, 4), 2500))
    dry = mix(pan((hum * 0.6 + buzz * 0.5) * level, 0.0), pan(clicks, -0.1), pan(sizzle * 0.5 * gate, 0.2))
    wet = reverb(dry.mean(1), rng, t60=0.35, predelay=0.005, damp=(6000, 2500))
    return fit(mix(dry, wet * 0.3), sec)


def room():
    """원룸 생활 소음 — 냉장고 웅웅, 멀리 지나가는 차, 벽 너머 희미한 전철. 아주 작게."""
    rng = rng_for("room"); sec = 12.0; t = t_(sec); n = len(t)
    fridge = (np.sin(2 * np.pi * 50 * t) * 0.5 + np.sin(2 * np.pi * 100 * t) * 0.25 + bandpass(rng.standard_normal(n), 200, 400) * 0.08) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.13 * t))
    cars = np.zeros(n)
    for at, dur, p0 in [(1.2, 3.5, -0.8), (6.5, 4.0, 0.7)]:
        tt = t_(dur); env = np.sin(np.pi * tt / dur) ** 2
        swish = lowpass(pink(rng, len(tt)), 900, 2) * env
        a = int(at * SR); cars[a:a + len(tt)] += swish[: n - a]
    train = lowpass(brown(rng, n), 120, 2) * np.clip(np.sin(np.pi * np.clip((t - 4) / 6, 0, 1)), 0, 1) * 0.6
    return mix(pan(fridge * 0.5, -0.2), pan(cars * 0.6, -0.7, 0.7, 8), pan(train, 0.3))


def sad_horn():
    """잔고 0엔 — 슬픈 나팔 네 음(뿌, 뿌, 뿌, 뿌우우). 마지막 음은 떨며 꺼진다."""
    rng = rng_for("sadhorn"); notes = [(233.1, 0.36), (220.0, 0.36), (207.7, 0.36), (196.0, 1.5)]
    parts = []
    for i, (f, d) in enumerate(notes):
        tt = t_(d + 0.05)
        vib = 1 + (0.012 * np.sin(2 * np.pi * 5.5 * tt) * np.clip((tt - 0.3) / 0.3, 0, 1) if i == 3 else 0)
        bend = 1 - (0.03 * np.clip((tt - 0.9) / 0.6, 0, 1) if i == 3 else 0)
        x = saw(tt, f * vib * bend) * 0.7 + np.sin(2 * np.pi * np.cumsum(f * vib * bend) / SR) * 0.4
        env = np.clip(tt / 0.04, 0, 1) * np.clip((d + 0.05 - tt) / 0.08, 0, 1)
        wah = np.clip(tt / 0.15, 0, 1)
        x = sweep(x * env, "low", 500, 1400 if i < 3 else 900, q=1.4) * (0.6 + 0.4 * wah)
        parts.append(x)
    dry = np.concatenate(parts)
    wet = reverb(dry, rng, t60=0.9, predelay=0.01, damp=(5000, 1500))
    return fit(mix(pan(dry, -0.05), wet * 0.25), len(dry) / SR + 0.6)


def mailslot():
    """현관 우편함 — 철판 덮개가 덜컥 열렸다 닫히고, 종이가 바닥을 미끄러진다."""
    rng = rng_for("mail"); sec = 1.6; n = int(sec * SR)
    def clack(at, amp):
        k = rng.standard_normal(int(0.06 * SR)) * np.exp(-np.arange(int(0.06 * SR)) / (0.004 * SR))
        x = sum(resonator(k, f, d) * a for f, d, a in [(1240, 0.12, 0.5), (2730, 0.08, 0.35), (4410, 0.05, 0.2)])
        out = np.zeros(n); p = int(at * SR); m = min(len(x), n - p); out[p:p + m] = x[:m] * amp; return out
    tt = t_(0.7); slide = bandpass(rng.standard_normal(len(tt)), 1500, 7000) * np.sin(np.pi * tt / 0.7) ** 1.5 * 0.35
    sl = np.zeros(n); p = int(0.3 * SR); sl[p:p + len(slide)] = slide
    dry = mix(pan(clack(0.02, 1.0), 0.2), pan(clack(0.95, 0.7), 0.2), pan(sl, 0.1, -0.2))
    wet = reverb(dry.mean(1), rng, t60=0.4, predelay=0.004, damp=(7000, 2500))
    return fit(mix(dry, wet * 0.35), sec)


# (파일, 함수, 최대 단기 LUFS 목표, 최고치 dBFS)
SOUNDS = [
    ("mk-op-dread", dread, -14.0, -1.0),
    ("mk-op-doors", doors, -15.0, -1.0),
    ("mk-op-scratch", scratch, -15.0, -1.0),
    ("mk-op-vanish", vanish, -13.0, -1.0),
    ("mk-op-fluoro", fluoro, -20.0, -2.0),
    ("mk-op-room", room, -30.0, -6.0),
    ("mk-op-sad-horn", sad_horn, -17.0, -1.0),
    ("mk-op-mailslot", mailslot, -19.0, -1.0),
]


if __name__ == "__main__":
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    print(f"{'file':22} {'sec':>5} {'I LUFS':>7} {'S max':>7} {'M max':>7} {'peak':>6}")
    for name, fn, target, ceiling in SOUNDS:
        if only and name not in only: continue
        st = finish(fn(), target, ceiling)
        write(name, st)
        i, s, m, p = loudness(st)
        print(f"{name:22} {len(st) / SR:5.2f} {i:7.1f} {s:7.1f} {m:7.1f} {p:6.1f}")
