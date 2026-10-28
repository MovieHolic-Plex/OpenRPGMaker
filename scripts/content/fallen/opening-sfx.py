"""폴른 스타 오프닝 효과음 — 별이 커지고, 갈라지고, 불꼬리를 끌며 떨어져 숲에 박히는 한 줄기 소리.

번들 효과음은 0.5~2초 짧은 타격뿐이라(osx-explosion 0.56초) 별이 떨어지는 9초가 끊겨 들렸다(사용자 2026-10-29
「별이 떨어지는 장면이 연속적이지 않고 소리가 좀…」). 제3자 샘플 없이 numpy 로 직접 합성한다(CC0, 자체 생성).

출력: public/assets/cc0/audio/opening/*.ogg (48kHz 스테레오). 다시 만들기: python3 scripts/content/fallen/opening-sfx.py
"""
import os, subprocess, tempfile, wave
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(20261029)
OUT = os.path.join(os.path.dirname(__file__), "../../../public/assets/cc0/audio/opening")


def t_(sec): return np.arange(int(sec * SR)) / SR


def lowpass(x, hz, order=4):
    b, a = signal.butter(order, min(hz, SR / 2 - 100) / (SR / 2), "low"); return signal.lfilter(b, a, x)


def highpass(x, hz, order=4):
    b, a = signal.butter(order, hz / (SR / 2), "high"); return signal.lfilter(b, a, x)


def sweep_lowpass(x, hz_from, hz_to, block=1024):
    """차단 주파수가 시간에 따라 움직이는 저역 통과(블록마다 상태를 이어 붙인다)."""
    out = np.zeros_like(x); zi = None
    n = len(x)
    for s in range(0, n, block):
        u = s / max(1, n - 1)
        hz = hz_from * (hz_to / hz_from) ** u
        b, a = signal.butter(2, hz / (SR / 2), "low")
        if zi is None: zi = signal.lfilter_zi(b, a) * 0
        out[s:s + block], zi = signal.lfilter(b, a, x[s:s + block], zi=zi)
    return out


def brown(n):
    w = rng.standard_normal(n); b = np.cumsum(w); b -= lowpass(b, 8, 1); return b / (np.abs(b).max() + 1e-9)


def crackles(n, rate, decay_ms=6, hp=1500):
    """불티 튀는 소리 — 무작위 시각의 짧은 잡음 알갱이."""
    x = np.zeros(n); k = int(decay_ms / 1000 * SR)
    env = np.exp(-np.arange(k) / (k / 4))
    for p in np.nonzero(rng.random(n) < rate / SR)[0]:
        g = rng.standard_normal(k) * env * rng.uniform(0.3, 1.0)
        x[p:p + k] += g[: len(x[p:p + k])]
    return highpass(x, hp)


def stereo(mono, pan_from=0.0, pan_to=0.0, width=0.0):
    n = len(mono); pan = np.linspace(pan_from, pan_to, n)
    l = mono * np.sqrt((1 - pan) / 2); r = mono * np.sqrt((1 + pan) / 2)
    if width:  # 오른쪽만 몇 ms 늦춰 넓게
        d = int(width * SR); r = np.concatenate([np.zeros(d), r[:-d]])
    return np.stack([l, r], 1)


def write(name, st, peak_db=-1.0):
    st = st / (np.abs(st).max() + 1e-9) * 10 ** (peak_db / 20)
    fade = int(0.01 * SR); st[:fade] *= np.linspace(0, 1, fade)[:, None]; st[-fade:] *= np.linspace(1, 0, fade)[:, None]
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f: tmp = f.name
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype("<i2").tobytes())
    dst = os.path.join(OUT, name + ".ogg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libvorbis", "-q:a", "6", dst], check=True)
    os.unlink(tmp); print(dst, round(len(st) / SR, 2), "s")


# 1. 별이 커진다 — 높은 배음 덩어리가 천천히 차오르고, 갈라지기 직전 숨을 들이켜듯 공기가 빨려 든다.
def star_swell():
    t = t_(5.5); n = len(t)
    tone = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * a for f, a in [(1318.5, .5), (1975.5, .35), (2637, .25), (3951, .12)])
    tone *= 0.6 + 0.4 * np.sin(2 * np.pi * 5.3 * t)  # 반짝임
    tone *= (t / t[-1]) ** 2.2
    suck = sweep_lowpass(rng.standard_normal(n), 300, 3000) * np.clip((t - 4.0) / 1.5, 0, 1) ** 3
    return stereo(tone * 0.5 + suck * 0.25, 0.15, 0.15, 0.004)


# 2. 갈라짐 — 유리 금 가는 소리 알갱이 + 짧고 깊은 쿵 + 반짝이며 흩어지는 꼬리.
def star_crack():
    t = t_(3.0); n = len(t)
    crack = crackles(int(0.18 * SR), 900, 3, 3000); crack = np.concatenate([crack, np.zeros(n - len(crack))]) * 1.4
    f = 70 * np.exp(-t * 3) + 32
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    burst = lowpass(rng.standard_normal(n), 2500) * np.exp(-t * 9)
    sparkle = highpass(rng.standard_normal(n), 5000) * np.exp(-t * 1.6) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t)) * 0.25
    return stereo(crack + thump * 0.9 + burst * 0.5 + sparkle, 0.1, 0.1, 0.006)


# 3. 떨어진다 — 불붙은 덩어리가 다가오며 커지는 굉음(차단 주파수·크기가 함께 오른다) + 불티. 소리는 왼쪽 위에서 가운데로.
def meteor_roar(sec=7.35):
    t = t_(sec); n = len(t)
    body = sweep_lowpass(brown(n) * 0.7 + rng.standard_normal(n) * 0.3, 180, 1800)
    body *= (0.15 + 0.85 * (t / t[-1]) ** 1.6) * (1 + 0.18 * np.sin(2 * np.pi * 0.9 * t) * np.sin(2 * np.pi * 7 * t))
    hiss = sweep_lowpass(rng.standard_normal(n), 600, 4500) * (t / t[-1]) ** 2.5 * 0.25
    fire = crackles(n, 40, 5, 1200) * (0.3 + 0.7 * t / t[-1]) * 0.5
    # 박히기 직전 0.25초는 숨을 죽인다 — 충돌이 더 크게 들린다.
    duck = np.clip((t[-1] - t) / 0.25, 0.08, 1) ** 1.5
    return stereo((body + hiss + fire) * duck, -0.5, 0.05, 0.003)


# 4. 박힌다 — 땅을 치는 깊은 쿵(60→28Hz) + 터지는 잡음 + 길게 굴러가는 땅울림 + 흩어지는 흙·불티.
def impact():
    t = t_(5.0); n = len(t)
    f = 62 * np.exp(-t * 2.2) + 26
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.5)
    blast = lowpass(rng.standard_normal(n), 2200) * np.exp(-t * 6)
    rumble = lowpass(brown(n), 140) * np.exp(-t * 0.75) * np.clip(t / 0.15, 0, 1) * 1.2
    debris = crackles(n, 25, 8, 700) * np.exp(-t * 1.1) * 0.6
    return stereo(thump * 1.0 + blast * 0.55 + rumble + debris, 0.05, 0.0, 0.008)


if __name__ == "__main__":
    write("fs-op-star-swell", star_swell(), -3.0)
    write("fs-op-star-crack", star_crack(), -1.0)
    write("fs-op-meteor-roar", meteor_roar(), -2.0)
    write("fs-op-impact", impact(), -0.5)
